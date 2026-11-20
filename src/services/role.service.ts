import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '../db/prisma'
import { logger } from '../utils/logger'
import type { CreateRoleInput, UpdateRoleInput } from '../validations/role.schema'

export class RoleService {
  private db: PrismaClient

  constructor(dbClient: PrismaClient = defaultPrisma) {
    this.db = dbClient
  }

  /**
   * Get all roles with user count and granted permission codes
   */
  async getAllRoles() {
    const roles = await this.db.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      status: role.status,
      usersCount: role._count.users,
      permissionCodes: role.permissions
        .map((p) => p.permission?.code)
        .filter((code): code is string => Boolean(code)),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }))
  }

  /**
   * Get role details by ID including full permissions
   */
  async getRoleById(id: string) {
    const role = await this.db.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!role) {
      throw new Error('Role not found')
    }

    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      status: role.status,
      usersCount: role._count.users,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
      permissionCodes: role.permissions.map((rp) => rp.permission.code),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }
  }

  /**
   * Create a new custom role
   */
  async createRole(data: CreateRoleInput) {
    const key = (data.key || data.name.toLowerCase().trim().replace(/[\s\W-]+/g, '_').replace(/^_+|_+$/g, '')).toLowerCase()

    const existing = await this.db.role.findUnique({
      where: { key },
    })

    if (existing) {
      throw new Error(`Role with key '${key}' already exists`)
    }

    const newRole = await this.db.role.create({
      data: {
        name: data.name.trim(),
        key,
        description: data.description?.trim() || null,
        status: data.status || 'ACTIVE',
        isSystem: false,
      },
    })

    // Assign permissions if provided
    if (data.permissionCodes && data.permissionCodes.length > 0) {
      await this.setRolePermissions(newRole.id, data.permissionCodes)
    }

    logger.info({ roleId: newRole.id, key: newRole.key }, 'Custom role created successfully')
    return this.getRoleById(newRole.id)
  }

  /**
   * Update custom role details
   */
  async updateRole(id: string, data: UpdateRoleInput) {
    const role = await this.db.role.findUnique({
      where: { id },
    })

    if (!role) {
      throw new Error('Role not found')
    }

    const updated = await this.db.role.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        status: data.status,
      },
    })

    logger.info({ roleId: updated.id }, 'Role details updated successfully')
    return this.getRoleById(updated.id)
  }

  /**
   * Delete custom role (cannot delete system roles or roles with assigned users)
   */
  async deleteRole(id: string) {
    const role = await this.db.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    })

    if (!role) {
      throw new Error('Role not found')
    }

    if (role.isSystem) {
      throw new Error('System roles cannot be deleted to prevent application failure')
    }

    if (role._count.users > 0) {
      throw new Error(`Cannot delete role: ${role._count.users} user(s) are currently assigned to this role`)
    }

    await this.db.role.delete({
      where: { id },
    })

    logger.info({ roleId: id, key: role.key }, 'Role deleted successfully')
    return { success: true, message: `Role '${role.name}' deleted successfully` }
  }

  /**
   * Get all master permissions catalog grouped by module
   */
  async getAllPermissions() {
    const permissions = await this.db.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    })

    return permissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      module: p.module,
      action: p.action,
      description: p.description,
    }))
  }

  /**
   * Set or update permissions for a role
   */
  async setRolePermissions(roleId: string, permissionCodes: string[]) {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
    })

    if (!role) {
      throw new Error('Role not found')
    }

    // Find all valid permissions matching requested codes
    const validPermissions = await this.db.permission.findMany({
      where: {
        code: { in: permissionCodes },
      },
    })

    // Transaction: delete old assignments and insert new ones
    await this.db.$transaction([
      this.db.rolePermission.deleteMany({
        where: { roleId },
      }),
      this.db.rolePermission.createMany({
        data: validPermissions.map((p) => ({
          roleId,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      }),
    ])

    logger.info({ roleId, permissionCount: validPermissions.length }, 'Role permissions updated successfully')
    return this.getRoleById(roleId)
  }
}

export const roleService = new RoleService()
