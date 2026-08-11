import type { BreadthArea, PlannedCourse, Planner, Term } from './types';

/**
 * Degree Canvas syncs one document per account: `degree_users/{uid}`.
 *
 *   - The whole planner board travels as a single value. A plan is small and
 *     every edit touches term ordering, so splitting it into per-course
 *     documents would buy merge granularity the app cannot use.
 *   - Conflicts resolve last-write-wins on `updatedAtMs`, with a canonical
 *     JSON tie-break so two devices that saved in the same millisecond still
 *     converge on the same winner regardless of argument order.
 *   - `updatedAtMs` never moves backwards, which the security rules enforce.
 *
 * Everything here is pure so the contract stays unit-testable without a
 * network or an emulator.
 */

export const DEGREE_SCHEMA_VERSION = 1;

/**
 * Firestore cannot store an array whose elements are arrays, and
 * `CourseTemplate.prerequisitePaths` is exactly that (`string[][]` — a list of
 * alternative prerequisite chains). On the wire each chain becomes a map, so
 * the field stays lossless and `degreeRules` keeps working after a device
 * adopts a plan from the cloud.
 */
interface WirePrerequisitePath {
  courses: string[];
}

type WireCourse = Omit<PlannedCourse, 'prerequisitePaths'> & {
  prerequisitePaths?: WirePrerequisitePath[];
};

interface WireTerm {
  id: string;
  name: string;
  courses: WireCourse[];
}

export interface WirePlanner {
  terms: WireTerm[];
  completedBreadth: Record<BreadthArea, boolean>;
}

export interface CloudPlanDocument {
  schemaVersion: typeof DEGREE_SCHEMA_VERSION;
  planner: WirePlanner;
  updatedAt: string;
  updatedAtMs: number;
  clientId: string;
}

export function encodePlanner(planner: Planner): WirePlanner {
  return {
    terms: planner.terms.map((term) => ({
      id: term.id,
      name: term.name,
      courses: term.courses.map(({ prerequisitePaths, ...course }) => (
        prerequisitePaths
          ? { ...course, prerequisitePaths: prerequisitePaths.map((courses) => ({ courses })) }
          : { ...course }
      )),
    })),
    completedBreadth: planner.completedBreadth,
  };
}

export function decodePlanner(planner: WirePlanner): Planner {
  return {
    terms: planner.terms.map((term) => ({
      id: term.id,
      name: term.name,
      courses: term.courses.map(({ prerequisitePaths, ...course }) => (
        Array.isArray(prerequisitePaths)
          ? {
            ...course,
            prerequisitePaths: prerequisitePaths
              .map((path) => (Array.isArray(path?.courses) ? path.courses : []))
              .filter((path) => path.length > 0),
          } as PlannedCourse
          : { ...course } as PlannedCourse
      )),
    })) as Term[],
    completedBreadth: planner.completedBreadth,
  };
}

const BREADTH_AREAS: BreadthArea[] = ['theory', 'systems', 'software'];

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

/** Firestore rejects `undefined`; the planner picks up optional fields from the catalog. */
export function omitUndefinedDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => omitUndefinedDeep(item)) as unknown as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    result[key] = omitUndefinedDeep(item);
  }
  return result as T;
}

/** One canonical text for a planner, so every comparison uses the same shape. */
export function plannerFingerprint(planner: Planner): string {
  return stableStringify(omitUndefinedDeep(planner));
}

export function plannersEqual(left: Planner, right: Planner): boolean {
  return plannerFingerprint(left) === plannerFingerprint(right);
}

export function serializePlanDocument(
  planner: Planner,
  clientId: string,
  updatedAtMs: number,
): CloudPlanDocument {
  return {
    schemaVersion: DEGREE_SCHEMA_VERSION,
    planner: omitUndefinedDeep(encodePlanner(planner)),
    updatedAt: new Date(updatedAtMs).toISOString(),
    updatedAtMs,
    clientId,
  };
}

function isBreadthMap(value: unknown): value is Record<BreadthArea, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return BREADTH_AREAS.every((area) => typeof record[area] === 'boolean');
}

/** A cloud document decoded back into the shape the app works with. */
export interface ParsedPlan {
  planner: Planner;
  updatedAt: string;
  updatedAtMs: number;
  clientId: string;
}

/** Anything shaped wrong is treated as absent rather than crashing the board. */
export function parsePlanDocument(value: unknown): ParsedPlan | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<CloudPlanDocument>;
  if (candidate.schemaVersion !== DEGREE_SCHEMA_VERSION) return undefined;
  if (typeof candidate.updatedAtMs !== 'number' || !Number.isFinite(candidate.updatedAtMs)) return undefined;
  if (typeof candidate.updatedAt !== 'string') return undefined;
  if (typeof candidate.clientId !== 'string') return undefined;

  const planner = candidate.planner as Partial<WirePlanner> | undefined;
  if (!planner || typeof planner !== 'object') return undefined;
  if (!Array.isArray(planner.terms)) return undefined;
  if (!isBreadthMap(planner.completedBreadth)) return undefined;

  return {
    planner: decodePlanner({ terms: planner.terms, completedBreadth: planner.completedBreadth }),
    updatedAt: candidate.updatedAt,
    updatedAtMs: candidate.updatedAtMs,
    clientId: candidate.clientId,
  };
}

export type PlanResolution =
  | { action: 'adopt-remote'; planner: Planner; updatedAtMs: number }
  | { action: 'upload-local'; planner: Planner; updatedAtMs: number }
  | { action: 'in-sync'; planner: Planner; updatedAtMs: number };

/**
 * Decide what a device should do when it sees the cloud copy.
 *
 * `localUpdatedAtMs` is 0 for a plan this device has never synced, so a first
 * sign-in on a second device adopts the cloud plan instead of overwriting it.
 */
export function resolvePlan(
  local: Planner,
  localUpdatedAtMs: number,
  remote: ParsedPlan | undefined,
): PlanResolution {
  if (!remote) {
    return { action: 'upload-local', planner: local, updatedAtMs: Math.max(localUpdatedAtMs, 1) };
  }

  if (plannersEqual(local, remote.planner)) {
    return { action: 'in-sync', planner: remote.planner, updatedAtMs: remote.updatedAtMs };
  }

  if (remote.updatedAtMs > localUpdatedAtMs) {
    return { action: 'adopt-remote', planner: remote.planner, updatedAtMs: remote.updatedAtMs };
  }

  if (localUpdatedAtMs > remote.updatedAtMs) {
    return { action: 'upload-local', planner: local, updatedAtMs: localUpdatedAtMs };
  }

  // Same timestamp, different content: both devices pick the same winner.
  const localText = stableStringify(omitUndefinedDeep(local));
  const remoteText = stableStringify(omitUndefinedDeep(remote.planner));
  return localText > remoteText
    ? { action: 'upload-local', planner: local, updatedAtMs: localUpdatedAtMs }
    : { action: 'adopt-remote', planner: remote.planner, updatedAtMs: remote.updatedAtMs };
}

/** Writes must never move `updatedAtMs` backwards — the rules reject that. */
export function nextUpdatedAtMs(now: number, lastKnown: number): number {
  return now > lastKnown ? now : lastKnown + 1;
}
