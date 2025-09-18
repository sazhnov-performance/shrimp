/**
 * Next.js Middleware
 * Lightweight middleware that runs in Edge Runtime
 * Main initialization happens in API routes and components
 */

import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Skip processing for static assets and _next internal routes
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/api/_next') ||
    request.nextUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)
  ) {
    return NextResponse.next();
  }

  // Add initialization status header for debugging
  const response = NextResponse.next();
  response.headers.set('x-app-middleware', 'active');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
