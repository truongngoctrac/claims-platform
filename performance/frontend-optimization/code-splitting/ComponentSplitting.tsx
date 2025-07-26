/**
 * Component-Based Code Splitting
 * Smart splitting for heavy components and third-party libraries
 */

import React from 'react';
import { createLazyComponent, LazyLoader } from './LazyLoader';

/**
 * Heavy chart components - only loaded when needed
 */
export const LazyRecharts = createLazyComponent(
  () => import('recharts').then(module => ({ default: module })),
  { preload: false, retryAttempts: 2 }
);

export const LazyChartJS = createLazyComponent(
  () => import('chart.js/auto').then(module => ({ default: module })),
  { preload: false, retryAttempts: 2 }
);

/**
 * Heavy UI components
 */
export const LazyDataTable = createLazyComponent(
  () => import('../../../client/components/ui/data-table'),
  { preload: false, retryAttempts: 2 }
);

export const LazyDatePicker = createLazyComponent(
  () => import('../../../client/components/ui/calendar'),
  { preload: false, retryAttempts: 2 }
);

export const LazyRichTextEditor = createLazyComponent(
  () => import('../../../client/components/ui/rich-text-editor'),
  { preload: false, retryAttempts: 2 }
);

/**
 * 3D and Canvas components
 */
export const LazyThreeJSCanvas = createLazyComponent(
  () => import('@react-three/fiber').then(module => ({ default: module.Canvas })),
  { preload: false, retryAttempts: 1 }
);

export const LazyCanvasSignature = createLazyComponent(
  () => import('react-signature-canvas'),
  { preload: false, retryAttempts: 2 }
);

/**
 * PDF and Document viewers
 */
export const LazyPDFViewer = createLazyComponent(
  () => import('react-pdf'),
  { preload: false, retryAttempts: 2 }
);

/**
 * Analytics and Dashboard components
 */
export const LazyAnalyticsChart = createLazyComponent(
  () => import('../../../client/components/admin/AnalyticsDashboard'),
  { preload: false, retryAttempts: 2 }
);

/**
 * Component splitting strategies
 */
export enum SplittingStrategy {
  IMMEDIATE = 'immediate',
  ON_DEMAND = 'on_demand',
  ON_INTERACTION = 'on_interaction',
  ON_VIEWPORT = 'on_viewport',
  CONDITIONAL = 'conditional'
}

interface SplitComponentProps {
  strategy: SplittingStrategy;
  condition?: () => boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Intelligent component splitter
 */
export const SplitComponent: React.FC<SplitComponentProps> = ({
  strategy,
  condition,
  fallback,
  children
}) => {
  const [shouldLoad, setShouldLoad] = React.useState(
    strategy === SplittingStrategy.IMMEDIATE
  );
  const [isVisible, setIsVisible] = React.useState(false);
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    switch (strategy) {
      case SplittingStrategy.CONDITIONAL:
        if (condition && condition()) {
          setShouldLoad(true);
        }
        break;

      case SplittingStrategy.ON_VIEWPORT:
        if (elementRef.current && 'IntersectionObserver' in window) {
          const observer = new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting && !isVisible) {
                setIsVisible(true);
                setShouldLoad(true);
                observer.disconnect();
              }
            },
            { threshold: 0.1 }
          );

          observer.observe(elementRef.current);
          return () => observer.disconnect();
        }
        break;

      case SplittingStrategy.ON_INTERACTION:
        // Will be triggered by user interaction handlers
        break;

      default:
        setShouldLoad(true);
    }
  }, [strategy, condition, isVisible]);

  const handleInteraction = () => {
    if (strategy === SplittingStrategy.ON_INTERACTION) {
      setShouldLoad(true);
    }
  };

  if (!shouldLoad) {
    return (
      <div
        ref={elementRef}
        onClick={handleInteraction}
        onMouseEnter={handleInteraction}
        onFocus={handleInteraction}
      >
        {fallback || (
          <div className="flex items-center justify-center p-4 border border-dashed border-muted-foreground/30 rounded-md">
            <span className="text-muted-foreground text-sm">Click to load component</span>
          </div>
        )}
      </div>
    );
  }

  return <div ref={elementRef}>{children}</div>;
};

/**
 * Heavy component wrappers with smart loading
 */
export const SmartChart: React.FC<{
  type: 'recharts' | 'chartjs';
  data: any;
  config?: any;
}> = ({ type, data, config }) => {
  return (
    <SplitComponent
      strategy={SplittingStrategy.ON_VIEWPORT}
      fallback={
        <div className="w-full h-64 bg-muted rounded-md flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse w-16 h-16 bg-muted-foreground/20 rounded mx-auto mb-2"></div>
            <p className="text-muted-foreground text-sm">Loading chart...</p>
          </div>
        </div>
      }
    >
      <LazyLoader>
        {type === 'recharts' ? (
          <LazyRecharts data={data} config={config} />
        ) : (
          <LazyChartJS data={data} config={config} />
        )}
      </LazyLoader>
    </SplitComponent>
  );
};

export const SmartDataTable: React.FC<{
  data: any[];
  columns: any[];
  pageSize?: number;
}> = ({ data, columns, pageSize = 10 }) => {
  return (
    <SplitComponent
      strategy={SplittingStrategy.ON_VIEWPORT}
      fallback={
        <div className="w-full border rounded-md">
          <div className="p-4 border-b bg-muted/50">
            <div className="h-4 bg-muted-foreground/20 rounded animate-pulse"></div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border-b">
              <div className="h-4 bg-muted-foreground/10 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      }
    >
      <LazyLoader>
        <LazyDataTable data={data} columns={columns} pageSize={pageSize} />
      </LazyLoader>
    </SplitComponent>
  );
};

export const SmartPDFViewer: React.FC<{
  file: string | File;
  numPages?: number;
}> = ({ file, numPages }) => {
  return (
    <SplitComponent
      strategy={SplittingStrategy.ON_INTERACTION}
      fallback={
        <div className="w-full h-96 border-2 border-dashed border-muted-foreground/30 rounded-md flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-muted-foreground">Click to load PDF viewer</p>
          </div>
        </div>
      }
    >
      <LazyLoader>
        <LazyPDFViewer file={file} numPages={numPages} />
      </LazyLoader>
    </SplitComponent>
  );
};

/**
 * Bundle size tracking utility
 */
export class ComponentBundleTracker {
  private static loadedComponents = new Set<string>();
  private static loadTimes = new Map<string, number>();

  static trackComponentLoad(componentName: string): void {
    if (!this.loadedComponents.has(componentName)) {
      this.loadedComponents.add(componentName);
      this.loadTimes.set(componentName, Date.now());
      
      // Send analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'component_lazy_loaded', {
          component_name: componentName,
          custom_parameter: 'code_splitting'
        });
      }
    }
  }

  static getLoadedComponents(): string[] {
    return Array.from(this.loadedComponents);
  }

  static getComponentLoadTime(componentName: string): number | undefined {
    return this.loadTimes.get(componentName);
  }

  static generateReport(): any {
    return {
      loadedComponents: this.getLoadedComponents(),
      loadTimes: Object.fromEntries(this.loadTimes),
      totalComponents: this.loadedComponents.size
    };
  }
}
