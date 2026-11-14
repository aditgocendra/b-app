import type { MiddlewareHandler } from 'hono'
import { verify } from 'hono/jwt'
import { logger } from '../utils/logger'

export interface JwtUserPayload {
  sub: string
  email: string
  username: string
  role: string
  exp: number
}

// Declare Hono context type for user
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtUserPayload
  }
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-32-chars-min'

/**
 * Middleware to validate JWT Access Token from Authorization Header: Bearer <token>
 * Instant CPU memory validation without database query.
 */
export const verifyJwt: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        message: 'Access denied: Access token is required',
      },
      401
    )
  }

  const token = authHeader.substring(7)

  try {
    const payload = (await verify(token, ACCESS_SECRET, 'HS256')) as unknown as JwtUserPayload
    c.set('user', payload)
    await next()
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to verify JWT token')
    return c.json(
      {
        success: false,
        message: 'Unauthorized: Invalid or expired token',
      },
      401
    )
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks if the user role has sufficient permission
 */
export const requireRole = (...allowedRoles: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: User not authenticated',
        },
        401
      )
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn(
        { userId: user.sub, role: user.role, requiredRoles: allowedRoles },
        'Access denied due to insufficient permissions'
      )
      return c.json(
        {
          success: false,
          message: 'Forbidden: You do not have permission to access this resource',
        },
        403
      )
    }

    await next()
  }
}

// Alias for backward compatibility
export const checkRole = (requiredRole: string): MiddlewareHandler => {
  return requireRole(requiredRole)
}
