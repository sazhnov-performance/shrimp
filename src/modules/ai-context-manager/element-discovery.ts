import {
  ElementDiscovery,
  ElementProperties,
  InvestigationType,
  SessionData,
  AIContextConfig,
  IContextStorageAdapter,
  ContextManagerError
} from './types';

export class ElementDiscoveryManager {
  private config: AIContextConfig;
  private storageAdapter: IContextStorageAdapter;

  constructor(config: AIContextConfig, storageAdapter: IContextStorageAdapter) {
    this.config = config;
    this.storageAdapter = storageAdapter;
  }

  // Element Discovery Management

  async addPageElementDiscovery(
    sessionData: SessionData,
    stepIndex: number,
    discovery: ElementDiscovery
  ): Promise<void> {
    // Validate step index
    this.validateStepIndex(sessionData, stepIndex);

    // Validate discovery data
    this.validateElementDiscovery(discovery);

    // Ensure element discoveries map exists for session
    if (!sessionData.elementDiscoveries.has(stepIndex)) {
      sessionData.elementDiscoveries.set(stepIndex, []);
    }

    // Check if we already have a discovery for this selector in this step
    const existingDiscoveries = sessionData.elementDiscoveries.get(stepIndex)!;
    const existingIndex = existingDiscoveries.findIndex(
      d => d.selector === discovery.selector && d.elementType === discovery.elementType
    );

    if (existingIndex >= 0) {
      // Update existing discovery with new information
      const existing = existingDiscoveries[existingIndex];
      existing.confidence = this.calculateUpdatedConfidence(existing.confidence, discovery.confidence);
      existing.timestamp = discovery.timestamp;
      existing.isReliable = existing.confidence >= this.config.workingMemory.reliabilityThreshold;
      existing.metadata = { ...existing.metadata, ...discovery.metadata };
      
      // Merge properties
      Object.assign(existing.properties, discovery.properties);
    } else {
      // Add new discovery
      existingDiscoveries.push(discovery);
    }

    // Save to persistent storage
    await this.storageAdapter.saveElementDiscovery(
      sessionData.session.sessionId, 
      stepIndex, 
      discovery
    );

    // Update session activity
    sessionData.session.lastActivity = new Date();
  }

  getPageElementsDiscovered(sessionData: SessionData, stepIndex: number): ElementDiscovery[] {
    const discoveries = sessionData.elementDiscoveries.get(stepIndex);
    return discoveries ? [...discoveries] : [];
  }

  getElementDiscoveryBySelector(
    sessionData: SessionData, 
    stepIndex: number, 
    selector: string
  ): ElementDiscovery | null {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    return discoveries.find(d => d.selector === selector) || null;
  }

  getAllElementDiscoveries(sessionData: SessionData): Array<{
    stepIndex: number;
    discoveries: ElementDiscovery[];
  }> {
    const result: Array<{ stepIndex: number; discoveries: ElementDiscovery[] }> = [];
    
    for (const [stepIndex, discoveries] of sessionData.elementDiscoveries.entries()) {
      result.push({
        stepIndex,
        discoveries: [...discoveries]
      });
    }

    return result.sort((a, b) => a.stepIndex - b.stepIndex);
  }

  // Element Discovery Analytics

  getReliableElementDiscoveries(sessionData: SessionData, stepIndex: number): ElementDiscovery[] {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    return discoveries.filter(d => d.isReliable)
      .sort((a, b) => b.confidence - a.confidence);
  }

  getElementDiscoveriesByType(
    sessionData: SessionData, 
    stepIndex: number, 
    elementType: string
  ): ElementDiscovery[] {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    return discoveries.filter(d => d.elementType === elementType)
      .sort((a, b) => b.confidence - a.confidence);
  }

  getElementDiscoveriesByMethod(
    sessionData: SessionData, 
    stepIndex: number, 
    method: InvestigationType
  ): ElementDiscovery[] {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    return discoveries.filter(d => d.discoveryMethod === method)
      .sort((a, b) => b.confidence - a.confidence);
  }

  getInteractableElements(sessionData: SessionData, stepIndex: number): ElementDiscovery[] {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    return discoveries.filter(d => d.properties.isInteractable)
      .sort((a, b) => b.confidence - a.confidence);
  }

  getVisibleElements(sessionData: SessionData, stepIndex: number): ElementDiscovery[] {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    return discoveries.filter(d => d.properties.isVisible)
      .sort((a, b) => b.confidence - a.confidence);
  }

