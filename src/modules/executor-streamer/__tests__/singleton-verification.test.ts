/**
 * Integration test to verify ExecutorStreamer singleton pattern
 * across different modules (StepProcessor and API)
 */

import getExecutorStreamer from '@/modules/executor-streamer';
import { StepProcessor } from '@/modules/step-processor';

describe('ExecutorStreamer Singleton Verification', () => {
  beforeEach(async () => {
    // Reset singleton for clean test
    const { ExecutorStreamer } = await import('@/modules/executor-streamer');
    (ExecutorStreamer as any).resetInstance();
  });

  afterEach(async () => {
    // Clean up after each test
    const { ExecutorStreamer } = await import('@/modules/executor-streamer');
    (ExecutorStreamer as any).resetInstance();
  });

  it('should ensure StepProcessor and API use the same ExecutorStreamer instance', () => {
    // Simulate API getting ExecutorStreamer instance
    const apiInstance = getExecutorStreamer();
    const apiInstanceId = (apiInstance as any).getInstanceId();
    
    // Simulate StepProcessor getting ExecutorStreamer instance
    const stepProcessor = StepProcessor.getInstance({ enableLogging: false });
    const stepProcessorInstance = (stepProcessor as any).executorStreamer;
    const stepProcessorInstanceId = (stepProcessorInstance as any).getInstanceId();
    
    // Verify they're the same instance
    expect(apiInstance).toBe(stepProcessorInstance);
    expect(apiInstanceId).toBe(stepProcessorInstanceId);
    
    console.log(`✅ Both API and StepProcessor use ExecutorStreamer instance #${apiInstanceId}`);
  });

  it('should maintain singleton pattern across multiple calls', () => {
    const instance1 = getExecutorStreamer();
    const instance2 = getExecutorStreamer();
    const instance3 = getExecutorStreamer();
    
    const id1 = (instance1 as any).getInstanceId();
    const id2 = (instance2 as any).getInstanceId();
    const id3 = (instance3 as any).getInstanceId();
    
    // All should be the same instance
    expect(instance1).toBe(instance2);
    expect(instance2).toBe(instance3);
    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
    
    console.log(`✅ All calls return the same ExecutorStreamer instance #${id1}`);
  });

  it('should track instance creation and usage correctly', () => {
    // Get fresh instances in same test context
    const instance1 = getExecutorStreamer();
    const instance2 = getExecutorStreamer();
    
    const id1 = (instance1 as any).getInstanceId();
    const id2 = (instance2 as any).getInstanceId();
    
    // Should be the same instance and same ID within the test
    expect(instance1).toBe(instance2);
    expect(id1).toBe(id2);
    
    console.log(`✅ Instance tracking works correctly - both return instance #${id1}`);
  });
});
