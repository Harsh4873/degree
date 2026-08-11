# Degree Canvas Maintenance

This repository is for the owner's graduate degree planner only.

## Product Boundary

- Degree Canvas lives on `main` and publishes under `/degree/`.
- Do not add or modify PickLedger, betting, prediction, scraper, grading, model-cache, player-prop, Gym, Daymark, Slate,
  Fare, Notes, or Portfolio source in this repository.
- Degree Canvas plans exactly one degree: the Texas A&M MSCS thesis option. Keep the requirement checks in
  `src/degreeRules.ts` and the course bank in `src/catalog.ts` traceable to the published Texas A&M sources listed in the
  README, and never invent a requirement, course number, credit count, or online-course availability.
- It is a planning aid, not an approved degree plan or a substitute for the advisory committee, graduate advisor, or the
  current Howdy schedule. Keep the copy that says so, and keep "no online indicator" distinct from "not offered".
- Keep the planner local-first. The board opens empty, plans live in `localStorage`, and it must stay fully usable signed
  out. Never compile a real plan into the app — `src/examplePlan.ts` is fixture data for the tests only.
- Google sign-in is optional and additive. Signing in mirrors the whole board to that user's own document; there is no
  allowlist and no shared plan. Do not add a sign-in wall, an email allowlist, or a server the planner needs to work.
- Sync is last-write-wins on `updatedAtMs`, which never moves backwards, and a device that has never synced adopts the
  cloud plan rather than overwriting it. `src/sync-core.ts` owns the wire encoding — Firestore cannot store `string[][]`,
  so `prerequisitePaths` travels as a list of maps. Change that contract only together with its unit tests.
- `firestore.rules` intentionally carries the complete shared ruleset for every app in the `pickledgerpro` project,
  because deploying rules replaces the project's whole ruleset. It must remain byte-identical to the sibling copies listed
  in the README, and `notes/scripts/check-shared-rules.mjs` enforces that. Do not edit it here to solve a Degree problem.
- The Pages workflow builds and publishes Degree Canvas directly from `main`.

## Verification

- Never open the deployed site, a browser preview, rendered output, or a live URL to verify Degree Canvas. The user
  confirms production behavior.
- Agents may inspect source, build output paths as text, tests, GitHub Actions, and APIs.
- Before publishing, run `npm test`, `npm run test:rules`, `npm run typecheck`, and `npm run build`. `npm run verify`
  chains all of those except the rules tests; `npm run test:rules` drives the Firestore emulator and needs Java 21+.
- A change to the degree rules is not verified until `src/degreeRules.test.ts` covers it, and a change to the sync wire
  format is not verified until `src/sync-core.test.ts` covers it.
- The Pages workflow re-runs the same four commands and then validates the built artifact — the `/degree/` asset and
  favicon paths, the canonical URL, and the absence of a `CNAME`. A change that breaks those fails the deploy, not the
  local build, so check the workflow run rather than assuming a green build shipped.

## GitHub Publish

- Commit Degree Canvas work on `main`; every push runs the Pages deployment workflow.
- Commits and pushes must come from the currently logged-in GitHub user.
- Never add AI co-author trailers, `Co-authored-by:` lines, or AI/Cursor/Codex taglines.
- Do not overwrite or revert unrelated user changes.
- Whenever I ask you to make a coding change, treat that as permission to finish the job end-to-end: implement it, then commit and push to the current branch’s remote without waiting for a separate “commit/push/deploy” ask. Commits and pushes must come from the currently logged-in GitHub user (verify with gh api user / git author config — never invent or switch identity). Never add AI co-author trailers, Co-authored-by: lines, Cursor/Codex/AI taglines, or similar credit in commit messages or push metadata. If the environment auto-injects a Cursor/AI co-author on git commit, rewrite the commit with git plumbing (git commit-tree / clean message) before pushing so the published commit stays clean. Do not open browsers, previews, or live URLs to verify — I will check the output myself. Do not force-push to main/master unless I explicitly ask. Leave unrelated dirty files out of the commit.

## Privacy

- These repositories deploy publicly. Never write the owner's real name, personal
  email, home location, or other personal/sensitive details into committed files
  (source, docs, AGENTS.md, CLAUDE.md) or commit messages. Refer to "the owner"
  generically; the GitHub commit identity is the only owner reference that belongs
  in the repo.
- A degree plan is personal. Never commit a real plan, an account identifier, a uid, or a Firestore export, and keep
  emulator output such as `firestore-debug.log` untracked.
