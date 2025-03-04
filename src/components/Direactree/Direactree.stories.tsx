import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import Direactree from './index';

export default {
  title: 'Components/Direactree',
  component: Direactree,
  argTypes: {
    className: { control: 'text' },
    structure: { control: 'object' }, 
    indent: { control: 'number' },
    showToolbox: { control: 'boolean' },
    onCreateFolder: { action: 'onCreateFolder' },
    onCreateFile: { action: 'onCreateFile' },
    onRename: { action: 'onRename' },
    onDelete: { action: 'onDelete' },
    onSave: { action: 'onSave' },
  },
} as ComponentMeta<typeof Direactree>;

const Template: ComponentStory<typeof Direactree> = (args) => <Direactree {...args} />;

export const Default = Template.bind({});
Default.args = {
  className: '',
  structure: [
    {
      id: '1',
      name: 'Folder 1',
      type: 'folder',
      children: [
        {
          id: '1.1',
          name: 'Folder 1.1',
          type: 'folder',
          children: [
            {
              id: '1.1.1',
              name: 'Folder 1.1.1',
              type: 'folder',
              children: [
                {
                  id: '1.1.1.1',
                  name: 'File 1.1.1.1',
                  type: 'file',
                },
                {
                  id: '1.1.1.2',
                  name: 'File 1.1.1.2',
                  type: 'file',
                },
                {
                  id: '1.1.1.3',
                  name: 'File 1.1.1.3',
                  type: 'file',
                },
                {
                  id: '1.1.1.4',
                  name: 'File 1.1.1.4',
                  type: 'file',
                },
                {
                  id: '1.1.1.5',
                  name: 'Folder 1.1.1.5',
                  type: 'folder',
                  children: [
                    {
                      id: '1.1.1.5.1',
                      name: 'File 1.1.1.5.1',
                      type: 'file',
                    }
                  ]
                }
              ],
            },
          ],
        },
      ],
    },
    {
      id: '2',
      name: 'Folder 2',
      type: 'folder',
      children: [
        {
          id: '2.1',
          name: 'Folder 2.1',
          type: 'folder',
          children: [
            {
              id: '2.1.1',
              name: 'Folder 2.1.1',
              type: 'folder',
              children: [
                {
                  id: '2.1.1.1',
                  name: 'File 2.1.1.1',
                  type: 'file',
                },
                {
                  id: '2.1.1.2',
                  name: 'File 2.1.1.2',
                  type: 'file',
                },
                {
                  id: '2.1.1.3',
                  name: 'File 2.1.1.3',
                  type: 'file',
                },
                {
                  id: '2.1.1.4',
                  name: 'File 2.1.1.4',
                  type: 'file',
                }
              ],
            },
          ],
        },
      ],
    },
  ],
  indent: 20,
  showToolbox: true,
  onCreateFolder: (nodePath) => {
    console.log('onCreateFolder', nodePath);
  },
  onCreateFile: (nodePath) => {
    console.log('onCreateFile', nodePath);
  },
  onRename: (nodePath) => {
    console.log('onRename', nodePath);
  },
  onDelete: (nodePath) => {
    console.log('onDelete', nodePath);
  },
  onSave: (props) => {
    console.log('onSave', props);
  },
}; 