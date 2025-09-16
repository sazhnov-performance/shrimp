// AI Context Manager - Main Module Interface
import { 
  SessionStatus,
  ExecutorCommand,
  CommandResponse,
  StreamEvent,
  ModuleSessionInfo,
  SessionLifecycleCallbacks,
  ModuleSessionConfig,
  SessionManagerHealth
} from '../../../types/shared-types';

import {
  IAIContextManager,
  AIContextSession,
  StepExecution,
  ExecutionEvent,
  AIContextJson,
  InvestigationContextJson,
  InvestigationResult,
  ElementDiscovery,
  FilteredContextJson,
  ContextFilterOptions,
  StepContextSummary,
  WorkingMemoryUpdate,
  WorkingMemoryState,
  AIContextConfig,
  DEFAULT_AI_CONTEXT_CONFIG,
  SessionData,
  IContextStorageAdapter
} from './types';

import { ContextSessionManager } from './context-session-manager';
import { StepManager } from './step-manager';
import { ExecutionTracker } from './execution-tracker';
import { WorkingMemoryManager } from './working-memory';
import { InvestigationManager } from './investigation-manager';
import { ElementDiscoveryManager } from './element-discovery';
import { ContextFilterManager } from './context-filter';
import { ContextGenerator } from './context-generator';
import { InvestigationContextManager } from './investigation-context';
import { StorageAdapterFactory } from './storage-adapter';

export class AIContextManager implements IAIContextManager {
  readonly moduleId = 'ai-context-manager' as const;
  
  private config: AIContextConfig;
  private storageAdapter: IContextStorageAdapter;
  
  // Component managers
  private sessionManager: ContextSessionManager;
  private stepManager: StepManager;
  private executionTracker: ExecutionTracker;
  private workingMemoryManager: WorkingMemoryManager;
  private investigationManager: InvestigationManager;
  private elementDiscoveryManager: ElementDiscoveryManager;
  private contextFilterManager: ContextFilterManager;
  private contextGenerator: ContextGenerator;
  private investigationContextManager: InvestigationContextManager;

  constructor(config: AIContextConfig = DEFAULT_AI_CONTEXT_CONFIG) {
    this.config = { ...DEFAULT_AI_CONTEXT_CONFIG, ...config };
    this.storageAdapter = StorageAdapterFactory.createAdapter(this.config);
    
    // Initialize component managers
    this.sessionManager = new ContextSessionManager(this.config);
    this.stepManager = new StepManager(this.config);
    this.executionTracker = new ExecutionTracker(this.config, this.storageAdapter);
    this.workingMemoryManager = new WorkingMemoryManager(this.config, this.storageAdapter);
    this.investigationManager = new InvestigationManager(this.config, this.storageAdapter);
    this.elementDiscoveryManager = new ElementDiscoveryManager(this.config, this.storageAdapter);
    this.contextFilterManager = new ContextFilterManager(this.config, this.storageAdapter);
    this.contextGenerator = new ContextGenerator(this.config);
    this.investigationContextManager = new InvestigationContextManager(this.config);
  }

  // Standardized Session Management (ISessionManager implementation)

  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    return await this.sessionManager.createSession(workflowSessionId, config);
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    await this.sessionManager.destroySession(workflowSessionId);
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.sessionManager.getSession(workflowSessionId);
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessionManager.sessionExists(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    await this.sessionManager.updateSessionStatus(workflowSessionId, status);
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    return this.sessionManager.getSessionStatus(workflowSessionId);
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    await this.sessionManager.recordActivity(workflowSessionId);
  }

  getLastActivity(workflowSessionId: string): Date | null {
    return this.sessionManager.getLastActivity(workflowSessionId);
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.sessionManager.setLifecycleCallbacks(callbacks);
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    return await this.sessionManager.healthCheck();
  }

  // AI Context Specific Methods

  async linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void> {
    await this.sessionManager.linkExecutorSession(workflowSessionId, executorSessionId);
  }

  // Step Management

