/**
 * Jest Setup File
 * Global test configuration and mocks
 */

import { jest } from '@jest/globals';

// Mock console to reduce noise in tests unless specifically testing logging
global.console = {
  ...console,
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock setTimeout and clearTimeout for timer testing
jest.useFakeTimers();

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables
process.env.NODE_ENV = 'test';

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});
