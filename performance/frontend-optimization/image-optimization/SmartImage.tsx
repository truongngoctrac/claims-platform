/**
 * Smart Image Component
 * Optimized image component with lazy loading, responsive images, and performance monitoring
 */

import React, { useState, useRef, useEffect } from 'react';
import { ImageOptimizer, SmartImageProps, ImagePerformanceMonitor } from './ImageOptimizer';

// Global instances
const imageOptimizer = new ImageOptimizer();
const performanceMonitor = new ImagePerformanceMonitor();

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  loading = 'lazy',
  quality = 85,
  sizes,
  className = '',
  placeholder = 'blur',
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [optimizedData, setOptimizedData] = useState<any>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Optimize image on mount
    const optimizeAsync = async () => {
      try {
        const data = await imageOptimizer.optimizeImage(src, {
          priority,
          lazy: loading === 'lazy',
          qualities: { jpeg: quality, webp: quality, avif: quality - 5 }
        });
        setOptimizedData(data);
      } catch (error) {
        console.error('Failed to optimize image:', error);
        setIsError(true);
      }
    };

    optimizeAsync();
  }, [src, priority, loading, quality]);

  useEffect(() => {
    // Monitor performance when image ref is available
    if (imgRef.current && optimizedData) {
      performanceMonitor.monitorImage(imgRef.current);
    }
  }, [optimizedData]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setIsError(true);
    onError?.();
  };

  // Show loading placeholder while optimizing
  if (!optimizedData && !isError) {
    return (
      <div 
        className={`bg-gray-200 animate-pulse ${className}`}
        style={{ width, height }}
        aria-label="Loading image..."
      />
    );
  }

  // Show error state
  if (isError) {
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center text-gray-500 ${className}`}
        style={{ width, height }}
        aria-label="Failed to load image"
      >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder */}
      {placeholder === 'blur' && optimizedData.blurDataURL && !isLoaded && (
        <img
          src={optimizedData.blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 filter blur-sm"
          aria-hidden="true"
        />
      )}
      
      {/* Main image */}
      <picture>
        {/* AVIF source */}
        <source
          srcSet={optimizedData.srcSet.replace(/&f=\w+/g, '&f=avif')}
          sizes={sizes || optimizedData.sizes}
          type="image/avif"
        />
        
        {/* WebP source */}
        <source
          srcSet={optimizedData.srcSet.replace(/&f=\w+/g, '&f=webp')}
          sizes={sizes || optimizedData.sizes}
          type="image/webp"
        />
        
        {/* Fallback JPEG */}
        <img
          ref={imgRef}
          src={optimizedData.src}
          srcSet={optimizedData.srcSet}
          sizes={sizes || optimizedData.sizes}
          alt={alt}
          width={width || optimizedData.width}
          height={height || optimizedData.height}
          loading={optimizedData.loading}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            aspectRatio: width && height ? `${width}/${height}` : undefined
          }}
        />
      </picture>
      
      {/* Loading overlay */}
      {!isLoaded && !isError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
};

/**
 * Image Gallery Component with optimized loading
 */
export interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  columns?: number;
  gap?: number;
  lazyOffset?: number;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  columns = 3,
  gap = 16,
  lazyOffset = 100
}) => {
  const [visibleCount, setVisibleCount] = useState(columns * 2); // Load first 2 rows
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Setup intersection observer for infinite loading
    if (sentinelRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && visibleCount < images.length) {
            setVisibleCount(prev => Math.min(prev + columns, images.length));
          }
        },
        { rootMargin: `${lazyOffset}px` }
      );

      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visibleCount, images.length, columns, lazyOffset]);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`
  };

  return (
    <div>
      <div style={gridStyle}>
        {images.slice(0, visibleCount).map((image, index) => (
          <div key={index} className="relative">
            <SmartImage
              src={image.src}
              alt={image.alt}
              priority={index < columns} // First row is priority
              loading={index < columns ? 'eager' : 'lazy'}
              className="w-full h-auto rounded-lg"
            />
            {image.caption && (
              <p className="mt-2 text-sm text-gray-600">{image.caption}</p>
            )}
          </div>
        ))}
      </div>
      
      {/* Sentinel for infinite loading */}
      {visibleCount < images.length && (
        <div 
          ref={sentinelRef} 
          className="h-4 mt-4"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

/**
 * Hero Image Component with optimal loading
 */
export interface HeroImageProps {
  src: string;
  alt: string;
  overlay?: boolean;
  overlayColor?: string;
  children?: React.ReactNode;
  height?: string;
  className?: string;
}

export const HeroImage: React.FC<HeroImageProps> = ({
  src,
  alt,
  overlay = false,
  overlayColor = 'rgba(0, 0, 0, 0.4)',
  children,
  height = '50vh',
  className = ''
}) => {
  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <SmartImage
        src={src}
        alt={alt}
        priority={true}
        loading="eager"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {overlay && (
        <div 
          className="absolute inset-0"
          style={{ backgroundColor: overlayColor }}
        />
      )}
      
      {children && (
        <div className="relative z-10 h-full flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Profile Image Component with fallback
 */
export interface ProfileImageProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ProfileImage: React.FC<ProfileImageProps> = ({
  src,
  name,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-24 h-24 text-lg'
  };

  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src) {
    return (
      <div 
        className={`
          ${sizeClasses[size]} 
          bg-gray-500 
          rounded-full 
          flex 
          items-center 
          justify-center 
          text-white 
          font-medium 
          ${className}
        `}
      >
        {initials}
      </div>
    );
  }

  return (
    <SmartImage
      src={src}
      alt={`${name}'s profile`}
      priority={false}
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
    />
  );
};

/**
 * Image with zoom functionality
 */
export interface ZoomableImageProps extends SmartImageProps {
  zoomable?: boolean;
  maxZoom?: number;
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  zoomable = true,
  maxZoom = 3,
  className = '',
  ...imageProps
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleClick = () => {
    if (zoomable) {
      setIsZoomed(!isZoomed);
      setZoomLevel(isZoomed ? 1 : 2);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isZoomed && zoomable) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPosition({ x, y });
    }
  };

  return (
    <div 
      className={`relative overflow-hidden cursor-zoom-in ${className}`}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    >
      <SmartImage
        {...imageProps}
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: `${position.x}% ${position.y}%`
        }}
      />
      
      {zoomable && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded p-1 text-xs">
          {isZoomed ? '🔍-' : '🔍+'}
        </div>
      )}
    </div>
  );
};

export default SmartImage;
