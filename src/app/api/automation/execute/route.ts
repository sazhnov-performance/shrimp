/**
 * Execute Automation Steps API Endpoint
 * POST /api/automation/execute
 * 
 * Accepts an array of steps and starts automation execution,
 * returning session ID for tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { StepProcessor } from '@/modules/step-processor';
import { ExecuteStepsRequest, ExecuteStepsResponse, ErrorResponse } from '../../types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body: ExecuteStepsRequest = await request.json();
    
    // Validate steps array
    if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      const errorResponse = {
        success: false,
        error: {
          message: 'Steps array is required and must not be empty',
          code: 'INVALID_REQUEST'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
          version: '1.0.0',
          processingTimeMs: 0
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate each step is a string
    for (const step of body.steps) {
      if (typeof step !== 'string' || step.trim() === '') {
        const errorResponse = {
          success: false,
          error: {
            message: 'All steps must be non-empty strings',
            code: 'INVALID_REQUEST'
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: `req_${Date.now()}`,
            version: '1.0.0',
            processingTimeMs: 0
          }
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

    // Get step processor instance and start execution
    const stepProcessor = StepProcessor.getInstance();
    
    // Start processing steps asynchronously - don't await, return session ID immediately
    const sessionId = await stepProcessor.processSteps(body.steps);
    
    // Return response in format expected by frontend
    const response = {
      success: true,
      data: {
        sessionId,
        streamId: sessionId, // Use sessionId as streamId for SSE endpoint
        initialStatus: 'ACTIVE' as const,
        createdAt: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
        version: '1.0.0',
        processingTimeMs: 0
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Execute API] Error processing request:', error);
    
    const errorResponse = {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'EXECUTION_FAILED'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
        version: '1.0.0',
        processingTimeMs: 0
      }
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
