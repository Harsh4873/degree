import { describe, expect, it } from 'vitest';
import { catalogCourseById, cloneCourse } from './catalog';
import { createExamplePlanner } from './examplePlan';
import { evaluatePlan } from './degreeRules';
import type { Planner } from './types';

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
    expect(evaluation.alerts.some((alert) => alert.level === 'warning')).toBe(false);
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
});
