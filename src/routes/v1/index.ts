import { OpenAPIHono } from '@hono/zod-openapi'
import { basicAuth } from 'hono/basic-auth'
import { apiReference } from '@scalar/hono-api-reference'
import { productRouter } from '../product.route'
import { authRouter } from './auth.route'

export const v1App = new OpenAPIHono()

// --- PROTECTED AREA FOR API v1 DOCUMENTATION ---
// Apply Basic Auth ONLY to /docs and /openapi.json paths
const docsAuth = basicAuth({
  username: process.env.DOCS_USERNAME || 'developer',
  password: process.env.DOCS_PASSWORD || 'dev-team-secret',
})

v1App.use('/docs/*', docsAuth)
v1App.use('/openapi.json', docsAuth)

// 1. Generate OpenAPI Spec for API v1
v1App.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { 
    title: 'POS API Backend', 
    version: '1.0.0',
    description: 'API Documentation for POS Application (Version 1)'
  },
})

// 2. Render Scalar UI
v1App.get('/docs', apiReference({
  spec: { url: '/api/v1/openapi.json' },
}))

// --- MOUNT ROUTES v1 ---
v1App.route('/auth', authRouter)
v1App.route('/products', productRouter)
