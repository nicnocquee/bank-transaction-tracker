---
name: start-cycle
description: >-
  Starts or promotes the bank-transaction-tracker ship cycle (feature branch →
  PR into staging → promote staging to main). Use when the user runs
  /start-cycle or /promote, or asks to start the deploy cycle with a short goal.
disable-model-invocation: true
---

# Start cycle (staging → production)

Short commands for this repo’s deploy flow:

| Say                       | Does                                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| **`/start-cycle <goal>`** | Branch from `main`, implement `<goal>`, push, open PR → **`staging`**    |
| **`/promote`**            | Open (or merge-ready) PR **`staging` → `main`** after staging looks good |

Aliases for start: `/cycle <goal>`, `start cycle: <goal>`.

## Defaults for this repo

- Remote: `nicnocquee/bank-transaction-tracker`
- Staging site: https://bank-transaction-tracker-staging.netlify.app
- Production site: https://bank-transaction-tracker.netlify.app
- Feature PRs target **`staging`**, not `main`
- Promote only via **`staging` → `main`**

## `/start-cycle <goal>`

1. Confirm GitHub user (`gh api user -q .login`) — prefer `nicnocquee` for this repo.
2. `git fetch origin && git checkout main && git pull --ff-only origin main`
3. Create branch: `feat/<kebab-from-goal>` (or `fix/` / `chore/` when clearer).
4. Implement `<goal>` with project standards (JSDoc, DI, tests, kebab-case files, lint/TS clean).
5. Run applicable gates (unit at minimum; browser/functional when UI/API changes).
6. Commit (user commit protocol; HEREDOC; no secrets).
7. `git push -u origin HEAD`
8. Open PR with `--base staging` using `open-github-pr` + `humanizer`.
9. Handoff: branch name, PR URL, reminder to verify staging after merge/deploy.

Do **not** PR straight to `main` unless the user explicitly says hotfix-to-prod.

## `/promote`

1. Confirm staging deploy is what they want live.
2. `git fetch origin`
3. Ensure `origin/staging` is ahead of or equal intent vs `origin/main`.
4. Open PR `--base main --head staging` (or report existing open PR).
5. Handoff: PR URL + production URL; after merge, Actions deploy production.

## Anti-patterns

- Committing directly on `main` or `staging` for feature work
- PR base `main` for normal features
- Promoting without saying staging was checked (ask once if unclear)
