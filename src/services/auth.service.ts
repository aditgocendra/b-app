import { sign, verify } from 'hono/jwt'
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '../db/prisma'
import { logger } from '../utils/logger'
import type {
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
} from '../validations/auth.schema'

export interface TokenPayload {
  [key: string]: unknown
  sub: string
  email: string
  username: string
  role: string
  exp: number
}

export class AuthService {
  private db: PrismaClient
  private accessSecret: string
  private refreshSecret: string
  private accessTokenExpiresIn: number // 15 menit dalam detik
  private refreshTokenExpiresIn: number // 7 hari dalam detik

  constructor(
    dbClient: PrismaClient = defaultPrisma,
    accessSecret: string = process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-32-chars-min',
    refreshSecret: string = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-32-chars-min'
  ) {
    this.db = dbClient
    this.accessSecret = accessSecret
    this.refreshSecret = refreshSecret
    this.accessTokenExpiresIn = 15 * 60 // 15 menit
    this.refreshTokenExpiresIn = 7 * 24 * 60 * 60 // 7 hari
  }

  /**
   * Helper: Buat Access Token (15 Menit)
   */
  async generateAccessToken(user: { id: string; email: string; username: string; role: string }): Promise<string> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + this.accessTokenExpiresIn,
    }
    return sign(payload, this.accessSecret, 'HS256')
  }

  /**
   * Helper: Buat Refresh Token (7 Hari)
   */
  async generateRefreshToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      jti: crypto.randomUUID(),
      exp: Math.floor(Date.now() / 1000) + this.refreshTokenExpiresIn,
    }
    return sign(payload, this.refreshSecret, 'HS256')
  }

  /**
   * Register User Baru
   */
  async register(data: RegisterInput) {
    logger.info({ email: data.email, username: data.username }, 'Mencoba mendaftarkan user baru')

    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    })

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new Error('Email sudah terdaftar')
      }
      throw new Error('Username sudah digunakan')
    }

    const hashedPassword = await Bun.password.hash(data.password)

    const newUser = await this.db.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        phoneNumber: data.phoneNumber,
        role: data.role || 'KASIR',
        status: 'ACTIVE',
      },
    })

    logger.info({ userId: newUser.id }, 'User berhasil didaftarkan')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = newUser
    return userWithoutPassword
  }

  /**
   * Login User
   */
  async login(data: LoginInput) {
    logger.info({ email: data.email }, 'Proses login user')

    const user = await this.db.user.findUnique({
      where: { email: data.email },
    })

    if (!user) {
      throw new Error('Email atau password tidak valid')
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Akun sedang tidak aktif atau ditangguhkan')
    }

    const isPasswordValid = await Bun.password.verify(data.password, user.password)
    if (!isPasswordValid) {
      throw new Error('Email atau password tidak valid')
    }

    // Buat token
    const accessToken = await this.generateAccessToken(user)
    const refreshToken = await this.generateRefreshToken(user.id)

    // Simpan Refresh Token ke database
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiresIn * 1000)
    await this.db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    })

    logger.info({ userId: user.id }, 'User berhasil login dan sesi dibuat')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user
    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    }
  }

  /**
   * Refresh Token (Rotasi Token)
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new Error('Refresh token tidak ditemukan')
    }

    // 1. Verifikasi tanda tangan JWT refresh token
    let payload: { sub: string }
    try {
      payload = (await verify(refreshToken, this.refreshSecret, 'HS256')) as { sub: string }
    } catch {
      throw new Error('Refresh token tidak valid atau telah kedaluwarsa')
    }

    // 2. Cari token di database
    const storedToken = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    })

    if (!storedToken) {
      throw new Error('Sesi tidak ditemukan atau telah dicabut')
    }

    if (storedToken.expiresAt < new Date()) {
      await this.db.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {})
      throw new Error('Refresh token telah kedaluwarsa')
    }

    if (storedToken.user.status !== 'ACTIVE') {
      throw new Error('Akun pengguna tidak aktif')
    }

    // 3. Rotasi Token: Hapus token lama & terbitkan token baru
    const newAccessToken = await this.generateAccessToken(storedToken.user)
    const newRefreshToken = await this.generateRefreshToken(storedToken.user.id)
    const newExpiresAt = new Date(Date.now() + this.refreshTokenExpiresIn * 1000)

    await this.db.$transaction([
      this.db.refreshToken.delete({ where: { id: storedToken.id } }),
      this.db.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.user.id,
          expiresAt: newExpiresAt,
        },
      }),
    ])

    logger.info({ userId: storedToken.user.id }, 'Token berhasil dirotasi')

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  }

  /**
   * Logout User (Pencabutan Sesi)
   */
  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return { success: true }
    }

    await this.db.refreshToken.deleteMany({
      where: { token: refreshToken },
    })

    logger.info('Sesi refresh token berhasil dicabut')
    return { success: true }
  }

  /**
   * Lupa Password (Buat token reset)
   */
  async forgotPassword(email: string) {
    logger.info({ email }, 'Permintaan lupa password')

    const user = await this.db.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Keamanan: hindari user enumeration
      return {
        success: true,
        message: 'Jika email terdaftar, tautan reset password telah dikirim',
      }
    }

    const resetToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 Jam

    // Hapus token reset sebelumnya jika ada, buat baru
    await this.db.$transaction([
      this.db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.db.passwordResetToken.create({
        data: {
          token: resetToken,
          userId: user.id,
          expiresAt,
        },
      }),
    ])

    const resetLink = `/reset-password?token=${resetToken}`
    logger.info({ email, resetLink }, 'Simulasi pengiriman tautan reset password')

    return {
      success: true,
      message: 'Tautan reset password telah dikirim',
      resetToken, // Berguna untuk testing & simulasi
      resetLink,
    }
  }

  /**
   * Verifikasi Token Reset Password
   */
  async verifyResetToken(token: string) {
    const resetRecord = await this.db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new Error('Token reset password tidak valid atau telah kedaluwarsa')
    }

    return {
      valid: true,
      email: resetRecord.user.email,
    }
  }

  /**
   * Reset Password User
   */
  async resetPassword(data: ResetPasswordInput) {
    const resetRecord = await this.db.passwordResetToken.findUnique({
      where: { token: data.token },
    })

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new Error('Token reset password tidak valid atau telah kedaluwarsa')
    }

    const hashedPassword = await Bun.password.hash(data.password)

    // Perbarui password, hapus token reset, dan cabut semua refresh token aktif
    await this.db.$transaction([
      this.db.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      }),
      this.db.passwordResetToken.delete({
        where: { id: resetRecord.id },
      }),
      this.db.refreshToken.deleteMany({
        where: { userId: resetRecord.userId },
      }),
    ])

    logger.info({ userId: resetRecord.userId }, 'Password berhasil direset')
    return { success: true }
  }
}

export const authService = new AuthService()
