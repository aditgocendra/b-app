# Product Requirements Document (PRD) & Panduan Arsitektur Backend

Dokumen ini berfungsi sebagai referensi utama bagi AI (dan developer) dalam membangun aplikasi backend. Semua implementasi kode harus merujuk pada standar arsitektur dan teknologi yang telah ditentukan di bawah ini.

## 1. Teknologi & Environment (Tech Stack)
- **Runtime:** [Bun](https://bun.sh/) (Efisien, cepat, dan modern)
- **Framework:** [Hono](https://hono.dev/) (Gunakan dokumentasi terbaru dan stabil)
- **Database:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/) (Gunakan dokumentasi ofisial terbaru)

## 2. Arsitektur Aplikasi (Layered Architecture)
Aplikasi ini harus dibangun menggunakan pendekatan *Layered Architecture* untuk memisahkan tanggung jawab, dengan struktur direktori standar sebagai berikut:

```text
src/
├── index.ts               # Entry point (Inisialisasi Hono & jalankan server Bun)
├── db/
│   └── prisma.ts          # Konfigurasi ORM (misal: Prisma untuk Neon Postgres)
├── middlewares/
│   ├── auth.ts            # Middleware JWT & Role-Based Access Control (RBAC)
│   └── error.ts           # Global error handler
├── routes/
│   └── product.route.ts   # Hanya mengatur HTTP request/response & Endpoint
├── services/
│   └── product.service.ts # Logika bisnis utama (Pemrosesan data, perhitungan)
└── validations/
    └── product.schema.ts  # Skema validasi data menggunakan Zod
```

### Prinsip Utama Arsitektur:
1. **Konsistensi Logika Bisnis:**
   Seluruh logika bisnis yang kompleks (seperti memotong stok, memvalidasi aturan diskon, hingga mengecek RBAC) **harus ditempatkan secara terpusat di Service Layer**. Logika ini harus dapat dieksekusi secara konsisten baik dipanggil melalui HTTP Route/Controller, maupun melalui *cron job* internal tanpa modifikasi.
2. **Keandalan Transaksi (Reliability):**
   Interaksi dengan database tetap terisolasi. Jika sebuah transaksi kompleks gagal di tengah proses, Service Layer bertanggung jawab mengatur pembatalan (rollback) transaksi dengan aman tanpa membocorkan detail error spesifik ke tingkat Route (HTTP layer).
3. **Kemudahan Pengujian Terisolasi:**
   Service Layer harus berupa murni fungsi TypeScript yang **tidak memiliki ketergantungan pada objek request/response dari Hono**. Hal ini menjamin proses *unit testing* berjalan cepat dan dapat diuji secara mandiri.

## 3. Strategi Pengujian (Testing)
Pengujian (Testing) sangat diutamakan dan menggunakan **Vitest** dipadukan dengan **Prisma Mock** agar tidak perlu menyentuh database asli atau menjalankan server.

**Prioritas Pengujian (Layer Unit Test):**
1. **Service Layer (Prioritas Utama):** Wajib dilakukan *Unit Test* untuk memastikan logika bisnis berjalan akurat.
2. **Route / Controller Layer:** Prioritas untuk *Integration Test* / *E2E API Test* untuk memastikan request/response valid.

## 4. Logging System
Logging aplikasi diimplementasikan menggunakan **Pino** untuk performa terbaik.
- **Di Level Middleware (Routes):** Wajib mencatat (`log`) setiap request HTTP yang masuk dan keluar beserta durasi eksekusinya.
- **Di Level Service:** Digunakan untuk melacak *flow* (alur) bisnis kritis, mencatat *metric* tertentu, atau menangkap *error* spesifik dengan rapi.

## 5. API Endpoints & Versioning
Semua *endpoint* harus menggunakan teknik *Versioning* (misal: `/api/v1`, `/api/v2`).
**Tujuan Versioning:**
- Mencegah *Breaking Changes* pada klien/frontend lama.
- Melindungi integrasi pihak ketiga.
- Memungkinkan evolusi logika bisnis di masa mendatang dengan mulus.

**Syarat Kenaikan Versi (Version Bump):**
Kenaikan versi *endpoint* diperlukan apabila terjadi perubahan yang berpotensi merusak (*breaking*):
- Menambah/mengubah/menghapus struktur kolom JSON yang wajib (mandatory).
- Mengubah tipe data (misal dari `String` menjadi `Array`).
- Mengubah struktur URL proses (misal proses `/checkout` dipisah menjadi dua tahapan *endpoint* berbeda).

## 6. Dokumentasi API (Code-First OpenAPI)
Pendekatan pembuatan dokumentasi menggunakan strategi **Code-First OpenAPI**.
- Validasi data menggunakan **Zod**.
- Generasi OpenAPI Spec menggunakan **`@hono/zod-openapi`**.
- Antarmuka UI (UI Docs) menggunakan **Scalar** (sebagai pengganti Swagger UI, karena lebih ringan dan terintegrasi resmi dengan Hono).

### 🔒 Keamanan Dokumentasi API
Dokumentasi API bersifat rahasia dan **HANYA** boleh diakses oleh tim pengembang. Dokumentasi tidak membutuhkan koneksi database, cukup gunakan middleware `basicAuth` bawaan Hono.

**Contoh Implementasi Perlindungan Docs:**
```typescript
import { basicAuth } from 'hono/basic-auth'
import { apiReference } from '@scalar/hono-api-reference'

// --- AREA TERLINDUNGI UNTUK DOKUMENTASI ---
// Terapkan Basic Auth HANYA untuk path /docs dan /openapi.json

v1App.use('/docs/*', basicAuth({
  username: process.env.DOCS_USERNAME || 'developer',
  password: process.env.DOCS_PASSWORD || 'rahasia-tim-dev',
}));

v1App.use('/openapi.json', basicAuth({
  username: process.env.DOCS_USERNAME || 'developer',
  password: process.env.DOCS_PASSWORD || 'rahasia-tim-dev',
}));

// 1. Generate OpenAPI Spec (Sekarang dilindungi basicAuth)
v1App.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { title: 'POS API', version: '1.0.0' },
});

// 2. Render Scalar UI (Sekarang dilindungi basicAuth)
v1App.get('/docs', apiReference({
  spec: { url: '/api/v1/openapi.json' },
}));
```

---
**⚠️ CATATAN PENTING UNTUK AI:**
Kode harus selalu dibuat seefisien dan seaman mungkin. Jangan membuang waktu (komputasi maupun baris kode) pada hal yang tidak penting. Selalu berpikir kritis dan efisien dalam mengambil keputusan untuk memberikan kode dengan kualitas terbaik berdasarkan panduan di atas.
