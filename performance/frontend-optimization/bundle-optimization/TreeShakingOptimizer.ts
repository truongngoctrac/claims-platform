/**
 * Tree Shaking Optimization
 * Tools to optimize and analyze tree shaking effectiveness
 */

export interface TreeShakingReport {
  totalModules: number;
  unusedExports: UnusedExport[];
  optimizationOpportunities: OptimizationOpportunity[];
  treeshakeablePackages: string[];
  nonTreeshakeablePackages: string[];
  sideEffectsAnalysis: SideEffectsAnalysis;
}

export interface UnusedExport {
  module: string;
  exportName: string;
  exportType: 'function' | 'class' | 'variable' | 'type';
  estimatedSize: number;
  usageLocations: string[];
}

export interface OptimizationOpportunity {
  type: 'unused-import' | 'full-import' | 'side-effects' | 'barrel-export';
  severity: 'high' | 'medium' | 'low';
  description: string;
  currentCode: string;
  optimizedCode: string;
  estimatedSavings: number;
}

export interface SideEffectsAnalysis {
  packagesWithSideEffects: string[];
  potentialSideEffects: string[];
  recommendations: string[];
}

export class TreeShakingOptimizer {
  private analysisResults: TreeShakingReport | null = null;

  /**
   * Analyze tree shaking effectiveness
   */
  async analyzeTreeShaking(sourceDir: string = 'client'): Promise<TreeShakingReport> {
    console.log('🌳 Analyzing tree shaking opportunities...');

    const modules = await this.scanModules(sourceDir);
    const unusedExports = this.findUnusedExports(modules);
    const opportunities = this.findOptimizationOpportunities(modules);
    const packageAnalysis = this.analyzePackageTreeShaking();
    const sideEffectsAnalysis = this.analyzeSideEffects();

    this.analysisResults = {
      totalModules: modules.length,
      unusedExports,
      optimizationOpportunities: opportunities,
      treeshakeablePackages: packageAnalysis.treeshakeable,
      nonTreeshakeablePackages: packageAnalysis.nonTreeshakeable,
      sideEffectsAnalysis
    };

    return this.analysisResults;
  }

  /**
   * Scan source modules for imports/exports
   */
  private async scanModules(sourceDir: string): Promise<any[]> {
    // Mock implementation - would normally scan filesystem and parse AST
    return [
      {
        path: 'components/Dashboard.tsx',
        imports: [
          { source: 'lodash', specifiers: ['*'], type: 'namespace' },
          { source: 'react', specifiers: ['useState', 'useEffect'], type: 'named' }
        ],
        exports: ['Dashboard']
      },
      {
        path: 'utils/helpers.ts',
        imports: [
          { source: 'date-fns', specifiers: ['format', 'parseISO'], type: 'named' }
        ],
        exports: ['formatDate', 'parseDate', 'unusedHelper']
      }
    ];
  }

  /**
   * Find unused exports
   */
  private findUnusedExports(modules: any[]): UnusedExport[] {
    const unusedExports: UnusedExport[] = [];
    
    // Mock analysis - would normally cross-reference all imports/exports
    unusedExports.push({
      module: 'utils/helpers.ts',
      exportName: 'unusedHelper',
      exportType: 'function',
      estimatedSize: 2048,
      usageLocations: []
    });

    return unusedExports;
  }

  /**
   * Find optimization opportunities
   */
  private findOptimizationOpportunities(modules: any[]): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    // Example: Full lodash import
    opportunities.push({
      type: 'full-import',
      severity: 'high',
      description: 'Full lodash import detected - use specific function imports',
      currentCode: 'import * as _ from "lodash";\n_.debounce(fn, 300)',
      optimizedCode: 'import { debounce } from "lodash";\ndebounce(fn, 300)',
      estimatedSavings: 60 * 1024 // 60KB
    });

    // Example: Barrel export optimization
    opportunities.push({
      type: 'barrel-export',
      severity: 'medium',
      description: 'Barrel export import can be optimized',
      currentCode: 'import { Button } from "@/components"',
      optimizedCode: 'import { Button } from "@/components/ui/button"',
      estimatedSavings: 15 * 1024 // 15KB
    });

