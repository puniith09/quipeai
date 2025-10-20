'use client';

import React from 'react';

export interface ListProps {
  items: string[];
  variant?: 'bullets' | 'numbers' | 'none';
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  spacing?: string;
  marker?: string; // Custom marker for bullet points
  align?: 'left' | 'center' | 'right';
  children?: React.ReactNode;
}

/**
 * List Component
 * Displays a list of items with various styles
 */
export const List: React.FC<ListProps> = ({
  items,
  variant = 'bullets',
  color,
  fontSize,
  fontWeight,
  spacing = '8px',
  marker,
  align = 'left',
  children,
}) => {
  // Variant styles
  const variantClasses = {
    bullets: 'list-disc',
    numbers: 'list-decimal',
    none: 'list-none',
  };

  // Alignment classes
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  // Build className
  const className = [
    variantClasses[variant],
    alignClasses[align],
    variant !== 'none' && 'pl-5', // Padding for bullets/numbers
  ]
    .filter(Boolean)
    .join(' ');

  // Build inline styles for the list container
  const containerStyle: React.CSSProperties = {
    ...(color && { color }),
    ...(fontSize && { fontSize }),
    ...(fontWeight && { fontWeight }),
  };

  // Build inline styles for list items
  const itemStyle: React.CSSProperties = {
    ...(spacing && { marginBottom: spacing }),
  };

  return (
    <ul className={className} style={Object.keys(containerStyle).length > 0 ? containerStyle : undefined}>
      {items.map((item, index) => (
        <li 
          key={index} 
          style={itemStyle}
          {...(marker && variant === 'bullets' && {
            style: {
              ...itemStyle,
              listStyleType: `"${marker} "`,
            }
          })}
        >
          {item}
        </li>
      ))}
      {children}
    </ul>
  );
};
