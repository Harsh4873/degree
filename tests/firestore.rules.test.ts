import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

const PROJECT_ID = 'demo-degree';
const TEST_EMAIL = 'user.one@example.com';
const OWNER_UID = 'degree-owner';
const EMULATOR_ADDRESS = process.env.FIRESTORE_EMULATOR_HOST;

function authorizedContext(
  testEnvironment: RulesTestEnvironment,
  uid = OWNER_UID,
  overrides: Record<string, unknown> = {},
): RulesTestContext {
  return testEnvironment.authenticatedContext(uid, {
    email: TEST_EMAIL,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
    ...overrides,
  });
}

const PLANNER = {
  terms: [{ id: 'term-1', name: 'Fall 2026', courses: [] }],
  completedBreadth: { theory: false, systems: true, software: false },
};

const PLAN_DOC = {
  schemaVersion: 1,
  planner: PLANNER,
  updatedAt: '2026-07-12T10:00:00.000Z',
  updatedAtMs: 1_752_314_400_000,
  clientId: 'device-a',
};

describe.skipIf(!EMULATOR_ADDRESS)('Degree Canvas Firestore security rules', () => {
  let testEnvironment: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, rawPort] = EMULATOR_ADDRESS!.split(':');
    const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

    testEnvironment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { host, port: Number(rawPort), rules },
    });
  });

  afterEach(async () => {
    await testEnvironment.clearFirestore();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it('allows the verified Google owner to read and write their own plan', async () => {
    const firestore = authorizedContext(testEnvironment).firestore();
    await assertSucceeds(setDoc(doc(firestore, 'degree_users', OWNER_UID), PLAN_DOC));
    await assertSucceeds(getDoc(doc(firestore, 'degree_users', OWNER_UID)));
  });

  it('allows another verified Google account its own UID-scoped plan', async () => {
    const secondUid = 'second-degree-user';
    const firestore = authorizedContext(testEnvironment, secondUid, { email: 'someone-else@gmail.com' }).firestore();
    await assertSucceeds(setDoc(doc(firestore, 'degree_users', secondUid), PLAN_DOC));
    await assertSucceeds(getDoc(doc(firestore, 'degree_users', secondUid)));
  });

  it('rejects a plan with an unexpected schema version', async () => {
    const firestore = authorizedContext(testEnvironment).firestore();
    await assertFails(setDoc(doc(firestore, 'degree_users', OWNER_UID), { ...PLAN_DOC, schemaVersion: 99 }));
  });

  it('rejects a plan that is missing or misshapes required fields', async () => {
    const firestore = authorizedContext(testEnvironment).firestore();
    const reference = doc(firestore, 'degree_users', OWNER_UID);

    const { clientId, ...withoutClientId } = PLAN_DOC;
    void clientId;
    await assertFails(setDoc(reference, withoutClientId));
    await assertFails(setDoc(reference, { ...PLAN_DOC, updatedAtMs: '2026-07-12' }));
    await assertFails(setDoc(reference, { ...PLAN_DOC, planner: { terms: 'nope', completedBreadth: {} } }));
    await assertFails(setDoc(reference, { ...PLAN_DOC, extraField: true }));
  });

  it('refuses updates that move updatedAtMs backwards', async () => {
    const firestore = authorizedContext(testEnvironment).firestore();
    const reference = doc(firestore, 'degree_users', OWNER_UID);

    await assertSucceeds(setDoc(reference, PLAN_DOC));
    await assertFails(setDoc(reference, { ...PLAN_DOC, updatedAtMs: PLAN_DOC.updatedAtMs - 1 }));
    await assertSucceeds(setDoc(reference, { ...PLAN_DOC, updatedAtMs: PLAN_DOC.updatedAtMs + 1 }));
  });

  it('rejects accounts without verification or the Google provider', async () => {
    const unverified = authorizedContext(testEnvironment, OWNER_UID, { email_verified: false }).firestore();
    await assertFails(getDoc(doc(unverified, 'degree_users', OWNER_UID)));

    const passwordProvider = authorizedContext(testEnvironment, OWNER_UID, { firebase: { sign_in_provider: 'password' } }).firestore();
    await assertFails(getDoc(doc(passwordProvider, 'degree_users', OWNER_UID)));
  });

  it('rejects a user reading a different uid, and anonymous access anywhere', async () => {
    const otherUid = authorizedContext(testEnvironment, 'someone-else').firestore();
    await assertFails(getDoc(doc(otherUid, 'degree_users', OWNER_UID)));

    const anonymous = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, 'degree_users', OWNER_UID)));
    await assertFails(setDoc(doc(anonymous, 'degree_users', OWNER_UID), PLAN_DOC));
  });

  it('keeps the other harsh.bet apps working in the combined ruleset', async () => {
    const firestore = authorizedContext(testEnvironment).firestore();

    const slateRoot = doc(firestore, 'slate_users', OWNER_UID);
    await assertSucceeds(setDoc(slateRoot, {
      schemaVersion: 1,
      settings: { theme: 'dark' },
      updatedAt: '2026-07-12T10:00:00.000Z',
    }));

    const daymarkRoot = doc(firestore, 'daymark_users', OWNER_UID);
    await assertSucceeds(setDoc(daymarkRoot, {
      generationId: 'generation-1',
      profileGenerationId: 'generation-1',
    }));

    const anonymous = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, 'slate_users', OWNER_UID)));
    await assertFails(getDoc(doc(anonymous, 'daymark_users', OWNER_UID)));
  });
});
