import { OpenAPIHono } from '@hono/zod-openapi'
import { basicAuth } from 'hono/basic-auth'
import { apiReference } from '@scalar/hono-api-reference'
import { productRouter } from '../product.route'
import { authRouter } from './auth.route'

export const v1App = new OpenAPIHono()

// --- AREA TERLINDUNGI UNTUK DOKUMENTASI API v1 ---
// Terapkan Basic Auth HANYA untuk path /docs dan /openapi.json
const docsAuth = basicAuth({
  username: process.env.DOCS_USERNAME || 'developer',
  password: process.env.DOCS_PASSWORD || 'rahasia-tim-dev',
})

v1App.use('/docs/*', docsAuth)
v1App.use('/openapi.json', docsAuth)

// 1. Generate OpenAPI Spec untuk API v1
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
