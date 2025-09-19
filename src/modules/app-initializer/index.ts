/**
 * Application Initializer
 * Centralized singleton initialization system for the application
 */

import { 
  IAppInitializer, 
  InitializationStatus, 
  ModuleInitializer, 
  AppConfig, 
  EnvironmentConfig,
  InitializationError,
  ConfigurationError,
  InitializationPhase 
} from './types';

// Lazy imports to avoid Node.js API loading in Edge Runtime
// These will only be imported when actually initializing

export class AppInitializer implements IAppInitializer {
  private static instance: AppInitializer | null = null;
  private status: InitializationStatus;
  private config: AppConfig;
  private moduleInitializers: Map<string, ModuleInitializer>;
  private initializedModules: Set<string> = new Set();

  private constructor(config: AppConfig) {
    this.config = config;
    this.status = {
      phase: 'idle',
      modules: {},
      startTime: undefined,
      endTime: undefined
    };
    this.moduleInitializers = new Map();
    this.setupModuleInitializers();
  }

  /**
   * Get singleton instance of AppInitializer
   */
  static getInstance(config?: AppConfig): AppInitializer {
    if (!AppInitializer.instance) {
      const defaultConfig: AppConfig = {
        environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
        enableLogging: process.env.NODE_ENV !== 'production',
        initializationTimeout: 30000 // 30 seconds
      };
      AppInitializer.instance = new AppInitializer(config || defaultConfig);
    }
    return AppInitializer.instance;
  }

  /**
   * Initialize all application modules in dependency order
   */
  async initialize(): Promise<void> {
    if (this.status.phase === 'ready') {
      if (this.config.enableLogging) {
        console.log('[AppInitializer] Already initialized, skipping...');
      }
      return;
    }

    if (this.status.phase === 'initializing') {
      throw new InitializationError('Initialization already in progress');
    }

    this.status.startTime = new Date();
    this.status.phase = 'configuring';
    this.status.errors = [];

    try {
      // Phase 1: Validate configuration
      await this.validateConfiguration();
      
      // Phase 2: Initialize modules in dependency order
      this.status.phase = 'initializing';
      await this.initializeModulesInOrder();
      
      // Phase 3: Perform health checks
      if (!this.config.skipHealthChecks) {
        await this.performHealthChecks();
      }
      
      // Mark as ready
      this.status.phase = 'ready';
      this.status.endTime = new Date();
      this.status.totalInitTime = this.status.endTime.getTime() - this.status.startTime.getTime();
      
      if (this.config.enableLogging) {
        console.log('[AppInitializer] Initialization completed successfully', {
          totalTime: this.status.totalInitTime,
          modules: Object.keys(this.status.modules).length
        });
      }
    } catch (error) {
      this.status.phase = 'error';
      this.status.endTime = new Date();
      
      if (error instanceof Error) {
        this.status.errors?.push(error.message);
      }
      
      if (this.config.enableLogging) {
        console.error('[AppInitializer] Initialization failed:', error);
      }
      
      throw error;
    }
  }

  /**
   * Check if all modules are initialized
   */
  isInitialized(): boolean {
    return this.status.phase === 'ready';
  }

  /**
   * Get detailed initialization status
   */
  getInitializationStatus(): InitializationStatus {
    return { ...this.status };
  }

  /**
   * Gracefully shutdown all modules
   */
  async shutdown(): Promise<void> {
    this.status.phase = 'shutting_down';
    
    if (this.config.enableLogging) {
      console.log('[AppInitializer] Shutting down application...');
    }
    
    // Shutdown modules in reverse order
    const moduleIds = Array.from(this.moduleInitializers.keys()).reverse();
    
    for (const moduleId of moduleIds) {
      try {
        const initializer = this.moduleInitializers.get(moduleId);
        if (initializer?.reset) {
          await initializer.reset();
        }
        this.status.modules[moduleId] = { initialized: false };
        this.initializedModules.delete(moduleId);
      } catch (error) {
        if (this.config.enableLogging) {
          console.error(`[AppInitializer] Error shutting down ${moduleId}:`, error);
        }
      }
    }
    
    this.status.phase = 'idle';
    
    if (this.config.enableLogging) {
      console.log('[AppInitializer] Shutdown completed');
    }
  }

  /**
   * Reset initialization state (primarily for testing)
   */
  async reset(): Promise<void> {
    await this.shutdown();
    this.initializedModules.clear();
    AppInitializer.instance = null;
  }

