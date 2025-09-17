/**
 * Jest setup file
 * Global test setup and configuration
 */

// Increase test timeout for complex integration tests
jest.setTimeout(30000);

// Mock console methods to reduce test noise
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Setup global test environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Global cleanup
afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});
