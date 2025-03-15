import React from 'react';
import type { 
  DireactreeProps, 
  TreeNode, 
  NodePath, 
  SaveProps, 
  ToolboxIcons
} from './DireactreeClient';
import DireactreeClient from './DireactreeClient';

export type { 
  DireactreeProps, 
  TreeNode, 
  NodePath, 
  SaveProps, 
  ToolboxIcons
};

// For Server Side Rendering
const Direactree = (props: DireactreeProps): React.ReactElement => {
  // For Server Side Rendering
  return (
    <React.Suspense fallback={<div className="direactree-loading">Loading...</div>}>
      <DireactreeClient {...props} />
    </React.Suspense>
  );
};

export default Direactree; 