  /**
   * Setup module initializers with dependency information
   */
  private setupModuleInitializers(): void {
    // Define module initialization order based on dependencies
    this.moduleInitializers.set('ai-context-manager', {
      moduleId: 'ai-context-manager',
      dependencies: [],
      initialize: async () => {
        const { AIContextManager } = await import('../ai-context-manager/ai-context-manager');
        AIContextManager.getInstance();
      },
      isInitialized: () => this.initializedModules.has('ai-context-manager')
    });

    this.moduleInitializers.set('ai-schema-manager', {
      moduleId: 'ai-schema-manager',
      dependencies: [],
      initialize: async () => {
        const AISchemaManager = (await import('../ai-schema-manager')).default;
        AISchemaManager.getInstance();
      },
      isInitialized: () => this.initializedModules.has('ai-schema-manager')
    });

    this.moduleInitializers.set('ai-prompt-manager', {
      moduleId: 'ai-prompt-manager',
      dependencies: [],
      initialize: async () => {
        const { AIPromptManager } = await import('../ai-prompt-manager');
        AIPromptManager.getInstance();
      },
      isInitialized: () => this.initializedModules.has('ai-prompt-manager')
    });

    this.moduleInitializers.set('ai-integration', {
      moduleId: 'ai-integration',
      dependencies: [],
      initialize: async () => {
        const { AIIntegrationManager } = await import('../ai-integration');
        const aiConfig = {
          apiKey: process.env.OPENAI_API_KEY || '',
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com/v1',
          logFilePath: './ai-requests.log'
        };
        AIIntegrationManager.getInstance(aiConfig);
      },
      isInitialized: () => this.initializedModules.has('ai-integration')
    });

    this.moduleInitializers.set('media-manager', {
      moduleId: 'media-manager',
      dependencies: [],
      initialize: async () => {
        const { MediaManager } = await import('../media-manager/media-manager');
        MediaManager.getInstance();
      },
      isInitialized: () => this.initializedModules.has('media-manager')
    });

    this.moduleInitializers.set('executor', {
      moduleId: 'executor',
      dependencies: [],
      initialize: async () => {
        const { Executor } = await import('../executor');
        Executor.getInstance();
      },
      isInitialized: () => this.initializedModules.has('executor')
    });

    this.moduleInitializers.set('executor-streamer', {
      moduleId: 'executor-streamer',
      dependencies: [],
      initialize: async () => {
        const getExecutorStreamer = (await import('../executor-streamer')).default;
        getExecutorStreamer();
      },
      isInitialized: () => this.initializedModules.has('executor-streamer')
    });

    this.moduleInitializers.set('task-loop', {
      moduleId: 'task-loop',
      dependencies: [
        'ai-context-manager',
        'ai-prompt-manager', 
        'ai-integration',
        'ai-schema-manager',
        'executor',
        'executor-streamer',
        'media-manager'
      ],
      initialize: async () => {
        const { TaskLoop } = await import('../task-loop');
        TaskLoop.getInstance();
      },
      isInitialized: () => this.initializedModules.has('task-loop')
    });
  }

  /**
   * Validate environment configuration
   */
  private async validateConfiguration(): Promise<void> {
    const requiredEnvVars: (keyof EnvironmentConfig)[] = [
      'OPENAI_API_KEY'
    ];
    
    const missingVars: string[] = [];
    
    for (const varName of requiredEnvVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }
    
    if (missingVars.length > 0) {
      throw new ConfigurationError(
        `Missing required environment variables: ${missingVars.join(', ')}`,
        missingVars
      );
    }
    
    if (this.config.enableLogging) {
      console.log('[AppInitializer] Configuration validation passed');
    }
  }

  /**
   * Initialize modules in dependency order
   */
  private async initializeModulesInOrder(): Promise<void> {
    const dependencyGraph = this.buildDependencyGraph();
    const initializationOrder = this.topologicalSort(dependencyGraph);
    
    if (this.config.enableLogging) {
      console.log('[AppInitializer] Module initialization order:', initializationOrder);
    }
    
    for (const moduleId of initializationOrder) {
      await this.initializeModule(moduleId);
    }
  }

  /**
   * Initialize a single module
   */
  private async initializeModule(moduleId: string): Promise<void> {
    const initializer = this.moduleInitializers.get(moduleId);
    if (!initializer) {
      throw new InitializationError(`Module initializer not found: ${moduleId}`);
    }

    const startTime = Date.now();
    
    try {
      if (this.config.enableLogging) {
        console.log(`[AppInitializer] Initializing ${moduleId}...`);
      }
      
      await Promise.race([
        initializer.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), this.config.initializationTimeout)
        )
      ]);
      
      const initTime = Date.now() - startTime;
      
      this.status.modules[moduleId] = {
        initialized: true,
        initTime,
        dependencies: initializer.dependencies
      };
      
      // Track successful initialization
      this.initializedModules.add(moduleId);
      
      if (this.config.enableLogging) {
        console.log(`[AppInitializer] ${moduleId} initialized in ${initTime}ms`);
      }
    } catch (error) {
      const initTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.status.modules[moduleId] = {
        initialized: false,
        error: errorMessage,
        initTime,
        dependencies: initializer.dependencies
      };
      
      throw new InitializationError(
        `Failed to initialize ${moduleId}: ${errorMessage}`,
        moduleId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Build dependency graph for modules
   */
  private buildDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const [moduleId, initializer] of this.moduleInitializers) {
      graph.set(moduleId, initializer.dependencies);
    }
    
    return graph;
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: string[] = [];
    
    const visit = (node: string) => {
      if (temp.has(node)) {
        throw new InitializationError(`Circular dependency detected involving ${node}`);
      }
      
      if (!visited.has(node)) {
        temp.add(node);
        
        const dependencies = graph.get(node) || [];
        for (const dep of dependencies) {
          visit(dep);
        }
        
        temp.delete(node);
        visited.add(node);
        result.unshift(node);
      }
    };
    
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        visit(node);
      }
    }
    
    return result;
  }

  /**
   * Perform health checks on initialized modules
   */
  private async performHealthChecks(): Promise<void> {
    if (this.config.enableLogging) {
      console.log('[AppInitializer] Performing health checks...');
    }
    
    for (const [moduleId, initializer] of this.moduleInitializers) {
      if (!initializer.isInitialized()) {
        throw new InitializationError(`Health check failed: ${moduleId} is not properly initialized`);
      }
    }
    
    if (this.config.enableLogging) {
      console.log('[AppInitializer] All health checks passed');
    }
  }
}

// Export types and main class
export * from './types';
export default AppInitializer;
