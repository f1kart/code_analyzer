import React from 'react';

export const TestIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M14.25 6.087c0-.665-.536-1.203-1.198-1.203L7.5 4.884v14.232l5.552.002c.662 0 1.198-.538 1.198-1.203v-12.23"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.25 6.087a1.125 1.125 0 0 0-2.25 0v12.23c0 .665.536 1.203 1.198 1.203L16.5 19.5V4.5l-2.25 1.587Z"
    />
  </svg>
);
