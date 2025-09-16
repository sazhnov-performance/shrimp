/**
 * Playwright Mock for Testing
 * Provides mock implementations of Playwright browser automation
 */

import { jest } from '@jest/globals';

// Mock Browser interface
export const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn(),
  isConnected: jest.fn(() => true),
  contexts: jest.fn(() => []),
  newContext: jest.fn(),
  version: jest.fn(() => '1.0.0'),
};

// Mock Page interface
export const mockPage = {
  goto: jest.fn(),
  click: jest.fn(),
  fill: jest.fn(),
  textContent: jest.fn(),
  innerHTML: jest.fn(),
  screenshot: jest.fn(),
  close: jest.fn(),
  url: jest.fn(() => 'https://example.com'),
  title: jest.fn(() => 'Test Page'),
  waitForLoadState: jest.fn(),
  waitForSelector: jest.fn(),
  locator: jest.fn(() => ({
    click: jest.fn(),
    fill: jest.fn(),
    textContent: jest.fn(),
    isVisible: jest.fn(() => true),
    isEnabled: jest.fn(() => true),
  })),
  evaluate: jest.fn(),
};

// Mock browser launch functions
export const chromium = {
  launch: jest.fn(() => Promise.resolve(mockBrowser)),
};

export const firefox = {
  launch: jest.fn(() => Promise.resolve(mockBrowser)),
};

export const webkit = {
  launch: jest.fn(() => Promise.resolve(mockBrowser)),
};

// Reset all mocks function
export const resetPlaywrightMocks = () => {
  jest.clearAllMocks();
  
  // Set default implementations
  mockBrowser.newPage.mockResolvedValue(mockPage);
  mockBrowser.close.mockResolvedValue(undefined);
  mockPage.goto.mockResolvedValue(null);
  mockPage.click.mockResolvedValue(undefined);
  mockPage.fill.mockResolvedValue(undefined);
  mockPage.textContent.mockResolvedValue('test content');
  mockPage.innerHTML.mockResolvedValue('<html><body>test</body></html>');
  mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot'));
  mockPage.close.mockResolvedValue(undefined);
  mockPage.waitForLoadState.mockResolvedValue(undefined);
  mockPage.waitForSelector.mockResolvedValue(null);
  mockPage.evaluate.mockResolvedValue(null);
};

// Initialize mocks
resetPlaywrightMocks();
