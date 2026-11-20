import { describe, it, expect, beforeEach } from 'vitest'
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import { UserService } from '../src/services/user.service'

describe('UserService (Unit Tests with Prisma Mock)', () => {
  let prismaMock: DeepMockProxy<PrismaClient>
  let userService: UserService

  const sampleRole = {
    id: 'role-cashier-id',
    key: 'cashier',
    name: 'Cashier',
    description: 'Cashier role',
    isSystem: true,
    status: 'ACTIVE' as const,
    permissions: [
      {
        permission: {
          code: 'pos.view',
        },
      },
    ],
  }

  const sampleSuperAdminRole = {
    id: 'role-super-admin-id',
    key: 'super_admin',
    name: 'Super Admin',
    description: 'Super administrator',
    isSystem: true,
    status: 'ACTIVE' as const,
    permissions: [],
  }

  const sampleUser = {
    id: 'user-1',
    email: 'user1@example.com',
    username: 'user1',
    fullName: 'User One',
    password: 'hashed-password',
    phoneNumber: '08123456789',
    roleId: 'role-cashier-id',
    status: 'ACTIVE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: sampleRole,
  }

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>()
    userService = new UserService(prismaMock as unknown as PrismaClient)
  })

  describe('getUsers', () => {
    it('should return paginated user list with default pagination', async () => {
      prismaMock.user.count.mockResolvedValue(1)
      prismaMock.user.findMany.mockResolvedValue([sampleUser] as any)

      const result = await userService.getUsers({})

      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.email).toBe('user1@example.com')
      expect(result.items[0]!.role).toBe('CASHIER')
      expect(result.items[0]!.permissions).toEqual(['pos.view'])
    })

    it('should properly apply search, role, and status filters', async () => {
      prismaMock.user.count.mockResolvedValue(0)
      prismaMock.user.findMany.mockResolvedValue([])

      const result = await userService.getUsers({
        search: 'john',
        role: 'cashier',
        status: 'ACTIVE',
        page: 2,
        limit: 5,
        sortBy: 'email',
        sortOrder: 'asc',
      })

      expect(prismaMock.user.count).toHaveBeenCalled()
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { email: 'asc' },
        })
      )
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(5)
    })
  })

  describe('getUserById', () => {
    it('should return formatted user when found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser as any)

      const user = await userService.getUserById('user-1')

      expect(user.id).toBe('user-1')
      expect(user.username).toBe('user1')
      expect(user.role).toBe('CASHIER')
    })

    it('should throw an error when user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(userService.getUserById('non-existent')).rejects.toThrow('User not found')
    })
  })

  describe('createUser', () => {
    it('should throw error if email is already registered', async () => {
      prismaMock.user.findFirst.mockResolvedValue(sampleUser as any)

      await expect(
        userService.createUser({
          email: 'user1@example.com',
          username: 'differentuser',
          password: 'Password123!',
        })
      ).rejects.toThrow('Email is already registered')
    })

    it('should throw error if username is already taken', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        ...sampleUser,
        email: 'other@example.com',
        username: 'user1',
      } as any)

      await expect(
        userService.createUser({
          email: 'user2@example.com',
          username: 'user1',
          password: 'Password123!',
        })
      ).rejects.toThrow('Username is already taken')
    })

    it('should throw error if trying to create an additional super_admin', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null) // uniqueness check passes
      prismaMock.role.findUnique.mockResolvedValue(sampleSuperAdminRole as any)
      prismaMock.user.findFirst.mockResolvedValueOnce(sampleUser as any) // existing super admin check

      await expect(
        userService.createUser({
          email: 'admin2@example.com',
          username: 'admin2',
          password: 'Password123!',
          roleId: 'role-super-admin-id',
        })
      ).rejects.toThrow('Super Admin already exists. Only one Super Admin account is permitted.')
    })

    it('should successfully create a new cashier user', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null) // uniqueness
      prismaMock.role.findFirst.mockResolvedValueOnce(sampleRole as any) // role resolution
      prismaMock.role.findUnique.mockResolvedValue(sampleRole as any)
      prismaMock.user.create.mockResolvedValue({
        ...sampleUser,
        id: 'new-user-id',
        email: 'newuser@example.com',
        username: 'newuser',
      } as any)

      const result = await userService.createUser({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'Password123!',
        role: 'cashier',
      })

      expect(result.id).toBe('new-user-id')
      expect(result.email).toBe('newuser@example.com')
      expect(prismaMock.user.create).toHaveBeenCalled()
    })
  })

  describe('updateUser', () => {
    it('should throw error if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(
        userService.updateUser('non-existent', { fullName: 'Updated' })
      ).rejects.toThrow('User not found')
    })

    it('should throw error if email conflict occurs', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser as any)
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'other-user',
        email: 'taken@example.com',
        username: 'other',
      } as any)

      await expect(
        userService.updateUser('user-1', { email: 'taken@example.com' })
      ).rejects.toThrow('Email is already registered by another account')
    })

    it('should prevent demoting the only super admin', async () => {
      const superAdminUser = {
        ...sampleUser,
        roleId: 'role-super-admin-id',
        role: sampleSuperAdminRole,
      }
      prismaMock.user.findUnique.mockResolvedValue(superAdminUser as any)
      prismaMock.role.findFirst.mockResolvedValue(sampleRole as any)
      prismaMock.user.count.mockResolvedValue(1)

      await expect(
        userService.updateUser('user-1', { roleId: 'role-cashier-id' })
      ).rejects.toThrow('Cannot change role of the primary Super Admin')
    })

    it('should successfully update user details', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser as any)
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.update.mockResolvedValue({
        ...sampleUser,
        fullName: 'Updated Name',
      } as any)

      const updated = await userService.updateUser('user-1', { fullName: 'Updated Name' })

      expect(updated.fullName).toBe('Updated Name')
      expect(prismaMock.user.update).toHaveBeenCalled()
    })
  })

  describe('updateUserStatus', () => {
    it('should prevent deactivating self account', async () => {
      await expect(
        userService.updateUserStatus('user-1', 'INACTIVE', 'user-1')
      ).rejects.toThrow('You cannot deactivate your own account')
    })

    it('should prevent deactivating the only active super admin', async () => {
      const superAdminUser = {
        ...sampleUser,
        roleId: 'role-super-admin-id',
        role: sampleSuperAdminRole,
      }
      prismaMock.user.findUnique.mockResolvedValue(superAdminUser as any)
      prismaMock.user.count.mockResolvedValue(1)

      await expect(
        userService.updateUserStatus('user-1', 'INACTIVE', 'admin-2')
      ).rejects.toThrow('Cannot deactivate the only active Super Admin account')
    })

    it('should revoke sessions when deactivating user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser as any)
      prismaMock.user.update.mockResolvedValue({
        ...sampleUser,
        status: 'INACTIVE',
      } as any)

      const result = await userService.updateUserStatus('user-1', 'INACTIVE', 'admin-2')

      expect(result.status).toBe('INACTIVE')
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      })
    })
  })

  describe('resetPassword', () => {
    it('should throw error when user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(
        userService.resetPassword('non-existent', 'NewPassword123!')
      ).rejects.toThrow('User not found')
    })

    it('should update password and revoke refresh tokens', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser as any)
      prismaMock.$transaction.mockResolvedValue([{}, {}] as any)

      const result = await userService.resetPassword('user-1', 'NewPassword123!')

      expect(result.success).toBe(true)
      expect(prismaMock.$transaction).toHaveBeenCalled()
    })
  })

  describe('deleteUser', () => {
    it('should prevent user from deleting themselves', async () => {
      await expect(
        userService.deleteUser('user-1', 'user-1')
      ).rejects.toThrow('You cannot delete your own account')
    })

    it('should prevent deleting the primary super admin', async () => {
      const superAdminUser = {
        ...sampleUser,
        roleId: 'role-super-admin-id',
        role: sampleSuperAdminRole,
      }
      prismaMock.user.findUnique.mockResolvedValue(superAdminUser as any)
      prismaMock.user.count.mockResolvedValue(1)

      await expect(
        userService.deleteUser('user-1', 'admin-2')
      ).rejects.toThrow('Cannot delete the primary Super Admin account')
    })

    it('should successfully delete a regular user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser as any)
      prismaMock.user.delete.mockResolvedValue(sampleUser as any)

      const result = await userService.deleteUser('user-1', 'admin-2')

      expect(result.success).toBe(true)
      expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
    })
  })

  describe('bulkDeleteUsers', () => {
    it('should exclude caller ID and super admin users', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'user-2' }] as any)
      prismaMock.user.deleteMany.mockResolvedValue({ count: 1 })

      const result = await userService.bulkDeleteUsers(['user-1', 'user-2'], 'user-1')

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['user-2'] },
          role: { key: { not: 'super_admin' } },
        },
        select: { id: true },
      })
      expect(result.deletedCount).toBe(1)
    })

    it('should handle empty eligible users safely', async () => {
      prismaMock.user.findMany.mockResolvedValue([])

      const result = await userService.bulkDeleteUsers(['user-1'], 'user-1')

      expect(result.deletedCount).toBe(0)
      expect(result.message).toBe('No eligible users to delete')
    })
  })
})
