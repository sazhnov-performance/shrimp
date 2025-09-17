/**
 * Prompt Content Builder
 * 
 * Builds different sections of prompt content
 * Handles content assembly, formatting, and integration
 */

import {
  PromptContent,
  PromptTemplate,
  ContextSection,
  InstructionSection,
  ValidationSection,
  SchemaSection,
  ExamplesSection,
  ResponseSchema,
  ContextConfig,
  PromptOptions,
  PromptManagerError,
  PromptManagerErrorType
} from '../../../types/ai-prompt-manager';

export interface ContentBuildRequest {
  template: PromptTemplate;
  contextSection: ContextSection;
  schemaSection: SchemaSection;
  stepContent: string;
  includeValidation: boolean;
  promptOptions?: PromptOptions;
  validationSection?: ValidationSection;
  investigationSection?: any;
  workingMemorySection?: any;
}

export class PromptContentBuilder {
  private config: ContextConfig;

  constructor(config: ContextConfig) {
    this.config = config;
  }

  /**
   * Build complete prompt content
   */
  async buildPromptContent(request: ContentBuildRequest): Promise<PromptContent> {
    try {
      // Build instruction section
      const instructionSection = this.buildInstructionSection(
        request.stepContent,
        request.promptOptions
      );

      // Build examples section if requested
      const examplesSection = request.promptOptions?.includeExamples
        ? this.buildExamplesSection(request.promptOptions)
        : undefined;

      // Assemble complete content
      const content: PromptContent = {
        systemMessage: this.renderTemplate(request.template.template, {
          systemMessage: this.buildSystemMessage(),
          stepContent: request.stepContent,
          contextSection: this.formatContextSection(request.contextSection),
          instructionSection: this.formatInstructionSection(instructionSection),
          schemaSection: this.formatSchemaSection(request.schemaSection),
          validationSection: request.validationSection ? this.formatValidationSection(request.validationSection) : '',
          investigationSection: request.investigationSection ? this.formatInvestigationSection(request.investigationSection) : '',
          workingMemorySection: request.workingMemorySection ? this.formatWorkingMemorySection(request.workingMemorySection) : '',
          investigationToolsSection: request.investigationSection ? this.formatInvestigationToolsSection(request.investigationSection) : ''
        }),
        contextSection: request.contextSection,
        instructionSection,
        validationSection: request.validationSection,
        investigationSection: request.investigationSection,
        workingMemorySection: request.workingMemorySection,
        schemaSection: request.schemaSection,
        examplesSection
      };

      return content;
    } catch (error) {
      throw new PromptManagerError(
        `Failed to build prompt content: ${error.message}`,
        PromptManagerErrorType.TEMPLATE_RENDERING_FAILED
      );
    }
  }

  /**
   * Build instruction section
   */
  buildInstructionSection(
    stepContent: string,
    options?: PromptOptions
  ): InstructionSection {
    const mainInstruction = this.generateMainInstruction(stepContent, options);
    const stepSpecificGuidance = this.generateStepGuidance(stepContent, options);
    const decisionFramework = this.generateDecisionFramework(options);
    const actionGuidelines = this.generateActionGuidelines(options);
    const contextUsageInstructions = this.generateContextUsageInstructions(options);

    const instructionSection: InstructionSection = {
      mainInstruction,
      stepSpecificGuidance,
      decisionFramework,
      actionGuidelines,
      contextUsageInstructions
    };

    // Add optional sections based on options
    if (options?.validationMode) {
      instructionSection.validationRequirements = this.generateValidationRequirements(options.validationMode);
    }

    if (options?.useFilteredContext || options?.includeInvestigationHistory) {
      instructionSection.investigationGuidance = this.generateInvestigationGuidance(options);
    }

    return instructionSection;
  }

