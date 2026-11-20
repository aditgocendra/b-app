import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { v1App } from '../src/routes/v1'
import { authService } from '../src/services/auth.service'

describe('Auth Routes (Integration / E2E API Tests)', () => {
  const app = new Hono()
  app.route('/api/v1', v1App)

  it('POST /api/v1/auth/register should return 400 if payload is invalid', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '123' }),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.success).toBe(false)
  })

  it('POST /api/v1/auth/login should return 400 if email is invalid', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email-format', password: 'password' }),
    })

    expect(res.status).toBe(400)
  })

  it('POST /api/v1/auth/refresh should return 401 if refresh_token cookie is missing', async () => {
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as any
    expect(body.message).toContain('Refresh token not found')
  })

  it('POST /api/v1/auth/logout should clear cookie and return 200', async () => {
    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.success).toBe(true)
    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader).toContain('refresh_token=')
  })

  it('GET /api/v1/auth/me should return 401 Unauthorized if Bearer token is missing', async () => {
    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as any
    expect(body.success).toBe(false)
    expect(body.message).toContain('Access token is required')
  })

  it('GET /api/v1/openapi.json should be protected by Basic Auth (401 without auth)', async () => {
    const res = await app.request('/api/v1/openapi.json', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
  })

  it('GET /api/v1/docs should be protected by Basic Auth (401 without auth)', async () => {
    const res = await app.request('/api/v1/docs', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
  })

  it('GET /api/v1/auth/startup-status should return 200 with system startup status', async () => {
    vi.spyOn(authService, 'getStartupStatus').mockResolvedValueOnce({
      isSetupRequired: true,
      hasSuperAdmin: false,
      userCount: 0,
    })

    const res = await app.request('/api/v1/auth/startup-status', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.success).toBe(true)
    expect(body.data.isSetupRequired).toBe(true)
    expect(body.data.hasSuperAdmin).toBe(false)
    expect(body.data.userCount).toBe(0)
  })
})
