/**
 * Media API Route Handler
 * GET /api/media/[uuid] - Serves stored media files by UUID
 * 
 * Provides HTTP access to stored images managed by MediaManager
 */

import { NextRequest } from 'next/server';
import { MediaManager } from '@/modules/media-manager/media-manager';
import { promises as fs } from 'fs';
import { ensureInitialized } from '@/lib/ensure-initialized';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  let { uuid } = await params;

  // Validate UUID parameter
  if (!uuid || typeof uuid !== 'string') {
    return new Response('UUID parameter is required', { status: 400 });
  }

  // Handle thumbnail requests by stripping -thumbnail suffix
  // This allows the frontend to request thumbnails while serving the original image
  const isThumbnailRequest = uuid.endsWith('-thumbnail');
  if (isThumbnailRequest) {
    uuid = uuid.replace('-thumbnail', '');
  }

  try {
    // Ensure application is initialized before serving media
    await ensureInitialized();
    
    // Get MediaManager instance
    const mediaManager = MediaManager.getInstance();
    
    // Get image path for the UUID
    const imagePath = mediaManager.getImagePath(uuid);
    
    // Read the image file
    const imageBuffer = await fs.readFile(imagePath);
    
    // Determine MIME type based on file extension
    const extension = imagePath.split('.').pop()?.toLowerCase();
    const mimeType = getMimeType(extension || '');
    
    // Return the image with appropriate headers
    // Convert Buffer to Uint8Array for Response constructor
    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Content-Length': imageBuffer.length.toString(),
        ...(isThumbnailRequest && { 'X-Served-As': 'thumbnail-fallback' }),
      },
    });

  } catch (error) {
    console.error(`[Media API] Error serving image ${uuid}:`, error);
    
    if (error instanceof Error && error.message.includes('does not exist')) {
      return new Response(`Image with UUID "${uuid}" not found`, { status: 404 });
    }
    
    return new Response(
      error instanceof Error ? error.message : 'Unknown error occurred',
      { status: 500 }
    );
  }
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };

  return mimeTypes[extension] || 'image/png';
}
