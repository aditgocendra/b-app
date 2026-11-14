import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyResetTokenQuerySchema,
  UserResponseSchema,
  LoginResponseDataSchema,
  RefreshResponseDataSchema,
  VerifyResetTokenDataSchema,
  ApiResponseSchema,
  ErrorResponseSchema,
} from '../../validations/auth.schema'
import { authService } from '../../services/auth.service'
import { verifyJwt } from '../../middlewares/auth'

export const authRouter = new OpenAPIHono()

const COOKIE_NAME = 'refresh_token'
const isProduction = process.env.NODE_ENV === 'production'

// --- ROUTE DEFINITIONS ---

// 1. Register Route
const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Authentication'],
  summary: 'Register New User',
  description: 'Register a new user with email, username, and password.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RegisterSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User registered successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(UserResponseSchema),
        },
      },
    },
    400: {
      description: 'Invalid input or credentials already taken',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

// 2. Login Route
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Authentication'],
  summary: 'User Login',
  description: 'Authenticate user using email & password. Returns Access Token in JSON response and Refresh Token via HTTP-Only Cookie.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: ApiResponseSchema(LoginResponseDataSchema),
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

// 3. Refresh Token Route
const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['Authentication'],
  summary: 'Refresh Access Token (Token Rotation)',
  description: 'Refresh Access Token using Refresh Token from HTTP-Only Cookie and rotate refresh token.',
  responses: {
    200: {
      description: 'Token refreshed successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RefreshResponseDataSchema),
        },
      },
    },
    401: {
      description: 'Expired session or invalid token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

// 4. Logout Route
const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Authentication'],
  summary: 'User Logout',
  description: 'Revoke session on server and clear HTTP-Only Cookie refresh token.',
  responses: {
    200: {
      description: 'Logout successful',
      content: {
        'application/json': {
          schema: ApiResponseSchema(),
        },
      },
    },
  },
})

// 5. Forgot Password Route
const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  tags: ['Authentication'],
  summary: 'Forgot Password',
  description: 'Request password reset token and link for registered email address.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ForgotPasswordSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password reset request processed successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(
            z.object({
              resetToken: z.string().optional(),
              resetLink: z.string().optional(),
            })
          ),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

// 6. Verify Reset Token Route
const verifyResetTokenRoute = createRoute({
  method: 'get',
  path: '/verify-reset-token',
  tags: ['Authentication'],
  summary: 'Verify Password Reset Token',
  description: 'Check if password reset token is valid and not expired.',
  request: {
    query: VerifyResetTokenQuerySchema,
  },
  responses: {
    200: {
      description: 'Token is valid',
      content: {
        'application/json': {
          schema: ApiResponseSchema(VerifyResetTokenDataSchema),
        },
      },
    },
    400: {
      description: 'Token is invalid or expired',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

// 7. Reset Password Route
const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/reset-password',
  tags: ['Authentication'],
  summary: 'Reset Password',
  description: 'Update user password using a valid reset token.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResetPasswordSchema,
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
    400: {
      description: 'Failed to reset password',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

// 8. Protected Profile / Me Route
const getMeRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Authentication'],
  summary: 'Authenticated User Profile',
  description: 'Retrieve current active user data from JWT Access Token.',
  middleware: [verifyJwt] as const,
  responses: {
    200: {
      description: 'Profile retrieved successfully',
      content: {
        'application/json': {
          schema: ApiResponseSchema(
            z.object({
              sub: z.string(),
              email: z.string(),
              username: z.string(),
              role: z.string(),
            })
          ),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

// --- HANDLERS ---

authRouter.openapi(registerRoute, async (c) => {
  try {
    const data = c.req.valid('json')
    const user = await authService.register(data)
    return c.json(
      {
        success: true,
        message: 'Registration successful',
        data: user as any,
      },
      201
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Registration failed',
      },
      400
    )
  }
})

authRouter.openapi(loginRoute, async (c) => {
  try {
    const data = c.req.valid('json')
    const { accessToken, refreshToken, user } = await authService.login(data)

    // Set HTTP-Only Cookie for Refresh Token
    setCookie(c, COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return c.json(
      {
        success: true,
        message: 'Login successful',
        data: {
          accessToken,
          user: user as any,
        },
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Login failed',
      },
      401
    )
  }
})

authRouter.openapi(refreshRoute, async (c) => {
  try {
    const cookieToken = getCookie(c, COOKIE_NAME)
    if (!cookieToken) {
      return c.json(
        {
          success: false,
          message: 'Refresh token not found in cookie',
        },
        401
      )
    }

    const { accessToken, refreshToken: newRefreshToken } = await authService.refresh(cookieToken)

    // Set new cookie for token rotation
    setCookie(c, COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })

    return c.json(
      {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken,
        },
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Failed to refresh token',
      },
      401
    )
  }
})

authRouter.openapi(logoutRoute, async (c) => {
  const cookieToken = getCookie(c, COOKIE_NAME)
  if (cookieToken) {
    await authService.logout(cookieToken)
  }

  deleteCookie(c, COOKIE_NAME, {
    path: '/',
    secure: isProduction,
    sameSite: 'Strict',
  })

  return c.json(
    {
      success: true,
      message: 'Logout successful',
    },
    200
  )
})

authRouter.openapi(forgotPasswordRoute, async (c) => {
  try {
    const { email } = c.req.valid('json')
    const result = await authService.forgotPassword(email)

    return c.json(
      {
        success: true,
        message: result.message,
        data: {
          resetToken: result.resetToken,
          resetLink: result.resetLink,
        },
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Request failed',
      },
      400
    )
  }
})

authRouter.openapi(verifyResetTokenRoute, async (c) => {
  try {
    const { token } = c.req.valid('query')
    const result = await authService.verifyResetToken(token)

    return c.json(
      {
        success: true,
        message: 'Password reset token is valid',
        data: result,
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Invalid token',
      },
      400
    )
  }
})

authRouter.openapi(resetPasswordRoute, async (c) => {
  try {
    const data = c.req.valid('json')
    await authService.resetPassword(data)

    return c.json(
      {
        success: true,
        message: 'Password has been reset successfully. Please log in again.',
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Failed to reset password',
      },
      400
    )
  }
})

authRouter.openapi(getMeRoute, async (c) => {
  const user = c.get('user')
  return c.json(
    {
      success: true,
      message: 'Profile retrieved successfully',
      data: user,
    },
    200
  )
})
