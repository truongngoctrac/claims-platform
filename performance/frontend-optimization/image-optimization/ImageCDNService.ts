/**
 * Image CDN Service
 * Integration with popular image CDN services for optimal delivery
 */

export interface CDNConfig {
  provider: 'cloudinary' | 'imagekit' | 'custom';
  baseUrl: string;
  apiKey?: string;
  transformations: CDNTransformations;
  autoFormat: boolean;
  autoQuality: boolean;
}

export interface CDNTransformations {
  resize: 'fill' | 'fit' | 'crop' | 'scale';
  quality: 'auto' | number;
  format: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  dpr: 'auto' | number;
  progressive: boolean;
  strip: boolean;
}

export interface ImageCDNRequest {
  src: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
  sepia?: boolean;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

export class ImageCDNService {
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;
  }

  /**
   * Generate optimized image URL
   */
  generateUrl(request: ImageCDNRequest): string {
    switch (this.config.provider) {
      case 'cloudinary':
        return this.generateCloudinaryUrl(request);
      case 'imagekit':
        return this.generateImageKitUrl(request);
      case 'custom':
        return this.generateCustomUrl(request);
      default:
        return request.src;
    }
  }

  /**
   * Generate Cloudinary URL
   */
  private generateCloudinaryUrl(request: ImageCDNRequest): string {
    const transformations: string[] = [];

    // Dimensions
    if (request.width || request.height) {
      const w = request.width ? `w_${request.width}` : '';
      const h = request.height ? `h_${request.height}` : '';
      const resize = `c_${this.config.transformations.resize}`;
      transformations.push([w, h, resize].filter(Boolean).join(','));
    }

    // Quality
    const quality = request.quality || this.config.transformations.quality;
    if (quality !== 'auto') {
      transformations.push(`q_${quality}`);
    } else if (this.config.autoQuality) {
      transformations.push('q_auto');
    }

    // Format
    const format = request.format || this.config.transformations.format;
    if (format !== 'auto') {
      transformations.push(`f_${format}`);
    } else if (this.config.autoFormat) {
      transformations.push('f_auto');
    }

    // DPR (Device Pixel Ratio)
    if (this.config.transformations.dpr === 'auto') {
      transformations.push('dpr_auto');
    } else if (typeof this.config.transformations.dpr === 'number') {
      transformations.push(`dpr_${this.config.transformations.dpr}`);
    }

    // Progressive
    if (this.config.transformations.progressive) {
      transformations.push('fl_progressive');
    }

    // Strip metadata
    if (this.config.transformations.strip) {
      transformations.push('fl_strip_profile');
    }

    // Effects
    if (request.blur) {
      transformations.push(`e_blur:${request.blur}`);
    }
    if (request.sharpen) {
      transformations.push('e_sharpen');
    }
    if (request.grayscale) {
      transformations.push('e_grayscale');
    }
    if (request.sepia) {
      transformations.push('e_sepia');
    }
    if (request.brightness) {
      transformations.push(`e_brightness:${request.brightness}`);
    }
    if (request.contrast) {
      transformations.push(`e_contrast:${request.contrast}`);
    }
    if (request.saturation) {
      transformations.push(`e_saturation:${request.saturation}`);
    }

    // Build URL
    const transformString = transformations.join('/');
    const imagePath = this.extractImagePath(request.src);
    
    return `${this.config.baseUrl}/${transformString}/${imagePath}`;
  }

