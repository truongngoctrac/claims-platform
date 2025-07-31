/**
 * Bundle Size Optimization and Analysis
 * Provides tools for analyzing and optimizing bundle sizes in the healthcare claims app
 */

export interface BundleStats {
  totalSize: number;
  chunks: ChunkInfo[];
  dependencies: DependencyInfo[];
  recommendations: BundleRecommendation[];
}

export interface ChunkInfo {
  name: string;
  size: number;
  gzipSize: number;
  brotliSize?: number;
  modules: ModuleInfo[];
  isAsync: boolean;
  isEntry: boolean;
}

export interface ModuleInfo {
  name: string;
  size: number;
  path: string;
  reasons: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  size: number;
  treeshakeable: boolean;
  alternatives?: string[];
}

export interface BundleRecommendation {
  type: 'size-reduction' | 'code-splitting' | 'dependency-optimization';
  severity: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  solution: string;
}

export class BundleAnalyzer {
  private stats: BundleStats | null = null;
  private readonly maxChunkSize = 250 * 1024; // 250KB
  private readonly maxTotalSize = 2 * 1024 * 1024; // 2MB

  /**
   * Analyze bundle from webpack/vite stats
   */
  async analyzeBundleStats(statsData: any): Promise<BundleStats> {
    const chunks = this.extractChunkInfo(statsData);
    const dependencies = this.extractDependencyInfo(statsData);
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

    this.stats = {
      totalSize,
      chunks,
      dependencies,
      recommendations: this.generateRecommendations(chunks, dependencies, totalSize)
    };

    return this.stats;
  }

  /**
   * Extract chunk information from build stats
   */
  private extractChunkInfo(statsData: any): ChunkInfo[] {
    if (!statsData.chunks) return [];

    return statsData.chunks.map((chunk: any) => ({
      name: chunk.name || `chunk-${chunk.id}`,
      size: chunk.size || 0,
      gzipSize: this.estimateGzipSize(chunk.size || 0),
      brotliSize: this.estimateBrotliSize(chunk.size || 0),
      modules: this.extractModuleInfo(chunk.modules || []),
      isAsync: !chunk.isEntrypoint,
      isEntry: chunk.isEntrypoint || false
    }));
  }

  /**
   * Extract dependency information
   */
  private extractDependencyInfo(statsData: any): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const packageJson = this.getPackageJsonInfo();

