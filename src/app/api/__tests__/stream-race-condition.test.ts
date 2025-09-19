/**
 * Integration test for stream race condition fix
 * Tests the scenario where SSE API connects before TaskLoop creates stream events
 */

import { NextRequest } from 'next/server';
import { GET } from '../stream/ws/[sessionId]/route';
import { ExecutorStreamer } from '@/modules/executor-streamer';

// Mock the ensure-initialized module
jest.mock('@/lib/ensure-initialized', () => ({
  ensureInitialized: jest.fn().mockResolvedValue(undefined)
}));

describe('Stream Race Condition Fix', () => {
  beforeEach(() => {
    // Reset singleton before each test
    (ExecutorStreamer as any).resetInstance();
  });

  afterEach(() => {
    // Clean up after each test
    (ExecutorStreamer as any).resetInstance();
  });

  it('should create stream if not found when SSE API connects', async () => {
    const sessionId = 'test-session-race-condition';
    
    // Create request
    const request = new NextRequest(`http://localhost:3000/api/stream/ws/${sessionId}`);
    const params = Promise.resolve({ sessionId });
    
    // Call the API endpoint
    const response = await GET(request, { params });
    
    // Should not return 404, should handle the missing stream gracefully
    expect(response.status).not.toBe(404);
    
    // Should return a streaming response
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should handle existing stream correctly', async () => {
    const sessionId = 'test-session-existing';
    
    // Pre-create the stream
    const executorStreamer = ExecutorStreamer.getInstance();
    await executorStreamer.createStream(sessionId);
    
    // Create request
    const request = new NextRequest(`http://localhost:3000/api/stream/ws/${sessionId}`);
    const params = Promise.resolve({ sessionId });
    
    // Call the API endpoint
    const response = await GET(request, { params });
    
    // Should return streaming response
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should handle stream creation failure gracefully', async () => {
    const sessionId = 'test-session-failure';
    
    // Mock createStream to fail
    const executorStreamer = ExecutorStreamer.getInstance();
    const originalCreateStream = executorStreamer.createStream;
    const originalStreamExists = executorStreamer.streamExists;
    
    // Make createStream fail and streamExists return false
    (executorStreamer as any).createStream = jest.fn().mockRejectedValue(new Error('Stream creation failed'));
    (executorStreamer as any).streamExists = jest.fn().mockReturnValue(false);
    
    // Create request
    const request = new NextRequest(`http://localhost:3000/api/stream/ws/${sessionId}`);
    const params = Promise.resolve({ sessionId });
    
    // Call the API endpoint
    const response = await GET(request, { params });
    
    // Should return 500 error
    expect(response.status).toBe(500);
    
    // Restore original methods
    (executorStreamer as any).createStream = originalCreateStream;
    (executorStreamer as any).streamExists = originalStreamExists;
  });

  it('should handle race condition where stream is created by another process', async () => {
    const sessionId = 'test-session-race';
    
    const executorStreamer = ExecutorStreamer.getInstance();
    const originalCreateStream = executorStreamer.createStream;
    
    // Make createStream fail but streamExists return true (simulating race condition)
    let createStreamCallCount = 0;
    (executorStreamer as any).createStream = jest.fn().mockImplementation(() => {
      createStreamCallCount++;
      if (createStreamCallCount === 1) {
        throw new Error('Stream already exists');
      }
      return originalCreateStream.call(executorStreamer, sessionId);
    });
    
    (executorStreamer as any).streamExists = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);
    
    // Create request
    const request = new NextRequest(`http://localhost:3000/api/stream/ws/${sessionId}`);
    const params = Promise.resolve({ sessionId });
    
    // Call the API endpoint
    const response = await GET(request, { params });
    
    // Should handle race condition and return streaming response
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    
    // Restore original method
    (executorStreamer as any).createStream = originalCreateStream;
  });
});
