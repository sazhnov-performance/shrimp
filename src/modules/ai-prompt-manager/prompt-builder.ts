/**
 * Prompt Builder Implementation
 * Core logic for generating structured AI prompts
 */

import {
  GeneratedPrompt,
  PromptContent,
  ContextSection,
  InstructionSection,
  SchemaSection,
  ValidationSection,
  WorkingMemorySection,
  InvestigationSection,
  EnhancedPromptType,
  InvestigationPhase,
  InvestigationTool,
  ActionPromptRequest,
  ReflectionPromptRequest,
  InvestigationPromptRequest,
  ActionWithInvestigationPromptRequest,
  AIPromptManagerConfig,
  ResponseSchema,
  PromptMetadata
} from './types';

import { getPromptTemplates, replaceTemplateVariables } from './templates';

// Mock interfaces for dependencies (to be replaced with actual implementations)
interface IAIContextManager {
  getExecutionContext(sessionId: string): Promise<any>;
  getStepHistory(sessionId: string, stepIndex: number): Promise<any>;
  getCurrentPageState(sessionId: string): Promise<any>;
  getPreviousPageState(sessionId: string): Promise<any>;
  generateFilteredContext(sessionId: string, stepIndex: number): Promise<any>;
  generateInvestigationContext(sessionId: string): Promise<any>;
  getWorkingMemory(sessionId: string): any;
  getInvestigationHistory(sessionId: string): Promise<any>;
  getPageElementsDiscovered(sessionId: string): Promise<any>;
  getContextSummaries(sessionId: string): Promise<any>;
}

interface IAISchemaManager {
  getResponseSchema(): Promise<ResponseSchema>;
  validateSchemaCompatibility(schema: ResponseSchema): Promise<boolean>;
  getSchemaVersion(): string;
}

export class PromptBuilder {
  private templates = getPromptTemplates();

  constructor(
    private config: AIPromptManagerConfig,
    private contextManager?: IAIContextManager,
    private schemaManager?: IAISchemaManager
  ) {}

