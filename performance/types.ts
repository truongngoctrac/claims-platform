/**
 * Performance Optimization Types and Interfaces
 */

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  tti: number; // Time to Interactive
}

export interface PerformanceThresholds {
  fcp: number;
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
  tti: number;
}

export interface BundleAnalysisReport {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkInfo[];
  largestChunks: ChunkInfo[];
  duplicatedModules: string[];
}

export interface ChunkInfo {
  name: string;
  size: number;
  gzippedSize: number;
  modules: string[];
}

export interface ImageOptimizationConfig {
  formats: string[];
  quality: number;
  sizes: number[];
  placeholder: 'blur' | 'empty';
  loading: 'lazy' | 'eager';
}

export interface CacheConfig {
  staticAssets: number; // Cache duration in seconds
  apiResponses: number;
  images: number;
  fonts: number;
}

export interface CompressionConfig {
  gzip: boolean;
  brotli: boolean;
  threshold: number; // Minimum file size to compress
}

export interface FontOptimizationConfig {
  preload: string[];
  display: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  subsets: string[];
}

export interface ResourcePreloadConfig {
  criticalAssets: string[];
  preloadStrategy: 'aggressive' | 'conservative';
  modulePreload: boolean;
}

export interface PerformanceOptimizationConfig {
  imageOptimization: ImageOptimizationConfig;
  caching: CacheConfig;
  compression: CompressionConfig;
  fontOptimization: FontOptimizationConfig;
  resourcePreload: ResourcePreloadConfig;
  thresholds: PerformanceThresholds;
  monitoring: {
    enabled: boolean;
    reportingUrl: string;
    sampleRate: number;
  };
}

export interface MemoryLeakReport {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  leakIndicators: LeakIndicator[];
}

export interface LeakIndicator {
  type: 'dom-nodes' | 'event-listeners' | 'timers' | 'memory-growth';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

export interface ThirdPartyScript {
  src: string;
  strategy: 'defer' | 'async' | 'worker';
  priority: 'high' | 'low';
  conditions?: string[];
}

export interface ProgressiveLoadingConfig {
  threshold: number; // Distance from viewport to start loading
  placeholderStrategy: 'skeleton' | 'blur' | 'color';
  batchSize: number; // Number of items to load at once
}

export interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'custom';
  domains: string[];
  regions: string[];
  cacheRules: CacheRule[];
}

export interface CacheRule {
  pattern: string;
  duration: number;
  headers: Record<string, string>;
}

export interface CriticalCSSConfig {
  inlineThreshold: number; // Size in bytes
  above_the_fold_selectors: string[];
  ignore_selectors: string[];
}

export interface WebVitalsOptimizationConfig {
  lcp: {
    preloadHero: boolean;
    optimizeImages: boolean;
    removeRenderBlocking: boolean;
  };
  fid: {
    codesplitting: boolean;
    workerThreads: boolean;
    inputOptimization: boolean;
  };
  cls: {
    reserveSpace: boolean;
    fontDisplay: string;
    preventLayoutShifts: boolean;
  };
}
