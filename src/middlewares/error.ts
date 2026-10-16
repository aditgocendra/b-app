import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from '../utils/logger'

export const globalErrorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  logger.error(err, 'Global Error Handler Caught Exception')
  
  return c.json({
    success: false,
    message: err.message || 'Internal Server Error',
  }, 500)
}
