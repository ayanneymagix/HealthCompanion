// MediTranslate+ Theme Management System

class ThemeManager {
    constructor() {
        this.themes = ['light', 'dark', 'auto'];
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.systemPreference = window.matchMedia('(prefers-color-scheme: dark)');
        this.fontSizes = ['small', 'medium', 'large', 'extra-large'];
        this.currentFontSize = localStorage.getItem('fontSize') || 'medium';
        this.highContrast = localStorage.getItem('highContrast') === 'true';
        this.reducedMotion = localStorage.getItem('reducedMotion') === 'true';
        
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.applyFontSize(this.currentFontSize);
        this.applyHighContrast(this.highContrast);
        this.applyReducedMotion(this.reducedMotion);
        this.setupEventListeners();
        this.updateThemeToggle();
    }

    setupEventListeners() {
        // System theme change detection
        this.systemPreference.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.applySystemTheme(e.matches);
                this.notifyThemeChange();
            }
        });

        // Storage change detection (for multiple tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme') {
                this.currentTheme = e.newValue || 'light';
                this.applyTheme(this.currentTheme);
                this.updateThemeToggle();
            }
        });

        // Reduced motion preference detection
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionQuery.addEventListener('change', (e) => {
            if (e.matches && !this.reducedMotion) {
                this.setReducedMotion(true);
            }
        });

        // High contrast preference detection
        const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
        highContrastQuery.addEventListener('change', (e) => {
            if (e.matches && !this.highContrast) {
                this.setHighContrast(true);
            }
        });
    }

    setTheme(theme) {
        if (!this.themes.includes(theme)) {
            console.warn(`Invalid theme: ${theme}`);
            return;
        }

        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme(theme);
        this.updateThemeToggle();
        this.notifyThemeChange();

        // Analytics tracking
        this.trackThemeChange(theme);
    }

    applyTheme(theme) {
        const html = document.documentElement;
        
        // Remove existing theme attributes
        html.removeAttribute('data-theme');
        
        if (theme === 'auto') {
            const isDark = this.systemPreference.matches;
            html.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } else {
            html.setAttribute('data-theme', theme);
        }

        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
        
        // Apply theme-specific optimizations
        this.applyThemeOptimizations(theme);
    }

    applySystemTheme(isDark) {
        const html = document.documentElement;
        html.setAttribute('data-theme', isDark ? 'dark' : 'light');
        this.updateMetaThemeColor(isDark ? 'dark' : 'light');
    }

    updateMetaThemeColor(theme) {
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.name = 'theme-color';
            document.head.appendChild(themeColorMeta);
        }

        const colors = {
            light: '#2E7D32',
            dark: '#4CAF50',
            auto: this.systemPreference.matches ? '#4CAF50' : '#2E7D32'
        };

        themeColorMeta.content = colors[theme] || colors.light;
    }

    applyThemeOptimizations(theme) {
        // Optimize for dark theme
        if (theme === 'dark' || (theme === 'auto' && this.systemPreference.matches)) {
            // Reduce image brightness in dark mode
            this.applyImageFilters(true);
            
            // Adjust video brightness
            this.adjustVideoElements(true);
        } else {
            // Reset filters for light mode
            this.applyImageFilters(false);
            this.adjustVideoElements(false);
        }
    }

    applyImageFilters(isDark) {
        const images = document.querySelectorAll('img:not(.no-filter)');
        images.forEach(img => {
            if (isDark) {
                img.style.filter = 'brightness(0.9) contrast(1.1)';
            } else {
                img.style.filter = '';
            }
        });
    }

    adjustVideoElements(isDark) {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (isDark) {
                video.style.filter = 'brightness(0.9)';
            } else {
                video.style.filter = '';
            }
        });
    }

    toggleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextTheme = this.themes[(currentIndex + 1) % this.themes.length];
        this.setTheme(nextTheme);
    }

    updateThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        
        if (!themeIcon) return;

        // Update icon based on current theme
        const icons = {
            light: 'fas fa-moon',
            dark: 'fas fa-sun',
            auto: 'fas fa-adjust'
        };

        themeIcon.className = icons[this.currentTheme] || icons.light;

        // Update tooltip
        if (themeToggle) {
            const tooltips = {
                light: 'Switch to Dark Mode',
                dark: 'Switch to Auto Mode',
                auto: 'Switch to Light Mode'
            };
            
            themeToggle.title = tooltips[this.currentTheme] || tooltips.light;
        }

        // Add theme indicator to toggle button
        if (themeToggle) {
            themeToggle.setAttribute('data-theme', this.currentTheme);
        }
    }

    setFontSize(size) {
        if (!this.fontSizes.includes(size)) {
            console.warn(`Invalid font size: ${size}`);
            return;
        }

        this.currentFontSize = size;
        localStorage.setItem('fontSize', size);
        this.applyFontSize(size);
        this.notifyFontSizeChange();
    }

    applyFontSize(size) {
        const html = document.documentElement;
        
        // Remove existing font-size attributes
        this.fontSizes.forEach(fs => {
            html.classList.remove(`font-size-${fs}`);
        });
        
        // Apply new font size
        html.setAttribute('data-font-size', size);
        html.classList.add(`font-size-${size}`);

        // Adjust spacing for larger fonts
        if (size === 'large' || size === 'extra-large') {
            html.style.setProperty('--spacing-scale', size === 'extra-large' ? '1.2' : '1.1');
        } else {
            html.style.removeProperty('--spacing-scale');
        }
    }

    setHighContrast(enabled) {
        this.highContrast = enabled;
        localStorage.setItem('highContrast', enabled.toString());
        this.applyHighContrast(enabled);
        this.notifyAccessibilityChange();
    }

    applyHighContrast(enabled) {
        const html = document.documentElement;
        
        if (enabled) {
            html.setAttribute('data-theme', 'high-contrast');
            html.classList.add('high-contrast');
        } else {
            html.classList.remove('high-contrast');
            // Restore previous theme if not in high contrast mode
            if (html.getAttribute('data-theme') === 'high-contrast') {
                this.applyTheme(this.currentTheme);
            }
        }
    }

    setReducedMotion(enabled) {
        this.reducedMotion = enabled;
        localStorage.setItem('reducedMotion', enabled.toString());
        this.applyReducedMotion(enabled);
        this.notifyAccessibilityChange();
    }

    applyReducedMotion(enabled) {
        const html = document.documentElement;
        
        if (enabled) {
            html.classList.add('reduced-motion');
            // Override animation durations
            html.style.setProperty('--animation-speed-fast', '0.01ms');
            html.style.setProperty('--animation-speed-normal', '0.01ms');
            html.style.setProperty('--animation-speed-slow', '0.01ms');
            html.style.setProperty('--animation-speed-very-slow', '0.01ms');
        } else {
            html.classList.remove('reduced-motion');
            // Restore original animation speeds
            html.style.removeProperty('--animation-speed-fast');
            html.style.removeProperty('--animation-speed-normal');
            html.style.removeProperty('--animation-speed-slow');
            html.style.removeProperty('--animation-speed-very-slow');
        }
    }

    // Color blind friendly theme
    setColorBlindFriendly(type) {
        const html = document.documentElement;
        
        // Remove existing color blind themes
        html.classList.remove('protanopia', 'deuteranopia', 'tritanopia');
        
        if (type && ['protanopia', 'deuteranopia', 'tritanopia'].includes(type)) {
            html.classList.add(type);
            html.setAttribute('data-accessibility', 'colorblind');
        } else {
            html.removeAttribute('data-accessibility');
        }
        
        localStorage.setItem('colorBlindType', type || '');
        this.notifyAccessibilityChange();
    }

    // Blue light filter
    setBlueLightFilter(enabled, intensity = 'medium') {
        const html = document.documentElement;
        
        if (enabled) {
            html.setAttribute('data-theme', 'blue-light-filter');
            html.style.setProperty('--blue-light-intensity', intensity);
        } else {
            if (html.getAttribute('data-theme') === 'blue-light-filter') {
                this.applyTheme(this.currentTheme);
            }
            html.style.removeProperty('--blue-light-intensity');
        }
        
        localStorage.setItem('blueLightFilter', enabled.toString());
        localStorage.setItem('blueLightIntensity', intensity);
    }

    // Theme persistence across page loads
    getThemePreferences() {
        return {
            theme: this.currentTheme,
            fontSize: this.currentFontSize,
            highContrast: this.highContrast,
            reducedMotion: this.reducedMotion,
            colorBlindType: localStorage.getItem('colorBlindType') || '',
            blueLightFilter: localStorage.getItem('blueLightFilter') === 'true'
        };
    }

    setThemePreferences(preferences) {
        if (preferences.theme) this.setTheme(preferences.theme);
        if (preferences.fontSize) this.setFontSize(preferences.fontSize);
        if (preferences.highContrast !== undefined) this.setHighContrast(preferences.highContrast);
        if (preferences.reducedMotion !== undefined) this.setReducedMotion(preferences.reducedMotion);
        if (preferences.colorBlindType) this.setColorBlindFriendly(preferences.colorBlindType);
        if (preferences.blueLightFilter !== undefined) this.setBlueLightFilter(preferences.blueLightFilter);
    }

    // Event notifications
    notifyThemeChange() {
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: {
                theme: this.currentTheme,
                appliedTheme: this.getAppliedTheme()
            }
        }));
    }

    notifyFontSizeChange() {
        window.dispatchEvent(new CustomEvent('fontSizeChanged', {
            detail: { fontSize: this.currentFontSize }
        }));
    }

    notifyAccessibilityChange() {
        window.dispatchEvent(new CustomEvent('accessibilityChanged', {
            detail: this.getAccessibilitySettings()
        }));
    }

    getAppliedTheme() {
        if (this.currentTheme === 'auto') {
            return this.systemPreference.matches ? 'dark' : 'light';
        }
        return this.currentTheme;
    }

    getAccessibilitySettings() {
        return {
            highContrast: this.highContrast,
            reducedMotion: this.reducedMotion,
            fontSize: this.currentFontSize,
            colorBlindType: localStorage.getItem('colorBlindType') || '',
            blueLightFilter: localStorage.getItem('blueLightFilter') === 'true'
        };
    }

    // Analytics and tracking
    trackThemeChange(theme) {
        // Track theme usage for analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'theme_change', {
                theme_name: theme,
                custom_parameter: 'user_preference'
            });
        }
        
        console.log(`Theme changed to: ${theme}`);
    }

    // Print-specific theme handling
    setupPrintStyles() {
        const printMedia = window.matchMedia('print');
        printMedia.addEventListener('change', (e) => {
            if (e.matches) {
                // Apply print-friendly theme
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                // Restore original theme
                this.applyTheme(this.currentTheme);
            }
        });
    }

    // Preload theme assets
    preloadThemeAssets() {
        // Preload theme-specific CSS if using separate files
        const themes = ['light', 'dark'];
        themes.forEach(theme => {
            if (theme !== this.currentTheme) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.href = `/static/css/themes/${theme}.css`;
                link.as = 'style';
                document.head.appendChild(link);
            }
        });
    }

    // Export theme settings
    exportThemeSettings() {
        const settings = {
            theme: this.currentTheme,
            fontSize: this.currentFontSize,
            highContrast: this.highContrast,
            reducedMotion: this.reducedMotion,
            colorBlindType: localStorage.getItem('colorBlindType') || '',
            blueLightFilter: localStorage.getItem('blueLightFilter') === 'true',
            exportDate: new Date().toISOString()
        };
        
        return JSON.stringify(settings, null, 2);
    }

    // Import theme settings
    importThemeSettings(settingsJson) {
        try {
            const settings = JSON.parse(settingsJson);
            this.setThemePreferences(settings);
            return true;
        } catch (error) {
            console.error('Invalid theme settings format:', error);
            return false;
        }
    }
}

// Global theme functions
window.changeTheme = (theme) => themeManager.setTheme(theme);
window.toggleTheme = () => themeManager.toggleTheme();
window.changeFontSize = (size) => themeManager.setFontSize(size);
window.toggleHighContrast = (enabled) => themeManager.setHighContrast(enabled);
window.toggleReducedMotion = (enabled) => themeManager.setReducedMotion(enabled);

// Initialize theme manager
const themeManager = new ThemeManager();

// Setup print styles
themeManager.setupPrintStyles();

// Export for use in other modules
window.themeManager = themeManager;
