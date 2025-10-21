// Component Registry - Dynamically loads components
// Uses the loader to automatically discover and register components

import { loadComponents } from './loader';
import type { ComponentRegistry } from './types';

// Load all available components
export const COMPONENT_REGISTRY: ComponentRegistry = loadComponents();

// Helper to check if a component type is valid
export const isValidComponentType = (type: string): boolean => {
  return type in COMPONENT_REGISTRY;
};
