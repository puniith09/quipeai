
import { loadComponents } from './loader';
import type { ComponentRegistry } from './types';

export const COMPONENT_REGISTRY: ComponentRegistry = loadComponents();

export const isValidComponentType = (type: string): boolean => {
  return type in COMPONENT_REGISTRY;
};