  /**
   * Generate action prompt
   */
  async generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt> {
    const promptId = this.generatePromptId();
    const generatedAt = new Date();
    const startTime = Date.now();

    try {
      // Get execution context
      const executionContext = this.contextManager 
        ? await this.contextManager.getExecutionContext(request.sessionId)
        : this.createFallbackContext(request.sessionId, request.currentStepIndex);

      // Get response schema
      const schema = this.schemaManager 
        ? await this.schemaManager.getResponseSchema()
        : this.createFallbackSchema();

      // Determine prompt type
      const promptType = request.currentStepIndex === 0 
        ? EnhancedPromptType.INITIAL_ACTION 
        : EnhancedPromptType.ACTION_WITH_VALIDATION;

      // Build content sections
      const content = await this.buildActionPromptContent(request, executionContext, schema);

      // Create metadata
      const metadata: PromptMetadata = {
        generationTimeMs: Date.now() - startTime,
        templateVersion: this.templates.actionPromptTemplate.version,
        stepIndex: request.currentStepIndex
      };

      return {
        promptId,
        sessionId: request.sessionId,
        stepIndex: request.currentStepIndex,
        promptType,
        content,
        schema,
        generatedAt,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to generate action prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate reflection prompt
   */
  async generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt> {
    const promptId = this.generatePromptId();
    const generatedAt = new Date();
    const startTime = Date.now();

    try {
      // Get execution context
      const executionContext = this.contextManager 
        ? await this.contextManager.getExecutionContext(request.sessionId)
        : this.createFallbackContext(request.sessionId, request.nextStepIndex);

      // Get response schema
      const schema = this.schemaManager 
        ? await this.schemaManager.getResponseSchema()
        : this.createFallbackSchema();

      // Build content sections
      const content = await this.buildReflectionPromptContent(request, executionContext, schema);

      // Create metadata
      const metadata: PromptMetadata = {
        generationTimeMs: Date.now() - startTime,
        templateVersion: this.templates.reflectionPromptTemplate.version,
        stepIndex: request.nextStepIndex,
        completedStepIndex: request.completedStepIndex
      };

      return {
        promptId,
        sessionId: request.sessionId,
        stepIndex: request.nextStepIndex,
        promptType: EnhancedPromptType.REFLECTION_AND_ACTION,
        content,
        schema,
        generatedAt,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to generate reflection prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate investigation prompt
   */
  async generateInvestigationPrompt(request: InvestigationPromptRequest): Promise<GeneratedPrompt> {
    if (!this.config.investigationConfig.enableInvestigationPrompts) {
      throw new Error('Investigation prompts are not enabled');
    }

    const promptId = this.generatePromptId();
    const generatedAt = new Date();
    const startTime = Date.now();

    try {
      // Get execution context
      const executionContext = this.contextManager 
        ? await this.contextManager.getExecutionContext(request.sessionId)
        : this.createFallbackContext(request.sessionId, request.stepIndex);

      // Get response schema
      const schema = this.schemaManager 
        ? await this.schemaManager.getResponseSchema()
        : this.createFallbackSchema();

      // Determine prompt type based on investigation phase
      const promptType = this.getInvestigationPromptType(request.investigationPhase);

      // Build content sections
      const content = await this.buildInvestigationPromptContent(request, executionContext, schema);

      // Create metadata
      const metadata: PromptMetadata = {
        generationTimeMs: Date.now() - startTime,
        templateVersion: this.templates.investigationTemplates?.[request.investigationPhase]?.version || '1.0.0',
        stepIndex: request.stepIndex,
        useInvestigation: true
      };

      return {
        promptId,
        sessionId: request.sessionId,
        stepIndex: request.stepIndex,
        promptType,
        content,
        schema,
        generatedAt,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to generate investigation prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate action prompt with investigation context
   */
  async generateActionWithInvestigationPrompt(request: ActionWithInvestigationPromptRequest): Promise<GeneratedPrompt> {
    const promptId = this.generatePromptId();
    const generatedAt = new Date();
    const startTime = Date.now();

    try {
      // Get execution context
      const executionContext = this.contextManager 
        ? await this.contextManager.getExecutionContext(request.sessionId)
        : this.createFallbackContext(request.sessionId, request.stepIndex);

      // Get response schema
      const schema = this.schemaManager 
        ? await this.schemaManager.getResponseSchema()
        : this.createFallbackSchema();

      // Build content sections with investigation context
      const content = await this.buildActionWithInvestigationPromptContent(request, executionContext, schema);

      // Create metadata
      const metadata: PromptMetadata = {
        generationTimeMs: Date.now() - startTime,
        templateVersion: this.templates.actionPromptTemplate.version,
        stepIndex: request.stepIndex,
        useInvestigation: true,
        investigationContext: request.investigationContext
      };

      return {
        promptId,
        sessionId: request.sessionId,
        stepIndex: request.stepIndex,
        promptType: EnhancedPromptType.ACTION_WITH_INVESTIGATION_CONTEXT,
        content,
        schema,
        generatedAt,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to generate action with investigation prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build action prompt content
   */
  private async buildActionPromptContent(
    request: ActionPromptRequest,
    executionContext: any,
    schema: ResponseSchema
  ): Promise<PromptContent> {
    // System message
    const systemMessage = this.buildSystemMessage(request.sessionId, request.currentStepIndex, executionContext);

    // Context section
    const contextSection = await this.buildContextSection(request, executionContext);

    // Instruction section
    const instructionSection = this.buildInstructionSection(request.currentStepContent, request.promptOptions);

    // Schema section
    const schemaSection = this.buildSchemaSection(schema);

    // Optional sections
    const content: PromptContent = {
      systemMessage,
      contextSection,
      instructionSection,
      schemaSection
    };

    // Add validation section for non-initial steps
    if (request.includeValidation || request.currentStepIndex > 0) {
      content.validationSection = this.buildValidationSection(request);
    }

    // Add working memory section if investigation is enabled
    if (request.promptOptions?.includeWorkingMemory) {
      content.workingMemorySection = await this.buildWorkingMemorySection(request.sessionId);
    }

    return content;
  }

  /**
   * Build reflection prompt content
   */
  private async buildReflectionPromptContent(
    request: ReflectionPromptRequest,
    executionContext: any,
    schema: ResponseSchema
  ): Promise<PromptContent> {
    // System message
    const systemMessage = this.buildSystemMessage(request.sessionId, request.nextStepIndex, executionContext);

    // Context section
    const contextSection = await this.buildContextSectionForReflection(request, executionContext);

    // Instruction section
    const instructionSection = this.buildInstructionSection(request.nextStepContent, request.promptOptions);

    // Schema section
    const schemaSection = this.buildSchemaSection(schema);

    // Validation section for reflection
    const validationSection = this.buildReflectionValidationSection(request);

    const content: PromptContent = {
      systemMessage,
      contextSection,
      instructionSection,
      schemaSection,
      validationSection
    };

    // Add working memory section if requested
    if (request.promptOptions?.includeWorkingMemory) {
      content.workingMemorySection = await this.buildWorkingMemorySection(request.sessionId);
    }

    return content;
  }

  /**
   * Build investigation prompt content
   */
  private async buildInvestigationPromptContent(
    request: InvestigationPromptRequest,
    executionContext: any,
    schema: ResponseSchema
  ): Promise<PromptContent> {
    // System message
    const systemMessage = this.buildSystemMessage(request.sessionId, request.stepIndex, executionContext);

    // Context section
    const contextSection = await this.buildContextSection(
      { sessionId: request.sessionId, currentStepIndex: request.stepIndex, currentStepContent: request.stepContent } as any,
      executionContext
    );

    // Instruction section
    const instructionSection = this.buildInstructionSection(request.stepContent);

    // Schema section
    const schemaSection = this.buildSchemaSection(schema);

    // Investigation section
    const investigationSection = this.buildInvestigationSection(request);

    // Working memory section (always included for investigations)
    const workingMemorySection = await this.buildWorkingMemorySection(request.sessionId);

    return {
      systemMessage,
      contextSection,
      instructionSection,
      schemaSection,
      investigationSection,
      workingMemorySection
    };
  }

  /**
   * Build action with investigation prompt content
   */
  private async buildActionWithInvestigationPromptContent(
    request: ActionWithInvestigationPromptRequest,
    executionContext: any,
    schema: ResponseSchema
  ): Promise<PromptContent> {
    // System message
    const systemMessage = this.buildSystemMessage(request.sessionId, request.stepIndex, executionContext);

    // Context section with investigation context
    const contextSection = await this.buildContextSectionWithInvestigation(request, executionContext);

    // Instruction section
    const instructionSection = this.buildInstructionSection(request.stepContent, request.promptOptions);

    // Schema section
    const schemaSection = this.buildSchemaSection(schema);

    // Working memory section
    const workingMemorySection = await this.buildWorkingMemorySection(request.sessionId);

    return {
      systemMessage,
      contextSection,
      instructionSection,
      schemaSection,
      workingMemorySection
    };
  }

  /**
   * Build system message
   */
  private buildSystemMessage(sessionId: string, stepIndex: number, executionContext: any): string {
    const variables = {
      sessionId,
      stepIndex: stepIndex + 1, // Convert to 1-based for display
      totalSteps: executionContext?.steps?.length || 1,
      stepName: executionContext?.steps?.[stepIndex] || 'Unknown step'
    };

    return replaceTemplateVariables(this.templates.systemMessageTemplate.template, variables);
  }

  /**
   * Build context section
   */
  private async buildContextSection(request: ActionPromptRequest, executionContext: any): Promise<ContextSection> {
    const contextSection: ContextSection = {
      currentStep: {
        stepIndex: request.currentStepIndex,
        stepContent: request.currentStepContent,
        stepType: request.currentStepIndex === 0 ? 'initial' : 'continuation',
        totalSteps: executionContext?.steps?.length || 1
      },
      executionHistory: {
        previousSteps: executionContext?.previousSteps || [],
        chronologicalEvents: executionContext?.chronologicalEvents || [],
        successfulActions: executionContext?.successfulActions || 0,
        failedActions: executionContext?.failedActions || 0
      },
      pageStates: {
        currentPageDom: executionContext?.currentPageDom,
        currentPageUrl: executionContext?.currentPageUrl,
        previousPageState: executionContext?.previousPageState
      }
    };

    // Add filtered context if requested
    if (request.promptOptions?.useFilteredContext && this.contextManager) {
      try {
        contextSection.filteredContext = await this.contextManager.generateFilteredContext(
          request.sessionId,
          request.currentStepIndex
        );
      } catch (error) {
        // Continue without filtered context if it fails
      }
    }

    return contextSection;
  }

  /**
   * Build context section for reflection
   */
  private async buildContextSectionForReflection(request: ReflectionPromptRequest, executionContext: any): Promise<ContextSection> {
    return {
      currentStep: {
        stepIndex: request.nextStepIndex,
        stepContent: request.nextStepContent,
        stepType: 'continuation',
        totalSteps: executionContext?.steps?.length || 1
      },
      executionHistory: {
        previousSteps: executionContext?.previousSteps || [],
        chronologicalEvents: executionContext?.chronologicalEvents || [],
        successfulActions: executionContext?.successfulActions || 0,
        failedActions: executionContext?.failedActions || 0
      },
      pageStates: {
        currentPageDom: executionContext?.currentPageDom,
        currentPageUrl: executionContext?.currentPageUrl,
        previousPageState: executionContext?.previousPageState
      }
    };
  }

  /**
   * Build context section with investigation
   */
  private async buildContextSectionWithInvestigation(
    request: ActionWithInvestigationPromptRequest,
    executionContext: any
  ): Promise<ContextSection> {
    const contextSection: ContextSection = {
      currentStep: {
        stepIndex: request.stepIndex,
        stepContent: request.stepContent,
        stepType: 'continuation',
        totalSteps: executionContext?.steps?.length || 1
      },
      executionHistory: {
        previousSteps: executionContext?.previousSteps || [],
        chronologicalEvents: executionContext?.chronologicalEvents || [],
        successfulActions: executionContext?.successfulActions || 0,
        failedActions: executionContext?.failedActions || 0
      },
      pageStates: {
        currentPageDom: executionContext?.currentPageDom,
        currentPageUrl: executionContext?.currentPageUrl,
        previousPageState: executionContext?.previousPageState
      },
      sessionMetadata: {
        investigationContext: request.investigationContext
      }
    };

    return contextSection;
  }

  /**
   * Build instruction section
   */
  private buildInstructionSection(stepContent: string, promptOptions?: any): InstructionSection {
    return {
      currentStepInstruction: stepContent,
      actionGuidance: 'Use precise CSS selectors to identify and interact with elements. Ensure high confidence before taking action.',
      constraints: [
        'Ensure element is visible and interactable',
        'Wait for page load completion',
        'Use stable, unique selectors when possible'
      ],
      objectives: [
        'Complete the current step successfully',
        'Maintain workflow continuity',
        'Provide clear reasoning for decisions'
      ]
    };
  }

  /**
   * Build schema section
   */
  private buildSchemaSection(schema: ResponseSchema): SchemaSection {
    return {
      responseFormat: 'JSON with structured decision, reasoning, and commands',
      schemaDefinition: schema,
      validationRules: [
        'Response must conform to JSON schema exactly',
        'All required fields must be present',
        'Provide detailed reasoning for all decisions'
      ]
    };
  }

  /**
   * Build validation section
   */
  private buildValidationSection(request: ActionPromptRequest): ValidationSection {
    return {
      lastActionValidation: {
        expectedOutcome: 'Action should complete successfully',
        validationCriteria: ['Page state changes appropriately', 'No error messages appear'],
        successIndicators: ['Element interaction successful', 'Page loads correctly'],
        failureIndicators: ['Error messages displayed', 'Page fails to load', 'Element not found']
      }
    };
  }

  /**
   * Build reflection validation section
   */
  private buildReflectionValidationSection(request: ReflectionPromptRequest): ValidationSection {
    return {
      lastActionValidation: {
        expectedOutcome: request.expectedOutcome || 'Previous action should have completed successfully',
        validationCriteria: ['Compare current state with expected outcome'],
        successIndicators: ['Expected elements are present', 'Page state matches expectations'],
        failureIndicators: ['Expected elements missing', 'Error messages present']
      }
    };
  }

  /**
   * Build working memory section
   */
  private async buildWorkingMemorySection(sessionId: string): Promise<WorkingMemorySection> {
    if (!this.contextManager) {
      return {
        knownElements: [],
        extractedVariables: [],
        pageInsights: [],
        learningHistory: [],
        investigationPreferences: []
      };
    }

    try {
      const workingMemory = this.contextManager.getWorkingMemory(sessionId);
      
      return {
        knownElements: Array.from(workingMemory?.knownElements?.values() || []),
        extractedVariables: Array.from(workingMemory?.extractedVariables?.values() || []),
        pageInsights: workingMemory?.pageInsights || [],
        learningHistory: workingMemory?.learningHistory || [],
        investigationPreferences: workingMemory?.investigationPreferences?.preferredOrder || []
      };
    } catch (error) {
      return {
        knownElements: [],
        extractedVariables: [],
        pageInsights: [],
        learningHistory: [],
        investigationPreferences: []
      };
    }
  }

  /**
   * Build investigation section
   */
  private buildInvestigationSection(request: InvestigationPromptRequest): InvestigationSection {
    const phaseInstructions = this.getInvestigationPhaseInstructions(request.investigationPhase);
    
    return {
      investigationPhase: request.investigationPhase,
      availableTools: request.availableTools,
      investigationObjective: `Understand page structure and identify optimal selectors for: ${request.stepContent}`,
      phaseInstructions,
      confidenceRequirement: request.investigationOptions?.confidenceThreshold || this.config.investigationConfig.confidenceThreshold,
      investigationHistory: []
    };
  }

  /**
   * Get investigation prompt type
   */
  private getInvestigationPromptType(phase: InvestigationPhase): EnhancedPromptType {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return EnhancedPromptType.INVESTIGATION_INITIAL_ASSESSMENT;
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return EnhancedPromptType.INVESTIGATION_FOCUSED_EXPLORATION;
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return EnhancedPromptType.INVESTIGATION_SELECTOR_DETERMINATION;
      default:
        return EnhancedPromptType.INVESTIGATION_INITIAL_ASSESSMENT;
    }
  }

  /**
   * Get investigation phase instructions
   */
  private getInvestigationPhaseInstructions(phase: InvestigationPhase): string {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return 'Begin with screenshot analysis to understand page layout, then use text extraction and sub-DOM analysis to identify key elements.';
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return 'Focus on specific areas identified in initial assessment. Use targeted sub-DOM extraction to examine potential target elements.';
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return 'Validate selector candidates and make final determination on optimal selector strategy for action execution.';
      default:
        return 'Investigate the page to understand structure and identify target elements.';
    }
  }

  /**
   * Create fallback context
   */
  private createFallbackContext(sessionId: string, stepIndex: number): any {
    return {
      sessionId,
      stepIndex,
      steps: ['Fallback step'],
      executionHistory: [],
      pageState: { dom: '<html></html>' }
    };
  }

  /**
   * Create fallback schema
   */
  private createFallbackSchema(): ResponseSchema {
    return {
      type: 'object',
      properties: {
        decision: { type: 'object' },
        reasoning: { type: 'object' },
        commands: { type: 'array' }
      },
      required: ['decision', 'reasoning', 'commands']
    };
  }

  /**
   * Generate unique prompt ID
   */
  private generatePromptId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
