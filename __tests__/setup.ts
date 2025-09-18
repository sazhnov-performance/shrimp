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

// Global cleanup after each test
afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});

// Global cleanup after all tests complete
afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Force cleanup of any remaining timers or intervals
  const timers = (global as any).setTimeout.__timers__ || [];
  timers.forEach((timer: any) => {
    if (timer) clearTimeout(timer);
  });
  
  const intervals = (global as any).setInterval.__timers__ || [];
  intervals.forEach((interval: any) => {
    if (interval) clearInterval(interval);
  });
  
  // Clean up singleton instances to prevent hanging
  try {
    // Reset ExecutorStreamer instance
    const { ExecutorStreamer } = await import('../src/modules/executor-streamer');
    if (ExecutorStreamer && (ExecutorStreamer as any).resetInstance) {
      (ExecutorStreamer as any).resetInstance();
    }
  } catch (error) {
    // Ignore import errors
  }
  
  try {
    // Reset Executor instance
    const { Executor } = await import('../src/modules/executor');
    if (Executor && (Executor as any).instance) {
      const instance = (Executor as any).instance;
      if (instance && instance.shutdown) {
        await instance.shutdown();
      }
      (Executor as any).instance = null;
    }
  } catch (error) {
    // Ignore import errors
  }
  
  // Give a short delay for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});
