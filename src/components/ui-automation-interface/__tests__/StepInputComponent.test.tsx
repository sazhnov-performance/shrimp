/**
 * Unit Tests for Step Input Component
 * Tests the step input textarea and execute button
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepInputComponent } from '../StepInputComponent';

describe('StepInputComponent', () => {
  const mockProps = {
    stepText: '',
    setStepText: jest.fn(),
    onExecute: jest.fn(),
    isExecuting: false,
    error: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders step input components', () => {
    render(<StepInputComponent {...mockProps} />);
    
    expect(screen.getByText('Automation Steps')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your automation steps/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GOOOO!/i })).toBeInTheDocument();
  });

  test('calls setStepText when input changes', () => {
    render(<StepInputComponent {...mockProps} />);
    
    const textarea = screen.getByPlaceholderText(/Enter your automation steps/);
    fireEvent.change(textarea, { target: { value: 'test input' } });
    
    expect(mockProps.setStepText).toHaveBeenCalledWith('test input');
  });

  test('disables button when stepText is empty', () => {
    render(<StepInputComponent {...mockProps} />);
    
    const button = screen.getByRole('button', { name: /GOOOO!/i });
    expect(button).toBeDisabled();
  });

  test('enables button when stepText is not empty', () => {
    const propsWithText = { ...mockProps, stepText: 'test steps' };
    render(<StepInputComponent {...propsWithText} />);
    
    const button = screen.getByRole('button', { name: /GOOOO!/i });
    expect(button).not.toBeDisabled();
  });

  test('shows executing state when isExecuting is true', () => {
    const executingProps = { ...mockProps, isExecuting: true };
    render(<StepInputComponent {...executingProps} />);
    
    expect(screen.getByText('EXECUTING...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('displays error message when error is provided', () => {
    const errorProps = { ...mockProps, error: 'Test error message' };
    render(<StepInputComponent {...errorProps} />);
    
    expect(screen.getByText('❌ Test error message')).toBeInTheDocument();
  });

  test('calls onExecute when button is clicked', () => {
    const propsWithText = { ...mockProps, stepText: 'test steps' };
    render(<StepInputComponent {...propsWithText} />);
    
    const button = screen.getByRole('button', { name: /GOOOO!/i });
    fireEvent.click(button);
    
    expect(mockProps.onExecute).toHaveBeenCalled();
  });

  test('calls onExecute when Ctrl+Enter is pressed', () => {
    const propsWithText = { ...mockProps, stepText: 'test steps' };
    render(<StepInputComponent {...propsWithText} />);
    
    const textarea = screen.getByPlaceholderText(/Enter your automation steps/);
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    expect(mockProps.onExecute).toHaveBeenCalled();
  });

  test('shows character count', () => {
    const propsWithText = { ...mockProps, stepText: 'hello' };
    render(<StepInputComponent {...propsWithText} />);
    
    expect(screen.getByText('5 chars')).toBeInTheDocument();
  });

  test('shows keyboard shortcut hint', () => {
    render(<StepInputComponent {...mockProps} />);
    
    expect(screen.getByText(/Ctrl \+ Enter/)).toBeInTheDocument();
  });
});
