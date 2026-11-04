#!/usr/bin/env node
// Release automation: version lines (release/vX.Y, hotfix/vX.Y), rc and final tags, sync PRs,
// version-line cuts, the deploy gate and PR conventions. Rules: RELEASING.md.
//
//   node .github/scripts/release.mjs <command> [options] [--dry-run]
//
//   rc           --branch <line>                tag the line's head vX.Y.Z-rc.N (skips if already tagged)
//   sync         --branch <line>                open "chore(sync): merge A into B" into the next open line
//   final        --head <line> --sha <merge>    tag the merge commit vX.Y.Z and publish its GitHub release
//   cut-release  [--version vX.Y]               new release/vX.Y from the newest open release, or the default branch
//   cut-hotfix                                  hotfix/vX.Y from the final tag in prod
//   check-deploy --tag <tag> --env <env>        exit 1 unless <tag> may go to <env> (--prod-env, default "prod")
//   check-pr     --head <ref> --base <ref> --title <title> [--default-branch <ref>]
//
// Writes (tags, branches, PRs, releases) are only logged with --dry-run. --remote defaults to origin.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const TYPES = ["feat", "fix", "chore", "refactor", "perf", "docs", "test", "ci", "build", "revert"];
const LINE_RE = /^(release|hotfix)\/v(\d+)\.(\d+)$/;
const TAG_RE = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;
const BRANCH_RE = new RegExp(`^(${TYPES.join("|")})/[A-Za-z][A-Za-z0-9]*-\\d+-[a-z0-9][a-z0-9-]*$`);
const TITLE_RE = new RegExp(`^(${TYPES.join("|")})\\(([^()\\s]+)\\)!?: (.+)$`);
// GitHub's "Revert" button (RELEASING.md, procedure 2) names the branch and title itself.
const GITHUB_REVERT_BRANCH_RE = /^revert-\d+-.+$/;
const GITHUB_REVERT_TITLE_RE = /^Revert ".+"$/;

const [command, ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);
const dryRun = Boolean(opts["dry-run"]);
const remote = opts.remote || "origin";

class Failure extends Error {}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

function run(cmd, args, { allowFail = false } = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFail) return null;
    throw new Failure(`${cmd} ${args.join(" ")} failed:\n${error.stderr || error.message}`);
  }
}

const git = (...args) => run("git", args);
const gh = (...args) => run("gh", args);

function write(description, action) {
  if (dryRun) {
    log(`[dry-run] would ${description}`);
    return;
  }
  log(`${description}`);
  action();
}

function log(message) {
  console.log(message);
}

function summary(message) {
  log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}

function required(name) {
  if (!opts[name] || opts[name] === true) throw new Failure(`--${name} is required`);
  return opts[name];
}

// --- versions -------------------------------------------------------------------------------

function parseLine(branch) {
  const match = LINE_RE.exec(branch);
  if (!match) return null;
  return { branch, kind: match[1], major: Number(match[2]), minor: Number(match[3]) };
}

function parseTag(name) {
  const match = TAG_RE.exec(name);
  if (!match) return null;
  const [, major, minor, patch, rc] = match;
  return { name, major: +major, minor: +minor, patch: +patch, rc: rc === undefined ? null : +rc };
}

// Finals sort after their rcs: v1.2.0-rc.3 < v1.2.0.
function compareTags(a, b) {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    (a.rc ?? Infinity) - (b.rc ?? Infinity)
  );
}

const compareLines = (a, b) => a.major - b.major || a.minor - b.minor;
const versionName = (v) => `v${v.major}.${v.minor}.${v.patch}`;
const lineName = (v) => `v${v.major}.${v.minor}`;

function fetchRemote() {
  git("fetch", "--prune", "--tags", remote, `+refs/heads/*:refs/remotes/${remote}/*`);
}

function releaseTags() {
  return git("tag", "--list", "v*")
    .split("\n")
    .map(parseTag)
    .filter(Boolean)
    .sort(compareTags);
}

function remoteLines() {
  const prefix = `refs/remotes/${remote}/`;
  return git("for-each-ref", "--format=%(refname)", prefix)
    .split("\n")
    .filter(Boolean)
    .map((ref) => parseLine(ref.slice(prefix.length)))
    .filter(Boolean)
    .sort(compareLines);
}