  /**
   * Build validation section
   */
  async buildValidationSection(
    sessionId: string,
    completedStepIndex: number,
    expectedOutcome?: string
  ): Promise<ValidationSection> {
    // This would typically integrate with Context Manager to get actual validation data
    // For now, we'll create a structured validation section
    
    return {
      lastActionValidation: {
        expectedOutcome: expectedOutcome || 'Action completion as specified',
        actualState: 'To be determined from current page state',
        validationCriteria: [
          {
            criterion: 'Action Success',
            evaluationMethod: 'Compare expected vs actual page state',
            weight: 0.5,
            description: 'Verify the action achieved its intended result'
          },
          {
            criterion: 'Element Interaction',
            evaluationMethod: 'Check element state changes',
            weight: 0.3,
            description: 'Confirm elements were properly interacted with'
          },
          {
            criterion: 'Page Navigation',
            evaluationMethod: 'Verify URL and page content',
            weight: 0.2,
            description: 'Ensure navigation occurred as expected'
          }
        ],
        successIndicators: [
          'Expected elements are present and accessible',
          'Page state matches expected outcome',
          'No error messages or unexpected behaviors'
        ],
        failureIndicators: [
          'Elements not found or not interactable',
          'Error messages displayed',
          'Unexpected page state or navigation'
        ]
      },
      resultAnalysis: {
        analysisInstructions: 'Compare the current page state with the expected outcome of the previous action',
        comparisonPoints: [
          'Element presence and state',
          'Page content changes',
          'URL changes',
          'Form field values',
          'Error messages or notifications'
        ],
        domAnalysisGuidance: 'Focus on elements relevant to the completed action',
        errorDetectionGuidance: 'Look for error messages, failed validations, or unexpected behaviors'
      },
      decisionFramework: {
        decisionOptions: [
          {
            action: 'PROCEED',
            description: 'Continue to next step',
            conditions: ['Action was successful', 'Page state is as expected'],
            consequences: ['Move to next automation step', 'Build on successful action']
          },
          {
            action: 'RETRY',
            description: 'Retry the same action',
            conditions: ['Action failed but is retryable', 'Temporary issue detected'],
            consequences: ['Attempt same action again', 'May need different approach']
          },
          {
            action: 'INVESTIGATE',
            description: 'Investigate page to understand current state',
            conditions: ['Uncertain about page state', 'Need more information'],
            consequences: ['Enter investigation phase', 'Gather more context before deciding']
          },
          {
            action: 'ABORT',
            description: 'Stop automation',
            conditions: ['Unrecoverable error', 'Unexpected page state'],
            consequences: ['End automation session', 'Report failure reason']
          }
        ],
        decisionCriteria: [
          'Success of previous action',
          'Current page state',
          'Availability of next steps',
          'Error conditions'
        ],
        proceedConditions: [
          'Previous action completed successfully',
          'Page state matches expectations',
          'Next step is clearly actionable'
        ],
        retryConditions: [
          'Action failed due to temporary issue',
          'Element interaction was incomplete',
          'Network or timing issue suspected'
        ],
        abortConditions: [
          'Unrecoverable error occurred',
          'Page structure is incompatible',
          'Security or access restrictions'
        ]
      }
    };
  }

