# Migration: from a flat Linear setup to Team → Squad → Epic → Story

Run once per project. Typical starting point: one team named after a person or the workspace, no
sub-teams, one project with milestones per phase, default labels (`Feature`, `Improvement`, `Bug`),
no estimates.

Re-read the live state first: `list_teams`, `list_projects` (with milestones), `list_issue_labels`
(with groups), `list_issues` for the team. Show the user what you found.

## 0. Agree the map (ask, then write it down)

Propose and confirm with the user:

- **Parent team**: name and key. Default to the product name; reusing the existing team (rename it)
  keeps its issue history.
- **Squads**: from the repo shape (see `SKILL.md` § Squads), e.g. `Web`/`WEB` and `Core`/`CORE`.
- **Epics**: one per phase or milestone of the plan, named `E<n> · <phase name>` in the issues' language.
- **Issue language**.

Write the result as the *workspace map* in the project's `CLAUDE.md` § Task tracking:

```markdown
| Item | Value |
|:--|:--|
| Parent team | <Name> (`KEY`) |
| Squads | `WEB` = <area>, `CORE` = <area> |
| Epics | `E0 · …` … `En · …` (Linear projects) |
| Issue language | <pt-BR | en> |
```

## 1. Teams and squads (Linear UI, not the MCP)

First check the plan (Settings → Billing). Sub-teams need Business; Free also caps the team count.

1. Settings → Teams → the existing team → General: rename it and change its identifier to the
   parent team's key (issue ids follow, same numbers; Linear redirects the old ones).
2. Same page → **Estimates** → Fibonacci, zero estimates off.
3. Squads:
   - **With sub-teams (Business):** Create team once per squad; in each, **Parent team** = the
     parent team, and Fibonacci estimates too. Confirm with `list_teams` (check `parentId`).
   - **Without:** `save_issue_label` name `Squad`, `isGroup: true`, single select, workspace; one
     child label per squad (`Web`, `Core`…). Issues stay on the parent team.
4. Optional, Jira-like statuses: Backlog, Todo, In Progress, In Review, Done, Canceled.

## 2. Type labels

- `save_issue_label` name `Type`, `isGroup: true`, single select, no team (workspace).
- Put `Bug` in it; create or move `Story`, `Tech Debt` and `Spike` into it.
- Keep `Feature` / `Improvement` until step 5.

## 3. Epics

One project per phase. Description: the phase goal and "done when" from the plan (copy the
milestone description if there is one). Teams: the parent team plus each squad with work in it.
Lead: the user (`me`).

## 4. Move the existing issues

Propose a table — issue, squad, epic, type, points, parent — and wait for a yes and corrections.
Apply the split rule: a story of 8 or less keeps no sub-stories (cancel extra ones, noting where the
work went); a story over 8 keeps its sub-stories and loses its own estimate.

For each issue, parents before their sub-stories:
1. With sub-teams: `save_issue` with `id` and `team` only (the identifier changes). Record old → new id.
2. `save_issue` with `id`, `project` (by id: epic names may repeat across teams), `labels` (type id,
   plus the squad label without sub-teams), `estimate`, and `parentId` again if dropped.
3. Cancelled sub-stories: `parentId: null`, and a comment on the parent saying where the work went.

## 5. Clean up (ask before each)

- The old project, once empty: set it to Canceled (or archive it in the UI).
- Retire `Feature` and `Improvement` (`retire_issue_label`) only if no team in the workspace uses them.
- Linear's own onboarding issues: cancel them.
- `CLAUDE.md` § Task tracking: the new ids, the workspace map, and a pointer to this skill.
- Branches already open keep their names; new branches use the new `gitBranchName`.

## 6. Backlog for the remaining epics

One epic at a time: read the plan, specs and contract for that phase; draft the stories with
`SKILL.md`'s templates and points; split anything over 8; show the table; create on yes. Work that
waits on an outside decision gets that dependency in its description; do not choose for the user.
