/**
 * Investigation Prompt Generator
 * 
 * Generates specialized prompts for page investigation phases
 * Handles Initial Assessment, Focused Exploration, and Selector Determination
 */

import {
  InvestigationPromptRequest,
  ActionWithInvestigationRequest,
  GeneratedPrompt,
  PromptType,
  InvestigationPhase,
  InvestigationTool,
  InvestigationSection,
  InvestigationToolDescription,
  InvestigationStrategyGuidance,
  PhaseGuidance,
  ContextManagementGuidance,
  InvestigationConfig,
  INVESTIGATION_PHASE_DESCRIPTIONS,
  PromptManagerError,
  PromptManagerErrorType
} from '../../../types/ai-prompt-manager';

import { PromptTemplateManager } from './template-manager';
import { PromptContentBuilder } from './content-builder';
import { ContextIntegrator } from './context-integrator';

export class InvestigationPromptGenerator {
  private config: InvestigationConfig;
  private templateManager: PromptTemplateManager;
  private contentBuilder: PromptContentBuilder;
  private contextIntegrator: ContextIntegrator;

  constructor(
    config: InvestigationConfig,
    templateManager?: PromptTemplateManager,
    contentBuilder?: PromptContentBuilder,
    contextIntegrator?: ContextIntegrator
  ) {
    this.config = config;
    this.templateManager = templateManager!; // Will be injected
    this.contentBuilder = contentBuilder!; // Will be injected
    this.contextIntegrator = contextIntegrator!; // Will be injected
  }

  /**
   * Generate investigation prompt for specific phase
   */
  async generateInvestigationPrompt(request: InvestigationPromptRequest): Promise<GeneratedPrompt> {
    try {
      if (!this.config.enableInvestigationPrompts) {
        throw new PromptManagerError(
          'Investigation prompts are disabled',
          PromptManagerErrorType.INVESTIGATION_PHASE_INVALID,
          request.sessionId,
          request.stepIndex
        );
      }

      // Validate investigation phase
      this.validateInvestigationPhase(request.investigationPhase);

      // Get appropriate template for investigation phase
      const template = this.getInvestigationTemplate(request.investigationPhase);

      // Build investigation-specific context
      const contextSection = await this.contextIntegrator.buildInvestigationContextSection(
        request.sessionId,
        request.stepIndex,
        request.investigationPhase
      );

      // Build investigation section
      const investigationSection = this.buildInvestigationSection(
        request.investigationPhase,
        request.availableTools,
        request.investigationOptions
      );

      // Build working memory section if enabled
      const workingMemorySection = this.config.workingMemoryIntegrationEnabled
        ? await this.contextIntegrator.buildWorkingMemorySection(request.sessionId)
        : undefined;

      // Build schema section for investigation
      const schemaSection = await this.contentBuilder.buildSchemaSection('comprehensive');
      
      // Enhance schema with investigation-specific fields
      this.enhanceSchemaForInvestigation(schemaSection, request.investigationPhase);

      // Build complete prompt content
      const content = await this.contentBuilder.buildPromptContent({
        template,
        contextSection,
        schemaSection,
        stepContent: request.stepContent,
        includeValidation: false,
        investigationSection,
        workingMemorySection,
        promptOptions: {
          useFilteredContext: true,
          includeWorkingMemory: this.config.workingMemoryIntegrationEnabled,
          includeInvestigationHistory: true,
          includeElementKnowledge: this.config.elementKnowledgeTrackingEnabled,
          contextManagementApproach: request.investigationOptions?.contextManagementApproach || 'standard'
        }
      });

      // Determine prompt type based on phase
      const promptType = this.getPromptTypeForPhase(request.investigationPhase);

      const prompt: GeneratedPrompt = {
        promptId: this.generatePromptId(),
        sessionId: request.sessionId,
        stepIndex: request.stepIndex,
        promptType,
        content,
        schema: schemaSection.responseSchema,
        generatedAt: new Date(),
        metadata: {
          investigationPhase: request.investigationPhase,
          availableTools: request.availableTools,
          investigationOptions: request.investigationOptions
        }
      };

      return prompt;
    } catch (error) {
      if (error instanceof PromptManagerError) {
        throw error;
      }
      throw new PromptManagerError(
        `Failed to generate investigation prompt: ${error.message}`,
        PromptManagerErrorType.INVESTIGATION_STRATEGY_GENERATION_FAILED,
        request.sessionId,
        request.stepIndex
      );
    }
  }

