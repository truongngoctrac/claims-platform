/**
 * Critical CSS Extraction System
 * Identifies and extracts above-the-fold CSS for faster initial rendering
 */

export interface CriticalCSSConfig {
  width: number;
  height: number;
  url: string;
  css: string[];
  ignore: string[];
  minify: boolean;
  inlineImages: boolean;
  timeout: number;
  penthouse: boolean;
}

export interface CriticalCSSResult {
  css: string;
  uncriticalCSS: string;
  stats: {
    originalSize: number;
    criticalSize: number;
    uncriticalSize: number;
    reduction: number;
  };
  selectors: {
    critical: string[];
    uncritical: string[];
  };
}

export interface ViewportConfig {
  width: number;
  height: number;
  name: string;
}

export class CriticalCSSExtractor {
  private config: CriticalCSSConfig;
  private cssRules: CSSRule[] = [];
  private usedSelectors = new Set<string>();

  constructor(config: Partial<CriticalCSSConfig> = {}) {
    this.config = {
      width: 1300,
      height: 900,
      url: window.location.href,
      css: [],
      ignore: ['@font-face', '@keyframes', '.no-critical'],
      minify: true,
      inlineImages: false,
      timeout: 30000,
      penthouse: false,
      ...config
    };
  }

  /**
   * Extract critical CSS from current page
   */
  async extractCritical(): Promise<CriticalCSSResult> {
    console.log('🔍 Extracting critical CSS...');

    // Get all stylesheets
    const stylesheets = await this.getAllStylesheets();
    
    // Parse CSS rules
    this.cssRules = await this.parseStylesheets(stylesheets);
    
    // Identify critical selectors
    const criticalSelectors = await this.identifyCriticalSelectors();
    
    // Generate critical and uncritical CSS
    const criticalCSS = this.generateCriticalCSS(criticalSelectors);
    const uncriticalCSS = this.generateUncriticalCSS(criticalSelectors);
    
    // Calculate statistics
    const stats = this.calculateStats(criticalCSS, uncriticalCSS);

    return {
      css: this.config.minify ? this.minifyCSS(criticalCSS) : criticalCSS,
      uncriticalCSS: this.config.minify ? this.minifyCSS(uncriticalCSS) : uncriticalCSS,
      stats,
      selectors: {
        critical: Array.from(criticalSelectors),
        uncritical: this.cssRules
          .map(rule => this.extractSelectorsFromRule(rule))
          .flat()
          .filter(selector => !criticalSelectors.has(selector))
      }
    };
  }

  /**
   * Get all stylesheets from the page
   */
  private async getAllStylesheets(): Promise<string[]> {
    const stylesheets: string[] = [];
    
    // Get inline styles
    const styleElements = document.querySelectorAll('style');
    styleElements.forEach(style => {
      if (style.textContent) {
        stylesheets.push(style.textContent);
      }
    });

    // Get external stylesheets
    const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
    const fetchPromises = Array.from(linkElements).map(async (link) => {
      const href = (link as HTMLLinkElement).href;
      try {
        const response = await fetch(href);
        return await response.text();
      } catch (error) {
        console.warn(`Failed to fetch stylesheet: ${href}`, error);
        return '';
      }
    });

    const externalStyles = await Promise.all(fetchPromises);
    stylesheets.push(...externalStyles.filter(Boolean));

    return stylesheets;
  }

  /**
   * Parse CSS stylesheets into rules
   */
  private parseStylesheets(stylesheets: string[]): CSSRule[] {
    const allRules: CSSRule[] = [];

    stylesheets.forEach(stylesheet => {
      try {
        // Create a temporary style element to parse CSS
        const style = document.createElement('style');
        style.textContent = stylesheet;
        document.head.appendChild(style);

        const sheet = style.sheet;
        if (sheet) {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          allRules.push(...rules);
        }

        document.head.removeChild(style);
      } catch (error) {
        console.warn('Failed to parse stylesheet:', error);
      }
    });

    return allRules;
  }

