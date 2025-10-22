/**
 * Cloudflare Images API Client
 * 
 * Handles image uploads, deletions, and URL generation for QuipeAI.
 * Uses Cloudflare Images for CDN storage with unlimited transforms.
 * 
 * Pricing: $5/100k images stored, $1/100k deliveries
 * Features: Auto-optimization, resizing, format conversion, WebP/AVIF
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_IMAGES_API_TOKEN;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  throw new Error('Missing Cloudflare Images configuration. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_API_TOKEN in .env');
}

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`;

/**
 * Upload Image Response from Cloudflare
 */
export interface CloudflareImageUploadResponse {
  success: boolean;
  result?: {
    id: string;
    filename: string;
    uploaded: string;
    requireSignedURLs: boolean;
    variants: string[];
  };
  errors?: Array<{ code: number; message: string }>;
  messages?: string[];
}

/**
 * Image Metadata for QuipeAI
 */
export interface ImageMetadata {
  id: string;
  filename: string;
  uploadedAt: string;
  publicUrl: string;
  variants: {
    public: string;
    thumbnail: string;
    large: string;
  };
}

/**
 * Upload an image to Cloudflare Images
 * 
 * @param file - File object or Buffer
 * @param metadata - Optional metadata (alt text, tags)
 * @returns Image metadata with CDN URLs
 */
export async function uploadImage(
  file: File | Buffer,
  metadata?: { alt?: string; tags?: string[] }
): Promise<ImageMetadata> {
  try {
    const formData = new FormData();

    if (Buffer.isBuffer(file)) {
      // Convert Buffer to Blob via Uint8Array for FormData compatibility
      const uint8Array = new Uint8Array(file);
      const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
      formData.append('file', blob, 'image.jpg');
    } else {
      // File object from browser
      formData.append('file', file, file.name);
    }

    // Add metadata as JSON
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    });

    const data: CloudflareImageUploadResponse = await response.json();

    if (!data.success || !data.result) {
      throw new Error(
        `Cloudflare upload failed: ${data.errors?.[0]?.message || 'Unknown error'}`
      );
    }

    // Generate variant URLs
    const baseUrl = `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_ID}/${data.result.id}`;

    return {
      id: data.result.id,
      filename: data.result.filename,
      uploadedAt: data.result.uploaded,
      publicUrl: `${baseUrl}/public`,
      variants: {
        public: `${baseUrl}/public`,
        thumbnail: `${baseUrl}/thumbnail`,
        large: `${baseUrl}/large`,
      },
    };
  } catch (error) {
    console.error('Cloudflare image upload error:', error);
    throw error;
  }
}

/**
 * Delete an image from Cloudflare Images
 * 
 * @param imageId - Cloudflare image ID
 * @returns Success status
 */
export async function deleteImage(imageId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Cloudflare image deletion error:', error);
    return false;
  }
}

/**
 * Get image details from Cloudflare
 * 
 * @param imageId - Cloudflare image ID
 * @returns Image metadata
 */
export async function getImageDetails(imageId: string): Promise<ImageMetadata | null> {
  try {
    const response = await fetch(`${BASE_URL}/${imageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!data.success || !data.result) {
      return null;
    }

    const baseUrl = `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_ID}/${data.result.id}`;

    return {
      id: data.result.id,
      filename: data.result.filename,
      uploadedAt: data.result.uploaded,
      publicUrl: `${baseUrl}/public`,
      variants: {
        public: `${baseUrl}/public`,
        thumbnail: `${baseUrl}/thumbnail`,
        large: `${baseUrl}/large`,
      },
    };
  } catch (error) {
    console.error('Cloudflare get image error:', error);
    return null;
  }
}

/**
 * List all images (paginated)
 * 
 * @param page - Page number (default: 1)
 * @param perPage - Items per page (default: 100, max: 10000)
 * @returns Array of image metadata
 */
export async function listImages(
  page: number = 1,
  perPage: number = 100
): Promise<ImageMetadata[]> {
  try {
    const response = await fetch(`${BASE_URL}?page=${page}&per_page=${perPage}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!data.success || !data.result?.images) {
      return [];
    }

    return data.result.images.map((img: any) => {
      const baseUrl = `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_ID}/${img.id}`;
      return {
        id: img.id,
        filename: img.filename,
        uploadedAt: img.uploaded,
        publicUrl: `${baseUrl}/public`,
        variants: {
          public: `${baseUrl}/public`,
          thumbnail: `${baseUrl}/thumbnail`,
          large: `${baseUrl}/large`,
        },
      };
    });
  } catch (error) {
    console.error('Cloudflare list images error:', error);
    return [];
  }
}

/**
 * Generate optimized image URL with transformations
 * 
 * @param imageId - Cloudflare image ID
 * @param options - Transformation options
 * @returns Optimized CDN URL
 */
export function getOptimizedImageUrl(
  imageId: string,
  options?: {
    width?: number;
    height?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
    format?: 'auto' | 'avif' | 'webp' | 'json' | 'jpeg' | 'png';
    quality?: number; // 1-100
  }
): string {
  const baseUrl = `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_ID}/${imageId}`;

  if (!options) {
    return `${baseUrl}/public`;
  }

  const params: string[] = [];

  if (options.width) params.push(`w=${options.width}`);
  if (options.height) params.push(`h=${options.height}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.format) params.push(`f=${options.format}`);
  if (options.quality) params.push(`q=${options.quality}`);

  const queryString = params.length > 0 ? `?${params.join('&')}` : '';

  return `${baseUrl}/public${queryString}`;
}

/**
 * Validate image file before upload
 * 
 * @param file - File to validate
 * @returns Validation result
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Max file size: 10MB
  const MAX_SIZE = 10 * 1024 * 1024;

  // Allowed formats
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds 10MB limit',
    };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
}

export default {
  uploadImage,
  deleteImage,
  getImageDetails,
  listImages,
  getOptimizedImageUrl,
  validateImageFile,
};
