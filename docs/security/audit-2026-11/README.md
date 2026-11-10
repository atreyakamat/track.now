# Security audit, November 2026

Audited commit: `932be5d` plus the fixes in the commit that adds this folder. Date: 2026-11-10.

**Nothing in this audit contacted the hosted Supabase project.** Database checks ran on a throw-away local PostgreSQL 18 with every migration applied. Browser checks ran against a mocked backend in a temporary Chrome profile.

## How to re-run everything

```bash
npm run audit:security
```

That runs the secret scan, the dependency audit and the database access matrix. The same three run in CI on every push (`.github/workflows/ci.yml`, job `security`). The CI job has not run yet at the time of writing; its first run is the proof that it works on Linux.

## Evidence files

| File | What it proves | Produced by |
| :--- | :--- | :--- |
| [db-access-matrix.md](db-access-matrix.md) | Every `track_now_*` table refuses reads and writes from another signed-in user and from anon. Rows pointed at another user's parent are refused. Function inventory with who may execute what. | `AUDIT_EVIDENCE_DIR=docs/security/audit-2026-11 node scripts/verify_sql_local.cjs` |
| [sql-local-run.txt](sql-local-run.txt) | Full output of the database run (83 checks). | same |
| [secret-scan.md](secret-scan.md) | No secret in tracked files, built bundles, or the added lines of every commit, apart from the known finding S-29. Locations only, never values. | `node scripts/audit_secrets.cjs --history --out docs/security/audit-2026-11/secret-scan.md` |
| [npm-audit-root.json](npm-audit-root.json) | Web workspaces after the fix: 0 advisories. | `npm audit --json` |
| [npm-audit-mobile.json](npm-audit-mobile.json) | Phone app: 6 moderate advisories, all in build tooling (S-33). | `npm audit --json` in `apps/mobile` |
| [browser-suite-run.txt](browser-suite-run.txt) | The mocked browser suite still passes on the upgraded build tools. | `node scripts/run_mocked_e2e.cjs` |
| `apps/app/tests/security_audit_2026_11.test.ts` | One regression test block per fixed finding. | `npm test` |

## Findings

Full write-ups are in [SECURITY_AUDIT.md](../../../SECURITY_AUDIT.md), section "November 2026 audit".

| ID | Severity | Finding | Status |
| :--- | :--- | :--- | :--- |
| S-28 | Medium | Share-link tokens fell back to `Math.random` on a device with no secure random source | Fixed in code. Server-side default prepared in migration `20261112000000` (not applied). |
| S-29 | Medium | Config of the first, Firebase-based version is in public git history | Owner action: retire that Firebase project and its key. |
| S-30 | Low | Review notes stayed readable on the device after sign-out | Fixed: removed at sign-out once the account has them. |
| S-31 | Low | Exported CSV could run formulas in a spreadsheet | Fixed. |
| S-32 | Low | No HSTS header; shared-plan pages could be indexed | Fixed (takes effect on the next deploy). |
| S-33 | Low | Advisories in build and test tools | Web: fixed (0 left). Phone: 6 moderate in build tooling, accepted. |
| S-34 | Low | Phone app data was eligible for OS backup; session kept in plain app storage; updates not code-signed | Backup switched off (next native build). The other two are recorded as accepted risks with a recommended next step. |
| S-35 | Low | anon held table privileges on six core tables (protected by row level security alone) | Prepared in migration `20261112000000` (not applied). |
| S-36 | Info | CI token had default permissions; third-party actions pinned by tag | Permissions reduced to read-only. Pinning by commit is recommended. |

## What this audit did not verify

- The hosted database. Whether its policies, grants and functions match the migrations is unverified. The matrix above proves the migrations are safe, not that production equals them.
- Supabase dashboard settings: leaked-password protection, code expiry, rate limits, allowed redirect URLs, the security advisor.
- The phone app on a device, and the contents of the built APK.
- Whether the GitHub repository is public or private (the `gh` tool is not installed here). S-29 assumes public.
- The CI security job on a Linux runner.