  /**
   * Identify critical selectors (above the fold)
   */
  private async identifyCriticalSelectors(): Promise<Set<string>> {
    const criticalSelectors = new Set<string>();
    const viewport = this.getViewportDimensions();

    // Get all elements in viewport
    const elementsInViewport = this.getElementsInViewport(viewport);

    // For each element, find matching CSS rules
    elementsInViewport.forEach(element => {
      this.cssRules.forEach(rule => {
        if (this.isStyleRule(rule)) {
          const selectors = this.extractSelectorsFromRule(rule);
          selectors.forEach(selector => {
            if (this.elementMatchesSelector(element, selector)) {
              criticalSelectors.add(selector);
            }
          });
        }
      });
    });

    // Add always critical selectors
    this.addAlwaysCriticalSelectors(criticalSelectors);

    return criticalSelectors;
  }

  /**
   * Get viewport dimensions
   */
  private getViewportDimensions(): { width: number; height: number } {
    return {
      width: this.config.width || window.innerWidth,
      height: this.config.height || window.innerHeight
    };
  }

  /**
   * Get all elements within viewport
   */
  private getElementsInViewport(viewport: { width: number; height: number }): Element[] {
    const elements: Element[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      const rect = element.getBoundingClientRect();
      
      // Check if element is in viewport
      if (
        rect.top < viewport.height &&
        rect.bottom > 0 &&
        rect.left < viewport.width &&
        rect.right > 0
      ) {
        elements.push(element);
      }

      node = walker.nextNode();
    }

    return elements;
  }

  /**
   * Check if rule is a style rule
   */
  private isStyleRule(rule: CSSRule): rule is CSSStyleRule {
    return rule.type === CSSRule.STYLE_RULE;
  }

  /**
   * Extract selectors from CSS rule
   */
  private extractSelectorsFromRule(rule: CSSRule): string[] {
    if (this.isStyleRule(rule)) {
      return rule.selectorText.split(',').map(s => s.trim());
    }
    return [];
  }

  /**
   * Check if element matches selector
   */
  private elementMatchesSelector(element: Element, selector: string): boolean {
    try {
      return element.matches(selector);
    } catch {
      // Invalid selector
      return false;
    }
  }

  /**
   * Add selectors that should always be considered critical
   */
  private addAlwaysCriticalSelectors(criticalSelectors: Set<string>): void {
    const alwaysCritical = [
      'html',
      'body',
      '*',
      '::before',
      '::after',
      ':root',
      '.sr-only',
      '.skip-link'
    ];

    alwaysCritical.forEach(selector => {
      criticalSelectors.add(selector);
    });
  }

  /**
   * Generate critical CSS from selectors
   */
  private generateCriticalCSS(criticalSelectors: Set<string>): string {
    const criticalRules: string[] = [];

    this.cssRules.forEach(rule => {
      if (this.shouldIncludeRule(rule, criticalSelectors)) {
        criticalRules.push(rule.cssText);
      }
    });

    return criticalRules.join('\n');
  }

  /**
   * Generate uncritical CSS
   */
  private generateUncriticalCSS(criticalSelectors: Set<string>): string {
    const uncriticalRules: string[] = [];

    this.cssRules.forEach(rule => {
      if (!this.shouldIncludeRule(rule, criticalSelectors)) {
        uncriticalRules.push(rule.cssText);
      }
    });

    return uncriticalRules.join('\n');
  }

  /**
   * Check if rule should be included in critical CSS
   */
  private shouldIncludeRule(rule: CSSRule, criticalSelectors: Set<string>): boolean {
    // Skip ignored rules
    if (this.config.ignore.some(pattern => rule.cssText.includes(pattern))) {
      return false;
    }

    // Always include certain rule types
    if (rule.type === CSSRule.CHARSET_RULE || 
        rule.type === CSSRule.IMPORT_RULE) {
      return true;
    }

    // For style rules, check if any selector is critical
    if (this.isStyleRule(rule)) {
      const selectors = this.extractSelectorsFromRule(rule);
      return selectors.some(selector => criticalSelectors.has(selector));
    }

    // Include media queries that might affect critical content
    if (rule.type === CSSRule.MEDIA_RULE) {
      return this.isMediaQueryCritical(rule as CSSMediaRule);
    }

    return false;
  }

