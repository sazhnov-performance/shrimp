/**
 * Playwright Mock for Jest Tests
 */

// Mock Browser interface
export const mockBrowser = {
  close: jest.fn(),
  contexts: jest.fn().mockReturnValue([]),
  isConnected: jest.fn().mockReturnValue(true),
  newContext: jest.fn(),
  newPage: jest.fn(),
  version: jest.fn().mockReturnValue('1.0.0')
};

// Mock Page interface
export const mockPage = {
  close: jest.fn(),
  click: jest.fn(),
  fill: jest.fn(),
  goto: jest.fn(),
  screenshot: jest.fn(),
  content: jest.fn().mockReturnValue('<html><body></body></html>'),
  locator: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
  title: jest.fn().mockReturnValue('Test Page'),
  url: jest.fn().mockReturnValue('https://example.com')
};

// Mock Browser Types
export const mockChromium = {
  launch: jest.fn().mockResolvedValue(mockBrowser)
};

export const mockFirefox = {
  launch: jest.fn().mockResolvedValue(mockBrowser)
};

export const mockWebkit = {
  launch: jest.fn().mockResolvedValue(mockBrowser)
};

// Export mocks
export const chromium = mockChromium;
export const firefox = mockFirefox;
export const webkit = mockWebkit;

// Export type interfaces (no implementation needed for mocks)
export interface Browser {
  close(): Promise<void>;
  contexts(): any[];
  isConnected(): boolean;
  newContext(options?: any): Promise<any>;
  newPage(): Promise<Page>;
  version(): string;
}

export interface Page {
  close(): Promise<void>;
  click(selector: string, options?: any): Promise<void>;
  fill(selector: string, value: string, options?: any): Promise<void>;
  goto(url: string, options?: any): Promise<any>;
  screenshot(options?: any): Promise<Buffer>;
  content(): Promise<string>;
  locator(selector: string): any;
  waitForSelector(selector: string, options?: any): Promise<any>;
  evaluate(pageFunction: Function | string, arg?: any): Promise<any>;
  title(): Promise<string>;
  url(): string;
}

export interface BrowserContext {
  close(): Promise<void>;
  newPage(): Promise<Page>;
}
