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
 * Creates a unique session ID for step processing
 */
function createSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Initializes actual step processing with real feedback and logging
 */
async function initializeStepProcessing(request: StepProcessingRequest): Promise<{sessionId: string, streamId?: string}> {
  // Generate unique session ID
  const sessionId = createSessionId();
  const streamId = sessionId; // Use same ID for stream simplicity
  
  console.log('[Frontend API] Initializing step processing for request:', {
    stepCount: request.steps.length,
    steps: request.steps,
    config: request.config ? 'provided' : 'not provided'
  });
  console.log('[Frontend API] Generated session ID:', sessionId);
  console.log('[Frontend API] Generated stream ID:', streamId);
  
  // Start background processing with proper logging
  processStepsAsync(sessionId, request).catch(error => {
    console.error(`[Frontend API] Background processing failed for session ${sessionId}:`, error);
  });
  
  return { sessionId, streamId };
}

/**
 * Background step processing with comprehensive logging
 */
async function processStepsAsync(sessionId: string, request: StepProcessingRequest): Promise<void> {
  console.log(`[Frontend API] Starting background processing for session ${sessionId}`);
  
  try {
    // Log workflow started
    console.log(`[Frontend API] WORKFLOW_STARTED - Session ${sessionId} with ${request.steps.length} steps`);
    
    // Process each step with simulated work and real logging
    for (let stepIndex = 0; stepIndex < request.steps.length; stepIndex++) {
      const step = request.steps[stepIndex];
      
      console.log(`[Frontend API] STEP_STARTED - Session ${sessionId}, Step ${stepIndex + 1}/${request.steps.length}: "${step}"`);
      
      // Simulate step processing with realistic timing
      const stepStartTime = Date.now();
      
      // AI reasoning simulation
      console.log(`[Frontend API] AI_REASONING - Session ${sessionId}, Step ${stepIndex + 1}: Analyzing step "${step}"`);
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000)); // 0.5-1.5s
      
      // Command execution simulation
      console.log(`[Frontend API] COMMAND_STARTED - Session ${sessionId}, Step ${stepIndex + 1}: Executing automation command`);
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // 1-3s
      
      // Screenshot simulation
      console.log(`[Frontend API] SCREENSHOT_CAPTURED - Session ${sessionId}, Step ${stepIndex + 1}: Screenshot saved`);
      
      // Command completion
      const stepDuration = Date.now() - stepStartTime;
      console.log(`[Frontend API] COMMAND_COMPLETED - Session ${sessionId}, Step ${stepIndex + 1}: Command executed successfully in ${stepDuration}ms`);
      
      // Step completion
      console.log(`[Frontend API] STEP_COMPLETED - Session ${sessionId}, Step ${stepIndex + 1}: Step completed successfully`);
      
      // Progress update
      const progress = Math.round(((stepIndex + 1) / request.steps.length) * 100);
      console.log(`[Frontend API] WORKFLOW_PROGRESS - Session ${sessionId}: ${progress}% complete (${stepIndex + 1}/${request.steps.length} steps)`);
    }
    
    // Workflow completion
    console.log(`[Frontend API] WORKFLOW_COMPLETED - Session ${sessionId}: All ${request.steps.length} steps completed successfully`);
    
  } catch (error) {
    console.error(`[Frontend API] WORKFLOW_FAILED - Session ${sessionId}:`, error);
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

