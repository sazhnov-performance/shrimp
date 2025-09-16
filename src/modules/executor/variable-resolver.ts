/**
 * Variable Resolver
 * Implements variable interpolation with ${variable_name} syntax
 * Supports nested variable references and session-specific scoping
 */

import { IVariableResolver } from './types';
import { ExecutorErrorHandler } from './error-handler';

export class VariableResolver implements IVariableResolver {
  private sessionVariables: Map<string, Map<string, string>> = new Map();
  private errorHandler: ExecutorErrorHandler;
  private maxNestingDepth: number = 10;

  constructor(errorHandler: ExecutorErrorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * Resolves variables in input string with ${variable_name} syntax
   * Supports nested variable references
   */
  resolve(sessionId: string, input: string): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    const sessionVars = this.getSessionVariables(sessionId);
    return this.resolveRecursive(sessionId, input, sessionVars, 0);
  }

  private resolveRecursive(
    sessionId: string, 
    input: string, 
    variables: Map<string, string>, 
    depth: number
  ): string {
    if (depth >= this.maxNestingDepth) {
      throw this.errorHandler.createStandardError(
        'VARIABLE_RESOLUTION_DEPTH_EXCEEDED',
        `Variable resolution depth exceeded maximum of ${this.maxNestingDepth}`,
        { sessionId, input, depth }
      );
    }

    // Pattern to match ${variable_name} with support for alphanumeric, underscore, and dash
    const variablePattern = /\$\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g;
    let resolved = input;
    let hasReplacements = false;

    resolved = resolved.replace(variablePattern, (match, variableName) => {
      const value = variables.get(variableName);
      
      if (value === undefined) {
        // Variable not found - return original placeholder
        return match;
      }

      hasReplacements = true;
      return value;
    });

    // If we made replacements and the result still contains variables, recurse
    if (hasReplacements && variablePattern.test(resolved)) {
      return this.resolveRecursive(sessionId, resolved, variables, depth + 1);
    }

    return resolved;
  }

  /**
   * Sets a variable value for a specific session
   */
  setVariable(sessionId: string, name: string, value: string): void {
    if (!this.isValidVariableName(name)) {
      throw this.errorHandler.createStandardError(
        'INVALID_VARIABLE_NAME',
        `Invalid variable name: ${name}. Must start with letter or underscore and contain only alphanumeric characters, underscores, and dashes.`,
        { sessionId, name, value }
      );
    }

    const sessionVars = this.getSessionVariables(sessionId);
    sessionVars.set(name, value);
  }

  /**
   * Gets a variable value for a specific session
   */
  getVariable(sessionId: string, name: string): string | null {
    const sessionVars = this.getSessionVariables(sessionId);
    return sessionVars.get(name) || null;
  }

  /**
   * Lists all variables for a specific session
   */
  listVariables(sessionId: string): Record<string, string> {
    const sessionVars = this.getSessionVariables(sessionId);
    const result: Record<string, string> = {};
    
    sessionVars.forEach((value, key) => {
      result[key] = value;
    });
    
    return result;
  }

  /**
   * Clears all variables for a specific session
   */
  clearSessionVariables(sessionId: string): void {
    this.sessionVariables.delete(sessionId);
  }

  /**
   * Checks if a string contains variable references
   */
  hasVariables(input: string): boolean {
    const variablePattern = /\$\{[a-zA-Z_][a-zA-Z0-9_-]*\}/;
    return variablePattern.test(input);
  }

  /**
   * Extracts all variable names from a string
   */
  extractVariableNames(input: string): string[] {
    const variablePattern = /\$\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g;
    const matches: string[] = [];
    let match;

    while ((match = variablePattern.exec(input)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }

    return matches;
  }

  /**
   * Validates if all variables in input string can be resolved
   */
  canResolveAll(sessionId: string, input: string): { canResolve: boolean; missingVariables: string[] } {
    const variableNames = this.extractVariableNames(input);
    const sessionVars = this.getSessionVariables(sessionId);
    const missingVariables: string[] = [];

    variableNames.forEach(name => {
      if (!sessionVars.has(name)) {
        missingVariables.push(name);
      }
    });

    return {
      canResolve: missingVariables.length === 0,
      missingVariables
    };
  }

  /**
   * Gets or creates session variable map
   */
  private getSessionVariables(sessionId: string): Map<string, string> {
    if (!this.sessionVariables.has(sessionId)) {
      this.sessionVariables.set(sessionId, new Map());
    }
    return this.sessionVariables.get(sessionId)!;
  }

  /**
   * Validates variable name format
   */
  private isValidVariableName(name: string): boolean {
    const variableNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    return variableNamePattern.test(name);
  }

  /**
   * Imports variables from an object
   */
  importVariables(sessionId: string, variables: Record<string, string>): void {
    Object.entries(variables).forEach(([name, value]) => {
      this.setVariable(sessionId, name, value);
    });
  }

  /**
   * Exports variables to an object format
   */
  exportVariables(sessionId: string): Record<string, string> {
    return this.listVariables(sessionId);
  }

  /**
   * Counts the number of variables for a session
   */
  getVariableCount(sessionId: string): number {
    const sessionVars = this.getSessionVariables(sessionId);
    return sessionVars.size;
  }

  /**
   * Gets statistics about variable usage across all sessions
   */
  getStatistics(): {
    totalSessions: number;
    totalVariables: number;
    averageVariablesPerSession: number;
    sessionsWithVariables: number;
  } {
    const totalSessions = this.sessionVariables.size;
    let totalVariables = 0;
    let sessionsWithVariables = 0;

    this.sessionVariables.forEach(sessionVars => {
      const count = sessionVars.size;
      totalVariables += count;
      if (count > 0) {
        sessionsWithVariables++;
      }
    });

    return {
      totalSessions,
      totalVariables,
      averageVariablesPerSession: totalSessions > 0 ? totalVariables / totalSessions : 0,
      sessionsWithVariables
    };
  }

  /**
   * Sets the maximum nesting depth for variable resolution
   */
  setMaxNestingDepth(depth: number): void {
    if (depth < 1) {
      throw new Error('Maximum nesting depth must be at least 1');
    }
    this.maxNestingDepth = depth;
  }
}