const finals = (tags) => tags.filter((t) => t.rc === null);
const sameLine = (a, b) => a.major === b.major && a.minor === b.minor;

// Patch is .0 until the line ships, then last shipped + 1.
function lineVersion(line, tags) {
  const shipped = finals(tags).filter((t) => sameLine(t, line));
  const patch = shipped.length ? shipped[shipped.length - 1].patch + 1 : 0;
  return { major: line.major, minor: line.minor, patch };
}

function latestRc(version, tags) {
  const rcs = tags.filter((t) => t.rc !== null && sameLine(t, version) && t.patch === version.patch);
  return rcs[rcs.length - 1] || null;
}

// A release line is open until any vX.Y.* final exists; hotfix lines are never "open releases".
function openReleases(lines, tags) {
  return lines.filter((l) => l.kind === "release" && !finals(tags).some((t) => sameLine(t, l)));
}

const tagsAt = (sha) => git("tag", "--points-at", sha).split("\n").map(parseTag).filter(Boolean);
const commitOf = (ref) => git("rev-parse", `${ref}^{commit}`);
const treeOf = (ref) => git("rev-parse", `${ref}^{tree}`);
const isAncestor = (a, b) => run("git", ["merge-base", "--is-ancestor", a, b], { allowFail: true }) !== null;
const remoteRef = (branch) => `refs/remotes/${remote}/${branch}`;
const branchExists = (branch) => run("git", ["rev-parse", "--verify", "--quiet", remoteRef(branch)], { allowFail: true }) !== null;

function lineFrom(branch) {
  const line = parseLine(branch || "");
  if (!line) throw new Failure(`"${branch}" is not a version line (release/vX.Y or hotfix/vX.Y)`);
  return line;
}

function createTag(name, sha, message) {
  write(`tag ${name} at ${sha.slice(0, 7)} and push it`, () => {
    git("tag", "--annotate", name, sha, "--message", message);
    git("push", remote, `refs/tags/${name}`);
  });
}

function defaultBranch() {
  if (opts["default-branch"] && opts["default-branch"] !== true) return opts["default-branch"];
  if (process.env.DEFAULT_BRANCH) return process.env.DEFAULT_BRANCH;
  const head = run("git", ["symbolic-ref", "--short", `refs/remotes/${remote}/HEAD`], { allowFail: true });
  if (!head) throw new Failure("cannot tell the default branch; pass --default-branch");
  return head.slice(remote.length + 1);
}

// --- commands -------------------------------------------------------------------------------

function rc() {
  const line = lineFrom(opts.branch || process.env.GITHUB_REF_NAME);
  fetchRemote();
  const tags = releaseTags();
  const head = commitOf(remoteRef(line.branch));
  const version = lineVersion(line, tags);
  const last = latestRc(version, tags);

  const tagged = tagsAt(head);
  if (tagged.length) {
    summary(`${line.branch} head ${head.slice(0, 7)} is already ${tagged.map((t) => t.name).join(", ")}; no new rc.`);
    return;
  }
  const name = `${versionName(version)}-rc.${last ? last.rc + 1 : 1}`;
  createTag(name, head, `Release candidate ${name} from ${line.branch}`);
  summary(`${dryRun ? "Would tag" : "Tagged"} ${name} on ${line.branch} (${head.slice(0, 7)}).`);
}

