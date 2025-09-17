/**
 * Frontend API Unit Tests
 * Tests for the execute and streaming endpoints
 */

import { NextRequest } from 'next/server';
import { POST as executePost } from '../automation/execute/route';
import { GET as streamGet } from '../stream/ws/[sessionId]/route';
import { StepProcessor } from '@/modules/step-processor';
import getExecutorStreamer from '@/modules/executor-streamer';

// Mock the modules
jest.mock('@/modules/step-processor');
jest.mock('@/modules/executor-streamer');

const mockStepProcessor = StepProcessor as jest.MockedClass<typeof StepProcessor>;
const mockExecutorStreamer = getExecutorStreamer as jest.MockedFunction<typeof getExecutorStreamer>;

describe('Frontend API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/automation/execute', () => {
    it('should execute steps and return session ID', async () => {
      // Mock step processor
      const mockProcessSteps = jest.fn().mockResolvedValue('session-test-123');
      const mockGetInstance = jest.fn().mockReturnValue({
        processSteps: mockProcessSteps
      });
      mockStepProcessor.getInstance = mockGetInstance;

      // Create request
      const request = new NextRequest('http://localhost:3000/api/automation/execute', {
        method: 'POST',
        body: JSON.stringify({
          steps: ['Open google.com', 'Search for automation']
        })
      });

      // Call endpoint
      const response = await executePost(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('session-test-123');
      expect(data.status).toBe('started');
      expect(data.message).toBe('Automation execution started');
      expect(mockGetInstance).toHaveBeenCalled();
      expect(mockProcessSteps).toHaveBeenCalledWith(['Open google.com', 'Search for automation']);
    });

    it('should return 400 for empty steps array', async () => {
      const request = new NextRequest('http://localhost:3000/api/automation/execute', {
        method: 'POST',
        body: JSON.stringify({
          steps: []
        })
      });

      const response = await executePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid Request');
      expect(data.message).toBe('Steps array is required and must not be empty');
    });

    it('should return 400 for missing steps', async () => {
      const request = new NextRequest('http://localhost:3000/api/automation/execute', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await executePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid Request');
      expect(data.message).toBe('Steps array is required and must not be empty');
    });

    it('should return 400 for non-string steps', async () => {
      const request = new NextRequest('http://localhost:3000/api/automation/execute', {
        method: 'POST',
        body: JSON.stringify({
          steps: ['Valid step', 123, 'Another valid step']
        })
      });

      const response = await executePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid Request');
      expect(data.message).toBe('All steps must be non-empty strings');
    });

    it('should return 400 for empty string steps', async () => {
      const request = new NextRequest('http://localhost:3000/api/automation/execute', {
        method: 'POST',
        body: JSON.stringify({
          steps: ['Valid step', '', 'Another valid step']
        })
      });

      const response = await executePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid Request');
      expect(data.message).toBe('All steps must be non-empty strings');
    });

    it('should return 500 when step processor throws error', async () => {
      const mockProcessSteps = jest.fn().mockRejectedValue(new Error('Processing failed'));
      const mockGetInstance = jest.fn().mockReturnValue({
        processSteps: mockProcessSteps
      });
      mockStepProcessor.getInstance = mockGetInstance;

      const request = new NextRequest('http://localhost:3000/api/automation/execute', {
        method: 'POST',
        body: JSON.stringify({
          steps: ['Valid step']
        })
      });

      const response = await executePost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Execution Failed');
      expect(data.message).toBe('Processing failed');
    });
  });

  describe('GET /api/stream/ws/[sessionId]', () => {
    it('should return 400 for missing session ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream/ws/', {
        method: 'GET'
      });

      const response = await streamGet(request, { params: { sessionId: '' } });
      expect(response.status).toBe(400);
    });

    it('should return 404 when stream does not exist', async () => {
      const mockStreamer = {
        getEvents: jest.fn().mockRejectedValue(new Error('Stream not found'))
      };
      mockExecutorStreamer.mockReturnValue(mockStreamer as any);

      const request = new NextRequest('http://localhost:3000/api/stream/ws/nonexistent', {
        method: 'GET'
      });

      const response = await streamGet(request, { params: { sessionId: 'nonexistent' } });
      expect(response.status).toBe(404);
    });

    it('should return SSE stream when session exists', async () => {
      const mockStreamer = {
        getEvents: jest.fn().mockResolvedValue(['event1', 'event2']),
        extractLastEvent: jest.fn().mockResolvedValue('latest event')
      };
      mockExecutorStreamer.mockReturnValue(mockStreamer as any);

      const request = new NextRequest('http://localhost:3000/api/stream/ws/valid-session', {
        method: 'GET'
      });

      const response = await streamGet(request, { params: { sessionId: 'valid-session' } });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(mockStreamer.getEvents).toHaveBeenCalledWith('valid-session');
    });

    it('should handle streamer errors gracefully', async () => {
      const mockStreamer = {
        getEvents: jest.fn().mockResolvedValue([]),
        extractLastEvent: jest.fn().mockRejectedValue(new Error('Streamer error'))
      };
      mockExecutorStreamer.mockReturnValue(mockStreamer as any);

      const request = new NextRequest('http://localhost:3000/api/stream/ws/error-session', {
        method: 'GET'
      });

      const response = await streamGet(request, { params: { sessionId: 'error-session' } });
      
      // Should still return 200 because the stream exists, errors are handled within the stream
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });
  });
});
