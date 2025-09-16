import {
  InvestigationResult,
  InvestigationType,
  InvestigationInput,
  InvestigationOutput,
  SessionData,
  AIContextConfig,
  IContextStorageAdapter,
  ContextManagerError
} from './types';

export class InvestigationManager {
  private config: AIContextConfig;
  private storageAdapter: IContextStorageAdapter;

  constructor(config: AIContextConfig, storageAdapter: IContextStorageAdapter) {
    this.config = config;
    this.storageAdapter = storageAdapter;
  }

  // Investigation Result Management

  async addInvestigationResult(
    sessionData: SessionData,
    stepIndex: number,
    investigation: InvestigationResult
  ): Promise<string> {
    // Validate step index
    this.validateStepIndex(sessionData, stepIndex);

    // Validate investigation data
    this.validateInvestigationResult(investigation);

    // Check investigation limits
    const currentInvestigations = this.getInvestigationHistory(sessionData, stepIndex);
    if (currentInvestigations.length >= this.config.investigation.maxInvestigationsPerStep) {
      throw this.createError(
        'MAX_INVESTIGATIONS_EXCEEDED',
        `Maximum investigations per step (${this.config.investigation.maxInvestigationsPerStep}) exceeded`,
        { stepIndex, currentCount: currentInvestigations.length }
      );
    }

    // Ensure investigations map exists for session
    if (!sessionData.investigations.has(stepIndex)) {
      sessionData.investigations.set(stepIndex, []);
    }

    // Add investigation to session data
    const investigations = sessionData.investigations.get(stepIndex)!;
    investigations.push(investigation);

    // Save to persistent storage
    await this.storageAdapter.saveInvestigationResult(
      sessionData.session.sessionId, 
      stepIndex, 
      investigation
    );

    // Update session activity
    sessionData.session.lastActivity = new Date();

    return investigation.investigationId;
  }

  getInvestigationHistory(sessionData: SessionData, stepIndex: number): InvestigationResult[] {
    const investigations = sessionData.investigations.get(stepIndex);
    return investigations ? [...investigations] : [];
  }

  getInvestigationById(
    sessionData: SessionData, 
    stepIndex: number, 
    investigationId: string
  ): InvestigationResult | null {
    const investigations = this.getInvestigationHistory(sessionData, stepIndex);
    return investigations.find(inv => inv.investigationId === investigationId) || null;
  }

  getInvestigationsByType(
    sessionData: SessionData, 
    stepIndex: number, 
    type: InvestigationType
  ): InvestigationResult[] {
    const investigations = this.getInvestigationHistory(sessionData, stepIndex);
    return investigations.filter(inv => inv.investigationType === type);
  }

  getSuccessfulInvestigations(sessionData: SessionData, stepIndex: number): InvestigationResult[] {
    const investigations = this.getInvestigationHistory(sessionData, stepIndex);
    return investigations.filter(inv => inv.success);
  }

  getFailedInvestigations(sessionData: SessionData, stepIndex: number): InvestigationResult[] {
    const investigations = this.getInvestigationHistory(sessionData, stepIndex);
    return investigations.filter(inv => !inv.success);
  }

  // Investigation Analytics

  getInvestigationStatistics(sessionData: SessionData, stepIndex: number): {
    totalInvestigations: number;
    successfulInvestigations: number;
    failedInvestigations: number;
    successRate: number;
    byType: Record<InvestigationType, { total: number; successful: number; successRate: number }>;
    averageDuration?: number;
  } {
    const investigations = this.getInvestigationHistory(sessionData, stepIndex);
    const successful = investigations.filter(inv => inv.success);
    const failed = investigations.filter(inv => !inv.success);

    // Group by type
    const byType: Record<string, { total: number; successful: number; successRate: number }> = {};
    for (const type of Object.values(InvestigationType)) {
      const typeInvestigations = investigations.filter(inv => inv.investigationType === type);
      const typeSuccessful = typeInvestigations.filter(inv => inv.success);
      
      byType[type] = {
        total: typeInvestigations.length,
        successful: typeSuccessful.length,
        successRate: typeInvestigations.length > 0 ? typeSuccessful.length / typeInvestigations.length : 0
      };
    }

    const result: any = {
      totalInvestigations: investigations.length,
      successfulInvestigations: successful.length,
      failedInvestigations: failed.length,
      successRate: investigations.length > 0 ? successful.length / investigations.length : 0,
      byType
    };

    // Calculate average duration if timestamp data is available
    const investigationsWithDuration = investigations.filter(inv => 
      inv.metadata?.duration && typeof inv.metadata.duration === 'number'
    );
    
    if (investigationsWithDuration.length > 0) {
      const totalDuration = investigationsWithDuration.reduce(
        (sum, inv) => sum + (inv.metadata!.duration as number), 
        0
      );
      result.averageDuration = totalDuration / investigationsWithDuration.length;
    }

    return result;
  }

