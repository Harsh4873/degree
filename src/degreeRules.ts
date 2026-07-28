import type { BreadthArea, PlanAlert, PlanEvaluation, Planner, RequirementCheck, RequirementStatus } from './types';

const excludedCodes = new Set([
  'CSCE 601',
  'CSCE 602',
  'CSCE 603',
  'CSCE 701',
  'CSCE 705',
  'CSCE 706',
  'CSCE 707',
  'CSCE 708',
  'CSCE 709',
  'CSCE 481',
  'CSCE 482',
  'CSCE 483',
  'ECEN 714',
  'ECEN 749',
  'STAT 624',
  'STAT 654',
  'MATH 679',
  'CYBR 601',
  'ISTM 601',
]);

const breadthLabels: Record<BreadthArea, string> = {
  theory: 'Theory breadth',
  systems: 'Systems breadth',
  software: 'Software breadth',
};

const canonicalCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, ' ');

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const atLeastStatus = (value: number, target: number): RequirementStatus =>
  value >= target ? 'complete' : 'pending';

const atMostStatus = (value: number, maximum: number): RequirementStatus =>
  value <= maximum ? 'complete' : 'warning';

const exactStatus = (value: number, target: number): RequirementStatus =>
  value === target ? 'complete' : value > target ? 'warning' : 'pending';

const rangeStatus = (value: number, minimum: number, maximum: number): RequirementStatus =>
  value >= minimum && value <= maximum ? 'complete' : 'warning';

const conditionStatus = (satisfied: boolean): RequirementStatus =>
  satisfied ? 'complete' : 'warning';

