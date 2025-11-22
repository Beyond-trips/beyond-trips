import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PostmanRequest {
  name: string;
  request: {
    method: string;
    header: Array<{ key: string; value: string; type: string }>;
    body?: {
      mode: string;
      raw: string;
      options?: {
        raw: {
          language: string;
        };
      };
    };
    url: {
      raw: string;
      protocol: string;
      host: string[];
      path: string[];
      query?: Array<{ key: string; value: string }>;
    };
    description?: string;
  };
}

interface PostmanFolder {
  name: string;
  item: PostmanRequest[];
}

interface PostmanCollection {
  info: {
    name: string;
    description: string;
    schema: string;
  };
  variable: Array<{ key: string; value: string; type: string }>;
  item: PostmanFolder[];
}

function parseMarkdownEndpoints(markdown: string): PostmanFolder[] {
  const folders: Map<string, PostmanRequest[]> = new Map();
  const lines = markdown.split('\n');
  
  let currentFolder = '';
  let currentEndpoint: { method: string; url: string; description: string } | null = null;
  let currentBody = '';
  let inCodeBlock = false;
  let collectingBody = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect folder sections (## headers)
    if (line.startsWith('## ') && !line.startsWith('## 📚')) {
      currentFolder = line.replace('## ', '').trim();
      if (!folders.has(currentFolder)) {
        folders.set(currentFolder, []);
      }
      continue;
    }
    
    // Detect endpoint definitions (### METHOD /path)
    const endpointMatch = line.match(/^### (GET|POST|PUT|DELETE|PATCH) (.+)$/);
    if (endpointMatch) {
      // Save previous endpoint if exists
      if (currentEndpoint && currentFolder) {
        const request = createPostmanRequest(currentEndpoint, currentBody);
        folders.get(currentFolder)?.push(request);
      }
      
      // Start new endpoint
      currentEndpoint = {
        method: endpointMatch[1],
        url: endpointMatch[2],
        description: lines[i + 1]?.replace(/^\*\*|\*\*$/g, '') || ''
      };
      currentBody = '';
      collectingBody = false;
      continue;
    }
    
    // Detect start of code block (example body)
    if (line.startsWith('```json')) {
      inCodeBlock = true;
      collectingBody = true;
      currentBody = '';
      continue;
    }
    
    // Detect end of code block
    if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false;
      continue;
    }
    
    // Collect body content
    if (inCodeBlock && collectingBody) {
      currentBody += line + '\n';
    }
  }
  
  // Save last endpoint
  if (currentEndpoint && currentFolder) {
    const request = createPostmanRequest(currentEndpoint, currentBody);
    folders.get(currentFolder)?.push(request);
  }
  
  // Convert map to folders array
  const result: PostmanFolder[] = [];
  folders.forEach((items, name) => {
    if (items.length > 0) {
      result.push({ name, item: items });
    }
  });
  
  return result;
}

function createPostmanRequest(
  endpoint: { method: string; url: string; description: string },
  body: string
): PostmanRequest {
  const { method, url, description } = endpoint;
  
  // Parse URL to extract path and query params
  const [pathPart, queryPart] = url.split('?');
  const pathSegments = pathPart.split('/').filter(Boolean);
  
  // Parse query parameters
  const queryParams: Array<{ key: string; value: string }> = [];
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    params.forEach((value, key) => {
      queryParams.push({ key, value });
    });
  }
  
  // Build URL object
  const urlObj: any = {
    raw: `{{baseUrl}}${url}`,
    protocol: 'http',
    host: ['{{baseUrl}}'],
    path: pathSegments
  };
  
  if (queryParams.length > 0) {
    urlObj.query = queryParams;
  }
  
  // Build request name
  const actionMatch = url.match(/action=([^&]+)/);
  const requestName = actionMatch 
    ? `${method} ${actionMatch[1]}`
    : `${method} ${pathSegments[pathSegments.length - 1] || pathSegments[pathSegments.length - 2]}`;
  
  // Build headers
  const headers = [
    {
      key: 'Authorization',
      value: 'Bearer {{bearerToken}}',
      type: 'text'
    }
  ];
  
  // Build request object
  const request: any = {
    method,
    header: headers,
    url: urlObj
  };
  
  // Add description
  if (description) {
    request.description = description;
  }
  
  // Add body for non-GET requests
  if (method !== 'GET' && body.trim()) {
    headers.push({
      key: 'Content-Type',
      value: 'application/json',
      type: 'text'
    });
    
    request.body = {
      mode: 'raw',
      raw: body.trim(),
      options: {
        raw: {
          language: 'json'
        }
      }
    };
  }
  
  return {
    name: requestName,
    request
  };
}

function generatePostmanCollection(): PostmanCollection {
  // Read the API documentation
  const docsPath = path.join(__dirname, '..', 'API_REQUEST_BODIES.md');
  const markdown = fs.readFileSync(docsPath, 'utf-8');
  
  // Parse endpoints
  const folders = parseMarkdownEndpoints(markdown);
  
  // Create collection
  const collection: PostmanCollection = {
    info: {
      name: 'Beyond Trips API (From Docs)',
      description: 'Auto-generated from API_REQUEST_BODIES.md - Complete API collection with all documented endpoints',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000',
        type: 'string'
      },
      {
        key: 'bearerToken',
        value: 'your-jwt-token-here',
        type: 'string'
      }
    ],
    item: folders
  };
  
  return collection;
}

// Generate and save collection
console.log('📖 Reading API_REQUEST_BODIES.md...');
const collection = generatePostmanCollection();

console.log(`✅ Parsed ${collection.item.length} folders`);
collection.item.forEach(folder => {
  console.log(`   📁 ${folder.name}: ${folder.item.length} endpoints`);
});

const outputPath = path.join(__dirname, '..', 'postman-collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));

console.log(`\n✅ Postman collection generated: ${outputPath}`);
console.log(`\n📊 Total endpoints: ${collection.item.reduce((sum, folder) => sum + folder.item.length, 0)}`);
console.log('\n🚀 Import into Postman:');
console.log('   1. Open Postman');
console.log('   2. Click "Import"');
console.log('   3. Select postman-collection.json');
console.log('   4. Set environment variables: baseUrl and bearerToken');

