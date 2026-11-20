import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { v1App } from '../src/routes/v1'
import { userService } from '../src/services/user.service'

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-32-chars-min'

describe('User Management Routes (Integration API Tests)', () => {
  const app = new Hono()
  app.route('/api/v1', v1App)

  let superAdminToken: string

  beforeEach(async () => {
    superAdminToken = await sign(
      {
        sub: 'admin-uuid-1',
        email: 'admin@example.com',
        username: 'admin',
        role: 'super_admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      ACCESS_SECRET,
      'HS256'
    )
  })

  describe('Authentication & Authorization Guards', () => {
    it('GET /api/v1/users should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users', { method: 'GET' })
      expect(res.status).toBe(401)
    })

    it('POST /api/v1/users should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
      })
      expect(res.status).toBe(401)
    })

    it('GET /api/v1/users/:id should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users/user-123', { method: 'GET' })
      expect(res.status).toBe(401)
    })

    it('PUT /api/v1/users/:id should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users/user-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Updated' }),
      })
      expect(res.status).toBe(401)
    })

    it('PATCH /api/v1/users/:id/status should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users/user-123/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE' }),
      })
      expect(res.status).toBe(401)
    })

    it('POST /api/v1/users/:id/reset-password should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users/user-123/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: 'NewPassword123!' }),
      })
      expect(res.status).toBe(401)
    })

    it('DELETE /api/v1/users/:id should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users/user-123', { method: 'DELETE' })
      expect(res.status).toBe(401)
    })

    it('POST /api/v1/users/bulk-delete should return 401 if unauthorized', async () => {
      const res = await app.request('/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['user-1'] }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('Authorized Operations with Super Admin Token', () => {
    it('GET /api/v1/users should return 200 with list data', async () => {
      vi.spyOn(userService, 'getUsers').mockResolvedValueOnce({
        items: [
          {
            id: 'user-1',
            email: 'cashier@example.com',
            username: 'cashier1',
            fullName: 'Cashier One',
            phoneNumber: '0812345678',
            roleId: 'role-1',
            role: 'CASHIER',
            status: 'ACTIVE',
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      })

      const res = await app.request('/api/v1/users?page=1&limit=10', {
        method: 'GET',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: boolean; data: { items: unknown[]; pagination: { total: number } } }
      expect(body.success).toBe(true)
      expect(body.data.items).toHaveLength(1)
      expect(body.data.pagination.total).toBe(1)
    })

    it('POST /api/v1/users should validate input and return 400 on invalid payload', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'not-an-email', password: '123' }),
      })

      expect(res.status).toBe(400)
    })

    it('POST /api/v1/users should return 201 on valid creation', async () => {
      vi.spyOn(userService, 'createUser').mockResolvedValueOnce({
        id: 'new-user-1',
        email: 'staff@example.com',
        username: 'staff1',
        fullName: 'Staff One',
        phoneNumber: null,
        roleId: 'role-1',
        role: 'STAFF',
        status: 'ACTIVE',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'staff@example.com',
          username: 'staff1',
          fullName: 'Staff One',
          password: 'Password123!',
        }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { success: boolean; data: { id: string } }
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('new-user-1')
    })

    it('PATCH /api/v1/users/:id/status should update status and return 200', async () => {
      vi.spyOn(userService, 'updateUserStatus').mockResolvedValueOnce({
        id: 'user-1',
        email: 'staff@example.com',
        username: 'staff1',
        fullName: 'Staff One',
        phoneNumber: null,
        roleId: 'role-1',
        role: 'STAFF',
        status: 'INACTIVE',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.request('/api/v1/users/user-1/status', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'INACTIVE' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: boolean; data: { status: string } }
      expect(body.data.status).toBe('INACTIVE')
    })

    it('POST /api/v1/users/:id/reset-password should reset password and return 200', async () => {
      vi.spyOn(userService, 'resetPassword').mockResolvedValueOnce({
        success: true,
        message: 'Password reset successfully',
      })

      const res = await app.request('/api/v1/users/user-1/reset-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword: 'BrandNewPassword123!' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: boolean; message: string }
      expect(body.success).toBe(true)
      expect(body.message).toBe('Password reset successfully')
    })

    it('POST /api/v1/users/bulk-delete should return 200 with deleted count', async () => {
      vi.spyOn(userService, 'bulkDeleteUsers').mockResolvedValueOnce({
        success: true,
        deletedCount: 2,
        message: 'Successfully deleted 2 user(s)',
      })

      const res = await app.request('/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: ['user-1', 'user-2'] }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: boolean; data: { deletedCount: number } }
      expect(body.success).toBe(true)
      expect(body.data.deletedCount).toBe(2)
    })
  })
})
