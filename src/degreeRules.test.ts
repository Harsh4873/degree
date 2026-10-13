import { describe, expect, it } from 'vitest';
import { catalogCourseById, cloneCourse, createSeedPlanner } from './catalog';
import { createExamplePlanner } from './examplePlan';
import { evaluatePlan } from './degreeRules';
import type { CourseKind, Planner } from './types';

describe('evaluatePlan', () => {
  it('counts capped research toward the 30-hour plan without limiting enrollment', () => {
    const evaluation = evaluatePlan(createExamplePlanner());

    expect(evaluation.totalCredits).toBe(49);
    expect(evaluation.gradedCsceCredits).toBe(24);
    expect(evaluation.researchCredits).toBe(24);
    expect(evaluation.researchCountable).toBe(6);
    expect(evaluation.countableCredits).toBe(31);
    expect(evaluation.requirements.find((rule) => rule.id === 'total-hours')?.status).toBe('complete');
    expect(evaluation.requirements.find((rule) => rule.id === 'research')?.status).toBe('complete');
    expect(evaluation.requirements.find((rule) => rule.id === 'breadth-systems')?.status).toBe('complete');
    expect(evaluation.requirements.find((rule) => rule.id === 'breadth-theory')?.status).toBe('complete');
    expect(evaluation.requirements.find((rule) => rule.id === 'breadth-software')?.status).toBe('complete');
    expect(evaluation.alerts.some((alert) => alert.id === 'research-countable')).toBe(true);
    expect(evaluation.alerts.filter((alert) => alert.level === 'warning').map((alert) => alert.title).sort()).toEqual([
      'Preparation check for CSCE 606 in Spring 2028',
      'Preparation check for CSCE 627 in Fall 2026',
    ]);
  });

  it('caps combined CSCE 685 and 691 counted credits at seven', () => {
    const directedStudies = catalogCourseById('csce-685');
    const research = catalogCourseById('csce-691');

    if (!directedStudies || !research) {
      throw new Error('Expected catalog courses were not found');
    }

    const planner: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [
        { id: 'one', name: 'Term one', courses: [cloneCourse(directedStudies, 3), cloneCourse(research, 6)] },
      ],
    };

    const evaluation = evaluatePlan(planner);

    expect(evaluation.countableCredits).toBe(7);
    expect(evaluation.requirements.find((rule) => rule.id === 'research-directed')?.value).toBe('7 / 7 maximum');
    expect(evaluation.alerts.some((alert) => alert.level === 'warning')).toBe(false);
  });

  it('accepts an earlier catalog prerequisite placed in a prior term', () => {
    const algorithms = catalogCourseById('csce-629');
    const quantumAlgorithms = catalogCourseById('csce-640');

    if (!algorithms || !quantumAlgorithms) {
      throw new Error('Expected catalog courses were not found');
    }

    const planner: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [
        { id: 'one', name: 'Term one', courses: [cloneCourse(algorithms)] },
        { id: 'two', name: 'Term two', courses: [cloneCourse(quantumAlgorithms)] },
      ],
    };

    const evaluation = evaluatePlan(planner);

    expect(evaluation.alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(false);
  });

  it('counts ECEN 766 outside the department and CSCE 676 as graded CSCE with no breadth', () => {
    const bioinformatics = catalogCourseById('ecen-766');
    const dataMining = catalogCourseById('csce-676');
    const collaborativeWork = catalogCourseById('csce-672');

    if (!bioinformatics || !dataMining || !collaborativeWork) {
      throw new Error('Expected catalog courses were not found');
    }

    expect(dataMining.breadth).toBeUndefined();
    expect(dataMining.kind).toBe('csce-graded');
    expect(bioinformatics.kind).toBe('non-csce-grad');
    expect(collaborativeWork.breadth).toBe('software');
    expect(cloneCourse(bioinformatics).delivery).toBe('in-person');

    const planner: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'spring-2027',
        name: 'Spring 2027',
        courses: [cloneCourse(bioinformatics), cloneCourse(dataMining)],
      }],
    };

    const evaluation = evaluatePlan(planner);
    expect(evaluation.gradedCsceCredits).toBe(3);
    expect(evaluation.requirements.find((rule) => rule.id === 'non-csce')?.value).toBe('3 planned · 3 count');
    expect(evaluation.alerts.some((alert) => alert.id.startsWith('f1-distance-'))).toBe(false);
  });

  it('treats CSCE 610 as preparation for CSCE 672', () => {
    const collaborativeWork = catalogCourseById('csce-672');
    const softwareEngineering = catalogCourseById('csce-606');

    if (!collaborativeWork) {
      throw new Error('Expected catalog courses were not found');
    }

    const withPrior610: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [
        {
          id: 'one',
          name: 'Fall 2026',
          courses: [{
            ...cloneCourse(softwareEngineering ?? collaborativeWork),
            code: 'CSCE 610',
            id: 'csce-610',
            title: 'Prior preparation',
            breadth: undefined,
            prerequisiteText: undefined,
            prerequisitePaths: undefined,
          }],
        },
        { id: 'two', name: 'Spring 2027', courses: [cloneCourse(collaborativeWork)] },
      ],
    };

    expect(evaluatePlan(withPrior610).alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(false);
  });

  it('warns when two distance courses leave a spring term short of the F-1 count', () => {
    const bioinformatics = catalogCourseById('ecen-766');
    const dataMining = catalogCourseById('csce-676');
    const research = catalogCourseById('csce-691');

    if (!bioinformatics || !dataMining || !research) {
      throw new Error('Expected catalog courses were not found');
    }

    const short: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'spring-2027',
        name: 'Spring 2027',
        courses: [
          { ...cloneCourse(bioinformatics), delivery: 'web' },
          { ...cloneCourse(dataMining), delivery: 'web' },
          { ...cloneCourse(research, 3), delivery: 'in-person' },
        ],
      }],
    };

    const shortAlert = evaluatePlan(short).alerts.find((alert) => alert.id === 'f1-distance-spring-2027');
    expect(shortAlert?.level).toBe('warning');
    expect(shortAlert?.detail).toContain('6 hours count');

    const enough: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'spring-2027',
        name: 'Spring 2027',
        courses: [
          { ...cloneCourse(bioinformatics), delivery: 'in-person' },
          { ...cloneCourse(dataMining), delivery: 'web' },
          { ...cloneCourse(research, 3), delivery: 'in-person' },
        ],
      }],
    };

    const enoughAlert = evaluatePlan(enough).alerts.find((alert) => alert.id === 'f1-distance-spring-2027');
    expect(enoughAlert?.level).toBe('info');
    expect(enoughAlert?.title).toContain('still meets');
  });

  it('recognizes degree-plan-excluded course codes even when entered as custom items', () => {
    const planner = createExamplePlanner();
    planner.terms[0].courses.push(
      {
        instanceId: 'custom-excluded',
        id: 'custom-excluded',
        code: 'CSCE 701',
        title: 'Custom catalog check',
        defaultCredits: 3,
        credits: 3,
        kind: 'other',
        source: 'custom',
      },
      {
        instanceId: 'custom-excluded-481',
        id: 'custom-excluded-481',
        code: 'CSCE 481',
        title: 'Custom undergraduate check',
        defaultCredits: 1,
        credits: 1,
        kind: 'csce-400',
        source: 'custom',
      },
    );

    const evaluation = evaluatePlan(planner);

    expect(evaluation.alerts.some((alert) => alert.id === 'excluded-custom-excluded')).toBe(true);
    expect(evaluation.alerts.some((alert) => alert.id === 'excluded-custom-excluded-481')).toBe(true);
    expect(evaluation.totalCredits).toBe(53);
    expect(evaluation.countableCredits).toBe(31);
  });

  it.each<[string, CourseKind]>([
    [' csce   601 ', 'csce-graded'],
    ['CSCE 602', 'seminar'],
    ['CSCE 603', 'research'],
    ['CSCE 701', 'directed-study'],
    ['ECEN 714', 'non-csce-grad'],
    ['CSCE 481', 'csce-400'],
    ['CYBR 601', 'other'],
  ])('does not count excluded %s even when classified as %s', (code, kind) => {
    const planner: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Term one', courses: [{
        instanceId: 'excluded', id: 'excluded', code, title: 'Custom course',
        defaultCredits: 3, credits: 3, kind, breadth: 'theory', source: 'custom',
      }] }],
    };
    const result = evaluatePlan(planner);
    expect(result.totalCredits).toBe(3);
    expect(result.countableCredits).toBe(0);
    expect(result.gradedCsceCredits).toBe(0);
    expect(result.researchCredits).toBe(0);
    expect(result.directedStudyCredits).toBe(0);
    expect(result.requirements.find(rule => rule.id === 'breadth-theory')?.status).toBe('pending');
    expect(result.alerts.some(alert => alert.id === 'excluded-excluded')).toBe(true);
  });

  it('keeps excluded enrollment from completing an otherwise short plan', () => {
    const planner = createExamplePlanner();
    planner.completedBreadth.theory = false;
    planner.terms.forEach(term => {
      term.courses = term.courses.map(course => course.kind === 'csce-graded'
        ? { ...course, code: 'CSCE 601' }
        : course);
    });
    const result = evaluatePlan(planner);
    expect(result.totalCredits).toBe(49);
    expect(result.gradedCsceCredits).toBe(0);
    expect(result.requirements.find(rule => rule.id === 'graded-csce')?.status).toBe('pending');
    expect(result.requirements.find(rule => rule.id === 'total-hours')?.status).toBe('pending');
    expect(result.requirements.find(rule => rule.id === 'breadth-theory')?.status).toBe('pending');
  });

  it('counts non-CSCE electives toward the six-hour cap', () => {
    const statistics = catalogCourseById('stat-630');

    if (!statistics) {
      throw new Error('Expected catalog course was not found');
    }

    const planner: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Term one', courses: [cloneCourse(statistics)] }],
    };

    const evaluation = evaluatePlan(planner);

    expect(evaluation.requirements.find((rule) => rule.id === 'non-csce')?.value).toBe('3 planned · 3 count');
    expect(evaluation.countableCredits).toBe(3);
  });

  it('caps a graded course at its catalog maximum and ignores a second 400-level course', () => {
    const graded: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Term one', courses: [{
        instanceId: 'graded', id: 'graded', code: 'CSCE 606', title: 'Software Engineering',
        defaultCredits: 3, minCredits: 3, maxCredits: 3, credits: 30,
        kind: 'csce-graded', source: 'custom',
      }] }],
    };
    const gradedResult = evaluatePlan(graded);
    expect(gradedResult.gradedCsceCredits).toBe(3);
    expect(gradedResult.countableCredits).toBe(3);
    expect(gradedResult.totalCredits).toBe(30);

    const undergrad = (instanceId: string) => ({
      instanceId, id: instanceId, code: `CSCE 41${instanceId}`, title: 'Undergraduate elective',
      defaultCredits: 3, credits: 3, kind: 'csce-400' as const, source: 'custom' as const,
    });
    const two: Planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Term one', courses: [undergrad('0'), undergrad('1')] }],
    };
    expect(evaluatePlan(two).countableCredits).toBe(0);
    expect(evaluatePlan(two).requirements.find((rule) => rule.id === 'csce-400')?.status).toBe('warning');
    expect(evaluatePlan({ ...two, terms: [{ id: 'one', name: 'Term one', courses: [undergrad('0')] }] }).countableCredits).toBe(3);
  });

  it('treats CSCE 431 or CSCE 606 as preparation for CSCE 713', () => {
    const security = catalogCourseById('csce-713');
    if (!security) throw new Error('Expected catalog course was not found');

    const prior = (code: string) => ({
      ...cloneCourse(security),
      code,
      id: code.toLowerCase().replace(/\s+/g, '-'),
      title: 'Prior preparation',
      breadth: undefined,
      prerequisiteText: undefined,
      prerequisitePaths: undefined,
    });
    const placed = (code: string | undefined): Planner => ({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [
        { id: 'one', name: 'Fall 2026', courses: code ? [prior(code)] : [] },
        { id: 'two', name: 'Spring 2027', courses: [cloneCourse(security)] },
      ],
    });

    expect(evaluatePlan(placed('CSCE 431')).alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(false);
    expect(evaluatePlan(placed('CSCE 606')).alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(false);
    expect(evaluatePlan(placed(undefined)).alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(true);
  });

  it('uses the prior-completion sentence for every breadth area that is checked', () => {
    const planner = createExamplePlanner();
    const systems = evaluatePlan(planner).requirements.find((rule) => rule.id === 'breadth-systems');
    expect(systems?.explanation).toContain('Marked complete from prior coursework');
    expect(evaluatePlan(planner).alerts.find((alert) => alert.id === 'systems-assumption')?.detail).toContain('The box is checked');

    planner.completedBreadth.systems = false;
    planner.completedBreadth.theory = true;
    const theory = evaluatePlan(planner).requirements.find((rule) => rule.id === 'breadth-theory');
    expect(theory?.explanation).toContain('Marked complete from prior coursework');
    expect(theory?.status).toBe('complete');
  });

  it('does not claim a breadth course is on the board when none is placed', () => {
    const evaluation = evaluatePlan(createSeedPlanner());
    for (const area of ['theory', 'systems', 'software'] as const) {
      const explanation = evaluation.requirements.find((rule) => rule.id === `breadth-${area}`)?.explanation ?? '';
      expect(explanation).toContain('cannot see the grade');
      expect(explanation).not.toContain('can see a matching course');
    }

    const theory = catalogCourseById('csce-627');
    if (!theory) throw new Error('Expected catalog course was not found');
    const placed = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [cloneCourse(theory)] }],
    });
    expect(placed.requirements.find((rule) => rule.id === 'breadth-theory')?.explanation).toContain('can see a matching course');
  });

  it('does not throw when a saved course is null or has a non-list prerequisite', () => {
    const planner = {
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'one',
        name: 'Fall 2026',
        courses: [
          null,
          {
            instanceId: 'bad-path',
            id: 'bad-path',
            code: 'CSCE 606',
            title: 'Software Engineering',
            defaultCredits: 3,
            credits: 3,
            kind: 'csce-graded',
            source: 'custom',
            prerequisiteText: 'CSCE 431',
            prerequisitePaths: 'CSCE 431',
          },
        ],
      }],
    } as unknown as Planner;
    expect(() => evaluatePlan(planner)).not.toThrow();
    expect(evaluatePlan(planner).gradedCsceCredits).toBe(3);
  });

  it('caps a graded custom course that has no catalog maximum', () => {
    const evaluation = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [{
        instanceId: 'wide', id: 'wide', code: 'CSCE 689', title: 'Custom graded',
        defaultCredits: 3, credits: 40, kind: 'csce-graded', source: 'custom',
      }] }],
    });
    expect(evaluation.gradedCsceCredits).toBe(3);
    expect(evaluation.countableCredits).toBe(3);
    expect(evaluation.totalCredits).toBe(40);
  });

  it('counts a repeated graded or non-CSCE code once', () => {
    const card = (instanceId: string, code: string, kind: 'csce-graded' | 'non-csce-grad') => ({
      instanceId, id: instanceId, code, title: code,
      defaultCredits: 3, maxCredits: 3, credits: 3, kind, source: 'custom' as const,
    });
    const graded = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [
        card('a', 'CSCE 629', 'csce-graded'),
        card('b', 'CSCE 629', 'csce-graded'),
      ] }],
    });
    expect(graded.gradedCsceCredits).toBe(3);
    expect(graded.countableCredits).toBe(3);
    expect(graded.alerts.some((alert) => alert.id === 'duplicate-CSCE-629')).toBe(true);

    const outside = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [
        card('a', 'STAT 630', 'non-csce-grad'),
        card('b', 'STAT 630', 'non-csce-grad'),
      ] }],
    });
    expect(outside.requirements.find((rule) => rule.id === 'non-csce')?.value).toBe('3 planned · 3 count');
    expect(outside.countableCredits).toBe(3);

    const larger = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [
        card('a', 'CSCE 629', 'csce-graded'),
        { ...card('b', 'CSCE 629', 'csce-graded'), credits: 1 },
      ] }],
    });
    expect(larger.gradedCsceCredits).toBe(3);
  });

  it('does not treat a cleared course code as a repeated course', () => {
    const card = (instanceId: string, code: string) => ({
      instanceId, id: instanceId, code, title: 'Untitled',
      defaultCredits: 3, credits: 3, kind: 'csce-graded' as const, source: 'custom' as const,
    });
    const evaluation = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [card('a', ' '), card('b', '')] }],
    });
    expect(evaluation.gradedCsceCredits).toBe(6);
    expect(evaluation.alerts.some((alert) => alert.id.startsWith('duplicate'))).toBe(false);
  });

  it('uses the official breadth course, not a stale breadth tag', () => {
    const renamed = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [{
        instanceId: 'renamed', id: 'renamed', code: 'MATH 609', title: 'Was algorithms',
        defaultCredits: 3, maxCredits: 3, credits: 3, kind: 'non-csce-grad', breadth: 'theory', source: 'custom',
      }] }],
    });
    expect(renamed.requirements.find((rule) => rule.id === 'breadth-theory')?.status).toBe('pending');

    const retitled = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [{
        instanceId: 'kept', id: 'kept', code: 'CSCE 629', title: 'Analysis of Algorithms',
        defaultCredits: 3, maxCredits: 3, credits: 3, kind: 'csce-graded', source: 'custom',
      }] }],
    });
    expect(retitled.requirements.find((rule) => rule.id === 'breadth-theory')?.status).toBe('complete');
  });

  it('counts one distance course, up to 3 credits, toward the F-1 minimum', () => {
    const course = (instanceId: string, credits: number, delivery: 'web' | 'in-person') => ({
      instanceId, id: instanceId, code: `CSCE ${instanceId}`, title: 'Section',
      defaultCredits: credits, credits, kind: 'csce-graded' as const, source: 'custom' as const,
      maxCredits: credits, delivery,
    });
    const short = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'spring-2027',
        name: 'Spring 2027',
        courses: [course('1', 1, 'web'), course('2', 2, 'web'), course('3', 6, 'in-person')],
      }],
    });
    const shortAlert = short.alerts.find((alert) => alert.id === 'f1-distance-spring-2027');
    expect(shortAlert?.level).toBe('warning');
    expect(shortAlert?.detail).toContain('8 hours count');

    const renamed = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'fall-2026',
        name: 'Year one',
        courses: [course('web', 3, 'web'), course('room', 3, 'in-person')],
      }],
    });
    expect(renamed.alerts.find((alert) => alert.id === 'f1-distance-fall-2026')?.level).toBe('warning');

    const summer = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'fall-2026',
        name: 'Summer session',
        courses: [course('web', 3, 'web')],
      }],
    });
    const summerAlert = summer.alerts.find((alert) => alert.id === 'f1-distance-fall-2026');
    expect(summerAlert?.level).toBe('info');
    expect(summerAlert?.title).toContain('has distance credits');
  });

  it('warns when a CPT course is marked distance', () => {
    const internship = catalogCourseById('csce-684');
    if (!internship) throw new Error('Expected catalog course was not found');
    const evaluation = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{
        id: 'summer-2027',
        name: 'Summer 2027',
        courses: [{ ...cloneCourse(internship, 1), delivery: 'web' }],
      }],
    });
    expect(evaluation.alerts.some((alert) => alert.id.startsWith('cpt-distance-') && alert.level === 'warning')).toBe(true);
    expect(evaluation.countableCredits).toBe(0);
  });

  it('warns for named preparation paths and stays quiet for CSCE 313 background', () => {
    const expectQuietWithPrior = (id: string, prior: string) => {
      const course = catalogCourseById(id);
      if (!course) throw new Error(`missing ${id}`);
      const priorCard = {
        ...cloneCourse(course),
        code: prior,
        id: prior.toLowerCase().replace(/\s+/g, '-'),
        title: 'Prior preparation',
        breadth: undefined,
        prerequisiteText: undefined,
        prerequisitePaths: undefined,
      };
      const without = evaluatePlan({
        completedBreadth: { theory: false, systems: false, software: false },
        terms: [
          { id: 'one', name: 'Fall 2026', courses: [] },
          { id: 'two', name: 'Spring 2027', courses: [cloneCourse(course)] },
        ],
      });
      const withPrior = evaluatePlan({
        completedBreadth: { theory: false, systems: false, software: false },
        terms: [
          { id: 'one', name: 'Fall 2026', courses: [priorCard] },
          { id: 'two', name: 'Spring 2027', courses: [cloneCourse(course)] },
        ],
      });
      expect(without.alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(true);
      expect(withPrior.alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(false);
    };

    expectQuietWithPrior('csce-606', 'CSCE 431');
    expectQuietWithPrior('csce-670', 'CSCE 310');
    expectQuietWithPrior('csce-670', 'CSCE 603');
    expectQuietWithPrior('csce-605', 'CSCE 434');
    expectQuietWithPrior('csce-627', 'CSCE 433');

    const operatingSystems = catalogCourseById('csce-611');
    if (!operatingSystems) throw new Error('missing CSCE 611');
    expect(operatingSystems.prerequisiteText).toMatch(/CSCE 313/);
    expect(operatingSystems.prerequisitePaths).toBeUndefined();
    const background = evaluatePlan({
      completedBreadth: { theory: false, systems: false, software: false },
      terms: [{ id: 'one', name: 'Fall 2026', courses: [cloneCourse(operatingSystems)] }],
    });
    expect(background.alerts.some((alert) => alert.id.startsWith('prerequisite-'))).toBe(false);
  });
});
