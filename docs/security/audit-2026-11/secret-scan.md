# Secret scan

Scanned 399 tracked text files, 15 built bundle files, and the added lines of 96 commits.
Values are never printed. Locations only.

**Result: PASS, nothing outside the allowlist**

| Where | Line | Kind | Count | Status |
| :--- | :--- | :--- | :--- | :--- |
| BUILD:apps/app/dist/assets/index-CqGqmDNe.js | 10 | JWT with role anon (public key, allowed in client config) | 1 | allowed: public anon key in a client bundle or old commit |
| HEAD:apps/app/tests/auth_recovery_signout.test.ts | 96 | hard-coded credential assignment | 1 | allowed: test fixtures |
| HEAD:apps/app/tests/password_features.test.ts | 27 | hard-coded credential assignment | 2 | allowed: test fixtures |
| HISTORY:146357d:release/app/assets/firebase.f5efec14.js | 1 | Google API key | 1 | allowed: KNOWN FINDING S-29: old Firebase web config in history (owner retires the project) |
| HISTORY:146357d:release/app/assets/firebase.f5efec14.js | 1 | hard-coded credential assignment | 1 | allowed: KNOWN FINDING S-29: old Firebase web config in history (owner retires the project) |
| HISTORY:4bf8096:apps/app/tests/auth_recovery_signout.test.ts | 1 | hard-coded credential assignment | 1 | allowed: test fixtures |
| HISTORY:4cc0121:app/.env | 1 | Google API key | 1 | allowed: KNOWN FINDING S-29: old Firebase web config in history (owner retires the project) |
| HISTORY:a7572c9:apps/app/tests/password_features.test.ts | 1 | hard-coded credential assignment | 2 | allowed: test fixtures |
| HISTORY:d8a4b3d:app/src/boot/firebase.js | 1 | hard-coded credential assignment | 1 | allowed: KNOWN FINDING S-29: old Firebase web config in history (owner retires the project) |
| HISTORY:f3d5d38:release/app/assets/firebase.188d00a7.js | 1 | hard-coded credential assignment | 1 | allowed: KNOWN FINDING S-29: old Firebase web config in history (owner retires the project) |
