import React from 'react';

export const SnippetIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 6.75h-9a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 3.75A1.5 1.5 0 0 1 9 2.25h9a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 18 14.25h-1.5"
    />
  </svg>
);
