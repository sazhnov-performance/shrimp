/**
 * Health Check API Route (Next.js)
 * Simple health check endpoint
 */

import { NextResponse } from 'next/server';
import { SYSTEM_VERSION } from '../../../../types/shared-types';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
    message: 'Simplified Frontend API is running'
  });
}