  /**
   * Generate ImageKit URL
   */
  private generateImageKitUrl(request: ImageCDNRequest): string {
    const params = new URLSearchParams();

    // Dimensions
    if (request.width) params.set('w', request.width.toString());
    if (request.height) params.set('h', request.height.toString());

    // Quality
    const quality = request.quality || this.config.transformations.quality;
    if (quality !== 'auto') {
      params.set('q', quality.toString());
    }

    // Format
    const format = request.format || this.config.transformations.format;
    if (format !== 'auto') {
      params.set('f', format);
    }

    // Auto optimization
    if (this.config.autoFormat && this.config.autoQuality) {
      params.set('tr', 'q-auto,f-auto');
    } else if (this.config.autoFormat) {
      params.set('tr', 'f-auto');
    } else if (this.config.autoQuality) {
      params.set('tr', 'q-auto');
    }

    // Effects
    const effects: string[] = [];
    if (request.blur) effects.push(`bl-${request.blur}`);
    if (request.sharpen) effects.push('e-sharpen');
    if (request.grayscale) effects.push('e-grayscale');

    if (effects.length > 0) {
      const existingTr = params.get('tr') || '';
      params.set('tr', existingTr ? `${existingTr},${effects.join(',')}` : effects.join(','));
    }

    const imagePath = this.extractImagePath(request.src);
    const queryString = params.toString();
    
    return `${this.config.baseUrl}/${imagePath}${queryString ? `?${queryString}` : ''}`;
  }

  /**
   * Generate custom CDN URL
   */
  private generateCustomUrl(request: ImageCDNRequest): string {
    const params = new URLSearchParams();

    if (request.width) params.set('width', request.width.toString());
    if (request.height) params.set('height', request.height.toString());
    if (request.quality) params.set('quality', request.quality.toString());
    if (request.format) params.set('format', request.format);

    const queryString = params.toString();
    return `${this.config.baseUrl}${request.src}${queryString ? `?${queryString}` : ''}`;
  }

  /**
   * Extract image path from full URL
   */
  private extractImagePath(src: string): string {
    try {
      const url = new URL(src);
      return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    } catch {
      return src;
    }
  }

  /**
   * Generate responsive image set
   */
  generateResponsiveSet(
    src: string,
    breakpoints: number[],
    options: Partial<ImageCDNRequest> = {}
  ): string {
    return breakpoints
      .map(width => {
        const url = this.generateUrl({ ...options, src, width });
        return `${url} ${width}w`;
      })
      .join(', ');
  }

  /**
   * Generate blur placeholder
   */
  generateBlurPlaceholder(src: string, quality: number = 10): string {
    return this.generateUrl({
      src,
      width: 40,
      height: 30,
      quality,
      blur: 20
    });
  }

  /**
   * Generate art direction images
   */
  generateArtDirection(
    src: string,
    configurations: Array<{
      media: string;
      width: number;
      height?: number;
      crop?: 'fill' | 'fit' | 'crop';
    }>
  ): Array<{ media: string; srcSet: string }> {
    return configurations.map(config => ({
      media: config.media,
      srcSet: this.generateUrl({
        src,
        width: config.width,
        height: config.height
      })
    }));
  }

  /**
   * Optimize image for different devices
   */
  optimizeForDevice(src: string, deviceType: 'mobile' | 'tablet' | 'desktop'): string {
    const deviceConfigs = {
      mobile: { width: 480, quality: 75 },
      tablet: { width: 768, quality: 80 },
      desktop: { width: 1200, quality: 85 }
    };

    const config = deviceConfigs[deviceType];
    return this.generateUrl({ src, ...config });
  }

  /**
   * Generate social media optimized images
   */
  generateSocialMediaImages(src: string): Record<string, string> {
    const socialSizes = {
      'facebook-post': { width: 1200, height: 630 },
      'twitter-card': { width: 1200, height: 600 },
      'instagram-post': { width: 1080, height: 1080 },
      'linkedin-post': { width: 1200, height: 627 },
      'pinterest-pin': { width: 735, height: 1102 }
    };

    const result: Record<string, string> = {};
    
    Object.entries(socialSizes).forEach(([platform, dimensions]) => {
      result[platform] = this.generateUrl({
        src,
        ...dimensions,
        quality: 85
      });
    });

    return result;
  }

