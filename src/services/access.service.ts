import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '../db/prisma'
import { logger } from '../utils/logger'
import type { ModulePermissionGroup, PermissionItem, RoleAccessDetail } from '../validations/access.schema'

export const MODULE_METADATA: Record<string, { name: string; description: string }> = {
  overview: {
    name: 'Dashboard & Overview',
    description: 'High-level omnichannel sales metrics, channel volume charts, and recent transaction invoices.',
  },
  product: {
    name: 'Product Catalog',
    description: 'Manage products, variant SKU attributes, brands (merk), and category taxonomy.',
  },
  inventory: {
    name: 'Inventory & Warehouses',
    description: 'Multi-warehouse stock allocations, inter-facility transfers, and stock opname auditing.',
  },
  pos: {
    name: 'Point Of Sale (POS)',
    description: 'Retail store checkout register, transaction history, receipts, and cashier formatting.',
  },
  user: {
    name: 'User & Security Governance',
    description: 'System employee accounts, role definitions, and access control governance.',
  },
}

export class AccessService {
  private db: PrismaClient

  constructor(dbClient: PrismaClient = defaultPrisma) {
    this.db = dbClient
  }

  /**
   * Retrieve all permissions grouped by functional module
   */
  async getPermissionGroups(): Promise<ModulePermissionGroup[]> {
    const permissions = await this.db.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    })

    const moduleMap = new Map<string, PermissionItem[]>()

    for (const p of permissions) {
      const item: PermissionItem = {
        id: p.code, // use readable code as id for frontend matrix
        code: p.code,
        name: p.name,
        module: p.module,
        action: p.action,
        description: p.description,
      }

      if (!moduleMap.has(p.module)) {
        moduleMap.set(p.module, [])
      }
      moduleMap.get(p.module)!.push(item)
    }

    const groups: ModulePermissionGroup[] = []

    for (const [moduleKey, items] of moduleMap.entries()) {
      const meta = MODULE_METADATA[moduleKey] || {
        name: moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1),
        description: `Permissions for ${moduleKey} operations.`,
      }

      groups.push({
        id: moduleKey,
        name: meta.name,
        description: meta.description,
        permissions: items,
      })
    }

    return groups
  }

  /**
   * Retrieve the complete access matrix: modules, roles, and current assignments
   */
  async getAccessMatrix() {
    const modules = await this.getPermissionGroups()
    const allPermissions = await this.db.permission.findMany({
      select: { code: true },
      orderBy: { code: 'asc' },
    })
    const allPermissionCodes = allPermissions.map((p) => p.code)

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

    const roleDetails: RoleAccessDetail[] = roles.map((role) => {
      const isSuperAdmin = role.key === 'super_admin'
      const permissionCodes = isSuperAdmin
        ? allPermissionCodes
        : role.permissions
            .map((rp) => rp.permission?.code)
            .filter((c): c is string => Boolean(c))

      return {
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        status: role.status,
        usersCount: role._count.users,
        permissionCodes,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      }
    })

    return {
      modules,
      roles: roleDetails,
      allPermissionCodes,
    }
  }

  /**
   * Find role by either UUID id or key
   */
  private async findRoleByIdentifier(identifier: string) {
    return this.db.role.findFirst({
      where: {
        OR: [{ id: identifier }, { key: identifier }],
      },
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
  }

  /**
   * Retrieve access details for a specific role
   */
  async getRoleAccess(roleIdentifier: string): Promise<RoleAccessDetail> {
    const role = await this.findRoleByIdentifier(roleIdentifier)

    if (!role) {
      throw new Error(`Role '${roleIdentifier}' not found`)
    }

    const isSuperAdmin = role.key === 'super_admin'
    let permissionCodes: string[] = []

    if (isSuperAdmin) {
      const all = await this.db.permission.findMany({ select: { code: true } })
      permissionCodes = all.map((p) => p.code)
    } else {
      permissionCodes = role.permissions
        .map((rp) => rp.permission?.code)
        .filter((c): c is string => Boolean(c))
    }

    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      status: role.status,
      usersCount: role._count.users,
      permissionCodes,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }
  }

  /**
   * Replace granted permissions for a role
   */
  async updateRolePermissions(roleIdentifier: string, permissionCodes: string[]): Promise<RoleAccessDetail> {
    const role = await this.findRoleByIdentifier(roleIdentifier)

    if (!role) {
      throw new Error(`Role '${roleIdentifier}' not found`)
    }

    if (role.key === 'super_admin') {
      throw new Error('Super Admin permissions cannot be modified: Super Admin always retains full unrestricted system privileges')
    }

    // Resolve valid permissions from database
    const validPermissions = await this.db.permission.findMany({
      where: {
        code: { in: permissionCodes },
      },
    })

    // Update in atomic transaction
    await this.db.$transaction([
      this.db.rolePermission.deleteMany({
        where: { roleId: role.id },
      }),
      this.db.rolePermission.createMany({
        data: validPermissions.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      }),
    ])

    logger.info(
      { roleId: role.id, roleKey: role.key, grantedCount: validPermissions.length },
      'Role permissions updated successfully'
    )

    return this.getRoleAccess(role.id)
  }

  /**
   * Reset role permissions back to default configuration
   */
  async resetRolePermissions(roleIdentifier: string): Promise<RoleAccessDetail> {
    const role = await this.findRoleByIdentifier(roleIdentifier)

    if (!role) {
      throw new Error(`Role '${roleIdentifier}' not found`)
    }

    let defaultCodes: string[] = []

    if (role.key === 'super_admin') {
      const all = await this.db.permission.findMany({ select: { code: true } })
      defaultCodes = all.map((p) => p.code)
    } else if (role.key === 'admin') {
      defaultCodes = [
        'overview.view', 'overview.export',
        'product.view', 'product.create', 'product.edit', 'product.delete',
        'category.view', 'category.create', 'category.edit', 'category.delete',
        'merk.view', 'merk.create', 'merk.edit', 'merk.delete',
        'warehouse.view', 'transfer.view', 'opname.view',
        'pos.orders.view',
        'user.view', 'role.view', 'access.view',
      ]
    } else if (role.key === 'cashier') {
      defaultCodes = [
        'pos.cashier', 'pos.orders.view',
        'product.view',
      ]
    } else {
      defaultCodes = []
    }

    if (role.key !== 'super_admin') {
      const validPermissions = await this.db.permission.findMany({
        where: { code: { in: defaultCodes } },
      })

      await this.db.$transaction([
        this.db.rolePermission.deleteMany({
          where: { roleId: role.id },
        }),
        this.db.rolePermission.createMany({
          data: validPermissions.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
          skipDuplicates: true,
        }),
      ])
    }

    logger.info({ roleId: role.id, roleKey: role.key }, 'Role permissions reset to default')
    return this.getRoleAccess(role.id)
  }
}

export const accessService = new AccessService()
