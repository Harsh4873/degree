import { generatedCsceCourses, type GeneratedCatalogCourse } from './generated/csceCatalog';
import { breadthOverrides, defaultCreditOverrides, handKeptCourses, kindOverrides, planningNoteOverrides } from './catalogOverrides';
import { isExcludedCode } from './degreeRules';
import type { CourseTemplate, PlannedCourse, Planner } from './types';

export const officialSources = [
  {
    label: 'MSCS degree requirements',
    href: 'https://engineering.tamu.edu/cse/academics/degrees/graduate/ms-cs.html',
  },
  {
    label: 'CSCE graduate catalog',
    href: 'https://catalog.tamu.edu/graduate/course-descriptions/csce/',
  },
  {
    label: 'Engineering Online course listings',
    href: 'https://engineering.tamu.edu/engineering-online/courses.html',
  },
  {
    label: 'ISSS distance and full-time enrollment',
    href: 'https://global.tamu.edu/isss/students/maintaining-status-students/index1.html',
  },
] as const;

export const courseIdForCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, '-');

const EXCLUDED_NOTE = 'The MSCS department lists this course among those that cannot be used on any degree plan.';

function defaultCreditsFor(course: GeneratedCatalogCourse) {
  const preferred = defaultCreditOverrides[course.code] ?? 3;
  return Math.min(Math.max(preferred, course.minCredits), course.maxCredits);
}

function fromGenerated(course: GeneratedCatalogCourse): CourseTemplate {
  const crossNote = course.crossListings?.length ? ` Cross-listed with ${course.crossListings.join(' and ')}.` : '';
  const planningNote = planningNoteOverrides[course.code] ?? (isExcludedCode(course.code) ? EXCLUDED_NOTE : undefined);

  return {
    id: courseIdForCode(course.code),
    code: course.code,
    title: course.title,
    defaultCredits: defaultCreditsFor(course),
    minCredits: course.minCredits,
    maxCredits: course.maxCredits,
    kind: 'csce-graded',
    description: `${course.description}${crossNote}`.trim(),
    ...(course.prerequisiteText ? { prerequisiteText: course.prerequisiteText } : {}),
    ...(planningNote ? { planningNote } : {}),
    source: 'official',
  };
}

function applyOverrides(course: CourseTemplate): CourseTemplate {
  const next: CourseTemplate = { ...course, kind: kindOverrides[course.code] ?? course.kind };
  const breadth = breadthOverrides[course.code];
  if (breadth) {
    next.breadth = breadth;
  } else {
    delete next.breadth;
  }
  return next;
}

function buildCatalog(): CourseTemplate[] {
  const handKeptById = new Map(handKeptCourses.map((course) => [course.id, course]));
  const merged = new Map<string, CourseTemplate>();

  for (const generated of generatedCsceCourses) {
    const base = fromGenerated(generated);
    const handKept = handKeptById.get(base.id);
    merged.set(base.id, applyOverrides(handKept ? { ...base, ...handKept } : base));
  }

  for (const handKept of handKeptCourses) {
    if (!merged.has(handKept.id)) {
      merged.set(handKept.id, applyOverrides(handKept));
    }
  }

  const all = [...merged.values()];
  const csce = all.filter((course) => course.code.startsWith('CSCE ')).sort((a, b) => a.code.localeCompare(b.code));
  const others = all.filter((course) => !course.code.startsWith('CSCE '));
  return [...csce, ...others];
}

/** Course bank: every CSCE 600/700 course from the graduate catalog, merged with the hand-kept entries. */
export const catalogCourses: CourseTemplate[] = buildCatalog();

let nextInstance = 0;

const makeInstanceId = () => {
  nextInstance += 1;
  return `course-${Date.now().toString(36)}-${nextInstance}`;
};

export function catalogCourseById(id: string) {
  return catalogCourses.find((course) => course.id === id);
}

export function cloneCourse(template: CourseTemplate, credits = template.defaultCredits): PlannedCourse {
  return {
    ...template,
    instanceId: makeInstanceId(),
    credits,
    delivery: template.deliveryChoices?.includes('in-person') ? 'in-person' : undefined,
  };
}

export type Spring2027Check = {
  code: string;
  verdict: string;
  degreeRole: string;
  eligibility: string;
  sections: string;
  assessments: string;
  grades: string;
  ratings: string;
  links: readonly { label: string; href: string }[];
};

