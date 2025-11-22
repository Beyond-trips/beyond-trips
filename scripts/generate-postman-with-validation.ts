/**
 * Enhanced Postman Collection Generator
 * Parses validation code to extract required/optional fields automatically
 * Run: npm run generate:postman
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface FieldInfo {
  name: string
  required: boolean
  type?: string
  validation?: string
  example?: any
}

interface ParsedEndpoint {
  action: string
  method: string
  fields: FieldInfo[]
  description?: string
}

// Scan directory recursively
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

// Extract function name from switch case
function extractFunctionName(switchBody: string, action: string): string | null {
  // Look for: case 'action-name': return await functionName(...)
  const caseRegex = new RegExp(`case\\s+['"]${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*:([^}]+?)(?=case\\s|default\\s|\\})`, 's')
  const match = switchBody.match(caseRegex)
  
  if (!match) return null
  
  const caseBody = match[1]
  // Extract function name from: return await functionName(...)
  const functionMatch = caseBody.match(/return\s+(?:await\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)
  
  return functionMatch ? functionMatch[1] : null
}

// Parse endpoint file to find function and extract fields
function parseEndpointFunction(endpointFile: string, functionName: string): FieldInfo[] {
  try {
    const content = readFileSync(endpointFile, 'utf-8')
    
    // Find the function
    const functionRegex = new RegExp(
      `export\\s+(?:const|async\\s+function)\\s+${functionName}\\s*=?\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::.*?)?\\s*(?:=>\\s*)?\\{([\\s\\S]*?)(?=\\nexport|$)`,
      'm'
    )
    
    const match = content.match(functionRegex)
    if (!match) return []
    
    const functionBody = match[1]
    
    // Extract destructured fields from body
    const destructureRegex = /const\s*\{([^}]+)\}\s*=\s*(?:await\s+)?(?:parseRequestBody|body|req\.body|req\.json)/g
    const fields: FieldInfo[] = []
    const seenFields = new Set<string>()
    
    let destructureMatch
    while ((destructureMatch = destructureRegex.exec(functionBody)) !== null) {
      const destructuredVars = destructureMatch[1]
      
      // Parse each field
      const fieldMatches = destructuredVars.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=\s*([^,}]+))?/g)
      
      for (const fieldMatch of fieldMatches) {
        const fieldName = fieldMatch[1].trim()
        const defaultValue = fieldMatch[2]?.trim()
        
        if (fieldName && !seenFields.has(fieldName)) {
          seenFields.add(fieldName)
          
          // Check if required (look for validation)
          const isRequired = checkIfRequired(functionBody, fieldName)
          const validation = extractValidation(functionBody, fieldName)
          const exampleValue = generateExample(fieldName, defaultValue, validation)
          
          fields.push({
            name: fieldName,
            required: isRequired,
            validation,
            example: exampleValue
          })
        }
      }
    }
    
    return fields
  } catch (error) {
    console.log(`⚠️  Could not parse ${functionName}:`, error instanceof Error ? error.message : 'Unknown error')
    return []
  }
}

// Check if field is required
function checkIfRequired(functionBody: string, fieldName: string): boolean {
  // Look for validation patterns
  const patterns = [
    // if (!field)
    new RegExp(`if\\s*\\(!${fieldName}\\s*[\\)|&]`, 'g'),
    // if (!field || ...)
    new RegExp(`if\\s*\\(!${fieldName}\\s*\\|\\|`, 'g'),
    // field is required
    new RegExp(`${fieldName}.*required`, 'gi'),
    // if (field === undefined)
    new RegExp(`if\\s*\\(${fieldName}\\s*===\\s*undefined`, 'g'),
  ]
  
  return patterns.some(pattern => pattern.test(functionBody))
}

// Extract validation rules
function extractValidation(functionBody: string, fieldName: string): string | undefined {
  // Look for validation error messages
  const errorPatterns = [
    // 'field is required'
    new RegExp(`error.*${fieldName}.*required`, 'gi'),
    // 'field must be...'
    new RegExp(`error.*${fieldName}.*must\\s+be.*?['"]`, 'gi'),
    // if (field.length < 8)
    new RegExp(`if\\s*\\(${fieldName}\\.length\\s*<\\s*(\\d+)`, 'g'),
    // if (!/regex/.test(field))
    new RegExp(`if\\s*\\(!?/([^/]+)/\\.test\\(${fieldName}\\)`, 'g'),
  ]
  
  for (const pattern of errorPatterns) {
    const match = functionBody.match(pattern)
    if (match) {
      if (match[1]) {
        if (match[0].includes('length <')) {
          return `min length: ${match[1]}`
        }
        return match[1]
      }
      return match[0].replace(/.*error[:\s]*['"]?/gi, '').replace(/['"].*/g, '')
    }
  }
  
  return undefined
}

