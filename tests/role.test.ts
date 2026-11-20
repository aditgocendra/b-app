import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { roleRouter } from '../src/routes/v1/role.route'
import { roleService } from '../src/services/role.service'

describe('Role & Permission Routes', () => {
  const app = new Hono()
  app.route('/roles', roleRouter)

  it('GET /roles/permissions should return 401 if unauthorized', async () => {
    const res = await app.request('/roles/permissions', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
  })

  it('GET /roles should return 401 if unauthorized', async () => {
    const res = await app.request('/roles', {
      method: 'GET',
    })

    expect(res.status).toBe(401)
  })

  it('POST /roles should return 401 if unauthorized', async () => {
    const res = await app.request('/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Custom Role' }),
    })

    expect(res.status).toBe(401)
  })
})
