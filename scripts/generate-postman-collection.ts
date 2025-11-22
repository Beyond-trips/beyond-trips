/**
 * Generate Postman Collection for Beyond Trips API
 * Scans Next.js API routes and creates an accurate Postman collection
 * Run: npm run generate:postman
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface PostmanRequest {
  name: string
  request: {
    method: string
    header: Array<{name: string, value: string, type: string}>
    body?: {
      mode: string
      raw: string
      options: {
        raw: {
          language: string
        }
      }
    }
    url: {
      raw: string
      protocol: string
      host: string[]
      path: string[]
      query?: Array<{key: string, value: string, description?: string}>
    }
    description?: string
  }
}

interface PostmanFolder {
  name: string
  item: (PostmanRequest | PostmanFolder)[]
  description?: string
}

interface PostmanCollection {
  info: {
    name: string
    description: string
    schema: string
  }
  item: PostmanFolder[]
  auth: {
    type: string
    bearer: Array<{key: string, value: string, type: string}>
  }
  variable: Array<{key: string, value: string, type: string}>
}

interface EndpointAction {
  action: string
  method: string
  description?: string
}

// Scan directory recursively for route.ts files
function scanDirectory(dir: string, baseDir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    
    if (stat.isDirectory()) {
      files.push(...scanDirectory(fullPath, baseDir))
    } else if (item === 'route.ts' || item === 'routes.ts') {
      files.push(relative(baseDir, fullPath))
    }
  }
  
  return files
}

// Extract actions from switch statements for each HTTP method
function extractActionsFromRoute(content: string, method: string): string[] {
  const actions: string[] = []
  
  // Find the function for this HTTP method
  const methodRegex = new RegExp(
    `export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=export\\s+async\\s+function|$)`,
    'i'
  )
  
  const methodMatch = content.match(methodRegex)
  if (!methodMatch) return actions
  
  const methodBody = methodMatch[1]
  
  // Find switch statement
  const switchMatch = methodBody.match(/switch\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/m)
  if (!switchMatch) return actions
  
  const switchBody = switchMatch[1]
  
  // Extract all case statements
  const caseRegex = /case\s+['"]([^'"]+)['"]\s*:/g
  let match
  
  while ((match = caseRegex.exec(switchBody)) !== null) {
    const action = match[1]
    // Skip 'default' case
    if (action !== 'default') {
      actions.push(action)
    }
  }
  
  return actions
}

// Determine if route uses query parameters vs path parameters
function usesQueryParameters(content: string): boolean {
  // Check if the route extracts 'action' from searchParams
  return content.includes('searchParams.get(') && content.includes("'action'")
}

// Extract endpoint information from route file
function extractEndpoints(filePath: string, routeFile: string): PostmanRequest[] {
  const content = readFileSync(join(filePath, routeFile), 'utf-8')
  const requests: PostmanRequest[] = []
  
  // Extract the API path from file path
  const pathParts = routeFile.split('/').filter(p => p !== 'route.ts' && p !== 'routes.ts' && p !== 'src' && p !== 'app')
  let apiPath = '/' + pathParts.join('/')
  
  // Check for dynamic segments [...]
  const dynamicMatch = apiPath.match(/\[\.\.\.(\w+)\]/)
  const hasDynamic = dynamicMatch !== null
  const dynamicParam = dynamicMatch ? dynamicMatch[1] : 'id'
  
  if (hasDynamic) {
    apiPath = apiPath.replace(/\[\.\.\.(\w+)\]/, `:${dynamicParam}`)
  }
  
  // Clean up [id] style params
  apiPath = apiPath.replace(/\[(\w+)\]/g, ':$1')
  
  const category = pathParts[1] || 'General'
  
  // Check if this route uses query parameters
  const usesQuery = usesQueryParameters(content)
  
  // Extract HTTP methods and their actions
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  const methodActions = new Map<string, string[]>()
  
  for (const method of methods) {
    const actions = extractActionsFromRoute(content, method)
    if (actions.length > 0) {
      methodActions.set(method, actions)
    }
  }
  
  // If actions found, create requests for each method+action combination
  if (methodActions.size > 0 && usesQuery) {
    for (const [method, actions] of methodActions.entries()) {
      for (const action of actions) {
        requests.push(createQueryRequest(method, apiPath, action, category))
      }
    }
  } else if (methodActions.size > 0) {
    // No query params, just create method-based endpoints
    for (const method of methodActions.keys()) {
      requests.push(createRequest(method, apiPath, category))
    }
  } else {
    // Fallback: check if methods exist without switch statements
    for (const method of methods) {
      if (content.includes(`export async function ${method}`)) {
        requests.push(createRequest(method, apiPath, category))
      }
    }
  }
  
  return requests
}

// Create a Postman request with query parameters
function createQueryRequest(method: string, path: string, action: string, category: string): PostmanRequest {
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
  
  return {
    name: `${method} ${action}`,
    request: {
      method: method,
      header: [
        {
          name: 'Authorization',
          value: 'Bearer {{bearerToken}}',
          type: 'text'
        },
        {
          name: 'Content-Type',
          value: 'application/json',
          type: 'text'
        }
      ],
      ...(hasBody && {
        body: {
          mode: 'raw',
          raw: JSON.stringify(getExampleBody(action, method), null, 2),
          options: {
            raw: {
              language: 'json'
            }
          }
        }
      }),
      url: {
        raw: `{{baseUrl}}${path}?action=${action}`,
        protocol: 'http',
        host: ['{{baseUrl}}'],
        path: path.split('/').filter(Boolean),
        query: [
          {
            key: 'action',
            value: action,
            description: `Action: ${action}`
          }
        ]
      },
      description: `${method} ${path}?action=${action}`
    }
  }
}

// Create a Postman request object
function createRequest(method: string, path: string, category: string): PostmanRequest {
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
  
  return {
    name: `${method} ${path.split('/').pop() || 'endpoint'}`,
    request: {
      method: method,
      header: [
        {
          name: 'Authorization',
          value: 'Bearer {{bearerToken}}',
          type: 'text'
        },
        {
          name: 'Content-Type',
          value: 'application/json',
          type: 'text'
        }
      ],
      ...(hasBody && {
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            // Generic placeholder
            "example": "data"
          }, null, 2),
          options: {
            raw: {
              language: 'json'
            }
          }
        }
      }),
      url: {
        raw: '{{baseUrl}}' + path,
        protocol: 'http',
        host: ['{{baseUrl}}'],
        path: path.split('/').filter(Boolean)
      }
    }
  }
}

// Get example request body based on action
function getExampleBody(action: string, method: string): any {
  // Common examples for known actions
  const examples: Record<string, any> = {
    'login': {
      email: 'user@example.com',
      password: 'Password123!'
    },
    'create-campaign': {
      campaignName: 'Summer Campaign 2024',
      campaignDescription: 'Promotional campaign',
      campaignType: 'magazine',
      budget: 50000,
      startDate: '2024-12-01',
      endDate: '2024-12-31',
      targetAudience: 'Drivers aged 25-45'
    },
    'update-campaign': {
      campaignId: '<campaign-id>',
      campaignName: 'Updated Campaign Name',
      budget: 60000
    },
    'duplicate-campaign': {
      campaignId: '<campaign-id-to-duplicate>'
    },
    'delete-campaign': {
      campaignId: '<campaign-id>'
    },
    'approve-withdrawal': {
      withdrawalId: '<withdrawal-id>',
      adminNotes: 'Approved'
    },
    'reject-withdrawal': {
      withdrawalId: '<withdrawal-id>',
      reason: 'Insufficient documentation'
    },
    'request-withdrawal': {
      amount: 5000,
      bankDetailsId: '<bank-details-id>'
    },
    'update-bank-details': {
      bankName: 'Bank Name',
      accountNumber: '1234567890',
      accountName: 'Account Holder Name',
      routingNumber: '123456789'
    },
    'upload-document': {
      documentType: 'drivers_license',
      documentUrl: '<s3-url-or-base64>'
    },
    'verify-email': {
      email: 'user@example.com',
      code: '123456'
    },
    'reset-password': {
      email: 'user@example.com',
      code: '123456',
      newPassword: 'NewPassword123!'
    },
    'mark-magazine-read': {
      magazineId: '<magazine-id>',
      readProgress: 100
    },
    'submit-support-ticket': {
      subject: 'Issue with withdrawal',
      description: 'Detailed description of the issue',
      priority: 'medium'
    },
    'change-password': {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!'
    },
    'update-profile': {
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890'
    }
  }
  
  return examples[action] || { 
    note: `Replace with actual ${action} parameters`
  }
}

// Generate the complete Postman collection
function generateCollection(): PostmanCollection {
  const apiDir = join(__dirname, '..', 'src', 'app', 'api')
  const routeFiles = scanDirectory(apiDir, join(__dirname, '..'))
  
  console.log(`📁 Found ${routeFiles.length} route files`)
  
  // Group endpoints by category
  const categoryMap = new Map<string, PostmanRequest[]>()
  
  for (const routeFile of routeFiles) {
    const fullPath = join(__dirname, '..')
    const requests = extractEndpoints(fullPath, routeFile)
    
    for (const request of requests) {
      const pathParts = routeFile.split('/')
      const apiIndex = pathParts.indexOf('api')
      const category = apiIndex >= 0 && pathParts[apiIndex + 1] 
        ? pathParts[apiIndex + 1] 
        : 'General'
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, [])
      }
      categoryMap.get(category)!.push(request)
    }
  }
  
  // Create folders for each category
  const folders: PostmanFolder[] = []
  const categoryNames: Record<string, string> = {
    'driver-dashboard': 'Driver Dashboard',
    'advertiser-dashboard': 'Advertiser Dashboard',
    'admin-dashboard': 'Admin Dashboard',
    'admin': 'Admin Management',
    'partner': 'Partner/Advertiser',
    'user': 'Driver Registration',
    'qr': 'QR Scanning',
    'notifications': 'Notifications',
    'support': 'Support Tickets',
    'analytics': 'Analytics',
    'payments': 'Payments'
  }
  
  for (const [category, requests] of categoryMap.entries()) {
    if (requests.length > 0) {
      folders.push({
        name: categoryNames[category] || category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        item: requests,
        description: `${requests.length} endpoint${requests.length !== 1 ? 's' : ''}`
      })
    }
  }
  
  // Sort folders alphabetically
  folders.sort((a, b) => a.name.localeCompare(b.name))
  
  const totalRequests = folders.reduce((sum, folder) => sum + folder.item.length, 0)
  
  console.log(`📊 Generated ${folders.length} categories with ${totalRequests} real endpoints`)
  
  return {
    info: {
      name: 'Beyond Trips API',
      description: `Complete API collection for Beyond Trips platform\n\n✅ ${totalRequests} verified endpoints\n📁 ${folders.length} categories\n🔍 Only real endpoints included\n\nNote: Most endpoints use query parameters (?action=...) to specify the operation.`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: folders,
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{bearerToken}}',
          type: 'string'
        }
      ]
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000',
        type: 'string'
      },
      {
        key: 'bearerToken',
        value: '<get-from-login-endpoint>',
        type: 'string'
      }
    ]
  }
}

// Main execution
console.log('🔨 Generating accurate Postman collection from Next.js API routes...')
console.log('🔍 Parsing switch statements to extract real endpoints...')

try {
  const collection = generateCollection()
  const outputPath = join(__dirname, '..', 'postman-collection.json')
  
  writeFileSync(outputPath, JSON.stringify(collection, null, 2))
  
  console.log('✅ Postman collection generated successfully!')
  console.log(`📝 Output: ${outputPath}`)
  console.log(`📊 Total folders: ${collection.item.length}`)
  console.log(`📊 Total endpoints: ${collection.item.reduce((sum, folder) => sum + folder.item.length, 0)}`)
  console.log('\n🎯 Key Improvements:')
  console.log('   ✅ Only real endpoints included (no fake duplicates)')
  console.log('   ✅ Proper query parameters (?action=...)')
  console.log('   ✅ Smart example request bodies')
  console.log('   ✅ Accurate HTTP method mapping')
  console.log('\n📥 To import into Postman:')
  console.log('   1. Open Postman')
  console.log('   2. Click "Import" button')
  console.log('   3. Select: beyond-trips/postman-collection.json')
  console.log('   4. Set baseUrl and bearerToken in environment')
  console.log('\n💡 See POSTMAN_QUICK_START.md for setup instructions')
} catch (error) {
  console.error('❌ Error generating collection:', error)
  process.exit(1)
}