/**
 * Spring 2027 elective check for the on-campus MSCS thesis plan.
 * Howdy rows are the class-search snapshot reviewed 30 Sep 2026. Anex and
 * Rate My Professors are labeled as outside the degree rules.
 */
export const spring2027Checks: readonly Spring2027Check[] = [
  {
    code: 'ECEN 766',
    verdict: 'First choice when the spring term can hold only one elective beside CSCE 691.',
    degreeRole: 'Non-CSCE graded graduate course. It uses the 6-hour outside-department cap and still needs advisor approval on the degree plan. It is not one of the excluded ECEN courses (714 and 749). It does not count toward the 18 graded CSCE hours. The instructor’s CSE affiliation does not change the ECEN prefix.',
    eligibility: 'Catalog prerequisite: graduate classification, plus basic algorithms and programming. No biomolecular background is required. The Spring 2027 face-to-face section restriction is graduate level only.',
    sections: 'Face-to-face CRN 38473, section 600, Tuesday and Thursday 9:35am to 10:50am, ETB 1003, 19 Jan 2027 to 11 May 2027, 30 seats open. Web CRN 62185, section 700, 10 seats open. Howdy marks that web section as distance and prints the F-1 warning.',
    assessments: 'Spring 2024 syllabus (Yang Shen): homework 45%, one journal-club presentation 10%, final project 45% (proposal 10%, progress update 10%, report and presentation 25%). No exam is in those weights. The syllabus uses the word “exams” once in boilerplate and does not schedule one. The Spring 2027 Howdy syllabus link was not opened, so the new section can change this.',
    grades: 'Anex, Shen, section 600 only: 94 graded students, combined GPA 3.90 (85 A, 9 B, no C, D, or F). Fall 2018 and Spring 2020 and Spring 2024 were 4.00. Spring 2025 was 3.81. Spring 2026 was 3.83. Anex has no section 700.',
    ratings: 'Rate My Professors: 4.9 out of 5, 15 ratings, 100% would take again, difficulty 2.9. The visible reviews are ECEN 314 and ECEN 303, not 766.',
    links: [
      { label: 'Spring 2024 syllabus', href: 'https://shen-lab.github.io/ECEN766-Syllabus-SP2024-Jan16.pdf' },
      { label: 'Graduate catalog', href: 'https://catalog.tamu.edu/graduate/course-descriptions/ecen/' },
      { label: 'Anex', href: 'https://anex.us/grades/' },
      { label: 'Rate My Professors', href: 'https://www.ratemyprofessors.com/professor/2260405' },
    ],
  },
  {
    code: 'CSCE 676',
    verdict: 'Second choice. Take the face-to-face section with 766 when 8:00am Monday, Wednesday, and Friday works.',
    degreeRole: 'Graded CSCE elective. It counts toward the 18 and is not a breadth course. Software breadth is 604, 606, 634, 655, 656, 670, 671, 672, and 713. Register CSCE 676 if these hours need to count as CSCE. ECEN 758 and STAT 639 are the same catalog course under outside-department numbers, and Anex shows those sections with other instructors.',
    eligibility: 'The graduate catalog lists no course prerequisite. Spring 2027 face-to-face restriction: graduate classification, and not a distance-program code (distance MCS, MEN, MS, or PhD). An on-campus thesis MSCS is not one of those codes. The web section requires graduate classification and is distance for F-1 purposes.',
    sections: 'Face-to-face CRN 58440, section 600, Monday, Wednesday, and Friday 8:00am to 8:50am, HRBB 113, 20 Jan 2027 to 10 May 2027, 100 seats open. Web CRN 59910, section 700, 19 Jan 2027 to 11 May 2027, 50 seats open. Those face-to-face times do not overlap 766 or 672. Howdy marks the web section as distance and prints the F-1 warning.',
    assessments: 'No public Caverlee syllabus for this Spring 2027 section was found. A 24 Dec 2025 Rate My Professors review of his CSCE 676 describes exams with extra credit, medium homework with extra credit, and one group project, with attendance mandatory. Do not use the Spring 2022 STAT 639 syllabus (midterm 40%, project 60%, R): Anex lists that cross-list under other instructors, including Yang Ni.',
    grades: 'Anex, Caverlee: 433 graded students, combined GPA 3.85. Spring 2026 face-to-face section 600 was 3.91 (67 A, 7 B). Spring 2026 web section 700 was 3.65 (32 A, 8 B, 2 C, 1 D).',
    ratings: 'Rate My Professors: 4.7 out of 5, 12 ratings, 100% would take again, difficulty 2.7. One of those ratings is CSCE 676. The rest shown are mostly CSCE 670.',
    links: [
      { label: 'Graduate catalog', href: 'https://catalog.tamu.edu/graduate/course-descriptions/csce/' },
      { label: 'Anex', href: 'https://anex.us/grades/' },
      { label: 'Rate My Professors', href: 'https://www.ratemyprofessors.com/professor/1728542' },
    ],
  },
  {
    code: 'CSCE 672',
    verdict: 'Eligible, and still the one to skip for a data-mining and structural-bioinformatics term.',
    degreeRole: 'Graded CSCE, and it is a software breadth course if passed with a B or better. It fills a new breadth hole only when CSCE 671 (or another software breadth course) is not already passed with a B or better. CSCE 691 stays research either way: 3 to 6 credits count, and it is not an elective.',
    eligibility: 'Catalog prerequisite: CSCE 671 or CSCE 610, or instructor approval. Graduate prerequisites do not block registration; preparation is still the student’s responsibility. Spring 2027 restriction: computer science, computer engineering, cybersecurity, or data science; graduate level; not a distance-program code.',
    sections: 'Face-to-face only. CRN 58439, section 600, Tuesday and Thursday 3:55pm to 5:10pm, THOM 122, 19 Jan 2027 to 11 May 2027, 40 seats open. No web section was on the Howdy snapshot. The time does not overlap 766 or 676.',
    assessments: 'Spring 2026 course page (Frank Shipman): homework 10%, team project 35%, reading write-ups 35%, reading presentations 10%, attendance 10%. No exam. The page says Spring 2026 will be paper discussions and a team interface project. Shipman’s own Spring 2027 teaching note still lists CSCE 672.',
    grades: 'Anex, Shipman: 80 graded students across Fall 2016, Spring 2019, Fall 2022, and Spring 2026, all A, GPA 4.00.',
    ratings: 'Rate My Professors: 5.0 out of 5, 4 ratings, 100% would take again, difficulty 1.5. None of the four reviews is CSCE 672. They are CSCE 445, 679, and 477.',
    links: [
      { label: 'Spring 2026 course page', href: 'https://people.engr.tamu.edu/shipman/courses/cpsc672/home.html' },
      { label: 'Graduate catalog', href: 'https://catalog.tamu.edu/graduate/course-descriptions/csce/' },
      { label: 'Anex', href: 'https://anex.us/grades/' },
      { label: 'Rate My Professors', href: 'https://www.ratemyprofessors.com/professor/1473777' },
    ],
  },
];

