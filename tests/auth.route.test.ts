import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { v1App } from '../src/routes/v1'

describe('Auth Routes (Integration / E2E API Tests)', () => {
  const app = new Hono()
  app.route('/api/v1', v1App)

  it('POST /api/v1/auth/register harus mengembalikan 400 jika payload tidak valid', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bukan-email', password: '123' }),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.success).toBe(false)
  })

  it('POST /api/v1/auth/login harus mengembalikan 400 jika email tidak valid', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'format-salah', password: 'password' }),
    })

    expect(res.status).toBe(400)
  })

  it('POST /api/v1/auth/refresh harus mengembalikan 401 jika cookie refresh_token tidak ada', async () => {
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as any
    expect(body.message).toContain('Refresh token tidak ditemukan')
  })

  it('POST /api/v1/auth/logout harus menghapus cookie dan mengembalikan 200', async () => {
    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.success).toBe(true)
    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader).toContain('refresh_token=')
  })

  it('GET /api/v1/auth/me harus mengembalikan 401 Unauthorized jika tanpa token Bearer', async () => {
    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as any
    expect(body.success).toBe(false)
    expect(body.message).toContain('Access token diperlukan')
  })

  it('GET /api/v1/openapi.json harus dilindungi oleh Basic Auth (401 jika tanpa auth)', async () => {
    const res = await app.request('/api/v1/openapi.json', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
  })

  it('GET /api/v1/docs harus dilindungi oleh Basic Auth (401 jika tanpa auth)', async () => {
    const res = await app.request('/api/v1/docs', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
  })
})
