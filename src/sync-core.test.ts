import { describe, expect, it } from 'vitest';
import {
  DEGREE_SCHEMA_VERSION,
  decodePlanner,
  encodePlanner,
  isVerifiedGoogleAccount,
  isRecoverablePlanner,
  applyCompletedPush,
  accountSwitchRequiresFreshPlan,
  nextUpdatedAtMs,
  omitUndefinedDeep,
  parsePlanDocument,
  plannersEqual,
  resolvePlan,
  serializePlanDocument,
  stableStringify,
  syncStampStorageKey,
  type ParsedPlan,
} from './sync-core';
import { createSeedPlanner, upcomingTermNames } from './catalog';
import { createExamplePlanner } from './examplePlan';
import type { Planner } from './types';

const emptyBreadth = { theory: false, systems: true, software: false };

function plannerWith(termName: string): Planner {
  return {
    terms: [{ id: 'term-1', name: termName, courses: [] }],
    completedBreadth: { ...emptyBreadth },
  };
}

function cloudDoc(planner: Planner, updatedAtMs: number, clientId = 'remote'): ParsedPlan {
  return parsePlanDocument(serializePlanDocument(planner, clientId, updatedAtMs))!;
}

describe('stableStringify', () => {
  it('is insensitive to key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('preserves array order', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe('sync account requirements', () => {
  it('uses the current token provider when available, matching Firestore rules', () => {
    expect(isVerifiedGoogleAccount({
      emailVerified: true,
      email: 'owner@example.test',
      signInProvider: 'google.com',
    })).toBe(true);
    expect(isVerifiedGoogleAccount({
      emailVerified: false,
      email: 'owner@example.test',
      signInProvider: 'google.com',
    })).toBe(false);
    expect(isVerifiedGoogleAccount({
      emailVerified: true,
      email: 'owner@example.test',
      signInProvider: 'password',
    })).toBe(false);
    expect(isVerifiedGoogleAccount({
      emailVerified: true,
      email: 'owner@example.test',
      signInProvider: undefined,
    })).toBe(false);
    expect(isVerifiedGoogleAccount({
      email: null,
      emailVerified: true,
      signInProvider: 'google.com',
    })).toBe(false);
  });
});

describe('account-scoped sync metadata', () => {
  it('uses a different stamp key for every uid', () => {
    expect(syncStampStorageKey('account-a')).not.toBe(syncStampStorageKey('account-b'));
  });

  it('resets the visible plan only when switching between known accounts', () => {
    expect(accountSwitchRequiresFreshPlan(null, 'account-a')).toBe(false);
    expect(accountSwitchRequiresFreshPlan('account-a', 'account-a')).toBe(false);
    expect(accountSwitchRequiresFreshPlan('account-a', 'account-b')).toBe(true);
  });

  it('does not let a late older push roll the logical clock backwards', () => {
    const current = { stamp: 200, syncedText: 'new', lastSyncedAt: 200 };
    expect(applyCompletedPush(current, 100, 'old')).toEqual(current);
    expect(applyCompletedPush(current, 300, 'latest')).toEqual({
      stamp: 300, syncedText: 'latest', lastSyncedAt: 300,
    });
  });
});

describe('omitUndefinedDeep', () => {
  it('drops undefined values Firestore would reject', () => {
    const cleaned = omitUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: 2 } });
    expect(cleaned).toEqual({ a: 1, c: { e: 2 } });
  });

  it('walks arrays of objects', () => {
    expect(omitUndefinedDeep([{ a: undefined, b: 1 }])).toEqual([{ b: 1 }]);
  });
});

