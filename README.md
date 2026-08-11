# Degree Canvas

An editable, local-first degree planning canvas published at `https://harsh.bet/degree/`. It is tailored to Texas A&M University's Master of Science in Computer Science (MSCS) thesis degree.

## What it models

- An editable six-term starting plan: Fall 2026 through Summer 2028, with two courses in each fall and spring, research-only summers, and CSCE 671 + CSCE 627 in the first term.
- Drag-and-drop placement from a catalog-backed course bank covering every published Theory, Systems, and Software breadth option, plus custom courses and editable course credits.
- Verified non-CSCE elective options (STAT 601/616/630, MATH 640, ECEN 649) for the six-hour outside-department slot.
- Live checks for the MSCS degree-plan minimums, breadth areas, seminar, research, directed-study, non-CSCE graduate course, and 400-level course limits.
- Catalog prerequisite preparation alerts and a verified Fall 2026 online-course indicator. A missing indicator does **not** mean a course is unavailable.
- Browser-local persistence with a reset to the supplied starting plan.
- Optional Google sign-in that mirrors the plan across devices; the planner is fully usable signed out.
- Light and dark themes with a header toggle; the first visit follows the system preference.

The initial plan follows the requested CSCE 691 reserve: 3 credits in each fall and spring and 6 credits in each summer. Per the published degree plan and the student's advisor guidance, only 3–6 CSCE 691 credits count toward the 30-hour requirement, so the planner counts at most 6 research credits (and at most 7 combined CSCE 685 + 691 credits) while leaving total research enrollment unlimited — extra hours simply do not count. The system breadth requirement starts marked as complete, as an editable planning assumption.

## Official sources

All embedded degree rules and catalog course names are limited to Texas A&M sources, checked July 28, 2026:

- [MSCS degree requirements](https://engineering.tamu.edu/cse/academics/degrees/graduate/ms-cs.html)
- [CSCE graduate catalog](https://catalog.tamu.edu/graduate/course-descriptions/csce/)
- [Engineering Online course listings](https://engineering.tamu.edu/engineering-online/courses.html)

This is a planning aid, not an approved degree plan or a substitute for the student's advisory committee, graduate advisor, or the current Howdy schedule.

## Sync

Sign-in is optional. Signed out, the plan lives in `localStorage` exactly as before. Signing in
with a verified Google account mirrors it to `degree_users/{uid}` in the shared `pickledgerpro`
Firebase project, under a named Firebase app so the session stays separate from the other
harsh.bet tools on the same origin. There is no email allowlist: every verified Google account
gets its own isolated plan.

The whole board travels as one document, resolved last-write-wins on `updatedAtMs`, which the
security rules forbid from moving backwards. A device that has never synced adopts the cloud plan
rather than overwriting it. `prerequisitePaths` is a `string[][]`, which Firestore cannot store, so
it is encoded as a list of maps on the wire and decoded on the way back — `src/sync-core.ts` owns
that contract and is covered by unit tests.

`firestore.rules` holds the **entire** shared ruleset for every app in the `pickledgerpro`
project, because deploying rules replaces the project's whole ruleset. It must stay byte-identical
to the copies in Gym, Daymark, Slate, Fare, Notes, and Research; `notes/scripts/check-shared-rules.mjs`
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
