/**
 * Real-time Bundle Size Monitoring
 * Watches bundle changes during development and provides alerts
 */

export interface BundleWatcherConfig {
  maxSizeIncrease: number; // Percentage
  alertThreshold: number; // Bytes
  checkInterval: number; // Milliseconds
  excludePatterns?: string[];
}

export interface BundleDiff {
  file: string;
  oldSize: number;
  newSize: number;
  difference: number;
  percentageChange: number;
  timestamp: Date;
}

export class BundleWatcher {
  private config: BundleWatcherConfig;
  private previousSizes: Map<string, number> = new Map();
  private isWatching = false;
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<BundleWatcherConfig> = {}) {
    this.config = {
      maxSizeIncrease: 10, // 10% increase triggers warning
      alertThreshold: 50 * 1024, // 50KB increase triggers alert
      checkInterval: 5000, // Check every 5 seconds
      excludePatterns: ['*.map', '*.hot-update.*'],
      ...config
    };
  }

  /**
   * Start watching bundle changes
   */
  startWatching(buildDir: string = 'dist'): void {
    if (this.isWatching) {
      console.warn('Bundle watcher is already running');
      return;
    }

    this.isWatching = true;
    console.log('🔍 Starting bundle size watcher...');

    // Initial scan
    this.scanBundles(buildDir);

    // Set up interval monitoring
    this.watchInterval = setInterval(() => {
      this.scanBundles(buildDir);
    }, this.config.checkInterval);
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.isWatching = false;
    console.log('🛑 Bundle watcher stopped');
  }

  /**
   * Scan bundle directory for changes
   */
  private async scanBundles(buildDir: string): Promise<BundleDiff[]> {
    const diffs: BundleDiff[] = [];
    
    try {
      // This would normally use fs to scan the build directory
      // For now, we'll simulate with some mock data
      const currentSizes = await this.getBundleSizes(buildDir);
      
      for (const [file, size] of currentSizes.entries()) {
        const previousSize = this.previousSizes.get(file);
        
        if (previousSize !== undefined) {
          const difference = size - previousSize;
          const percentageChange = ((difference / previousSize) * 100);
          
          if (Math.abs(difference) > 1024) { // Only track changes > 1KB
            const diff: BundleDiff = {
              file,
              oldSize: previousSize,
              newSize: size,
              difference,
              percentageChange,
              timestamp: new Date()
            };
            
            diffs.push(diff);
            this.handleSizeChange(diff);
          }
        }
        
        this.previousSizes.set(file, size);
      }
    } catch (error) {
      console.error('Error scanning bundles:', error);
    }
    
    return diffs;
  }

  /**
   * Get current bundle sizes
   */
  private async getBundleSizes(buildDir: string): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    
    // Mock implementation - would normally scan filesystem
    // This simulates finding JS/CSS bundles
    const mockBundles = [
      { name: 'main.js', size: 245 * 1024 },
      { name: 'vendor.js', size: 156 * 1024 },
      { name: 'runtime.js', size: 12 * 1024 },
      { name: 'styles.css', size: 45 * 1024 }
    ];
    
    mockBundles.forEach(bundle => {
      sizes.set(bundle.name, bundle.size);
    });
    
    return sizes;
  }

  /**
   * Handle size changes and send alerts if needed
   */
  private handleSizeChange(diff: BundleDiff): void {
    const isSignificantIncrease = 
      diff.difference > this.config.alertThreshold ||
      diff.percentageChange > this.config.maxSizeIncrease;

    if (isSignificantIncrease && diff.difference > 0) {
      this.sendSizeAlert(diff);
    } else if (diff.difference < 0) {
      this.logSizeReduction(diff);
    }
  }

  /**
   * Send alert for size increase
   */
  private sendSizeAlert(diff: BundleDiff): void {
    const emoji = diff.percentageChange > 20 ? '🚨' : '⚠️';
    const formattedSize = this.formatBytes(Math.abs(diff.difference));
    
    console.warn(
      `${emoji} Bundle size increase detected!\n` +
      `File: ${diff.file}\n` +
      `Size change: +${formattedSize} (+${diff.percentageChange.toFixed(1)}%)\n` +
      `New size: ${this.formatBytes(diff.newSize)}\n` +
      `Time: ${diff.timestamp.toLocaleTimeString()}`
    );

    // In a real app, this would integrate with notification systems
    this.notifyDevelopmentTeam(diff);
  }

  /**
   * Log size reduction (positive change)
   */
  private logSizeReduction(diff: BundleDiff): void {
    const formattedSize = this.formatBytes(Math.abs(diff.difference));
    
    console.log(
      `✅ Bundle size reduced!\n` +
      `File: ${diff.file}\n` +
      `Size saved: ${formattedSize} (${Math.abs(diff.percentageChange).toFixed(1)}%)\n` +
      `New size: ${this.formatBytes(diff.newSize)}`
    );
  }

  /**
   * Notify development team (mock)
   */
  private notifyDevelopmentTeam(diff: BundleDiff): void {
    // Mock notification - would integrate with Slack, email, etc.
    console.log('📧 Notifying development team about bundle size increase...');
    
    // Example integration points:
    // - Slack webhook
    // - Email alert
    // - GitHub PR comment
    // - Dashboard notification
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = Math.abs(bytes);
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Get watch statistics
   */
  getStats(): {
    isWatching: boolean;
    filesTracked: number;
    totalSize: number;
    largestBundle: { name: string; size: number } | null;
  } {
    const sizes = Array.from(this.previousSizes.entries());
    const totalSize = sizes.reduce((sum, [, size]) => sum + size, 0);
    const largestBundle = sizes.length > 0 
      ? sizes.reduce((largest, [name, size]) => 
          size > largest.size ? { name, size } : largest,
          { name: '', size: 0 }
        )
      : null;

    return {
      isWatching: this.isWatching,
      filesTracked: this.previousSizes.size,
      totalSize,
      largestBundle
    };
  }

  /**
   * Generate size history report
   */
  generateSizeReport(): string {
    const stats = this.getStats();
    let report = '# Bundle Size Report\n\n';
    
    report += `**Status**: ${stats.isWatching ? '🟢 Watching' : '🔴 Stopped'}\n`;
    report += `**Files Tracked**: ${stats.filesTracked}\n`;
    report += `**Total Size**: ${this.formatBytes(stats.totalSize)}\n\n`;

    if (stats.largestBundle) {
      report += `**Largest Bundle**: ${stats.largestBundle.name} (${this.formatBytes(stats.largestBundle.size)})\n\n`;
    }

    report += '## Bundle Sizes\n';
    Array.from(this.previousSizes.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([name, size]) => {
        report += `- **${name}**: ${this.formatBytes(size)}\n`;
      });

    return report;
  }
}

/**
 * Bundle size utilities
 */
export class BundleSizeUtils {
  /**
   * Calculate gzip size estimation
   */
  static estimateGzipSize(originalSize: number): number {
    return Math.round(originalSize * 0.35);
  }

  /**
   * Calculate brotli size estimation
   */
  static estimateBrotliSize(originalSize: number): number {
    return Math.round(originalSize * 0.28);
  }

  /**
   * Check if bundle size is within recommended limits
   */
  static checkSizeRecommendations(bundles: Array<{ name: string; size: number }>) {
    const recommendations = [];
    const limits = {
      main: 250 * 1024,    // 250KB
      vendor: 200 * 1024,  // 200KB
      chunk: 100 * 1024    // 100KB
    };

    bundles.forEach(bundle => {
      let limit = limits.chunk;
      
      if (bundle.name.includes('main')) limit = limits.main;
      else if (bundle.name.includes('vendor')) limit = limits.vendor;

      if (bundle.size > limit) {
        recommendations.push({
          bundle: bundle.name,
          currentSize: bundle.size,
          recommendedSize: limit,
          exceedsBy: bundle.size - limit
        });
      }
    });

    return recommendations;
  }
}