describe('serializePlanDocument', () => {
  it('produces exactly the fields the security rules allow', () => {
    const doc = serializePlanDocument(plannerWith('Fall 2026'), 'client-a', 1_700_000_000_000);
    expect(Object.keys(doc).sort()).toEqual([
      'clientId', 'planner', 'schemaVersion', 'updatedAt', 'updatedAtMs',
    ]);
    expect(doc.schemaVersion).toBe(DEGREE_SCHEMA_VERSION);
    expect(doc.updatedAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('strips optional catalog fields that are undefined', () => {
    const planner: Planner = {
      terms: [{
        id: 'term-1',
        name: 'Fall 2026',
        courses: [{
          id: 'c1', code: 'CSCE 601', title: 'Course', defaultCredits: 3, credits: 3,
          kind: 'csce-graded', source: 'official', instanceId: 'i1',
          breadth: undefined, description: undefined,
        }],
      }],
      completedBreadth: { ...emptyBreadth },
    };
    const doc = serializePlanDocument(planner, 'client-a', 1);
    expect('breadth' in doc.planner.terms[0].courses[0]).toBe(false);
  });
});

describe('parsePlanDocument', () => {
  it('round-trips a serialized document', () => {
    const planner = plannerWith('Spring 2027');
    const raw = serializePlanDocument(planner, 'client-a', 42);
    expect(parsePlanDocument(raw)?.planner).toEqual(planner);
  });

  it('rejects malformed or foreign-schema documents', () => {
    const good = serializePlanDocument(plannerWith('Fall 2026'), 'client-a', 42);
    expect(parsePlanDocument(undefined)).toBeUndefined();
    expect(parsePlanDocument({ ...good, schemaVersion: 99 })).toBeUndefined();
    expect(parsePlanDocument({ ...good, updatedAtMs: 'soon' })).toBeUndefined();
    expect(parsePlanDocument({ ...good, planner: { terms: 'nope', completedBreadth: emptyBreadth } })).toBeUndefined();
    expect(parsePlanDocument({ ...good, planner: { terms: [], completedBreadth: { theory: false } } })).toBeUndefined();
  });
});

describe('prerequisitePaths wire encoding', () => {
  // Firestore rejects an array of arrays, so `string[][]` travels as maps.
  const withPrerequisites = (): Planner => ({
    terms: [{
      id: 'term-1',
      name: 'Fall 2026',
      courses: [{
        id: 'c1', code: 'CSCE 612', title: 'Course', defaultCredits: 3, credits: 3,
        kind: 'csce-graded', source: 'official', instanceId: 'i1',
        prerequisiteText: 'CSCE 410 or CSCE 611',
        prerequisitePaths: [['CSCE 410'], ['CSCE 611']],
      }],
    }],
    completedBreadth: { ...emptyBreadth },
  });

  it('never emits a nested array on the wire', () => {
    const doc = serializePlanDocument(withPrerequisites(), 'client-a', 1);
    const encoded = doc.planner.terms[0].courses[0].prerequisitePaths;
    expect(encoded).toEqual([{ courses: ['CSCE 410'] }, { courses: ['CSCE 611'] }]);
    expect(encoded!.every((path) => !Array.isArray(path))).toBe(true);
  });

  it('restores the nested array on the way back', () => {
    const planner = withPrerequisites();
    const parsed = parsePlanDocument(serializePlanDocument(planner, 'client-a', 1));
    expect(parsed?.planner).toEqual(planner);
    expect(parsed?.planner.terms[0].courses[0].prerequisitePaths).toEqual([['CSCE 410'], ['CSCE 611']]);
  });

  it('leaves courses without prerequisites untouched', () => {
    const planner = plannerWith('Fall 2026');
    expect(decodePlanner(encodePlanner(planner))).toEqual(planner);
  });

  it('drops malformed paths rather than crashing the board', () => {
    const raw = serializePlanDocument(withPrerequisites(), 'client-a', 1);
    raw.planner.terms[0].courses[0].prerequisitePaths = [
      { courses: ['CSCE 410'] },
      { courses: [] },
      {} as { courses: string[] },
    ];
    expect(parsePlanDocument(raw)?.planner.terms[0].courses[0].prerequisitePaths)
      .toEqual([['CSCE 410']]);
  });
});

describe('the starting board a new visitor gets', () => {
  it('is empty, with no courses and no assumptions ticked', () => {
    const seed = createSeedPlanner(new Date('2026-08-10T12:00:00Z'));
    expect(seed.terms.every((term) => term.courses.length === 0)).toBe(true);
    expect(seed.completedBreadth).toEqual({ theory: false, systems: false, software: false });
  });

  it('names terms from the current date rather than a fixed calendar', () => {
    expect(createSeedPlanner(new Date('2026-08-10T12:00:00Z')).terms.map((term) => term.name))
      .toEqual(['Fall 2026', 'Spring 2027', 'Summer 2027', 'Fall 2027']);
    expect(createSeedPlanner(new Date('2027-02-01T12:00:00Z')).terms.map((term) => term.name))
      .toEqual(['Spring 2027', 'Summer 2027', 'Fall 2027', 'Spring 2028']);
  });

  it('carries nothing that identifies a particular student', () => {
    const text = JSON.stringify(createSeedPlanner(new Date('2026-08-10T12:00:00Z')));
    expect(text).not.toMatch(/CSCE|691|671|627/);
  });
});

describe('sign-in recovery guard', () => {
  it('rejects an empty seed document even when its wire schema is valid', () => {
    const seed = createSeedPlanner(new Date('2026-08-10T12:00:00Z'));
    const parsed = parsePlanDocument(serializePlanDocument(seed, 'empty-device', 100));
    expect(parsed).toBeDefined();
    expect(isRecoverablePlanner(parsed!.planner)).toBe(false);
  });

  it('accepts a validated planner only after at least one course is present', () => {
    expect(isRecoverablePlanner(createExamplePlanner())).toBe(true);
  });
});

describe('upcomingTermNames', () => {
  it('rolls Spring into Summer into Fall and then into the next year', () => {
    expect(upcomingTermNames(new Date('2026-03-01T12:00:00Z'), 4))
      .toEqual(['Spring 2026', 'Summer 2026', 'Fall 2026', 'Spring 2027']);
  });

  it('treats June and July as Summer and August onward as Fall', () => {
    expect(upcomingTermNames(new Date('2026-06-15T12:00:00Z'), 1)).toEqual(['Summer 2026']);
    expect(upcomingTermNames(new Date('2026-08-01T12:00:00Z'), 1)).toEqual(['Fall 2026']);
    expect(upcomingTermNames(new Date('2026-12-31T12:00:00Z'), 1)).toEqual(['Fall 2026']);
  });
});

describe('a densely populated real plan', () => {
  function findNestedArray(value: unknown, path = 'planner'): string | undefined {
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        if (Array.isArray(item)) return `${path}[${index}]`;
        const nested = findNestedArray(item, `${path}[${index}]`);
        if (nested) return nested;
      }
      return undefined;
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        const nested = findNestedArray(item, `${path}.${key}`);
        if (nested) return nested;
      }
    }
    return undefined;
  }

  it('serializes to a document Firestore can actually store', () => {
    const doc = serializePlanDocument(createExamplePlanner(), 'client-a', 1);
    // Firestore rejects any array whose elements are arrays, and the catalog
    // ships `prerequisitePaths: string[][]` on several courses.
    expect(findNestedArray(doc.planner)).toBeUndefined();
  });

  it('survives a full round trip unchanged', () => {
    const planner = createExamplePlanner();
    const parsed = parsePlanDocument(serializePlanDocument(planner, 'client-a', 1));
    expect(parsed?.planner).toEqual(planner);
  });
});

