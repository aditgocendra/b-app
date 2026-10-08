import { z } from '@hono/zod-openapi'

export const RoleEnum = z.enum(['SUPER_ADMIN', 'ADMIN_GUDANG', 'KASIR'])
export const UserStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])

export const UserResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: 'b94dbba2-0c15-4fa8-bcf6-13a96860341c' }),
  email: z.string().email().openapi({ example: 'kasir@example.com' }),
  username: z.string().openapi({ example: 'kasir01' }),
  phoneNumber: z.string().nullable().optional().openapi({ example: '08123456789' }),
  role: RoleEnum.openapi({ example: 'KASIR' }),
  status: UserStatusEnum.openapi({ example: 'ACTIVE' }),
  createdAt: z.string().or(z.date()).openapi({ example: '2026-10-08T12:00:00.000Z' }),
  updatedAt: z.string().or(z.date()).openapi({ example: '2026-10-08T12:00:00.000Z' }),
}).openapi('UserResponse')

// Register Schema
export const RegisterSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com', description: 'User valid email' }),
  username: z.string().min(3).max(30).openapi({ example: 'john_doe', description: 'Unique username (min 3 chars)' }),
  password: z.string().min(6).openapi({ example: 'StrongP@ssw0rd', description: 'Plain password (min 6 chars)' }),
  phoneNumber: z.string().optional().openapi({ example: '081234567890', description: 'Optional phone number' }),
  role: RoleEnum.optional().default('KASIR').openapi({ example: 'KASIR', description: 'User role' }),
}).openapi('RegisterRequest')

// Login Schema
export const LoginSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com', description: 'Registered email address' }),
  password: z.string().min(1).openapi({ example: 'StrongP@ssw0rd', description: 'Password' }),
}).openapi('LoginRequest')

// Login Success Data Schema
export const LoginResponseDataSchema = z.object({
  accessToken: z.string().openapi({ description: 'JWT Access Token with 15m expiration' }),
  user: UserResponseSchema,
}).openapi('LoginResponseData')

// Refresh Success Data Schema
export const RefreshResponseDataSchema = z.object({
  accessToken: z.string().openapi({ description: 'New JWT Access Token' }),
}).openapi('RefreshResponseData')

// Forgot Password Schema
export const ForgotPasswordSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com', description: 'Account registered email' }),
}).openapi('ForgotPasswordRequest')

// Verify Reset Token Schema
export const VerifyResetTokenQuerySchema = z.object({
  token: z.string().min(1).openapi({ example: 'random-reset-token-string', description: 'Password reset token' }),
})

export const VerifyResetTokenDataSchema = z.object({
  valid: z.boolean().openapi({ example: true }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
}).openapi('VerifyResetTokenData')

// Reset Password Schema
export const ResetPasswordSchema = z.object({
  token: z.string().min(1).openapi({ example: 'random-reset-token-string' }),
  password: z.string().min(6).openapi({ example: 'NewSecret123!' }),
  confirmPassword: z.string().min(6).openapi({ example: 'NewSecret123!' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password dan confirm password tidak cocok',
  path: ['confirmPassword'],
}).openapi('ResetPasswordRequest')

// Generic API Response Schemas
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema?: T) =>
  z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: 'Operation completed successfully' }),
    ...(dataSchema ? { data: dataSchema } : {}),
  })

export const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  message: z.string().openapi({ example: 'Invalid credentials or resource not found' }),
  errors: z.any().optional(),
}).openapi('ErrorResponse')

export type RegisterInput = z.input<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
