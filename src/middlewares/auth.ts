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

// Deklarasi type context Hono untuk user
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtUserPayload
  }
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-32-chars-min'

/**
 * Middleware untuk memvalidasi JWT Access Token dari Header Authorization: Bearer <token>
 * Pengecekan instan di memori CPU tanpa query database.
 */
export const verifyJwt: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        message: 'Akses ditolak: Access token diperlukan',
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
    logger.warn({ error: err.message }, 'Gagal memverifikasi JWT token')
    return c.json(
      {
        success: false,
        message: 'Unauthorized: Token tidak valid atau telah kedaluwarsa',
      },
      401
    )
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * Memeriksa apakah role pengguna memiliki izin
 */
export const requireRole = (...allowedRoles: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: User tidak terotentikasi',
        },
        401
      )
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn(
        { userId: user.sub, role: user.role, requiredRoles: allowedRoles },
        'Akses ditolak karena peran tidak memadai'
      )
      return c.json(
        {
          success: false,
          message: 'Forbidden: Anda tidak memiliki izin untuk mengakses resource ini',
        },
        403
      )
    }

    await next()
  }
}

// Alias untuk kompatibilitas
export const checkRole = (requiredRole: string): MiddlewareHandler => {
  return requireRole(requiredRole)
}
