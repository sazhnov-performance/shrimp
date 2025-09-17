/**
 * Prompt Template Manager
 * 
 * Manages prompt templates for different scenarios and phases
 * Handles template storage, retrieval, validation, and caching
 */

import {
  PromptTemplateCollection,
  PromptTemplate,
  TemplateConfig,
  TemplateVariable,
  TEMPLATE_IDS,
  PromptManagerError,
  PromptManagerErrorType
} from '../../../types/ai-prompt-manager';

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private config: TemplateConfig;
  private templateCache: Map<string, { template: PromptTemplate; timestamp: number }> = new Map();

  constructor(config: TemplateConfig) {
    this.config = config;
    this.initializeDefaultTemplates();
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): PromptTemplate {
    // Check cache first if enabled
    if (this.config.templateCacheEnabled) {
      const cached = this.templateCache.get(templateId);
      if (cached && (Date.now() - cached.timestamp) < 15 * 60 * 1000) { // 15 min TTL
        return cached.template;
      }
    }

    const template = this.templates.get(templateId);
    if (!template) {
      if (this.config.fallbackToDefault) {
        return this.getDefaultTemplate(templateId);
      }
      throw new PromptManagerError(
        `Template not found: ${templateId}`,
        PromptManagerErrorType.TEMPLATE_NOT_FOUND
      );
    }

    // Cache the template if caching is enabled
    if (this.config.templateCacheEnabled) {
      this.templateCache.set(templateId, { template, timestamp: Date.now() });
    }

    return template;
  }

  /**
   * Update a template
   */
  updateTemplate(templateId: string, template: PromptTemplate): void {
    if (this.config.templateValidationEnabled) {
      this.validateTemplate(template);
    }

    this.templates.set(templateId, {
      ...template,
      lastModified: new Date()
    });

    // Clear cache for this template
    this.templateCache.delete(templateId);
  }

  /**
   * Get all templates as a collection
   */
  getAllTemplates(): PromptTemplateCollection {
    return {
      systemMessageTemplate: this.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE),
      actionPromptTemplate: this.getTemplate(TEMPLATE_IDS.INITIAL_ACTION),
      reflectionPromptTemplate: this.getTemplate(TEMPLATE_IDS.REFLECTION_ACTION),
      validationPromptTemplate: this.getTemplate(TEMPLATE_IDS.VALIDATION),
      contextTemplate: this.getTemplate(TEMPLATE_IDS.CONTEXT),
      schemaTemplate: this.getTemplate(TEMPLATE_IDS.SCHEMA),
      investigationInitialAssessmentTemplate: this.getTemplate(TEMPLATE_IDS.INVESTIGATION_INITIAL),
      investigationFocusedExplorationTemplate: this.getTemplate(TEMPLATE_IDS.INVESTIGATION_FOCUSED),
      investigationSelectorDeterminationTemplate: this.getTemplate(TEMPLATE_IDS.INVESTIGATION_SELECTOR),
      actionWithInvestigationTemplate: this.getTemplate(TEMPLATE_IDS.ACTION_WITH_INVESTIGATION),
      investigationToolsTemplate: this.getTemplate('investigation_tools'),
      workingMemoryTemplate: this.getTemplate(TEMPLATE_IDS.WORKING_MEMORY),
      contextFilteringTemplate: this.getTemplate(TEMPLATE_IDS.CONTEXT_FILTERING)
    };
  }

  /**
   * Validate template structure
   */
  validateTemplate(template: PromptTemplate): void {
    if (!template.templateId || !template.name || !template.template) {
      throw new PromptManagerError(
        'Template missing required fields: templateId, name, or template content',
        PromptManagerErrorType.VALIDATION_FAILED
      );
    }

    // Validate template variables
    for (const variable of template.variables) {
      this.validateTemplateVariable(variable);
    }

    // Check for unmatched template variables in content
    const variableNames = template.variables.map(v => v.name);
    const templateVariables = this.extractVariablesFromTemplate(template.template);
    
    for (const templateVar of templateVariables) {
      if (!variableNames.includes(templateVar)) {
        throw new PromptManagerError(
          `Template variable '${templateVar}' used in template but not defined in variables array`,
          PromptManagerErrorType.VALIDATION_FAILED
        );
      }
    }
  }

  /**
   * Validate template variable
   */
  private validateTemplateVariable(variable: TemplateVariable): void {
    if (!variable.name || !variable.type) {
      throw new PromptManagerError(
        'Template variable missing required fields: name or type',
        PromptManagerErrorType.VALIDATION_FAILED
      );
    }

    const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
    if (!validTypes.includes(variable.type)) {
      throw new PromptManagerError(
        `Invalid template variable type: ${variable.type}. Must be one of: ${validTypes.join(', ')}`,
        PromptManagerErrorType.VALIDATION_FAILED
      );
    }
  }

  /**
   * Extract variable names from template content
   */
  private extractVariablesFromTemplate(template: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Get default template for fallback
   */
  private getDefaultTemplate(templateId: string): PromptTemplate {
    const defaultTemplates = this.createDefaultTemplates();
    const template = defaultTemplates.get(templateId);
    
    if (!template) {
      throw new PromptManagerError(
        `No default template available for: ${templateId}`,
        PromptManagerErrorType.TEMPLATE_NOT_FOUND
      );
    }

    return template;
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates = this.createDefaultTemplates();
    
    for (const [id, template] of defaultTemplates.entries()) {
      this.templates.set(id, template);
    }
  }

  /**
   * Create default templates
   */
  private createDefaultTemplates(): Map<string, PromptTemplate> {
    const templates = new Map<string, PromptTemplate>();

    // System Message Template
    templates.set(TEMPLATE_IDS.SYSTEM_MESSAGE, {
      templateId: TEMPLATE_IDS.SYSTEM_MESSAGE,
      name: 'System Message',
      description: 'Base system message for AI web automation agent',
      template: `You are an intelligent web automation agent capable of understanding web pages and performing actions to complete user-specified tasks.

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

Always be thorough, accurate, and explain your reasoning clearly.`,
      variables: [],
      version: '1.0.0',
      lastModified: new Date()
    });

    // Initial Action Template
    templates.set(TEMPLATE_IDS.INITIAL_ACTION, {
      templateId: TEMPLATE_IDS.INITIAL_ACTION,
      name: 'Initial Action Prompt',
      description: 'Prompt for first step of automation workflow',
      template: `{{systemMessage}}

## Current Task
{{stepContent}}

## Context
{{contextSection}}

## Instructions
Analyze the current page and plan your approach to complete this step. Consider:
- What elements need to be interacted with
- What information needs to be extracted
- How to verify successful completion

{{instructionSection}}

## Response Format
{{schemaSection}}

Provide your reasoning and the specific commands to execute.`,
      variables: [
        { name: 'systemMessage', type: 'string', required: true, description: 'System message content' },
        { name: 'stepContent', type: 'string', required: true, description: 'Current step description' },
        { name: 'contextSection', type: 'string', required: true, description: 'Formatted context information' },
        { name: 'instructionSection', type: 'string', required: true, description: 'Step-specific instructions' },
        { name: 'schemaSection', type: 'string', required: true, description: 'Response schema instructions' }
      ],
      version: '1.0.0',
      lastModified: new Date()
    });

    // Reflection Action Template
    templates.set(TEMPLATE_IDS.REFLECTION_ACTION, {
      templateId: TEMPLATE_IDS.REFLECTION_ACTION,
      name: 'Reflection and Action Prompt',
      description: 'Prompt for reflection and next action in ACT-REFLECT cycle',
      template: `{{systemMessage}}

## Previous Step Analysis
{{validationSection}}

## Current Task
{{stepContent}}

## Context
{{contextSection}}

## Instructions
Based on the previous step results and current context:
1. Analyze what was accomplished and what still needs to be done
2. Determine if the previous action was successful
3. Plan the next appropriate action

{{instructionSection}}

## Response Format
{{schemaSection}}

Provide your analysis, decision, and the specific commands to execute.`,
      variables: [
        { name: 'systemMessage', type: 'string', required: true, description: 'System message content' },
        { name: 'validationSection', type: 'string', required: true, description: 'Validation analysis content' },
        { name: 'stepContent', type: 'string', required: true, description: 'Current step description' },
        { name: 'contextSection', type: 'string', required: true, description: 'Formatted context information' },
        { name: 'instructionSection', type: 'string', required: true, description: 'Step-specific instructions' },
        { name: 'schemaSection', type: 'string', required: true, description: 'Response schema instructions' }
      ],
      version: '1.0.0',
      lastModified: new Date()
    });

    // Investigation Templates
    templates.set(TEMPLATE_IDS.INVESTIGATION_INITIAL, {
      templateId: TEMPLATE_IDS.INVESTIGATION_INITIAL,
      name: 'Investigation Initial Assessment',
      description: 'Prompt for initial page assessment investigation phase',
      template: `{{systemMessage}}

## Investigation Phase: Initial Assessment
{{investigationSection}}

## Current Task
{{stepContent}}

## Context
{{contextSection}}

## Available Investigation Tools
{{investigationToolsSection}}

## Instructions
Conduct an initial assessment of the current page to understand its structure and identify relevant elements for completing the task.

Your objectives:
- Get high-level understanding of page layout
- Identify main sections and key elements
- Determine investigation strategy for detailed exploration

{{instructionSection}}

## Response Format
{{schemaSection}}

Begin with screenshot analysis to get visual understanding of the page.`,
      variables: [
        { name: 'systemMessage', type: 'string', required: true, description: 'System message content' },
        { name: 'investigationSection', type: 'string', required: true, description: 'Investigation phase guidance' },
        { name: 'stepContent', type: 'string', required: true, description: 'Current step description' },
        { name: 'contextSection', type: 'string', required: true, description: 'Formatted context information' },
        { name: 'investigationToolsSection', type: 'string', required: true, description: 'Available investigation tools' },
        { name: 'instructionSection', type: 'string', required: true, description: 'Phase-specific instructions' },
        { name: 'schemaSection', type: 'string', required: true, description: 'Response schema instructions' }
      ],
      version: '1.0.0',
      lastModified: new Date()
    });

    // Add other templates...
    this.addRemainingDefaultTemplates(templates);

    return templates;
  }

  /**
   * Add remaining default templates to avoid method being too long
   */
  private addRemainingDefaultTemplates(templates: Map<string, PromptTemplate>): void {
    // Investigation Focused Exploration Template
    templates.set(TEMPLATE_IDS.INVESTIGATION_FOCUSED, {
      templateId: TEMPLATE_IDS.INVESTIGATION_FOCUSED,
      name: 'Investigation Focused Exploration',
      description: 'Prompt for focused exploration investigation phase',
      template: `{{systemMessage}}

## Investigation Phase: Focused Exploration
{{investigationSection}}

## Current Task
{{stepContent}}

## Context
{{contextSection}}

## Working Memory
{{workingMemorySection}}

## Available Investigation Tools
{{investigationToolsSection}}

## Instructions
Based on your initial assessment, conduct focused exploration of relevant page sections to build detailed understanding.

Your objectives:
- Verify element presence and accessibility
- Extract detailed information about target areas
- Build comprehensive understanding while managing context limits

{{instructionSection}}

## Response Format
{{schemaSection}}

Focus on the most relevant sections identified in your initial assessment.`,
      variables: [
        { name: 'systemMessage', type: 'string', required: true, description: 'System message content' },
        { name: 'investigationSection', type: 'string', required: true, description: 'Investigation phase guidance' },
        { name: 'stepContent', type: 'string', required: true, description: 'Current step description' },
        { name: 'contextSection', type: 'string', required: true, description: 'Formatted context information' },
        { name: 'workingMemorySection', type: 'string', required: false, description: 'Working memory content' },
        { name: 'investigationToolsSection', type: 'string', required: true, description: 'Available investigation tools' },
        { name: 'instructionSection', type: 'string', required: true, description: 'Phase-specific instructions' },
        { name: 'schemaSection', type: 'string', required: true, description: 'Response schema instructions' }
      ],
      version: '1.0.0',
      lastModified: new Date()
    });

    // Add more templates as needed...
    this.addUtilityTemplates(templates);
  }

  /**
   * Add utility templates
   */
  private addUtilityTemplates(templates: Map<string, PromptTemplate>): void {
    // Schema Template
    templates.set(TEMPLATE_IDS.SCHEMA, {
      templateId: TEMPLATE_IDS.SCHEMA,
      name: 'Response Schema',
      description: 'Template for response schema instructions',
      template: `Respond with a JSON object following this exact structure:

\`\`\`json
{
  "decision": {
    "action": "PROCEED|RETRY|ABORT|INVESTIGATE",
    "message": "Brief explanation of decision",
    "resultValidation": {
      "success": boolean,
      "expectedElements": ["list of expected elements"],
      "actualState": "description of actual page state",
      "issues": ["any issues found"]
    }
  },
  "reasoning": {
    "analysis": "Detailed analysis of current situation",
    "rationale": "Reasoning for chosen approach",
    "expectedOutcome": "What you expect to achieve",
    "confidence": 0.95,
    "alternatives": "Alternative approaches considered"
  },
  "commands": [
    {
      "action": "CLICK_ELEMENT|INPUT_TEXT|OPEN_PAGE|SAVE_VARIABLE|GET_DOM|GET_CONTENT|GET_SUBDOM",
      "parameters": {
        "selector": "CSS selector (when applicable)",
        "text": "Text to input (for INPUT_TEXT)",
        "url": "URL to navigate (for OPEN_PAGE)",
        "variableName": "Variable name (for SAVE_VARIABLE)",
        "attribute": "Attribute to extract (for GET_CONTENT)",
        "maxDomSize": 50000
      },
      "reasoning": "Why this command is needed"
    }
  ]
}
\`\`\`

{{additionalSchemaInstructions}}`,
      variables: [
        { name: 'additionalSchemaInstructions', type: 'string', required: false, description: 'Additional schema-specific instructions' }
      ],
      version: '1.0.0',
      lastModified: new Date()
    });

    // Context Template
    templates.set(TEMPLATE_IDS.CONTEXT, {
      templateId: TEMPLATE_IDS.CONTEXT,
      name: 'Context Section',
      description: 'Template for formatting context information',
      template: `### Current Step: {{stepIndex}} of {{totalSteps}}
{{stepType}}

### Execution History
{{executionHistory}}

### Page State
{{pageState}}

{{filteredContext}}

{{investigationHistory}}`,
      variables: [
        { name: 'stepIndex', type: 'number', required: true, description: 'Current step index' },
        { name: 'totalSteps', type: 'number', required: true, description: 'Total number of steps' },
        { name: 'stepType', type: 'string', required: true, description: 'Type of step being processed' },
        { name: 'executionHistory', type: 'string', required: false, description: 'Formatted execution history' },
        { name: 'pageState', type: 'string', required: false, description: 'Current page state information' },
        { name: 'filteredContext', type: 'string', required: false, description: 'Filtered context content' },
        { name: 'investigationHistory', type: 'string', required: false, description: 'Investigation history content' }
      ],
      version: '1.0.0',
      lastModified: new Date()
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: TemplateConfig): void {
    this.config = config;
    
    // Clear cache if caching was disabled
    if (!config.templateCacheEnabled) {
      this.templateCache.clear();
    }
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): {
    totalTemplates: number;
    cachedTemplates: number;
    cacheHitRate: number;
  } {
    return {
      totalTemplates: this.templates.size,
      cachedTemplates: this.templateCache.size,
      cacheHitRate: 0 // Would need to track hits/misses for real implementation
    };
  }
}
