import type { ErrorHandler } from 'hono'
import { logger } from '../utils/logger'

export const globalErrorHandler: ErrorHandler = (err, c) => {
  logger.error(err, 'Global Error Handler Caught Exception')
  
  return c.json({
    success: false,
    message: err.message || 'Internal Server Error',
  }, 500)
}
