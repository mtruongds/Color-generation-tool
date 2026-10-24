import { useCallback, useEffect, useReducer, useRef } from 'react';

/** Changes closer together than this become one undo step, so a slider drag undoes in one go. */
const MERGE_MS = 600;
const LIMIT = 100;

const sameParts = <T extends object>(a: T, b: T) =>
  (Object.keys(a) as (keyof T)[]).every((k) => Object.is(a[k], b[k]));

/**
 * Undo and redo over a document made of several pieces of state. Every change to `doc` is recorded
 * unless `apply` caused it, so callers keep setting state as usual. `doc` should be memoized from
 * its parts, so it only changes when one of them does.
 */
export function useHistory<T extends object>(doc: T, apply: (doc: T) => void) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const current = useRef(doc);
  const lastChange = useRef(0);
  /** The document `apply` was just given, so its arrival isn't recorded as an edit. */
  const applied = useRef<T | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (current.current === doc) return;
    if (applied.current && sameParts(applied.current, doc)) {
      applied.current = null;
      current.current = doc;
      return;
    }
    const now = Date.now();
    if (now - lastChange.current > MERGE_MS || past.current.length === 0) {
      past.current.push(current.current);
      if (past.current.length > LIMIT) past.current.shift();
    }
    lastChange.current = now;
    future.current = [];
    current.current = doc;
    rerender();
  }, [doc]);

  const go = useCallback(
    (from: React.MutableRefObject<T[]>, to: React.MutableRefObject<T[]>) => {
      const target = from.current.pop();
      if (!target) return false;
      to.current.push(current.current);
      applied.current = target;
      lastChange.current = 0;
      apply(target);
      rerender();
      return true;
    },
    [apply],
  );

  const undo = useCallback(() => go(past, future), [go]);
  const redo = useCallback(() => go(future, past), [go]);

  /** Loads a document with a fresh history, e.g. after switching projects. */
  const reset = useCallback(
    (next: T) => {
      past.current = [];
      future.current = [];
      applied.current = next;
      lastChange.current = 0;
      apply(next);
      rerender();
    },
    [apply],
  );

  return {
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

/** True when a key event should go to a text field's own undo instead of the app's. */
export function isTextEditing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'range', 'color', 'button', 'submit'].includes(type);
  }
  return false;
}