  /**
   * Generate action prompt with investigation context
   */
  async generateActionWithInvestigationPrompt(request: ActionWithInvestigationRequest): Promise<GeneratedPrompt> {
    try {
      const template = this.templateManager.getTemplate('action_with_investigation');

      // Build context section with investigation insights
      const contextSection = await this.contextIntegrator.buildContextSectionWithInvestigation(
        request.sessionId,
        request.stepIndex,
        request.investigationContext
      );

      // Build investigation summary section
      const investigationSummarySection = this.buildInvestigationSummarySection(
        request.investigationContext
      );

      // Build working memory section with investigation updates
      const workingMemorySection = this.buildWorkingMemoryWithInvestigation(
        request.investigationContext.workingMemoryState
      );

      // Build schema section
      const schemaSection = await this.contentBuilder.buildSchemaSection('detailed');

      // Build complete prompt content
      const content = await this.contentBuilder.buildPromptContent({
        template,
        contextSection,
        schemaSection,
        stepContent: request.stepContent,
        includeValidation: false,
        workingMemorySection,
        promptOptions: {
          useFilteredContext: true,
          includeWorkingMemory: true,
          includeElementKnowledge: true,
          contextManagementApproach: 'comprehensive'
        }
      });

      // Add investigation summary to system message
      content.systemMessage += `\n\n## Investigation Results Summary\n${this.formatInvestigationSummary(request.investigationContext)}`;

      const prompt: GeneratedPrompt = {
        promptId: this.generatePromptId(),
        sessionId: request.sessionId,
        stepIndex: request.stepIndex,
        promptType: PromptType.ACTION_WITH_INVESTIGATION_CONTEXT,
        content,
        schema: schemaSection.responseSchema,
        generatedAt: new Date(),
        metadata: {
          investigationContext: request.investigationContext,
          recommendedAction: request.investigationContext.recommendedAction
        }
      };

      return prompt;
    } catch (error) {
      if (error instanceof PromptManagerError) {
        throw error;
      }
      throw new PromptManagerError(
        `Failed to generate action with investigation prompt: ${error.message}`,
        PromptManagerErrorType.INVESTIGATION_CONTEXT_UNAVAILABLE,
        request.sessionId,
        request.stepIndex
      );
    }
  }

  /**
   * Build investigation section
   */
  private buildInvestigationSection(
    phase: InvestigationPhase,
    availableTools: InvestigationTool[],
    options?: any
  ): InvestigationSection {
    const phaseDescription = INVESTIGATION_PHASE_DESCRIPTIONS[phase];
    
    return {
      investigationPhase: phase,
      availableTools: this.buildToolDescriptions(availableTools),
      investigationStrategy: this.buildInvestigationStrategy(phase, options),
      phaseSpecificGuidance: this.buildPhaseGuidance(phase),
      contextManagementGuidance: this.buildContextManagementGuidance(options)
    };
  }

