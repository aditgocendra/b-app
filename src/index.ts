import { Hono } from 'hono'
import { requestLogger } from './middlewares/logger'
import { globalErrorHandler } from './middlewares/error'
import { logger } from './utils/logger'
import { v1App } from './routes/v1'

const app = new Hono()

// Apply Global Middlewares
app.use('*', requestLogger)
app.onError(globalErrorHandler)

// --- ROUTES AREA ---
// Mount V1 API
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
