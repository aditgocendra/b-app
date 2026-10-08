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
  summary: 'Registrasi Pengguna Baru',
  description: 'Mendaftarkan pengguna baru dengan email, username, dan password.',
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
      description: 'Registrasi berhasil',
      content: {
        'application/json': {
          schema: ApiResponseSchema(UserResponseSchema),
        },
      },
    },
    400: {
      description: 'Data tidak valid atau sudah digunakan',
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
  summary: 'Login Pengguna',
  description: 'Login menggunakan email & password. Mengembalikan Access Token di JSON dan Refresh Token via HTTP-Only Cookie.',
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
      description: 'Login berhasil',
      content: {
        'application/json': {
          schema: ApiResponseSchema(LoginResponseDataSchema),
        },
      },
    },
    401: {
      description: 'Kredensial tidak valid',
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
  summary: 'Perbarui Access Token (Token Rotation)',
  description: 'Memperbarui Access Token menggunakan Refresh Token dari HTTP-Only Cookie dan merotasi token refresh.',
  responses: {
    200: {
      description: 'Token berhasil diperbarui',
      content: {
        'application/json': {
          schema: ApiResponseSchema(RefreshResponseDataSchema),
        },
      },
    },
    401: {
      description: 'Sesi kedaluwarsa atau token tidak valid',
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
  summary: 'Logout Pengguna',
  description: 'Mencabut sesi di server dan menghapus HTTP-Only Cookie refresh token.',
  responses: {
    200: {
      description: 'Logout berhasil',
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
  summary: 'Lupa Password',
  description: 'Meminta pembuatan token dan link reset password untuk email terdaftar.',
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
      description: 'Permintaan reset password berhasil diproses',
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
      description: 'Validasi error',
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
  summary: 'Verifikasi Token Reset Password',
  description: 'Memeriksa apakah token reset password valid dan belum kedaluwarsa.',
  request: {
    query: VerifyResetTokenQuerySchema,
  },
  responses: {
    200: {
      description: 'Token valid',
      content: {
        'application/json': {
          schema: ApiResponseSchema(VerifyResetTokenDataSchema),
        },
      },
    },
    400: {
      description: 'Token tidak valid atau kedaluwarsa',
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
  description: 'Mengubah password pengguna menggunakan reset token yang valid.',
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
      description: 'Password berhasil diubah',
      content: {
        'application/json': {
          schema: ApiResponseSchema(),
        },
      },
    },
    400: {
      description: 'Gagal mereset password',
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
  summary: 'Profil Pengguna Terautentikasi',
  description: 'Mengambil data pengguna aktif dari JWT Access Token.',
  middleware: [verifyJwt] as const,
  responses: {
    200: {
      description: 'Profil berhasil diambil',
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
        message: 'Registrasi berhasil',
        data: user as any,
      },
      201
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Registrasi gagal',
      },
      400
    )
  }
})

authRouter.openapi(loginRoute, async (c) => {
  try {
    const data = c.req.valid('json')
    const { accessToken, refreshToken, user } = await authService.login(data)

    // Set HTTP-Only Cookie untuk Refresh Token
    setCookie(c, COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    })

    return c.json(
      {
        success: true,
        message: 'Login berhasil',
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
        message: error.message || 'Login gagal',
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
          message: 'Refresh token tidak ditemukan di cookie',
        },
        401
      )
    }

    const { accessToken, refreshToken: newRefreshToken } = await authService.refresh(cookieToken)

    // Set cookie baru untuk token rotasi
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
        message: 'Token berhasil diperbarui',
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
        message: error.message || 'Gagal memperbarui token',
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
      message: 'Logout berhasil',
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
        message: error.message || 'Permintaan gagal',
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
        message: 'Token reset password valid',
        data: result,
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Token tidak valid',
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
        message: 'Password berhasil diubah. Silakan login kembali.',
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Gagal mereset password',
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
      message: 'Profil berhasil diambil',
      data: user,
    },
    200
  )
})
