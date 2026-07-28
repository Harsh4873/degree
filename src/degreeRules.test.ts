import { describe, expect, it } from 'vitest';
import { catalogCourseById, cloneCourse, createSeedPlanner } from './catalog';
import { evaluatePlan } from './degreeRules';
import type { Planner } from './types';

describe('evaluatePlan', () => {
  it('keeps the requested research reserve visible while flagging its MSCS policy conflict', () => {
    const evaluation = evaluatePlan(createSeedPlanner());

    expect(evaluation.totalCredits).toBe(43);
    expect(evaluation.gradedCsceCredits).toBe(18);
    expect(evaluation.researchCredits).toBe(24);
    expect(evaluation.requirements.find((rule) => rule.id === 'breadth-systems')?.status).toBe('complete');
    expect(evaluation.requirements.find((rule) => rule.id === 'research')?.status).toBe('warning');
    expect(evaluation.alerts.some((alert) => alert.id === 'research-cap')).toBe(true);
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

  it('recognizes degree-plan-excluded course codes even when entered as custom items', () => {
    const planner = createSeedPlanner();
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
});
