import React from 'react';
import ReactDOM from 'react-dom';
import type { DireactreeMessages, NodeType } from './types';
import { applyMessage } from './messages';
import { DireactreeOverlayContext, cx, escapeNodeId, useSlot } from './shared';

type Place = { top: number; left: number; maxWidth: number; placement: 'top' | 'bottom' };

/** Delete confirmation placed under the row, in the overlay so it never moves the tree. */
export const DeleteConfirm = ({
  nodeId,
  name,
  nodeType,
  pending,
  disabled = false,
  error,
  messages,
  onConfirm,
  onCancel,
}: {
  nodeId: string;
  name: string;
  nodeType: NodeType;
  pending: boolean;
  disabled?: boolean;
  error: string | null;
  messages: DireactreeMessages;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const slot = useSlot('confirm');
  const controlsDisabled = pending || disabled;
  const overlay = React.useContext(DireactreeOverlayContext);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useRef(`direactree-delete-title-${Math.random().toString(36).slice(2, 8)}`).current;
  const descriptionId = React.useRef(`direactree-delete-description-${Math.random().toString(36).slice(2, 8)}`).current;
  const [place, setPlace] = React.useState<Place | null>(null);

  React.useEffect(() => {
    cancelRef.current?.focus();
  }, [overlay]);

  React.useEffect(() => {
    if (!overlay) {
      return undefined;
    }
    const root = overlay.closest('.direactree');
    if (!(root instanceof HTMLElement)) {
      return undefined;
    }
    const viewport = root.querySelector('.direactree-viewport');
    const anchor = root.querySelector(`[data-node-id="${escapeNodeId(nodeId)}"]`)?.closest('.direactree-item-anchor');
    if (!(anchor instanceof HTMLElement)) {
      return undefined;
    }

    const placePanel = () => {
      const panel = overlay.querySelector('.direactree-confirm');
      const overlayRect = overlay.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const viewRect = viewport instanceof HTMLElement ? viewport.getBoundingClientRect() : overlayRect;
      const panelWidth = panel instanceof HTMLElement ? panel.offsetWidth : 220;
      const panelHeight = panel instanceof HTMLElement ? panel.offsetHeight : 0;
      const minLeft = Math.max(0, viewRect.left - overlayRect.left);
      const maxLeft = Math.max(minLeft, viewRect.right - overlayRect.left - panelWidth);
      const left = Math.min(Math.max(anchorRect.left - overlayRect.left, minLeft), maxLeft);
      let top = anchorRect.bottom - overlayRect.top + 4;
      let placement: 'top' | 'bottom' = 'bottom';
      if (panelHeight > 0 && overlayRect.bottom - anchorRect.bottom < panelHeight + 4 && anchorRect.top - overlayRect.top > panelHeight + 4) {
        top = anchorRect.top - overlayRect.top - panelHeight - 4;
        placement = 'top';
      }
      if (panelHeight > 0) {
        top = Math.min(Math.max(0, top), Math.max(0, overlayRect.height - panelHeight));
      }
      const maxWidth = Math.max(0, viewRect.width);
      setPlace((current) => {
        if (
          current
          && current.top === top
          && current.left === left
          && current.maxWidth === maxWidth
          && current.placement === placement
        ) {
          return current;
        }
        return { top, left, maxWidth, placement };
      });
    };

    placePanel();
    viewport?.addEventListener('scroll', placePanel);
    window.addEventListener('resize', placePanel);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placePanel);
    observer?.observe(root);
    if (viewport instanceof HTMLElement) {
      observer?.observe(viewport);
    }
    observer?.observe(anchor);
    const panel = overlay.querySelector('.direactree-confirm');
    if (panel instanceof HTMLElement) {
      observer?.observe(panel);
    }
    return () => {
      viewport?.removeEventListener('scroll', placePanel);
      window.removeEventListener('resize', placePanel);
      observer?.disconnect();
    };
  }, [overlay, nodeId]);

  if (!overlay) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className={cx('direactree-confirm', slot)}
      role="group"
      data-placement={place?.placement ?? 'bottom'}
      style={{
        top: place?.top ?? 0,
        left: place?.left ?? 0,
        insetInlineStart: place?.left ?? 0,
        maxWidth: place && place.maxWidth > 0 ? place.maxWidth : undefined,
        visibility: place ? 'visible' : 'hidden',
      }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="direactree-confirm-copy">
        <p className="direactree-confirm-title" id={titleId}>{applyMessage(messages.deleteTitle, { name })}</p>
        <p className="direactree-confirm-description" id={descriptionId}>
          {nodeType === 'folder' ? messages.deleteFolderDescription : messages.deleteFileDescription}
        </p>
      </div>
      {error ? <p className="direactree-error" role="alert">{error}</p> : null}
      <div className="direactree-confirm-actions">
        <button ref={cancelRef} type="button" className="direactree-cancel-button" onClick={onCancel} disabled={controlsDisabled}>{messages.cancel}</button>
        <button
          type="button"
          className="direactree-danger-button"
          aria-label={pending ? messages.deleting : messages.confirmDelete}
          disabled={controlsDisabled}
          onClick={onConfirm}
        >
          {pending ? messages.deleting : messages.delete}
        </button>
      </div>
    </div>,
    overlay
  );
};
