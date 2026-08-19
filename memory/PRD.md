# Portal Orang Tua Asuh — PRD

## Problem Statement
Aplikasi web profesional (UI Bahasa Indonesia) untuk mengelola program Orang Tua Asuh: data OTA, Anak Asuh, relasi many-to-many, donasi (tanpa keterkaitan per anak), capaian/perkembangan anak, laporan bulanan, dan portal publik privat per OTA lewat link unik.

## Personas
- **Admin lembaga** (single role, JWT login) — kelola seluruh data via dashboard.
- **Orang Tua Asuh** (tanpa login) — akses portal via `/portal/{token}`.

## Core Requirements (static)
- Bahasa Indonesia end-to-end, tema Dark Green + Elegant Gold.
- Many-to-many OTA ↔ Anak Asuh via junction (unique compound index).
- Donasi terikat pada `guardian_id` saja — **tidak pernah** menyebut anak.
- Portal token = `secrets.token_urlsafe(24)`, dapat di-regenerate.
- Foto anak diunggah ke Emergent Object Storage.

## Implemented
### 2026-02 (MVP)
- Backend: auth JWT, dashboard/stats, guardians CRUD + regenerate token, children CRUD + foto, relations, donations, developments, reports (upsert + monthly matrix), settings, portal publik.
- Frontend: Login, Dashboard (stat cards + distribusi status), OTA list/detail, Anak list/detail, Relasi, Donasi, Perkembangan, Laporan, Pengaturan, Portal.
- Seed otomatis: 5 OTA, 10 Anak, 20 donasi, 30 capaian, 15 laporan.
- 21/21 backend test pass (100%).

### 2026-02 (Iterasi 1)
- Edit data OTA & Anak Asuh langsung dari halaman detail (form shared).
- Tombol Kirim WhatsApp dengan pesan salam siap kirim di halaman list & detail OTA.
- Ekspor Laporan PDF (`/api/reports/pdf`) berformat elegan Dark Green + Gold via ReportLab.
- Chart tren donasi 12 bulan di dashboard (recharts area chart, gradient hijau→emas).

## Backlog
- **P1**: filter/pagination advanced list OTA & anak; export PDF versi multi-anak.
- **P2**: chart trend anak asuh; timeline Hijri; multi-admin dengan role.
- **P2**: brute-force lockout & audit log; email notifikasi laporan.
