# CTQ Audit System — Footwear Manufacturing Quality Control

> **Critical To Quality (CTQ) Audit — Roving Quality Control (RQC) & Total Quality Control (TQC)**  
> Aplikasi inspeksi kualitas manufaktur alas kaki terintegrasi berbasis Web & PWA.

---

## 📌 Ringkasan Proyek

**CTQ Audit System** adalah sistem audit kualitas produksi sepatu yang dirancang untuk memantau, mencatat, dan menganalisis cacat produk (*defect*) secara langsung di lini produksi (*in-line* & *end-of-line*). Sistem ini menghubungkan tim inspeksi lapangan (RQC) dan pengawas mutu (TQC) dengan manajemen melalui dashboard analitik real-time, sistem peringatan otomatis (CAP Alert), serta kemampuan audit offline.

---

## 🏛️ Arsitektur Sistem

```
+--------------------------------------------------------+
|                   NEXT.JS 15 FRONTEND                  |
|  (React 19, Tailwind CSS, Recharts, Serwist PWA/SW)    |
|            Local Cache: IndexedDB (Dexie.js)           |
+---------------------------+----------------------------+
                            |
            +---------------+---------------+
            | HTTPS / REST                  | S3 Media Proxy
            v                               v
+-----------------------+       +-----------------------+
|     NESTJS 10 API     |       |       MINIO S3        |
| (Auth, Business Logic,|       | (Photo Defect, Action |
|  Push Notif, Swagger) |       |   Plan, Model Shoes)  |
+-----------+-----------+       +-----------------------+
            |
    +-------+-------+
    |               |
    v               v
+-----------+   +-----------+
|POSTGRES 16|   |  REDIS 7  |
|(Prisma ORM|   |(Cache Layer|
|Database)  |   |Rate Limit)|
+-----------+   +-----------+
```

---

## 🛠️ Tech Stack & Versi

### 1. Core & Architecture
* **Repository Architecture:** npm Workspaces (Monorepo)
* **Language:** TypeScript `v5.7.3`
* **Node.js Runtime:** `>= v20.0.0` (Container Docker: `node:20-alpine`)
* **Package Manager:** npm `>= v10.0.0`

### 2. Frontend (`apps/web`)
* **Framework:** Next.js `v15.1.4` (App Router)
* **UI Library:** React `v19.0.0` & React DOM `v19.0.0`
* **Styling:** Tailwind CSS `v3.4.17`, PostCSS `v8.4.49`, Autoprefixer `v10.4.20`
* **Charts & Visualizations:** Recharts `v2.12.7`
* **Icons:** Lucide React `v0.460.0`, Heroicons `v2.1.1`
* **PWA & Offline:** Serwist (`@serwist/next` & `serwist`) `v9.5.13`
* **Client Database:** Dexie.js (IndexedDB) `v4.4.7`
* **Data Export:** SheetJS (`xlsx`) `v0.18.5`

