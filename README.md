# Bank Transaction Tracker

Multi-user app that imports bank payment receipts from email over IMAP and shows monthly expenses.

**Currently supported:** Bank Sinarmas QRIS/transfer emails from `qris-transaction@banksinarmas.com`. The product is bank-agnostic so additional banks can be added later.

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

Open [http://localhost:3000](http://localhost:3000), register, connect IMAP, then **Sync now** (optional — auto-sync also runs on a schedule).

### Automatic sync (server cron)

Keep the Next.js app running, then in a second terminal:

```bash
npm run cron:worker
```

By default this syncs **every 5 minutes** for every user with IMAP enabled (`CRON_SCHEDULE`, override in `.env`).

You can also hit the HTTP endpoint from any external scheduler (system cron, GitHub Actions, etc.):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

### IMAP settings (Gmail)

1. Enable [2-Step Verification](https://myaccount.google.com/security).
2. Create an [App password](https://myaccount.google.com/apppasswords).
3. In the app: host `imap.gmail.com`, port `993`, TLS on, username = your Gmail, password = the app password.
4. Save → Test connection → Expenses → Sync now.

The in-app **IMAP settings** page has the full field guide for Gmail, Outlook, and other providers.

## Scripts

| Script                  | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `npm run test`          | Unit + functional tests                               |
| `npm run test:coverage` | Coverage (100% on parser/crypto/sync helpers)         |
| `npm run test:e2e`      | Playwright browser flow                               |
| `npm run cron:worker`   | Background IMAP sync for all users (default every 5m) |
| `npm run db:up`         | Start Postgres via Docker Compose                     |

## Security notes

- IMAP passwords are encrypted with AES-256-GCM (`IMAP_SECRET_KEY`) before storage.
- All transaction/IMAP queries are scoped to `session.user.id`.
- Set `ALLOW_FIXTURE_SYNC=0` in production (sample-email inject endpoint).
