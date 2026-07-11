# Sinarmas Expense Tracker

Multi-user app that imports Bank Sinarmas QRIS/transfer receipts from email (`qris-transaction@banksinarmas.com`) over IMAP and shows monthly expenses.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma
- Auth.js (email/password)
- IMAP via `imapflow`
- Vitest + Playwright

## Quick start

```bash
cp .env.example .env
# set AUTH_SECRET and IMAP_SECRET_KEY (openssl rand -base64 32 / openssl rand -hex 32)

npm install
npm run db:up
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register, connect IMAP (e.g. Gmail app password), then **Sync now**.

## Scripts

| Script                  | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `npm run test`          | Unit + functional tests                       |
| `npm run test:coverage` | Coverage (100% on parser/crypto/sync helpers) |
| `npm run test:e2e`      | Playwright browser flow                       |
| `npm run db:up`         | Start Postgres via Docker Compose             |

## Security notes

- IMAP passwords are encrypted with AES-256-GCM (`IMAP_SECRET_KEY`) before storage.
- All transaction/IMAP queries are scoped to `session.user.id`.
- Set `ALLOW_FIXTURE_SYNC=0` in production (sample-email inject endpoint).
