import { memo } from 'react';

interface TypeInputBackgroundProps {
  height?: number;
}

const TypeInputBackgroundComponent: React.FC<TypeInputBackgroundProps> = ({ 
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

TypeInputBackgroundComponent.displayName = 'TypeInputBackground';

export const TypeInputBackground = memo(TypeInputBackgroundComponent);
