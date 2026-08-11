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
  nextUpdatedAtMs,
  parsePlanDocument,
  plannerFingerprint,
  resolvePlan,
  serializePlanDocument,
} from './sync-core';
import type { Planner } from './types';

const STAMP_KEY = 'degree-canvas-updated-at-v1';
const CLIENT_KEY = 'degree-canvas-client-v1';
const PUSH_DEBOUNCE_MS = 700;

export type SyncStatus = 'signed-out' | 'syncing' | 'synced' | 'offline' | 'action-needed';

export interface DegreeSync {
  status: SyncStatus;
  user: User | null;
  message?: string;
  lastSyncedAt?: number;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

function readStamp(): number {
  try {
    const raw = Number(window.localStorage.getItem(STAMP_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function writeStamp(value: number) {
  try {
    window.localStorage.setItem(STAMP_KEY, String(value));
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

/**
 * Keeps the planner mirrored in `degree_users/{uid}`.
 *
 * The planner works fully signed-out — Firestore is an optional layer on top
 * of the existing localStorage copy. Any verified Google account gets its own
 * UID-scoped plan; there is deliberately no email allowlist, so the same build
 * serves every visitor rather than one owner.
 */
export function useDegreeSync(
  planner: Planner,
  applyRemotePlanner: (planner: Planner) => void,
): DegreeSync {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>('signed-out');
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>(undefined);

  const plannerRef = useRef(planner);
  const stampRef = useRef(0);
  const syncedTextRef = useRef<string | undefined>(undefined);
  const uidRef = useRef<string | null>(null);
  const clientIdRef = useRef('');
  const pushTimerRef = useRef<number | undefined>(undefined);
  const applyRemoteRef = useRef(applyRemotePlanner);
  const adoptingRef = useRef(false);
  const baselineSetRef = useRef(false);

  applyRemoteRef.current = applyRemotePlanner;
  plannerRef.current = planner;

  if (!clientIdRef.current && typeof window !== 'undefined') {
    clientIdRef.current = readClientId();
    stampRef.current = readStamp();
  }

  const push = useCallback(async (uid: string, next: Planner, updatedAtMs: number) => {
    const payload = serializePlanDocument(next, clientIdRef.current, updatedAtMs);
    await setDoc(doc(degreeFirestore, 'degree_users', uid), payload);
    syncedTextRef.current = plannerFingerprint(next);
    stampRef.current = updatedAtMs;
    writeStamp(updatedAtMs);
    setLastSyncedAt(updatedAtMs);
  }, []);

  // Push local edits, coalesced so a drag across the board is one write.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const text = plannerFingerprint(planner);

    // A plan we just adopted from the cloud is already the cloud's copy.
    if (syncedTextRef.current === text) return;

    if (adoptingRef.current) {
      adoptingRef.current = false;
      syncedTextRef.current = text;
      return;
    }

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
    writeStamp(stamp);

    const uid = uidRef.current;
    if (!uid) return;

    window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      if (uidRef.current !== uid) return;
      setStatus(navigator.onLine ? 'syncing' : 'offline');
      void push(uid, plannerRef.current, stampRef.current)
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

    function stopListening() {
      unsubscribeDoc?.();
      unsubscribeDoc = undefined;
    }

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
      if (disposed) return;
      stopListening();
      window.clearTimeout(pushTimerRef.current);
      uidRef.current = null;
      syncedTextRef.current = undefined;
      setUser(authUser);

      if (!authUser) {
        setStatus(navigator.onLine ? 'signed-out' : 'offline');
        setMessage(undefined);
        setLastSyncedAt(undefined);
        return;
      }

      // No email allowlist: every verified Google account gets its own plan.
      if (!authUser.emailVerified) {
        setStatus('action-needed');
        setMessage('Use a verified Google account to sync your plan.');
        void firebaseSignOut(firebaseAuth);
        return;
      }

      const uid = authUser.uid;
      uidRef.current = uid;
      setStatus(navigator.onLine ? 'syncing' : 'offline');
      setMessage(undefined);

      unsubscribeDoc = onSnapshot(
        doc(degreeFirestore, 'degree_users', uid),
        (snapshot) => {
          if (disposed || uidRef.current !== uid) return;
          const remote = snapshot.exists() ? parsePlanDocument(snapshot.data()) : undefined;
          const resolution = resolvePlan(plannerRef.current, stampRef.current, remote);

          if (resolution.action === 'adopt-remote') {
            adoptingRef.current = true;
            syncedTextRef.current = plannerFingerprint(resolution.planner);
            stampRef.current = resolution.updatedAtMs;
            writeStamp(resolution.updatedAtMs);
            applyRemoteRef.current(resolution.planner);
            setLastSyncedAt(resolution.updatedAtMs);
            setStatus(navigator.onLine ? 'synced' : 'offline');
            return;
          }

          if (resolution.action === 'in-sync') {
            syncedTextRef.current = plannerFingerprint(resolution.planner);
            stampRef.current = Math.max(stampRef.current, resolution.updatedAtMs);
            writeStamp(stampRef.current);
            setLastSyncedAt(resolution.updatedAtMs);
            setStatus(navigator.onLine ? 'synced' : 'offline');
            return;
          }

          setStatus(navigator.onLine ? 'syncing' : 'offline');
          void push(uid, resolution.planner, resolution.updatedAtMs)
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
      if (!result.user.emailVerified) {
        await firebaseSignOut(firebaseAuth);
        throw new Error('Use a verified Google account to sync your plan.');
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

  return { status, user, message, lastSyncedAt, signIn, signOut };
}
