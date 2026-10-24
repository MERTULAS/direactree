import type { DireactreeMessages } from './types';

export const defaultDireactreeMessages: DireactreeMessages = {
  directoryTree: 'Directory tree',
  createFolder: 'Create Folder',
  createFile: 'Create File',
  rename: 'Rename',
  delete: 'Delete',
  save: 'Save',
  cancel: 'Cancel',
  newFolderName: 'New folder name',
  newFileName: 'New file name',
  newItemName: 'New item name',
  deleteTitle: 'Delete {name}?',
  deleteFolderDescription: 'This folder and its contents will be deleted.',
  deleteFileDescription: 'This file will be deleted.',
  deleting: 'Deleting…',
  confirmDelete: 'Confirm delete',
  actionFailed: 'Something went wrong.',
  nameEmpty: 'Enter a name.',
  nameInvalidChars: 'A name cannot contain “{char}”.',
  nameReserved: '“{name}” cannot be used as a name.',
  nameTooLong: 'A name can be at most {max} characters.',
  nameDuplicate: '“{name}” already exists in this folder.',
  moveConflict: '“{name}” already exists in {target}.',
  search: 'Search',
  searchPlaceholder: 'Search…',
  noResults: 'No matching items.',
  loading: 'Loading…',
  loadFailed: 'Could not load this folder.',
  retry: 'Retry',
  contextMenu: 'Actions for {name}',
};

export function applyMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : `{${key}}`
  ));
}