describe('resolvePlan', () => {
  it('uploads the local plan when the cloud has nothing', () => {
    const local = plannerWith('Fall 2026');
    expect(resolvePlan(local, 0, undefined)).toEqual({
      action: 'upload-local', planner: local, updatedAtMs: 1,
    });
  });

  it('adopts the cloud plan on a device that has never synced', () => {
    const remote = cloudDoc(plannerWith('Cloud term'), 500);
    const resolution = resolvePlan(plannerWith('Local term'), 0, remote);
    expect(resolution.action).toBe('adopt-remote');
    expect(resolution.planner).toEqual(remote.planner);
  });

  it('keeps the newer local plan when this device edited last', () => {
    const local = plannerWith('Local term');
    const resolution = resolvePlan(local, 900, cloudDoc(plannerWith('Cloud term'), 500));
    expect(resolution.action).toBe('upload-local');
    expect(resolution.updatedAtMs).toBe(900);
  });

  it('reports in-sync without a write when the plans already match', () => {
    const planner = plannerWith('Fall 2026');
    expect(resolvePlan(planner, 100, cloudDoc(planner, 500)).action).toBe('in-sync');
  });

  it('converges on the same winner when timestamps tie', () => {
    const left = plannerWith('AAA');
    const right = plannerWith('BBB');
    const fromLeft = resolvePlan(left, 500, cloudDoc(right, 500));
    const fromRight = resolvePlan(right, 500, cloudDoc(left, 500));
    expect(fromLeft.planner).toEqual(fromRight.planner);
  });
});

describe('plannersEqual', () => {
  it('ignores undefined-only differences', () => {
    const a = plannerWith('Fall 2026');
    const b = { ...plannerWith('Fall 2026'), extra: undefined } as unknown as Planner;
    expect(plannersEqual(a, b)).toBe(true);
  });

  it('sees real differences', () => {
    expect(plannersEqual(plannerWith('A'), plannerWith('B'))).toBe(false);
  });
});

describe('nextUpdatedAtMs', () => {
  it('uses the clock when it has moved forward', () => {
    expect(nextUpdatedAtMs(1_000, 500)).toBe(1_000);
  });

  it('never moves backwards when the clock is behind', () => {
    expect(nextUpdatedAtMs(400, 500)).toBe(501);
    expect(nextUpdatedAtMs(500, 500)).toBe(501);
  });
});
