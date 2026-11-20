import { z } from '@hono/zod-openapi'
import { RoleStatusEnum } from './auth.schema'

export const PermissionItemSchema = z.object({
  id: z.string().openapi({ example: 'product.view' }),
  code: z.string().openapi({ example: 'product.view' }),
  name: z.string().openapi({ example: 'View Products & SKUs' }),
  module: z.string().openapi({ example: 'product' }),
  action: z.string().openapi({ example: 'view' }),
  description: z.string().nullable().optional().openapi({ example: 'Allows browsing master product catalog' }),
}).openapi('PermissionItem')

export const ModulePermissionGroupSchema = z.object({
  id: z.string().openapi({ example: 'product' }),
  name: z.string().openapi({ example: 'Product Catalog' }),
  description: z.string().openapi({ example: 'Manage products, variant SKU attributes, brands (merk), and category taxonomy.' }),
  permissions: z.array(PermissionItemSchema).openapi({ description: 'List of module permissions' }),
}).openapi('ModulePermissionGroup')

export const RoleAccessDetailSchema = z.object({
  id: z.string().openapi({ example: 'role-uuid' }),
  key: z.string().openapi({ example: 'warehouse_manager' }),
  name: z.string().openapi({ example: 'Warehouse Manager' }),
  description: z.string().nullable().optional().openapi({ example: 'Supervises multi-facility warehouse stock' }),
  isSystem: z.boolean().openapi({ example: false }),
  status: RoleStatusEnum.openapi({ example: 'ACTIVE' }),
  usersCount: z.number().openapi({ example: 3 }),
  permissionCodes: z.array(z.string()).openapi({ example: ['product.view', 'pos.cashier'] }),
  createdAt: z.string().or(z.date()).openapi({ example: '2026-10-08T12:00:00.000Z' }),
  updatedAt: z.string().or(z.date()).openapi({ example: '2026-10-08T12:00:00.000Z' }),
}).openapi('RoleAccessDetail')

export const AccessMatrixResponseSchema = z.object({
  modules: z.array(ModulePermissionGroupSchema),
  roles: z.array(RoleAccessDetailSchema),
  allPermissionCodes: z.array(z.string()),
}).openapi('AccessMatrixResponse')

export const UpdateRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()).openapi({ example: ['overview.view', 'product.view', 'product.create'] }),
}).openapi('UpdateRolePermissionsRequest')

export type PermissionItem = z.infer<typeof PermissionItemSchema>
export type ModulePermissionGroup = z.infer<typeof ModulePermissionGroupSchema>
export type RoleAccessDetail = z.infer<typeof RoleAccessDetailSchema>
export type AccessMatrixResponse = z.infer<typeof AccessMatrixResponseSchema>
export type UpdateRolePermissionsInput = z.infer<typeof UpdateRolePermissionsSchema>
