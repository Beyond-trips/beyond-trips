import { PayloadRequest } from 'payload'

interface SessionInfo {
  sessionId: string
  userId: string
  deviceInfo: {
    userAgent: string
    browser: string
    os: string
    device: string
  }
  location: {
    ipAddress: string
    country?: string
    city?: string
  }
  loginTime: string
  lastActive: string
  isCurrent: boolean
  isActive: boolean
}

interface SessionStats {
  totalSessions: number
  activeSessions: number
  currentSession: SessionInfo | null
  otherSessions: SessionInfo[]
}

// ===== AU4: VIEW ACTIVE SESSIONS =====

/**
 * AU4: View Active Sessions
 * User views all their active sessions and devices
 */
export const getActiveSessions = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📱 Getting active sessions for user:', user.id)

    // Get all active sessions for this user
    const sessions = await req.payload.find({
      collection: 'user-sessions',
      where: {
        and: [
          { userId: { equals: user.id } },
          { isActive: { equals: true } }
        ]
      },
      sort: '-lastActive',
      limit: 50
    })

    // Parse user agent and device info
    const sessionInfos: SessionInfo[] = sessions.docs.map((session: any) => {
      const deviceInfo = parseUserAgent(session.userAgent || '')
      
      return {
        sessionId: session.id,
        userId: session.userId,
        deviceInfo: {
          userAgent: session.userAgent || '',
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device: deviceInfo.device
        },
        location: {
          ipAddress: session.ipAddress || 'Unknown',
          country: session.country || undefined,
          city: session.city || undefined
        },
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        isCurrent: session.isCurrent || false,
        isActive: session.isActive
      }
    })

    // Calculate session stats
    const stats: SessionStats = {
      totalSessions: sessionInfos.length,
      activeSessions: sessionInfos.filter(s => s.isActive).length,
      currentSession: sessionInfos.find(s => s.isCurrent) || null,
      otherSessions: sessionInfos.filter(s => !s.isCurrent)
    }

    console.log('✅ Retrieved', stats.totalSessions, 'active sessions')

    return new Response(JSON.stringify({
      success: true,
      sessions: sessionInfos,
      stats,
      lastUpdated: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get active sessions error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get active sessions',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Create New Session
 * Create a new session when user logs in
 */
export const createSession = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { userAgent, ipAddress, deviceInfo } = body

    console.log('🔐 Creating new session for user:', user.id)

    // Get client IP from request headers if not provided
    const clientIP = ipAddress || 
      req.headers.get('x-forwarded-for') || 
      req.headers.get('x-real-ip') || 
      'Unknown'

    // Parse device information
    const parsedDeviceInfo = parseUserAgent(userAgent || '')

    // Create new session
    const session = await req.payload.create({
      collection: 'user-sessions',
      data: {
        userId: user.id,
        sessionToken: generateSessionToken(),
        userAgent: userAgent || '',
        ipAddress: clientIP,
        browser: parsedDeviceInfo.browser,
        os: parsedDeviceInfo.os,
        device: parsedDeviceInfo.device,
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        isActive: true,
        isCurrent: true
      }
    })

    // Mark other sessions as not current
    await req.payload.update({
      collection: 'user-sessions',
      where: {
        and: [
          { userId: { equals: user.id } },
          { id: { not_equals: session.id } }
        ]
      },
      data: {
        isCurrent: false
      }
    })

    console.log('✅ Session created successfully:', session.id)

    return new Response(JSON.stringify({
      success: true,
      session: {
        id: session.id,
        sessionToken: session.sessionToken,
        loginTime: session.loginTime,
        deviceInfo: {
          browser: parsedDeviceInfo.browser,
          os: parsedDeviceInfo.os,
          device: parsedDeviceInfo.device
        },
        location: {
          ipAddress: clientIP
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Create session error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create session',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== AU4: REMOTE LOGOUT =====

/**
 * AU4: Remote Logout
 * User logs out from a specific session/device
 */
export const remoteLogout = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return new Response(JSON.stringify({
        error: 'Session ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🚪 Remote logout for session:', sessionId, 'User:', user.id)

    // Find the session
    const session = await req.payload.findByID({
      collection: 'user-sessions',
      id: sessionId
    })

    // Verify session belongs to user
    if (session.userId !== user.id) {
      return new Response(JSON.stringify({
        error: 'Forbidden - You can only logout from your own sessions'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if session is already inactive
    if (!session.isActive) {
      return new Response(JSON.stringify({
        error: 'Session is already inactive'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Deactivate session
    const updatedSession = await req.payload.update({
      collection: 'user-sessions',
      id: sessionId,
      data: {
        isActive: false,
        isCurrent: false,
        logoutTime: new Date().toISOString()
      }
    })

    // Send notification to user about remote logout
    await sendLogoutNotification(user.email, {
      device: session.device || 'Unknown Device',
      location: session.ipAddress || 'Unknown Location',
      logoutTime: updatedSession.logoutTime
    })

    console.log('✅ Remote logout successful for session:', sessionId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Successfully logged out from the selected device',
      sessionInfo: {
        id: sessionId,
        device: session.device,
        location: session.ipAddress,
        logoutTime: updatedSession.logoutTime
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Remote logout error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to logout from session',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Logout from All Sessions
 * User logs out from all devices except current
 */
export const logoutAllSessions = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🚪 Logging out from all sessions for user:', user.id)

    // Get all active sessions except current
    let otherSessions
    try {
      otherSessions = await req.payload.find({
        collection: 'user-sessions',
        where: {
          and: [
            { userId: { equals: user.id } },
            { isActive: { equals: true } },
            { isCurrent: { equals: false } }
          ]
        },
        limit: 100
      })
    } catch (queryError) {
      console.error('❌ Error querying sessions:', queryError)
      // If query fails, return success with 0 sessions (user has no other sessions)
      otherSessions = { docs: [] }
    }

    // Deactivate all other sessions
    let loggedOutCount = 0
    if (otherSessions && otherSessions.docs && otherSessions.docs.length > 0) {
      for (const session of otherSessions.docs) {
        try {
          await req.payload.update({
            collection: 'user-sessions',
            id: session.id,
            data: {
              isActive: false,
              logoutTime: new Date()
            }
          })
          loggedOutCount++
        } catch (updateError) {
          console.error('❌ Error updating session:', session.id, updateError)
          // Continue with other sessions even if one fails
        }
      }
    }

    // Send notification about mass logout (non-blocking)
    try {
      await sendLogoutNotification(user.email, {
        device: 'Multiple Devices',
        location: 'All Locations',
        logoutTime: new Date().toISOString(),
        isMassLogout: true
      })
    } catch (notifError) {
      console.error('❌ Error sending logout notification:', notifError)
      // Don't fail the request if notification fails
    }

    console.log('✅ Logged out from', loggedOutCount, 'sessions')

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully logged out from ${loggedOutCount} device(s)`,
      loggedOutSessions: loggedOutCount,
      currentSessionRemains: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Logout all sessions error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to logout from all sessions',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Update Session Activity
 * Update last active timestamp for current session
 */
export const updateSessionActivity = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { sessionId } = body

    if (!sessionId) {
      return new Response(JSON.stringify({
        error: 'Session ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update session activity
    await req.payload.update({
      collection: 'user-sessions',
      id: sessionId,
      data: {
        lastActive: new Date().toISOString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      lastActive: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update session activity error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update session activity',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== HELPER FUNCTIONS =====

function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function parseUserAgent(userAgent: string): { browser: string; os: string; device: string } {
  const ua = userAgent.toLowerCase()
  
  // Browser detection
  let browser = 'Unknown'
  if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari')) browser = 'Safari'
  else if (ua.includes('edge')) browser = 'Edge'
  else if (ua.includes('opera')) browser = 'Opera'

  // OS detection
  let os = 'Unknown'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac')) os = 'macOS'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('ios')) os = 'iOS'

  // Device detection
  let device = 'Desktop'
  if (ua.includes('mobile')) device = 'Mobile'
  else if (ua.includes('tablet')) device = 'Tablet'

  return { browser, os, device }
}

async function sendLogoutNotification(email: string, logoutInfo: any): Promise<void> {
  // This would integrate with your notification service
  console.log('📧 Sending logout notification to:', email, 'Info:', logoutInfo)
  // Implementation would depend on your notification service
}