  // Element Discovery Statistics

  getDiscoveryStatistics(sessionData: SessionData, stepIndex: number): {
    totalDiscoveries: number;
    reliableDiscoveries: number;
    interactableDiscoveries: number;
    visibleDiscoveries: number;
    averageConfidence: number;
    byElementType: Record<string, number>;
    byDiscoveryMethod: Record<InvestigationType, number>;
    reliabilityRate: number;
  } {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    
    const reliable = discoveries.filter(d => d.isReliable);
    const interactable = discoveries.filter(d => d.properties.isInteractable);
    const visible = discoveries.filter(d => d.properties.isVisible);
    
    const totalConfidence = discoveries.reduce((sum, d) => sum + d.confidence, 0);
    
    // Group by element type
    const byElementType: Record<string, number> = {};
    discoveries.forEach(d => {
      byElementType[d.elementType] = (byElementType[d.elementType] || 0) + 1;
    });

    // Group by discovery method
    const byDiscoveryMethod: Record<InvestigationType, number> = {} as any;
    Object.values(InvestigationType).forEach(method => {
      byDiscoveryMethod[method] = discoveries.filter(d => d.discoveryMethod === method).length;
    });

    return {
      totalDiscoveries: discoveries.length,
      reliableDiscoveries: reliable.length,
      interactableDiscoveries: interactable.length,
      visibleDiscoveries: visible.length,
      averageConfidence: discoveries.length > 0 ? totalConfidence / discoveries.length : 0,
      byElementType,
      byDiscoveryMethod,
      reliabilityRate: discoveries.length > 0 ? reliable.length / discoveries.length : 0
    };
  }

  // Element Discovery Search and Filtering

  searchElementDiscoveries(
    sessionData: SessionData,
    stepIndex: number,
    searchCriteria: {
      selector?: string;
      elementType?: string;
      tagName?: string;
      textContent?: string;
      minConfidence?: number;
      isReliable?: boolean;
      isInteractable?: boolean;
      isVisible?: boolean;
      discoveryMethod?: InvestigationType;
    }
  ): ElementDiscovery[] {
    let discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);

    // Filter by selector pattern
    if (searchCriteria.selector) {
      const pattern = new RegExp(searchCriteria.selector, 'i');
      discoveries = discoveries.filter(d => pattern.test(d.selector));
    }

    // Filter by element type
    if (searchCriteria.elementType) {
      discoveries = discoveries.filter(d => d.elementType === searchCriteria.elementType);
    }

    // Filter by tag name
    if (searchCriteria.tagName) {
      discoveries = discoveries.filter(d => 
        d.properties.tagName.toLowerCase() === searchCriteria.tagName.toLowerCase()
      );
    }

    // Filter by text content
    if (searchCriteria.textContent) {
      const pattern = new RegExp(searchCriteria.textContent, 'i');
      discoveries = discoveries.filter(d => 
        d.properties.textContent && pattern.test(d.properties.textContent)
      );
    }

    // Filter by minimum confidence
    if (searchCriteria.minConfidence !== undefined) {
      discoveries = discoveries.filter(d => d.confidence >= searchCriteria.minConfidence!);
    }

    // Filter by reliability
    if (searchCriteria.isReliable !== undefined) {
      discoveries = discoveries.filter(d => d.isReliable === searchCriteria.isReliable);
    }

    // Filter by interactability
    if (searchCriteria.isInteractable !== undefined) {
      discoveries = discoveries.filter(d => d.properties.isInteractable === searchCriteria.isInteractable);
    }

    // Filter by visibility
    if (searchCriteria.isVisible !== undefined) {
      discoveries = discoveries.filter(d => d.properties.isVisible === searchCriteria.isVisible);
    }

    // Filter by discovery method
    if (searchCriteria.discoveryMethod) {
      discoveries = discoveries.filter(d => d.discoveryMethod === searchCriteria.discoveryMethod);
    }

