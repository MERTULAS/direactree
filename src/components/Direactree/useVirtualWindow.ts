import React from 'react';

export type ScrollBlock = 'start' | 'center' | 'end' | 'nearest';

/** Index of the row that contains the vertical position `y`. */
function rowIndexAt(offsets: number[], y: number): number {
  let low = 0;
  let high = offsets.length - 2;
  if (high < 0) {
    return 0;
  }
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid] <= y) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

function readRowHeightVar(element: HTMLElement): number {
  if (typeof getComputedStyle !== 'function') {
    return 0;
  }
  const value = parseFloat(getComputedStyle(element).getPropertyValue('--direactree-row-height'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Keeps track of the scroll position and returns which rows to render.
 * Every row is `rowHeight` tall except the one editor row at `tallIndex`, which is measured.
 */
export function useVirtualWindow({
  enabled,
  rowCount,
  rowHeight: fixedRowHeight,
  fallbackRowHeight,
  overscan,
  tallIndex,
  rootRef,
  viewportRef,
}: {
  enabled: boolean;
  rowCount: number;
  /** Set by the user. When missing, the `--direactree-row-height` CSS value is used. */
  rowHeight: number | undefined;
  fallbackRowHeight: number;
  overscan: number;
  tallIndex: number;
  rootRef: React.RefObject<HTMLElement>;
  viewportRef: React.RefObject<HTMLElement>;
}) {
  const [view, setView] = React.useState({ top: 0, height: 0 });
  const [tallHeight, setTallHeight] = React.useState(0);
  const [cssRowHeight, setCssRowHeight] = React.useState(0);
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const rowHeight = fixedRowHeight || cssRowHeight || fallbackRowHeight;

  const layout = React.useMemo(() => {
    if (!enabled) {
      return null;
    }
    const tall = tallHeight || rowHeight * 2;
    const offsets: number[] = new Array(rowCount + 1);
    offsets[0] = 0;
    for (let i = 0; i < rowCount; i += 1) {
      offsets[i + 1] = offsets[i] + (i === tallIndex ? tall : rowHeight);
    }
    return { offsets, total: offsets[rowCount] };
  }, [enabled, rowCount, rowHeight, tallIndex, tallHeight]);
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;

  React.useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }
    const measure = () => {
      setView(prev => (
        prev.height === viewport.clientHeight && prev.top === viewport.scrollTop
          ? prev
          : { top: viewport.scrollTop, height: viewport.clientHeight }
      ));
      if (rootRef.current) {
        const fromCss = readRowHeightVar(rootRef.current);
        setCssRowHeight(prev => (prev === fromCss ? prev : fromCss));
      }
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [enabled, rootRef, viewportRef]);

  // The create or rename editor is taller than a row. Measure it once it renders.
  React.useEffect(() => {
    if (!enabled || tallIndex === -1 || !viewportRef.current) {
      return;
    }
    const editor = viewportRef.current.querySelector('.direactree-row-editor, .direactree-row-renaming');
    if (editor instanceof HTMLElement && editor.offsetHeight > 0 && editor.offsetHeight !== tallHeight) {
      setTallHeight(editor.offsetHeight);
    }
  });

  let start = 0;
  let end = rowCount;
  if (layout) {
    const viewHeight = view.height || rowHeight * 12;
    start = Math.max(0, rowIndexAt(layout.offsets, view.top) - overscan);
    end = Math.min(rowCount, rowIndexAt(layout.offsets, view.top + viewHeight) + 1 + overscan);
  }

  const onScroll = (top: number) => {
    if (enabled) {
      setView(prev => (prev.top === top ? prev : { ...prev, top }));
    }
  };

  /** Scrolls a row into view. Returns `false` when the tree is not virtualized. */
  const scrollToIndex = (index: number, block: ScrollBlock): boolean => {
    const current = layoutRef.current;
    const viewport = viewportRef.current;
    if (!current || !viewport) {
      return false;
    }
    const top = current.offsets[index];
    const bottom = current.offsets[index + 1];
    const viewHeight = viewport.clientHeight || viewRef.current.height || rowHeight * 12;
    const scrollTop = viewRef.current.top;
    let next = scrollTop;
    if (block === 'start') {
      next = top;
    } else if (block === 'end') {
      next = bottom - viewHeight;
    } else if (block === 'center') {
      next = top - (viewHeight - (bottom - top)) / 2;
    } else if (top < scrollTop) {
      next = top;
    } else if (bottom > scrollTop + viewHeight) {
      next = bottom - viewHeight;
    }
    next = Math.max(0, Math.min(next, Math.max(0, current.total - viewHeight)));
    if (viewport.scrollTop !== next) {
      viewport.scrollTop = next;
    }
    setView(prev => (prev.top === next ? prev : { ...prev, top: next }));
    return true;
  };

  const listStyle: React.CSSProperties | undefined = layout
    ? {
      paddingTop: `${layout.offsets[start]}px`,
      paddingBottom: `${layout.total - layout.offsets[end]}px`,
    }
    : undefined;

  return { rowHeight, start, end, listStyle, onScroll, scrollToIndex };
}
