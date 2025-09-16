import { SessionStatus } from '../../../types/shared-types';
import { 
  AIContextSession, 
  StepExecution, 
  SessionData,
  ContextManagerError,
  AIContextConfig
} from './types';

export class StepManager {
  private config: AIContextConfig;

  constructor(config: AIContextConfig) {
    this.config = config;
  }

  // Step Definition Management

  async setSteps(sessionData: SessionData, steps: string[]): Promise<void> {
    this.validateSteps(steps);
    
    // Clear any existing step definitions and executions
    sessionData.session.steps = [...steps];
    sessionData.session.stepExecutions = [];
    
    // Initialize step execution tracking structure
    this.initializeStepExecutions(sessionData, steps);
    
    // Update session metadata
    sessionData.session.lastActivity = new Date();
    sessionData.session.metadata = {
      ...sessionData.session.metadata,
      totalSteps: steps.length,
      stepsInitializedAt: new Date().toISOString()
    };
  }

  getSteps(sessionData: SessionData): string[] | null {
    return sessionData.session.steps.length > 0 ? [...sessionData.session.steps] : null;
  }

  getStepCount(sessionData: SessionData): number {
    return sessionData.session.steps.length;
  }

  getStepByIndex(sessionData: SessionData, stepIndex: number): string | null {
    if (stepIndex < 0 || stepIndex >= sessionData.session.steps.length) {
      return null;
    }
    return sessionData.session.steps[stepIndex];
  }

