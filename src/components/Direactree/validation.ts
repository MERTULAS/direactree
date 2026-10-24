import type { DireactreeMessages, NameRules, TreeNode } from './types';
import { applyMessage, defaultDireactreeMessages } from './messages';

export const defaultNameRules: NameRules = {
  trim: true,
  // eslint-disable-next-line no-control-regex
  invalidChars: /[/\\:*?"<>|\u0000-\u001f]/,
  reserved: ['.', '..'],
  caseSensitive: false,
  maxLength: 255,
};

export type NameErrorCode = 'empty' | 'invalidChars' | 'reserved' | 'tooLong' | 'duplicate';

export type NameValidationResult =
  | { ok: true; name: string }
  | { ok: false; name: string; code: NameErrorCode; message: string };

export interface ValidateNameOptions<T = unknown> {
  /** Nodes in the same folder. Used for the duplicate check. */
  siblings?: TreeNode<T>[];
  /** Skipped in the duplicate check, usually the node being renamed. */
  ignoreId?: string | null;
  rules?: Partial<NameRules>;
  messages?: Partial<DireactreeMessages>;
}

function sameName(a: string, b: string, caseSensitive: boolean): boolean {
  return caseSensitive ? a === b : a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

function findInvalidChar(name: string, invalid: RegExp | string): string | null {
  if (typeof invalid === 'string') {
    for (let i = 0; i < name.length; i += 1) {
      if (invalid.indexOf(name.charAt(i)) !== -1) {
        return name.charAt(i);
      }
    }
    return null;
  }
  // A copy without the global flag, so `lastIndex` never carries over.
  const pattern = new RegExp(invalid.source, invalid.flags.replace('g', ''));
  const match = pattern.exec(name);
  return match ? match[0] : null;
}

function describeChar(char: string): string {
  const code = char.charCodeAt(0);
  return code < 32 ? `U+${code.toString(16).toUpperCase().padStart(4, '0')}` : char;
}

/** True when a sibling other than `ignoreId` already uses `name`. */
export function hasNameConflict<T>(
  siblings: TreeNode<T>[],
  name: string,
  ignoreId: string | null = null,
  caseSensitive = defaultNameRules.caseSensitive
): boolean {
  return siblings.some(sibling => sibling.id !== ignoreId && sameName(sibling.name, name, caseSensitive));
}

/** Checks a file or folder name against the rules and its siblings. */
export function validateName<T>(rawName: string, options: ValidateNameOptions<T> = {}): NameValidationResult {
  const rules: NameRules = { ...defaultNameRules, ...options.rules };
  const messages: DireactreeMessages = { ...defaultDireactreeMessages, ...options.messages };
  const name = rules.trim ? rawName.trim() : rawName;
  const fail = (code: NameErrorCode, message: string): NameValidationResult => ({ ok: false, name, code, message });

  if (name.trim().length === 0) {
    return fail('empty', messages.nameEmpty);
  }
  const invalidChar = findInvalidChar(name, rules.invalidChars);
  if (invalidChar !== null) {
    return fail('invalidChars', applyMessage(messages.nameInvalidChars, { char: describeChar(invalidChar) }));
  }
  if (rules.reserved.some(reserved => sameName(reserved, name, rules.caseSensitive))) {
    return fail('reserved', applyMessage(messages.nameReserved, { name }));
  }
  if (rules.maxLength > 0 && name.length > rules.maxLength) {
    return fail('tooLong', applyMessage(messages.nameTooLong, { max: String(rules.maxLength) }));
  }
  if (options.siblings && hasNameConflict(options.siblings, name, options.ignoreId ?? null, rules.caseSensitive)) {
    return fail('duplicate', applyMessage(messages.nameDuplicate, { name }));
  }
  return { ok: true, name };
}
