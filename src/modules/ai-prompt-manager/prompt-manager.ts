/**
 * AI Prompt Manager Implementation
 * 
 * Main implementation of the AIPromptManager interface
 * Orchestrates prompt generation for different scenarios
 */

import {
  AIPromptManager,
  ActionPromptRequest,
  ReflectionPromptRequest,
  InvestigationPromptRequest,
  ActionWithInvestigationRequest,
  GeneratedPrompt,
  PromptTemplateCollection,
  PromptTemplate,
  PromptValidationResult,
  AIPromptManagerConfig,
  PromptType,
  InvestigationPhase,
  PromptManagerError,
  PromptManagerErrorType
} from '../../../types/ai-prompt-manager';

import { PromptTemplateManager } from './template-manager';
import { PromptValidator } from './prompt-validator';
import { PromptContentBuilder } from './content-builder';
import { InvestigationPromptGenerator } from './investigation-generator';
import { ContextIntegrator } from './context-integrator';
import { ConfigurationManager } from './configuration-manager';

export class AIPromptManagerImpl implements AIPromptManager {
  private templateManager: PromptTemplateManager;
  private validator: PromptValidator;
  private contentBuilder: PromptContentBuilder;
  private investigationGenerator: InvestigationPromptGenerator;
  private contextIntegrator: ContextIntegrator;
  private config: AIPromptManagerConfig;

  constructor(
    config: AIPromptManagerConfig,
    templateManager?: PromptTemplateManager,
    validator?: PromptValidator,
    contentBuilder?: PromptContentBuilder,
    investigationGenerator?: InvestigationPromptGenerator,
    contextIntegrator?: ContextIntegrator
  ) {
    this.config = config;
    this.templateManager = templateManager || new PromptTemplateManager(config.templateConfig);
    this.validator = validator || new PromptValidator(config.validationConfig);
    this.contentBuilder = contentBuilder || new PromptContentBuilder(config.contextConfig);
    this.investigationGenerator = investigationGenerator || new InvestigationPromptGenerator(config.investigationConfig);
    this.contextIntegrator = contextIntegrator || new ContextIntegrator(config.contextConfig);
  }