  /**
   * Build tool descriptions
   */
  private buildToolDescriptions(availableTools: InvestigationTool[]): InvestigationToolDescription[] {
    const toolDescriptions: Record<InvestigationTool, InvestigationToolDescription> = {
      [InvestigationTool.SCREENSHOT_ANALYSIS]: {
        tool: InvestigationTool.SCREENSHOT_ANALYSIS,
        description: 'Captures and analyzes visual screenshot of current page',
        useCase: 'Initial page understanding, layout analysis, visual element identification',
        expectedOutput: 'Detailed text description of page visual content and structure',
        limitationsAndConsiderations: [
          'May not capture dynamic content',
          'Text in images may not be readable',
          'Relies on visual appearance only'
        ],
        parameters: [
          {
            name: 'includeTextDescription',
            type: 'boolean',
            required: false,
            description: 'Include detailed text description of visual elements'
          }
        ]
      },
      [InvestigationTool.TEXT_EXTRACTION]: {
        tool: InvestigationTool.TEXT_EXTRACTION,
        description: 'Extracts text content from specific elements using selectors',
        useCase: 'Targeted content retrieval, element validation, specific text analysis',
        expectedOutput: 'Text content from specified elements',
        limitationsAndConsiderations: [
          'Requires knowing approximate selectors',
          'May not capture all relevant content',
          'Limited to visible text content'
        ],
        parameters: [
          {
            name: 'selector',
            type: 'string',
            required: true,
            description: 'CSS selector for target elements'
          },
          {
            name: 'multiple',
            type: 'boolean',
            required: false,
            description: 'Extract from all matching elements'
          }
        ]
      },
      [InvestigationTool.FULL_DOM_RETRIEVAL]: {
        tool: InvestigationTool.FULL_DOM_RETRIEVAL,
        description: 'Retrieves complete DOM structure of the page',
        useCase: 'Comprehensive page analysis, complex element relationships, fallback option',
        expectedOutput: 'Complete HTML DOM structure',
        limitationsAndConsiderations: [
          'May exceed context limits on large pages',
          'Can be overwhelming with too much information',
          'May include irrelevant content'
        ],
        parameters: [
          {
            name: 'maxDomSize',
            type: 'number',
            required: false,
            description: 'Maximum DOM size in characters'
          }
        ]
      },
      [InvestigationTool.SUB_DOM_EXTRACTION]: {
        tool: InvestigationTool.SUB_DOM_EXTRACTION,
        description: 'Extracts DOM subtree from specific page sections',
        useCase: 'Focused DOM analysis, specific section understanding, balanced detail',
        expectedOutput: 'HTML structure of specified page sections',
        limitationsAndConsiderations: [
          'Requires identifying relevant sections',
          'May miss content outside selected areas',
          'Selector accuracy is crucial'
        ],
        parameters: [
          {
            name: 'selector',
            type: 'string',
            required: true,
            description: 'CSS selector for container element'
          },
          {
            name: 'maxDomSize',
            type: 'number',
            required: false,
            description: 'Maximum DOM size in characters'
          }
        ]
      }
    };

    return availableTools.map(tool => toolDescriptions[tool]);
  }

  /**
   * Build investigation strategy
   */
  private buildInvestigationStrategy(phase: InvestigationPhase, options?: any): InvestigationStrategyGuidance {
    const phaseDescription = INVESTIGATION_PHASE_DESCRIPTIONS[phase];
    const toolPriority = this.getToolPriorityForPhase(phase);

    return {
      currentPhaseObjective: phaseDescription.description,
      investigationPriority: {
        primary: toolPriority[0],
        fallbacks: toolPriority.slice(1),
        reasoning: `${phaseDescription.name} phase prioritizes ${toolPriority[0].toLowerCase()} for ${phaseDescription.description.toLowerCase()}`
      },
      suggestedApproach: this.getSuggestedApproachForPhase(phase),
      successCriteria: this.getSuccessCriteriaForPhase(phase),
      nextPhaseConditions: this.getNextPhaseConditions(phase)
    };
  }

  /**
   * Build phase-specific guidance
   */
  private buildPhaseGuidance(phase: InvestigationPhase): PhaseGuidance {
    const phaseDescription = INVESTIGATION_PHASE_DESCRIPTIONS[phase];

    return {
      phaseDescription: phaseDescription.description,
      keyObjectives: phaseDescription.objectives,
      recommendedTools: phaseDescription.preferredTools,
      investigationQuestions: this.getInvestigationQuestions(phase),
      outputExpectations: this.getOutputExpectations(phase),
      commonPitfalls: this.getCommonPitfalls(phase)
    };
  }

  /**
   * Build context management guidance
   */
  private buildContextManagementGuidance(options?: any): ContextManagementGuidance {
    return {
      contextOverflowPrevention: [
        'Focus investigation on most relevant page areas',
        'Use filtered context to manage information flow',
        'Summarize findings concisely',
        'Prioritize actionable insights over comprehensive coverage'
      ],
      contentFilteringStrategy: 'Progressive context building with filtered summaries',
      summaryGuidelines: [
        'Highlight key findings and actionable insights',
        'Include confidence levels for discoveries',
        'Note any uncertainty or areas needing further investigation',
        'Organize findings by relevance to the current step'
      ],
      elementKnowledgeTracking: [
        'Record reliable selectors for discovered elements',
        'Note element interaction patterns',
        'Track element reliability and alternative selectors',
        'Update working memory with validated discoveries'
      ],
      workingMemoryUpdates: [
        'Add newly discovered elements to working memory',
        'Update page insights based on investigation',
        'Record successful investigation patterns',
        'Note any failed approaches for future reference'
      ]
    };
  }

