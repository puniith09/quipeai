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
  const variantSizes = {
    caption: 'text-xs',
    label: 'text-sm',
    body: 'text-base',
    subheading: 'text-lg',
    heading: 'text-2xl',
  };

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
  };

  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const className = [
    size ? sizeClasses[size] : variantSizes[variant],
    weightClasses[weight],
    alignClasses[align],
    italic && 'italic',
    underline && 'underline',
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = {
    ...(color && { color }),
    ...(lineHeight && { lineHeight }),
    ...(letterSpacing && { letterSpacing }),
  };

  const Element = variant === 'heading' ? 'h2' : variant === 'subheading' ? 'h3' : 'p';

  return (
    <Element className={className} style={Object.keys(style).length > 0 ? style : undefined}>
      {content}
      {children}
    </Element>
  );
};
