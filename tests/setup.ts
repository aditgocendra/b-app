// Polyfill Bun environment when running under Vitest (Node.js engine)
if (typeof (globalThis as any).Bun === 'undefined') {
  ;(globalThis as any).Bun = {
    password: {
      async hash(password: string) {
        return `$bun_mock_hash$${password}`
      },
      async verify(password: string, hash: string) {
        return hash === `$bun_mock_hash$${password}`
      },
    },
  }
}
