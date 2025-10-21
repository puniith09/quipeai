// Type definitions for the rendering engine

export interface ComponentNode {
  type: string;
  id?: string;
  props?: Record<string, unknown>;
  children?: ComponentNode[];
}

export interface RenderableComponent {
  type: string;
  props: Record<string, unknown>;
  children?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentRegistry = Record<string, React.ComponentType<any>>;
