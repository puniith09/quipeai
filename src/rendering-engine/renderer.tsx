'use client';

import React from 'react';
import { COMPONENT_REGISTRY, isValidComponentType } from './registry';
import type { ComponentNode } from './types';

/**
 * Recursively renders components based on JSON structure
 * Supports nested components of unlimited depth
 */
export const renderComponent = (
  node: ComponentNode,
  index: number = 0,
  onButtonClick?: (label: string, action?: string) => void
): React.ReactNode => {
  // Validate component type
  if (!isValidComponentType(node.type)) {
    const availableTypes = Object.keys(COMPONENT_REGISTRY).join(', ');
    console.error(`Unknown component type: "${node.type}". Available types: ${availableTypes}`);
    return (
      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        <strong>Unknown component type: &quot;{node.type}&quot;</strong>
        <br />
        <span className="text-xs text-red-500">Available: {availableTypes}</span>
      </div>
    );
  }

  // Get the component from registry
  const Component = COMPONENT_REGISTRY[node.type];

  // Recursively render children
  const children = node.children?.map((child, childIndex) =>
    renderComponent(child, childIndex, onButtonClick)
  );

  // Add onClick handler for buttons
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = { ...(node.props || {}) };
  if (node.type === 'button' && onButtonClick) {
    props.onClick = () => onButtonClick(props.label || '', props.action);
  }

  // Render the component with props and children
  return (
    <Component key={node.id || index} {...props}>
      {children}
    </Component>
  );
};

/**
 * Renders multiple components from an array
 */
export const renderComponents = (
  nodes: ComponentNode[],
  onButtonClick?: (label: string, action?: string) => void
): React.ReactNode[] => {
  return nodes.map((node, index) => renderComponent(node, index, onButtonClick));
};
