import React from 'react';
import type { DireactreeMessages, NodePath, ToolboxAction, ToolboxIcons } from './types';
import { FilePlusIcon, FolderPlusIcon, PencilIcon, TrashIcon } from './icons';
import { cx, useSlot } from './shared';

interface ToolboxProps {
  selectedNode: NodePath | null;
  selectedIds: string[];
  toolboxIcons?: ToolboxIcons;
  toolboxSticky?: boolean;
  toolboxActions?: ToolboxAction[];
  pending?: boolean;
  canCreate: boolean;
  canRename: boolean;
  canDelete: boolean;
  deleteButtonRef?: React.Ref<HTMLButtonElement>;
  messages: DireactreeMessages;
  onCreateFolder: (parentNode: NodePath | null) => void;
  onCreateFile: (parentNode: NodePath | null) => void;
  onRename: (node: NodePath) => void;
  onDelete: (node: NodePath) => void;
}

export const Toolbox = ({
  selectedNode,
  selectedIds,
  toolboxIcons,
  toolboxSticky = false,
  toolboxActions,
  pending = false,
  canCreate,
  canRename,
  canDelete,
  deleteButtonRef,
  messages,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete
}: ToolboxProps) => {
  const slot = useSlot('toolbox');
  const buttonSlot = useSlot('toolboxButton');
  const buttonClass = cx('direactree-toolbox-button', buttonSlot);
  return (
    <div className={cx('direactree-toolbox', toolboxSticky && 'direactree-toolbox-sticky', slot)}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onCreateFolder(selectedNode)}
        aria-label={messages.createFolder}
        title={messages.createFolder}
        disabled={pending || !canCreate}
      >
        {toolboxIcons?.createFolder || <FolderPlusIcon />}
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onCreateFile(selectedNode)}
        aria-label={messages.createFile}
        title={messages.createFile}
        disabled={pending || !canCreate}
      >
        {toolboxIcons?.createFile || <FilePlusIcon />}
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => selectedNode && onRename(selectedNode)}
        disabled={pending || !canRename || !selectedNode}
        aria-label={messages.rename}
        title={messages.rename}
      >
        {toolboxIcons?.rename || <PencilIcon />}
      </button>
      <button
        ref={deleteButtonRef}
        type="button"
        className={buttonClass}
        onClick={() => selectedNode && onDelete(selectedNode)}
        disabled={pending || !canDelete || !selectedNode}
        aria-label={messages.delete}
        title={messages.delete}
      >
        {toolboxIcons?.delete || <TrashIcon />}
      </button>
      {toolboxActions?.map(action => {
        const disabled = typeof action.disabled === 'function'
          ? action.disabled(selectedNode, selectedIds)
          : Boolean(action.disabled);
        return (
          <button
            key={action.id}
            type="button"
            className={buttonClass}
            onClick={() => action.onClick(selectedNode, selectedIds)}
            disabled={disabled}
            aria-label={action.label}
            title={action.label}
          >
            {action.icon}
          </button>
        );
      })}
    </div>
  );
};