    if (packageJson.dependencies) {
      Object.entries(packageJson.dependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: version as string,
          size: this.estimateDependencySize(name),
          treeshakeable: this.isTreeshakeable(name),
          alternatives: this.getSmallerAlternatives(name)
        });
      });
    }

    return dependencies.sort((a, b) => b.size - a.size);
  }

  /**
   * Extract module information from chunk
   */
  private extractModuleInfo(modules: any[]): ModuleInfo[] {
    return modules.map(module => ({
      name: module.name || 'unknown',
      size: module.size || 0,
      path: module.identifier || '',
      reasons: module.reasons?.map((r: any) => r.moduleName || '') || []
    })).sort((a, b) => b.size - a.size);
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    chunks: ChunkInfo[], 
    dependencies: DependencyInfo[], 
    totalSize: number
  ): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];

    // Check total bundle size
    if (totalSize > this.maxTotalSize) {
      recommendations.push({
        type: 'size-reduction',
        severity: 'high',
        description: `Total bundle size (${this.formatSize(totalSize)}) exceeds recommended limit (${this.formatSize(this.maxTotalSize)})`,
        impact: 'Slower initial page load, poor performance on slow networks',
        solution: 'Consider code splitting, tree shaking, and removing unused dependencies'
      });
    }

    // Check large chunks
    chunks.forEach(chunk => {
      if (chunk.size > this.maxChunkSize && !chunk.isAsync) {
        recommendations.push({
          type: 'code-splitting',
          severity: 'medium',
          description: `Chunk "${chunk.name}" is ${this.formatSize(chunk.size)} - consider splitting`,
          impact: 'Delays initial render, affects LCP',
          solution: 'Split this chunk using dynamic imports or route-based splitting'
        });
      }
    });

    // Check large dependencies
    dependencies.forEach(dep => {
      if (dep.size > 100 * 1024) { // 100KB
        recommendations.push({
          type: 'dependency-optimization',
          severity: dep.size > 500 * 1024 ? 'high' : 'medium',
          description: `Large dependency: ${dep.name} (${this.formatSize(dep.size)})`,
          impact: 'Increases bundle size significantly',
          solution: dep.alternatives ? 
            `Consider alternatives: ${dep.alternatives.join(', ')}` :
            'Review if this dependency is necessary or can be replaced'
        });
      }
    });

    // Check for duplicate dependencies
    const duplicates = this.findDuplicateDependencies(dependencies);
    duplicates.forEach(dup => {
      recommendations.push({
        type: 'dependency-optimization',
        severity: 'medium',
        description: `Potential duplicate: ${dup.name} appears in multiple versions`,
        impact: 'Unnecessary bundle bloat',
        solution: 'Use yarn resolutions or npm overrides to force single version'
      });
    });

    return recommendations.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Estimate gzip compression size
   */
  private estimateGzipSize(originalSize: number): number {
    // Rough estimation: gzip typically reduces JS/CSS by 60-70%
    return Math.round(originalSize * 0.35);
  }

  /**
   * Estimate brotli compression size
   */
  private estimateBrotliSize(originalSize: number): number {
    // Brotli is typically 10-20% better than gzip
    return Math.round(originalSize * 0.28);
  }

  /**
   * Estimate dependency size (simplified)
   */
  private estimateDependencySize(name: string): number {
    // This would normally query bundlephobia API or use build-time analysis
    const knownSizes: Record<string, number> = {
      'react': 42 * 1024,
      'react-dom': 130 * 1024,
      'lodash': 70 * 1024,
      'moment': 67 * 1024,
      'rxjs': 180 * 1024,
      'axios': 15 * 1024,
      'chart.js': 200 * 1024
    };

    return knownSizes[name] || 10 * 1024; // Default 10KB
  }

  /**
   * Check if dependency supports tree shaking
   */
  private isTreeshakeable(name: string): boolean {
    const treeshakeableDeps = [
      'lodash-es', 'ramda', 'date-fns', 'rxjs', 'antd', '@mui/material'
    ];
    
    return treeshakeableDeps.includes(name) || name.includes('-es');
  }

  /**
   * Get smaller alternatives for common heavy dependencies
   */
  private getSmallerAlternatives(name: string): string[] | undefined {
    const alternatives: Record<string, string[]> = {
      'moment': ['date-fns', 'dayjs'],
      'lodash': ['lodash-es', 'ramda'],
      'axios': ['fetch', 'ky'],
      'jquery': ['modern-dom-utils'],
      'bootstrap': ['tailwindcss', 'bulma'],
      'material-ui': ['react-aria', 'chakra-ui']
    };

    return alternatives[name];
  }

  /**
   * Find duplicate dependencies
   */
  private findDuplicateDependencies(dependencies: DependencyInfo[]): DependencyInfo[] {
    const nameGroups = dependencies.reduce((groups, dep) => {
      const baseName = dep.name.split('@')[0];
      if (!groups[baseName]) groups[baseName] = [];
      groups[baseName].push(dep);
      return groups;
    }, {} as Record<string, DependencyInfo[]>);

    return Object.values(nameGroups)
      .filter(group => group.length > 1)
      .flat();
  }

  /**
   * Get package.json information (mock for now)
   */
  private getPackageJsonInfo(): any {
    // In real implementation, this would read actual package.json
    return {
      dependencies: {
        'react': '^18.3.1',
        'react-dom': '^18.3.1',
        'chart.js': '^4.5.0',
        'axios': '^1.11.0'
      }
    };
  }

  /**
   * Format size in human readable format
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Generate bundle report
   */
  generateReport(): string {
    if (!this.stats) {
      return 'No bundle analysis available. Run analyzeBundleStats() first.';
    }

    const { totalSize, chunks, dependencies, recommendations } = this.stats;

    let report = `# Bundle Analysis Report\n\n`;
    
    report += `## Overview\n`;
    report += `- **Total Size**: ${this.formatSize(totalSize)}\n`;
    report += `- **Gzipped**: ~${this.formatSize(this.estimateGzipSize(totalSize))}\n`;
    report += `- **Chunks**: ${chunks.length}\n`;
    report += `- **Dependencies**: ${dependencies.length}\n\n`;

    report += `## Largest Chunks\n`;
    chunks.slice(0, 5).forEach(chunk => {
      report += `- **${chunk.name}**: ${this.formatSize(chunk.size)} (${chunk.isAsync ? 'async' : 'sync'})\n`;
    });

    report += `\n## Largest Dependencies\n`;
    dependencies.slice(0, 10).forEach(dep => {
      report += `- **${dep.name}**: ${this.formatSize(dep.size)}${dep.treeshakeable ? ' 🌳' : ''}\n`;
    });

    if (recommendations.length > 0) {
      report += `\n## Recommendations\n`;
      recommendations.forEach((rec, index) => {
        const emoji = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🔵';
        report += `${index + 1}. ${emoji} **${rec.description}**\n`;
        report += `   - Impact: ${rec.impact}\n`;
        report += `   - Solution: ${rec.solution}\n\n`;
      });
    }

    return report;
  }
}

/**
 * Bundle optimization utilities
 */
export class BundleOptimizer {
  /**
   * Generate webpack/vite optimization config
   */
  static generateOptimizationConfig() {
    return {
      // Vite optimization
      vite: {
        build: {
          rollupOptions: {
            output: {
              manualChunks: {
                // Vendor chunks
                vendor: ['react', 'react-dom'],
                ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
                charts: ['chart.js', 'recharts'],
                utils: ['date-fns', 'lodash-es']
              }
            }
          },
          chunkSizeWarningLimit: 250
        }
      },
      
      // Tree shaking optimization
      treeshaking: {
        sideEffects: false,
        usedExports: true
      }
    };
  }

  /**
   * Generate import suggestions for tree shaking
   */
  static generateTreeShakingConfig() {
    return {
      // Examples of optimized imports
      examples: {
        'lodash': 'import debounce from "lodash/debounce"',
        'date-fns': 'import { format } from "date-fns"',
        'rxjs': 'import { map } from "rxjs/operators"'
      },
      
      // ESLint rules to enforce
      eslintRules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['lodash', 'lodash/*', '!lodash-es/*']
          }
        ]
      }
    };
  }
}