  /**
   * Validate CDN configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.baseUrl) {
      errors.push('Base URL is required');
    }

    if (!this.config.provider) {
      errors.push('Provider is required');
    }

    if (this.config.provider === 'cloudinary' && !this.config.baseUrl.includes('cloudinary.com')) {
      errors.push('Cloudinary base URL should contain cloudinary.com');
    }

    if (this.config.provider === 'imagekit' && !this.config.baseUrl.includes('imagekit.io')) {
      errors.push('ImageKit base URL should contain imagekit.io');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Test CDN connectivity
   */
  async testConnectivity(testImageUrl: string): Promise<boolean> {
    try {
      const optimizedUrl = this.generateUrl({
        src: testImageUrl,
        width: 100,
        height: 100,
        quality: 50
      });

      const response = await fetch(optimizedUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get CDN analytics (if supported)
   */
  async getAnalytics(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    // This would integrate with CDN provider APIs
    // Implementation depends on the specific CDN service
    console.log(`Getting ${timeframe} analytics for ${this.config.provider}`);
    
    return {
      requests: 0,
      bandwidth: 0,
      hitRatio: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CDNConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): CDNConfig {
    return { ...this.config };
  }
}

/**
 * CDN Factory for easy setup
 */
export class CDNFactory {
  /**
   * Create Cloudinary CDN service
   */
  static createCloudinary(cloudName: string, options: Partial<CDNConfig> = {}): ImageCDNService {
    return new ImageCDNService({
      provider: 'cloudinary',
      baseUrl: `https://res.cloudinary.com/${cloudName}/image/upload`,
      transformations: {
        resize: 'fill',
        quality: 'auto',
        format: 'auto',
        dpr: 'auto',
        progressive: true,
        strip: true
      },
      autoFormat: true,
      autoQuality: true,
      ...options
    });
  }

  /**
   * Create ImageKit CDN service
   */
  static createImageKit(urlEndpoint: string, options: Partial<CDNConfig> = {}): ImageCDNService {
    return new ImageCDNService({
      provider: 'imagekit',
      baseUrl: urlEndpoint,
      transformations: {
        resize: 'fill',
        quality: 'auto',
        format: 'auto',
        dpr: 1,
        progressive: true,
        strip: true
      },
      autoFormat: true,
      autoQuality: true,
      ...options
    });
  }

  /**
   * Create custom CDN service
   */
  static createCustom(baseUrl: string, options: Partial<CDNConfig> = {}): ImageCDNService {
    return new ImageCDNService({
      provider: 'custom',
      baseUrl,
      transformations: {
        resize: 'fill',
        quality: 85,
        format: 'jpeg',
        dpr: 1,
        progressive: false,
        strip: false
      },
      autoFormat: false,
      autoQuality: false,
      ...options
    });
  }
}

/**
 * Multi-CDN manager for failover and load balancing
 */
export class MultiCDNManager {
  private services: ImageCDNService[];
  private currentIndex = 0;
  private failedServices = new Set<number>();

  constructor(services: ImageCDNService[]) {
    this.services = services;
  }

  /**
   * Generate URL with failover
   */
  generateUrl(request: ImageCDNRequest): string {
    const availableServices = this.services.filter((_, index) => !this.failedServices.has(index));
    
    if (availableServices.length === 0) {
      // Reset failed services if all are failed
      this.failedServices.clear();
      return this.services[0].generateUrl(request);
    }

    // Round-robin selection
    const service = availableServices[this.currentIndex % availableServices.length];
    this.currentIndex++;

    return service.generateUrl(request);
  }

  /**
   * Mark service as failed
   */
  markServiceFailed(serviceIndex: number): void {
    this.failedServices.add(serviceIndex);
    
    // Auto-retry after 5 minutes
    setTimeout(() => {
      this.failedServices.delete(serviceIndex);
    }, 5 * 60 * 1000);
  }

  /**
   * Test all services
   */
  async testAllServices(testImageUrl: string): Promise<boolean[]> {
    return Promise.all(
      this.services.map(service => service.testConnectivity(testImageUrl))
    );
  }

  /**
   * Get health status
   */
  getHealthStatus(): { total: number; healthy: number; failed: number } {
    return {
      total: this.services.length,
      healthy: this.services.length - this.failedServices.size,
      failed: this.failedServices.size
    };
  }
}
