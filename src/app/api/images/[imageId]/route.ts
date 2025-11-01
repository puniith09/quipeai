import { NextRequest, NextResponse } from 'next/server';
import { deleteImage, getImageDetails } from '@/lib/cloudflare-images';
import { logger } from '@/lib/logger';

/**
 * GET /api/images/[imageId]
 * 
 * Get image details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params;

    const imageData = await getImageDetails(imageId);

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: imageData,
    });

  } catch (error) {
    logger.error('Failed to get image details', error);

    return NextResponse.json(
      { error: 'Failed to retrieve image' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/images/[imageId]
 * 
 * Delete an image from Cloudflare
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params;

    logger.info('Deleting image from Cloudflare', { imageId });

    const success = await deleteImage(imageId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      );
    }

    logger.info('Image deleted successfully', { imageId });

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });

  } catch (error) {
    logger.error('Image deletion failed', error);

    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