  validateStepIndex(sessionData: SessionData, stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= sessionData.session.steps.length) {
      throw this.createError(
        'INVALID_STEP_INDEX',
        `Step index ${stepIndex} is out of range. Valid range: 0-${sessionData.session.steps.length - 1}`,
        { stepIndex, maxIndex: sessionData.session.steps.length - 1 }
      );
    }
  }

  // Step Execution Management

  async addStepExecution(sessionData: SessionData, stepExecution: StepExecution): Promise<void> {
    // Validate step index
    this.validateStepIndex(sessionData, stepExecution.stepIndex);

    // Ensure temporal ordering
    this.validateTemporalOrdering(sessionData, stepExecution);

    // Add or update step execution
    const existingIndex = sessionData.session.stepExecutions.findIndex(
      se => se.stepIndex === stepExecution.stepIndex
    );

    if (existingIndex >= 0) {
      // Update existing execution
      sessionData.session.stepExecutions[existingIndex] = stepExecution;
    } else {
      // Add new execution
      sessionData.session.stepExecutions.push(stepExecution);
      // Sort by step index to maintain order
      sessionData.session.stepExecutions.sort((a, b) => a.stepIndex - b.stepIndex);
    }

    // Update session metadata
    this.updateSessionProgress(sessionData);
  }

  async updateStepExecution(
    sessionData: SessionData, 
    stepIndex: number, 
    updates: Partial<StepExecution>
  ): Promise<void> {
    this.validateStepIndex(sessionData, stepIndex);

    const executionIndex = sessionData.session.stepExecutions.findIndex(
      se => se.stepIndex === stepIndex
    );

    if (executionIndex === -1) {
      throw this.createError(
        'STEP_EXECUTION_NOT_FOUND',
        `Step execution for index ${stepIndex} not found`,
        { stepIndex }
      );
    }

    const execution = sessionData.session.stepExecutions[executionIndex];
    
    // Apply updates
    Object.assign(execution, updates);
    
    // Update timestamp if status changed
    if (updates.status && updates.status !== execution.status) {
      execution.endTime = new Date();
    }

    // Update session progress
    this.updateSessionProgress(sessionData);
  }

  getStepExecution(sessionData: SessionData, stepIndex: number): StepExecution | null {
    const execution = sessionData.session.stepExecutions.find(
      se => se.stepIndex === stepIndex
    );
    return execution || null;
  }

  getStepExecutions(sessionData: SessionData): StepExecution[] {
    return [...sessionData.session.stepExecutions].sort((a, b) => a.stepIndex - b.stepIndex);
  }

  getCurrentStepIndex(sessionData: SessionData): number {
    // Find the last step that is in progress or the next step to execute
    const executions = this.getStepExecutions(sessionData);
    
    // Find the first step that is not completed
    for (let i = 0; i < sessionData.session.steps.length; i++) {
      const execution = executions.find(se => se.stepIndex === i);
      if (!execution || execution.status !== SessionStatus.COMPLETED) {
        return i;
      }
    }
    
    // All steps are completed
    return sessionData.session.steps.length;
  }

  getStepProgress(sessionData: SessionData): { completed: number; total: number; percentage: number } {
    const total = sessionData.session.steps.length;
    const completed = sessionData.session.stepExecutions.filter(
      se => se.status === SessionStatus.COMPLETED
    ).length;
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  // Step Status Management

  async startStep(sessionData: SessionData, stepIndex: number): Promise<StepExecution> {
    this.validateStepIndex(sessionData, stepIndex);

    const stepName = sessionData.session.steps[stepIndex];
    const now = new Date();

    const stepExecution: StepExecution = {
      stepIndex,
      stepName,
      events: [],
      startTime: now,
      status: SessionStatus.ACTIVE
    };

    await this.addStepExecution(sessionData, stepExecution);
    return stepExecution;
  }

  async completeStep(sessionData: SessionData, stepIndex: number): Promise<void> {
    const execution = this.getStepExecution(sessionData, stepIndex);
    if (!execution) {
      throw this.createError(
        'STEP_EXECUTION_NOT_FOUND',
        `Step execution for index ${stepIndex} not found`,
        { stepIndex }
      );
    }

    await this.updateStepExecution(sessionData, stepIndex, {
      status: SessionStatus.COMPLETED,
      endTime: new Date()
    });
  }

  async failStep(sessionData: SessionData, stepIndex: number, error?: string): Promise<void> {
    const execution = this.getStepExecution(sessionData, stepIndex);
    if (!execution) {
      throw this.createError(
        'STEP_EXECUTION_NOT_FOUND',
        `Step execution for index ${stepIndex} not found`,
        { stepIndex }
      );
    }

    await this.updateStepExecution(sessionData, stepIndex, {
      status: SessionStatus.FAILED,
      endTime: new Date(),
      events: execution.events // Keep existing events but update status
    });

    // Update session metadata with failure information
    sessionData.session.metadata = {
      ...sessionData.session.metadata,
      lastFailedStep: stepIndex,
      lastFailureReason: error,
      lastFailureTime: new Date().toISOString()
    };
  }

  // Step Validation and Utilities

  private validateSteps(steps: string[]): void {
    if (!Array.isArray(steps)) {
      throw this.createError(
        'INVALID_STEPS_FORMAT',
        'Steps must be an array',
        { receivedType: typeof steps }
      );
    }

    if (steps.length === 0) {
      throw this.createError(
        'EMPTY_STEPS_ARRAY',
        'Steps array cannot be empty',
        {}
      );
    }

    if (steps.length > this.config.storage.maxStepsPerSession) {
      throw this.createError(
        'TOO_MANY_STEPS',
        `Too many steps. Maximum allowed: ${this.config.storage.maxStepsPerSession}`,
        { stepCount: steps.length, maxAllowed: this.config.storage.maxStepsPerSession }
      );
    }

    // Validate each step
    steps.forEach((step, index) => {
      if (typeof step !== 'string') {
        throw this.createError(
          'INVALID_STEP_TYPE',
          `Step at index ${index} must be a string`,
          { stepIndex: index, stepType: typeof step }
        );
      }

      if (step.trim().length === 0) {
        throw this.createError(
          'EMPTY_STEP_CONTENT',
          `Step at index ${index} cannot be empty`,
          { stepIndex: index }
        );
      }

      if (step.length > 1000) { // Reasonable limit for step description
        throw this.createError(
          'STEP_TOO_LONG',
          `Step at index ${index} is too long. Maximum 1000 characters`,
          { stepIndex: index, stepLength: step.length }
        );
      }
    });
  }

  private initializeStepExecutions(sessionData: SessionData, steps: string[]): void {
    // Clear existing execution data from maps
    sessionData.investigations.clear();
    sessionData.elementDiscoveries.clear();
    sessionData.contextSummaries.clear();
    
    // Clear working memory if it exists
    if (sessionData.workingMemory) {
      sessionData.workingMemory.knownElements.clear();
      sessionData.workingMemory.extractedVariables.clear();
      sessionData.workingMemory.successfulPatterns = [];
      sessionData.workingMemory.failurePatterns = [];
    }
  }

  private validateTemporalOrdering(sessionData: SessionData, newExecution: StepExecution): void {
    const existingExecution = sessionData.session.stepExecutions.find(
      se => se.stepIndex === newExecution.stepIndex
    );

    if (existingExecution && existingExecution.startTime > newExecution.startTime) {
      throw this.createError(
        'TEMPORAL_ORDERING_VIOLATION',
        `New execution start time must be after existing execution start time`,
        { 
          stepIndex: newExecution.stepIndex,
          existingStartTime: existingExecution.startTime,
          newStartTime: newExecution.startTime
        }
      );
    }

    // Check that this step execution doesn't violate chronological order with other steps
    const laterExecutions = sessionData.session.stepExecutions.filter(
      se => se.stepIndex > newExecution.stepIndex && se.startTime < newExecution.startTime
    );

    if (laterExecutions.length > 0) {
      throw this.createError(
        'CHRONOLOGICAL_ORDER_VIOLATION',
        `Step execution violates chronological order with later steps`,
        { 
          stepIndex: newExecution.stepIndex,
          conflictingSteps: laterExecutions.map(se => se.stepIndex)
        }
      );
    }
  }

  private updateSessionProgress(sessionData: SessionData): void {
    const progress = this.getStepProgress(sessionData);
    
    sessionData.session.metadata = {
      ...sessionData.session.metadata,
      progress: progress.percentage,
      completedSteps: progress.completed,
      totalSteps: progress.total,
      lastProgressUpdate: new Date().toISOString()
    };

    // Update session activity
    sessionData.session.lastActivity = new Date();
  }

  private createError(code: string, message: string, details?: Record<string, any>): ContextManagerError {
    return {
      id: crypto.randomUUID(),
      category: 'VALIDATION' as any,
      severity: 'MEDIUM' as any,
      code,
      message,
      details,
      timestamp: new Date(),
      moduleId: 'ai-context-manager',
      recoverable: true,
      retryable: false,
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private getSuggestedAction(code: string): string {
    switch (code) {
      case 'INVALID_STEP_INDEX':
        return 'Verify step index is within valid range';
      case 'INVALID_STEPS_FORMAT':
        return 'Ensure steps is provided as an array of strings';
      case 'TOO_MANY_STEPS':
        return 'Reduce the number of steps or increase maxStepsPerSession configuration';
      case 'STEP_EXECUTION_NOT_FOUND':
        return 'Initialize step execution before updating';
      case 'TEMPORAL_ORDERING_VIOLATION':
        return 'Ensure step execution timestamps are in chronological order';
      default:
        return 'Review step configuration and try again';
    }
  }

  // Utility Methods

  getStepStatistics(sessionData: SessionData): {
    total: number;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    averageDuration?: number;
  } {
    const total = sessionData.session.steps.length;
    const executions = sessionData.session.stepExecutions;
    
    let pending = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;
    let totalDuration = 0;
    let completedWithDuration = 0;

    for (let i = 0; i < total; i++) {
      const execution = executions.find(se => se.stepIndex === i);
      if (!execution) {
        pending++;
      } else {
        switch (execution.status) {
          case SessionStatus.ACTIVE:
          case SessionStatus.INITIALIZING:
            active++;
            break;
          case SessionStatus.COMPLETED:
            completed++;
            if (execution.endTime) {
              totalDuration += execution.endTime.getTime() - execution.startTime.getTime();
              completedWithDuration++;
            }
            break;
          case SessionStatus.FAILED:
          case SessionStatus.CANCELLED:
            failed++;
            break;
          default:
            pending++;
        }
      }
    }

    const result: any = {
      total,
      pending,
      active,
      completed,
      failed
    };

    if (completedWithDuration > 0) {
      result.averageDuration = totalDuration / completedWithDuration;
    }

    return result;
  }

  findStepsByPattern(sessionData: SessionData, pattern: string): number[] {
    const regex = new RegExp(pattern, 'i');
    const matches: number[] = [];
    
    sessionData.session.steps.forEach((step, index) => {
      if (regex.test(step)) {
        matches.push(index);
      }
    });
    
    return matches;
  }

  getExecutionHistory(sessionData: SessionData): StepExecution[] {
    return this.getStepExecutions(sessionData);
  }
}
