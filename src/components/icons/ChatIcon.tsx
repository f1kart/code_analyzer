import React from 'react';

export const ChatIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.722.267c-.335.024-.65.166-.922.385l-1.928 1.551a.75.75 0 0 1-1.158 0l-1.928-1.551a1.5 1.5 0 0 0-.922-.385l-3.722-.267A2.25 2.25 0 0 1 3 16.885V12.5a2.25 2.25 0 0 1 2.25-2.25h.75a.75.75 0 0 0 0-1.5H5.25A3.75 3.75 0 0 0 1.5 12.5v4.286c0 1.88 1.356 3.444 3.163 3.696l3.722.267c.669.048 1.3.385 1.745.87l1.928 1.55a.75.75 0 0 0 1.158 0l1.928-1.55c.445-.485 1.076-.822 1.745-.87l3.722-.267c1.807-.252 3.163-1.816 3.163-3.696V12.5a2.25 2.25 0 0 0-2.25-2.25h-1.5a.75.75 0 0 0 0 1.5h.75Z"
    />
  </svg>
);
