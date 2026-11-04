# Releasing

How code gets from a branch to production. The automation lives in
`.github/workflows/release.yml`, which runs `.github/scripts/release.mjs`.

## Model

- Version lines: `release/vX.Y` (the next version) and `hotfix/vX.Y` (a fix for what is in prod).
- `master` is what is in prod. Only `release/vX.Y` and `hotfix/vX.Y` merge into it.
- Tags follow SemVer: `vX.Y.Z-rc.N` is a release candidate, `vX.Y.Z` is shipped.
- Automation creates the tags, the GitHub releases, new version lines and sync PRs.
  **Never create, move or delete a tag by hand.**
- A line's patch is `.0` until the line ships, then last shipped + 1.
  Example: `release/v0.2` tags `v0.2.0-rc.N`; once `v0.2.0` ships, `hotfix/v0.2` tags `v0.2.1-rc.N`.

## Naming

- Branch: `<type>/<TICKET>-short-name`, e.g. `feat/COM-9-heartbeat`.
  Types: feat, fix, chore, refactor, perf, docs, test, ci, build, revert.
- PR title and commit: Conventional Commits, `type(TICKET): summary`, imperative, lowercase,
  e.g. `feat(COM-9): send device heartbeat`.
- GitHub's own "Revert" branch and title (`revert-12-…`, `Revert "…"`) are accepted as they are.

## Procedures

| # | When | Do | Merge | Automation |
|:--|:--|:--|:--|:--|
| 1 | Feature or fix | Branch from the open release it ships in (ask if more than one fits), PR into it | **Squash** | Tags `vX.Y.Z-rc.N` |
| 2 | Pull a feature out of a release | GitHub "Revert" on its PR, into that release; reapply in the next release by reverting the revert | Squash | New rc |
| 3 | New release | Actions → Release → Run workflow → `cut-release` | — | Creates `release/vX.Y` from the newest open release, or `master` if none |
| 4 | Release day | PR `release/vX.Y → master` | **Merge commit** | Tags `vX.Y.0` and publishes the GitHub release |
| 5 | Hotfix | Actions → Release → `cut-hotfix`; fix PRs into `hotfix/vX.Y`; test the rc; PR into `master` | Squash in, **merge commit** to master | `hotfix/vX.Y` from the final tag in prod; rc tags; final tag |
| 6 | Sync PR (`chore(sync): merge A into B`, opened for you) | Review and merge. On conflicts, resolve on a branch cut from the target, never on the source | **Merge commit** | Opened on every push to a line that a newer open line lacks |

Sync order: a hotfix flows into the oldest open release, each release into the next newer one.

The final tag is refused when the merge result differs from the line's last rc: that would ship
untested code. Sync the line, let it tag a new rc, test it, and merge again.

## Deploy

| Environment | Takes |
|:--|:--|
| Test stages | Any `vX.Y.Z-rc.N` or final tag, any time |
| Prod | Only a final `vX.Y.Z`, only on release day, only if its tree equals its last `-rc.N` |

Never deploy a branch name or an rc to prod. The gate:

```bash
node .github/scripts/release.mjs check-deploy --tag v0.2.0 --env prod
```

This repo deploys with Cubeship: the `comanda/production/web` and `comanda/production/mock` apps
build from a `ref`. A prod deploy is: run the gate for the tag, then set `ref` to that tag.
Cubeship has only a production environment for now, so there are no test stages yet.
`v0.1.0` predates this flow and has no rc, so the gate refuses it for prod; it stays in prod until
`v0.2.0` ships.

## Before acting

- `git fetch --all --tags` first; reason from the remote, not the local clone.
- Pushes, PRs, merges, workflow runs, deploys and repo settings need Kai's go-ahead.
- Never push directly to `master`, `release/*` or `hotfix/*`. Never force-push them.
- Report anything off before continuing: a release line not based on the previous open release,
  a final tag whose code differs from its last rc, a tag made by hand.

## Setup (once per repo)

1. **CI.** `checks.yml` (job `checks`: install, lint, type-check) and `conventions.yml`
   (job `conventions`: branch name, PR title, only version lines into the default branch) run on
   every PR.
2. **Token for sync PRs.** PRs opened with the workflow's own `GITHUB_TOKEN` do not start CI, so
   the required checks never report. Add a repository secret `RELEASE_PR_TOKEN` (a fine-grained
   token or GitHub App token with Pull requests: write and Contents: read). Without it, close and
   reopen each sync PR to start CI.
3. **Rulesets.** The JSON in `.github/rulesets/` is the source of truth. Apply each one with:

   ```bash
   gh api -X POST repos/{owner}/{repo}/rulesets --input .github/rulesets/default-branch.json
   gh api -X POST repos/{owner}/{repo}/rulesets --input .github/rulesets/version-lines.json
   gh api -X POST repos/{owner}/{repo}/rulesets --input .github/rulesets/release-tags.json
   ```

   | Ruleset | Targets | Rules |
   |:--|:--|:--|
   | `default branch` | `~DEFAULT_BRANCH` | PR, 1 approval, `checks` + `conventions`, merge commit only, no force push or delete |
   | `version lines` | `release/v*`, `hotfix/v*` | Same, squash and merge commit allowed |
   | `release tags` | `v*` tags | Only GitHub Actions (app 15368) and admins create, update or delete |

## Script reference

```bash
node .github/scripts/release.mjs <command> [options] [--dry-run]
```

| Command | Does |
|:--|:--|
| `rc --branch <line>` | Tags the line's head `vX.Y.Z-rc.N`; skips a head that already has a tag |
| `sync --branch <line>` | Opens the sync PR into the next open line, if it lacks this one |
| `final --head <line> --sha <merge>` | Tags the merge commit `vX.Y.Z`, publishes the release; a re-run only finishes the release |
| `cut-release [--version vX.Y]` | Next minor by default; `--version` forces a line, e.g. a major |
| `cut-hotfix` | `hotfix/vX.Y` from the newest final tag; reuses the branch if it holds nothing unshipped |
| `check-deploy --tag <tag> --env <env>` | The deploy gate; `--prod-env` names prod (default `prod`) |
| `check-pr --head --base --title` | The `conventions` check |

`--dry-run` logs every write (tag, branch, PR, release) instead of doing it.
