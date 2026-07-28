export type BreadthArea = 'theory' | 'systems' | 'software';

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
  source: 'official' | 'custom';
};

export type PlannedCourse = CourseTemplate & {
  instanceId: string;
  credits: number;
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
