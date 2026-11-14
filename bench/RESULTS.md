# Bench snapshot (retired)

Recorded 2026-08-14 on this machine (AMD Ryzen 7 9800X3D, Linux x86_64, Bun 1.3.11). Bombardier **10s / 100 connections**, localhost.

This is a frozen record, not a live benchmark. The competitive harness that produced it (`bench/src/run.sh`, `build.sh`, `apps/`) was removed when backend became Cloudflare Workers-only; there is no Node or Bun server path left to measure. The gates that remain are `bench:hotpath`, `bench:finalize` and `bench:streaming`, judged against `blueprint/baselines/bench.json`.

- **Naked** — framework only. Routes: `GET /json`, `GET /params/:id`, `GET /middleware`.
- **Zod** — same `zod@4.3.6`. Backend `.input()`, Hono `@hono/zod-validator`, Elysia Standard Schema `body`, Express/Nest `zod.parse`.

Backend and Hono ran on `Bun.serve({ fetch })`, Elysia on `app.listen()`, Express on `app.listen()`, Nest on `bun run` TS (so its size is n/a). Zero 4xx/5xx on every recorded scenario below.

## Bun — naked

| Framework | Raw    | Gzip     |
| --------- | ------ | -------- |
| Backend   | 55 KB  | 15 KB    |
| Hono      | 20 KB  | **8 KB** |
| Elysia    | 376 KB | 104 KB   |
| Express   | 803 KB | 267 KB   |
| Nest      | n/a    | n/a      |

| Scenario          | Backend | Hono | Elysia   | Express | Nest |
| ----------------- | ------- | ---- | -------- | ------- | ---- |
| GET `/json`       | 246k    | 273k | **384k** | 155k    | 128k |
| GET `/params/42`  | 241k    | 252k | **379k** | 151k    | 115k |
| GET `/middleware` | 244k    | 224k | **348k** | 139k    | 109k |

## Bun — zod

| Framework | Raw    | Gzip      |
| --------- | ------ | --------- |
| Backend   | 123 KB | 34 KB     |
| Hono      | 92 KB  | **28 KB** |
| Elysia    | 444 KB | 122 KB    |
| Express   | 871 KB | 285 KB    |
| Nest      | n/a    | n/a       |

| Scenario          | Backend | Hono | Elysia   | Express | Nest |
| ----------------- | ------- | ---- | -------- | ------- | ---- |
| GET `/json`       | 251k    | 269k | **309k** | 135k    | 124k |
| GET `/params/42`  | 237k    | 259k | **381k** | 149k    | 113k |
| POST `/validate`  | 188k    | 176k | **225k** | 96k     | 83k  |
| GET `/middleware` | 243k    | 227k | **342k** | 129k    | 112k |

## Read

Backend ≈ Hono. Elysia owns raw GET. Backend wins validate and middleware vs Hono. Express/Nest are 1.6–2× slower than Backend and much fatter.
