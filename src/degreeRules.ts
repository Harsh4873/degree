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

/** True for courses the MSCS department says cannot be used on any degree plan. */
export const isExcludedCode = (code: string) => excludedCodes.has(canonicalCode(code));

const sum = (values: number[]) =>
  values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);

/** Catalog maxima cap what counts. Hours still sitting on the card stay in the raw total. */
const cappedCredits = (course: { credits: number; maxCredits?: number }) => {
  const credits = Number.isFinite(course.credits) ? course.credits : 0;
  if (typeof course.maxCredits === 'number' && Number.isFinite(course.maxCredits)) {
    return Math.min(credits, Math.max(0, course.maxCredits));
  }
  return credits;
};

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
  const allCourses = planner.terms.flatMap((term, termIndex) => {
    if (!term || !Array.isArray(term.courses)) return [];
    return term.courses.flatMap((course) => {
      if (!course || typeof course.code !== 'string') return [];
      return [{ course, term, termIndex }];
    });
  });
  const totalCredits = sum(allCourses.map(({ course }) => course.credits));
  const eligibleCourses = allCourses.filter(({ course }) => !excludedCodes.has(canonicalCode(course.code)));
  const gradedCsceCredits = sum(
    eligibleCourses
      .filter(({ course }) => course.kind === 'csce-graded')
      .map(({ course }) => cappedCredits(course)),
  );
  const seminarCredits = sum(
    eligibleCourses.filter(({ course }) => course.kind === 'seminar').map(({ course }) => course.credits),
  );
  const researchCredits = sum(
    eligibleCourses.filter(({ course }) => course.kind === 'research').map(({ course }) => course.credits),
  );
  const directedStudyCredits = sum(
    eligibleCourses.filter(({ course }) => course.kind === 'directed-study').map(({ course }) => course.credits),
  );
  const nonCsceCredits = sum(
    eligibleCourses.filter(({ course }) => course.kind === 'non-csce-grad').map(({ course }) => course.credits),
  );
  const undergradCsce = eligibleCourses.filter(({ course }) => course.kind === 'csce-400');
  const undergradCsceCredits = sum(undergradCsce.map(({ course }) => course.credits));
  const otherCredits = sum(
    eligibleCourses.filter(({ course }) => course.kind === 'other').map(({ course }) => course.credits),
  );

  const seminarCountable = Math.min(seminarCredits, 1);
  const researchCountable = Math.min(researchCredits, 6);
  const directedCountable = Math.min(directedStudyCredits, 3, Math.max(0, 7 - researchCountable));
  const nonCsceCountable = Math.min(nonCsceCredits, 6);
  const undergradCountable = undergradCsce.length === 1 ? Math.min(undergradCsceCredits, 3) : 0;
  const countableCredits =
    gradedCsceCredits +
    seminarCountable +
    researchCountable +
    directedCountable +
    nonCsceCountable +
    undergradCountable +
    otherCredits;

  const requirements: RequirementCheck[] = [
    {
      id: 'total-hours',
      label: 'Degree-plan credits',
      value: `${countableCredits} / 30 minimum`,
      status: atLeastStatus(countableCredits, 30),
      explanation: 'At least 30 credit hours must count toward the degree plan. Research, directed-study, non-CSCE, and 400-level hours count only up to their caps; extra enrollment stays on the board without counting.',
    },
    {
      id: 'graded-csce',
      label: 'Graded CSCE graduate credits',
      value: `${gradedCsceCredits} / 18 minimum`,
      status: atLeastStatus(gradedCsceCredits, 18),
      explanation: 'CSCE 681, 684, 685, and 691 do not count toward this 18-credit minimum.',
    },
    ...(['theory', 'systems', 'software'] as BreadthArea[]).map((area): RequirementCheck => {
      const matching = eligibleCourses.filter(({ course }) => course.breadth === area).length;
      const isComplete = planner.completedBreadth[area] || matching > 0;

      return {
        id: `breadth-${area}`,
        label: breadthLabels[area],
        value: planner.completedBreadth[area] ? 'Marked complete' : `${matching} selected`,
        status: isComplete ? 'complete' : 'pending',
        explanation: planner.completedBreadth[area]
          ? 'Marked complete from prior coursework. It adds no credits to this plan. Confirm a B or better with the graduate advisor.'
          : matching > 0
            ? 'One approved CSCE breadth course is required, passed with a B or better. The planner can see a matching course on the board, but it cannot see the grade.'
            : 'One approved CSCE breadth course is required, passed with a B or better. The planner cannot see the grade.',
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
      value: `${researchCredits} planned · ${researchCountable} count`,
      status: atLeastStatus(researchCredits, 3),
      explanation: 'The degree plan counts 3–6 CSCE 691 credits toward the 30. Enrolling beyond the countable hours is allowed (advisor-confirmed reading of the published requirement).',
    },
    {
      id: 'research-directed',
      label: 'CSCE 685 + 691 counted',
      value: `${directedCountable + researchCountable} / 7 maximum`,
      status: atMostStatus(directedCountable + researchCountable, 7),
      explanation: 'At most 7 combined CSCE 685 + 691 credits count toward the degree plan (685 up to 3, 691 up to 6); the planner caps the counted hours automatically.',
    },
    {
      id: 'non-csce',
      label: 'Non-CSCE graduate credits',
      value: `${nonCsceCredits} planned · ${nonCsceCountable} count`,
      status: atMostStatus(nonCsceCredits, 6),
      explanation: 'Up to 6 hours of graded graduate coursework from other departments (STAT, MATH, ECEN, and similar — see the course bank for verified options) count with advisor approval. Excluded courses such as STAT 624/654, MATH 679, and ECEN 714/749 cannot be used.',
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

  (['theory', 'systems', 'software'] as BreadthArea[]).forEach((area) => {
    if (!planner.completedBreadth[area]) return;
    alerts.push({
      id: `${area}-assumption`,
      title: `${breadthLabels[area]} is an editable planning assumption`,
      detail: 'The box is checked, so this area is treated as already satisfied. It does not add a course or credits. Confirm the basis, including a B or better, with the graduate advisor.',
      level: 'info',
    });
  });

  if (researchCredits > researchCountable) {
    alerts.push({
      id: 'research-countable',
      title: `${researchCountable} of ${researchCredits} research credits count toward the 30`,
      detail: 'The MSCS degree plan counts 3–6 CSCE 691 credits. Additional research enrollment is allowed and stays on the board; the extra hours simply do not count toward the degree-plan minimum (advisor-confirmed).',
      level: 'info',
    });
  }

  if (directedStudyCredits > directedCountable) {
    alerts.push({
      id: 'directed-countable',
      title: `${directedCountable} of ${directedStudyCredits} directed-study credits count toward the 30`,
      detail: 'The degree plan counts up to 3 CSCE 685 credits, and CSCE 685 + 691 count at most 7 combined; extra enrollment does not count toward the minimum.',
      level: 'info',
    });
  }

  if (otherCredits > 0) {
    alerts.push({
      id: 'other-uncapped',
      title: `${otherCredits} custom-item ${otherCredits === 1 ? 'credit counts' : 'credits count'} with no category cap`,
      detail: 'Items left as Custom item are added in full toward the 30. Classify a non-CSCE graduate course as Non-CSCE grad so the 6-hour cap applies, or pick the matching CSCE classification.',
      level: 'warning',
    });
  }

  const duplicateCounts = new Map<string, number>();
  eligibleCourses.forEach(({ course }) => {
    if (course.kind !== 'csce-graded' && course.kind !== 'non-csce-grad' && course.kind !== 'csce-400' && course.kind !== 'other') {
      return;
    }
    const code = canonicalCode(course.code);
    duplicateCounts.set(code, (duplicateCounts.get(code) ?? 0) + 1);
  });
  duplicateCounts.forEach((count, code) => {
    if (count < 2) return;
    alerts.push({
      id: `duplicate-${code.replace(/\s+/g, '-')}`,
      title: `${code} is on the board ${count} times`,
      detail: 'Each copy counts toward the degree plan. Remove the extra card unless the advisor approved repeating it. Research, seminar, directed study, and internship cards can repeat without this note.',
      level: 'warning',
    });
  });

  allCourses.forEach(({ course, term, termIndex }) => {
    if (excludedCodes.has(canonicalCode(course.code))) {
      alerts.push({
        id: `excluded-${course.instanceId}`,
        title: `${course.code} cannot be used on this degree plan`,
        detail: 'The MSCS department lists this course among those that cannot be used on any degree plan.',
        level: 'warning',
      });
    }

    if (!Array.isArray(course.prerequisitePaths) || course.prerequisitePaths.length === 0 || !course.prerequisiteText) {
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

  planner.terms.forEach((term) => {
    if (!term || !Array.isArray(term.courses)) return;
    const courses = term.courses.filter((course) => course && typeof course.code === 'string');
    const webCredits = sum(
      courses.filter((course) => course.delivery === 'web').map((course) => course.credits),
    );
    if (webCredits <= 0) return;

    const inPersonCredits = sum(
      courses.filter((course) => course.delivery === 'in-person').map((course) => course.credits),
    );
    const unmarkedCredits = sum(
      courses.filter((course) => course.delivery !== 'web' && course.delivery !== 'in-person').map((course) => course.credits),
    );
    const counted = inPersonCredits + Math.min(webCredits, 3);
    const longSemester = /\b(spring|fall)\b/i.test(term.name) && !/\bsummer\b/i.test(term.name);
    const unmarkedNote = unmarkedCredits > 0
      ? ` ${unmarkedCredits} credits on this term are not marked in person or distance, so they are left out of that count.`
      : '';

    if (longSemester && counted < 9) {
      alerts.push({
        id: `f1-distance-${term.id}`,
        title: `${term.name} is short of the F-1 9-hour count`,
        detail: `This term has ${webCredits} distance credits and ${inPersonCredits} credits marked in person. ISSS counts only one distance course, up to 3 credits, toward the fall and spring full-time minimum of 9 graduate credits. That makes ${counted} hours count for F-1 status.${unmarkedNote} WEB, VIDEO, and HYBRD sections count as distance. Registrar full-time is a separate rule. Confirm with ISSS at 979-845-1824.`,
        level: 'warning',
      });
      return;
    }

    alerts.push({
      id: `f1-distance-${term.id}`,
      title: longSemester
        ? `${term.name} still meets the F-1 9-hour count`
        : `${term.name} has distance credits`,
      detail: longSemester
        ? `This term marks ${webCredits} distance credits. Only 3 of those count toward the F-1 9-hour minimum, together with ${inPersonCredits} in-person credits (${counted} counted).${unmarkedNote} WEB, VIDEO, and HYBRD count as distance.`
        : `This term marks ${webCredits} distance credits. ISSS still counts only one distance course, up to 3 credits, when a full-time minimum applies. Summer full-time is a separate rule.${unmarkedNote}`,
      level: 'info',
    });
  });

  return {
    totalCredits,
    countableCredits,
    gradedCsceCredits,
    researchCredits,
    researchCountable,
    directedStudyCredits,
    requirements,
    alerts,
  };
}
