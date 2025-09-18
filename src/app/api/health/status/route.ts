/**
 * Initialization Status API Endpoint
 * Provides detailed initialization status for development and debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInitializationStatus, isAppInitialized } from '../../../../lib/app-startup';
// AppInitializer will be imported lazily to avoid Node.js API loading
import { ensureInitialized } from '../../../../lib/ensure-initialized';

export async function GET(request: NextRequest) {
  // Only allow in development mode for security
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ 
      error: 'Not available in production' 
    }, { status: 404 });
  }

  try {
    // Ensure app is initialized before getting detailed status
    await ensureInitialized();
    
    const isInitialized = isAppInitialized();

    const AppInitializer = (await import('../../../../modules/app-initializer')).default;
    const initializer = AppInitializer.getInstance();
    const status = initializer.getInitializationStatus();
    
    return NextResponse.json({
      initialized: true,
      status: status,
      modules: Object.entries(status.modules).map(([id, module]) => ({
        id,
        initialized: module.initialized,
        initTime: module.initTime,
        error: module.error,
        dependencies: module.dependencies || []
      })),
      summary: {
        totalModules: Object.keys(status.modules).length,
        initializedModules: Object.values(status.modules).filter(m => m.initialized).length,
        failedModules: Object.values(status.modules).filter(m => !m.initialized).length,
        totalInitTime: status.totalInitTime,
        phase: status.phase
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('[Status API] Error getting initialization status:', error);
    
    return NextResponse.json({
      error: 'Failed to get initialization status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