export function evaluatePlan(planner: Planner): PlanEvaluation {
  const allCourses = planner.terms.flatMap((term, termIndex) =>
    term.courses.map((course) => ({ course, term, termIndex })),
  );
  const totalCredits = sum(allCourses.map(({ course }) => course.credits));
  const gradedCsceCredits = sum(
    allCourses
      .filter(({ course }) => course.kind === 'csce-graded')
      .map(({ course }) => course.credits),
  );
  const seminarCredits = sum(
    allCourses.filter(({ course }) => course.kind === 'seminar').map(({ course }) => course.credits),
  );
  const researchCredits = sum(
    allCourses.filter(({ course }) => course.kind === 'research').map(({ course }) => course.credits),
  );
  const directedStudyCredits = sum(
    allCourses.filter(({ course }) => course.kind === 'directed-study').map(({ course }) => course.credits),
  );
  const nonCsceCredits = sum(
    allCourses.filter(({ course }) => course.kind === 'non-csce-grad').map(({ course }) => course.credits),
  );
  const undergradCsce = allCourses.filter(({ course }) => course.kind === 'csce-400');
  const undergradCsceCredits = sum(undergradCsce.map(({ course }) => course.credits));

  const requirements: RequirementCheck[] = [
    {
      id: 'total-hours',
      label: 'Total degree-plan credits',
      value: `${totalCredits} / 30 minimum`,
      status: atLeastStatus(totalCredits, 30),
      explanation: 'The MSCS degree plan requires at least 30 total credit hours.',
    },
    {
      id: 'graded-csce',
      label: 'Graded CSCE graduate credits',
      value: `${gradedCsceCredits} / 18 minimum`,
      status: atLeastStatus(gradedCsceCredits, 18),
      explanation: 'CSCE 681, 684, 685, and 691 do not count toward this 18-credit minimum.',
    },
    ...(['theory', 'systems', 'software'] as BreadthArea[]).map((area): RequirementCheck => {
      const matching = allCourses.filter(({ course }) => course.breadth === area).length;
      const isComplete = planner.completedBreadth[area] || matching > 0;

      return {
        id: `breadth-${area}`,
        label: breadthLabels[area],
        value: planner.completedBreadth[area] ? 'Marked complete' : `${matching} selected`,
        status: isComplete ? 'complete' : 'pending',
        explanation:
          area === 'systems' && planner.completedBreadth.systems
            ? 'Editable prior-completion assumption; it adds no credits to this plan.'
            : 'One approved CSCE breadth course is required, passed with B or better.',
      };
    }),
    {
      id: 'seminar',
      label: 'CSCE 681 seminar',
      value: `${seminarCredits} / 1 required`,
      status: exactStatus(seminarCredits, 1),
      explanation: 'The degree plan includes one credit hour of CSCE 681.',
    },
    {
      id: 'research',
      label: 'CSCE 691 research',
      value: `${researchCredits} / 3–6 allowed`,
      status: rangeStatus(researchCredits, 3, 6),
      explanation: 'The MSCS degree plan requires 3–6 CSCE 691 credits in total.',
    },
    {
      id: 'research-directed',
      label: 'CSCE 685 + 691 combined',
      value: `${directedStudyCredits + researchCredits} / 7 maximum`,
      status: atMostStatus(directedStudyCredits + researchCredits, 7),
      explanation: 'Directed Studies is limited to 3 credits, and CSCE 685 + CSCE 691 cannot exceed 7 credits.',
    },
    {
      id: 'non-csce',
      label: 'Non-CSCE graduate credits',
      value: `${nonCsceCredits} / 6 maximum`,
      status: atMostStatus(nonCsceCredits, 6),
      explanation: 'At most 6 non-CSCE graded graduate credits may be used.',
    },
    {
      id: 'csce-400',
      label: 'Approved CSCE 400-level course',
      value: `${undergradCsce.length} course${undergradCsce.length === 1 ? '' : 's'} · ${undergradCsceCredits} credits`,
      status: conditionStatus(undergradCsce.length <= 1 && undergradCsceCredits <= 3),
      explanation: 'At most one approved three-credit CSCE 400-level course may be used and it does not count toward the 18 graded-CSCE credits.',
    },
  ];

  const alerts: PlanAlert[] = [];

  if (planner.completedBreadth.systems) {
    alerts.push({
      id: 'systems-assumption',
      title: 'Systems breadth is an editable planning assumption',
      detail: 'It begins marked complete as requested and does not add a course or credits. Confirm the basis with the graduate advisor.',
      level: 'info',
    });
  }

  if (researchCredits > 6) {
    alerts.push({
      id: 'research-cap',
      title: 'Research reserve exceeds the MSCS degree-plan cap',
      detail: `The board contains ${researchCredits} CSCE 691 credits. The published MSCS requirement allows 3–6 total, even though the catalog itself lists a wider course-credit range.`,
      level: 'warning',
    });
  }

  if (directedStudyCredits > 3) {
    alerts.push({
      id: 'directed-study-cap',
      title: 'Directed Studies exceeds the MSCS cap',
      detail: `The board contains ${directedStudyCredits} CSCE 685 credits; the degree plan allows up to 3.`,
      level: 'warning',
    });
  }

  if (researchCredits + directedStudyCredits > 7) {
    alerts.push({
      id: 'research-directed-cap',
      title: 'Research + Directed Studies exceeds the combined cap',
      detail: `CSCE 685 + 691 totals ${researchCredits + directedStudyCredits} credits; the MSCS degree plan caps the combination at 7.`,
      level: 'warning',
    });
  }

  allCourses.forEach(({ course, term, termIndex }) => {
    if (excludedCodes.has(canonicalCode(course.code))) {
      alerts.push({
        id: `excluded-${course.instanceId}`,
        title: `${course.code} cannot be used on this degree plan`,
        detail: 'The MSCS department lists this course among those that cannot be used on any degree plan.',
        level: 'warning',
      });
    }

    if (!course.prerequisitePaths?.length || !course.prerequisiteText) {
      return;
    }

    const hasEarlierPlanEvidence = course.prerequisitePaths.some((path) =>
      path.every((requiredCode) =>
        allCourses.some(
          (candidate) =>
            canonicalCode(candidate.course.code) === canonicalCode(requiredCode) &&
            candidate.termIndex < termIndex,
        ),
      ),
    );

    if (!hasEarlierPlanEvidence) {
      alerts.push({
        id: `prerequisite-${course.instanceId}`,
        title: `Preparation check for ${course.code} in ${term.name}`,
        detail: `Catalog prerequisite: ${course.prerequisiteText} This board does not show an earlier matching course; prior coursework or instructor approval may satisfy it. TAMU notes graduate prerequisites do not block registration, but the student remains responsible for being prepared.`,
        level: 'warning',
      });
    }
  });

  return {
    totalCredits,
    gradedCsceCredits,
    researchCredits,
    directedStudyCredits,
    requirements,
    alerts,
  };
}
