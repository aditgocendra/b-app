import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../src/services/auth.service'

describe('AuthService (Unit Tests with Prisma Mock)', () => {
  let prismaMock: DeepMockProxy<PrismaClient>
  let authService: AuthService

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>()
    authService = new AuthService(
      prismaMock as unknown as PrismaClient,
      'test-access-secret-32-chars-long-!',
      'test-refresh-secret-32-chars-long-!'
    )
  })

  describe('register', () => {
    it('harus berhasil mendaftarkan pengguna baru dan password di-hash', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.create.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'kasir@example.com',
        username: 'kasir1',
        password: 'hashed-password-123',
        phoneNumber: '08123456789',
        role: 'KASIR',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const result = await authService.register({
        email: 'kasir@example.com',
        username: 'kasir1',
        password: 'secretPassword123',
        phoneNumber: '08123456789',
        role: 'KASIR',
      })

      expect(result).toHaveProperty('id', 'user-uuid-1')
      expect(result).toHaveProperty('email', 'kasir@example.com')
      expect(result).not.toHaveProperty('password')
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1)
    })

    it('harus melempar error jika email sudah digunakan', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'existing-id',
        email: 'kasir@example.com',
        username: 'lainnya',
      } as any)

      await expect(
        authService.register({
          email: 'kasir@example.com',
          username: 'kasir_baru',
          password: 'secretPassword123',
        })
      ).rejects.toThrow('Email sudah terdaftar')
    })
  })

  describe('login', () => {
    it('harus berhasil login dan menghasilkan access & refresh token', async () => {
      const plainPassword = 'password123'
      const hashedPassword = await Bun.password.hash(plainPassword)

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: hashedPassword,
        role: 'KASIR',
        status: 'ACTIVE',
        phoneNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      prismaMock.refreshToken.create.mockResolvedValue({} as any)

      const result = await authService.login({
        email: 'user@example.com',
        password: plainPassword,
      })

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user).toHaveProperty('email', 'user@example.com')
      expect(result.user).not.toHaveProperty('password')
      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1)
    })

    it('harus gagal login jika password salah', async () => {
      const hashedPassword = await Bun.password.hash('correct-password')

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: hashedPassword,
        status: 'ACTIVE',
      } as any)

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'wrong-password',
        })
      ).rejects.toThrow('Email atau password tidak valid')
    })

    it('harus gagal login jika status user bukan ACTIVE', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'suspended@example.com',
        status: 'SUSPENDED',
      } as any)

      await expect(
        authService.login({
          email: 'suspended@example.com',
          password: 'any-password',
        })
      ).rejects.toThrow('Akun sedang tidak aktif atau ditangguhkan')
    })
  })

  describe('refreshToken (Token Rotation)', () => {
    it('harus merotasi refresh token dan menghasilkan access token baru', async () => {
      const userId = 'user-rotasi-1'
      const oldRefreshToken = await authService.generateRefreshToken(userId)

      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'token-db-id',
        token: oldRefreshToken,
        userId,
        expiresAt: new Date(Date.now() + 1000000),
        user: {
          id: userId,
          email: 'user@example.com',
          username: 'user1',
          role: 'KASIR',
          status: 'ACTIVE',
        },
      } as any)

      prismaMock.$transaction.mockResolvedValue([{}, {}] as any)

      const result = await authService.refresh(oldRefreshToken)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.refreshToken).not.toBe(oldRefreshToken)
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('harus melempar error jika token kedaluwarsa di DB', async () => {
      const userId = 'user-rotasi-1'
      const oldRefreshToken = await authService.generateRefreshToken(userId)

      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'token-db-id',
        token: oldRefreshToken,
        userId,
        expiresAt: new Date(Date.now() - 100000), // Sudah lewat
        user: { status: 'ACTIVE' },
      } as any)

      prismaMock.refreshToken.delete.mockResolvedValue({} as any)

      await expect(authService.refresh(oldRefreshToken)).rejects.toThrow(
        'Refresh token telah kedaluwarsa'
      )
    })
  })

  describe('logout', () => {
    it('harus mencabut refresh token dari database', async () => {
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 } as any)

      const result = await authService.logout('sample-token')

      expect(result).toEqual({ success: true })
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'sample-token' },
      })
    })
  })

  describe('forgotPassword, verifyResetToken & resetPassword', () => {
    it('harus membuat reset token untuk user yang valid', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-reset-1',
        email: 'user@example.com',
      } as any)

      prismaMock.$transaction.mockResolvedValue([{}, {}] as any)

      const result = await authService.forgotPassword('user@example.com')

      expect(result.success).toBe(true)
      expect(result.resetToken).toBeDefined()
      expect(result.resetLink).toContain(result.resetToken)
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('harus memverifikasi reset token yang masih valid', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 100000),
        user: { email: 'user@example.com' },
      } as any)

      const result = await authService.verifyResetToken('valid-token')
      expect(result.valid).toBe(true)
      expect(result.email).toBe('user@example.com')
    })

    it('harus berhasil mereset password baru', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        token: 'valid-token',
        userId: 'user-id-1',
        expiresAt: new Date(Date.now() + 100000),
      } as any)

      prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as any)

      const result = await authService.resetPassword({
        token: 'valid-token',
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      })

      expect(result.success).toBe(true)
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })
  })
})
