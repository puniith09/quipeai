
import { COMPONENT_REGISTRY, EXAMPLE_REGISTRY } from './components-generated';
import type { ComponentRegistry } from './types';

export function loadComponents(): ComponentRegistry {
  return COMPONENT_REGISTRY as unknown as ComponentRegistry;
}

export function getComponentMetadata(componentName: string) {
  return {
    name: componentName,
    example: EXAMPLE_REGISTRY[componentName as keyof typeof EXAMPLE_REGISTRY] || null,
    available: componentName in COMPONENT_REGISTRY,
  };
}

export function getAvailableComponents(): string[] {
  return Object.keys(COMPONENT_REGISTRY);
}

export function getAllComponentSchemas(): Record<string, unknown> {
  return EXAMPLE_REGISTRY;
}
