import React from 'react';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'w-6 h-6' }) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 17.5L10.5 11.5L16 17.5L21.5 11.5L27 17.5"
        stroke="#3B82F6"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 22L16 14.5L23.5 22"
        stroke="#60A5FA"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.65"
      />
      <circle cx="5" cy="17.5" r="2.2" fill="#3B82F6" />
      <circle cx="16" cy="17.5" r="2.2" fill="#93C5FD" />
      <circle cx="27" cy="17.5" r="2.2" fill="#3B82F6" />
    </svg>
  );
};
