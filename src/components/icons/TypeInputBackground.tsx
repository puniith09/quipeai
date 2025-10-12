import React from 'react';

interface TypeInputBackgroundProps {
  height?: number;
}

export const TypeInputBackground: React.FC<TypeInputBackgroundProps> = ({ 
  height = 36 
}) => {
  return (
    <svg 
      width="100%" 
      height={height} 
      viewBox="0 0 271 36" 
      fill="none"
      preserveAspectRatio="none"
    >
      <rect 
        width="271" 
        height="36" 
        rx="18" 
        fill="white" 
        fillOpacity="0.2"
      />
    </svg>
  );
};
