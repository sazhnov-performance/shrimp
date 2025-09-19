/**
 * Application Startup Integration
 * Handles initialization of all singletons during Next.js app startup
 * This runs in Node.js runtime where Node.js APIs are available
 */

// Lazy import to avoid Node.js API loading during compilation

let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

/**
 * Initialize the application if not already initialized
 * This is safe to call multiple times - it will only initialize once
 */
export async function initializeApp(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const AppInitializer = (await import('../modules/app-initializer')).default;
      const initializer = AppInitializer.getInstance({
        environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
        enableLogging: process.env.NODE_ENV !== 'production',
        skipHealthChecks: process.env.NODE_ENV === 'test'
      });

      await initializer.initialize();
      isInitialized = true;
      
      console.log('[AppStartup] Application initialization completed successfully');
    } catch (error) {
      console.error('[AppStartup] Application initialization failed:', error);
      // Reset promise to allow retry
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Check if the application is initialized
 */
export function isAppInitialized(): boolean {
  return isInitialized;
}

/**
 * Get initialization status for debugging/monitoring
 */
export async function getInitializationStatus() {
  if (!isInitialized) {
    return null;
  }
  
  const AppInitializer = (await import('../modules/app-initializer')).default;
  const initializer = AppInitializer.getInstance();
  return initializer.getInitializationStatus();
}

/**
 * Gracefully shutdown the application
 */
export async function shutdownApp(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    const AppInitializer = (await import('../modules/app-initializer')).default;
    const initializer = AppInitializer.getInstance();
    await initializer.shutdown();
    isInitialized = false;
    initializationPromise = null;
    
    console.log('[AppStartup] Application shutdown completed');
  } catch (error) {
    console.error('[AppStartup] Application shutdown failed:', error);
    throw error;
  }
}
