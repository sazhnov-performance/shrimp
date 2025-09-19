/**
 * Initialization Guard
 * Ensures the application is initialized before processing requests
 * This is designed to be used in API routes and components
 */

// No imports to avoid Node.js API loading on client-side

/**
 * Higher-order function that ensures initialization before executing a function
 * Use this to wrap API route handlers
 */
export function withInitialization<T extends (...args: unknown[]) => unknown>(
  handler: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Lazy import to avoid Node.js API loading
    const { initializeApp, isAppInitialized } = await import('./app-startup');
    
    if (!isAppInitialized()) {
      console.log('[InitGuard] Initializing application...');
      await initializeApp();
    }
    return handler(...args);
  };
}

/**
 * Ensures the app is initialized - can be called from components or API routes
 * This is safe to call multiple times
 * Only works server-side - client-side should use the React hook
 */
export async function ensureInitialized(): Promise<void> {
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    // Client-side - initialization happens via API calls
    return;
  }
  
  // Lazy import app-startup to avoid Node.js API loading
  const { initializeApp, isAppInitialized } = await import('./app-startup');
  
  if (!isAppInitialized()) {
    console.log('[InitGuard] Ensuring application is initialized...');
    await initializeApp();
  }
}

// Note: React hook was removed to avoid client-side import issues
// UI components should check initialization status via direct API calls
