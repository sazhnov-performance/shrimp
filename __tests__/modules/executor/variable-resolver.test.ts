/**
 * Unit Tests for VariableResolver
 * Tests variable interpolation, nested references, and edge cases
 */

import { VariableResolver } from '../../../src/modules/executor/variable-resolver';
import { ExecutorErrorHandler } from '../../../src/modules/executor/error-handler';

describe('VariableResolver', () => {
  let variableResolver: VariableResolver;
  let errorHandler: ExecutorErrorHandler;

  beforeEach(() => {
    errorHandler = new ExecutorErrorHandler();
    variableResolver = new VariableResolver(errorHandler);
  });

  describe('basic variable operations', () => {
    it('should set and get variables correctly', () => {
      const sessionId = 'test-session';
      const variableName = 'username';
      const value = 'john_doe';

      variableResolver.setVariable(sessionId, variableName, value);
      const retrievedValue = variableResolver.getVariable(sessionId, variableName);

      expect(retrievedValue).toBe(value);
    });

    it('should return null for non-existent variables', () => {
      const sessionId = 'test-session';
      const value = variableResolver.getVariable(sessionId, 'non_existent');

      expect(value).toBeNull();
    });

    it('should return null for non-existent sessions', () => {
      const value = variableResolver.getVariable('non-existent-session', 'any_var');

      expect(value).toBeNull();
    });

    it('should list all variables for a session', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'var1', 'value1');
      variableResolver.setVariable(sessionId, 'var2', 'value2');
      variableResolver.setVariable(sessionId, 'var3', 'value3');

      const variables = variableResolver.listVariables(sessionId);

      expect(variables).toEqual({
        var1: 'value1',
        var2: 'value2',
        var3: 'value3'
      });
    });

    it('should return empty object for non-existent sessions when listing', () => {
      const variables = variableResolver.listVariables('non-existent-session');
      expect(variables).toEqual({});
    });

    it('should handle session isolation', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      variableResolver.setVariable(session1, 'shared_name', 'value1');
      variableResolver.setVariable(session2, 'shared_name', 'value2');

      expect(variableResolver.getVariable(session1, 'shared_name')).toBe('value1');
      expect(variableResolver.getVariable(session2, 'shared_name')).toBe('value2');
    });
  });

  describe('variable resolution', () => {
    beforeEach(() => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'username', 'john_doe');
      variableResolver.setVariable(sessionId, 'password', 'secret123');
      variableResolver.setVariable(sessionId, 'baseUrl', 'https://example.com');
      variableResolver.setVariable(sessionId, 'port', '8080');
    });

    it('should resolve simple variables', () => {
      const sessionId = 'test-session';
      const input = 'Hello ${username}!';
      const resolved = variableResolver.resolve(sessionId, input);

      expect(resolved).toBe('Hello john_doe!');
    });

    it('should resolve multiple variables in single string', () => {
      const sessionId = 'test-session';
      const input = 'Login as ${username} with ${password}';
      const resolved = variableResolver.resolve(sessionId, input);

      expect(resolved).toBe('Login as john_doe with secret123');
    });

    it('should handle URLs with multiple variables', () => {
      const sessionId = 'test-session';
      const input = '${baseUrl}:${port}/login';
      const resolved = variableResolver.resolve(sessionId, input);

      expect(resolved).toBe('https://example.com:8080/login');
    });

    it('should leave unresolved variables unchanged', () => {
      const sessionId = 'test-session';
      const input = 'User: ${username}, Missing: ${missing_var}';
      const resolved = variableResolver.resolve(sessionId, input);

      expect(resolved).toBe('User: john_doe, Missing: ${missing_var}');
    });

    it('should handle strings without variables', () => {
      const sessionId = 'test-session';
      const input = 'No variables here';
      const resolved = variableResolver.resolve(sessionId, input);

      expect(resolved).toBe('No variables here');
    });

    it('should handle empty strings', () => {
      const sessionId = 'test-session';
      const resolved = variableResolver.resolve(sessionId, '');

      expect(resolved).toBe('');
    });

    it('should handle null and undefined input', () => {
      const sessionId = 'test-session';
      
      expect(variableResolver.resolve(sessionId, null as any)).toBeNull();
      expect(variableResolver.resolve(sessionId, undefined as any)).toBeUndefined();
    });

    it('should handle non-string input', () => {
      const sessionId = 'test-session';
      const numberInput = 123;
      
      expect(variableResolver.resolve(sessionId, numberInput as any)).toBe(123);
    });
  });

  describe('nested variable resolution', () => {
    beforeEach(() => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'env', 'prod');
      variableResolver.setVariable(sessionId, 'prod_url', 'https://prod.example.com');
      variableResolver.setVariable(sessionId, 'dev_url', 'https://dev.example.com');
      variableResolver.setVariable(sessionId, 'url_key', 'prod_url');
    });

    it('should resolve nested variables', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'nested_key', '${url_key}');
      variableResolver.setVariable(sessionId, 'final_url', '${${nested_key}}');
      
      const input = 'Navigate to ${final_url}';
      const resolved = variableResolver.resolve(sessionId, input);

      expect(resolved).toBe('Navigate to https://prod.example.com');
    });

    it('should handle partial nesting resolution', () => {
      const sessionId = 'test-session';
      const input = 'URL: ${${env}_url}';
      const resolved = variableResolver.resolve(sessionId, input);

      expect(resolved).toBe('URL: https://prod.example.com');
    });

    it('should prevent infinite recursion', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'recursive1', '${recursive2}');
      variableResolver.setVariable(sessionId, 'recursive2', '${recursive1}');
      
      expect(() => {
        variableResolver.resolve(sessionId, '${recursive1}');
      }).toThrow(/Variable resolution depth exceeded/);
    });

    it('should handle deep nesting within limits', () => {
      const sessionId = 'test-session';
      
      // Create a chain of 5 nested variables (within default limit of 10)
      variableResolver.setVariable(sessionId, 'level1', 'final_value');
      variableResolver.setVariable(sessionId, 'level2', '${level1}');
      variableResolver.setVariable(sessionId, 'level3', '${level2}');
      variableResolver.setVariable(sessionId, 'level4', '${level3}');
      variableResolver.setVariable(sessionId, 'level5', '${level4}');
      
      const resolved = variableResolver.resolve(sessionId, '${level5}');
      expect(resolved).toBe('final_value');
    });

    it('should throw error when nesting depth exceeds limit', () => {
      const sessionId = 'test-session';
      
      // Create a chain longer than the default limit (10)
      for (let i = 1; i <= 12; i++) {
        const nextLevel = i === 12 ? 'final' : `level${i + 1}`;
        variableResolver.setVariable(sessionId, `level${i}`, `\${${nextLevel}}`);
      }
      variableResolver.setVariable(sessionId, 'final', 'end_value');
      
      expect(() => {
        variableResolver.resolve(sessionId, '${level1}');
      }).toThrow(/Variable resolution depth exceeded/);
    });
  });

  describe('variable name validation', () => {
    it('should resolve variables with underscores', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'user_name', 'john');
      
      const resolved = variableResolver.resolve(sessionId, '${user_name}');
      expect(resolved).toBe('john');
    });

    it('should resolve variables with dashes', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'user-name', 'john');
      
      const resolved = variableResolver.resolve(sessionId, '${user-name}');
      expect(resolved).toBe('john');
    });

    it('should resolve variables with numbers', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'var123', 'value');
      variableResolver.setVariable(sessionId, 'user2', 'jane');
      
      expect(variableResolver.resolve(sessionId, '${var123}')).toBe('value');
      expect(variableResolver.resolve(sessionId, '${user2}')).toBe('jane');
    });

    it('should not resolve variables starting with numbers', () => {
      const sessionId = 'test-session';
      const input = '${123var}';
      const resolved = variableResolver.resolve(sessionId, input);
      
      expect(resolved).toBe('${123var}'); // Should remain unresolved
    });

    it('should handle mixed valid and invalid variable names', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'valid_var', 'good');
      
      const input = '${valid_var} and ${123invalid}';
      const resolved = variableResolver.resolve(sessionId, input);
      
      expect(resolved).toBe('good and ${123invalid}');
    });
  });

  describe('edge cases and special characters', () => {
    it('should handle variables with special character values', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'special', 'Value with $pecial ch@rs & symbols!');
      
      const resolved = variableResolver.resolve(sessionId, '${special}');
      expect(resolved).toBe('Value with $pecial ch@rs & symbols!');
    });

    it('should handle empty variable values', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'empty', '');
      
      const resolved = variableResolver.resolve(sessionId, 'Before${empty}After');
      expect(resolved).toBe('BeforeAfter');
    });

    it('should handle variables with whitespace values', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'spaces', '   spaced   ');
      
      const resolved = variableResolver.resolve(sessionId, '[${spaces}]');
      expect(resolved).toBe('[   spaced   ]');
    });

    it('should handle malformed variable syntax', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'good', 'value');
      
      const inputs = [
        '${unclosed',          // Missing closing brace
        '${}',                 // Empty variable name
        '${good${nested}',     // Malformed nesting
        '$ {good}',            // Space between $ and {
        '{good}',              // Missing $
      ];
      
      inputs.forEach(input => {
        const resolved = variableResolver.resolve(sessionId, input);
        expect(resolved).toBe(input); // Should remain unchanged
      });
    });

    it('should handle multiple occurrences of same variable', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'repeat', 'REPEATED');
      
      const input = '${repeat} and ${repeat} again ${repeat}';
      const resolved = variableResolver.resolve(sessionId, input);
      
      expect(resolved).toBe('REPEATED and REPEATED again REPEATED');
    });

    it('should handle escaped dollar signs', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'price', '10');
      
      // Note: This test assumes no special escaping is implemented
      // If escaping is added later, this test should be updated
      const input = 'Price: $${price} dollars';
      const resolved = variableResolver.resolve(sessionId, input);
      
      expect(resolved).toBe('Price: $10 dollars');
    });
  });

  describe('session management', () => {
    it('should handle multiple sessions independently', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      const session3 = 'session-3';
      
      variableResolver.setVariable(session1, 'var', 'value1');
      variableResolver.setVariable(session2, 'var', 'value2');
      variableResolver.setVariable(session3, 'different', 'value3');
      
      expect(variableResolver.resolve(session1, '${var}')).toBe('value1');
      expect(variableResolver.resolve(session2, '${var}')).toBe('value2');
      expect(variableResolver.resolve(session3, '${var}')).toBe('${var}'); // Unresolved
      expect(variableResolver.resolve(session3, '${different}')).toBe('value3');
    });

    it('should clear session data when appropriate', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'temp', 'temporary');
      
      expect(variableResolver.getVariable(sessionId, 'temp')).toBe('temporary');
      
      // Test session cleanup
      variableResolver.clearSessionVariables(sessionId);
      expect(variableResolver.getVariable(sessionId, 'temp')).toBeNull();
    });

    it('should update existing variables', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'counter', '1');
      
      expect(variableResolver.resolve(sessionId, '${counter}')).toBe('1');
      
      variableResolver.setVariable(sessionId, 'counter', '2');
      expect(variableResolver.resolve(sessionId, '${counter}')).toBe('2');
    });
  });

  describe('performance and memory', () => {
    it('should handle large number of variables efficiently', () => {
      const sessionId = 'perf-test-session';
      const numVariables = 1000;
      
      // Set many variables
      for (let i = 0; i < numVariables; i++) {
        variableResolver.setVariable(sessionId, `var_${i}`, `value_${i}`);
      }
      
      // Test retrieval
      expect(variableResolver.getVariable(sessionId, 'var_0')).toBe('value_0');
      expect(variableResolver.getVariable(sessionId, 'var_500')).toBe('value_500');
      expect(variableResolver.getVariable(sessionId, 'var_999')).toBe('value_999');
      
      // Test listing
      const allVars = variableResolver.listVariables(sessionId);
      expect(Object.keys(allVars)).toHaveLength(numVariables);
    });

    it('should handle long variable values efficiently', () => {
      const sessionId = 'test-session';
      const longValue = 'x'.repeat(10000); // 10KB string
      
      variableResolver.setVariable(sessionId, 'long_var', longValue);
      
      const resolved = variableResolver.resolve(sessionId, '${long_var}');
      expect(resolved).toBe(longValue);
    });

    it('should handle complex resolution patterns efficiently', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'base', 'https://api.example.com');
      variableResolver.setVariable(sessionId, 'version', 'v1');
      variableResolver.setVariable(sessionId, 'endpoint', 'users');
      variableResolver.setVariable(sessionId, 'id', '123');
      variableResolver.setVariable(sessionId, 'format', 'json');
      
      const complexUrl = '${base}/${version}/${endpoint}/${id}.${format}?query=value&other=${version}';
      const resolved = variableResolver.resolve(sessionId, complexUrl);
      
      expect(resolved).toBe('https://api.example.com/v1/users/123.json?query=value&other=v1');
    });
  });

  describe('additional utilities', () => {
    it('should detect if string has variables', () => {
      expect(variableResolver.hasVariables('${test}')).toBe(true);
      expect(variableResolver.hasVariables('no variables')).toBe(false);
      expect(variableResolver.hasVariables('has ${var} variable')).toBe(true);
      expect(variableResolver.hasVariables('${123invalid}')).toBe(false);
    });

    it('should extract variable names from string', () => {
      const input = 'Connect to ${host}:${port} with ${username}';
      const names = variableResolver.extractVariableNames(input);
      
      expect(names).toEqual(['host', 'port', 'username']);
    });

    it('should handle duplicate variable names in extraction', () => {
      const input = '${user} and ${user} again';
      const names = variableResolver.extractVariableNames(input);
      
      expect(names).toEqual(['user']); // Should only appear once
    });

    it('should check if all variables can be resolved', () => {
      const sessionId = 'test-session';
      variableResolver.setVariable(sessionId, 'existing', 'value');
      
      const result1 = variableResolver.canResolveAll(sessionId, '${existing}');
      expect(result1.canResolve).toBe(true);
      expect(result1.missingVariables).toEqual([]);
      
      const result2 = variableResolver.canResolveAll(sessionId, '${existing} ${missing}');
      expect(result2.canResolve).toBe(false);
      expect(result2.missingVariables).toEqual(['missing']);
    });

    it('should import and export variables', () => {
      const sessionId = 'test-session';
      const variables = {
        var1: 'value1',
        var2: 'value2',
        var3: 'value3'
      };
      
      variableResolver.importVariables(sessionId, variables);
      
      expect(variableResolver.getVariable(sessionId, 'var1')).toBe('value1');
      expect(variableResolver.getVariable(sessionId, 'var2')).toBe('value2');
      expect(variableResolver.getVariable(sessionId, 'var3')).toBe('value3');
      
      const exported = variableResolver.exportVariables(sessionId);
      expect(exported).toEqual(variables);
    });

    it('should count variables per session', () => {
      const sessionId = 'test-session';
      expect(variableResolver.getVariableCount(sessionId)).toBe(0);
      
      variableResolver.setVariable(sessionId, 'var1', 'value1');
      expect(variableResolver.getVariableCount(sessionId)).toBe(1);
      
      variableResolver.setVariable(sessionId, 'var2', 'value2');
      expect(variableResolver.getVariableCount(sessionId)).toBe(2);
    });

    it('should validate variable names', () => {
      const sessionId = 'test-session';
      
      // Valid names should work
      expect(() => variableResolver.setVariable(sessionId, 'valid_name', 'value')).not.toThrow();
      expect(() => variableResolver.setVariable(sessionId, 'valid-name', 'value')).not.toThrow();
      expect(() => variableResolver.setVariable(sessionId, '_underscore', 'value')).not.toThrow();
      expect(() => variableResolver.setVariable(sessionId, 'name123', 'value')).not.toThrow();
      
      // Invalid names should throw
      expect(() => variableResolver.setVariable(sessionId, '123invalid', 'value')).toThrow(/Invalid variable name/);
      expect(() => variableResolver.setVariable(sessionId, 'invalid space', 'value')).toThrow(/Invalid variable name/);
      expect(() => variableResolver.setVariable(sessionId, 'invalid@char', 'value')).toThrow(/Invalid variable name/);
    });

    it('should allow setting max nesting depth', () => {
      expect(() => variableResolver.setMaxNestingDepth(5)).not.toThrow();
      expect(() => variableResolver.setMaxNestingDepth(0)).toThrow(/must be at least 1/);
      expect(() => variableResolver.setMaxNestingDepth(-1)).toThrow(/must be at least 1/);
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide comprehensive statistics', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      const session3 = 'session-3';
      
      // Session 1: 2 variables
      variableResolver.setVariable(session1, 'var1', 'value1');
      variableResolver.setVariable(session1, 'var2', 'value2');
      
      // Session 2: 1 variable
      variableResolver.setVariable(session2, 'varA', 'valueA');
      
      // Session 3: 0 variables (empty session created via getVariable call)
      variableResolver.getVariable(session3, 'non-existent');
      
      const stats = variableResolver.getStatistics();
      
      expect(stats.totalSessions).toBe(3);
      expect(stats.totalVariables).toBe(3);
      expect(stats.sessionsWithVariables).toBe(2);
      expect(stats.averageVariablesPerSession).toBe(1);
    });
  });
});
