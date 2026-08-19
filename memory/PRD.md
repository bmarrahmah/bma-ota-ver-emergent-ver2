# Portal Orang Tua Asuh — PRD

## Problem Statement
Aplikasi web profesional bilingual (UI Bahasa Indonesia) untuk mengelola program Orang Tua Asuh: data OTA, Anak Asuh, relasi many-to-many, donasi (tanpa keterkaitan per anak), capaian/perkembangan anak, laporan bulanan, dan portal publik privat per OTA lewat link unik.

## Personas
- **Admin lembaga** (single role, JWT login) — kelola seluruh data via dashboard.
- **Orang Tua Asuh** (tanpa login) — akses portal via `/portal/{token}` untuk melihat anak asuh, capaian, donasi, dan status laporan bulanan.

## Core Requirements (static)
- Bahasa Indonesia end-to-end, tema Dark Green (#0B3D2E) + Elegant Gold (#C9A227).
- Many-to-many antara OTA ↔ Anak Asuh via junction `relations` (unique compound index).
- Donasi terikat pada `guardian_id` saja — **tidak pernah** menyebut anak.
- Portal token = `secrets.token_urlsafe(24)`, unique, dapat di-regenerate.
- Foto anak diunggah ke Emergent Object Storage, disajikan lewat `/api/files/{path}`.

## Implemented (2026-02)
- Backend FastAPI + MongoDB dengan endpoint: auth (JWT), dashboard/stats, guardians CRUD + regenerate token, children CRUD, photo upload/download, relations, donations, developments, reports (upsert + monthly matrix), settings, public portal.
- Seed otomatis: 5 OTA (status bervariasi), 10 Anak, ~20 donasi, ~30 capaian, ~15 laporan.
- Frontend React 19 + Tailwind + Shadcn dengan halaman: Login, Dashboard, OTA list/detail, Anak list/detail, Relasi, Donasi, Perkembangan, Laporan, Pengaturan, Portal publik.
- Responsif mobile-first; sidebar berubah menjadi drawer di mobile.
- 21/21 backend test pass (login, CRUD, unique constraints, upload/download, portal no-auth, many-to-many, donation-no-child-leak).

## Backlog
- **P1**: filter/pagination advanced OTA & anak; export laporan PDF; WhatsApp direct-share link laporan.
- **P1**: edit form untuk anak & OTA dari halaman detail.
- **P2**: chart tren donasi bulanan; timeline Hijri; multi-admin dengan role.
- **P2**: brute-force lockout & audit log.
