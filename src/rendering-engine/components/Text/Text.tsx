'use client';

import React from 'react';

export interface TextProps {
  content: string;
  variant?: 'body' | 'heading' | 'subheading' | 'caption' | 'label';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  italic?: boolean;
  underline?: boolean;
  lineHeight?: string;
  letterSpacing?: string;
  children?: React.ReactNode;
}

/**
 * Text Component
 * Displays text with various styling options
 */
export const Text: React.FC<TextProps> = ({
  content,
  variant = 'body',
  size,
  weight = 'normal',
  color,
  align = 'left',
  italic = false,
  underline = false,
  lineHeight,
  letterSpacing,
  children,
}) => {
  // Variant-based default sizes
  const variantSizes = {
    caption: 'text-xs',
    label: 'text-sm',
    body: 'text-base',
    subheading: 'text-lg',
    heading: 'text-2xl',
  };

  // Size classes
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
  };

  // Weight classes
  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  // Alignment classes
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  // Build className
  const className = [
    size ? sizeClasses[size] : variantSizes[variant],
    weightClasses[weight],
    alignClasses[align],
    italic && 'italic',
    underline && 'underline',
  ]
    .filter(Boolean)
    .join(' ');

  // Build inline styles
  const style: React.CSSProperties = {
    ...(color && { color }),
    ...(lineHeight && { lineHeight }),
    ...(letterSpacing && { letterSpacing }),
  };

  // Choose element based on variant
  const Element = variant === 'heading' ? 'h2' : variant === 'subheading' ? 'h3' : 'p';

  return (
    <Element className={className} style={Object.keys(style).length > 0 ? style : undefined}>
      {content}
      {children}
    </Element>
  );
};