  async setSteps(workflowSessionId: string, steps: string[]): Promise<void> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    await this.stepManager.setSteps(sessionData, steps);
    await this.saveSessionData(sessionData);
  }

  getSteps(workflowSessionId: string): string[] | null {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? this.stepManager.getSteps(sessionData) : null;
  }

  // Step Execution Tracking

  async addStepExecution(workflowSessionId: string, stepExecution: StepExecution): Promise<void> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    await this.stepManager.addStepExecution(sessionData, stepExecution);
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
  }

  async updateStepExecution(
    workflowSessionId: string, 
    stepIndex: number, 
    updates: Partial<StepExecution>
  ): Promise<void> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    await this.stepManager.updateStepExecution(sessionData, stepIndex, updates);
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
  }

  getStepExecution(workflowSessionId: string, stepIndex: number): StepExecution | null {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? this.stepManager.getStepExecution(sessionData, stepIndex) : null;
  }

  // Event Management

  async addExecutionEvent(
    workflowSessionId: string,
    stepIndex: number,
    command: ExecutorCommand,
    result: CommandResponse,
    reasoning?: string,
    screenshotId?: string
  ): Promise<string> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    
    // Validate step index before proceeding
    if (stepIndex < 0 || stepIndex >= sessionData.session.steps.length) {
      throw new Error(`Step index ${stepIndex} is out of range. Valid range: 0-${sessionData.session.steps.length - 1}`);
    }
    
    const eventId = await this.executionTracker.addExecutionEvent(
      sessionData, 
      stepIndex, 
      command, 
      result, 
      reasoning, 
      screenshotId
    );
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
    return eventId;
  }

  async addExecutionEventFromStream(
    workflowSessionId: string,
    stepIndex: number,
    streamEvent: StreamEvent
  ): Promise<string> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    const eventId = await this.executionTracker.addExecutionEventFromStream(
      sessionData, 
      stepIndex, 
      streamEvent
    );
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
    return eventId;
  }

  getExecutionEvents(workflowSessionId: string, stepIndex: number): ExecutionEvent[] {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? this.executionTracker.getExecutionEvents(sessionData, stepIndex) : [];
  }

  // Context Generation

  async generateContextJson(workflowSessionId: string, targetStep: number): Promise<AIContextJson> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    return await this.contextGenerator.generateContextJson(sessionData, targetStep);
  }

  async generateInvestigationContext(
    workflowSessionId: string, 
    stepIndex: number
  ): Promise<InvestigationContextJson> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    return await this.investigationContextManager.generateInvestigationContext(sessionData, stepIndex);
  }

  // Page Investigation Support

  async addInvestigationResult(
    workflowSessionId: string,
    stepIndex: number,
    investigation: InvestigationResult
  ): Promise<string> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    const investigationId = await this.investigationManager.addInvestigationResult(
      sessionData, 
      stepIndex, 
      investigation
    );
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
    return investigationId;
  }

  getInvestigationHistory(workflowSessionId: string, stepIndex: number): InvestigationResult[] {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? this.investigationManager.getInvestigationHistory(sessionData, stepIndex) : [];
  }

  async addPageElementDiscovery(
    workflowSessionId: string,
    stepIndex: number,
    discovery: ElementDiscovery
  ): Promise<void> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    await this.elementDiscoveryManager.addPageElementDiscovery(sessionData, stepIndex, discovery);
    
    // Update working memory with element knowledge
    if (this.config.investigation.enableElementKnowledge) {
      await this.workingMemoryManager.updateWorkingMemory(sessionData, stepIndex, {
        updateType: 'element_discovery',
        data: {
          selector: discovery.selector,
          elementType: discovery.elementType,
          purpose: 'discovered',
          alternativeSelectors: []
        },
        confidence: discovery.confidence,
        source: discovery.discoveryMethod
      });
    }
    
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
  }

  getPageElementsDiscovered(workflowSessionId: string, stepIndex: number): ElementDiscovery[] {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? this.elementDiscoveryManager.getPageElementsDiscovered(sessionData, stepIndex) : [];
  }

  // Context Filtering and Summarization

  async generateFilteredContext(
    workflowSessionId: string,
    targetStep: number,
    options: ContextFilterOptions
  ): Promise<FilteredContextJson> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    return await this.contextFilterManager.generateFilteredContext(sessionData, targetStep, options);
  }

  async addContextSummary(
    workflowSessionId: string,
    stepIndex: number,
    summary: StepContextSummary
  ): Promise<void> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    await this.contextFilterManager.addContextSummary(sessionData, stepIndex, summary);
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
  }

  getContextSummaries(
    workflowSessionId: string,
    stepRange?: [number, number]
  ): StepContextSummary[] {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? this.contextFilterManager.getContextSummaries(sessionData, stepRange) : [];
  }

  // Working Memory Management

  async updateWorkingMemory(
    workflowSessionId: string,
    stepIndex: number,
    memory: WorkingMemoryUpdate
  ): Promise<void> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    await this.workingMemoryManager.updateWorkingMemory(sessionData, stepIndex, memory);
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
  }

  getWorkingMemory(workflowSessionId: string): WorkingMemoryState {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    return this.workingMemoryManager.getWorkingMemory(sessionData);
  }

  async clearWorkingMemory(workflowSessionId: string): Promise<void> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    await this.workingMemoryManager.clearWorkingMemory(sessionData);
    await this.saveSessionData(sessionData);
    await this.recordActivity(workflowSessionId);
  }

  // Query Methods

  getSessionContext(workflowSessionId: string): AIContextSession | null {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? sessionData.session : null;
  }

  getExecutionHistory(workflowSessionId: string): StepExecution[] {
    const sessionData = this.getSessionData(workflowSessionId);
    return sessionData ? this.stepManager.getExecutionHistory(sessionData) : [];
  }

  // Configuration and Utilities

  getConfiguration(): AIContextConfig {
    return { ...this.config };
  }

  updateConfiguration(updates: Partial<AIContextConfig>): void {
    this.config = { ...this.config, ...updates };
    // Recreate storage adapter if storage config changed
    if (updates.storage) {
      this.storageAdapter = StorageAdapterFactory.createAdapter(this.config);
    }
  }

  // Analytics and Reporting

  async generateAnalyticsReport(workflowSessionId: string): Promise<{
    sessionSummary: {
      sessionId: string;
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      totalEvents: number;
      sessionDuration: number;
    };
    investigationSummary: {
      totalInvestigations: number;
      successRate: number;
      byType: Record<string, { count: number; successRate: number }>;
    };
    elementDiscoverySummary: {
      totalDiscoveries: number;
      reliableDiscoveries: number;
      byMethod: Record<string, number>;
    };
    workingMemorySummary: {
      knownElements: number;
      extractedVariables: number;
      successPatterns: number;
      failurePatterns: number;
    };
  }> {
    const sessionData = this.getSessionDataOrThrow(workflowSessionId);
    
    // Session summary
    const stepStats = this.stepManager.getStepStatistics(sessionData);
    const eventMetrics = this.executionTracker.getEventMetrics(sessionData);
    const sessionDuration = sessionData.session.lastActivity.getTime() - sessionData.session.createdAt.getTime();

    // Investigation summary
    const investigationReport = this.investigationManager.generateInvestigationReport(sessionData);

    // Element discovery summary
    let totalDiscoveries = 0;
    let reliableDiscoveries = 0;
    const byMethod: Record<string, number> = {};

    for (const [stepIndex, discoveries] of sessionData.elementDiscoveries.entries()) {
      totalDiscoveries += discoveries.length;
      reliableDiscoveries += discoveries.filter(d => d.isReliable).length;
      
      discoveries.forEach(d => {
        byMethod[d.discoveryMethod] = (byMethod[d.discoveryMethod] || 0) + 1;
      });
    }

    // Working memory summary
    const memoryStats = this.workingMemoryManager.getMemoryStatistics(sessionData);

    return {
      sessionSummary: {
        sessionId: sessionData.session.linkedWorkflowSessionId,
        totalSteps: stepStats.total,
        completedSteps: stepStats.completed,
        failedSteps: stepStats.failed,
        totalEvents: eventMetrics.totalEvents,
        sessionDuration
      },
      investigationSummary: {
        totalInvestigations: investigationReport.summary.totalInvestigations,
        successRate: investigationReport.summary.overallSuccessRate,
        byType: investigationReport.typeAnalysis as any
      },
      elementDiscoverySummary: {
        totalDiscoveries,
        reliableDiscoveries,
        byMethod
      },
      workingMemorySummary: {
        knownElements: memoryStats.totalElements,
        extractedVariables: memoryStats.totalVariables,
        successPatterns: memoryStats.successPatterns,
        failurePatterns: memoryStats.failurePatterns
      }
    };
  }

  // Cleanup and Maintenance

  async cleanupExpiredSessions(): Promise<number> {
    const allSessions = Array.from(this.sessionManager['sessions'].keys());
    let cleanedCount = 0;

    for (const workflowSessionId of allSessions) {
      const session = this.getSession(workflowSessionId);
      if (session) {
        const age = Date.now() - session.lastActivity.getTime();
        if (age > this.config.storage.sessionTTL) {
          await this.destroySession(workflowSessionId);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  async optimizeStorage(): Promise<{
    sessionsOptimized: number;
    spaceSaved: number;
    errors: string[];
  }> {
    const allSessions = Array.from(this.sessionManager['sessions'].keys());
    let sessionsOptimized = 0;
    let totalSpaceSaved = 0;
    const errors: string[] = [];

    for (const workflowSessionId of allSessions) {
      try {
        const sessionData = this.getSessionData(workflowSessionId);
        if (sessionData) {
          // Clean up old events
          const eventsRemoved = await this.executionTracker.cleanupOldEvents(
            sessionData, 
            this.config.storage.sessionTTL
          );

          // Clean up old investigations
          const investigationsRemoved = await this.investigationManager.cleanupOldInvestigations(
            sessionData, 
            this.config.storage.sessionTTL
          );

          // Optimize investigation storage
          const optimization = await this.investigationManager.optimizeInvestigationStorage(sessionData);
          totalSpaceSaved += optimization.savings;

          if (eventsRemoved > 0 || investigationsRemoved > 0 || optimization.savings > 0) {
            sessionsOptimized++;
            await this.saveSessionData(sessionData);
          }
        }
      } catch (error) {
        errors.push(`Failed to optimize session ${workflowSessionId}: ${error}`);
      }
    }

    return {
      sessionsOptimized,
      spaceSaved: totalSpaceSaved,
      errors
    };
  }

  // Private Helper Methods

  private getSessionData(workflowSessionId: string): SessionData | null {
    return this.sessionManager.getSessionData(workflowSessionId);
  }

  private getSessionDataOrThrow(workflowSessionId: string): SessionData {
    const sessionData = this.getSessionData(workflowSessionId);
    if (!sessionData) {
      throw new Error(`Session ${workflowSessionId} not found`);
    }
    return sessionData;
  }

  private async saveSessionData(sessionData: SessionData): Promise<void> {
    await this.storageAdapter.saveSession(sessionData.session);
    
    // Save working memory if it exists
    if (sessionData.workingMemory) {
      await this.workingMemoryManager.saveWorkingMemory(sessionData);
    }
  }

  // Module lifecycle

  async initialize(): Promise<void> {
    // Perform any initialization tasks
    const health = await this.healthCheck();
    if (!health.isHealthy) {
      throw new Error(`AI Context Manager initialization failed: ${health.errors.map(e => e.message).join(', ')}`);
    }
  }

  async destroy(): Promise<void> {
    // Cleanup resources
    this.sessionManager.destroy();
    
    // Save any pending data
    const allSessions = Array.from(this.sessionManager['sessions'].keys());
    for (const workflowSessionId of allSessions) {
      const sessionData = this.getSessionData(workflowSessionId);
      if (sessionData) {
        await this.saveSessionData(sessionData);
      }
    }
  }
}

// Export all types and classes for external use
export * from './types';
export { StorageAdapterFactory } from './storage-adapter';
export { DEFAULT_AI_CONTEXT_CONFIG };

// Default export
export default AIContextManager;
