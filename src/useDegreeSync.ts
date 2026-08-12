import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, waitForPendingWrites } from 'firebase/firestore';
import { authPersistenceReady, degreeFirestore, firebaseAuth, googleProvider } from './firebase';
import {
  applyCompletedPush,
  isVerifiedGoogleAccount,
  isRecoverablePlanner,
  nextUpdatedAtMs,
  parsePlanDocument,
  plannerFingerprint,
  resolvePlan,
  serializePlanDocument,
  syncStampStorageKey,
} from './sync-core';
import { resolveOwnerVault } from './owner-vault';
import type { Planner } from './types';

const CLIENT_KEY = 'degree-canvas-client-v1';
const PLAN_OWNER_KEY = 'degree-canvas-plan-owner-v1';
const UNSCOPED_STAMP_KEY = 'degree-canvas-updated-at-unscoped-v2';
const PUSH_DEBOUNCE_MS = 700;

export type SyncStatus = 'signed-out' | 'syncing' | 'synced' | 'offline' | 'action-needed';

export interface DegreeSync {
  status: SyncStatus;
  user: User | null;
  message?: string;
  lastSyncedAt?: number;
  /** True until the existing shared-vault planner has been validated and adopted. */
  isHydrating: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

function readStamp(uid: string): number {
  try {
    const raw = Number(window.localStorage.getItem(syncStampStorageKey(uid)));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function writeStamp(uid: string, value: number) {
  try {
    window.localStorage.setItem(syncStampStorageKey(uid), String(value));
  } catch {
  }
}

function readPlanOwner(): string | null {
  try {
    return window.localStorage.getItem(PLAN_OWNER_KEY);
  } catch {
    return null;
  }
}

function writePlanOwner(uid: string) {
  try {
    window.localStorage.setItem(PLAN_OWNER_KEY, uid);
  } catch {
  }
}

function readUnscopedStamp(): number {
  try {
    const raw = Number(window.localStorage.getItem(UNSCOPED_STAMP_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function writeUnscopedStamp(value: number) {
  try {
    window.localStorage.setItem(UNSCOPED_STAMP_KEY, String(value));
  } catch {
  }
}

function clearUnscopedStamp() {
  try {
    window.localStorage.removeItem(UNSCOPED_STAMP_KEY);
  } catch {
  }
}

function readClientId(): string {
  try {
    const existing = window.localStorage.getItem(CLIENT_KEY);
    if (existing) return existing;
    const created = `device-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(CLIENT_KEY, created);
    return created;
  } catch {
    return 'device-ephemeral';
  }
}

function friendlyError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in was closed before it finished. Try again when you are ready.';
  }
  if (code === 'auth/popup-blocked') {
    return 'The browser blocked the sign-in popup. Allow popups for this site and try again.';
  }
  if (code === 'permission-denied') {
    return 'The plan could not be saved to your account. Your edits are still safe on this device.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Sync hit an unexpected problem. It will retry on the next change.';
}

async function hasEligibleSyncSession(user: User): Promise<boolean> {
  let signInProvider: string | null | undefined;
  try {
    signInProvider = (await user.getIdTokenResult()).signInProvider ?? null;
  } catch {
    signInProvider = undefined;
  }
  return isVerifiedGoogleAccount({
    email: user.email,
    emailVerified: user.emailVerified,
    signInProvider,
  });
}

/**
 * Keeps the planner mirrored in `degree_users/{vaultId}`.
 *
 * The planner works fully signed-out — Firestore is an optional layer on top
 * of the existing localStorage copy. Approved Google identities resolve to one
 * private shared vault. The cloud planner is authoritative during hydration;
 * the visible browser plan stays locked and is never replaced by an empty seed.
 */
export function useDegreeSync(
  planner: Planner,
  applyRemotePlanner: (planner: Planner) => void,
): DegreeSync {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>('signed-out');
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>(undefined);
  const [isHydrating, setIsHydrating] = useState(false);

  const plannerRef = useRef(planner);
  const stampRef = useRef(0);
  const syncedTextRef = useRef<string | undefined>(undefined);
  const uidRef = useRef<string | null>(null);
  const clientIdRef = useRef('');
  const pushTimerRef = useRef<number | undefined>(undefined);
  const editStampRef = useRef<number | undefined>(undefined);
  const applyRemoteRef = useRef(applyRemotePlanner);
  const adoptingRef = useRef(false);
  const baselineSetRef = useRef(false);
  const blockedAccountMessageRef = useRef<string | null>(null);
  const sessionRevisionRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSyncedAtRef = useRef<number | undefined>(undefined);
  const hydratingRef = useRef(false);

  applyRemoteRef.current = applyRemotePlanner;
  plannerRef.current = planner;

  if (!clientIdRef.current && typeof window !== 'undefined') {
    clientIdRef.current = readClientId();
  }

  const push = useCallback((uid: string, next: Planner, updatedAtMs: number, revision = sessionRevisionRef.current) => {
    const completedText = plannerFingerprint(next);
    const operation = writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (uidRef.current !== uid || sessionRevisionRef.current !== revision) return;
        const payload = serializePlanDocument(next, clientIdRef.current, updatedAtMs);
        await setDoc(doc(degreeFirestore, 'degree_users', uid), payload);
        if (uidRef.current !== uid || sessionRevisionRef.current !== revision) return;
        const completed = applyCompletedPush({
          stamp: stampRef.current,
          syncedText: syncedTextRef.current,
          lastSyncedAt: lastSyncedAtRef.current,
        }, updatedAtMs, completedText);
        stampRef.current = completed.stamp;
        syncedTextRef.current = completed.syncedText;
        writeStamp(uid, completed.stamp);
        if (completed.lastSyncedAt !== undefined) {
          lastSyncedAtRef.current = completed.lastSyncedAt;
          setLastSyncedAt(completed.lastSyncedAt);
        }
      });
    writeQueueRef.current = operation;
    return operation;
  }, []);

  // Push local edits, coalesced so a drag across the board is one write.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const text = plannerFingerprint(planner);

    // Authentication is not an edit. While the vault snapshot is loading the
    // existing board remains visible but locked, and no local fingerprint may
    // acquire a fresh timestamp or be uploaded over the recovery copy.
    if (hydratingRef.current) return;

    if (adoptingRef.current) {
      adoptingRef.current = false;
      syncedTextRef.current = text;
      return;
    }

    // A plan we just adopted from the cloud is already the cloud's copy.
    if (syncedTextRef.current === text) return;

    // The first planner this hook sees is whatever the device already had —
    // a stored plan, or the empty starting board. That is not an edit, and
    // stamping it with the current time would make an untouched board look
    // newer than the plan in the account and overwrite it on the next sign-in.
    if (!baselineSetRef.current) {
      baselineSetRef.current = true;
      syncedTextRef.current = text;
      return;
    }

    const stamp = nextUpdatedAtMs(Date.now(), stampRef.current);
    stampRef.current = stamp;
    editStampRef.current = stamp;
    const currentUid = uidRef.current;
    const planOwner = currentUid ?? readPlanOwner();
    if (planOwner) writeStamp(planOwner, stamp);
    else writeUnscopedStamp(stamp);

    const uid = currentUid;
    if (!uid) return;

    window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      if (uidRef.current !== uid) return;
      const queuedStamp = editStampRef.current ?? stampRef.current;
      setStatus(navigator.onLine ? 'syncing' : 'offline');
      void push(uid, plannerRef.current, queuedStamp)
        .then(() => {
          if (uidRef.current !== uid) return;
          setStatus(navigator.onLine ? 'synced' : 'offline');
          setMessage(undefined);
        })
        .catch((error) => {
          if (uidRef.current !== uid) return;
          setStatus('action-needed');
          setMessage(friendlyError(error));
        });
    }, PUSH_DEBOUNCE_MS);
  }, [planner, push]);

  useEffect(() => {
    let disposed = false;
    let unsubscribeDoc: (() => void) | undefined;
    let authSequence = 0;

    function stopListening() {
      unsubscribeDoc?.();
      unsubscribeDoc = undefined;
    }

    async function startSession(authUser: User, sequence: number) {
      const eligible = await hasEligibleSyncSession(authUser);
      if (disposed || sequence !== authSequence) return;
      if (!eligible) {
        const reason = 'Degree syncs only verified sessions signed in with Google. Sign in again with the Google button.';
        blockedAccountMessageRef.current = reason;
        setStatus('action-needed');
        setMessage(reason ?? undefined);
        await firebaseSignOut(firebaseAuth).catch(() => undefined);
        return;
      }

      let membership;
      try {
        membership = await resolveOwnerVault(degreeFirestore, authUser);
      } catch (error) {
        if (disposed || sequence !== authSequence) return;
        const reason = error instanceof Error ? error.message : 'This account cannot access the shared owner vault.';
        blockedAccountMessageRef.current = reason;
        setStatus('action-needed');
        setMessage(reason);
        return;
      }
      if (disposed || sequence !== authSequence) return;

      setUser(authUser);
      const uid = membership.vaultId;
      sessionRevisionRef.current = sequence;
      uidRef.current = uid;
      const accountStamp = readStamp(uid);
      stampRef.current = accountStamp;
      editStampRef.current = undefined;
      hydratingRef.current = true;
      setIsHydrating(true);
      setStatus(navigator.onLine ? 'syncing' : 'offline');
      setMessage('Loading the existing shared-vault planner…');

      unsubscribeDoc = onSnapshot(
        doc(degreeFirestore, 'degree_users', uid),
        (snapshot) => {
          if (disposed || uidRef.current !== uid) return;
          const parsedRemote = snapshot.exists() ? parsePlanDocument(snapshot.data()) : undefined;
          const remote = parsedRemote && isRecoverablePlanner(parsedRemote.planner)
            ? parsedRemote
            : undefined;
          if (!remote) {
            setStatus('action-needed');
            setMessage('The shared vault has no validated Degree recovery copy. Nothing was uploaded; restore the archived planner before continuing.');
            return;
          }

          // First load is recovery-first: the migrated shared-vault document
          // always wins over this browser's possibly empty or stale board.
          if (hydratingRef.current) {
            adoptingRef.current = true;
            syncedTextRef.current = plannerFingerprint(remote.planner);
            stampRef.current = remote.updatedAtMs;
            writeStamp(uid, remote.updatedAtMs);
            writePlanOwner(uid);
            clearUnscopedStamp();
            applyRemoteRef.current(remote.planner);
            hydratingRef.current = false;
            setIsHydrating(false);
            setLastSyncedAt(remote.updatedAtMs);
            lastSyncedAtRef.current = remote.updatedAtMs;
            setStatus(navigator.onLine ? 'synced' : 'offline');
            setMessage(undefined);
            return;
          }
          const resolution = resolvePlan(plannerRef.current, stampRef.current, remote);

          if (resolution.action === 'adopt-remote') {
            adoptingRef.current = true;
            syncedTextRef.current = plannerFingerprint(resolution.planner);
            stampRef.current = resolution.updatedAtMs;
            writeStamp(uid, resolution.updatedAtMs);
            applyRemoteRef.current(resolution.planner);
            setLastSyncedAt(resolution.updatedAtMs);
            lastSyncedAtRef.current = resolution.updatedAtMs;
            setStatus(navigator.onLine ? 'synced' : 'offline');
            return;
          }

          if (resolution.action === 'in-sync') {
            syncedTextRef.current = plannerFingerprint(resolution.planner);
            stampRef.current = Math.max(stampRef.current, resolution.updatedAtMs);
            writeStamp(uid, stampRef.current);
            setLastSyncedAt(resolution.updatedAtMs);
            lastSyncedAtRef.current = resolution.updatedAtMs;
            setStatus(navigator.onLine ? 'synced' : 'offline');
            return;
          }

          setStatus(navigator.onLine ? 'syncing' : 'offline');
          void push(uid, resolution.planner, resolution.updatedAtMs, sequence)
            .then(() => {
              if (disposed || uidRef.current !== uid) return;
              setStatus(navigator.onLine ? 'synced' : 'offline');
              setMessage(undefined);
            })
            .catch((error) => {
              if (disposed || uidRef.current !== uid) return;
              setStatus('action-needed');
              setMessage(friendlyError(error));
            });
        },
        (error) => {
          if (disposed || uidRef.current !== uid) return;
          setStatus('action-needed');
          setMessage(friendlyError(error));
        },
      );
    }

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
      if (disposed) return;
      const sequence = ++authSequence;
      sessionRevisionRef.current = sequence;
      stopListening();
      window.clearTimeout(pushTimerRef.current);
      editStampRef.current = undefined;
      uidRef.current = null;
      hydratingRef.current = false;
      setIsHydrating(false);
      syncedTextRef.current = undefined;
      setUser(null);

      if (!authUser) {
        const reason = blockedAccountMessageRef.current;
        blockedAccountMessageRef.current = null;
        setStatus(reason ? 'action-needed' : navigator.onLine ? 'signed-out' : 'offline');
        setMessage(reason ?? undefined);
        setLastSyncedAt(undefined);
        lastSyncedAtRef.current = undefined;
        return;
      }

      void startSession(authUser, sequence);
    });

    function handleOnline() {
      if (uidRef.current) setStatus('syncing');
      else setStatus('signed-out');
    }

    function handleOffline() {
      setStatus('offline');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      disposed = true;
      authSequence += 1;
      unsubscribeAuth();
      stopListening();
      window.clearTimeout(pushTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [push]);

  const signIn = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('offline');
      setMessage('Connect to the internet for the one-time Google sign-in.');
      return;
    }
    setStatus('syncing');
    setMessage(undefined);
    try {
      await authPersistenceReady;
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      if (!await hasEligibleSyncSession(result.user)) {
        const reason = 'Degree syncs only verified sessions signed in with Google. Sign in again with the Google button.';
        blockedAccountMessageRef.current = reason;
        await firebaseSignOut(firebaseAuth);
        throw new Error(reason);
      }
    } catch (error) {
      setStatus('action-needed');
      setMessage(friendlyError(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!uidRef.current) return;
    setStatus('syncing');
    setMessage('Finishing pending changes…');
    try {
      window.clearTimeout(pushTimerRef.current);
      if (navigator.onLine) await waitForPendingWrites(degreeFirestore);
      await firebaseSignOut(firebaseAuth);
      // The plan stays on this device — Degree Canvas works signed out, and
      // the local copy is what it has always used.
      setMessage(undefined);
    } catch (error) {
      setStatus('action-needed');
      setMessage(friendlyError(error));
    }
  }, []);

  return { status, user, message, lastSyncedAt, isHydrating, signIn, signOut };
}
