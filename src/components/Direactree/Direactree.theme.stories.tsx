import React from 'react';
import { ComponentMeta } from '@storybook/react';
import Direactree from './index';
import type { DireactreeTheme } from './DireactreeClient';

const themes: DireactreeTheme[] = ['light', 'dark', 'system'];
const states = ['normal', 'hover', 'focus', 'selected', 'dragover', 'error'] as const;

const colorScheme = (theme: DireactreeTheme): React.CSSProperties['colorScheme'] => (
  theme === 'system' ? 'light dark' : theme
);

const sample = [
  {
    id: '1',
    name: 'Folder 1',
    type: 'folder' as const,
    children: [{ id: '1.1', name: 'File 1.1', type: 'file' as const }],
  },
];

function StateSample({ state }: { state: typeof states[number] }) {
  const selected = state === 'selected';
  const dragover = state === 'dragover';
  return (
    <div>
      <ul className="direactree-list" role="tree">
        <li
          className={`direactree-item${selected ? ' direactree-item-selected' : ''}${dragover ? ' direactree-item-dragover' : ''}`}
          role="treeitem"
        >
          <div
            className={[
              'direactree-item-container',
              state === 'hover' ? 'direactree-force-hover' : '',
              state === 'focus' ? 'direactree-force-focus' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="direactree-item-button" aria-hidden="true">▸</span>
            <span className="direactree-item-name">{state}</span>
          </div>
        </li>
      </ul>
      {state === 'error' && (
        <>
          <p className="direactree-error" role="alert">Save failed</p>
          <div className="direactree-edit-node">
            <input aria-label="Name" defaultValue="draft" />
          </div>
          <div className="direactree-item-anchor">
            <div className="direactree-confirm">
              <div className="direactree-confirm-copy">
                <p className="direactree-confirm-title">Delete File 1.1?</p>
                <p className="direactree-confirm-description">This file will be deleted.</p>
              </div>
              <div className="direactree-confirm-actions">
                <button type="button">Cancel</button>
                <button type="button" className="direactree-danger-button">Delete</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default {
  title: 'Components/Direactree/Theme matrix',
  component: Direactree,
} as ComponentMeta<typeof Direactree>;

export const Matrix = () => (
  <div className="direactree-theme-matrix">
    <style>{`
      .direactree-theme-matrix {
        display: grid;
        grid-template-columns: 140px repeat(3, minmax(240px, 1fr));
        gap: 12px;
        align-items: start;
        font-family: sans-serif;
      }
      .direactree-theme-matrix h2,
      .direactree-theme-matrix p {
        margin: 0;
      }
      .direactree-theme-matrix h2 {
        font-size: 14px;
      }
    `}</style>
    <div />
    {themes.map(theme => (
      <h2 key={theme}>{theme}</h2>
    ))}
    <p>Live tree</p>
    {themes.map(theme => (
      <Direactree key={theme} theme={theme} structure={sample} showToolbox confirmDelete />
    ))}
    {states.map(state => (
      <React.Fragment key={state}>
        <p>{state}</p>
        {themes.map(theme => (
          <div
            key={`${theme}-${state}`}
            className={`direactree${state === 'error' ? ' direactree-confirm-open' : ''}`}
            data-direactree-theme={theme}
            style={{ colorScheme: colorScheme(theme) }}
          >
            <StateSample state={state} />
          </div>
        ))}
      </React.Fragment>
    ))}
  </div>
);
