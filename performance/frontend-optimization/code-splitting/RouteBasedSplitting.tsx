/**
 * Route-Based Code Splitting Implementation
 */

import React from 'react';
import { createLazyComponent, LazyLoader } from './LazyLoader';

/**
 * Lazy-loaded route components with optimized loading
 */

// Admin routes - only loaded when user has admin access
export const LazyAdminDashboard = createLazyComponent(
  () => import('../../../client/pages/admin/AdminDashboard'),
  { preload: false, retryAttempts: 2 }
);

export const LazyUserManagement = createLazyComponent(
  () => import('../../../client/components/admin/UserManagement'),
  { preload: false, retryAttempts: 2 }
);

export const LazySystemConfiguration = createLazyComponent(
  () => import('../../../client/components/admin/SystemConfiguration'),
  { preload: false, retryAttempts: 2 }
);

export const LazyAnalyticsDashboard = createLazyComponent(
  () => import('../../../client/components/admin/AnalyticsDashboard'),
  { preload: false, retryAttempts: 2 }
);

// Core application routes - preloaded for better UX
export const LazyDashboard = createLazyComponent(
  () => import('../../../client/pages/Dashboard'),
  { preload: true, retryAttempts: 3 }
);

export const LazyClaimSubmission = createLazyComponent(
  () => import('../../../client/pages/HealthcareClaimSubmission'),
  { preload: true, retryAttempts: 3 }
);

export const LazyClaimTracking = createLazyComponent(
  () => import('../../../client/pages/ClaimTracking'),
  { preload: true, retryAttempts: 3 }
);

export const LazyProfile = createLazyComponent(
  () => import('../../../client/pages/Profile'),
  { preload: false, retryAttempts: 2 }
);

export const LazySearchResults = createLazyComponent(
  () => import('../../../client/pages/SearchResults'),
  { preload: false, retryAttempts: 2 }
);

// Search components - loaded on demand
export const LazyAdvancedSearchInterface = createLazyComponent(
  () => import('../../../client/components/search/AdvancedSearchInterface'),
  { preload: false, retryAttempts: 2 }
);

export const LazySearchFilters = createLazyComponent(
  () => import('../../../client/components/search/SearchFilters'),
  { preload: false, retryAttempts: 2 }
);

/**
 * Route configuration with lazy loading
 */
export interface LazyRoute {
  path: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  preload?: boolean;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

export const lazyRoutes: LazyRoute[] = [
  {
    path: '/dashboard',
    component: LazyDashboard,
    preload: true,
    requiresAuth: true
  },
  {
    path: '/claims/submit',
    component: LazyClaimSubmission,
    preload: true,
    requiresAuth: true
  },
  {
    path: '/claims/track',
    component: LazyClaimTracking,
    preload: true,
    requiresAuth: true
  },
  {
    path: '/profile',
    component: LazyProfile,
    preload: false,
    requiresAuth: true
  },
  {
    path: '/search',
    component: LazySearchResults,
    preload: false,
    requiresAuth: true
  },
  {
    path: '/admin',
    component: LazyAdminDashboard,
    preload: false,
    requiresAuth: true,
    requiresAdmin: true
  },
  {
    path: '/admin/users',
    component: LazyUserManagement,
    preload: false,
    requiresAuth: true,
    requiresAdmin: true
  },
  {
    path: '/admin/system',
    component: LazySystemConfiguration,
    preload: false,
    requiresAuth: true,
    requiresAdmin: true
  },
  {
    path: '/admin/analytics',
    component: LazyAnalyticsDashboard,
    preload: false,
    requiresAuth: true,
    requiresAdmin: true
  }
];

/**
 * Route preloader utility
 */
export class RoutePreloader {
  private static preloadedRoutes = new Set<string>();

  static preloadRoute(path: string): void {
    if (this.preloadedRoutes.has(path)) return;

    const route = lazyRoutes.find(r => r.path === path);
    if (route && route.preload) {
      // Trigger component loading without rendering
      route.component._payload._result?.catch(() => {
        // Silently handle preload failures
      });
      this.preloadedRoutes.add(path);
    }
  }

  static preloadCriticalRoutes(): void {
    const criticalRoutes = lazyRoutes.filter(route => route.preload);
    criticalRoutes.forEach(route => {
      this.preloadRoute(route.path);
    });
  }

  static preloadOnHover(path: string): () => void {
    return () => {
      this.preloadRoute(path);
    };
  }

  static preloadOnVisible(path: string): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.preloadRoute(path);
          }
        });
      },
      { threshold: 0.1 }
    );
  }
}

/**
 * Smart Link component with preloading
 */
interface SmartLinkProps {
  to: string;
  children: React.ReactNode;
  preloadStrategy?: 'hover' | 'visible' | 'immediate' | 'none';
  className?: string;
}

export const SmartLink: React.FC<SmartLinkProps> = ({
  to,
  children,
  preloadStrategy = 'hover',
  className
}) => {
  const linkRef = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    if (preloadStrategy === 'immediate') {
      RoutePreloader.preloadRoute(to);
    } else if (preloadStrategy === 'visible' && linkRef.current) {
      const observer = RoutePreloader.preloadOnVisible(to);
      observer.observe(linkRef.current);
      
      return () => {
        observer.disconnect();
      };
    }
  }, [to, preloadStrategy]);

  const handleMouseEnter = () => {
    if (preloadStrategy === 'hover') {
      RoutePreloader.preloadRoute(to);
    }
  };

  return (
    <a
      ref={linkRef}
      href={to}
      className={className}
      onMouseEnter={handleMouseEnter}
      onClick={(e) => {
        e.preventDefault();
        // Handle navigation (integrate with your router)
        window.history.pushState({}, '', to);
      }}
    >
      {children}
    </a>
  );
};

/**
 * Lazy Route wrapper for React Router
 */
export const LazyRoute: React.FC<{ route: LazyRoute }> = ({ route }) => {
  const Component = route.component;

  return (
    <LazyLoader
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading page...</p>
          </div>
        </div>
      }
    >
      <Component />
    </LazyLoader>
  );
};
