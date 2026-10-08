import type { MiddlewareHandler } from 'hono'
import { logger } from '../utils/logger'

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  await next()
  const end = performance.now()

  logger.info({
    method: c.req.method,
    url: c.req.url,
    status: c.res.status,
    duration: `${(end - start).toFixed(2)}ms`,
  }, 'HTTP Request')
}
