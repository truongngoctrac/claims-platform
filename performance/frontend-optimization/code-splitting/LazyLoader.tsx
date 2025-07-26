/**
 * Lazy Loading Component with Enhanced Error Handling and Loading States
 */

import React, { Suspense, lazy, ComponentType, LazyExoticComponent } from 'react';
import { ErrorBoundary } from '../../../client/components/ErrorBoundary';

interface LazyLoaderProps {
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  retryAttempts?: number;
  retryDelay?: number;
}

interface LazyComponentOptions {
  retryAttempts?: number;
  retryDelay?: number;
  preload?: boolean;
}

/**
 * Enhanced lazy component loader with retry mechanism
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): LazyExoticComponent<T> {
  const { retryAttempts = 3, retryDelay = 1000, preload = false } = options;

  const lazyComponent = lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      let attempts = 0;

      const loadComponent = async () => {
        try {
          const module = await importFunction();
          resolve(module);
        } catch (error) {
          attempts++;
          if (attempts < retryAttempts) {
            console.warn(`Lazy loading failed, retrying (${attempts}/${retryAttempts})...`);
            setTimeout(loadComponent, retryDelay);
          } else {
            console.error('Lazy loading failed after all retry attempts:', error);
            reject(error);
          }
        }
      };

      loadComponent();
    });
  });

  // Preload component if specified
  if (preload && typeof window !== 'undefined') {
    // Preload after a short delay to not block initial rendering
    setTimeout(() => {
      importFunction().catch(() => {
        // Silently fail preload attempts
      });
    }, 100);
  }

  return lazyComponent;
}

/**
 * Default loading fallback component
 */
const DefaultLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    <span className="ml-2 text-muted-foreground">Loading...</span>
  </div>
);

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ 
  error, 
  resetError 
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="text-destructive mb-4">
      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold mb-2">Failed to load component</h3>
    <p className="text-muted-foreground mb-4 text-sm">
      {error.message || 'An unexpected error occurred'}
    </p>
    <button 
      onClick={resetError}
      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
    >
      Try Again
    </button>
  </div>
);

/**
 * LazyLoader wrapper component
 */
export const LazyLoader: React.FC<LazyLoaderProps & { children: React.ReactNode }> = ({
  children,
  fallback = <DefaultLoadingFallback />,
  errorFallback = DefaultErrorFallback,
  retryAttempts = 3,
  retryDelay = 1000
}) => {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

/**
 * Hook for preloading components
 */
export const usePreloadComponent = (
  importFunction: () => Promise<{ default: ComponentType<any> }>
) => {
  const preload = React.useCallback(() => {
    importFunction().catch(() => {
      // Silently handle preload failures
    });
  }, [importFunction]);

  return preload;
};

/**
 * Higher-order component for lazy loading with analytics
 */
export function withLazyLoading<T extends ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  componentName: string,
  options: LazyComponentOptions = {}
) {
  const LazyComponent = createLazyComponent(importFunction, options);

  const WrappedComponent: React.FC<React.ComponentProps<T>> = (props) => {
    React.useEffect(() => {
      // Track lazy component loading
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'lazy_component_loaded', {
          component_name: componentName,
          custom_parameter: 'performance_optimization'
        });
      }
    }, []);

    return (
      <LazyLoader>
        <LazyComponent {...props} />
      </LazyLoader>
    );
  };

  WrappedComponent.displayName = `LazyLoaded(${componentName})`;
  return WrappedComponent;
}
