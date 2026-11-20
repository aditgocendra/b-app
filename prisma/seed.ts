import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:aditgocendra@localhost:5432/dbspace?schema=public'
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export const defaultPermissions = [
  // Overview / Dashboard
  { code: 'overview.view', name: 'View Dashboard Overview', module: 'overview', action: 'view', description: 'Allows viewing real-time order monitoring, revenue cards, and channel summaries.' },
  { code: 'overview.export', name: 'Export Overview Reports', module: 'overview', action: 'export', description: 'Allows exporting overview summaries and chart metrics into CSV / Excel.' },

  // Product Catalog
  { code: 'product.view', name: 'View Products & SKUs', module: 'product', action: 'view', description: 'Allows browsing master product catalog, prices, and variant lists.' },
  { code: 'product.create', name: 'Create New Product', module: 'product', action: 'create', description: 'Allows adding new products, SKU combinations, and uploading product media.' },
  { code: 'product.edit', name: 'Edit Products & Variants', module: 'product', action: 'edit', description: 'Allows updating product information, specifications, variant pricing, and status.' },
  { code: 'product.delete', name: 'Delete Products', module: 'product', action: 'delete', description: 'Allows permanently removing product records from the catalog.' },

  // Categories
  { code: 'category.view', name: 'View Product Categories', module: 'product', action: 'view', description: 'Allows viewing 3-letter taxonomy categories.' },
  { code: 'category.create', name: 'Create Product Category', module: 'product', action: 'create', description: 'Allows adding new categories.' },
  { code: 'category.edit', name: 'Edit Product Category', module: 'product', action: 'edit', description: 'Allows editing categories.' },
  { code: 'category.delete', name: 'Delete Product Category', module: 'product', action: 'delete', description: 'Allows removing categories.' },

  // Brands (Merk)
  { code: 'merk.view', name: 'View Brands (Merk)', module: 'product', action: 'view', description: 'Allows viewing brand taxonomy.' },
  { code: 'merk.create', name: 'Create Brand (Merk)', module: 'product', action: 'create', description: 'Allows adding new brand names.' },
  { code: 'merk.edit', name: 'Edit Brand (Merk)', module: 'product', action: 'edit', description: 'Allows updating brand info.' },
  { code: 'merk.delete', name: 'Delete Brand (Merk)', module: 'product', action: 'delete', description: 'Allows deleting brands.' },

  // Inventory & Warehouses
  { code: 'warehouse.view', name: 'View Warehouses', module: 'inventory', action: 'view', description: 'Allows viewing warehouse locations, managers, and assigned SKU capacities.' },
  { code: 'warehouse.manage', name: 'Manage Warehouses', module: 'inventory', action: 'manage', description: 'Allows creating, updating, and modifying warehouse facilities.' },
  { code: 'transfer.view', name: 'View Stock Transfers', module: 'inventory', action: 'view', description: 'Allows viewing origin, destination, and status of stock movements.' },
  { code: 'transfer.create', name: 'Request Stock Transfer', module: 'inventory', action: 'create', description: 'Allows creating inter-warehouse stock transfer requisitions.' },
  { code: 'transfer.approve', name: 'Approve Stock Transfer', module: 'inventory', action: 'manage', description: 'Allows approving, completing, or rejecting stock transfer shipments.' },
  { code: 'opname.view', name: 'View Stock Opname', module: 'inventory', action: 'view', description: 'Allows reviewing physical count audit records and discrepancy logs.' },
  { code: 'opname.create', name: 'Execute Stock Opname', module: 'inventory', action: 'create', description: 'Allows conducting physical inventory counts and adjusting stock discrepancies.' },

  // Point Of Sale (POS)
  { code: 'pos.cashier', name: 'Operate Cashier Register', module: 'pos', action: 'manage', description: 'Allows accessing fullscreen cashier station to charge cart orders.' },
  { code: 'pos.orders.view', name: 'View Cashier Invoices', module: 'pos', action: 'view', description: 'Allows viewing receipt records and shift sales summaries.' },
  { code: 'pos.orders.refund', name: 'Void / Refund Orders', module: 'pos', action: 'delete', description: 'Allows refunding, returning, or voiding cashier transactions.' },

  // User & Access Management
  { code: 'user.view', name: 'View System Users', module: 'user', action: 'view', description: 'Allows browsing registered employee accounts and roles.' },
  { code: 'user.create', name: 'Invite & Add Users', module: 'user', action: 'create', description: 'Allows creating new user credentials and role assignments.' },
  { code: 'user.edit', name: 'Edit User Accounts', module: 'user', action: 'edit', description: 'Allows updating user profiles, resetting passwords, and assigning roles.' },
  { code: 'user.delete', name: 'Delete User Accounts', module: 'user', action: 'delete', description: 'Allows removing user accounts from the organization.' },
  { code: 'role.view', name: 'View Roles', module: 'user', action: 'view', description: 'Allows viewing list of system and custom roles.' },
  { code: 'role.manage', name: 'Manage Roles', module: 'user', action: 'manage', description: 'Allows creating, editing, and deleting custom roles.' },
  { code: 'access.view', name: 'View Access Matrix', module: 'user', action: 'view', description: 'Allows inspecting permission grants per role.' },
  { code: 'access.manage', name: 'Configure Permissions', module: 'user', action: 'manage', description: 'Allows enabling or disabling feature permissions for roles.' },
]

