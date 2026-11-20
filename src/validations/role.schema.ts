import { z } from '@hono/zod-openapi'
import { RoleStatusEnum } from './auth.schema'

export const PermissionResponseSchema = z.object({
  id: z.string().openapi({ example: 'perm-uuid' }),
  code: z.string().openapi({ example: 'product.view' }),
  name: z.string().openapi({ example: 'View Products & SKUs' }),
  module: z.string().openapi({ example: 'product' }),
  action: z.string().openapi({ example: 'view' }),
  description: z.string().nullable().optional().openapi({ example: 'Allows browsing product catalog' }),
}).openapi('PermissionResponse')

export const RoleDetailResponseSchema = z.object({
  id: z.string().openapi({ example: 'role-uuid' }),
  key: z.string().openapi({ example: 'warehouse_manager' }),
  name: z.string().openapi({ example: 'Warehouse Manager' }),
  description: z.string().nullable().optional().openapi({ example: 'Supervises warehouse operations' }),
  isSystem: z.boolean().openapi({ example: false }),
  status: RoleStatusEnum.openapi({ example: 'ACTIVE' }),
  usersCount: z.number().openapi({ example: 3 }),
  permissions: z.array(PermissionResponseSchema).optional(),
  permissionCodes: z.array(z.string()).optional(),
  createdAt: z.string().or(z.date()).openapi({ example: '2026-10-08T12:00:00.000Z' }),
  updatedAt: z.string().or(z.date()).openapi({ example: '2026-10-08T12:00:00.000Z' }),
}).openapi('RoleDetailResponse')

export const CreateRoleSchema = z.object({
  name: z.string().min(2).max(50).openapi({ example: 'Store Supervisor' }),
  key: z.string().min(2).max(50).optional().openapi({ example: 'store_supervisor' }),
  description: z.string().max(255).optional().openapi({ example: 'Supervises offline retail stores' }),
  status: RoleStatusEnum.optional().default('ACTIVE').openapi({ example: 'ACTIVE' }),
  permissionCodes: z.array(z.string()).optional().openapi({ example: ['product.view', 'pos.cashier'] }),
}).openapi('CreateRoleRequest')

export const UpdateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional().openapi({ example: 'Store Supervisor Updated' }),
  description: z.string().max(255).optional().openapi({ example: 'Updated description' }),
  status: RoleStatusEnum.optional().openapi({ example: 'ACTIVE' }),
}).openapi('UpdateRoleRequest')

export const UpdateRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()).openapi({ example: ['product.view', 'product.create', 'merk.create'] }),
}).openapi('UpdateRolePermissionsRequest')

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>
export type UpdateRolePermissionsInput = z.infer<typeof UpdateRolePermissionsSchema>
