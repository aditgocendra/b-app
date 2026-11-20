import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  UpdateRolePermissionsSchema,
  RoleDetailResponseSchema,
  PermissionResponseSchema,
} from '../../validations/role.schema'
import { ApiResponseSchema, ErrorResponseSchema } from '../../validations/auth.schema'
import { roleService } from '../../services/role.service'
import { verifyJwt, requirePermission } from '../../middlewares/auth'

export const roleRouter = new OpenAPIHono()

// --- ROUTE DEFINITIONS ---

// 1. Get All Roles
const getRolesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Role Management'],
  summary: 'Get All Roles',
  description: 'Retrieve all roles with assigned user counts and granted permission codes',
  middleware: [verifyJwt, requirePermission('role.view')] as const,
  responses: {
    200: {
      description: 'List of all system and custom roles',
      content: {
        'application/json': {
          schema: ApiResponseSchema(z.array(RoleDetailResponseSchema)),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 2. Get All Permissions Catalog
const getPermissionsRoute = createRoute({
  method: 'get',
  path: '/permissions',
  tags: ['Role Management'],
  summary: 'Get All Permissions',
  description: 'Retrieve master catalog of all system permissions grouped by module',
  middleware: [verifyJwt, requirePermission('access.view')] as const,
  responses: {
    200: {
      description: 'List of all permissions',
      content: {
        'application/json': {
          schema: ApiResponseSchema(z.array(PermissionResponseSchema)),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 3. Create Custom Role
const createRoleRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Role Management'],
  summary: 'Create Custom Role',
  description: 'Create a new custom role with optional permission codes',
  middleware: [verifyJwt, requirePermission('role.manage')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateRoleSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Role created successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RoleDetailResponseSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 4. Get Role by ID
const getRoleByIdRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Role Management'],
  summary: 'Get Role Details',
  description: 'Retrieve detailed information of a role by ID',
  middleware: [verifyJwt, requirePermission('role.view')] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Role details',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RoleDetailResponseSchema),
        },
      },
    },
    404: { description: 'Role not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 5. Update Role
const updateRoleRoute = createRoute({
  method: 'put',
  path: '/:id',
  tags: ['Role Management'],
  summary: 'Update Role',
  description: 'Update name, description, or status of an existing role',
  middleware: [verifyJwt, requirePermission('role.manage')] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdateRoleSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role updated successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RoleDetailResponseSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 6. Delete Role
const deleteRoleRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['Role Management'],
  summary: 'Delete Role',
  description: 'Permanently remove a custom role (forbidden for system roles or assigned roles)',
  middleware: [verifyJwt, requirePermission('role.manage')] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Role deleted successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 7. Update Role Permissions
const updateRolePermissionsRoute = createRoute({
  method: 'put',
  path: '/:id/permissions',
  tags: ['Role Management'],
  summary: 'Configure Role Permissions',
  description: 'Assign or replace the set of active permissions for a given role',
  middleware: [verifyJwt, requirePermission('access.manage')] as const,
  request: {
    params: z.object({ id: z.string() }),
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
      description: 'Permissions updated successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RoleDetailResponseSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// --- HANDLERS ---

roleRouter.openapi(getPermissionsRoute, async (c) => {
  try {
    const permissions = await roleService.getAllPermissions()
    return c.json({ success: true, message: 'Permissions retrieved successfully', data: permissions }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve permissions'
    return c.json({ success: false, message }, 400)
  }
})

roleRouter.openapi(getRolesRoute, async (c) => {
  try {
    const roles = await roleService.getAllRoles()
    return c.json({ success: true, message: 'Roles retrieved successfully', data: roles }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve roles'
    return c.json({ success: false, message }, 400)
  }
})

roleRouter.openapi(createRoleRoute, async (c) => {
  try {
    const data = c.req.valid('json')
    const role = await roleService.createRole(data)
    return c.json({ success: true, message: 'Role created successfully', data: role }, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create role'
    return c.json({ success: false, message }, 400)
  }
})

roleRouter.openapi(getRoleByIdRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const role = await roleService.getRoleById(id)
    return c.json({ success: true, message: 'Role details retrieved successfully', data: role }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Role not found'
    return c.json({ success: false, message }, 404)
  }
})

roleRouter.openapi(updateRoleRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const role = await roleService.updateRole(id, data)
    return c.json({ success: true, message: 'Role updated successfully', data: role }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update role'
    return c.json({ success: false, message }, 400)
  }
})

roleRouter.openapi(deleteRoleRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const res = await roleService.deleteRole(id)
    return c.json(res, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete role'
    return c.json({ success: false, message }, 400)
  }
})

roleRouter.openapi(updateRolePermissionsRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const { permissionCodes } = c.req.valid('json')
    const role = await roleService.setRolePermissions(id, permissionCodes)
    return c.json({ success: true, message: 'Role permissions updated successfully', data: role }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update role permissions'
    return c.json({ success: false, message }, 400)
  }
})
