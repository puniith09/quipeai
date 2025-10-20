'use client';

import React from 'react';

interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  action?: string;
  onClick?: () => void;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  padding?: string;
  fontSize?: string;
  fontWeight?: string;
  width?: string;
  height?: string;
  shadow?: string;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  variant = 'primary',
  size = 'md',
  action,
  onClick,
  backgroundColor,
  textColor,
  borderRadius,
  borderWidth,
  borderColor,
  padding,
  fontSize,
  fontWeight,
  width,
  height,
  shadow,
  children 
}) => {
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
    outline: 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
    ghost: 'bg-transparent text-blue-600 hover:bg-blue-50'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (action) {
      console.log('Button action:', action);
      // You can dispatch custom events or handle actions here
    }
  };

  const inlineStyles: React.CSSProperties = {
    ...(backgroundColor && { backgroundColor }),
    ...(textColor && { color: textColor }),
    ...(borderRadius && { borderRadius }),
    ...(borderWidth && { borderWidth }),
    ...(borderColor && { borderColor }),
    ...(padding && { padding }),
    ...(fontSize && { fontSize }),
    ...(fontWeight && { fontWeight }),
    ...(width && { width }),
    ...(height && { height }),
    ...(shadow && { boxShadow: shadow }),
  };

  return (
    <button
      onClick={handleClick}
      className={`
        rounded-lg font-medium transition-colors
        ${variantStyles[variant]}
        ${sizeStyles[size]}
      `}
      style={inlineStyles}
    >
      {label}
      {children}
    </button>
  );
};
