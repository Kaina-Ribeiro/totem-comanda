---
name: linear-backlog
description: Use when creating, splitting, estimating, moving or reorganizing work in Linear — epics, stories, sub-stories, bugs, tech debt, spikes, squads — when a feature looks too big for one issue, when a bug or shortcut is found while coding, or when the Linear structure no longer matches the project's plan.
---

# Linear backlog (Jira-style)

## Overview

Linear set up the way Jira teams work:
**Team → Squad → Epic → Story → Sub-story**, plus **Bug**, **Tech Debt** and **Spike**, pointed in Fibonacci.
Every issue has exactly one type, one squad, one epic and (if it is work) one estimate.

This skill is project-agnostic. The project's own values (team, squad keys, epics, issue language)
live in its `CLAUDE.md` under **Task tracking** — the *workspace map*. Read it first.
No map yet, or Linear is still flat (one team, no squads, milestones instead of epics)?
Run `migration.md` in this folder before anything else.

## Jira → Linear map

| Jira | Linear | Notes |
|:--|:--|:--|
| Team | Parent team | Usually the product name, with a short key (`COM`, `ACME`) |
| Squad | Sub-team of the parent (own key, own issue numbers); without Business, a `Squad` label | One per area of the repo, see *Squads* |
| Epic | Project, shared by the parent team and the squads working on it | One per phase, milestone or big feature of the plan |
| Story | Issue with label `Story` | A slice of user-visible or deployable value |
| Sub-task / sub-story | Sub-issue of a story, also `Story` | Only when the story is over 8 points |
| Bug | Issue with label `Bug` | Wrong behaviour against spec, contract or design |
| Tech Debt | Issue with label `Tech Debt` | A shortcut taken on purpose, or cleanup that slows the team |
| Spike | Issue with label `Spike` | Time-boxed investigation that ends in a decision |
| Story points | Estimate (team setting: Fibonacci) | 1, 2, 3, 5, 8 on one issue; 13+ means split |

`Story`, `Bug`, `Tech Debt` and `Spike` sit in the **workspace** label group `Type` (single select), so they
survive moving an issue between teams. Pass label ids to `save_issue` (`list_issue_labels` with `includeGroups`).

## Squads

**Plan check first.** Sub-teams (parent team) need Linear's Business plan, and the Free plan also caps the
number of teams. On a plan without sub-teams, a squad is a label in the **workspace** label group `Squad`
(single select, e.g. `Web`, `Core`) on the one product team: issue ids stay `KEY-n`, everything else in this
skill works the same, and the labels can become real sub-teams after an upgrade. Check the plan in
Settings → Billing; the team settings show "Parent team — Available on Business" when nesting is off.

Derive squads from the repository, not from people:

| Repo shape | Squads |
|:--|:--|
| Monorepo with a front end and a back end (`apps/web` + `api/`, `frontend/` + `server/`…) | `WEB` for the front end and its BFF; `CORE` for the back end. `SERVER` or `BACKEND` instead of `CORE` if the user prefers — ask once, then record it in the map |
| Also mobile, infra, data… | One more squad per area that has its own owner or deploy (`MOBILE`, `INFRA`) |
| Single app, single owner | No squads: issues live on the parent team |

Routing an issue:
- It touches one area → that area's squad.
- It needs two areas and cannot be split (a contract change, an open question between owners) → parent team.
  Prefer splitting: one story per squad, linked with `blocks` / `blockedBy`.
- A squad the user does not own (a partner's back end, another team's service): describe the story, do not
  write its code unless the user asks.

## Story points (Fibonacci)

Points are complexity + uncertainty, not hours. Calibrate against done issues in the same project.

