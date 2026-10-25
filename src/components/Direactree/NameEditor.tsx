import React from 'react';
import type { DireactreeMessages, NodePath, SaveProps } from './types';
import { cx, useSlot } from './shared';

export type DraftCheck = { name: string; error: string | null };

/** Inline field for creating or renaming a node. */
export const NameEditor = ({
  selectedNode,
  actionType,
  onCancel,
  onSave,
  createType,
  validate,
  pending = false,
  error = null,
  messages,
}: {
  selectedNode?: NodePath | null;
  actionType: 'create' | 'edit';
  onCancel: () => void;
  onSave: (props: SaveProps) => void;
  createType?: 'folder' | 'file';
  validate: (name: string) => DraftCheck;
  pending?: boolean;
  error?: string | null;
  messages: DireactreeMessages;
}) => {
  const slot = useSlot('editor');
  const [name, setName] = React.useState(actionType === 'edit' ? selectedNode?.name || '' : '');
  const [dirty, setDirty] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const unchanged = actionType === 'edit' && name === selectedNode?.name;
  const check = unchanged ? { name, error: null } : validate(name);
  const canSave = !pending && name.length > 0 && !unchanged && !check.error;
  const shownError = (dirty && check.error) || error;

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    if (!canSave) {
      setDirty(true);
      return;
    }
    onSave({ newName: check.name, selectedNode: selectedNode || null, actionType, createType });
  };

  return (
    <div className={cx('direactree-editor', slot)}>
      <div className="direactree-edit-node">
        <input
          ref={inputRef}
          type="text"
          value={name}
          disabled={pending}
          aria-invalid={dirty && check.error ? true : undefined}
          aria-label={actionType === 'edit'
            ? messages.rename
            : createType === 'folder'
              ? messages.newFolderName
              : createType === 'file'
                ? messages.newFileName
                : messages.newItemName}
          onChange={(event) => {
            setName(event.target.value);
            setDirty(true);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              save();
            } else if (event.key === 'Escape' && !pending) {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <button type="button" className="direactree-save-button" onClick={save} disabled={!canSave}>{messages.save}</button>
        <button type="button" className="direactree-cancel-button" onClick={onCancel} disabled={pending}>{messages.cancel}</button>
      </div>
      {shownError ? <p className="direactree-error" role="alert">{shownError}</p> : null}
    </div>
  );
};
