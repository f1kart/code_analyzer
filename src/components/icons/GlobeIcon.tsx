import React from 'react';

export const GlobeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c.506 0 1.023-.042 1.517-.123M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 12c-1.354 0-2.673-.323-3.868-.901m3.868.901c1.195.578 2.514.901 3.868.901M1.343 9.343A9.002 9.002 0 0 1 3.284 5.922m17.432 3.421a9.002 9.002 0 0 1-1.942 3.421M12 3c.506 0 1.023.042 1.517.123m0 0a9.004 9.004 0 0 1 7.199 6.623M3.284 5.922a9.004 9.004 0 0 1 7.199-2.586"
    />
  </svg>
);
