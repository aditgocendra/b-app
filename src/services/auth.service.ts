import { sign, verify } from 'hono/jwt'
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '../db/prisma'
import { logger } from '../utils/logger'
import type {
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
} from '../validations/auth.schema'

export interface TokenPayload {
  [key: string]: unknown
  sub: string
  email: string
  username: string
  fullName?: string | null
  role: string
  exp: number
}

export interface FormattedUserResponse {
  id: string
  email: string
  username: string
  fullName: string | null
  phoneNumber: string | null
  roleId: string
  role: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  permissions: string[]
  roleDetails?: {
    id: string
    key: string
    name: string
    description: string | null
    isSystem: boolean
    status: 'ACTIVE' | 'INACTIVE'
  }
  createdAt: Date | string
  updatedAt: Date | string
}

export class AuthService {
  private db: PrismaClient
  private accessSecret: string
  private refreshSecret: string
  private accessTokenExpiresIn: number // 15 minutes in seconds
  private refreshTokenExpiresIn: number // 7 days in seconds

  constructor(
    dbClient: PrismaClient = defaultPrisma,
    accessSecret: string = process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-32-chars-min',
    refreshSecret: string = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-32-chars-min'
  ) {
    this.db = dbClient
    this.accessSecret = accessSecret
    this.refreshSecret = refreshSecret
    this.accessTokenExpiresIn = 15 * 60 // 15 minutes
    this.refreshTokenExpiresIn = 7 * 24 * 60 * 60 // 7 days
  }