  // Investigation Pattern Analysis

  getMostEffectiveInvestigationType(sessionData: SessionData, stepIndex: number): InvestigationType | null {
    const stats = this.getInvestigationStatistics(sessionData, stepIndex);
    
    let bestType: InvestigationType | null = null;
    let bestScore = 0;

    for (const [type, typeStats] of Object.entries(stats.byType)) {
      if (typeStats.total > 0) {
        // Score based on success rate and frequency
        const score = typeStats.successRate * 0.8 + (typeStats.total / stats.totalInvestigations) * 0.2;
        if (score > bestScore) {
          bestScore = score;
          bestType = type as InvestigationType;
        }
      }
    }

    return bestType;
  }

  getInvestigationRecommendations(sessionData: SessionData, stepIndex: number): {
    recommendedTypes: InvestigationType[];
    avoidTypes: InvestigationType[];
    reasoning: string;
  } {
    const stats = this.getInvestigationStatistics(sessionData, stepIndex);
    const recommendedTypes: InvestigationType[] = [];
    const avoidTypes: InvestigationType[] = [];

    // Analyze each type
    for (const [type, typeStats] of Object.entries(stats.byType)) {
      const investigationType = type as InvestigationType;
      
      if (typeStats.total >= 3) { // Enough data to make recommendations
        if (typeStats.successRate >= 0.7) {
          recommendedTypes.push(investigationType);
        } else if (typeStats.successRate <= 0.3) {
          avoidTypes.push(investigationType);
        }
      }
    }

    // Sort by success rate
    recommendedTypes.sort((a, b) => stats.byType[b].successRate - stats.byType[a].successRate);
    avoidTypes.sort((a, b) => stats.byType[a].successRate - stats.byType[b].successRate);

    let reasoning = 'Based on investigation history: ';
    if (recommendedTypes.length > 0) {
      reasoning += `Recommended types have shown ${Math.round(stats.byType[recommendedTypes[0]].successRate * 100)}%+ success rate. `;
    }
    if (avoidTypes.length > 0) {
      reasoning += `Avoid types with ${Math.round(stats.byType[avoidTypes[0]].successRate * 100)}%- success rate.`;
    }
    if (recommendedTypes.length === 0 && avoidTypes.length === 0) {
      reasoning += 'Insufficient data for specific recommendations.';
    }

    return {
      recommendedTypes,
      avoidTypes,
      reasoning
    };
  }

  // Investigation Search and Filtering