async function main() {
  console.log('Seeding permissions catalog...')

  // Upsert all permissions
  const permissionMap = new Map<string, string>()
  for (const perm of defaultPermissions) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        name: perm.name,
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
      create: perm,
    })
    permissionMap.set(perm.code, record.id)
  }

  console.log(`Seeded ${permissionMap.size} permissions.`)

  // Ensure default system roles exist
  const systemRoles = [
    {
      key: 'super_admin',
      name: 'Super Admin',
      description: 'Full unrestricted access across all omnichannel operations, financial data, and security governance.',
      isSystem: true,
      status: 'ACTIVE' as const,
    },
    {
      key: 'admin',
      name: 'Admin',
      description: 'Primary operational administration for product catalog, marketplace order processing, and user accounts.',
      isSystem: true,
      status: 'ACTIVE' as const,
    },
    {
      key: 'cashier',
      name: 'Cashier',
      description: 'Frontline retail point of sale counter operator, checkout receipts, and cash register shifts.',
      isSystem: true,
      status: 'ACTIVE' as const,
    },
  ]

  for (const roleData of systemRoles) {
    const role = await prisma.role.upsert({
      where: { key: roleData.key },
      update: {
        name: roleData.name,
        description: roleData.description,
        isSystem: true,
      },
      create: roleData,
    })

    // Assign permissions per role
    let rolePermCodes: string[] = []
    if (roleData.key === 'super_admin') {
      // Super admin gets all permissions
      rolePermCodes = Array.from(permissionMap.keys())
    } else if (roleData.key === 'admin') {
      rolePermCodes = [
        'overview.view', 'overview.export',
        'product.view', 'product.create', 'product.edit', 'product.delete',
        'category.view', 'category.create', 'category.edit', 'category.delete',
        'merk.view', 'merk.create', 'merk.edit', 'merk.delete',
        'warehouse.view', 'transfer.view', 'opname.view',
        'pos.orders.view',
        'user.view', 'role.view', 'access.view',
      ]
    } else {
      rolePermCodes = [
        'pos.cashier', 'pos.orders.view',
        'product.view',
      ]
    }

    for (const code of rolePermCodes) {
      const permId = permissionMap.get(code)
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        })
      }
    }
  }

  console.log('Successfully seeded default roles and role permissions.')
}

main()
  .catch((e) => {
    console.error('Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
