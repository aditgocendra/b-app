import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '../db/prisma'
import { logger } from '../utils/logger'
import type {
  UserQueryInput,
  CreateUserInput,
  UpdateUserInput,
} from '../validations/user.schema'
import type { FormattedUserResponse } from './auth.service'

export class UserService {
  private db: PrismaClient

  constructor(dbClient: PrismaClient = defaultPrisma) {
    this.db = dbClient
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
   * Get paginated and filtered list of users
   */
  async getUsers(query: UserQueryInput = {}) {
    const page = Number(query.page) > 0 ? Number(query.page) : 1
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 10
    const skip = (page - 1) * limit

    const where: Prisma.UserWhereInput = {}

    // Search filter
    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim()
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phoneNumber: { contains: term, mode: 'insensitive' } },
      ]
    }

    // Role filter
    if (query.role && query.role !== 'all') {
      const roleTerm = query.role.trim()
      where.role = {
        OR: [
          { id: roleTerm },
          { key: { equals: roleTerm.toLowerCase(), mode: 'insensitive' } },
          { name: { equals: roleTerm, mode: 'insensitive' } },
        ],
      }
    }

    // Status filter
    if (query.status) {
      where.status = query.status
    }

    // Sorting
    let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: query.sortOrder || 'desc' }
    if (query.sortBy === 'name' || query.sortBy === 'fullName') {
      orderBy = { fullName: query.sortOrder || 'asc' }
    } else if (query.sortBy === 'email') {
      orderBy = { email: query.sortOrder || 'asc' }
    } else if (query.sortBy === 'status') {
      orderBy = { status: query.sortOrder || 'asc' }
    }

    const [total, users] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
    ])

    const totalPages = Math.ceil(total / limit) || 1

    return {
      items: users.map((u) => this.formatUser(u)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    }
  }

  /**
   * Get single user by ID
   */
  async getUserById(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
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
   * Create a new user account
   */
  async createUser(data: CreateUserInput) {
    const email = data.email.trim().toLowerCase()
    const username = (data.username?.trim() || (email.split('@')[0] ?? 'user').replace(/[^a-zA-Z0-9_]/g, '_')).toLowerCase()

    // 1. Check uniqueness
    const existing = await this.db.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    })

    if (existing) {
      if (existing.email === email) {
        throw new Error('Email is already registered')
      }
      throw new Error('Username is already taken')
    }

    // 2. Resolve Role
    let roleId = data.roleId
    if (!roleId && data.role) {
      const roleRecord = await this.db.role.findFirst({
        where: {
          OR: [
            { key: data.role.toLowerCase().trim() },
            { name: { equals: data.role.trim(), mode: 'insensitive' } },
            { id: data.role.trim() },
          ],
        },
      })
      if (roleRecord) {
        roleId = roleRecord.id
      }
    }

    if (!roleId) {
      // Default to cashier role
      const defaultRole = await this.db.role.findFirst({
        where: { key: 'cashier' },
      })
      roleId = defaultRole?.id
    }

    if (!roleId) {
      throw new Error('Specified role does not exist')
    }

    // 3. Forbid creating second Super Admin
    const targetRole = await this.db.role.findUnique({ where: { id: roleId } })
    if (targetRole && (targetRole.key === 'super_admin' || targetRole.key === 'SUPER_ADMIN')) {
      const existingSuperAdmin = await this.db.user.findFirst({
        where: {
          role: {
            key: { in: ['super_admin', 'SUPER_ADMIN'] },
          },
        },
      })
      if (existingSuperAdmin) {
        throw new Error('Super Admin already exists. Only one Super Admin account is permitted.')
      }
    }

    const hashedPassword = await Bun.password.hash(data.password)

    const newUser = await this.db.user.create({
      data: {
        email,
        username,
        fullName: data.fullName?.trim() || null,
        password: hashedPassword,
        phoneNumber: data.phoneNumber?.trim() || null,
        roleId,
        status: data.status || 'ACTIVE',
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

    logger.info({ userId: newUser.id, email: newUser.email }, 'User created successfully via User Management')
    return this.formatUser(newUser)
  }

  /**
   * Update existing user details
   */
  async updateUser(id: string, data: UpdateUserInput, currentUserId?: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      include: { role: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Uniqueness validation if email / username changed
    if (data.email || data.username) {
      const conditions: Prisma.UserWhereInput[] = []
      if (data.email) conditions.push({ email: data.email.trim().toLowerCase() })
      if (data.username) conditions.push({ username: data.username.trim().toLowerCase() })

      const conflict = await this.db.user.findFirst({
        where: {
          id: { not: id },
          OR: conditions,
        },
      })

      if (conflict) {
        if (data.email && conflict.email === data.email.trim().toLowerCase()) {
          throw new Error('Email is already registered by another account')
        }
        throw new Error('Username is already taken by another account')
      }
    }

    // Role resolution if requested
    let targetRoleId = data.roleId
    if (!targetRoleId && data.role) {
      const roleRecord = await this.db.role.findFirst({
        where: {
          OR: [
            { key: data.role.toLowerCase().trim() },
            { name: { equals: data.role.trim(), mode: 'insensitive' } },
            { id: data.role.trim() },
          ],
        },
      })
      if (roleRecord) {
        targetRoleId = roleRecord.id
      }
    }

    // Guard: Prevent demoting the only Super Admin
    if (targetRoleId && targetRoleId !== user.roleId && user.role.key === 'super_admin') {
      const superAdminCount = await this.db.user.count({
        where: { role: { key: 'super_admin' } },
      })
      if (superAdminCount <= 1) {
        throw new Error('Cannot change role of the primary Super Admin')
      }
    }

    const updatedUser = await this.db.user.update({
      where: { id },
      data: {
        fullName: data.fullName !== undefined ? data.fullName.trim() : undefined,
        email: data.email ? data.email.trim().toLowerCase() : undefined,
        username: data.username ? data.username.trim().toLowerCase() : undefined,
        phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber.trim() : undefined,
        roleId: targetRoleId,
        status: data.status,
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

    logger.info({ userId: updatedUser.id }, 'User updated successfully')
    return this.formatUser(updatedUser)
  }

  /**
   * Quick status toggle (ACTIVE / INACTIVE / SUSPENDED)
   */
  async updateUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED', currentUserId?: string) {
    if (currentUserId && id === currentUserId) {
      throw new Error('You cannot deactivate your own account')
    }

    const user = await this.db.user.findUnique({
      where: { id },
      include: { role: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    if (user.role.key === 'super_admin' && status !== 'ACTIVE') {
      const superAdminCount = await this.db.user.count({
        where: { role: { key: 'super_admin' }, status: 'ACTIVE' },
      })
      if (superAdminCount <= 1) {
        throw new Error('Cannot deactivate the only active Super Admin account')
      }
    }

    const updated = await this.db.user.update({
      where: { id },
      data: { status },
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

    // If deactivated or suspended, revoke active refresh token sessions
    if (status !== 'ACTIVE') {
      await this.db.refreshToken.deleteMany({
        where: { userId: id },
      })
    }

    logger.info({ userId: id, status }, 'User status updated')
    return this.formatUser(updated)
  }

  /**
   * Reset user password by administrator
   */
  async resetPassword(id: string, newPassword: string) {
    const user = await this.db.user.findUnique({
      where: { id },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const hashedPassword = await Bun.password.hash(newPassword)

    await this.db.$transaction([
      this.db.user.update({
        where: { id },
        data: { password: hashedPassword },
      }),
      this.db.refreshToken.deleteMany({
        where: { userId: id },
      }),
    ])

    logger.info({ userId: id }, 'Password reset by admin; active sessions revoked')
    return { success: true, message: 'Password reset successfully' }
  }

  /**
   * Delete single user
   */
  async deleteUser(id: string, currentUserId?: string) {
    if (currentUserId && id === currentUserId) {
      throw new Error('You cannot delete your own account')
    }

    const user = await this.db.user.findUnique({
      where: { id },
      include: { role: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    if (user.role.key === 'super_admin') {
      const superAdminCount = await this.db.user.count({
        where: { role: { key: 'super_admin' } },
      })
      if (superAdminCount <= 1) {
        throw new Error('Cannot delete the primary Super Admin account')
      }
    }

    await this.db.user.delete({
      where: { id },
    })

    logger.info({ userId: id, username: user.username }, 'User deleted successfully')
    return { success: true, message: `User '${user.fullName || user.username}' deleted successfully` }
  }

  /**
   * Bulk delete multiple users
   */
  async bulkDeleteUsers(ids: string[], currentUserId?: string) {
    const safeIds = ids.filter((id) => id !== currentUserId)

    // Forbid deleting super_admin users in bulk
    const usersToDelete = await this.db.user.findMany({
      where: {
        id: { in: safeIds },
        role: {
          key: { not: 'super_admin' },
        },
      },
      select: { id: true },
    })

    const targetIds = usersToDelete.map((u) => u.id)

    if (targetIds.length === 0) {
      return { success: true, deletedCount: 0, message: 'No eligible users to delete' }
    }

    const result = await this.db.user.deleteMany({
      where: {
        id: { in: targetIds },
      },
    })

    logger.info({ count: result.count }, 'Bulk delete users executed')
    return {
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} user(s)`,
    }
  }
}

export const userService = new UserService()