  searchInvestigationResults(
    sessionData: SessionData,
    stepIndex: number,
    searchCriteria: {
      type?: InvestigationType;
      success?: boolean;
      textPattern?: string;
      timeRange?: [Date, Date];
    }
  ): InvestigationResult[] {
    let investigations = this.getInvestigationHistory(sessionData, stepIndex);

    // Filter by type
    if (searchCriteria.type) {
      investigations = investigations.filter(inv => inv.investigationType === searchCriteria.type);
    }

    // Filter by success
    if (searchCriteria.success !== undefined) {
      investigations = investigations.filter(inv => inv.success === searchCriteria.success);
    }

    // Filter by text pattern
    if (searchCriteria.textPattern) {
      const pattern = new RegExp(searchCriteria.textPattern, 'i');
      investigations = investigations.filter(inv => {
        const textContent = inv.output.textContent || '';
        const summary = inv.output.summary || '';
        const visualDescription = inv.output.visualDescription || '';
        return pattern.test(textContent) || pattern.test(summary) || pattern.test(visualDescription);
      });
    }

    // Filter by time range
    if (searchCriteria.timeRange) {
      const [startTime, endTime] = searchCriteria.timeRange;
      investigations = investigations.filter(inv => 
        inv.timestamp >= startTime && inv.timestamp <= endTime
      );
    }

    return investigations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Investigation Cleanup and Maintenance

  async cleanupOldInvestigations(sessionData: SessionData, retentionMs: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - retentionMs);
    let cleanedCount = 0;

    for (const [stepIndex, investigations] of sessionData.investigations.entries()) {
      const originalCount = investigations.length;
      const filteredInvestigations = investigations.filter(
        inv => inv.timestamp >= cutoffTime
      );
      
      if (filteredInvestigations.length < originalCount) {
        sessionData.investigations.set(stepIndex, filteredInvestigations);
        cleanedCount += originalCount - filteredInvestigations.length;
      }
    }

    if (cleanedCount > 0) {
      sessionData.session.lastActivity = new Date();
    }

    return cleanedCount;
  }

  async optimizeInvestigationStorage(sessionData: SessionData): Promise<{
    originalSize: number;
    optimizedSize: number;
    savings: number;
  }> {
    let originalSize = 0;
    let optimizedSize = 0;

    for (const [stepIndex, investigations] of sessionData.investigations.entries()) {
      for (const investigation of investigations) {
        // Calculate original size
        const originalContent = JSON.stringify(investigation);
        originalSize += originalContent.length;

        // Optimize by removing large DOM content but keeping summaries
        if (investigation.output.domContent && investigation.output.domContent.length > 10000) {
          investigation.output.domContent = undefined; // Remove large DOM, keep summary
        }

        // Truncate very long text content
        if (investigation.output.textContent && investigation.output.textContent.length > 5000) {
          investigation.output.textContent = investigation.output.textContent.substring(0, 5000) + '...';
        }

        // Calculate optimized size
        const optimizedContent = JSON.stringify(investigation);
        optimizedSize += optimizedContent.length;
      }
    }

    return {
      originalSize,
      optimizedSize,
      savings: originalSize - optimizedSize
    };
  }

  // Investigation Export and Reporting

