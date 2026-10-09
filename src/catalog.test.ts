import { describe, expect, it } from 'vitest';
import { catalogCourseById, catalogCourses } from './catalog';
import { evaluatePlan } from './degreeRules';
import { generatedCsceCourses } from './generated/csceCatalog';
import { handKeptCourses } from './catalogOverrides';
import { cloneCourse } from './catalog';

// Ids that saved plans (local storage and Firestore) already reference.
const PREVIOUS_IDS = [
  'csce-604', 'csce-605', 'csce-606', 'csce-611', 'csce-612', 'csce-613', 'csce-614', 'csce-625',
  'csce-627', 'csce-629', 'csce-633', 'csce-634', 'csce-637', 'csce-640', 'csce-655', 'csce-656',
  'csce-670', 'csce-671', 'csce-672', 'csce-676', 'csce-678', 'csce-681', 'csce-685', 'csce-691',
  'csce-713', 'csce-735', 'stat-601', 'stat-616', 'stat-630', 'math-640', 'ecen-649', 'ecen-766',
];

const codeOf = (id: string) => catalogCourseById(id)?.code;

describe('course bank', () => {
  it('keeps every previously published course id', () => {
    for (const id of PREVIOUS_IDS) {
      expect(catalogCourseById(id), id).toBeDefined();
    }
  });

  it('has unique ids and codes', () => {
    expect(new Set(catalogCourses.map((course) => course.id)).size).toBe(catalogCourses.length);
    expect(new Set(catalogCourses.map((course) => course.code)).size).toBe(catalogCourses.length);
  });

  it('includes every generated 600- and 700-level CSCE course', () => {
    expect(generatedCsceCourses.length).toBeGreaterThan(60);
    for (const generated of generatedCsceCourses) {
      const number = Number(generated.code.slice(5));
      expect(number).toBeGreaterThanOrEqual(600);
      expect(number).toBeLessThan(800);
      expect(catalogCourses.some((course) => course.code === generated.code), generated.code).toBe(true);
    }
  });

  it('lists the courses that were missing from the hand-typed bank', () => {
    for (const number of [608, 713, 714, 726, 727, 735, 748, 752, 765]) {
      expect(codeOf(`csce-${number}`)).toBe(`CSCE ${number}`);
    }
  });

  it('applies the MSCS breadth sets and nothing else', () => {
    const breadth = Object.fromEntries(
      catalogCourses.filter((course) => course.breadth).map((course) => [course.code.slice(5), course.breadth]),
    );
    expect(breadth).toEqual({
      '604': 'software', '605': 'systems', '606': 'software', '611': 'systems', '613': 'systems',
      '614': 'systems', '627': 'theory', '629': 'theory', '634': 'software', '655': 'software',
      '656': 'software', '670': 'software', '671': 'software', '672': 'software', '678': 'systems',
      '713': 'software',
    });
  });

  it('keeps the special course kinds', () => {
    expect(catalogCourseById('csce-681')?.kind).toBe('seminar');
    expect(catalogCourseById('csce-684')?.kind).toBe('internship');
    expect(catalogCourseById('csce-685')?.kind).toBe('directed-study');
    expect(catalogCourseById('csce-691')?.kind).toBe('research');
    expect(catalogCourseById('csce-608')?.kind).toBe('csce-graded');
  });

  it('keeps hand-kept fields over the generated text', () => {
    for (const handKept of handKeptCourses) {
      const merged = catalogCourseById(handKept.id);
      expect(merged?.title).toBe(handKept.title);
      expect(merged?.description).toBe(handKept.description);
      expect(merged?.defaultCredits).toBe(handKept.defaultCredits);
      expect(merged?.planningNote).toBe(handKept.planningNote);
      expect(merged?.prerequisitePaths).toEqual(handKept.prerequisitePaths);
    }
  });

  it('carries variable credit ranges from the catalog', () => {
    expect(catalogCourseById('csce-684')).toMatchObject({ minCredits: 1, maxCredits: 16, defaultCredits: 1 });
    expect(catalogCourseById('csce-689')).toMatchObject({ minCredits: 0, maxCredits: 4, defaultCredits: 3 });
    expect(catalogCourseById('csce-691')).toMatchObject({ minCredits: 1, maxCredits: 23 });
  });

  it('flags excluded courses and leaves internship hours out of the 30', () => {
    expect(catalogCourseById('csce-706')?.planningNote).toMatch(/cannot be used/);
    const internship = catalogCourseById('csce-684');
    if (!internship) throw new Error('missing CSCE 684');
    const evaluation = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 't', name: 'Summer 2027', courses: [cloneCourse(internship, 1)] }],
    });
    expect(evaluation.totalCredits).toBe(1);
    expect(evaluation.countableCredits).toBe(0);
    expect(evaluation.gradedCsceCredits).toBe(0);
  });
});
