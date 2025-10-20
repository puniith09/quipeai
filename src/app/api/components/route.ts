import { NextResponse } from 'next/server';
import { getAvailableComponents, getAllComponentSchemas } from '@/rendering-engine';

/**
 * Component Info API
 * Returns available components and their schemas for AI prompt generation
 */
export async function GET() {
  try {
    const components = getAvailableComponents();
    const schemas = getAllComponentSchemas();

    // Generate dynamic examples from schemas
    const examples = Object.entries(schemas).map(([name, schema]) => ({
      component: name,
      example: schema,
    }));

    return NextResponse.json({
      components,
      schemas,
      examples,
      count: components.length,
    });
  } catch (error) {
    console.error('Component info error:', error);
    return NextResponse.json(
      { error: 'Failed to load component information' },
      { status: 500 }
    );
  }
}