function sync() {
  const source = lineFrom(opts.branch || process.env.GITHUB_REF_NAME);
  fetchRemote();
  const tags = releaseTags();
  const open = openReleases(remoteLines(), tags);
  const target =
    source.kind === "hotfix" ? open[0] : open.find((l) => compareLines(l, source) > 0);

  if (!target) {
    summary(`No open release after ${source.branch}; nothing to sync.`);
    return;
  }
  if (isAncestor(remoteRef(source.branch), remoteRef(target.branch))) {
    summary(`${target.branch} already contains ${source.branch}; nothing to sync.`);
    return;
  }
  const title = `chore(sync): merge ${source.branch} into ${target.branch}`;
  if (dryRun) {
    log(`[dry-run] would open "${title}" unless an open PR ${source.branch} -> ${target.branch} exists`);
    return;
  }
  const existing = gh("pr", "list", "--head", source.branch, "--base", target.branch, "--state", "open", "--json", "url", "--jq", ".[0].url");
  if (existing) {
    summary(`Sync PR already open: ${existing}`);
    return;
  }
  const body = [
    `Automatic sync: carries what landed on \`${source.branch}\` into \`${target.branch}\`.`,
    "",
    "Merge with a **merge commit**. On conflicts, resolve them on a branch cut from the target, never on the source.",
  ].join("\n");
  const url = gh("pr", "create", "--head", source.branch, "--base", target.branch, "--title", title, "--body", body);
  summary(`Opened ${url}`);
}

function final() {
  const line = lineFrom(required("head"));
  const sha = required("sha");
  fetchRemote();
  const tags = releaseTags();
  // A re-run after the tag was pushed only finishes the GitHub release.
  const alreadyFinal = tagsAt(sha).find((t) => t.rc === null);
  if (alreadyFinal) {
    log(`${sha.slice(0, 7)} is already ${alreadyFinal.name}.`);
    publishRelease(alreadyFinal, tags);
    return;
  }
  const version = lineVersion(line, tags);
  const name = versionName(version);
  const last = latestRc(version, tags);

  if (!last) throw new Failure(`${line.branch} has no ${name}-rc.N: nothing tested to ship.`);
  if (treeOf(sha) !== treeOf(last.name)) {
    throw new Failure(
      `The merge commit ${sha.slice(0, 7)} differs from ${last.name}, so ${name} would ship untested code.\n` +
        `Either the default branch has changes the line lacks, or the line moved after its last rc.\n` +
        `Bring the line up to date, let it tag a new rc, test it, then ship again.`,
    );
  }

  createTag(name, sha, `Release ${name} (from ${line.branch}, same code as ${last.name})`);
  publishRelease({ ...version, name, rc: null }, tags);
  summary(`${dryRun ? "Would ship" : "Shipped"} ${name}: same tree as ${last.name}.`);
}

function publishRelease(tag, tags) {
  if (!dryRun && run("gh", ["release", "view", tag.name, "--json", "url"], { allowFail: true }) !== null) {
    summary(`GitHub release ${tag.name} already exists.`);
    return;
  }
  const shipped = finals(tags).filter((t) => t.name !== tag.name);
  const previous = shipped.filter((t) => compareTags(t, tag) < 0).pop();
  const isLatest = !shipped.some((t) => compareTags(t, tag) > 0);
  const args = ["release", "create", tag.name, "--verify-tag", "--title", tag.name, "--generate-notes", `--latest=${isLatest}`];
  if (previous) args.push("--notes-start-tag", previous.name);
  write(`publish the GitHub release ${tag.name}${previous ? ` (notes since ${previous.name})` : ""}`, () => gh(...args));
}

function cutRelease() {
  fetchRemote();
  const tags = releaseTags();
  const lines = remoteLines();
  const open = openReleases(lines, tags);
  const newestOpen = open[open.length - 1];
  const base = newestOpen ? newestOpen.branch : defaultBranch();

  let next;
  if (opts.version && opts.version !== true) {
    const match = /^v?(\d+)\.(\d+)$/.exec(opts.version);
    if (!match) throw new Failure(`--version must look like v1.2, got "${opts.version}"`);
    next = { major: +match[1], minor: +match[2] };
  } else if (newestOpen) {
    next = { major: newestOpen.major, minor: newestOpen.minor + 1 };
  } else {
    const latest = finals(tags).pop();
    next = latest ? { major: latest.major, minor: latest.minor + 1 } : { major: 0, minor: 1 };
  }

  const taken = [...lines, ...tags].filter((v) => compareLines(v, next) >= 0);
  if (taken.length) {
    throw new Failure(`${lineName(next)} is not newer than every line and tag (${taken.map((v) => v.branch || v.name).join(", ")}).`);
  }

  const branch = `release/${lineName(next)}`;
  const sha = commitOf(remoteRef(base));
  write(`create ${branch} from ${base} (${sha.slice(0, 7)})`, () => git("push", remote, `${sha}:refs/heads/${branch}`));
  summary(`${dryRun ? "Would cut" : "Cut"} ${branch} from ${base}.`);
}