  exportInvestigationHistory(
    sessionData: SessionData, 
    stepIndex?: number, 
    format: 'json' | 'csv' = 'json'
  ): string {
    let allInvestigations: Array<{ stepIndex: number; investigation: InvestigationResult }> = [];

    if (stepIndex !== undefined) {
      const investigations = this.getInvestigationHistory(sessionData, stepIndex);
      allInvestigations = investigations.map(inv => ({ stepIndex, investigation: inv }));
    } else {
      // Export all investigations from all steps
      for (const [step, investigations] of sessionData.investigations.entries()) {
        for (const investigation of investigations) {
          allInvestigations.push({ stepIndex: step, investigation });
        }
      }
    }

    if (format === 'csv') {
      const headers = [
        'stepIndex', 'investigationId', 'type', 'timestamp', 'success', 
        'textContent', 'summary', 'visualDescription', 'error'
      ];
      
      const rows = allInvestigations.map(item => [
        item.stepIndex,
        item.investigation.investigationId,
        item.investigation.investigationType,
        item.investigation.timestamp.toISOString(),
        item.investigation.success,
        (item.investigation.output.textContent || '').replace(/"/g, '""'),
        (item.investigation.output.summary || '').replace(/"/g, '""'),
        (item.investigation.output.visualDescription || '').replace(/"/g, '""'),
        (item.investigation.error || '').replace(/"/g, '""')
      ]);

      return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    return JSON.stringify(allInvestigations, null, 2);
  }

  generateInvestigationReport(sessionData: SessionData): {
    summary: {
      totalSteps: number;
      stepsWithInvestigations: number;
      totalInvestigations: number;
      overallSuccessRate: number;
    };
    stepDetails: Array<{
      stepIndex: number;
      stepName: string;
      investigations: number;
      successRate: number;
      mostEffectiveType?: InvestigationType;
    }>;
    typeAnalysis: Record<InvestigationType, {
      totalUsage: number;
      successRate: number;
      averagePerStep: number;
    }>;
  } {
    const totalSteps = sessionData.session.steps.length;
    const stepsWithInvestigations = Array.from(sessionData.investigations.keys()).length;
    
    let totalInvestigations = 0;
    let totalSuccessful = 0;
    const typeUsage: Record<string, { total: number; successful: number }> = {};

    // Initialize type tracking
    for (const type of Object.values(InvestigationType)) {
      typeUsage[type] = { total: 0, successful: 0 };
    }

    const stepDetails: Array<{
      stepIndex: number;
      stepName: string;
      investigations: number;
      successRate: number;
      mostEffectiveType?: InvestigationType;
    }> = [];

    // Analyze each step
    for (let i = 0; i < totalSteps; i++) {
      const investigations = this.getInvestigationHistory(sessionData, i);
      const successful = investigations.filter(inv => inv.success);
      
      totalInvestigations += investigations.length;
      totalSuccessful += successful.length;

      // Track type usage
      for (const investigation of investigations) {
        typeUsage[investigation.investigationType].total++;
        if (investigation.success) {
          typeUsage[investigation.investigationType].successful++;
        }
      }

      // Find most effective type for this step
      const mostEffectiveType = this.getMostEffectiveInvestigationType(sessionData, i);

      stepDetails.push({
        stepIndex: i,
        stepName: sessionData.session.steps[i],
        investigations: investigations.length,
        successRate: investigations.length > 0 ? successful.length / investigations.length : 0,
        mostEffectiveType: mostEffectiveType || undefined
      });
    }

    // Calculate type analysis
    const typeAnalysis: Record<InvestigationType, any> = {} as any;
    for (const [type, usage] of Object.entries(typeUsage)) {
      typeAnalysis[type as InvestigationType] = {
        totalUsage: usage.total,
        successRate: usage.total > 0 ? usage.successful / usage.total : 0,
        averagePerStep: stepsWithInvestigations > 0 ? usage.total / stepsWithInvestigations : 0
      };
    }

    return {
      summary: {
        totalSteps,
        stepsWithInvestigations,
        totalInvestigations,
        overallSuccessRate: totalInvestigations > 0 ? totalSuccessful / totalInvestigations : 0
      },
      stepDetails,
      typeAnalysis
    };
  }

  // Helper Methods

  private validateStepIndex(sessionData: SessionData, stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= sessionData.session.steps.length) {
      throw this.createError(
        'INVALID_STEP_INDEX',
        `Step index ${stepIndex} is out of range`,
        { stepIndex, maxIndex: sessionData.session.steps.length - 1 }
      );
    }
  }

  private validateInvestigationResult(investigation: InvestigationResult): void {
    if (!investigation.investigationId) {
      throw this.createError(
        'MISSING_INVESTIGATION_ID',
        'Investigation ID is required',
        { investigation }
      );
    }

    if (!Object.values(InvestigationType).includes(investigation.investigationType)) {
      throw this.createError(
        'INVALID_INVESTIGATION_TYPE',
        `Invalid investigation type: ${investigation.investigationType}`,
        { type: investigation.investigationType }
      );
    }

    if (!investigation.timestamp || !(investigation.timestamp instanceof Date)) {
      throw this.createError(
        'INVALID_TIMESTAMP',
        'Valid timestamp is required',
        { timestamp: investigation.timestamp }
      );
    }
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
      case 'MAX_INVESTIGATIONS_EXCEEDED':
        return 'Consider increasing maxInvestigationsPerStep or cleaning up old investigations';
      case 'MISSING_INVESTIGATION_ID':
        return 'Ensure investigation has a unique ID before adding';
      case 'INVALID_INVESTIGATION_TYPE':
        return 'Use a valid InvestigationType enum value';
      default:
        return 'Review investigation data and try again';
    }
  }
}