function course(id: string, credits?: number) {
  const template = catalogCourseById(id);

  if (!template) {
    throw new Error(`Unknown catalog course: ${id}`);
  }

  return cloneCourse(template, credits);
}

type SeasonName = 'Spring' | 'Summer' | 'Fall';

const SEASON_ORDER: SeasonName[] = ['Spring', 'Summer', 'Fall'];

function currentSeasonIndex(month: number) {
  if (month <= 4) return 0; // January–May
  if (month <= 6) return 1; // June–July
  return 2; // August–December
}

/**
 * Term labels for a plan that starts now: the term already under way, then the
 * ones after it. Derived from the clock so a first visit is never anchored to
 * somebody else's calendar.
 */
export function upcomingTermNames(now: Date, count: number): string[] {
  const names: string[] = [];
  let year = now.getFullYear();
  let index = currentSeasonIndex(now.getMonth());

  for (let step = 0; step < count; step += 1) {
    names.push(`${SEASON_ORDER[index]} ${year}`);
    index += 1;
    if (index === SEASON_ORDER.length) {
      index = 0;
      year += 1;
    }
  }

  return names;
}

/**
 * The board a brand-new visitor gets: empty terms and no assumptions ticked.
 * Anyone's saved plan is restored from their own browser or their signed-in
 * account before this is ever called.
 */
export function createSeedPlanner(now = new Date()): Planner {
  return {
    completedBreadth: {
      theory: false,
      systems: false,
      software: false,
    },
    terms: upcomingTermNames(now, 4).map((name) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      courses: [],
    })),
  };
}
