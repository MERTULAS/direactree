import React from 'react';
import ReactDOM from 'react-dom';
import type { ContextMenuEntry, ContextMenuItem } from './types';
import { DireactreeOverlayContext, cx, useIsoLayoutEffect, useSlot } from './shared';

/** Right-click menu shown in the overlay. Only rendered after a user action, never on the server. */
export const ContextMenu = ({
  label,
  entries,
  x,
  y,
  onSelect,
  onClose,
}: {
  label: string;
  entries: ContextMenuEntry<unknown>[];
  x: number;
  y: number;
  onSelect: (item: ContextMenuItem<unknown>) => void;
  onClose: (restoreFocus: boolean) => void;
}) => {
  const menuSlot = useSlot('menu');
  const itemSlot = useSlot('menuItem');
  const overlay = React.useContext(DireactreeOverlayContext);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [left, setLeft] = React.useState(x);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  useIsoLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !overlay) {
      setLeft(x);
      return;
    }
    const room = overlay.clientWidth - menu.offsetWidth;
    setLeft(room > 0 ? Math.max(0, Math.min(x, room)) : x);
  }, [x, overlay]);

  React.useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    (first ?? menuRef.current)?.focus();
  }, [overlay]);

  React.useEffect(() => {
    const handleDown = (event: MouseEvent) => {
      const target = event.target;
      if (menuRef.current && target instanceof Node && !menuRef.current.contains(target)) {
        onCloseRef.current(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  if (!overlay) {
    return null;
  }

  const moveFocus = (step: number | 'first' | 'last') => {
    const items = Array.prototype.slice.call(
      menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? []
    ) as HTMLElement[];
    if (!items.length) {
      return;
    }
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (step === 'first') {
      next = 0;
    } else if (step === 'last') {
      next = items.length - 1;
    } else {
      next = current === -1 ? 0 : (current + step + items.length) % items.length;
    }
    items[next].focus();
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className={cx('direactree-menu', menuSlot)}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      style={{ top: y, left }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            moveFocus(1);
            break;
          case 'ArrowUp':
            event.preventDefault();
            moveFocus(-1);
            break;
          case 'Home':
            event.preventDefault();
            moveFocus('first');
            break;
          case 'End':
            event.preventDefault();
            moveFocus('last');
            break;
          case 'Escape':
            event.preventDefault();
            event.stopPropagation();
            onClose(true);
            break;
          case 'Tab':
            onClose(false);
            break;
          default:
            break;
        }
      }}
    >
      {entries.map((entry, index) => {
        if (entry === 'separator') {
          return <div key={`separator-${index}`} role="separator" className="direactree-menu-separator" />;
        }
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={cx('direactree-menu-item', entry.danger && 'direactree-menu-item-danger', itemSlot)}
            data-danger={entry.danger ? '' : undefined}
            disabled={entry.disabled}
            onClick={() => onSelect(entry)}
          >
            {entry.icon ? <span className="direactree-menu-icon" aria-hidden="true">{entry.icon}</span> : null}
            <span className="direactree-menu-label">{entry.label}</span>
          </button>
        );
      })}
    </div>,
    overlay
  );
};