  /**
   * Check if media query is critical
   */
  private isMediaQueryCritical(mediaRule: CSSMediaRule): boolean {
    const mediaText = mediaRule.media.mediaText.toLowerCase();
    
    // Include responsive queries that might affect initial viewport
    const criticalQueries = [
      'screen',
      'print',
      `max-width: ${this.config.width}px`,
      `min-width: ${this.config.width}px`
    ];

    return criticalQueries.some(query => mediaText.includes(query));
  }

  /**
   * Calculate CSS statistics
   */
  private calculateStats(criticalCSS: string, uncriticalCSS: string): {
    originalSize: number;
    criticalSize: number;
    uncriticalSize: number;
    reduction: number;
  } {
    const criticalSize = new Blob([criticalCSS]).size;
    const uncriticalSize = new Blob([uncriticalCSS]).size;
    const originalSize = criticalSize + uncriticalSize;
    const reduction = originalSize > 0 ? (criticalSize / originalSize) * 100 : 0;

    return {
      originalSize,
      criticalSize,
      uncriticalSize,
      reduction
    };
  }

  /**
   * Minify CSS
   */
  private minifyCSS(css: string): string {
    return css
      .replace(/\/\*.*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
      .replace(/\s*{\s*/g, '{') // Remove space around braces
      .replace(/;\s*/g, ';') // Remove space after semicolons
      .replace(/,\s*/g, ',') // Remove space after commas
      .replace(/:\s*/g, ':') // Remove space after colons
      .trim();
  }

  /**
   * Extract critical CSS for multiple viewports
   */
  async extractForMultipleViewports(viewports: ViewportConfig[]): Promise<Record<string, CriticalCSSResult>> {
    const results: Record<string, CriticalCSSResult> = {};

    for (const viewport of viewports) {
      this.config.width = viewport.width;
      this.config.height = viewport.height;
      
      results[viewport.name] = await this.extractCritical();
    }

    return results;
  }

  /**
   * Generate inline critical CSS tag
   */
  generateInlineTag(criticalCSS: string): string {
    return `<style data-critical-css>${criticalCSS}</style>`;
  }

  /**
   * Generate preload link for uncritical CSS
   */
  generatePreloadLink(href: string): string {
    return `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">`;
  }

  /**
   * Generate complete HTML injection
   */
  generateHTMLInjection(criticalCSS: string, uncriticalHref: string): string {
    return `
      ${this.generateInlineTag(criticalCSS)}
      ${this.generatePreloadLink(uncriticalHref)}
      <noscript><link rel="stylesheet" href="${uncriticalHref}"></noscript>
    `.trim();
  }
}

/**
 * Critical CSS Analyzer
 */
export class CriticalCSSAnalyzer {
  /**
   * Analyze CSS coverage
   */
  static async analyzeCoverage(): Promise<{
    totalRules: number;
    usedRules: number;
    unusedRules: number;
    coverage: number;
  }> {
    const allRules = new Set<string>();
    const usedRules = new Set<string>();

    // Get all CSS rules
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule.type === CSSRule.STYLE_RULE) {
            const styleRule = rule as CSSStyleRule;
            allRules.add(styleRule.selectorText);
            
            // Check if rule is used
            try {
              if (document.querySelector(styleRule.selectorText)) {
                usedRules.add(styleRule.selectorText);
              }
            } catch {
              // Invalid selector
            }
          }
        });
      } catch (error) {
        console.warn('Cannot access stylesheet:', error);
      }
    });

    const totalRules = allRules.size;
    const usedCount = usedRules.size;
    const unusedCount = totalRules - usedCount;
    const coverage = totalRules > 0 ? (usedCount / totalRules) * 100 : 0;

    return {
      totalRules,
      usedRules: usedCount,
      unusedRules: unusedCount,
      coverage
    };
  }

  /**
   * Find unused CSS selectors
   */
  static findUnusedSelectors(): string[] {
    const unusedSelectors: string[] = [];

    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule.type === CSSRule.STYLE_RULE) {
            const styleRule = rule as CSSStyleRule;
            const selectors = styleRule.selectorText.split(',').map(s => s.trim());
            
            selectors.forEach(selector => {
              try {
                if (!document.querySelector(selector)) {
                  unusedSelectors.push(selector);
                }
              } catch {
                unusedSelectors.push(selector); // Invalid selectors are also unused
              }
            });
          }
        });
      } catch (error) {
        console.warn('Cannot access stylesheet:', error);
      }
    });

    return [...new Set(unusedSelectors)];
  }

  /**
   * Estimate potential savings
   */
  static estimateSavings(): {
    totalSize: number;
    unusedSize: number;
    potentialSavings: number;
    savingsPercentage: number;
  } {
    let totalSize = 0;
    let unusedSize = 0;
    const unusedSelectors = this.findUnusedSelectors();

    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          const ruleSize = rule.cssText.length;
          totalSize += ruleSize;

          if (rule.type === CSSRule.STYLE_RULE) {
            const styleRule = rule as CSSStyleRule;
            const selectors = styleRule.selectorText.split(',').map(s => s.trim());
            
            if (selectors.some(selector => unusedSelectors.includes(selector))) {
              unusedSize += ruleSize;
            }
          }
        });
      } catch (error) {
        console.warn('Cannot access stylesheet:', error);
      }
    });

    const savingsPercentage = totalSize > 0 ? (unusedSize / totalSize) * 100 : 0;

    return {
      totalSize,
      unusedSize,
      potentialSavings: unusedSize,
      savingsPercentage
    };
  }
}

