import React from 'react';
import type { DireactreeMutation, TreeNode } from './types';
import type { VisibleItem } from './treeUtils';
import { findNode } from './treeUtils';
import { isPromise, toErrorMessage } from './shared';

export type LoadEntry = { status: 'loading' } | { status: 'error'; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = TreeNode<any>;

/**
 * Calls `onLoadChildren` the first time a folder with `hasChildren` and no
 * `children` is open, and tracks loading and error state per folder.
 */
export function useLazyChildren({
  enabled,
  visibleItems,
  expanded,
  structureRef,
  onLoadChildrenRef,
  onActionErrorRef,
  loadFailedRef,
}: {
  enabled: boolean;
  visibleItems: VisibleItem<unknown>[];
  expanded: Record<string, boolean>;
  structureRef: React.MutableRefObject<AnyNode[]>;
  onLoadChildrenRef: React.MutableRefObject<((node: AnyNode) => void | Promise<unknown>) | undefined>;
  onActionErrorRef: React.MutableRefObject<((error: unknown, action: DireactreeMutation) => void) | undefined>;
  loadFailedRef: React.MutableRefObject<string>;
}) {
  const [loadState, setLoadState] = React.useState<Record<string, LoadEntry>>({});
  const requestedRef = React.useRef<Record<string, boolean>>({});
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startLoad = React.useCallback((node: AnyNode) => {
    const load = onLoadChildrenRef.current;
    if (!load) {
      return;
    }
    requestedRef.current[node.id] = true;
    setLoadState(prev => ({ ...prev, [node.id]: { status: 'loading' } }));
    const fail = (error: unknown) => {
      if (mountedRef.current) {
        setLoadState(prev => ({
          ...prev,
          [node.id]: { status: 'error', message: toErrorMessage(error, loadFailedRef.current) },
        }));
      }
      onActionErrorRef.current?.(error, 'load');
    };
    const done = () => {
      if (!mountedRef.current) {
        return;
      }
      setLoadState(prev => {
        if (!prev[node.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[node.id];
        return next;
      });
    };
    let result: unknown;
    try {
      result = load(node);
    } catch (error) {
      fail(error);
      return;
    }
    if (isPromise(result)) {
      result.then(done, fail);
    } else {
      done();
    }
  }, [onLoadChildrenRef, onActionErrorRef, loadFailedRef]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    for (const item of visibleItems) {
      const node = item.node;
      if (
        node.type === 'folder'
        && node.hasChildren
        && node.children === undefined
        && expanded[node.id]
        && !requestedRef.current[node.id]
      ) {
        startLoad(node);
      }
    }
  }, [enabled, visibleItems, expanded, startLoad]);

  const retry = (id: string) => {
    const node = findNode(structureRef.current, id);
    if (node) {
      startLoad(node);
    }
  };

  return { loadState, retry };
}
