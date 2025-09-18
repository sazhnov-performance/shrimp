/**
 * Application Initialization Types
 * Defines types for centralized singleton initialization system
 */

export interface IAppInitializer {
  /**
   * Initialize all application modules in dependency order
   */
  initialize(): Promise<void>;
  
  /**
   * Check if all modules are initialized
   */
  isInitialized(): boolean;
  
  /**
   * Get detailed initialization status
   */
  getInitializationStatus(): InitializationStatus;
  
  /**
   * Gracefully shutdown all modules
   */
  shutdown(): Promise<void>;
  
  /**
   * Reset initialization state (primarily for testing)
   */
  reset(): Promise<void>;
}

export interface InitializationStatus {
  phase: InitializationPhase;
  modules: Record<string, ModuleStatus>;
  errors?: string[];
  totalInitTime?: number;
  startTime?: Date;
  endTime?: Date;
}

export type InitializationPhase = 
  | 'idle'
  | 'configuring' 
  | 'initializing' 
  | 'ready' 
  | 'error'
  | 'shutting_down';

export interface ModuleStatus {
  initialized: boolean;
  error?: string;
  initTime?: number;
  dependencies?: string[];
}

export interface ModuleInitializer {
  moduleId: string;
  dependencies: string[];
  initialize(): Promise<void>;
  isInitialized(): boolean;
  reset?(): Promise<void>;
}

export interface AppConfig {
  environment: 'development' | 'production' | 'test';
  enableLogging: boolean;
  skipHealthChecks?: boolean;
  initializationTimeout?: number;
}

export interface EnvironmentConfig {
  OPENAI_API_KEY?: string;
  NODE_ENV?: string;
  // Add other required environment variables
}

export class InitializationError extends Error {
  constructor(
    message: string,
    public moduleId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'InitializationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public missingKeys?: string[]) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