| Pts | Means | Typical example |
|:--|:--|:--|
| 1 | Trivial, no unknowns | Copy or token change, add an env var |
| 2 | Small, one place, clear path | One route handler that proxies one endpoint |
| 3 | Clear, a few files, tests | Generated API client plus a mock server |
| 5 | A full screen or flow with several states | Load config and show its loading, error and empty states |
| 8 | Cross-cutting or real unknowns | First deploy on new hardware, with measurements |
| 13+ | Too big for one issue | Split. Never save 13 or 21 on a single story |

**Over 8 → split.** Keep the parent story as the container: the whole goal in its description, **no estimate**
(so the epic does not count points twice), and sub-stories of at most 8 each. **8 or less → do not split.**
Split by vertical slice a user could see, not by layer ("UI", "API", "tests" is wrong).
A split may also produce sibling stories in the same epic when the parts ship independently.

Bugs and Tech Debt get points like stories. A Spike gets 1–3 and a time box in its description.

## Templates

Write issues in the language the workspace map says (default: the language of the existing issues).
Titles state the outcome, not the task: "Kiosk shows the menu for the current hour", not "Create Menu component".

**Story**

```markdown
**As** <user role>, **I want** <goal>, **so that** <benefit>.

## Context
<why now; link to the plan or spec>

## Acceptance criteria
- [ ] Given <state>, when <action>, then <result>

## Technical notes
- Specs / contract: <ids, operations>
- Out of scope: <what does not go in>

## How to verify
<short steps: command, screen, request>
```

**Bug**

```markdown
## Steps to reproduce
1. ...
## Expected
<with a reference: spec id, contract, design>
## Actual
## Environment
<production | staging | local | mock>, commit <sha>
```
Severity goes in Linear priority: 1 Urgent (system down / wrong money), 2 High, 3 Medium, 4 Low.

**Tech Debt**

```markdown
## What was left behind
<the shortcut and where it is: file:line>
## Impact if not paid
## Proposal
## When to pay
<before phase N | when touching X>
```

**Spike**

```markdown
## Question
## Time box
<e.g. 1 day>
## Output
<the decision, written in the plan or an ADR>
```

## Workflow for any backlog change

1. Read the project's plan and specs, its API contract if any, and `git log` for what is already done.
2. Draft the tree in chat as a table: type, squad, epic, title, points, parent. Totals per epic.
3. Show it to the user and wait for a yes. Linear is shared; others see every change.
4. Create parents before children; set `team` (squad), `project` (epic), `labels` (type id), `estimate`, `parentId`.
   Use `blocks` / `blockedBy` for cross-squad dependencies.
5. Report back: new ids, links, total points per epic.

While coding:
- Starting a story: move it to In Progress. Finished and committed: Done.
- A bug found outside the current story → new `Bug`; do not fix it silently in this branch.
- A shortcut taken on purpose → new `Tech Debt` with `file:line`, linked to the story with `relatedTo`.

## Linear MCP limits

The Linear MCP cannot create, rename or configure teams (sub-teams, keys, estimate scale, statuses).
Do those in the Linear UI: in a browser the user is signed in to, or by giving the user exact click paths.
Everything else (labels, projects, issues, moves between teams) goes through the MCP.

## Common mistakes

| Mistake | Fix |
|:--|:--|
| Parent story and its sub-stories both pointed | Clear the parent estimate |
| Story of 8 or less split into sub-stories | Keep it whole |
| Split by layer (UI / API / tests) | Split by slice of behaviour |
| Type label created on a team | Workspace label group `Type`, single select |
| `labels` together with a `team` change in one `save_issue` | Move team first, then set labels in a second call |
| Issue without epic or without type | Every issue: one type, one squad, one epic |
| Epic name shared with another team's project (`E0 · …`) | Pass the project id (`P-KEY-n`) to `save_issue`, not the name |
| Retiring `Feature` / `Improvement` because this team no longer uses them | Labels are workspace-wide; check other teams' issues first |
| Squads named after people or the product's domain | Name them after repo areas: `WEB`, `CORE`/`SERVER`/`BACKEND` |
| Guessing an open question into acceptance criteria | Leave it as an open item and ask the user |
