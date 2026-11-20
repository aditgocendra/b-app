import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  AccessMatrixResponseSchema,
  ModulePermissionGroupSchema,
  RoleAccessDetailSchema,
  UpdateRolePermissionsSchema,
} from '../../validations/access.schema'
import { ApiResponseSchema, ErrorResponseSchema } from '../../validations/auth.schema'
import { accessService } from '../../services/access.service'
import { verifyJwt, requirePermission } from '../../middlewares/auth'

export const accessRouter = new OpenAPIHono()

// --- ROUTE DEFINITIONS ---

// 1. Get Complete Access Matrix
const getAccessMatrixRoute = createRoute({
  method: 'get',
  path: '/matrix',
  tags: ['Access Control & Permissions'],
  summary: 'Get Access Matrix',
  description: 'Retrieve functional module groups, system/custom roles, and current permission assignments',
  middleware: [verifyJwt, requirePermission('access.view')] as const,
  responses: {
    200: {
      description: 'Access matrix retrieved successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(AccessMatrixResponseSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 2. Get All Permissions Grouped by Module
const getPermissionGroupsRoute = createRoute({
  method: 'get',
  path: '/permissions',
  tags: ['Access Control & Permissions'],
  summary: 'Get Module Permission Groups',
  description: 'Retrieve master catalog of all system permissions grouped by functional module',
  middleware: [verifyJwt, requirePermission('access.view')] as const,
  responses: {
    200: {
      description: 'Module permission groups retrieved successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(z.array(ModulePermissionGroupSchema)),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 3. Get Role Access by Key or ID
const getRoleAccessRoute = createRoute({
  method: 'get',
  path: '/roles/:roleIdentifier',
  tags: ['Access Control & Permissions'],
  summary: 'Get Role Access Configuration',
  description: 'Retrieve permissions assigned to a role identified by key or UUID',
  middleware: [verifyJwt, requirePermission('access.view')] as const,
  request: {
    params: z.object({ roleIdentifier: z.string() }),
  },
  responses: {
    200: {
      description: 'Role access details retrieved successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RoleAccessDetailSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    404: { description: 'Role not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 4. Update Role Permissions
const updateRolePermissionsRoute = createRoute({
  method: 'put',
  path: '/roles/:roleIdentifier/permissions',
  tags: ['Access Control & Permissions'],
  summary: 'Update Role Permissions',
  description: 'Replace granted permissions for a specific role',
  middleware: [verifyJwt, requirePermission('access.manage')] as const,
  request: {
    params: z.object({ roleIdentifier: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdateRolePermissionsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role permissions updated successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RoleAccessDetailSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 5. Reset Role Permissions to Default
const resetRolePermissionsRoute = createRoute({
  method: 'post',
  path: '/roles/:roleIdentifier/reset',
  tags: ['Access Control & Permissions'],
  summary: 'Reset Role Permissions to Default',
  description: 'Revert granted permissions for a role to system default configuration',
  middleware: [verifyJwt, requirePermission('access.manage')] as const,
  request: {
    params: z.object({ roleIdentifier: z.string() }),
  },
  responses: {
    200: {
      description: 'Role permissions reset successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RoleAccessDetailSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// --- HANDLERS ---

accessRouter.openapi(getAccessMatrixRoute, async (c) => {
  try {
    const data = await accessService.getAccessMatrix()
    return c.json({ success: true, message: 'Access matrix retrieved successfully', data }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve access matrix'
    return c.json({ success: false, message }, 400)
  }
})

accessRouter.openapi(getPermissionGroupsRoute, async (c) => {
  try {
    const data = await accessService.getPermissionGroups()
    return c.json({ success: true, message: 'Module permission groups retrieved successfully', data }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve permission groups'
    return c.json({ success: false, message }, 400)
  }
})

accessRouter.openapi(getRoleAccessRoute, async (c) => {
  try {
    const { roleIdentifier } = c.req.valid('param')
    const data = await accessService.getRoleAccess(roleIdentifier)
    return c.json({ success: true, message: 'Role access details retrieved successfully', data }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Role not found'
    return c.json({ success: false, message }, 404)
  }
})

accessRouter.openapi(updateRolePermissionsRoute, async (c) => {
  try {
    const { roleIdentifier } = c.req.valid('param')
    const { permissionCodes } = c.req.valid('json')
    const data = await accessService.updateRolePermissions(roleIdentifier, permissionCodes)
    return c.json({ success: true, message: 'Role permissions updated successfully', data }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update role permissions'
    return c.json({ success: false, message }, 400)
  }
})

accessRouter.openapi(resetRolePermissionsRoute, async (c) => {
  try {
    const { roleIdentifier } = c.req.valid('param')
    const data = await accessService.resetRolePermissions(roleIdentifier)
    return c.json({ success: true, message: 'Role permissions reset to default successfully', data }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reset role permissions'
    return c.json({ success: false, message }, 400)
  }
})