  private formatUser(user: {
    id: string
    email: string
    username: string
    fullName: string | null
    phoneNumber: string | null
    roleId: string
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
    createdAt: Date
    updatedAt: Date
    role?: {
      id: string
      key: string
      name: string
      description: string | null
      isSystem: boolean
      status: 'ACTIVE' | 'INACTIVE'
      permissions?: Array<{
        permission?: {
          code: string
        } | null
      }>
    } | null
  }): FormattedUserResponse {
    const permissions: string[] = user.role?.permissions
      ? user.role.permissions
          .map((rp) => rp.permission?.code)
          .filter((code): code is string => Boolean(code))
      : []

    const roleKey = user.role?.key?.toUpperCase() || 'CASHIER'

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName || null,
      phoneNumber: user.phoneNumber || null,
      roleId: user.roleId,
      role: roleKey,
      status: user.status,
      permissions,
      roleDetails: user.role
        ? {
            id: user.role.id,
            key: user.role.key,
            name: user.role.name,
            description: user.role.description,
            isSystem: user.role.isSystem,
            status: user.role.status,
          }
        : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  /**
   * Helper: Generate Access Token (15 Minutes)
   */
  async generateAccessToken(user: { id: string; email: string; username: string; role?: string; fullName?: string | null }): Promise<string> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName || null,
      role: user.role || 'CASHIER',
      exp: Math.floor(Date.now() / 1000) + this.accessTokenExpiresIn,
    }
    return sign(payload, this.accessSecret, 'HS256')
  }

  /**
   * Helper: Generate Refresh Token (7 Days)
   */
  async generateRefreshToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      jti: crypto.randomUUID(),
      exp: Math.floor(Date.now() / 1000) + this.refreshTokenExpiresIn,
    }
    return sign(payload, this.refreshSecret, 'HS256')
  }

  /**
   * Check System Startup Status
   */
  async getStartupStatus() {
    const userCount = await this.db.user.count()
    const superAdminRole = await this.db.role.findFirst({
      where: {
        OR: [
          { key: 'super_admin' },
          { key: 'SUPER_ADMIN' },
        ],
      },
    })

    const superAdminCount = superAdminRole
      ? await this.db.user.count({
          where: { roleId: superAdminRole.id },
        })
      : 0

    return {
      isSetupRequired: userCount === 0,
      hasSuperAdmin: superAdminCount > 0,
      userCount,
    }
  }

  /**
   * Register New User
   */
  async register(data: RegisterInput) {
    logger.info({ email: data.email, username: data.username, role: data.role }, 'Attempting to register new user')

    const rawRole = (data.role || 'cashier').trim()
    const lowerRole = rawRole.toLowerCase()
    const isSuperAdminRegister = lowerRole === 'super_admin' || rawRole === 'SUPER_ADMIN'

    // 1. Check for single Super Admin constraint
    if (isSuperAdminRegister) {
      const existingSuperAdmin = await this.db.user.findFirst({
        where: {
          role: {
            key: { in: ['super_admin', 'SUPER_ADMIN'] },
          },
        },
      })

      if (existingSuperAdmin) {
        throw new Error('Super Admin already exists. Only one Super Admin is allowed and startup has already been completed.')
      }
    }

    // 2. Check for unique email & username
    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    })

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new Error('Email is already registered')
      }
      throw new Error('Username is already taken')
    }

    // 3. Find or ensure Role exists in database
    let targetRole = await this.db.role.findFirst({
      where: {
        OR: [
          { key: lowerRole },
          { key: rawRole },
          { id: rawRole },
        ],
      },
    })

    if (!targetRole) {
      if (isSuperAdminRegister) {
        targetRole = await this.db.role.create({
          data: {
            key: 'super_admin',
            name: 'Super Admin',
            isSystem: true,
            status: 'ACTIVE',
          },
        })
      } else {
        // Fallback to cashier role
        targetRole = await this.db.role.findFirst({
          where: { key: 'cashier' },
        })

        if (!targetRole) {
          targetRole = await this.db.role.create({
            data: {
              key: 'cashier',
              name: 'Cashier',
              isSystem: true,
              status: 'ACTIVE',
            },
          })
        }
      }
    }

    const hashedPassword = await Bun.password.hash(data.password)

    const newUser = await this.db.user.create({
      data: {
        email: data.email,
        username: data.username,
        fullName: data.fullName || null,
        password: hashedPassword,
        phoneNumber: data.phoneNumber,
        roleId: targetRole.id,
        status: 'ACTIVE',
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    })

    logger.info({ userId: newUser.id }, 'User successfully registered')

    return this.formatUser(newUser)
  }

  /**
   * User Login
   */
  async login(data: LoginInput) {
    logger.info({ email: data.email }, 'Processing user login')

    const user = await this.db.user.findUnique({
      where: { email: data.email },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      throw new Error('Invalid email or password')
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Account is inactive or suspended')
    }

    const isPasswordValid = await Bun.password.verify(data.password, user.password)
    if (!isPasswordValid) {
      throw new Error('Invalid email or password')
    }

    const formattedUser = this.formatUser(user)

    // Generate tokens
    const accessToken = await this.generateAccessToken(formattedUser)
    const refreshToken = await this.generateRefreshToken(user.id)

    // Save Refresh Token to database
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiresIn * 1000)
    await this.db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    })

    logger.info({ userId: user.id }, 'User logged in successfully and session created')

    return {
      accessToken,
      refreshToken,
      user: formattedUser,
    }
  }

  /**
   * Refresh Token (Token Rotation)
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new Error('Refresh token not found')
    }

    // 1. Verify JWT refresh token signature
    let payload: { sub: string }
    try {
      payload = (await verify(refreshToken, this.refreshSecret, 'HS256')) as { sub: string }
    } catch {
      throw new Error('Refresh token is invalid or has expired')
    }

    // 2. Find token in database
    const storedToken = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!storedToken) {
      throw new Error('Session not found or has been revoked')
    }

    if (storedToken.expiresAt < new Date()) {
      await this.db.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => { })
      throw new Error('Refresh token has expired')
    }

    if (storedToken.user.status !== 'ACTIVE') {
      throw new Error('User account is not active')
    }

    const formattedUser = this.formatUser(storedToken.user)

    // 3. Token Rotation: Delete old token and issue new token
    const newAccessToken = await this.generateAccessToken(formattedUser)
    const newRefreshToken = await this.generateRefreshToken(storedToken.user.id)
    const newExpiresAt = new Date(Date.now() + this.refreshTokenExpiresIn * 1000)

    await this.db.$transaction([
      this.db.refreshToken.delete({ where: { id: storedToken.id } }),
      this.db.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.user.id,
          expiresAt: newExpiresAt,
        },
      }),
    ])

    logger.info({ userId: storedToken.user.id }, 'Token successfully rotated')

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  }

  /**
   * Get Current Authenticated User Profile
   */
  async getMe(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return this.formatUser(user)
  }

  /**
   * User Logout (Session Revocation)
   */
  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return { success: true }
    }

    await this.db.refreshToken.deleteMany({
      where: { token: refreshToken },
    })

    logger.info('Refresh token session successfully revoked')
    return { success: true }
  }

  /**
   * Forgot Password (Generate reset token)
   */
  async forgotPassword(email: string) {
    logger.info({ email }, 'Forgot password request received')

    const user = await this.db.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Security: prevent user enumeration
      return {
        success: true,
        message: 'If the email is registered, a password reset link has been sent',
      }
    }

    const resetToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 Hour

    // Remove previous reset tokens if any, create new one
    await this.db.$transaction([
      this.db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.db.passwordResetToken.create({
        data: {
          token: resetToken,
          userId: user.id,
          expiresAt,
        },
      }),
    ])

    const resetLink = `/reset-password?token=${resetToken}`
    logger.info({ email, resetLink }, 'Simulated sending password reset link')

    return {
      success: true,
      message: 'Password reset link has been sent',
      resetToken, // Useful for testing and simulation
      resetLink,
    }
  }

  /**
   * Verify Password Reset Token
   */
  async verifyResetToken(token: string) {
    const resetRecord = await this.db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new Error('Password reset token is invalid or has expired')
    }

    return {
      valid: true,
      email: resetRecord.user.email,
    }
  }

  /**
   * Reset User Password
   */
  async resetPassword(data: ResetPasswordInput) {
    const resetRecord = await this.db.passwordResetToken.findUnique({
      where: { token: data.token },
    })

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new Error('Password reset token is invalid or has expired')
    }

    const hashedPassword = await Bun.password.hash(data.password)

    // Update password, delete reset token, and revoke all active refresh tokens
    await this.db.$transaction([
      this.db.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      }),
      this.db.passwordResetToken.delete({
        where: { id: resetRecord.id },
      }),
      this.db.refreshToken.deleteMany({
        where: { userId: resetRecord.userId },
      }),
    ])

    logger.info({ userId: resetRecord.userId }, 'Password reset successfully')
    return { success: true }
  }
}

export const authService = new AuthService()
