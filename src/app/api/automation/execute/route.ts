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
      const errorResponse: ErrorResponse = {
        error: 'Invalid Request',
        message: 'Steps array is required and must not be empty',
        code: 400
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate each step is a string
    for (const step of body.steps) {
      if (typeof step !== 'string' || step.trim() === '') {
        const errorResponse: ErrorResponse = {
          error: 'Invalid Request',
          message: 'All steps must be non-empty strings',
          code: 400
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

    // Get step processor instance and start execution
    const stepProcessor = StepProcessor.getInstance();
    
    // Start processing steps asynchronously - don't await, return session ID immediately
    const sessionId = await stepProcessor.processSteps(body.steps);
    
    // Return session ID immediately as per design
    const response: ExecuteStepsResponse = {
      sessionId,
      status: 'started',
      message: 'Automation execution started'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Execute API] Error processing request:', error);
    
    const errorResponse: ErrorResponse = {
      error: 'Execution Failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 500
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
