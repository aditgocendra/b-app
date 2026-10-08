import { OpenAPIHono } from '@hono/zod-openapi'
import { basicAuth } from 'hono/basic-auth'
import { apiReference } from '@scalar/hono-api-reference'
import { requestLogger } from './middlewares/logger'
import { globalErrorHandler } from './middlewares/error'
import { logger } from './utils/logger'

// Initialize OpenAPIHono
const app = new OpenAPIHono()

// Apply Global Middlewares
app.use('*', requestLogger)
app.onError(globalErrorHandler)

// --- AREA TERLINDUNGI UNTUK DOKUMENTASI ---
// Terapkan Basic Auth HANYA untuk path /docs dan /openapi.json
const docsAuth = basicAuth({
  username: process.env.DOCS_USERNAME || 'developer',
  password: process.env.DOCS_PASSWORD || 'rahasia-tim-dev',
})

app.use('/docs/*', docsAuth)
app.use('/openapi.json', docsAuth)

// 1. Generate OpenAPI Spec (Sekarang dilindungi basicAuth)
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { 
    title: 'POS API Backend', 
    version: '1.0.0',
    description: 'API Documentation for POS Application'
  },
})

// 2. Render Scalar UI (Sekarang dilindungi basicAuth)
app.get('/docs', apiReference({
  spec: { url: '/openapi.json' },
}))

// --- ROUTES AREA ---
import { productRouter } from './routes/product.route'

const v1App = new OpenAPIHono()
v1App.route('/products', productRouter)

app.route('/api/v1', v1App)

app.get('/', (c) => {
  return c.text('Welcome to POS API Backend!')
})

// Start the Bun server
const port = process.env.PORT || 3000
logger.info(`Server is running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
