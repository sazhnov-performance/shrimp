/**
 * Prompt Template Definitions
 * Comprehensive template system for generating AI prompts
 */

import { PromptTemplate, PromptTemplates, InvestigationPhase } from './types';

/**
 * Main system message template
 */
export const SYSTEM_MESSAGE_TEMPLATE: PromptTemplate = {
  templateId: 'system-message',
  name: 'System Message Template',
  description: 'Core system message defining the AI agent role and capabilities',
  template: `ROLE: You are an intelligent web automation agent specialized in browser testing and interaction.

CURRENT CONTEXT:
- Session: {{sessionId}}
- Step {{stepIndex}} of {{totalSteps}}: "{{stepName}}"
- Current Page State: [Based on latest screenshot/DOM data]

YOUR MISSION:
Execute the current step using available browser automation commands through a systematic INVESTIGATE-ACT-REFLECT cycle:

INVESTIGATE PHASE:
1. Analyze the current page state using available inspection methods
2. Use GET_SUBDOM to explore relevant page sections and understand structure
3. Identify target elements and optimal interaction strategies
4. Build confidence in element selectors through iterative investigation

ACT PHASE:
1. Choose the most reliable CSS selector for your target element
2. Execute the appropriate action (OPEN_PAGE, CLICK_ELEMENT, INPUT_TEXT)
3. Ensure high confidence (80%+) before taking action

REFLECT PHASE:
1. Evaluate action outcome against step objectives
2. Determine if step goal is achieved or requires additional actions
3. Decide flow control: continue iteration, complete successfully, or fail

AVAILABLE COMMANDS:
- OPEN_PAGE: Navigate to a URL
- CLICK_ELEMENT: Click on page elements using CSS selectors
- INPUT_TEXT: Enter text into form fields
- GET_SUBDOM: Investigate page sections for element discovery

OPTIMIZATION GUIDELINES:
- Prioritize stable, unique selectors (IDs, data attributes, specific classes)
- Use semantic HTML attributes when available
- Validate element existence before interaction
- Maintain high confidence levels through thorough investigation
- Provide clear reasoning for all decisions`,
  variables: [
    { name: 'sessionId', type: 'string', required: true, description: 'Session identifier' },
    { name: 'stepIndex', type: 'number', required: true, description: 'Current step index (0-based)' },
    { name: 'totalSteps', type: 'number', required: true, description: 'Total number of steps' },
    { name: 'stepName', type: 'string', required: true, description: 'Current step description' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

/**
 * Action prompt template
 */
export const ACTION_PROMPT_TEMPLATE: PromptTemplate = {
  templateId: 'action-prompt',
  name: 'Action Prompt Template',
  description: 'Template for generating action-focused prompts',
  template: `{{systemMessage}}

EXECUTION HISTORY:
{{executionHistory}}

CURRENT STEP OBJECTIVE: {{stepObjective}}

{{actionGuidance}}

{{constraints}}

{{schema}}

Begin your analysis of the current page state and determine your next action.`,
  variables: [
    { name: 'systemMessage', type: 'string', required: true, description: 'System role message' },
    { name: 'executionHistory', type: 'string', required: true, description: 'Formatted execution history' },
    { name: 'stepObjective', type: 'string', required: true, description: 'Current step objective' },
    { name: 'actionGuidance', type: 'string', required: false, description: 'Specific action guidance' },
    { name: 'constraints', type: 'string', required: false, description: 'Constraints and limitations' },
    { name: 'schema', type: 'string', required: true, description: 'Response schema definition' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

/**
 * Reflection prompt template
 */
export const REFLECTION_PROMPT_TEMPLATE: PromptTemplate = {
  templateId: 'reflection-prompt',
  name: 'Reflection Prompt Template',
  description: 'Template for generating reflection and validation prompts',
  template: `{{systemMessage}}

REFLECTION AND VALIDATION:

Previous Action Review:
{{previousActionSummary}}

Expected Outcome:
{{expectedOutcome}}

Current Page Analysis:
{{currentPageAnalysis}}

Validation Criteria:
{{validationCriteria}}

Next Step Preparation:
{{nextStepObjective}}

{{schema}}

Analyze the results of the previous action and determine the next course of action.`,
  variables: [
    { name: 'systemMessage', type: 'string', required: true, description: 'System role message' },
    { name: 'previousActionSummary', type: 'string', required: true, description: 'Summary of previous action' },
    { name: 'expectedOutcome', type: 'string', required: true, description: 'Expected outcome description' },
    { name: 'currentPageAnalysis', type: 'string', required: true, description: 'Current page state analysis' },
    { name: 'validationCriteria', type: 'string', required: true, description: 'Validation criteria' },
    { name: 'nextStepObjective', type: 'string', required: true, description: 'Next step objective' },
    { name: 'schema', type: 'string', required: true, description: 'Response schema definition' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

/**
 * Validation prompt template
 */
export const VALIDATION_PROMPT_TEMPLATE: PromptTemplate = {
  templateId: 'validation-prompt',
  name: 'Validation Prompt Template',
  description: 'Template for result validation and analysis',
  template: `VALIDATION ANALYSIS:

Last Action: {{lastAction}}
Expected Result: {{expectedResult}}
Actual Result: {{actualResult}}

Success Indicators:
{{successIndicators}}

Failure Indicators:
{{failureIndicators}}

Page State Comparison:
{{pageStateComparison}}

Determine if the action was successful and provide detailed reasoning.`,
  variables: [
    { name: 'lastAction', type: 'string', required: true, description: 'Last executed action' },
    { name: 'expectedResult', type: 'string', required: true, description: 'Expected result' },
    { name: 'actualResult', type: 'string', required: true, description: 'Actual result observed' },
    { name: 'successIndicators', type: 'string', required: true, description: 'Success indicators' },
    { name: 'failureIndicators', type: 'string', required: true, description: 'Failure indicators' },
    { name: 'pageStateComparison', type: 'string', required: true, description: 'Page state comparison' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

/**
 * Context template
 */
export const CONTEXT_TEMPLATE: PromptTemplate = {
  templateId: 'context',
  name: 'Context Template',
  description: 'Template for formatting execution context',
  template: `EXECUTION CONTEXT:

Session ID: {{sessionId}}
Current Step: {{stepIndex}} of {{totalSteps}}
Step Description: {{stepDescription}}

Previous Steps Summary:
{{previousSteps}}

Current Page State:
{{pageState}}

Working Memory:
{{workingMemory}}

Investigation Context:
{{investigationContext}}`,
  variables: [
    { name: 'sessionId', type: 'string', required: true, description: 'Session identifier' },
    { name: 'stepIndex', type: 'number', required: true, description: 'Current step index' },
    { name: 'totalSteps', type: 'number', required: true, description: 'Total steps count' },
    { name: 'stepDescription', type: 'string', required: true, description: 'Step description' },
    { name: 'previousSteps', type: 'string', required: false, description: 'Previous steps summary' },
    { name: 'pageState', type: 'string', required: true, description: 'Current page state' },
    { name: 'workingMemory', type: 'string', required: false, description: 'Working memory content' },
    { name: 'investigationContext', type: 'string', required: false, description: 'Investigation context' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

/**
 * Schema template
 */
export const SCHEMA_TEMPLATE: PromptTemplate = {
  templateId: 'schema',
  name: 'Schema Template',
  description: 'Template for response schema formatting',
  template: `RESPONSE FORMAT:
{{responseSchema}}

IMPORTANT: Your response must strictly conform to the above JSON schema. Include all required fields and follow the specified structure exactly.`,
  variables: [
    { name: 'responseSchema', type: 'string', required: true, description: 'JSON schema definition' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

/**
 * Investigation templates for different phases
 */
export const INVESTIGATION_INITIAL_ASSESSMENT_TEMPLATE: PromptTemplate = {
  templateId: 'investigation-initial-assessment',
  name: 'Investigation Initial Assessment Template',
  description: 'Template for initial page assessment investigation',
  template: `{{systemMessage}}

INVESTIGATION PHASE: Initial Assessment

OBJECTIVE: {{investigationObjective}}

AVAILABLE TOOLS:
{{availableTools}}

WORKING MEMORY:
{{workingMemory}}

INVESTIGATION INSTRUCTIONS:
1. Begin with screenshot analysis to understand the overall page layout
2. Use text extraction to identify key textual elements and navigation
3. Perform targeted sub-DOM extraction for areas of interest
4. Build initial understanding of page structure and element hierarchy
5. Identify potential target elements for the current step
6. Document findings in working memory for future reference

CONFIDENCE THRESHOLD: {{confidenceThreshold}}

{{schema}}

Start your investigation with the available tools to understand the current page state.`,
  variables: [
    { name: 'systemMessage', type: 'string', required: true, description: 'System message' },
    { name: 'investigationObjective', type: 'string', required: true, description: 'Investigation objective' },
    { name: 'availableTools', type: 'string', required: true, description: 'Available investigation tools' },
    { name: 'workingMemory', type: 'string', required: false, description: 'Current working memory' },
    { name: 'confidenceThreshold', type: 'number', required: true, description: 'Required confidence level' },
    { name: 'schema', type: 'string', required: true, description: 'Response schema' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

export const INVESTIGATION_FOCUSED_EXPLORATION_TEMPLATE: PromptTemplate = {
  templateId: 'investigation-focused-exploration',
  name: 'Investigation Focused Exploration Template',
  description: 'Template for focused exploration investigation',
  template: `{{systemMessage}}

INVESTIGATION PHASE: Focused Exploration

OBJECTIVE: {{investigationObjective}}

PREVIOUS FINDINGS:
{{previousFindings}}

AREAS OF INTEREST:
{{areasOfInterest}}

AVAILABLE TOOLS:
{{availableTools}}

INVESTIGATION INSTRUCTIONS:
1. Focus on specific areas identified in the initial assessment
2. Use sub-DOM extraction to examine target regions in detail
3. Perform text extraction to understand content and structure
4. Look for patterns, unique identifiers, and reliable selectors
5. Test preliminary selector strategies
6. Refine understanding of element relationships

{{schema}}

Continue investigation by focusing on the most promising areas identified previously.`,
  variables: [
    { name: 'systemMessage', type: 'string', required: true, description: 'System message' },
    { name: 'investigationObjective', type: 'string', required: true, description: 'Investigation objective' },
    { name: 'previousFindings', type: 'string', required: true, description: 'Previous investigation findings' },
    { name: 'areasOfInterest', type: 'string', required: true, description: 'Areas to focus on' },
    { name: 'availableTools', type: 'string', required: true, description: 'Available investigation tools' },
    { name: 'schema', type: 'string', required: true, description: 'Response schema' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

export const INVESTIGATION_SELECTOR_DETERMINATION_TEMPLATE: PromptTemplate = {
  templateId: 'investigation-selector-determination',
  name: 'Investigation Selector Determination Template',
  description: 'Template for selector determination investigation',
  template: `{{systemMessage}}

INVESTIGATION PHASE: Selector Determination

OBJECTIVE: {{investigationObjective}}

TARGET ELEMENTS IDENTIFIED:
{{targetElements}}

SELECTOR CANDIDATES:
{{selectorCandidates}}

AVAILABLE TOOLS:
{{availableTools}}

INVESTIGATION INSTRUCTIONS:
1. Validate selector candidates through full DOM retrieval
2. Test selector uniqueness and reliability
3. Evaluate selector stability (likely to persist across page changes)
4. Consider fallback selectors for robustness
5. Make final determination on optimal selector strategy
6. Prepare for action execution with high confidence

CONFIDENCE REQUIREMENT: {{confidenceThreshold}}

{{schema}}

Make your final selector determination and prepare for action execution.`,
  variables: [
    { name: 'systemMessage', type: 'string', required: true, description: 'System message' },
    { name: 'investigationObjective', type: 'string', required: true, description: 'Investigation objective' },
    { name: 'targetElements', type: 'string', required: true, description: 'Target elements identified' },
    { name: 'selectorCandidates', type: 'string', required: true, description: 'Selector candidates' },
    { name: 'availableTools', type: 'string', required: true, description: 'Available investigation tools' },
    { name: 'confidenceThreshold', type: 'number', required: true, description: 'Required confidence level' },
    { name: 'schema', type: 'string', required: true, description: 'Response schema' }
  ],
  version: '1.0.0',
  lastModified: new Date()
};

/**
 * Get all prompt templates
 */
export function getPromptTemplates(): PromptTemplates {
  return {
    systemMessageTemplate: SYSTEM_MESSAGE_TEMPLATE,
    actionPromptTemplate: ACTION_PROMPT_TEMPLATE,
    reflectionPromptTemplate: REFLECTION_PROMPT_TEMPLATE,
    validationPromptTemplate: VALIDATION_PROMPT_TEMPLATE,
    contextTemplate: CONTEXT_TEMPLATE,
    schemaTemplate: SCHEMA_TEMPLATE,
    investigationTemplates: {
      [InvestigationPhase.INITIAL_ASSESSMENT]: INVESTIGATION_INITIAL_ASSESSMENT_TEMPLATE,
      [InvestigationPhase.FOCUSED_EXPLORATION]: INVESTIGATION_FOCUSED_EXPLORATION_TEMPLATE,
      [InvestigationPhase.SELECTOR_DETERMINATION]: INVESTIGATION_SELECTOR_DETERMINATION_TEMPLATE
    }
  };
}

/**
 * Template variable replacement utility
 */
export function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const replacement = String(value ?? '');
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
  }
  
  return result;
}

/**
 * Validate template variables
 */
export function validateTemplateVariables(
  template: PromptTemplate,
  variables: Record<string, any>
): { isValid: boolean; missingRequired: string[]; invalidTypes: string[] } {
  const missingRequired: string[] = [];
  const invalidTypes: string[] = [];
  
  for (const templateVar of template.variables) {
    if (templateVar.required && !(templateVar.name in variables)) {
      missingRequired.push(templateVar.name);
    }
    
    if (templateVar.name in variables) {
      const value = variables[templateVar.name];
      if (!validateVariableType(value, templateVar.type)) {
        invalidTypes.push(`${templateVar.name} (expected ${templateVar.type})`);
      }
    }
  }
  
  return {
    isValid: missingRequired.length === 0 && invalidTypes.length === 0,
    missingRequired,
    invalidTypes
  };
}

/**
 * Helper function to validate variable types
 */
function validateVariableType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}
