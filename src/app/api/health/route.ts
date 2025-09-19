/**
 * Health Check API Endpoint
 * Provides application initialization status and health information
 */

import { NextResponse } from 'next/server';
import { getInitializationStatus, isAppInitialized } from '../../../lib/app-startup';
import { ensureInitialized } from '../../../lib/ensure-initialized';

export async function GET() {
  try {
    // Ensure app is initialized before checking status
    await ensureInitialized();
    
    const isInitialized = isAppInitialized();
    const status = await getInitializationStatus();
    
    const healthData = {
      status: isInitialized ? 'healthy' : 'initializing',
      timestamp: new Date().toISOString(),
      initialized: isInitialized,
      initialization: status ? {
        phase: status.phase,
        totalTime: status.totalInitTime,
        startTime: status.startTime,
        endTime: status.endTime,
        moduleCount: Object.keys(status.modules).length,
        modules: Object.entries(status.modules).map(([id, module]) => ({
          id,
          initialized: module.initialized,
          initTime: module.initTime,
          error: module.error,
          dependencies: module.dependencies
        })),
        errors: status.errors
      } : null,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown'
    };

    const httpStatus = isInitialized ? 200 : 503;
    
    return NextResponse.json(healthData, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('[Health API] Error getting health status:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
