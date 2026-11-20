import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  UserQuerySchema,
  CreateUserSchema,
  UpdateUserSchema,
  UpdateUserStatusSchema,
  AdminResetPasswordSchema,
  BulkDeleteUsersSchema,
  UserListResponseDataSchema,
} from '../../validations/user.schema'
import {
  UserResponseSchema,
  ApiResponseSchema,
  ErrorResponseSchema,
} from '../../validations/auth.schema'
import { userService } from '../../services/user.service'
import { verifyJwt, requirePermission } from '../../middlewares/auth'

export const userRouter = new OpenAPIHono()

// --- ROUTE DEFINITIONS ---

// 1. Get All Users (Paginated, Filtered, Sorted)
const getUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['User Management'],
  summary: 'List Users',
  description: 'Retrieve paginated users with optional search, role, and status filters',
  middleware: [verifyJwt, requirePermission('user.view')] as const,
  request: {
    query: UserQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated user list',
      content: {
        'application/json': {
          schema: ApiResponseSchema(UserListResponseDataSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 2. Create User
const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['User Management'],
  summary: 'Create User',
  description: 'Create a new employee user account and assign a role',
  middleware: [verifyJwt, requirePermission('user.create')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(UserResponseSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 3. Get User By ID
const getUserByIdRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['User Management'],
  summary: 'Get User Details',
  description: 'Retrieve user profile and assigned role permissions',
  middleware: [verifyJwt, requirePermission('user.view')] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'User details',
      content: {
        'application/json': {
          schema: ApiResponseSchema(UserResponseSchema),
        },
      },
    },
    404: { description: 'User not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 4. Update User
const updateUserRoute = createRoute({
  method: 'put',
  path: '/:id',
  tags: ['User Management'],
  summary: 'Update User Profile',
  description: 'Update user name, email, phone number, role, or status',
  middleware: [verifyJwt, requirePermission('user.edit')] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdateUserSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User updated successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(UserResponseSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 5. Toggle / Update User Status
const updateUserStatusRoute = createRoute({
  method: 'patch',
  path: '/:id/status',
  tags: ['User Management'],
  summary: 'Update User Status',
  description: 'Quickly toggle user status between ACTIVE, INACTIVE, or SUSPENDED',
  middleware: [verifyJwt, requirePermission('user.edit')] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdateUserStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User status updated successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(UserResponseSchema),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// 6. Reset User Password (Admin action)
const adminResetPasswordRoute = createRoute({
  method: 'post',
  path: '/:id/reset-password',
  tags: ['User Management'],
  summary: 'Admin Password Reset',
  description: 'Set a new password for a user account and invalidate their active login sessions',
  middleware: [verifyJwt, requirePermission('user.edit')] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: AdminResetPasswordSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password reset successfully',
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

// 7. Delete Single User
const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['User Management'],
  summary: 'Delete User',
  description: 'Permanently remove a user account from the system',
  middleware: [verifyJwt, requirePermission('user.delete')] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'User deleted successfully',
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

// 8. Bulk Delete Users
const bulkDeleteUsersRoute = createRoute({
  method: 'post',
  path: '/bulk-delete',
  tags: ['User Management'],
  summary: 'Bulk Delete Users',
  description: 'Delete multiple users simultaneously',
  middleware: [verifyJwt, requirePermission('user.delete')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: BulkDeleteUsersSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Users deleted successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(z.object({ deletedCount: z.number() })),
        },
      },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// --- HANDLERS ---

userRouter.openapi(getUsersRoute, async (c) => {
  try {
    const query = c.req.valid('query')
    const result = await userService.getUsers(query)
    return c.json(
      {
        success: true,
        message: 'Users retrieved successfully',
        data: result,
      },
      200
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve users'
    return c.json({ success: false, message }, 400)
  }
})

userRouter.openapi(createUserRoute, async (c) => {
  try {
    const data = c.req.valid('json')
    const user = await userService.createUser(data)
    return c.json(
      {
        success: true,
        message: 'User created successfully',
        data: user,
      },
      201
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    return c.json({ success: false, message }, 400)
  }
})

userRouter.openapi(getUserByIdRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = await userService.getUserById(id)
    return c.json(
      {
        success: true,
        message: 'User details retrieved successfully',
        data: user,
      },
      200
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'User not found'
    return c.json({ success: false, message }, 404)
  }
})

userRouter.openapi(updateUserRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const currentUser = c.get('user')
    const user = await userService.updateUser(id, data, currentUser?.sub)
    return c.json(
      {
        success: true,
        message: 'User updated successfully',
        data: user,
      },
      200
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update user'
    return c.json({ success: false, message }, 400)
  }
})

userRouter.openapi(updateUserStatusRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const { status } = c.req.valid('json')
    const currentUser = c.get('user')
    const user = await userService.updateUserStatus(id, status, currentUser?.sub)
    return c.json(
      {
        success: true,
        message: 'User status updated successfully',
        data: user,
      },
      200
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update user status'
    return c.json({ success: false, message }, 400)
  }
})

userRouter.openapi(adminResetPasswordRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const password = (body.password || body.newPassword)!
    const result = await userService.resetPassword(id, password)
    return c.json(result, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reset password'
    return c.json({ success: false, message }, 400)
  }
})

userRouter.openapi(deleteUserRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const currentUser = c.get('user')
    const result = await userService.deleteUser(id, currentUser?.sub)
    return c.json(result, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete user'
    return c.json({ success: false, message }, 400)
  }
})

userRouter.openapi(bulkDeleteUsersRoute, async (c) => {
  try {
    const { ids } = c.req.valid('json')
    const currentUser = c.get('user')
    const result = await userService.bulkDeleteUsers(ids, currentUser?.sub)
    return c.json(
      {
        success: true,
        message: result.message,
        data: { deletedCount: result.deletedCount },
      },
      200
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to bulk delete users'
    return c.json({ success: false, message }, 400)
  }
})
