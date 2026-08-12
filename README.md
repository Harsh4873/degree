# Degree Canvas

An editable, local-first degree planning canvas published at `https://harsh.bet/degree/`. It is tailored to Texas A&M University's Master of Science in Computer Science (MSCS) thesis degree.

## What it models

- An empty starting board: four upcoming terms named from today's date, with no courses placed and no breadth assumptions ticked. Terms are renameable and you can add or remove them.
- Drag-and-drop placement from a catalog-backed course bank covering every published Theory, Systems, and Software breadth option, plus custom courses and editable course credits.
- Verified non-CSCE elective options (STAT 601/616/630, MATH 640, ECEN 649) for the six-hour outside-department slot.
- Live checks for the MSCS degree-plan minimums, breadth areas, seminar, research, directed-study, non-CSCE graduate course, and 400-level course limits.
- Catalog prerequisite preparation alerts and a verified Fall 2026 online-course indicator. A missing indicator does **not** mean a course is unavailable.
- Browser-local persistence with a reset back to the empty board.
- Optional Google sign-in that mirrors the plan across devices; the planner is fully usable signed out.
- Light and dark themes with a header toggle; the first visit follows the system preference.

Per the published degree plan and advisor guidance, only 3–6 CSCE 691 credits count toward the 30-hour requirement, so the planner counts at most 6 research credits (and at most 7 combined CSCE 685 + 691 credits) while leaving total research enrollment unlimited — extra hours simply do not count. Breadth areas already satisfied elsewhere are editable assumptions that add no credits; all three start unticked.

The board opens empty on purpose. Nobody else's plan is compiled into the app: your own plan is restored from this browser, or from your account once you sign in. `src/examplePlan.ts` holds a densely populated plan used only by the tests.

## Official sources

All embedded degree rules and catalog course names are limited to Texas A&M sources, checked July 28, 2026:

- [MSCS degree requirements](https://engineering.tamu.edu/cse/academics/degrees/graduate/ms-cs.html)
- [CSCE graduate catalog](https://catalog.tamu.edu/graduate/course-descriptions/csce/)
- [Engineering Online course listings](https://engineering.tamu.edu/engineering-online/courses.html)

This is a planning aid, not an approved degree plan or a substitute for the student's advisory committee, graduate advisor, or the current Howdy schedule.

## Sync

Sign-in is optional. Signed out, the plan lives in `localStorage` exactly as before. A verified,
provisioned Google session resolves through `owner_vault_members/{uid}` to the shared private
`degree_users/{vaultId}` document in the `pickledgerpro` Firebase project. The approved identities
therefore see the same plan and share the same Firebase session namespace as the other private
harsh.bet tools.

The whole board travels as one document, resolved last-write-wins on `updatedAtMs`, which the
security rules forbid from moving backwards. Sign-in is recovery-first: editing remains locked until
the existing nonempty cloud plan is validated and adopted, and a missing/malformed document triggers
an action-required state instead of uploading an empty board. `prerequisitePaths` is a `string[][]`, which Firestore cannot store, so
it is encoded as a list of maps on the wire and decoded on the way back — `src/sync-core.ts` owns
that contract and is covered by unit tests.

`firestore.rules` holds the **entire** shared ruleset for every app in the `pickledgerpro`
project, because deploying rules replaces the project's whole ruleset. It must stay byte-identical
to the copies in Gym, Daymark, Slate, Fare, Notes, Research, Studies, and Radar; `notes/scripts/check-shared-rules.mjs`
enforces that. After changing it, deploy from the canonical copy:

```sh
firebase deploy --only firestore:rules --project pickledgerpro
```

## Development

```sh
npm ci
npm run verify
npm run test:rules   # Firestore rules against the emulator; needs Java 21+
```

The GitHub Pages workflow deploys the built Vite app from `main` under the `/degree/` base path.