  /**
   * Validate investigation phase
   */
  private validateInvestigationPhase(phase: InvestigationPhase): void {
    if (!Object.values(InvestigationPhase).includes(phase)) {
      throw new PromptManagerError(
        `Invalid investigation phase: ${phase}`,
        PromptManagerErrorType.INVESTIGATION_PHASE_INVALID
      );
    }
  }

  /**
   * Get investigation template for phase
   */
  private getInvestigationTemplate(phase: InvestigationPhase) {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return this.templateManager.getTemplate('investigation_initial');
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return this.templateManager.getTemplate('investigation_focused');
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return this.templateManager.getTemplate('investigation_selector');
      default:
        throw new PromptManagerError(
          `No template found for investigation phase: ${phase}`,
          PromptManagerErrorType.TEMPLATE_NOT_FOUND
        );
    }
  }

  /**
   * Get prompt type for investigation phase
   */
  private getPromptTypeForPhase(phase: InvestigationPhase): PromptType {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return PromptType.INVESTIGATION_INITIAL_ASSESSMENT;
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return PromptType.INVESTIGATION_FOCUSED_EXPLORATION;
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return PromptType.INVESTIGATION_SELECTOR_DETERMINATION;
      default:
        throw new PromptManagerError(
          `No prompt type found for investigation phase: ${phase}`,
          PromptManagerErrorType.INVESTIGATION_PHASE_INVALID
        );
    }
  }

  /**
   * Get tool priority for investigation phase
   */
  private getToolPriorityForPhase(phase: InvestigationPhase): InvestigationTool[] {
    const phaseDescription = INVESTIGATION_PHASE_DESCRIPTIONS[phase];
    return [...phaseDescription.preferredTools, ...this.config.toolPriorityOrder];
  }

  /**
   * Get suggested approach for phase
   */
  private getSuggestedApproachForPhase(phase: InvestigationPhase): string[] {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return [
          'Start with screenshot analysis for visual understanding',
          'Identify main page sections and layout structure',
          'Note interactive elements and their general locations',
          'Plan focused exploration based on step requirements'
        ];
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return [
          'Use text extraction to verify specific element content',
          'Extract DOM subsections for detailed analysis',
          'Build understanding of element relationships',
          'Validate element accessibility and interaction patterns'
        ];
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return [
          'Synthesize all investigation findings',
          'Identify most reliable element selectors',
          'Validate selector uniqueness and stability',
          'Choose optimal interaction approach for the step'
        ];
      default:
        return ['Follow standard investigation procedures'];
    }
  }

  /**
   * Get success criteria for phase
   */
  private getSuccessCriteriaForPhase(phase: InvestigationPhase): string[] {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return [
          'Clear understanding of page layout and structure',
          'Identification of relevant interactive elements',
          'Initial strategy for completing the step',
          'Confidence in proceeding to focused exploration'
        ];
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return [
          'Detailed knowledge of target elements and their properties',
          'Understanding of element interaction patterns',
          'Validation of element accessibility',
          'Sufficient information for selector determination'
        ];
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return [
          'Reliable selectors identified for target elements',
          'Clear action plan for step completion',
          'High confidence in selector stability',
          'Fallback options identified if needed'
        ];
      default:
        return ['Investigation objectives met'];
    }
  }

  /**
   * Get next phase conditions
   */
  private getNextPhaseConditions(phase: InvestigationPhase): string[] {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return [
          'Page structure is understood at high level',
          'Target areas for detailed investigation identified',
          'Investigation strategy is clear'
        ];
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return [
          'Target elements are well understood',
          'Element properties and accessibility confirmed',
          'Ready for selector determination'
        ];
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return [
          'Reliable selectors are identified',
          'Action approach is determined',
          'Ready to proceed with action execution'
        ];
      default:
        return ['Phase objectives completed'];
    }
  }

  /**
   * Additional helper methods for investigation guidance
   */
  private getInvestigationQuestions(phase: InvestigationPhase): string[] {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return [
          'What is the overall page layout and structure?',
          'Where are the main interactive elements located?',
          'What sections are most relevant to the current step?',
          'Are there any dynamic or complex elements to consider?'
        ];
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return [
          'What are the exact properties of target elements?',
          'How can these elements be reliably identified?',
          'Are there any accessibility or interaction constraints?',
          'What are the relationships between relevant elements?'
        ];
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return [
          'Which selectors are most reliable and specific?',
          'Are there alternative approaches if primary selectors fail?',
          'What is the optimal sequence of interactions?',
          'How can success be validated after action?'
        ];
      default:
        return [];
    }
  }

  private getOutputExpectations(phase: InvestigationPhase): string[] {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return [
          'High-level page description and layout analysis',
          'Identification of key sections and elements',
          'Initial element discovery with basic selectors',
          'Investigation strategy for next phase'
        ];
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return [
          'Detailed element analysis and properties',
          'Refined selectors with validation',
          'Element accessibility and interaction notes',
          'Updated working memory with discoveries'
        ];
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return [
          'Final selector recommendations with confidence levels',
          'Complete action plan for step execution',
          'Fallback strategies and error handling',
          'Working memory updates with reliable patterns'
        ];
      default:
        return [];
    }
  }

  private getCommonPitfalls(phase: InvestigationPhase): string[] {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return [
          'Spending too much time on detailed analysis',
          'Missing dynamic content that loads after page load',
          'Focusing on irrelevant page sections',
          'Not considering mobile/responsive layouts'
        ];
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return [
          'Using overly specific selectors that may break',
          'Not validating element accessibility',
          'Missing alternative elements or approaches',
          'Exceeding context limits with too much detail'
        ];
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return [
          'Choosing unreliable or fragile selectors',
          'Not testing selector uniqueness',
          'Overlooking timing and dynamic content issues',
          'Not providing adequate fallback options'
        ];
      default:
        return [];
    }
  }

  /**
   * Build investigation summary section
   */
  private buildInvestigationSummarySection(investigationContext: any): any {
    return {
      investigationsPerformed: investigationContext.investigationsPerformed.length,
      elementsDiscovered: investigationContext.elementsDiscovered.length,
      confidence: investigationContext.workingMemoryState.overallConfidence,
      readyForAction: true
    };
  }

  /**
   * Build working memory with investigation updates
   */
  private buildWorkingMemoryWithInvestigation(workingMemoryState: any): any {
    return {
      ...workingMemoryState,
      lastInvestigationUpdate: new Date(),
      investigationEnhanced: true
    };
  }

  /**
   * Format investigation summary
   */
  private formatInvestigationSummary(investigationContext: any): string {
    let summary = 'Based on page investigation:\n\n';
    
    summary += `- Performed ${investigationContext.investigationsPerformed.length} investigations\n`;
    summary += `- Discovered ${investigationContext.elementsDiscovered.length} elements\n`;
    summary += `- Overall confidence: ${(investigationContext.workingMemoryState.overallConfidence * 100).toFixed(0)}%\n`;
    summary += `- Recommended action: ${investigationContext.recommendedAction.recommendedAction}\n\n`;

    summary += 'Key findings:\n';
    for (const finding of investigationContext.recommendedAction.reasoning.slice(0, 3)) {
      summary += `- ${finding}\n`;
    }

    return summary;
  }

  /**
   * Enhance schema for investigation
   */
  private enhanceSchemaForInvestigation(schemaSection: any, phase: InvestigationPhase): void {
    // Add investigation-specific fields to the schema
    const investigationFields = {
      investigationResults: {
        type: 'object',
        description: 'Results of investigation phase',
        properties: {
          toolUsed: { type: 'string', description: 'Investigation tool used' },
          findings: { type: 'array', description: 'Key findings from investigation' },
          confidence: { type: 'number', description: 'Confidence in findings' },
          nextRecommendation: { type: 'string', description: 'Recommendation for next step' }
        }
      }
    };

    schemaSection.responseSchema.properties.investigationResults = investigationFields.investigationResults;
    schemaSection.responseSchema.required.push('investigationResults');
  }

  /**
   * Generate unique prompt ID
   */
  private generatePromptId(): string {
    return `investigation_prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(config: InvestigationConfig): void {
    this.config = config;
  }

  /**
   * Set dependencies (for dependency injection)
   */
  setDependencies(
    templateManager: PromptTemplateManager,
    contentBuilder: PromptContentBuilder,
    contextIntegrator: ContextIntegrator
  ): void {
    this.templateManager = templateManager;
    this.contentBuilder = contentBuilder;
    this.contextIntegrator = contextIntegrator;
  }
}