/**
 * Critical CSS utilities
 */
export class CriticalCSSUtils {
  /**
   * Detect if critical CSS is already inlined
   */
  static hasCriticalCSS(): boolean {
    return !!document.querySelector('style[data-critical-css]');
  }

  /**
   * Load non-critical CSS asynchronously
   */
  static loadNonCriticalCSS(href: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
      document.head.appendChild(link);
    });
  }

  /**
   * Remove critical CSS after full CSS loads
   */
  static removeCriticalCSS(): void {
    const criticalCSS = document.querySelector('style[data-critical-css]');
    if (criticalCSS) {
      criticalCSS.remove();
    }
  }

  /**
   * Format CSS size for display
   */
  static formatSize(bytes: number): string {
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
   * Generate critical CSS performance report
   */
  static generateReport(result: CriticalCSSResult): string {
    const { stats, selectors } = result;
    
    return `
# Critical CSS Performance Report

## Overview
- **Original Size**: ${this.formatSize(stats.originalSize)}
- **Critical Size**: ${this.formatSize(stats.criticalSize)}
- **Uncritical Size**: ${this.formatSize(stats.uncriticalSize)}
- **Size Reduction**: ${stats.reduction.toFixed(1)}%

## Selectors
- **Critical Selectors**: ${selectors.critical.length}
- **Uncritical Selectors**: ${selectors.uncritical.length}

## Benefits
- ✅ Faster first paint
- ✅ Improved LCP (Largest Contentful Paint)
- ✅ Better perceived performance
- ✅ Reduced render-blocking resources

## Implementation
\`\`\`html
${result.css ? '<!-- Inline critical CSS -->' : ''}
<style data-critical-css>
${result.css}
</style>

<!-- Async load uncritical CSS -->
<link rel="preload" href="/uncritical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/uncritical.css"></noscript>
\`\`\`
    `.trim();
  }
}