  /**
   * Generate action prompt for initial step or continuation
   */
  async generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt> {
    try {
      const promptType = request.currentStepIndex === 0 
        ? PromptType.INITIAL_ACTION 
        : PromptType.ACTION_WITH_VALIDATION;

      // Get appropriate template
      const template = promptType === PromptType.INITIAL_ACTION
        ? this.templateManager.getTemplate('initial_action')
        : this.templateManager.getTemplate('action_with_validation');

      // Build context sections
      const contextSection = await this.contextIntegrator.buildContextSection(
        request.sessionId,
        request.currentStepIndex,
        request.promptOptions
      );

      // Generate schema section
      const schemaSection = await this.contentBuilder.buildSchemaSection(
        request.promptOptions?.reasoningDepth || 'detailed'
      );

      // Build complete prompt content
      const content = await this.contentBuilder.buildPromptContent({
        template,
        contextSection,
        schemaSection,
        stepContent: request.currentStepContent,
        includeValidation: request.includeValidation,
        promptOptions: request.promptOptions
      });

      // Create generated prompt
      const prompt: GeneratedPrompt = {
        promptId: this.generatePromptId(),
        sessionId: request.sessionId,
        stepIndex: request.currentStepIndex,
        promptType,
        content,
        schema: schemaSection.responseSchema,
        generatedAt: new Date(),
        metadata: {
          includeValidation: request.includeValidation,
          promptOptions: request.promptOptions
        }
      };

      // Validate prompt structure
      const validation = this.validator.validatePromptStructure(prompt);
      if (!validation.isValid) {
        throw new PromptManagerError(
          `Prompt validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          PromptManagerErrorType.VALIDATION_FAILED,
          request.sessionId,
          request.currentStepIndex
        );
      }

      return prompt;
    } catch (error) {
      if (error instanceof PromptManagerError) {
        throw error;
      }
      throw new PromptManagerError(
        `Failed to generate action prompt: ${error.message}`,
        PromptManagerErrorType.TEMPLATE_RENDERING_FAILED,
        request.sessionId,
        request.currentStepIndex
      );
    }
  }

  /**
   * Generate reflection prompt for ACT-REFLECT cycle
   */
  async generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt> {
    try {
      const template = this.templateManager.getTemplate('reflection_action');

      // Build context sections with execution history
      const contextSection = await this.contextIntegrator.buildContextSection(
        request.sessionId,
        request.nextStepIndex,
        request.promptOptions,
        { includeExecutionHistory: true, includeValidation: true }
      );

      // Build validation section for completed step
      const validationSection = await this.contentBuilder.buildValidationSection(
        request.sessionId,
        request.completedStepIndex,
        request.expectedOutcome
      );

      // Generate schema section
      const schemaSection = await this.contentBuilder.buildSchemaSection(
        request.promptOptions?.reasoningDepth || 'comprehensive'
      );

      // Build complete prompt content
      const content = await this.contentBuilder.buildPromptContent({
        template,
        contextSection,
        schemaSection,
        validationSection,
        stepContent: request.nextStepContent,
        includeValidation: true,
        promptOptions: request.promptOptions
      });

      const prompt: GeneratedPrompt = {
        promptId: this.generatePromptId(),
        sessionId: request.sessionId,
        stepIndex: request.nextStepIndex,
        promptType: PromptType.REFLECTION_AND_ACTION,
        content,
        schema: schemaSection.responseSchema,
        generatedAt: new Date(),
        metadata: {
          completedStepIndex: request.completedStepIndex,
          expectedOutcome: request.expectedOutcome,
          promptOptions: request.promptOptions
        }
      };

      // Validate prompt structure
      const validation = this.validator.validatePromptStructure(prompt);
      if (!validation.isValid) {
        throw new PromptManagerError(
          `Reflection prompt validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          PromptManagerErrorType.VALIDATION_FAILED,
          request.sessionId,
          request.nextStepIndex
        );
      }

      return prompt;
    } catch (error) {
      if (error instanceof PromptManagerError) {
        throw error;
      }
      throw new PromptManagerError(
        `Failed to generate reflection prompt: ${error.message}`,
        PromptManagerErrorType.TEMPLATE_RENDERING_FAILED,
        request.sessionId,
        request.nextStepIndex
      );
    }
  }

  /**
   * Generate investigation prompt for page exploration
   */
  async generateInvestigationPrompt(request: InvestigationPromptRequest): Promise<GeneratedPrompt> {
    try {
      return await this.investigationGenerator.generateInvestigationPrompt(request);
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
      return await this.investigationGenerator.generateActionWithInvestigationPrompt(request);
    } catch (error) {
      if (error instanceof PromptManagerError) {
        throw error;
      }
      throw new PromptManagerError(
        `Failed to generate action prompt with investigation context: ${error.message}`,
        PromptManagerErrorType.INVESTIGATION_CONTEXT_UNAVAILABLE,
        request.sessionId,
        request.stepIndex
      );
    }
  }

  /**
   * Get all available prompt templates
   */
  getPromptTemplates(): PromptTemplateCollection {
    return this.templateManager.getAllTemplates();
  }

  /**
   * Update a specific prompt template
   */
  updatePromptTemplate(templateId: string, template: PromptTemplate): void {
    this.templateManager.updateTemplate(templateId, template);
  }

  /**
   * Validate prompt structure and quality
   */
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult {
    return this.validator.validatePromptStructure(prompt);
  }

  /**
   * Generate unique prompt ID
   */
  private generatePromptId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current configuration
   */
  getConfig(): AIPromptManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIPromptManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update sub-components if their configs changed
    if (config.templateConfig) {
      this.templateManager.updateConfig(config.templateConfig);
    }
    if (config.validationConfig) {
      this.validator.updateConfig(config.validationConfig);
    }
    if (config.contextConfig) {
      this.contentBuilder.updateConfig(config.contextConfig);
      this.contextIntegrator.updateConfig(config.contextConfig);
    }
    if (config.investigationConfig) {
      this.investigationGenerator.updateConfig(config.investigationConfig);
    }
  }
}

