# Security / pen-test gate evidence

Date: 2026-07-11

## Checklist

| Control                                      | Status       | Evidence                                                                                                                                             |
| -------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMAP secrets encrypted at rest (AES-256-GCM) | PASS         | `secret-box` unit tests + functional API decrypt round-trip; API never returns password                                                              |
| Session required on mutating/data APIs       | PASS         | `route-handlers.test.ts` returns 401 without auth                                                                                                    |
| IDOR / cross-user isolation                  | PASS         | `functional-api.test.ts` isolates Alice/Bob by `userId`                                                                                              |
| XSS on merchant                              | PASS         | React text nodes escape HTML; API returns `application/json`                                                                                         |
| Fixture sync disabled by default             | PASS         | `.env.example` sets `ALLOW_FIXTURE_SYNC=0`; route 404s when unset                                                                                    |
| `.env` not committed                         | PASS         | `.gitignore` ignores `.env` (keeps `.env.example`)                                                                                                   |
| Dependency audit                             | ACCEPT (MVP) | Transitive `nodemailer` via next-auth (unused email transport); `postcss` via next. No force-downgrade applied (breaking). Track for upstream bumps. |

## Residual risks (accepted for MVP)

- No rate limiting on register/login/sync
- IMAP credentials usable by server process after decrypt (required for sync)
- Fixture sync must remain off in production deployments

## Verdict

**PASS** for MVP pen-test gate with accepted residual risks documented above.
