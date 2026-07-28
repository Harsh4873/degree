# Degree Canvas

An editable, local-first degree planning canvas published at `https://harsh.bet/degree/`. It is tailored to Texas A&M University's Master of Science in Computer Science (MSCS) thesis degree.

## What it models

- An editable six-term starting plan: Fall 2026 through Summer 2028.
- Drag-and-drop placement from a catalog-backed course bank covering every published Theory, Systems, and Software breadth option, plus custom courses and editable course credits.
- Live checks for the MSCS degree-plan minimums, breadth areas, seminar, research, directed-study, non-CSCE graduate course, and 400-level course limits.
- Catalog prerequisite preparation alerts and a verified Fall 2026 online-course indicator. A missing indicator does **not** mean a course is unavailable.
- Browser-local persistence with a reset to the supplied starting plan.

The initial plan deliberately follows the requested 3-credit Fall/Spring and 6-credit Summer CSCE 691 reserve. The app flags that reserve because the published MSCS degree plan permits only 3–6 total CSCE 691 credits and no more than 7 combined CSCE 685 + 691 credits. The system breadth requirement starts marked as complete, as an editable planning assumption.

## Official sources

All embedded degree rules and catalog course names are limited to Texas A&M sources, checked July 28, 2026:

- [MSCS degree requirements](https://engineering.tamu.edu/cse/academics/degrees/graduate/ms-cs.html)
- [CSCE graduate catalog](https://catalog.tamu.edu/graduate/course-descriptions/csce/)
- [Engineering Online course listings](https://engineering.tamu.edu/engineering-online/courses.html)

This is a planning aid, not an approved degree plan or a substitute for the student's advisory committee, graduate advisor, or the current Howdy schedule.

## Development

```sh
npm ci
npm run verify
```

The GitHub Pages workflow deploys the built Vite app from `main` under the `/degree/` base path.
