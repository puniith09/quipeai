
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

export type ComponentRegistry = Record<string, React.ComponentType<Record<string, unknown>>>;
