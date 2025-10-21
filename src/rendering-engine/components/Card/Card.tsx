'use client';

import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'outlined' | 'elevated';
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: string;
  padding?: string;
  shadow?: string;
  width?: string;
  spacing?: string; // Space between child elements
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ 
  title, 
  subtitle, 
  variant = 'default',
  backgroundColor,
  borderColor,
  borderRadius,
  padding,
  shadow,
  width,
  spacing,
  children 
}) => {
  const variantStyles = {
    default: 'bg-white border border-gray-200',
    outlined: 'bg-transparent border-2 border-gray-300',
    elevated: 'bg-white shadow-lg'
  };

  const inlineStyles: React.CSSProperties = {
    ...(backgroundColor && { backgroundColor }),
    ...(borderColor && { borderColor }),
    ...(borderRadius && { borderRadius }),
    ...(padding && { padding }),
    ...(shadow && { boxShadow: shadow }),
    ...(width && { width }),
  };

  return (
    <div 
      className={`rounded-lg p-4 mb-3 ${variantStyles[variant]}`}
      style={inlineStyles}
    >
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-sm text-gray-600 mb-3">
          {subtitle}
        </p>
      )}
      {children && (
        <div 
          className="mt-2"
          style={spacing ? { display: 'flex', flexDirection: 'column', gap: spacing } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
};
