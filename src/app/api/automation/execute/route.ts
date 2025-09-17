/**
 * POST /api/automation/execute
 * Execute automation steps endpoint
 * Based on design/frontend-api.md specifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  ERROR_CODES, 
  StepProcessingRequest, 
  StreamEvent,
  StreamEventType,
  SessionStatus 
} from '../../../../../types/shared-types';
import { StepProcessor } from '../../../../../src/modules/step-processor';

// Updated types to match UI integration
interface ExecuteStepsResponse {
  sessionId: string;
  streamId?: string;
  status: 'started';
  message: string;
}

interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: string;
}

/**
 * Validates the execute steps request (now expects StepProcessingRequest)
 */
function validateRequest(body: any): { isValid: boolean; error?: string } {
  if (!body) {
    return { isValid: false, error: 'Request body is required' };
  }

  if (!Array.isArray(body.steps)) {
    return { isValid: false, error: 'steps must be an array' };
  }

  if (body.steps.length === 0) {
    return { isValid: false, error: 'steps array cannot be empty' };
  }

  if (!body.steps.every((step: any) => typeof step === 'string')) {
    return { isValid: false, error: 'All steps must be strings' };
  }

  // Validate config if present (optional for backward compatibility)
  if (body.config && typeof body.config !== 'object') {
    return { isValid: false, error: 'config must be an object if provided' };
  }

  return { isValid: true };
}

/**
 * Creates StepProcessor instance with dependencies
 * TODO: Replace with proper dependency injection
 */
function createStepProcessor(): StepProcessor {
  // For now, we need to pass the required dependencies
  // In a real implementation, these would be injected via DI container
  const mockSessionCoordinator = {} as any;
  const mockTaskLoop = {} as any;
  const mockExecutorStreamer = {} as any;
  
  return new StepProcessor(
    mockSessionCoordinator,
    mockTaskLoop,
    mockExecutorStreamer
  );
}

/**
 * Initializes step processing using the step processor module
 * As per design: calls stepProcessor.init(steps) to get session ID
 */
async function initializeStepProcessing(request: StepProcessingRequest): Promise<{sessionId: string, streamId?: string}> {
  console.log('[Frontend API] Initializing step processing for request:', {
    stepCount: request.steps.length,
    steps: request.steps
  });
  
  try {
    // Create step processor instance
    const stepProcessor = createStepProcessor();
    
    // Call stepProcessor.init(steps) as per design
    const sessionId = await stepProcessor.init(request.steps);
    const streamId = sessionId; // Use same ID for stream simplicity
    
    console.log('[Frontend API] Step processing initialized with session ID:', sessionId);
    
    return { sessionId, streamId };
    
  } catch (error) {
    console.error('[Frontend API] Failed to initialize step processing:', error);
    throw error;
  }
}


export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body as StepProcessingRequest
    let body: StepProcessingRequest;
    try {
      body = await request.json();
    } catch (error) {
      const apiError: APIError = {
        code: ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED,
        message: 'Invalid JSON in request body',
        retryable: false,
        timestamp: new Date().toISOString()
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: 400 }
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.isValid) {
      const apiError: APIError = {
        code: ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED,
        message: validation.error!,
        retryable: false,
        timestamp: new Date().toISOString()
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: 400 }
      );
    }

    // Initialize step processing
    let processingResult: {sessionId: string, streamId?: string};
    try {
      processingResult = await initializeStepProcessing(body);
    } catch (error) {
      const apiError: APIError = {
        code: 'STEP_PROCESSOR_INIT_FAILED',
        message: `Failed to initialize step processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { 
          stepsCount: body.steps.length,
          error: error instanceof Error ? error.message : String(error)
        },
        retryable: true,
        timestamp: new Date().toISOString()
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: 500 }
      );
    }

    // Return success response with stream ID
    const response: ExecuteStepsResponse = {
      sessionId: processingResult.sessionId,
      streamId: processingResult.streamId,
      status: 'started',
      message: 'Automation execution started'
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
          version: '1.0.0',
          processingTimeMs: Date.now() - startTime
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Frontend API] Unexpected error in execute endpoint:', error);
    
    const apiError: APIError = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: { 
        error: error instanceof Error ? error.message : String(error)
      },
      retryable: true,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(
      { success: false, error: apiError },
      { status: 500 }
    );
  }
}

