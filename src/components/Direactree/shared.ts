import React from 'react';
import type { DireactreeSlot } from './types';

/** The overlay element that holds the delete confirmation and the context menu. */
export const DireactreeOverlayContext = React.createContext<HTMLElement | null>(null);

/** Extra classes from the `classNames` prop. */
export const DireactreeClassNamesContext = React.createContext<Partial<Record<DireactreeSlot, string>> | undefined>(undefined);

/** Layout effect in the browser, plain effect on the server. Only for parts that never render on the server. */
export const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function useSlot(slot: DireactreeSlot): string | undefined {
  return React.useContext(DireactreeClassNamesContext)?.[slot];
}

export function escapeNodeId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(id);
  }
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as Promise<unknown>).then === 'function';
}

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}