### 3. Backend API (`apps/api`)
* **Framework:** NestJS `v10.4.15` (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
* **API Documentation:** NestJS Swagger `v8.1.0` (OpenAPI)
* **Authentication & Security:** 
  * Passport `v0.7.0` & Passport JWT `v4.0.1` (`@nestjs/jwt` `v10.2.0`)
  * Argon2 `v0.41.1` (Password Hashing)
  * Throttler `v6.4.0` (Rate Limiting)
* **Validation & DTOs:** Class-Validator `v0.14.1`, Class-Transformer `v0.5.1`, Zod `v3.24.1`
* **Caching Layer:** Cache Manager `v5.7.6`, Cache Manager Redis Yet `v4.2.0`, IORedis `v5.4.1`
* **Object Storage:** AWS SDK S3 Client & S3 Request Presigner `v3.716.0`
* **File Upload:** Multer `v1.4.5-lts.1`
* **Web Push Notifications:** Web-Push `v3.6.7` (VAPID)

### 4. Database & ORM (`packages/database`)
* **Database Engine:** PostgreSQL `16-alpine`
* **ORM:** Prisma ORM `v5.22.0` (`@prisma/client` & `prisma`)
* **Database Migrations & Seed:** Prisma Migrate & `ts-node` `v10.9.2`

### 5. Infrastructure & Services (Docker)
* **PostgreSQL 16:** Port `5433` (Host) -> `5432` (Container)
* **Redis 7:** Port `6379`
* **MinIO Object Storage:** Port `9000` (S3 API), Port `9001` (Web Console)

---

## ✨ Fitur Utama

- [x] **Hierarki Master Data & CTQ Setup:**
  - Konfigurasi bertingkat: Model Sepatu -> Area Produksi -> Proses CTQ -> Tipe Defect.
  - Pengelolaan gambar model dengan kompresi cerdas di browser (mempertahankan transparansi file PNG).
- [x] **Alur Audit RQC (In-line Quality Control):**
  - Form audit interaktif per sesi, area, dan proses.
  - Input jumlah pengecekan (`qty_checking`) dan defect (`qty_defect`).
  - Pengambilan foto defect langsung dari kamera HP atau galeri.
- [x] **Integrasi Data TQC (End-of-Line):**
  - Monitoring hasil pemeriksaan EOL harian dan mingguan.
  - Perhitungan akurat formula defect:
    - **Defect Rate:** `(Qty Defect / Qty Checking) * 100%`
    - **Pass Rate:** `100% - Defect Rate`
- [x] **Sistem CAP & Immediate Action:**
  - **Immediate Action:** Penanganan cepat defect harian (Action Plan & foto perbaikan).
  - **CAP (Corrective Action Plan):** Otomatis dipicu ketika Defect Rate > 20% (harian) atau > 5% (mingguan). Meliputi Root Cause, Corrective Action, Durasi Stopline, dan verifikasi status *Sudah Diisi Lengkap*.
- [x] **Web Push Notification (PWA Alert):**
  - Notifikasi berkala ke perangkat pengawas/manajemen: `"CAP — ALERT DEFECT RATE"`.
  - Peringatan harian dan mingguan saat defect rate melebihi batas toleransi.
- [x] **Dukungan PWA & Mode Offline:**
  - Inspeksi tetap berjalan saat koneksi terputus melalui IndexedDB (Dexie).
  - Sinkronisasi otomatis ke server saat jaringan kembali online.
- [x] **Dashboard Analitik Eksekutif:**
  - Rekapitulasi KPI (Total Inspection, Defect Rate, Pass Rate).
  - Grafik tren defect harian dan mingguan interaktif (Recharts).
  - Filter analitik berdasarkan rentang tanggal, model, dan area produksi.
  - Filter interaktif cross-component untuk investigasi defect spesifik.
- [x] **Export Laporan:**
  - Unduh rekapitulasi data audit langsung ke format spreadsheet Excel (.xlsx).

---

## 📁 Struktur Monorepo

```
CTQ AUDIT SYSTEM/
├── apps/
│   ├── api/                   # Backend NestJS REST API
│   │   ├── src/
│   │   │   ├── auth/          # Autentikasi NIK & JWT Strategy
│   │   │   ├── ctq-setup/     # Master Model, Area, Proses, Defect
│   │   │   ├── rqc/           # Logika Inspeksi RQC & Dashboard Metrics
│   │   │   ├── files/         # Handler Streaming/Upload File MinIO
│   │   │   ├── notifications/ # Web Push Service (VAPID)
│   │   │   └── health/        # Healthcheck Endpoint
│   │   └── package.json
│   │
│   └── web/                   # Frontend Next.js 15
│       ├── src/
│       │   ├── app/           # App Router (Pages, Layouts, SW)
│       │   ├── components/    # Reusable UI Components
│       │   ├── features/      # Feature-driven Modules (Admin, RQC, TQC)
│       │   └── lib/           # Utility functions (compress, offline repo)
│       ├── public/            # Static Assets, Service Worker, Manifest
│       └── package.json
│
├── packages/
│   ├── database/              # Prisma Schema, Migrations, Seed Data
│   ├── types/                 # Shared TypeScript DTOs & Interfaces
│   └── config/                # Shared Configurations
│
├── docker/                    # Dockerfile API & Web
├── Docs/                      # Spesifikasi Dokumen (PRD, TDD, TECH)
├── docker-compose.dev.yml     # Konfigurasi Layanan Lokal (Postgres, MinIO, Redis)
└── package.json               # Root Workspace Package
```

---

## 🚀 Panduan Memulai (Quick Start)

### Prasyarat
* **Node.js** `>= 20.0.0`
* **npm** `>= 10.0.0`
* **Docker Desktop** (untuk PostgreSQL, Redis, dan MinIO)

---

### Langkah Instalasi

#### 1. Salin Konfigurasi Environment
```bash
cp .env.example .env
```
> Pastikan variabel `DATABASE_URL`, `JWT_SECRET`, `S3_*`, dan `REDIS_URL` di dalam file `.env` sudah terisi dengan benar.

#### 2. Jalankan Layanan Pendukung (Docker)
```bash
docker compose -f docker-compose.dev.yml up postgres minio redis -d
```

#### 3. Instal Dependensi
```bash
npm install
```

#### 4. Setup Database
```bash
# Generate Prisma Client
npm run db:generate

# Terapkan schema ke PostgreSQL
npm run db:migrate:dev --workspace=packages/database

# Isi data awal (seed master data, users, area, model)
npm run db:seed --workspace=packages/database
```

#### 5. Jalankan Mode Development
Jalankan API dan Web secara bersamaan:
```bash
npm run dev
```

Atau secara terpisah di terminal berbeda:
```bash
# Terminal 1: Backend API (Port 3001)
npm run dev --workspace=apps/api

# Terminal 2: Frontend Web (Port 3000)
npm run dev --workspace=apps/web
```

---

## 🌐 Endpoint & Akses Layanan

| Layanan | URL | Keterangan |
|---|---|---|
| **Web UI** | `http://localhost:3000` | Antarmuka Pengguna & Admin |
| **API Server** | `http://localhost:3001/api` | REST API Backend |
| **Swagger UI** | `http://localhost:3001/api/docs` | Dokumentasi Interaktif API |
| **MinIO Console** | `http://localhost:9001` | Dashboard Object Storage (User: `ctqaudit_minio`) |
| **Prisma Studio** | `npm run db:studio` | GUI Manajemen Database di Browser |

---

## 🔑 Akun Default (Seed Data)

| NIK | Password | Peran (Role) | Hak Akses |
|---|---|---|---|
| `ADMIN001` | `Admin@1234` | **ADMIN** | Akses penuh dashboard, master data, setup CTQ, analitik |
| `RQC001` | `Rqc@1234` | **RQC** | Inspeksi lapangan RQC, pengisian defect & Immediate Action / CAP |

---

## 📜 Perintah Script yang Tersedia

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan API & Web secara bersamaan (concurrent) |
| `npm run build` | Menjalankan build produksi pada seluruh workspace |
| `npm run build --workspace=apps/api` | Build khusus backend NestJS |
| `npm run build --workspace=apps/web` | Build khusus frontend Next.js |
| `npm run db:migrate` | Menerapkan migrasi database Prisma |
| `npm run db:seed` | Menjalankan seed data ke database |
| `npm run db:studio` | Membuka antarmuka grafis Prisma Studio di browser |
| `npm run lint` | Menjalankan linter pada seluruh workspace |

---

## 📄 Lisensi & Hak Cipta
Hak Cipta © 2026 Parkland World Indonesia (PWI) / CTQ Quality Team. Seluruh hak cipta dilindungi undang-undang.
