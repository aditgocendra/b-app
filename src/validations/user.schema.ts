import { z } from '@hono/zod-openapi'
import { UserResponseSchema, UserStatusEnum } from './auth.schema'

export const UserQuerySchema = z.object({
  search: z.string().optional().openapi({ example: 'John', description: 'Search term for name, email, or username' }),
  role: z.string().optional().openapi({ example: 'admin', description: 'Filter by role key or name' }),
  status: UserStatusEnum.optional().openapi({ example: 'ACTIVE', description: 'Filter by user status' }),
  page: z.coerce.number().int().min(1).optional().default(1).openapi({ example: 1, description: 'Page number' }),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10).openapi({ example: 10, description: 'Items per page' }),
  sortBy: z.enum(['name', 'fullName', 'createdAt', 'email', 'status']).optional().default('createdAt').openapi({ example: 'createdAt' }),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc').openapi({ example: 'desc' }),
}).openapi('UserQueryRequest')

export const CreateUserSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com', description: 'Unique user email' }),
  username: z.string().min(3).max(30).optional().openapi({ example: 'john_doe', description: 'Unique username (auto-generated from email prefix if omitted)' }),
  fullName: z.string().min(2).max(100).optional().openapi({ example: 'John Doe', description: 'Full name' }),
  password: z.string().min(6).openapi({ example: 'SecureP@ss123', description: 'Initial account password (min 6 chars)' }),
  phoneNumber: z.string().max(20).optional().openapi({ example: '+62 812-3456-7890', description: 'Phone number' }),
  roleId: z.string().optional().openapi({ example: 'role-uuid', description: 'Role ID' }),
  role: z.string().optional().openapi({ example: 'admin', description: 'Role key or name if roleId is not supplied' }),
  status: UserStatusEnum.optional().default('ACTIVE').openapi({ example: 'ACTIVE' }),
}).openapi('CreateUserRequest')

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional().openapi({ example: 'John Doe Updated' }),
  email: z.string().email().optional().openapi({ example: 'updated@example.com' }),
  username: z.string().min(3).max(30).optional().openapi({ example: 'john_updated' }),
  phoneNumber: z.string().max(20).optional().openapi({ example: '+62 812-9999-8888' }),
  roleId: z.string().optional().openapi({ example: 'role-uuid' }),
  role: z.string().optional().openapi({ example: 'admin' }),
  status: UserStatusEnum.optional().openapi({ example: 'ACTIVE' }),
}).openapi('UpdateUserRequest')

export const UpdateUserStatusSchema = z.object({
  status: UserStatusEnum.openapi({ example: 'INACTIVE', description: 'New account status' }),
}).openapi('UpdateUserStatusRequest')

export const AdminResetPasswordSchema = z
  .object({
    password: z.string().min(6).optional().openapi({ example: 'NewSecret123!', description: 'New password for target user' }),
    newPassword: z.string().min(6).optional().openapi({ example: 'NewSecret123!', description: 'Alternative alias for password' }),
  })
  .refine((data) => Boolean(data.password || data.newPassword), {
    message: 'Password must be provided (min 6 characters)',
  })
  .openapi('AdminResetPasswordRequest')

export const BulkDeleteUsersSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).openapi({ example: ['b94dbba2-0c15-4fa8-bcf6-13a96860341c'], description: 'Array of user IDs to delete' }),
}).openapi('BulkDeleteUsersRequest')

export const PaginationMetaSchema = z.object({
  total: z.number().openapi({ example: 45 }),
  page: z.number().openapi({ example: 1 }),
  limit: z.number().openapi({ example: 10 }),
  totalPages: z.number().openapi({ example: 5 }),
}).openapi('PaginationMeta')

export const UserListResponseDataSchema = z.object({
  items: z.array(UserResponseSchema),
  pagination: PaginationMetaSchema,
}).openapi('UserListResponseData')

export type UserQueryInput = z.input<typeof UserQuerySchema>
export type CreateUserInput = z.input<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>
export type AdminResetPasswordInput = z.infer<typeof AdminResetPasswordSchema>
export type BulkDeleteUsersInput = z.infer<typeof BulkDeleteUsersSchema>
