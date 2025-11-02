import { NextRequest, NextResponse } from 'next/server';
import { uploadImage, validateImageFile } from '@/lib/cloudflare-images';
import { logger } from '@/lib/logger';

/**
 * POST /api/images/upload
 * 
 * Upload an image to Cloudflare Images CDN
 * 
 * Request: multipart/form-data with 'file' field
 * Response: Image metadata with CDN URLs
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Extract optional metadata
    const alt = formData.get('alt') as string | null;
    const tags = formData.get('tags') as string | null;

    const metadata = {
      alt: alt || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
    };

    // Upload to Cloudflare
    logger.info('Uploading image to Cloudflare', { filename: file.name, size: file.size });

    const imageData = await uploadImage(file, metadata);

    logger.info('Image uploaded successfully', { imageId: imageData.id });

    return NextResponse.json({
      success: true,
      data: imageData,
    });

  } catch (error) {
    logger.error('Image upload failed', error);

    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/images/upload
 * 
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/images/upload',
    method: 'POST',
    contentType: 'multipart/form-data',
    fields: {
      file: 'Image file (required) - Max 10MB',
      alt: 'Alt text for accessibility (optional)',
      tags: 'Comma-separated tags (optional)',
    },
    allowedFormats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg'],
    maxSize: '10MB',
    pricing: '$5 per 100k images stored, $1 per 100k deliveries',
  });
}
