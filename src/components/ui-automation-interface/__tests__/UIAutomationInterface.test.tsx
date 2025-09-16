/**
 * Unit Tests for UI Automation Interface
 * Tests the main automation interface component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UIAutomationInterface } from '../UIAutomationInterface';

// Mock the API integration
jest.mock('../api-integration', () => ({
  FrontendAPIIntegration: jest.fn().mockImplementation(() => ({
    onEvent: jest.fn(),
    onError: jest.fn(),
    executeSteps: jest.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: 'test-session-123',
        streamId: 'test-stream-456',
        initialStatus: 'ACTIVE',
        createdAt: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: 'test-request-789',
        version: '1.0.0',
        processingTimeMs: 100
      }
    }),
    connectToStream: jest.fn().mockResolvedValue({
      onclose: jest.fn(),
      onerror: jest.fn(),
      close: jest.fn()
    })
  })),
  buildExecuteRequest: jest.fn().mockReturnValue({
    steps: ['test step'],
    config: {}
  }),
  validateStepInput: jest.fn().mockReturnValue({ isValid: true })
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  onopen: jest.fn(),
  onmessage: jest.fn(),
  onclose: jest.fn(),
  onerror: jest.fn(),
  close: jest.fn(),
  send: jest.fn()
}));

describe('UIAutomationInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the main interface', () => {
    render(<UIAutomationInterface />);
    
    expect(screen.getByText('AI Automation Interface')).toBeInTheDocument();
    expect(screen.getByText('Describe what you want to automate in natural language')).toBeInTheDocument();
    expect(screen.getByText('Automation Steps')).toBeInTheDocument();
    expect(screen.getByText('Execution Log')).toBeInTheDocument();
  });

  test('displays step input component', () => {
    render(<UIAutomationInterface />);
    
    const textarea = screen.getByPlaceholderText(/Enter your automation steps/);
    expect(textarea).toBeInTheDocument();
    
    const goButton = screen.getByRole('button', { name: /GOOOO!/i });
    expect(goButton).toBeInTheDocument();
    expect(goButton).toBeDisabled(); // Should be disabled when empty
  });

  test('enables execute button when text is entered', () => {
    render(<UIAutomationInterface />);
    
    const textarea = screen.getByPlaceholderText(/Enter your automation steps/);
    const goButton = screen.getByRole('button', { name: /GOOOO!/i });
    
    fireEvent.change(textarea, { target: { value: 'Open https://example.com' } });
    
    expect(goButton).not.toBeDisabled();
  });

  test('displays streaming output component', () => {
    render(<UIAutomationInterface />);
    
    expect(screen.getByText('Execution Log')).toBeInTheDocument();
    expect(screen.getByText('Enter automation steps above and click GOOOO to start')).toBeInTheDocument();
  });

  test('shows connection status', () => {
    render(<UIAutomationInterface />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  test('keyboard shortcut hint is displayed', () => {
    render(<UIAutomationInterface />);
    
    expect(screen.getByText(/Ctrl \+ Enter/)).toBeInTheDocument();
  });

  test('validates empty input', () => {
    render(<UIAutomationInterface />);
    
    const goButton = screen.getByRole('button', { name: /GOOOO!/i });
    expect(goButton).toBeDisabled();
  });
});
