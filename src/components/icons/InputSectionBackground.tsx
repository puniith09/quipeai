import React from 'react';

interface InputSectionBackgroundProps {
  height?: number;
}

export const InputSectionBackground: React.FC<InputSectionBackgroundProps> = ({ 
  height = 103 
}) => {
  return (
    <svg 
      width="100%" 
      height={height} 
      viewBox="0 0 375 103" 
      fill="none"
      preserveAspectRatio="none"
    >
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M0 -6.10352e-05V103H375V-6.50287e-05C375 13.2548 364.255 23.9999 351 23.9999H24C10.7452 23.9999 0 13.2548 0 -6.10352e-05Z"
        fill="#313131"
      />
    </svg>
  );
};