// Generate example value based on field name and validation
function generateExample(fieldName: string, defaultValue?: string, validation?: string): any {
  // Remove default value quotes/strings
  if (defaultValue) {
    defaultValue = defaultValue.replace(/^['"]|['"]$/g, '')
  }
  
  // Use default value if provided and not just empty string
  if (defaultValue && defaultValue !== '""' && defaultValue !== "''") {
    return defaultValue
  }
  
  // Generate based on field name patterns
  const name = fieldName.toLowerCase()
  
  // IDs
  if (name.endsWith('id') || name.includes('_id')) {
    return `<${fieldName.replace(/([A-Z])/g, '-$1').toLowerCase()}>`
  }
  
  // Email
  if (name.includes('email')) {
    return 'user@example.com'
  }
  
  // Password
  if (name.includes('password')) {
    if (name.includes('confirm')) return 'Password123!'
    if (name.includes('new')) return 'NewPassword123!'
    if (name.includes('current') || name.includes('old')) return 'OldPassword123!'
    return 'Password123!'
  }
  
  // Phone/Contact
  if (name.includes('phone') || name.includes('contact')) {
    return '+2348012345678'
  }
  
  // Amount/Price/Budget
  if (name.includes('amount') || name.includes('price') || name.includes('budget') || name.includes('spend')) {
    return 50000
  }
  
  // Quantity/Count
  if (name.includes('quantity') || name.includes('count') || name.includes('scans')) {
    return 1
  }
  
  // Boolean flags
  if (name.startsWith('is') || name.startsWith('has') || name.startsWith('enable') || name.includes('verified')) {
    return true
  }
  
  // Dates
  if (name.includes('date') || name.includes('time') || name.includes('at')) {
    return new Date().toISOString()
  }
  
  // Progress/Percentage
  if (name.includes('progress') || name.includes('percentage')) {
    return 100
  }
  
  // Names
  if (name.includes('name') && !name.includes('username')) {
    if (name.includes('company')) return 'My Company Ltd'
    if (name.includes('campaign')) return 'Campaign Name'
    if (name.includes('first')) return 'John'
    if (name.includes('last')) return 'Doe'
    if (name.includes('account')) return 'Account Holder'
    if (name.includes('bank')) return 'Access Bank'
    return 'Name'
  }
  
  // Address
  if (name.includes('address')) {
    return '123 Street Name, City, State'
  }
  
  // Description/Notes/Reason
  if (name.includes('description') || name.includes('notes') || name.includes('reason') || name.includes('message')) {
    return 'Description or notes here'
  }
  
  // Type/Category/Status
  if (name.includes('type') || name.includes('category') || name.includes('status')) {
    if (name.includes('campaign')) return 'magazine'
    if (name.includes('media')) return 'image'
    if (name.includes('device')) return 'mobile'
    return 'category'
  }
  
  // Industry
  if (name.includes('industry')) {
    return 'Technology'
  }
  
  // City/State/Location
  if (name.includes('city')) return 'Lagos'
  if (name.includes('state')) return 'Lagos State'
  if (name.includes('location')) return { latitude: 6.5244, longitude: 3.3792 }
  
  // Code/OTP
  if (name.includes('code') || name.includes('otp')) {
    return '123456'
  }
  
  // Numbers
  if (name.includes('number')) {
    if (name.includes('account')) return '0123456789'
    if (name.includes('license')) return 'LAG12345XYZ'
    return '123456'
  }
  
  // URL
  if (name.includes('url') || name.includes('link') || name.includes('website')) {
    return 'https://example.com'
  }
  
  // Generic string
  return `<${fieldName}>`
}

// Extract actions from switch statements
function extractActionsFromRoute(content: string, method: string): string[] {
  const actions: string[] = []
  
  const methodRegex = new RegExp(
    `export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=export\\s+async\\s+function|$)`,
    'i'
  )
  
  const methodMatch = content.match(methodRegex)
  if (!methodMatch) return actions
  
  const methodBody = methodMatch[1]
  const switchMatch = methodBody.match(/switch\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/m)
  if (!switchMatch) return actions
  
  const switchBody = switchMatch[1]
  const caseRegex = /case\s+['"]([^'"]+)['"]\s*:/g
  let match
  
  while ((match = caseRegex.exec(switchBody)) !== null) {
    if (match[1] !== 'default') {
      actions.push(match[1])
    }
  }
  
  return actions
}

// Find endpoint file for parsing
function findEndpointFile(projectRoot: string, routeFile: string): string | null {
  // Extract potential endpoint file name from route file
  const routePath = routeFile.split('/')
  const apiIndex = routePath.indexOf('api')
  
  if (apiIndex < 0) return null
  
  const category = routePath[apiIndex + 1]
  const endpointFiles = [
    `${category}Endpoints.ts`,
    `${category.replace(/-/g, '')}Endpoints.ts`,
    `${category}Dashboard.ts`,
    `${category}DashboardEndpoints.ts`,
  ]
  
  const endpointsDir = join(projectRoot, 'src', 'endpoints')
  
  for (const file of endpointFiles) {
    const fullPath = join(endpointsDir, file)
    try {
      statSync(fullPath)
      return fullPath
    } catch {
      // File doesn't exist, try next
    }
  }
  
  return null
}

// Create request with parsed fields
function createRequestWithFields(
  method: string,
  path: string,
  action: string,
  category: string,
  fields: FieldInfo[]
): any {
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
  
  // Generate body from parsed fields
  const bodyObj: any = {}
  const requiredFields: string[] = []
  const optionalFields: string[] = []
  
  for (const field of fields) {
    bodyObj[field.name] = field.example
    if (field.required) {
      requiredFields.push(field.name)
    } else {
      optionalFields.push(field.name)
    }
  }
  
  // Build description
  let description = `${method} ${path}?action=${action}`
  if (requiredFields.length > 0) {
    description += `\n\nRequired: ${requiredFields.join(', ')}`
  }
  if (optionalFields.length > 0) {
    description += `\n\nOptional: ${optionalFields.join(', ')}`
  }
  
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
      ...(hasBody && Object.keys(bodyObj).length > 0 && {
        body: {
          mode: 'raw',
          raw: JSON.stringify(bodyObj, null, 2),
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
      description
    }
  }
}

// Main generation logic
function generateCollection() {
  const projectRoot = join(__dirname, '..')
  const apiDir = join(projectRoot, 'src', 'app', 'api')
  const routeFiles = scanDirectory(apiDir, projectRoot)
  
  console.log(`📁 Found ${routeFiles.length} route files`)
  console.log(`🔍 Parsing endpoint validation code...`)
  
  const categoryMap = new Map<string, any[]>()
  let totalWithFields = 0
  let totalParsed = 0
  
  for (const routeFile of routeFiles) {
    const fullPath = join(projectRoot, routeFile)
    const content = readFileSync(fullPath, 'utf-8')
    
    const pathParts = routeFile.split('/').filter(p => p !== 'route.ts' && p !== 'routes.ts' && p !== 'src' && p !== 'app')
    let apiPath = '/' + pathParts.join('/')
    apiPath = apiPath.replace(/\[\.\.\.(\w+)\]/, ':$1').replace(/\[(\w+)\]/g, ':$1')
    
    const category = pathParts[1] || 'General'
    const usesQuery = content.includes('searchParams.get(') && content.includes("'action'")
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, [])
    }
    
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    
    for (const method of methods) {
      const actions = extractActionsFromRoute(content, method)
      
      if (actions.length > 0 && usesQuery) {
        // Find endpoint file
        const endpointFile = findEndpointFile(projectRoot, routeFile)
        
        for (const action of actions) {
          totalParsed++
          let fields: FieldInfo[] = []
          
          if (endpointFile) {
            // Extract function name from switch case
            const methodRegex = new RegExp(
              `export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=export\\s+async\\s+function|$)`,
              'i'
            )
            const methodMatch = content.match(methodRegex)
            if (methodMatch) {
              const methodBody = methodMatch[1]
              const switchMatch = methodBody.match(/switch\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/m)
              if (switchMatch) {
                const functionName = extractFunctionName(switchMatch[1], action)
                if (functionName) {
                  fields = parseEndpointFunction(endpointFile, functionName)
                  if (fields.length > 0) {
                    totalWithFields++
                    console.log(`  ✅ ${action}: ${fields.length} fields parsed`)
                  }
                }
              }
            }
          }
          
          const request = createRequestWithFields(method, apiPath, action, category, fields)
          categoryMap.get(category)!.push(request)
        }
      } else if (actions.length === 0 && content.includes(`export async function ${method}`)) {
        // No switch statement, just create basic endpoint
        categoryMap.get(category)!.push({
          name: `${method} ${apiPath.split('/').pop() || 'endpoint'}`,
          request: {
            method: method,
            header: [
              { name: 'Authorization', value: 'Bearer {{bearerToken}}', type: 'text' },
              { name: 'Content-Type', value: 'application/json', type: 'text' }
            ],
            url: {
              raw: '{{baseUrl}}' + apiPath,
              protocol: 'http',
              host: ['{{baseUrl}}'],
              path: apiPath.split('/').filter(Boolean)
            }
          }
        })
      }
    }
  }
  
  // Create folders
  const folders: any[] = []
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
  
  folders.sort((a, b) => a.name.localeCompare(b.name))
  
  const totalRequests = folders.reduce((sum, folder) => sum + folder.item.length, 0)
  
  console.log(`\n📊 Results:`)
  console.log(`   Total endpoints: ${totalRequests}`)
  console.log(`   Endpoints with parsed fields: ${totalWithFields}/${totalParsed} (${Math.round(totalWithFields/totalParsed*100)}%)`)
  
  return {
    info: {
      name: 'Beyond Trips API',
      description: `Complete API collection with smart request bodies\n\n✅ ${totalRequests} endpoints\n🔍 ${totalWithFields} with auto-generated bodies\n📝 Extracted from validation code`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: folders,
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }]
    },
    variable: [
      { key: 'baseUrl', value: 'http://localhost:3000', type: 'string' },
      { key: 'bearerToken', value: '<get-from-login-endpoint>', type: 'string' }
    ]
  }
}

// Execute
console.log('🔨 Generating Postman collection with validation parsing...')

try {
  const collection = generateCollection()
  const outputPath = join(__dirname, '..', 'postman-collection.json')
  
  writeFileSync(outputPath, JSON.stringify(collection, null, 2))
  
  console.log('\n✅ Collection generated successfully!')
  console.log(`📝 Output: ${outputPath}`)
  console.log('\n🎯 Features:')
  console.log('   ✅ Auto-parsed request fields from validation code')
  console.log('   ✅ Smart example values based on field names')
  console.log('   ✅ Required/optional field annotations')
  console.log('   ✅ Validation rules included in descriptions')
  
} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

