import { catalogCourseById, cloneCourse } from './catalog';
import type { Planner } from './types';

/**
 * A fully populated example plan, used only by the tests.
 *
 * The rule engine's interesting behaviour — the research cap, the combined
 * 685 + 691 cap, breadth coverage, prerequisite alerts — only shows up on a
 * plan with real courses in it, so the suites need a dense fixture. Nothing in
 * the app imports this module: a first visit starts from `createSeedPlanner`,
 * which is deliberately empty.
 */
function course(id: string, credits?: number) {
  const template = catalogCourseById(id);

  if (!template) {
    throw new Error(`Unknown catalog course: ${id}`);
  }

  return cloneCourse(template, credits);
}

export function createExamplePlanner(): Planner {
  return {
    completedBreadth: {
      theory: false,
      systems: true,
      software: false,
    },
    terms: [
      {
        id: 'fall-2026',
        name: 'Fall 2026',
        courses: [course('csce-671'), course('csce-627'), course('csce-691', 3)],
      },
      {
        id: 'spring-2027',
        name: 'Spring 2027',
        courses: [course('csce-625'), course('csce-629'), course('csce-681'), course('csce-691', 3)],
      },
      {
        id: 'summer-2027',
        name: 'Summer 2027',
        courses: [course('csce-691', 6)],
      },
      {
        id: 'fall-2027',
        name: 'Fall 2027',
        courses: [course('csce-633'), course('csce-612'), course('csce-691', 3)],
      },
      {
        id: 'spring-2028',
        name: 'Spring 2028',
        courses: [course('csce-735'), course('csce-606'), course('csce-691', 3)],
      },
      {
        id: 'summer-2028',
        name: 'Summer 2028',
        courses: [course('csce-691', 6)],
      },
    ],
  };
}
