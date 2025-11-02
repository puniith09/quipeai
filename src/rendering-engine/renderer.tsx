'use client';

import React from 'react';
import { COMPONENT_REGISTRY, isValidComponentType } from './registry';
import type { ComponentNode } from './types';
import { logger } from '@/lib/logger';

export const renderComponent = (
  node: ComponentNode,
  index: number = 0,
  onButtonClick?: (label: string, action?: string, message?: string) => void,
  onTextInputSubmit?: (value: string, action?: string, submitMessage?: string) => void,
  onTextInputChange?: (value: string, action?: string) => void
): React.ReactNode => {
  if (!isValidComponentType(node.type)) {
    const availableTypes = Object.keys(COMPONENT_REGISTRY).join(', ');
    logger.error(`Unknown component type: "${node.type}". Available types: ${availableTypes}`);
    return (
      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        <strong>Unknown component type: &quot;{node.type}&quot;</strong>
        <br />
        <span className="text-xs text-red-500">Available: {availableTypes}</span>
      </div>
    );
  }

  const Component = COMPONENT_REGISTRY[node.type];

  const children = node.children?.map((child, childIndex) =>
    renderComponent(child, childIndex, onButtonClick, onTextInputSubmit, onTextInputChange)
  );

  const props: Record<string, unknown> = { ...(node.props || {}) };
  
  if (node.type === 'button' && onButtonClick) {
    props.onClick = () => onButtonClick(props.label as string || '', props.action as string, props.message as string);
  }
  
  if (node.type === 'textinput') {
    if (onTextInputSubmit) {
      props.onSubmit = (value: string, submitMessage?: string) => 
        onTextInputSubmit(value, props.action as string | undefined, submitMessage);
    }
    if (onTextInputChange) {
      props.onChange = (value: string) => onTextInputChange(value, props.action as string | undefined);
    }
  }

  return (
    <Component key={node.id || index} {...props}>
      {children}
    </Component>
  );
};