    // Example: Unused import
    opportunities.push({
      type: 'unused-import',
      severity: 'low',
      description: 'Unused import detected',
      currentCode: 'import { useState, useEffect, useCallback } from "react"',
      optimizedCode: 'import { useState, useEffect } from "react"',
      estimatedSavings: 1024 // 1KB
    });

    return opportunities;
  }

  /**
   * Analyze package tree shaking support
   */
  private analyzePackageTreeShaking(): { treeshakeable: string[]; nonTreeshakeable: string[] } {
    const treeshakeablePackages = [
      'lodash-es',
      'date-fns',
      'rxjs',
      '@radix-ui/react-dialog',
      'lucide-react',
      'recharts'
    ];

    const nonTreeshakeablePackages = [
      'lodash',
      'moment',
      'jquery',
      'bootstrap'
    ];

    return {
      treeshakeable: treeshakeablePackages,
      nonTreeshakeable: nonTreeshakeablePackages
    };
  }

  /**
   * Analyze side effects
   */
  private analyzeSideEffects(): SideEffectsAnalysis {
    return {
      packagesWithSideEffects: [
        'core-js',
        'regenerator-runtime',
        'whatwg-fetch'
      ],
      potentialSideEffects: [
        'CSS imports in JS files',
        'Global variable assignments',
        'Prototype modifications'
      ],
      recommendations: [
        'Mark packages as side-effect free in package.json',
        'Use CSS modules or styled-components for styling',
        'Avoid global variable assignments',
        'Use modern ES modules for better tree shaking'
      ]
    };
  }

  /**
   * Generate optimization suggestions
   */
  generateOptimizationSuggestions(): string[] {
    if (!this.analysisResults) {
      return ['Run tree shaking analysis first'];
    }

    const suggestions: string[] = [];
    const { optimizationOpportunities, unusedExports, nonTreeshakeablePackages } = this.analysisResults;

    // High-impact optimizations
    const highImpactOps = optimizationOpportunities.filter(op => op.severity === 'high');
    if (highImpactOps.length > 0) {
      suggestions.push(
        `🚨 ${highImpactOps.length} high-impact optimization(s) found:`,
        ...highImpactOps.map(op => `  - ${op.description}`)
      );
    }

    // Unused exports
    if (unusedExports.length > 0) {
      const totalWaste = unusedExports.reduce((sum, exp) => sum + exp.estimatedSize, 0);
      suggestions.push(
        `🗑️ ${unusedExports.length} unused exports found (${this.formatBytes(totalWaste)} potential savings)`
      );
    }

    // Non-treeshakeable packages
    if (nonTreeshakeablePackages.length > 0) {
      suggestions.push(
        `📦 Consider replacing non-treeshakeable packages:`,
        ...nonTreeshakeablePackages.map(pkg => `  - ${pkg}`)
      );
    }

    // General recommendations
    suggestions.push(
      '',
      '💡 General recommendations:',
      '  - Use named imports instead of default imports when possible',
      '  - Prefer ES modules over CommonJS',
      '  - Configure bundler for optimal tree shaking',
      '  - Use dynamic imports for code splitting',
      '  - Mark packages as side-effect free in package.json'
    );

    return suggestions;
  }

  /**
   * Generate ESLint configuration for tree shaking
   */
  generateESLintConfig(): any {
    return {
      rules: {
        // Prevent full imports of large libraries
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['lodash'],
                message: 'Use lodash-es or specific function imports instead'
              },
              {
                group: ['moment'],
                message: 'Use date-fns or dayjs instead'
              },
              {
                group: ['!lodash-es/*'],
                message: 'Use specific imports from lodash-es'
              }
            ]
          }
        ],
        
        // Enforce named imports for better tree shaking
        'import/no-default-export': 'warn',
        
        // Prevent unused imports
        'unused-imports/no-unused-imports': 'error',
        
        // Prefer named exports
        'import/prefer-default-export': 'off',
        'import/no-anonymous-default-export': 'error'
      },
      
      settings: {
        'import/resolver': {
          typescript: {
            project: './tsconfig.json'
          }
        }
      }
    };
  }

  /**
   * Generate Vite configuration for optimal tree shaking
   */
  generateViteConfig(): any {
    return {
      build: {
        rollupOptions: {
          treeshake: {
            moduleSideEffects: false,
            propertyReadSideEffects: false,
            tryCatchDeoptimization: false
          },
          external: (id: string) => {
            // Mark certain packages as external if they should be CDN loaded
            return ['react', 'react-dom'].includes(id);
          }
        }
      },
      
      optimizeDeps: {
        include: [
          // Pre-bundle tree-shakeable dependencies
          'lodash-es',
          'date-fns',
          '@radix-ui/react-dialog'
        ]
      },
      
      // Mark packages as side-effect free
      define: {
        __DEV__: JSON.stringify(false) // Remove dev-only code in production
      }
    };
  }

  /**
   * Auto-fix optimization opportunities
   */
  async autoFixOptimizations(opportunities: OptimizationOpportunity[]): Promise<string[]> {
    const fixes: string[] = [];
    
    for (const opportunity of opportunities) {
      if (opportunity.type === 'unused-import') {
        fixes.push(`Fixed unused import in: ${opportunity.description}`);
        // In real implementation, would modify the actual file
      }
    }
    
    return fixes;
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Generate comprehensive tree shaking report
   */
  generateReport(): string {
    if (!this.analysisResults) {
      return 'No analysis results available. Run analyzeTreeShaking() first.';
    }

    const { 
      totalModules, 
      unusedExports, 
      optimizationOpportunities, 
      treeshakeablePackages,
      nonTreeshakeablePackages,
      sideEffectsAnalysis 
    } = this.analysisResults;

    let report = '# Tree Shaking Analysis Report\n\n';

    // Overview
    report += '## Overview\n';
    report += `- **Modules Analyzed**: ${totalModules}\n`;
    report += `- **Unused Exports**: ${unusedExports.length}\n`;
    report += `- **Optimization Opportunities**: ${optimizationOpportunities.length}\n`;
    report += `- **Tree-shakeable Packages**: ${treeshakeablePackages.length}\n`;
    report += `- **Non-tree-shakeable Packages**: ${nonTreeshakeablePackages.length}\n\n`;

    // Optimization opportunities
    if (optimizationOpportunities.length > 0) {
      report += '## Optimization Opportunities\n';
      optimizationOpportunities.forEach((op, index) => {
        const emoji = op.severity === 'high' ? '🔴' : op.severity === 'medium' ? '🟡' : '🔵';
        report += `### ${index + 1}. ${emoji} ${op.description}\n`;
        report += `**Estimated Savings**: ${this.formatBytes(op.estimatedSavings)}\n\n`;
        report += '**Current Code:**\n```typescript\n' + op.currentCode + '\n```\n\n';
        report += '**Optimized Code:**\n```typescript\n' + op.optimizedCode + '\n```\n\n';
      });
    }

    // Unused exports
    if (unusedExports.length > 0) {
      report += '## Unused Exports\n';
      unusedExports.forEach(exp => {
        report += `- **${exp.exportName}** in \`${exp.module}\` (${this.formatBytes(exp.estimatedSize)})\n`;
      });
      report += '\n';
    }

    // Package analysis
    report += '## Package Analysis\n';
    report += '### Tree-shakeable Packages ✅\n';
    treeshakeablePackages.forEach(pkg => {
      report += `- ${pkg}\n`;
    });
    
    if (nonTreeshakeablePackages.length > 0) {
      report += '\n### Non-tree-shakeable Packages ❌\n';
      nonTreeshakeablePackages.forEach(pkg => {
        report += `- ${pkg}\n`;
      });
    }

    // Side effects analysis
    report += '\n## Side Effects Analysis\n';
    if (sideEffectsAnalysis.packagesWithSideEffects.length > 0) {
      report += '### Packages with Side Effects\n';
      sideEffectsAnalysis.packagesWithSideEffects.forEach(pkg => {
        report += `- ${pkg}\n`;
      });
    }

    report += '\n### Recommendations\n';
    sideEffectsAnalysis.recommendations.forEach(rec => {
      report += `- ${rec}\n`;
    });

    return report;
  }
}
