// endpoints/adminRolesEndpoints.ts

import type { PayloadRequest } from 'payload'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.json && typeof req.json === 'function') {
      return await req.json()
    }
    if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
      return req.body
    }
    if (req.body instanceof ReadableStream) {
      const reader = req.body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      const bodyText = new TextDecoder().decode(combined)
      return JSON.parse(bodyText)
    }
    return req.body
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

const safeFindAdminRoleById = async (
  payload: PayloadRequest['payload'],
  id: string,
) => {
  try {
    return await payload.findByID({
      collection: 'admin-roles',
      id,
    })
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('not found')) {
      return null
    }
    throw error
  }
}

// Helper function to check admin access
const checkAdminAccess = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (user.role !== 'admin') {
    return new Response(JSON.stringify({
      error: 'Access denied - Admin privileges required'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return null
}

// ===== ROLES MANAGEMENT =====

// Get all roles
export const getAllRoles = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('👥 Getting all admin roles')

    const roles = await req.payload.find({
      collection: 'admin-roles',
      sort: 'name',
      limit: 100
    })

    return new Response(JSON.stringify({
      success: true,
      roles: roles.docs.map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        assignedUsers: role.assignedUsers || [],
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      })),
      total: roles.totalDocs
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get all roles error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get roles'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Create role
export const createRole = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { name, description, permissions } = body

    if (!name || !permissions || permissions.length === 0) {
      return new Response(JSON.stringify({
        error: 'Name and at least one permission are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👥 Creating new role:', name)

    // Check if role already exists
    const existing = await req.payload.find({
      collection: 'admin-roles',
      where: { name: { equals: name } },
      limit: 1
    })

    if (existing.docs.length > 0) {
      return new Response(JSON.stringify({
        error: 'Role with this name already exists'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Convert permissions from object format to flat string format if needed
    let flatPermissions = permissions
    if (Array.isArray(permissions) && permissions.length > 0 && typeof permissions[0] === 'object') {
      flatPermissions = permissions.flatMap((p: any) => {
        if (p.resource && p.actions && Array.isArray(p.actions)) {
          return p.actions.map((action: string) => `${p.resource}.${action}`)
        }
        return []
      })
    }

    // Create role
    const newRole = await req.payload.create({
      collection: 'admin-roles',
      data: {
        name,
        displayName: name,
        description: description || '',
        permissions: flatPermissions,
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Role created successfully',
      role: {
        id: (newRole as any).id,
        name: (newRole as any).name,
        description: (newRole as any).description,
        permissions: (newRole as any).permissions
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Create role error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create role'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update role
export const updateRole = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { roleId, description, permissions } = body

    if (!roleId) {
      return new Response(JSON.stringify({
        error: 'Role ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👥 Updating role:', roleId)

    const role = await safeFindAdminRoleById(req.payload, roleId)

    if (!role) {
      return new Response(JSON.stringify({
        error: 'Role not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // No system role guard in current schema

    // Build update data
    const updateData: any = {}

    if (description) updateData.description = description
    if (permissions) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return new Response(JSON.stringify({
          error: 'Permissions must be a non-empty array'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      let flatPermissions = permissions
      if (typeof permissions[0] === 'object') {
        flatPermissions = permissions.flatMap((p: any) => {
          if (p.resource && Array.isArray(p.actions)) {
            return p.actions.map((action: string) => `${p.resource}.${action}`)
          }
          return []
        })
      }

      updateData.permissions = flatPermissions
    }

    // Update role
    const updatedRole = await req.payload.update({
      collection: 'admin-roles',
      id: roleId,
      data: updateData
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Role updated successfully',
      role: {
        id: (updatedRole as any).id,
        name: (updatedRole as any).name,
        description: (updatedRole as any).description,
        permissions: (updatedRole as any).permissions
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update role error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update role'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete role
export const deleteRole = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { roleId } = body

    if (!roleId) {
      return new Response(JSON.stringify({
        error: 'Role ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👥 Deleting role:', roleId)

    const role = await safeFindAdminRoleById(req.payload, roleId)

    if (!role) {
      return new Response(JSON.stringify({
        error: 'Role not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // No system role guard in current schema

    // Delete role
    await req.payload.delete({
      collection: 'admin-roles',
      id: roleId
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Role deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete role error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete role'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

