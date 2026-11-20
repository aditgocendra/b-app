import type { MiddlewareHandler } from 'hono'
import { verify } from 'hono/jwt'
import { logger } from '../utils/logger'
import { prisma } from '../db/prisma'

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
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Token verification failed'
    logger.warn({ error: errMsg }, 'Failed to verify JWT token')
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
 * Checks if the user role matches allowed roles (legacy support)
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

    const normalizedUserRole = user.role.toUpperCase()
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase())

    if (!normalizedAllowed.includes(normalizedUserRole)) {
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

/**
 * Granular Dynamic Permission Middleware
 * Checks if user's role has the required permission code (e.g. 'product.create', 'merk.create')
 * Automatically grants access to 'super_admin' / 'SUPER_ADMIN'.
 */
export const requirePermission = (permissionCode: string): MiddlewareHandler => {
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

    const roleKey = user.role?.toLowerCase()

    // Super Admin has unrestricted access to all endpoints
    if (roleKey === 'super_admin') {
      return await next()
    }

    // Check user's role permissions in database
    const hasPermission = await prisma.rolePermission.findFirst({
      where: {
        role: {
          key: roleKey,
        },
        permission: {
          code: permissionCode,
        },
      },
    })

    if (!hasPermission) {
      logger.warn(
        { userId: user.sub, role: user.role, requiredPermission: permissionCode },
        'Access denied due to missing permission'
      )
      return c.json(
        {
          success: false,
          message: `Forbidden: Missing required permission '${permissionCode}'`,
        },
        403
      )
    }

    await next()
  }
}
