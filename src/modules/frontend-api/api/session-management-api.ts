/**
 * Session Management API Implementation
 * Handles session control and status operations
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SessionStatus,
  StreamEvent,
  ExecutionProgress,
  StandardError,
  SYSTEM_VERSION
} from '../../../../types/shared-types';
import {
  SessionManagementAPI,
  SessionStatusResponse,
  SessionControlResponse,
  SessionListQuery,
  SessionListResponse,
  SessionSummary,
  SessionHistoryQuery,
  SessionHistoryResponse,
  FrontendAPIConfig,
  APIIntegrations
} from '../types';
import { FrontendAPISessionManager } from '../session-manager';
import { FrontendAPIErrorHandler } from '../error-handler';

export class SessionManagementAPIImpl implements SessionManagementAPI {
  private config: FrontendAPIConfig;
  private sessionManager: FrontendAPISessionManager;
  private errorHandler: FrontendAPIErrorHandler;
  private integrations?: APIIntegrations;

  constructor(
    config: FrontendAPIConfig,
    sessionManager: FrontendAPISessionManager,
    errorHandler: FrontendAPIErrorHandler
  ) {
    this.config = config;
    this.sessionManager = sessionManager;
    this.errorHandler = errorHandler;
  }

  /**
   * Initialize with backend integrations
   */
  async initialize?(integrations: APIIntegrations): Promise<void> {
    this.integrations = integrations;
  }

  /**
   * Gets detailed session status information
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    try {
      // Get session from session manager
      const session = this.sessionManager.getFrontendAPISession(sessionId);
      if (!session) {
        throw this.errorHandler.createNotFoundErrorResponse('Session', sessionId);
      }

      // Get workflow session from session coordinator
      let workflowSession = null;
      let progress: ExecutionProgress | null = null;
      let error: StandardError | null = null;

      if (this.integrations?.sessionCoordinator) {
        workflowSession = this.integrations.sessionCoordinator.getWorkflowSession(
          session.linkedWorkflowSessionId
        );
      }

      // Get execution progress from step processor or task loop
      if (this.integrations?.stepProcessor) {
        try {
          progress = await this.integrations.stepProcessor.getExecutionProgress?.(sessionId);
        } catch (e) {
          // Progress might not be available for all sessions
        }
      }

      // Get any execution errors
      if (session.status === SessionStatus.FAILED && this.integrations?.contextManager) {
        try {
          const executionEvents = await this.integrations.contextManager.getExecutionEvents?.(sessionId);
          const errorEvent = executionEvents?.find((event: any) => event.data?.error);
          if (errorEvent) {
            error = errorEvent.data.error;
          }
        } catch (e) {
          // Error details might not be available
        }
      }

      // Build response
      const response: SessionStatusResponse = {
        sessionId,
        streamId: workflowSession?.streamId,
        status: session.status,
        progress: progress || this.createDefaultProgress(sessionId, session),
        timing: {
          startTime: session.createdAt.toISOString(),
          lastActivity: session.lastActivity.toISOString(),
          estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(session, progress),
          averageStepDuration: progress?.averageStepDuration
        },
        error: error || undefined
      };

      return response;

    } catch (error) {
      if (error.data) {
        throw error; // Already a formatted error response
      }
      throw this.errorHandler.wrapError(error);
    }
  }

  /**
   * Pauses session execution
   */
  async pauseSession(sessionId: string): Promise<SessionControlResponse> {
    try {
      const session = this.sessionManager.getFrontendAPISession(sessionId);
      if (!session) {
        throw this.errorHandler.createNotFoundErrorResponse('Session', sessionId);
      }

      // Update local session status
      await this.sessionManager.updateSessionStatus(sessionId, SessionStatus.PAUSED);

      // Pause via step processor if available
      if (this.integrations?.stepProcessor) {
        await this.integrations.stepProcessor.pauseSession?.(sessionId);
      }

      return {
        sessionId,
        status: SessionStatus.PAUSED,
        message: 'Session paused successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      if (error.data) {
        throw error; // Already a formatted error response
      }
      throw this.errorHandler.wrapError(error);
    }
  }

  /**
   * Resumes session execution
   */
  async resumeSession(sessionId: string): Promise<SessionControlResponse> {
    try {
      const session = this.sessionManager.getFrontendAPISession(sessionId);
      if (!session) {
        throw this.errorHandler.createNotFoundErrorResponse('Session', sessionId);
      }

      if (session.status !== SessionStatus.PAUSED) {
        throw new Error(`Cannot resume session in status: ${session.status}`);
      }

      // Update local session status
      await this.sessionManager.updateSessionStatus(sessionId, SessionStatus.ACTIVE);

      // Resume via step processor if available
      if (this.integrations?.stepProcessor) {
        await this.integrations.stepProcessor.resumeSession?.(sessionId);
      }

      return {
        sessionId,
        status: SessionStatus.ACTIVE,
        message: 'Session resumed successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      if (error.data) {
        throw error; // Already a formatted error response
      }
      throw this.errorHandler.wrapError(error);
    }
  }

  /**
   * Cancels session execution
   */
  async cancelSession(sessionId: string): Promise<SessionControlResponse> {
    try {
      const session = this.sessionManager.getFrontendAPISession(sessionId);
      if (!session) {
        throw this.errorHandler.createNotFoundErrorResponse('Session', sessionId);
      }

      // Update local session status
      await this.sessionManager.updateSessionStatus(sessionId, SessionStatus.CANCELLED);

      // Cancel via step processor if available
      if (this.integrations?.stepProcessor) {
        await this.integrations.stepProcessor.cancelSession?.(sessionId);
      }

      // Clean up session resources
      await this.sessionManager.destroySession(sessionId);

      return {
        sessionId,
        status: SessionStatus.CANCELLED,
        message: 'Session cancelled successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      if (error.data) {
        throw error; // Already a formatted error response
      }
      throw this.errorHandler.wrapError(error);
    }
  }

  /**
   * Lists sessions with optional filtering
   */
  async listSessions(query: SessionListQuery): Promise<SessionListResponse> {
    try {
      const activeSessions = this.sessionManager.listActiveSessions();
      const sessions: SessionSummary[] = [];

      // Apply filtering and pagination
      let filteredSessions = activeSessions;
      
      if (query.status) {
        filteredSessions = activeSessions.filter(sessionId => {
          const status = this.sessionManager.getSessionStatus(sessionId);
          return status === query.status;
        });
      }

      const offset = query.offset || 0;
      const limit = Math.min(query.limit || 50, 100); // Cap at 100
      const paginatedSessions = filteredSessions.slice(offset, offset + limit);

      // Build session summaries
      for (const sessionId of paginatedSessions) {
        const session = this.sessionManager.getFrontendAPISession(sessionId);
        if (session) {
          const summary = await this.buildSessionSummary(session);
          sessions.push(summary);
        }
      }

      return {
        sessions,
        total: filteredSessions.length,
        offset,
        limit
      };

    } catch (error) {
      throw this.errorHandler.wrapError(error);
    }
  }

  /**
   * Gets session execution history
   */
  async getSessionHistory(sessionId: string, query: SessionHistoryQuery): Promise<SessionHistoryResponse> {
    try {
      const session = this.sessionManager.getFrontendAPISession(sessionId);
      if (!session) {
        throw this.errorHandler.createNotFoundErrorResponse('Session', sessionId);
      }

      let events: StreamEvent[] = [];

      // Get events from context manager if available
      if (this.integrations?.contextManager) {
        try {
          const allEvents = await this.integrations.contextManager.getExecutionEvents?.(sessionId);
          events = allEvents || [];
        } catch (e) {
          // Events might not be available
        }
      }

      // Apply filtering
      if (query.eventTypes && query.eventTypes.length > 0) {
        events = events.filter(event => query.eventTypes!.includes(event.type));
      }

      // Apply pagination
      const offset = query.offset || 0;
      const limit = Math.min(query.limit || 100, 1000); // Cap at 1000
      const paginatedEvents = events.slice(offset, offset + limit);

      return {
        sessionId,
        events: paginatedEvents,
        total: events.length,
        filters: {
          eventTypes: query.eventTypes,
          limit,
          offset
        }
      };

    } catch (error) {
      if (error.data) {
        throw error; // Already a formatted error response
      }
      throw this.errorHandler.wrapError(error);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private createDefaultProgress(sessionId: string, session: any): ExecutionProgress {
    return {
      sessionId,
      totalSteps: 0,
      completedSteps: 0,
      currentStepIndex: 0,
      currentStepName: 'Unknown',
      overallProgress: 0,
      averageStepDuration: 0,
      lastActivity: session.lastActivity
    };
  }

  private calculateEstimatedTimeRemaining(session: any, progress: ExecutionProgress | null): number | undefined {
    if (!progress || progress.totalSteps === 0) {
      return undefined;
    }

    const remainingSteps = progress.totalSteps - progress.completedSteps;
    if (remainingSteps <= 0) {
      return 0;
    }

    // Use average step duration if available, otherwise estimate
    const avgDuration = progress.averageStepDuration || 5000; // Default 5 seconds per step
    return remainingSteps * avgDuration;
  }

  private async buildSessionSummary(session: any): Promise<SessionSummary> {
    let stepCount = 0;
    let progress = 0;

    // Try to get step information from context manager
    if (this.integrations?.contextManager) {
      try {
        const steps = await this.integrations.contextManager.getSteps?.(session.linkedWorkflowSessionId);
        stepCount = steps?.length || 0;

        const executionProgress = await this.integrations.stepProcessor?.getExecutionProgress?.(session.linkedWorkflowSessionId);
        if (executionProgress) {
          progress = executionProgress.overallProgress;
        }
      } catch (e) {
        // Information might not be available
      }
    }

    return {
      sessionId: session.linkedWorkflowSessionId,
      status: session.status,
      startTime: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      stepCount,
      progress
    };
  }
}
