# 09 — Workflow

## 1. Branches

| Branch | Rule |
|--------|------|
| `main` | Protected. Always ready to deploy. Changes come only through pull requests. |
| `feat/<topic>` | A new feature. Make it from `main`. |
| `fix/<topic>` | A bug fix. Make it from `main`. |
| `docs/<topic>`, `chore/<topic>`, `ci/<topic>` | Documents, tooling, CI. |

Keep a branch short: one task, one pull request. Delete the branch after the merge (GitHub does this automatically).

## 2. Procedure for one task

1. Run `git checkout main && git pull --ff-only`.
2. Run `git checkout -b feat/<topic>`.
3. Make the change. Write or change the tests.
4. Run `npm run check && npm test && npm run build`.
5. Commit with a Conventional Commits message (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`).
6. Push the branch and open a pull request to `main`.
7. Wait for the required checks `secrets` and `test`.
8. Squash-merge. The pull request title becomes the one commit on `main`. Use the form `type: summary (#N)`.

## 3. Rules for `main`

- No direct push. No force push. No branch deletion.
- Required checks: `secrets`, `test`. The branch must be up to date with `main` (strict).
- Merge method: squash only. Merge commits and rebase merges are off.
- The history of `main` is linear: one commit for each pull request.

## 4. Releases

At the end of each roadmap phase, put an annotated tag on `main`:

```bash
git tag -a v0.2.0 -m "v0.2.0 — <phase name>"
git push origin v0.2.0
```

| Tag | Phase |
|-----|-------|
| `v0.1.0` | Phase 1 — core loop |
| `v0.2.0` | Phase 2 — fun |
| `v0.3.0` | Phase 3 — notifications |
| `v1.0.0` | Phase 4 — solid |

## 5. Secrets

- Do not commit `.env`, keys, tokens, certificates, `data/` or `*.db`. The `.gitignore` file blocks them.
- The pre-commit hook runs `scripts/check-secrets.mjs`. Do not skip it with `--no-verify`.
- CI runs the same check and gitleaks. GitHub push protection is on.
- If a secret goes into a commit by mistake: revoke the secret first, then remove it from the history.