    return discoveries.sort((a, b) => b.confidence - a.confidence);
  }

  // Element Discovery Optimization

  findBestSelectors(sessionData: SessionData, stepIndex: number): Array<{
    selector: string;
    confidence: number;
    elementType: string;
    isReliable: boolean;
    discoveryMethods: InvestigationType[];
  }> {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    
    // Group by selector
    const selectorGroups = new Map<string, ElementDiscovery[]>();
    discoveries.forEach(discovery => {
      if (!selectorGroups.has(discovery.selector)) {
        selectorGroups.set(discovery.selector, []);
      }
      selectorGroups.get(discovery.selector)!.push(discovery);
    });

    // Analyze each selector group
    const results: Array<{
      selector: string;
      confidence: number;
      elementType: string;
      isReliable: boolean;
      discoveryMethods: InvestigationType[];
    }> = [];

    for (const [selector, groupDiscoveries] of selectorGroups.entries()) {
      // Calculate aggregate confidence
      const avgConfidence = groupDiscoveries.reduce((sum, d) => sum + d.confidence, 0) / groupDiscoveries.length;
      
      // Get unique discovery methods
      const discoveryMethods = [...new Set(groupDiscoveries.map(d => d.discoveryMethod))];
      
      // Use the most recent discovery data
      const latest = groupDiscoveries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      results.push({
        selector,
        confidence: avgConfidence,
        elementType: latest.elementType,
        isReliable: avgConfidence >= this.config.workingMemory.reliabilityThreshold,
        discoveryMethods
      });
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  findDuplicateDiscoveries(sessionData: SessionData, stepIndex: number): Array<{
    selector: string;
    duplicates: ElementDiscovery[];
    suggestedMerge: ElementDiscovery;
  }> {
    const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
    const duplicateGroups: Array<{
      selector: string;
      duplicates: ElementDiscovery[];
      suggestedMerge: ElementDiscovery;
    }> = [];

    // Group by selector
    const selectorGroups = new Map<string, ElementDiscovery[]>();
    discoveries.forEach(discovery => {
      if (!selectorGroups.has(discovery.selector)) {
        selectorGroups.set(discovery.selector, []);
      }
      selectorGroups.get(discovery.selector)!.push(discovery);
    });

    // Find groups with multiple discoveries
    for (const [selector, groupDiscoveries] of selectorGroups.entries()) {
      if (groupDiscoveries.length > 1) {
        // Create merged discovery
        const latest = groupDiscoveries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        const avgConfidence = groupDiscoveries.reduce((sum, d) => sum + d.confidence, 0) / groupDiscoveries.length;
        
        const suggestedMerge: ElementDiscovery = {
          ...latest,
          confidence: avgConfidence,
          isReliable: avgConfidence >= this.config.workingMemory.reliabilityThreshold,
          metadata: {
            ...latest.metadata,
            mergedFrom: groupDiscoveries.length,
            discoveryMethods: [...new Set(groupDiscoveries.map(d => d.discoveryMethod))]
          }
        };

        duplicateGroups.push({
          selector,
          duplicates: groupDiscoveries,
          suggestedMerge
        });
      }
    }

    return duplicateGroups;
  }

  // Element Discovery Validation

  validateElementSelector(selector: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    let isValid = true;

    // Basic syntax validation
    try {
      document.querySelector(selector);
    } catch (error) {
      isValid = false;
      issues.push('Invalid CSS selector syntax');
    }

    // Check for overly complex selectors
    if (selector.length > 200) {
      issues.push('Selector is very long and may be fragile');
    }

    // Check for fragile patterns
    const fragilePatterns = [
      /nth-child\(\d+\)/g,
      /nth-of-type\(\d+\)/g,
      /:contains\(/g
    ];

    fragilePatterns.forEach(pattern => {
      if (pattern.test(selector)) {
        issues.push('Selector contains fragile patterns that may break with page changes');
      }
    });

    // Check for overly specific selectors
    const specificity = (selector.match(/[#.]/g) || []).length + (selector.match(/\s/g) || []).length;
    if (specificity > 5) {
      issues.push('Selector may be overly specific');
    }

    return { isValid, issues };
  }

  optimizeSelector(discovery: ElementDiscovery): {
    originalSelector: string;
    optimizedSelector?: string;
    optimizationReason: string;
    confidenceChange: number;
  } {
    const originalSelector = discovery.selector;
    let optimizedSelector: string | undefined;
    let optimizationReason = 'No optimization needed';
    let confidenceChange = 0;

    // Simple optimization strategies
    
    // Remove unnecessary descendant selectors
    if (originalSelector.includes(' ')) {
      const parts = originalSelector.split(' ');
      if (parts.length > 3) {
        optimizedSelector = parts.slice(-2).join(' ');
        optimizationReason = 'Simplified descendant selector';
        confidenceChange = -0.1; // Slightly less confident in simplified selector
      }
    }

    // Convert complex attribute selectors to simpler ones
    if (originalSelector.includes('[') && discovery.properties.attributes) {
      const id = discovery.properties.attributes['id'];
      const className = discovery.properties.attributes['class'];
      
      if (id && !originalSelector.includes('#')) {
        optimizedSelector = `#${id}`;
        optimizationReason = 'Converted to ID selector';
        confidenceChange = 0.2; // ID selectors are more reliable
      } else if (className && !originalSelector.includes('.')) {
        const firstClass = className.split(' ')[0];
        optimizedSelector = `.${firstClass}`;
        optimizationReason = 'Converted to class selector';
        confidenceChange = 0.1; // Class selectors are fairly reliable
      }
    }

    return {
      originalSelector,
      optimizedSelector,
      optimizationReason,
      confidenceChange
    };
  }

  // Element Discovery Export and Reporting

  exportElementDiscoveries(
    sessionData: SessionData, 
    stepIndex?: number, 
    format: 'json' | 'csv' = 'json'
  ): string {
    let allDiscoveries: Array<{ stepIndex: number; discovery: ElementDiscovery }> = [];

    if (stepIndex !== undefined) {
      const discoveries = this.getPageElementsDiscovered(sessionData, stepIndex);
      allDiscoveries = discoveries.map(d => ({ stepIndex, discovery: d }));
    } else {
      // Export all discoveries from all steps
      for (const [step, discoveries] of sessionData.elementDiscoveries.entries()) {
        for (const discovery of discoveries) {
          allDiscoveries.push({ stepIndex: step, discovery });
        }
      }
    }

    if (format === 'csv') {
      const headers = [
        'stepIndex', 'discoveryId', 'selector', 'elementType', 'tagName', 
        'confidence', 'isReliable', 'isVisible', 'isInteractable', 
        'textContent', 'discoveryMethod', 'timestamp'
      ];
      
      const rows = allDiscoveries.map(item => [
        item.stepIndex,
        item.discovery.discoveryId,
        item.discovery.selector,
        item.discovery.elementType,
        item.discovery.properties.tagName,
        item.discovery.confidence,
        item.discovery.isReliable,
        item.discovery.properties.isVisible,
        item.discovery.properties.isInteractable,
        (item.discovery.properties.textContent || '').replace(/"/g, '""'),
        item.discovery.discoveryMethod,
        item.discovery.timestamp.toISOString()
      ]);

      return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    return JSON.stringify(allDiscoveries, null, 2);
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

  private validateElementDiscovery(discovery: ElementDiscovery): void {
    if (!discovery.discoveryId) {
      throw this.createError(
        'MISSING_DISCOVERY_ID',
        'Discovery ID is required',
        { discovery }
      );
    }

    if (!discovery.selector || typeof discovery.selector !== 'string') {
      throw this.createError(
        'INVALID_SELECTOR',
        'Valid selector string is required',
        { selector: discovery.selector }
      );
    }

    if (discovery.confidence < 0 || discovery.confidence > 1) {
      throw this.createError(
        'INVALID_CONFIDENCE',
        'Confidence must be between 0 and 1',
        { confidence: discovery.confidence }
      );
    }

    if (!Object.values(InvestigationType).includes(discovery.discoveryMethod)) {
      throw this.createError(
        'INVALID_DISCOVERY_METHOD',
        `Invalid discovery method: ${discovery.discoveryMethod}`,
        { method: discovery.discoveryMethod }
      );
    }
  }

  private calculateUpdatedConfidence(currentConfidence: number, newConfidence: number): number {
    // Weighted average with a bias toward higher confidence
    const weight = 0.3; // Give 30% weight to new confidence, 70% to existing
    return currentConfidence * (1 - weight) + newConfidence * weight;
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
      case 'MISSING_DISCOVERY_ID':
        return 'Ensure discovery has a unique ID before adding';
      case 'INVALID_SELECTOR':
        return 'Provide a valid CSS selector string';
      case 'INVALID_CONFIDENCE':
        return 'Ensure confidence value is between 0 and 1';
      case 'INVALID_DISCOVERY_METHOD':
        return 'Use a valid InvestigationType enum value';
      default:
        return 'Review element discovery data and try again';
    }
  }
}
