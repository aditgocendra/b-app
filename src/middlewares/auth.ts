import type { MiddlewareHandler } from 'hono'
import { logger } from '../utils/logger'

// Example RBAC middleware
export const checkRole = (requiredRole: string): MiddlewareHandler => {
  return async (c, next) => {
    // In a real application, you would extract the user's role from a JWT token here.
    // const user = c.get('user')
    // if (user.role !== requiredRole) { ... }
    
    // For now, we'll just log and continue
    logger.debug(`Checking if user has role: ${requiredRole}`)
    
    // Stub implementation - assuming authorization passed
    await next()
  }
}

// Note: Hono's built-in basicAuth is used directly in the routes for documentation.
