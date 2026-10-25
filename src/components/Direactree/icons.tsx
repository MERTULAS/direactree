import React from 'react';

type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Points right when closed. CSS turns it down for an open folder, and left in RTL. */
export const ChevronIcon = ({ className }: IconProps) => (
  <Icon className={className}><path d="M6 3.5 10.5 8 6 12.5" /></Icon>
);

export const FolderPlusIcon = () => (
  <Icon>
    <path d="M1.75 4.25v8a1 1 0 0 0 1 1h10.5a1 1 0 0 0 1-1v-6.5a1 1 0 0 0-1-1H8L6.5 3.25H2.75a1 1 0 0 0-1 1Z" />
    <path d="M8 7.25v4M6 9.25h4" />
  </Icon>
);

export const FilePlusIcon = () => (
  <Icon>
    <path d="M9.25 1.75h-5a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1v-8Z" />
    <path d="M9.25 1.75v3.5h3.5M8 7.75v4M6 9.75h4" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M10.75 2.25 13.75 5.25 5.5 13.5h-3v-3Z" />
    <path d="M9.25 3.75 12.25 6.75" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon>
    <path d="M2.5 4h11M6 4V2.5h4V4" />
    <path d="m4 4 .7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4M6.75 7v4.5M9.25 7v4.5" />
  </Icon>
);
