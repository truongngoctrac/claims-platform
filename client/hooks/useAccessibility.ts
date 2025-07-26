import { useState, useEffect, useCallback } from 'react';

interface AccessibilitySettings {
  fontSize: number;
  lineHeight: number;
  contrast: 'normal' | 'high' | 'higher';
  colorTheme: 'default' | 'monochrome' | 'blue-yellow' | 'green-red';
  animations: boolean;
  soundEffects: boolean;
  voiceNavigation: boolean;
  keyboardNavigation: boolean;
  screenReader: boolean;
  focusIndicator: 'normal' | 'enhanced' | 'high-contrast';
  textSpacing: number;
  cursorSize: 'normal' | 'large' | 'extra-large';
}

const defaultSettings: AccessibilitySettings = {
  fontSize: 100,
  lineHeight: 1.5,
  contrast: 'normal',
  colorTheme: 'default',
  animations: true,
  soundEffects: false,
  voiceNavigation: false,
  keyboardNavigation: true,
  screenReader: false,
  focusIndicator: 'normal',
  textSpacing: 0,
  cursorSize: 'normal'
};

export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibility-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Failed to parse accessibility settings:', error);
      }
    }
  }, []);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Font size
    root.style.setProperty('--accessibility-font-size', `${settings.fontSize}%`);
    
    // Line height
    root.style.setProperty('--accessibility-line-height', settings.lineHeight.toString());
    
    // Text spacing
    root.style.setProperty('--accessibility-letter-spacing', `${settings.textSpacing}px`);

    // Contrast and color theme
    root.classList.remove('high-contrast', 'higher-contrast', 'monochrome', 'blue-yellow', 'green-red');
    if (settings.contrast !== 'normal') {
      root.classList.add(settings.contrast === 'high' ? 'high-contrast' : 'higher-contrast');
    }
    if (settings.colorTheme !== 'default') {
      root.classList.add(settings.colorTheme);
    }

    // Animations
    if (!settings.animations) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Focus indicator
    root.classList.remove('focus-normal', 'focus-enhanced', 'focus-high-contrast');
    root.classList.add(`focus-${settings.focusIndicator}`);

    // Cursor size
    root.classList.remove('cursor-normal', 'cursor-large', 'cursor-extra-large');
    root.classList.add(`cursor-${settings.cursorSize}`);

    // Screen reader optimization
    if (settings.screenReader) {
      root.classList.add('screen-reader-optimized');
    } else {
      root.classList.remove('screen-reader-optimized');
    }

    // Keyboard navigation
    if (settings.keyboardNavigation) {
      root.classList.add('keyboard-navigation');
    } else {
      root.classList.remove('keyboard-navigation');
    }

  }, [settings]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  // Update specific settings
  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Reset to default settings
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    localStorage.removeItem('accessibility-settings');
  }, []);

  // Announce to screen readers
  const announce = useCallback((message: string) => {
    if (settings.screenReader) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      announcement.textContent = message;
      
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  }, [settings.screenReader]);

  // Play sound effect
  const playSound = useCallback((type: 'success' | 'error' | 'click' | 'focus') => {
    if (settings.soundEffects) {
      // Create and play audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different sound types
      const frequencies = {
        success: 800,
        error: 300,
        click: 600,
        focus: 400
      };
      
      oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  }, [settings.soundEffects]);

  return {
    settings,
    updateSettings,
    resetSettings,
    announce,
    playSound
  };
}
