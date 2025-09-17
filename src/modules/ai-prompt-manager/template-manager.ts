/**
 * Template Manager Implementation
 * Manages prompt templates and their lifecycle
 */

import { PromptTemplate, TemplateConfig } from './types';
import { getPromptTemplates } from './templates';

export class TemplateManager {
  private templates = new Map<string, PromptTemplate>();

  constructor(private config: TemplateConfig) {
    // Initialize with default templates
    const defaultTemplates = getPromptTemplates();
    this.templates.set('system-message', defaultTemplates.systemMessageTemplate);
    this.templates.set('action-prompt', defaultTemplates.actionPromptTemplate);
    this.templates.set('reflection-prompt', defaultTemplates.reflectionPromptTemplate);
    this.templates.set('validation-prompt', defaultTemplates.validationPromptTemplate);
    this.templates.set('context', defaultTemplates.contextTemplate);
    this.templates.set('schema', defaultTemplates.schemaTemplate);
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string): PromptTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Set or update a template
   */
  setTemplate(templateId: string, template: PromptTemplate): void {
    if (!this.config.customTemplatesAllowed && this.templates.has(templateId)) {
      throw new Error('Custom templates are not allowed');
    }
    this.templates.set(templateId, template);
  }

  /**
   * Get all template IDs
   */
  getTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if a template exists
   */
  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }

  /**
   * Remove a template
   */
  removeTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): Map<string, PromptTemplate> {
    return new Map(this.templates);
  }
}
