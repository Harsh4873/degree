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

export const catalogCourses: CourseTemplate[] = [
  {
    id: 'csce-604',
    code: 'CSCE 604',
    title: 'Programming Languages',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Programming-language design, semantics, language processing, and paradigms.',
    prerequisiteText: 'Graduate classification.',
    source: 'official',
  },
  {
    id: 'csce-605',
    code: 'CSCE 605',
    title: 'Compiler Design',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'systems',
    description: 'Advanced compiler writing, data-flow analysis, and code optimization.',
    prerequisiteText: 'CSCE 434.',
    source: 'official',
  },
  {
    id: 'csce-606',
    code: 'CSCE 606',
    title: 'Software Engineering',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Advanced software-engineering concepts, environments, and methodologies.',
    prerequisiteText: 'CSCE 431 or approval of instructor.',
    onlineFall2026: true,
    source: 'official',
  },
  {
    id: 'csce-611',
    code: 'CSCE 611',
    title: 'Operating Systems',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'systems',
    description: 'Operating-systems concepts, design, construction, and resource allocation.',
    prerequisiteText: 'CSCE 313; graduate classification. Only one of CSCE 410 or CSCE 611 may satisfy a degree.',
    onlineFall2026: true,
    source: 'official',
  },
  {
    id: 'csce-612',
    code: 'CSCE 612',
    title: 'Applied Networks and Distributed Processing',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    description: 'Network design and protocol analysis, with layered architecture and programming exercises.',
    prerequisiteText: 'Graduate classification. Only one of CSCE 463 or CSCE 612 may satisfy a degree.',
    source: 'official',
  },
  {
    id: 'csce-613',
    code: 'CSCE 613',
    title: 'Advanced Operating Systems',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'systems',
    description: 'Operating-system algorithms for concurrency, scheduling, memory, and storage.',
    prerequisiteText: 'CSCE 410 or CSCE 611.',
    prerequisitePaths: [['CSCE 410'], ['CSCE 611']],
    source: 'official',
  },
  {
    id: 'csce-614',
    code: 'CSCE 614',
    title: 'Computer Architecture',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'systems',
    description: 'Parallel computer structures, pipelining and vectorization, array processors, multiprocessors, and dataflow computers.',
    prerequisiteText: 'CSCE 350/ECEN 350 or CSCE 312; undergraduate computer engineering or computer science background.',
    source: 'official',
  },
  {
    id: 'csce-625',
    code: 'CSCE 625',
    title: 'Artificial Intelligence',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    description: 'Foundations of AI, including search, reasoning, planning, uncertainty, and learning.',
    prerequisiteText: 'CSCE 411 or approval of instructor; graduate classification.',
    onlineFall2026: true,
    source: 'official',
  },
  {
    id: 'csce-627',
    code: 'CSCE 627',
    title: 'Theory of Computability',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'theory',
    description: 'Formal models of computation, unsolvability, and complexity.',
    prerequisiteText: 'CSCE 433.',
    source: 'official',
  },
  {
    id: 'csce-629',
    code: 'CSCE 629',
    title: 'Analysis of Algorithms',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'theory',
    description: 'Algorithm design and analysis, complexity, NP-completeness, and approximation.',
    prerequisiteText: 'Graduate classification.',
    onlineFall2026: true,
    source: 'official',
  },
  {
    id: 'csce-633',
    code: 'CSCE 633',
    title: 'Machine Learning',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    description: 'A survey of machine-learning techniques, including induction and clustering.',
    prerequisiteText: 'CSCE 420 or CSCE 625.',
    prerequisitePaths: [['CSCE 420'], ['CSCE 625']],
    onlineFall2026: true,
    source: 'official',
  },
  {
    id: 'csce-634',
    code: 'CSCE 634',
    title: 'Intelligent User Interfaces',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Intersection of AI and computer-human interaction; systems that learn about and adapt to their users, tasks, and environments.',
    prerequisiteText: 'Graduate classification and approval of instructor.',
    source: 'official',
  },
  {
    id: 'csce-637',
    code: 'CSCE 637',
    title: 'Complexity Theory',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    description: 'Computational complexity classes, reducibilities, and resources.',
    prerequisiteText: 'CSCE 627 or approval of instructor.',
    prerequisitePaths: [['CSCE 627']],
    source: 'official',
  },
  {
    id: 'csce-640',
    code: 'CSCE 640',
    title: 'Quantum Algorithms',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    description: 'Design and analysis of quantum algorithms and quantum-information processing.',
    prerequisiteText: 'CSCE 629 or approval of instructor.',
    prerequisitePaths: [['CSCE 629']],
    source: 'official',
  },
  {
    id: 'csce-655',
    code: 'CSCE 655',
    title: 'Human-Centered Computing',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Human-centered systems: interaction design, prototyping methodologies, evaluation frameworks, visual design, and information structuring.',
    prerequisiteText: 'Graduate classification or CSCE 436 or 444 or approval of instructor.',
    source: 'official',
  },
  {
    id: 'csce-656',
    code: 'CSCE 656',
    title: 'Computers and New Media',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Computers in the design of new media and the relationships between authors and readers of interactive materials.',
    prerequisiteText: 'Graduate classification.',
    source: 'official',
  },
  {
    id: 'csce-670',
    code: 'CSCE 670',
    title: 'Information Storage and Retrieval',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Storage and access for very large document collections; indexing, compression, querying, and retrieval-system evaluation.',
    prerequisiteText: 'CSCE 310 or CSCE 603 or approval of instructor; graduate classification.',
    source: 'official',
  },
  {
    id: 'csce-671',
    code: 'CSCE 671',
    title: 'Computer-Human Interaction',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Computer-human interaction: design theories, user and interface modeling, task analysis, and styles of interaction.',
    prerequisiteText: 'Graduate classification.',
    source: 'official',
  },
  {
    id: 'csce-672',
    code: 'CSCE 672',
    title: 'Computer Supported Collaborative Work',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Design, implementation, and use of technical systems that support people working cooperatively.',
    prerequisiteText: 'CSCE 671 or CSCE 610 or approval of instructor.',
    prerequisitePaths: [['CSCE 671'], ['CSCE 610']],
    planningNote: 'Software breadth if passed with a B or better. Spring 2027 Howdy shows a face-to-face section only.',
    source: 'official',
  },
  {
    id: 'csce-676',
    code: 'CSCE 676',
    title: 'Data Mining and Analysis',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    description: 'Broad overview of data mining, integrating related concepts from machine learning and statistics; exploratory data analysis, pattern mining, clustering and classification; applications to scientific and online data. Cross-listed with ECEN 758 and STAT 639.',
    prerequisiteText: 'No course prerequisite is published in the graduate catalog.',
    planningNote: 'Graded CSCE elective. Not a breadth course. Register the CSCE number if these hours need to count toward the 18. The ECEN 758 and STAT 639 cross-lists are outside-department numbers.',
    deliveryChoices: ['in-person', 'web'],
    source: 'official',
  },
  {
    id: 'csce-678',
    code: 'CSCE 678',
    title: 'Distributed Systems and Cloud Computing',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'systems',
    description: 'Distributed systems for cloud computing: MapReduce, synchronization, elections, distributed agreement, replication, and job assignment. Cross-listed with ECEN 757.',
    source: 'official',
  },
  {
    id: 'csce-681',
    code: 'CSCE 681',
    title: 'Seminar',
    defaultCredits: 1,
    minCredits: 0,
    maxCredits: 1,
    kind: 'seminar',
    description: 'Reports and discussion of current research and selected technical articles.',
    prerequisiteText: 'Graduate classification. The MSCS degree plan requires one credit hour.',
    onlineFall2026: true,
    source: 'official',
  },
  {
    id: 'csce-685',
    code: 'CSCE 685',
    title: 'Directed Studies',
    defaultCredits: 3,
    minCredits: 1,
    maxCredits: 12,
    kind: 'directed-study',
    description: 'Research problems of limited scope designed primarily to develop research technique.',
    prerequisiteText: 'The MSCS degree plan allows up to 3 credits; CSCE 685 + 691 may not exceed 7 credits.',
    source: 'official',
  },
  {
    id: 'csce-691',
    code: 'CSCE 691',
    title: 'Research',
    defaultCredits: 3,
    minCredits: 1,
    maxCredits: 23,
    kind: 'research',
    description: 'Research for thesis or dissertation.',
    prerequisiteText: 'Catalog range is 1–23 credits; the MSCS degree plan requires 3–6 total CSCE 691 credits.',
    source: 'official',
  },
  {
    id: 'csce-713',
    code: 'CSCE 713',
    title: 'Software Security',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    breadth: 'software',
    description: 'Secure software design and implementation, code review with static and dynamic analysis, risk analysis, and security testing.',
    prerequisiteText: 'CSCE 431 or CSCE 606 or approval of instructor; graduate classification.',
    prerequisitePaths: [['CSCE 606']],
    source: 'official',
  },
  {
    id: 'csce-735',
    code: 'CSCE 735',
    title: 'Parallel Computing',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'csce-graded',
    description: 'Parallel computing technology, programming methods, performance, algorithms, and applications.',
    prerequisiteText: 'Graduate classification or approval of instructor.',
    onlineFall2026: true,
    source: 'official',
  },
  {
    id: 'stat-601',
    code: 'STAT 601',
    title: 'Statistical Analysis',
    defaultCredits: 4,
    minCredits: 4,
    maxCredits: 4,
    kind: 'non-csce-grad',
    description: 'Probability, distributions, and statistical inference for engineering and science students; regression and analysis of variance.',
    prerequisiteText: 'MATH 152 or MATH 172.',
    source: 'official',
  },
  {
    id: 'stat-616',
    code: 'STAT 616',
    title: 'Statistical Aspects of Machine Learning I: Classical Multivariate Methods',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'non-csce-grad',
    description: 'Classical multivariate methods: multivariate normal models, regression, dimension reduction, discriminant and cluster analysis.',
    prerequisiteText: 'STAT 611, STAT 630, STAT 650, or equivalent.',
    prerequisitePaths: [['STAT 611'], ['STAT 630'], ['STAT 650']],
    source: 'official',
  },
  {
    id: 'stat-630',
    code: 'STAT 630',
    title: 'Overview of Mathematical Statistics',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'non-csce-grad',
    description: 'Probability theory, likelihood-based inference, confidence intervals, likelihood ratio tests, and Bayesian methods.',
    prerequisiteText: 'MATH 221, MATH 251, and MATH 253.',
    source: 'official',
  },
  {
    id: 'math-640',
    code: 'MATH 640',
    title: 'Linear Algebra for Applications',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'non-csce-grad',
    description: 'Spectral theory in inner product spaces, decomposition theorems, duality, multilinear algebra, and tensor products.',
    prerequisiteText: 'MATH 304 or equivalent.',
    source: 'official',
  },
  {
    id: 'ecen-649',
    code: 'ECEN 649',
    title: 'Pattern Recognition',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'non-csce-grad',
    description: 'Optimal and parametric classification, support vector machines, neural networks, error estimation, and Vapnik-Chervonenkis theory.',
    prerequisiteText: 'Graduate classification; undergraduate probability and Python programming; or approval of instructor.',
    source: 'official',
  },
  {
    id: 'ecen-766',
    code: 'ECEN 766',
    title: 'Algorithms in Structural Bioinformatics',
    defaultCredits: 3,
    minCredits: 3,
    maxCredits: 3,
    kind: 'non-csce-grad',
    description: 'Fundamental concepts, modeling techniques, and computational algorithms in structural bioinformatics for algorithm development and application; focus on algorithm perspective involving optimization and machine learning; essential for those without prior domain knowledge.',
    prerequisiteText: 'Graduate classification; basic knowledge in algorithms and programming; no prior knowledge in biomolecules or biomolecular systems required.',
    planningNote: 'Non-CSCE graduate elective. Counts toward the 6-hour outside cap with advisor approval. Not on the excluded list (ECEN 714 and 749 are). It does not count toward the 18 graded CSCE hours.',
    deliveryChoices: ['in-person', 'web'],
    source: 'official',
  },
];

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
