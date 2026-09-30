export type BreadthArea = 'theory' | 'systems' | 'software';

/** ISSS treats WEB, VIDEO, and HYBRD as distance. Unset means the section is not marked. */
export type DeliveryMode = 'in-person' | 'web';

export type CourseKind =
  | 'csce-graded'
  | 'seminar'
  | 'research'
  | 'directed-study'
  | 'non-csce-grad'
  | 'csce-400'
  | 'other';

export type CourseTemplate = {
  id: string;
  code: string;
  title: string;
  defaultCredits: number;
  minCredits?: number;
  maxCredits?: number;
  kind: CourseKind;
  breadth?: BreadthArea;
  description?: string;
  prerequisiteText?: string;
  prerequisitePaths?: string[][];
  onlineFall2026?: boolean;
  /** Short planning note shown on the course card. Degree-rule text stays in `degreeRules`. */
  planningNote?: string;
  /** Sections the student can mark for the F-1 distance count. */
  deliveryChoices?: DeliveryMode[];
  source: 'official' | 'custom';
};

export type PlannedCourse = CourseTemplate & {
  instanceId: string;
  credits: number;
  delivery?: DeliveryMode;
};

export type Term = {
  id: string;
  name: string;
  courses: PlannedCourse[];
};

export type Planner = {
  terms: Term[];
  completedBreadth: Record<BreadthArea, boolean>;
};

export type RequirementStatus = 'complete' | 'pending' | 'warning';

export type RequirementCheck = {
  id: string;
  label: string;
  value: string;
  status: RequirementStatus;
  explanation: string;
};

export type PlanAlert = {
  id: string;
  title: string;
  detail: string;
  level: 'warning' | 'info';
};

export type PlanEvaluation = {
  totalCredits: number;
  countableCredits: number;
  gradedCsceCredits: number;
  researchCredits: number;
  researchCountable: number;
  directedStudyCredits: number;
  requirements: RequirementCheck[];
  alerts: PlanAlert[];
};