  /**
   * Build schema section
   */
  async buildSchemaSection(reasoningDepth: string = 'detailed'): Promise<SchemaSection> {
    // This would typically integrate with Schema Manager
    // For now, we'll create a standard schema section
    
    const baseSchema: ResponseSchema = {
      version: '1.0',
      type: 'object',
      properties: {
        decision: {
          type: 'object',
          description: 'Decision about next action',
          properties: {
            action: {
              type: 'string',
              description: 'Action to take',
              enum: ['PROCEED', 'RETRY', 'ABORT', 'INVESTIGATE']
            },
            message: {
              type: 'string',
              description: 'Brief explanation of decision'
            },
            resultValidation: {
              type: 'object',
              description: 'Validation of previous action results',
              properties: {
                success: { type: 'boolean', description: 'Whether previous action was successful' },
                expectedElements: { type: 'array', description: 'List of expected elements' },
                actualState: { type: 'string', description: 'Description of actual page state' },
                issues: { type: 'array', description: 'Any issues found' }
              }
            }
          },
          required: ['action', 'message']
        },
        reasoning: {
          type: 'object',
          description: 'Detailed reasoning for the decision',
          properties: {
            analysis: { type: 'string', description: 'Analysis of current situation' },
            rationale: { type: 'string', description: 'Reasoning for chosen approach' },
            expectedOutcome: { type: 'string', description: 'What you expect to achieve' },
            confidence: { type: 'number', description: 'Confidence level (0-1)' },
            alternatives: { type: 'string', description: 'Alternative approaches considered' }
          },
          required: ['analysis', 'rationale', 'expectedOutcome', 'confidence']
        },
        commands: {
          type: 'array',
          description: 'Commands to execute',
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['CLICK_ELEMENT', 'INPUT_TEXT', 'OPEN_PAGE', 'SAVE_VARIABLE', 'GET_DOM', 'GET_CONTENT', 'GET_SUBDOM']
              },
              parameters: { type: 'object', description: 'Command parameters' },
              reasoning: { type: 'string', description: 'Why this command is needed' }
            },
            required: ['action', 'parameters']
          }
        }
      },
      required: ['decision', 'reasoning', 'commands'],
      additionalProperties: false,
      examples: [
        {
          decision: { action: 'PROCEED', message: 'Ready to click login button' },
          reasoning: {
            analysis: 'Login form is visible and fields are filled',
            rationale: 'All prerequisites met for login action',
            expectedOutcome: 'User will be logged in and redirected to dashboard',
            confidence: 0.95
          },
          commands: [
            {
              action: 'CLICK_ELEMENT',
              parameters: { selector: 'button[type="submit"]' },
              reasoning: 'Submit the login form'
            }
          ]
        }
      ]
    };

    return {
      responseFormat: 'JSON object with decision, reasoning, and commands',
      requiredFields: [
        { name: 'decision', type: 'object', description: 'Decision about next action', required: true },
        { name: 'reasoning', type: 'object', description: 'Detailed reasoning', required: true },
        { name: 'commands', type: 'array', description: 'Commands to execute', required: true }
      ],
      optionalFields: [
        { name: 'metadata', type: 'object', description: 'Additional metadata', required: false }
      ],
      examples: [
        {
          scenario: 'Successful form submission',
          exampleResponse: baseSchema.examples![0],
          explanation: 'Example of proceeding with form submission after validation'
        }
      ],
      validationRules: [
        { field: 'decision.action', rule: 'Must be one of: PROCEED, RETRY, ABORT, INVESTIGATE', description: 'Valid action values' },
        { field: 'reasoning.confidence', rule: 'Must be number between 0 and 1', description: 'Confidence range validation' },
        { field: 'commands', rule: 'Must be non-empty array when action is PROCEED', description: 'Commands required for PROCEED action' }
      ],
      responseSchema: baseSchema
    };
  }

  /**
   * Build examples section
   */
  buildExamplesSection(options?: PromptOptions): ExamplesSection {
    return {
      scenarioExamples: [
        {
          scenario: 'Login form interaction',
          context: 'User needs to log into a website',
          expectedApproach: 'Fill username and password fields, then click login button',
          reasoning: 'Standard login flow with form validation'
        },
        {
          scenario: 'Navigation menu interaction',
          context: 'User needs to navigate to a specific page section',
          expectedApproach: 'Locate navigation element and click appropriate menu item',
          reasoning: 'Direct navigation is most efficient when menu is visible'
        }
      ],
      responseExamples: [
        {
          situation: 'Ready to submit form',
          exampleResponse: {
            decision: { action: 'PROCEED', message: 'Form is complete and ready for submission' },
            reasoning: {
              analysis: 'All required fields are filled with valid data',
              rationale: 'Form validation passed and submit button is clickable',
              expectedOutcome: 'Form will be submitted successfully',
              confidence: 0.9
            },
            commands: [{ action: 'CLICK_ELEMENT', parameters: { selector: 'button[type="submit"]' } }]
          },
          explanation: 'Example of proceeding with confident form submission'
        }
      ],
      bestPractices: [
        'Always verify elements exist before interacting',
        'Use specific selectors for reliable element targeting',
        'Include reasoning for each command',
        'Validate results before proceeding to next step'
      ],
      commonMistakes: [
        'Using overly generic selectors that might match multiple elements',
        'Not waiting for dynamic content to load',
        'Proceeding without validating previous action results',
        'Using hardcoded values instead of extracted variables'
      ]
    };
  }

  /**
   * Generate main instruction
   */
  private generateMainInstruction(stepContent: string, options?: PromptOptions): string {
    const depth = options?.reasoningDepth || 'detailed';
    
    let instruction = `Complete this step: "${stepContent}"\n\n`;
    
    if (depth === 'comprehensive') {
      instruction += `Provide comprehensive analysis including:
- Detailed examination of current page state
- Multiple approach options with trade-offs
- Risk assessment and mitigation strategies
- Confidence levels for different aspects`;
    } else if (depth === 'detailed') {
      instruction += `Provide detailed analysis including:
- Current page state assessment
- Chosen approach and reasoning
- Expected outcomes and validation criteria`;
    } else {
      instruction += `Provide basic analysis including:
- Current situation assessment
- Chosen approach and key reasoning`;
    }

    return instruction;
  }

  /**
   * Generate step-specific guidance
   */
  private generateStepGuidance(stepContent: string, options?: PromptOptions): string[] {
    const guidance: string[] = [
      'Analyze the current page state carefully',
      'Identify the most reliable way to complete this step',
      'Consider element accessibility and interaction patterns'
    ];

    if (options?.useFilteredContext) {
      guidance.push('Leverage filtered context to understand page structure efficiently');
    }

    if (options?.includeElementKnowledge) {
      guidance.push('Use previously discovered element knowledge when available');
    }

    return guidance;
  }

  /**
   * Generate decision framework
   */
  private generateDecisionFramework(options?: PromptOptions): string[] {
    return [
      'Evaluate if current action is appropriate for the step',
      'Consider alternative approaches if primary approach seems problematic',
      'Assess confidence level and decide whether investigation is needed',
      'Determine if action can proceed or requires retry/abort'
    ];
  }

  /**
   * Generate action guidelines
   */
  private generateActionGuidelines(options?: PromptOptions): string[] {
    const guidelines = [
      'Use specific, reliable selectors for element targeting',
      'Include clear reasoning for each command',
      'Validate element accessibility before interaction',
      'Consider timing and dynamic content loading'
    ];

    if (options?.validationMode === 'strict') {
      guidelines.push('Apply strict validation criteria for all actions');
      guidelines.push('Require explicit confirmation of success before proceeding');
    }

    return guidelines;
  }

  /**
   * Generate context usage instructions
   */
  private generateContextUsageInstructions(options?: PromptOptions): string[] {
    const instructions = [
      'Review execution history to understand what has been accomplished',
      'Use page state information to understand current context',
      'Consider previously extracted variables and their values'
    ];

    if (options?.useFilteredContext) {
      instructions.push('Focus on filtered context for relevant information');
      instructions.push('Use page insights to understand page structure');
    }

    if (options?.includeWorkingMemory) {
      instructions.push('Leverage working memory for element knowledge and patterns');
    }

    return instructions;
  }

  /**
   * Generate validation requirements
   */
  private generateValidationRequirements(validationMode: string): string[] {
    if (validationMode === 'strict') {
      return [
        'Validate every action result before proceeding',
        'Require explicit confirmation of expected outcomes',
        'Check for error conditions and handle appropriately',
        'Verify element states match expectations'
      ];
    } else {
      return [
        'Perform basic validation of action results',
        'Check for obvious error conditions',
        'Verify critical elements are accessible'
      ];
    }
  }

  /**
   * Generate investigation guidance
   */
  private generateInvestigationGuidance(options?: PromptOptions): string[] {
    const guidance = [
      'Use investigation tools when page understanding is incomplete',
      'Progress through investigation phases systematically',
      'Build element knowledge for future reference'
    ];

    if (options?.includeInvestigationHistory) {
      guidance.push('Review previous investigation results for insights');
    }

    return guidance;
  }

  /**
   * Build system message
   */
  private buildSystemMessage(): string {
    return `You are an intelligent web automation agent capable of understanding web pages and performing actions to complete user-specified tasks.

Your capabilities include:
- Analyzing page content and structure
- Clicking elements, entering text, navigating pages
- Extracting and saving information
- Making intelligent decisions based on page state
- Conducting investigations to understand complex pages

You operate in an ACT-REFLECT cycle where you:
1. Analyze the current situation and context
2. Plan and execute appropriate actions
3. Reflect on results and decide next steps

Always be thorough, accurate, and explain your reasoning clearly.`;
  }

  /**
   * Render template with variables
   */
  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value || '');
    }

    return rendered;
  }

  /**
   * Format context section for display
   */
  private formatContextSection(contextSection: ContextSection): string {
    let formatted = '';
    
    formatted += `### Current Step: ${contextSection.currentStep.stepIndex + 1}`;
    if (contextSection.currentStep.totalSteps > 0) {
      formatted += ` of ${contextSection.currentStep.totalSteps}`;
    }
    formatted += `\n`;
    formatted += `Step Type: ${contextSection.currentStep.stepType}\n\n`;

    if (contextSection.executionHistory.previousSteps.length > 0) {
      formatted += `### Previous Steps:\n`;
      for (const step of contextSection.executionHistory.previousSteps.slice(-3)) {
        formatted += `- Step ${step.stepIndex}: ${step.stepName} (${step.status})\n`;
      }
      formatted += `\n`;
    }

    return formatted;
  }

  /**
   * Format instruction section for display
   */
  private formatInstructionSection(instructionSection: InstructionSection): string {
    let formatted = instructionSection.mainInstruction + '\n\n';
    
    if (instructionSection.stepSpecificGuidance.length > 0) {
      formatted += 'Guidelines:\n';
      for (const guidance of instructionSection.stepSpecificGuidance) {
        formatted += `- ${guidance}\n`;
      }
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Format schema section for display
   */
  private formatSchemaSection(schemaSection: SchemaSection): string {
    return `Respond with a JSON object following this structure:\n\n${JSON.stringify(schemaSection.responseSchema, null, 2)}`;
  }

  /**
   * Format validation section for display
   */
  private formatValidationSection(validationSection: ValidationSection): string {
    return `Previous Action Analysis:\n${validationSection.resultAnalysis.analysisInstructions}\n\n`;
  }

  /**
   * Format investigation section for display
   */
  private formatInvestigationSection(investigationSection: any): string {
    return `Investigation Phase: ${investigationSection.investigationPhase}\n\n`;
  }

  /**
   * Format working memory section for display
   */
  private formatWorkingMemorySection(workingMemorySection: any): string {
    return `Working Memory:\nKnown elements: ${workingMemorySection.knownElements?.length || 0}\n\n`;
  }

  /**
   * Format investigation tools section for display
   */
  private formatInvestigationToolsSection(investigationSection: any): string {
    return `Available investigation tools: Screenshot Analysis, Text Extraction, DOM Retrieval\n\n`;
  }

  /**
   * Update configuration
   */
  updateConfig(config: ContextConfig): void {
    this.config = config;
  }
}