function cutHotfix() {
  fetchRemote();
  const prod = finals(releaseTags()).pop();
  if (!prod) throw new Failure("No final tag yet: nothing in prod to hotfix.");
  const branch = `hotfix/${lineName(prod)}`;
  const sha = commitOf(prod.name);

  if (branchExists(branch)) {
    if (isAncestor(remoteRef(branch), sha)) {
      summary(`${branch} exists and holds nothing beyond ${prod.name}: reuse it, PR fixes into it.`);
      return;
    }
    throw new Failure(`${branch} is already open with unshipped commits: finish or revert them first.`);
  }
  write(`create ${branch} from ${prod.name} (${sha.slice(0, 7)})`, () => git("push", remote, `${sha}:refs/heads/${branch}`));
  summary(`${dryRun ? "Would cut" : "Cut"} ${branch} from ${prod.name}.`);
}

function checkDeploy() {
  const name = required("tag");
  const env = required("env");
  const prodEnv = opts["prod-env"] && opts["prod-env"] !== true ? opts["prod-env"] : "prod";
  const tag = parseTag(name);
  if (!tag) throw new Failure(`"${name}" is not a release tag (vX.Y.Z or vX.Y.Z-rc.N); never deploy a branch name.`);
  fetchRemote();
  const tags = releaseTags();
  if (!tags.some((t) => t.name === name)) throw new Failure(`Tag ${name} does not exist on ${remote}.`);

  if (env !== prodEnv) {
    summary(`OK: ${name} may go to ${env}.`);
    return;
  }
  if (tag.rc !== null) throw new Failure(`${name} is a release candidate; ${prodEnv} takes only a final vX.Y.Z.`);
  const last = latestRc(tag, tags);
  if (!last) throw new Failure(`${name} has no rc, so its code was never tested; it cannot go to ${prodEnv}.`);
  if (treeOf(name) !== treeOf(last.name)) throw new Failure(`${name} differs from its last rc ${last.name}; it cannot go to ${prodEnv}.`);
  summary(`OK: ${name} may go to ${prodEnv} (same tree as ${last.name}). Only on release day.`);
}

function checkPr() {
  const head = required("head");
  const base = required("base");
  const title = required("title");
  const main = defaultBranch();
  const problems = [];

  const headLine = parseLine(head);
  const githubRevert = GITHUB_REVERT_BRANCH_RE.test(head) && GITHUB_REVERT_TITLE_RE.test(title);

  if (!headLine && !BRANCH_RE.test(head) && !githubRevert) {
    problems.push(`Branch "${head}" must be <type>/<TICKET>-short-name, types: ${TYPES.join(", ")}.`);
  }

  const parts = TITLE_RE.exec(title);
  if (!parts && !githubRevert) {
    problems.push(`Title "${title}" must be type(TICKET): summary, types: ${TYPES.join(", ")}.`);
  } else if (parts && (/^[A-Z]/.test(parts[3]) || /\.$/.test(parts[3]))) {
    problems.push(`Title summary "${parts[3]}" must start lowercase and not end with a period.`);
  }

  if (base === main && !headLine) {
    problems.push(`Only release/vX.Y and hotfix/vX.Y merge into ${main}; "${head}" must target an open release.`);
  }

  if (problems.length) throw new Failure(problems.join("\n"));
  summary(`OK: ${head} -> ${base}, "${title}".`);
}

const commands = {
  rc,
  sync,
  final,
  "cut-release": cutRelease,
  "cut-hotfix": cutHotfix,
  "check-deploy": checkDeploy,
  "check-pr": checkPr,
};

try {
  if (!commands[command]) throw new Failure(`Unknown command "${command}". Commands: ${Object.keys(commands).join(", ")}.`);
  commands[command]();
} catch (error) {
  if (!(error instanceof Failure)) throw error;
  if (process.env.GITHUB_ACTIONS) console.error(`::error::${error.message.split("\n").join("%0A")}`);
  else console.error(error.message);
  process.exit(1);
}
