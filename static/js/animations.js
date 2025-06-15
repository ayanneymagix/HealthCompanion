// MediTranslate+ Animation System

class AnimationManager {
    constructor() {
        this.isAnimationEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.animationQueue = [];
        this.observers = new Map();
        this.animationRegistry = new Map();
        this.performanceMode = this.detectPerformanceMode();
        
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.setupMutationObserver();
        this.registerDefaultAnimations();
        this.setupEventListeners();
        this.optimizeForPerformance();
    }

    detectPerformanceMode() {
        // Simple performance detection
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const isSlowConnection = connection && (connection.saveData || connection.effectiveType === 'slow-2g');
        const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
        
        return isSlowConnection || isLowMemory ? 'low' : 'high';
    }

    setupEventListeners() {
        // Reduced motion preference change
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionQuery.addEventListener('change', (e) => {
            this.isAnimationEnabled = !e.matches;
            this.toggleAnimations(this.isAnimationEnabled);
        });

        // Visibility change for performance
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAllAnimations();
            } else {
                this.resumeAllAnimations();
            }
        });

        // Battery API for performance optimization
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                battery.addEventListener('levelchange', () => {
                    if (battery.level < 0.2) {
                        this.enablePowerSavingMode();
                    }
                });
            });
        }
    }

    setupIntersectionObserver() {
        // Observe elements entering viewport for animations
        const options = {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        };

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.triggerElementAnimations(entry.target);
                }
            });
        }, options);

        // Observe elements with animation classes
        this.observeAnimatedElements();
    }

    setupMutationObserver() {
        // Watch for new elements being added to DOM
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.observeNewElements(node);
                    }
                });
            });
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    observeAnimatedElements() {
        const animatedElements = document.querySelectorAll(`
            .fade-in-up, .fade-in-down, .fade-in-left, .fade-in-right,
            .slide-in-up, .slide-in-down, .slide-in-left, .slide-in-right,
            .bounce-in, .zoom-in, .rotate-in, .stagger-animation > *
        `);

        animatedElements.forEach(element => {
            this.intersectionObserver.observe(element);
        });
    }

    observeNewElements(element) {
        const animatedElements = element.querySelectorAll(`
            .fade-in-up, .fade-in-down, .fade-in-left, .fade-in-right,
            .slide-in-up, .slide-in-down, .slide-in-left, .slide-in-right,
            .bounce-in, .zoom-in, .rotate-in, .stagger-animation > *
        `);

        animatedElements.forEach(el => {
            this.intersectionObserver.observe(el);
        });
    }

    triggerElementAnimations(element) {
        if (!this.isAnimationEnabled) return;

        // Remove initial hidden state
        element.style.opacity = '';
        element.style.transform = '';

        // Add animation class if not already present
        const animationClasses = [
            'fade-in-up', 'fade-in-down', 'fade-in-left', 'fade-in-right',
            'slide-in-up', 'slide-in-down', 'slide-in-left', 'slide-in-right',
            'bounce-in', 'zoom-in', 'rotate-in'
        ];

        const hasAnimationClass = animationClasses.some(cls => element.classList.contains(cls));
        
        if (hasAnimationClass) {
            element.classList.add('animate');
            
            // Handle stagger animations
            if (element.parentElement?.classList.contains('stagger-animation')) {
                this.handleStaggerAnimation(element.parentElement);
            }
        }

        // Stop observing this element
        this.intersectionObserver.unobserve(element);
    }

    handleStaggerAnimation(container) {
        const children = Array.from(container.children);
        const delay = 100; // Base delay in ms

        children.forEach((child, index) => {
            setTimeout(() => {
                child.style.animationDelay = `${index * 0.1}s`;
                child.classList.add('animate');
            }, index * delay);
        });
    }

    registerDefaultAnimations() {
        // Page load animations
        this.registerAnimation('pageLoad', {
            elements: 'body',
            animation: 'fade-in',
            duration: 300,
            delay: 0
        });

        // Card hover animations
        this.registerAnimation('cardHover', {
            elements: '.card, .feature-card',
            trigger: 'hover',
            animation: 'hover-lift',
            duration: 200
        });

        // Button click animations
        this.registerAnimation('buttonClick', {
            elements: '.btn',
            trigger: 'click',
            animation: 'pulse-on-click',
            duration: 300
        });

        // Modal animations
        this.registerAnimation('modalShow', {
            elements: '.modal',
            trigger: 'show',
            animation: 'zoom-in',
            duration: 300
        });
    }

    registerAnimation(name, config) {
        this.animationRegistry.set(name, config);
    }

    playAnimation(name, target) {
        const config = this.animationRegistry.get(name);
        if (!config || !this.isAnimationEnabled) return;

        const elements = target || document.querySelectorAll(config.elements);
        const elementsArray = Array.isArray(elements) ? elements : [elements];

        elementsArray.forEach((element, index) => {
            if (!element) return;

            const delay = config.delay + (index * (config.stagger || 0));
            
            setTimeout(() => {
                element.classList.add(config.animation);
                
                // Remove animation class after completion
                setTimeout(() => {
                    element.classList.remove(config.animation);
                }, config.duration);
            }, delay);
        });
    }

    // Scroll-triggered animations
    setupScrollAnimations() {
        let ticking = false;

        const updateScrollAnimations = () => {
            const scrollY = window.pageYOffset;
            const windowHeight = window.innerHeight;

            // Parallax effects
            this.updateParallaxElements(scrollY);

            // Progress indicators
            this.updateProgressIndicators(scrollY);

            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking && this.isAnimationEnabled) {
                requestAnimationFrame(updateScrollAnimations);
                ticking = true;
            }
        });
    }

    updateParallaxElements(scrollY) {
        const parallaxElements = document.querySelectorAll('.parallax');
        
        parallaxElements.forEach(element => {
            const speed = element.dataset.speed || 0.5;
            const yPos = -(scrollY * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    }

    updateProgressIndicators(scrollY) {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollY / totalHeight) * 100;
        
        const progressBars = document.querySelectorAll('.scroll-progress');
        progressBars.forEach(bar => {
            bar.style.width = `${progress}%`;
        });
    }

    // Counter animations
    animateCounters() {
        const counters = document.querySelectorAll('.counter');
        
        counters.forEach(counter => {
            const target = parseInt(counter.dataset.target || counter.textContent);
            const duration = parseInt(counter.dataset.duration || 2000);
            const increment = target / (duration / 16); // 60fps
            
            let current = 0;
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                counter.textContent = Math.floor(current);
            }, 16);
        });
    }

    // Text animations
    animateText(element, animation = 'typewriter') {
        if (!this.isAnimationEnabled) {
            return;
        }

        switch (animation) {
            case 'typewriter':
                this.typewriterEffect(element);
                break;
            case 'fadeInWords':
                this.fadeInWords(element);
                break;
            case 'slideInLetters':
                this.slideInLetters(element);
                break;
        }
    }

    typewriterEffect(element) {
        const text = element.textContent;
        const speed = element.dataset.speed || 50;
        
        element.textContent = '';
        element.style.borderRight = '2px solid';
        
        let i = 0;
        const timer = setInterval(() => {
            element.textContent += text.charAt(i);
            i++;
            
            if (i >= text.length) {
                clearInterval(timer);
                setTimeout(() => {
                    element.style.borderRight = 'none';
                }, 1000);
            }
        }, speed);
    }

    fadeInWords(element) {
        const text = element.textContent;
        const words = text.split(' ');
        
        element.innerHTML = words.map(word => 
            `<span class="word-fade" style="opacity: 0;">${word}</span>`
        ).join(' ');
        
        const wordElements = element.querySelectorAll('.word-fade');
        wordElements.forEach((word, index) => {
            setTimeout(() => {
                word.style.transition = 'opacity 0.5s ease';
                word.style.opacity = '1';
            }, index * 100);
        });
    }

    slideInLetters(element) {
        const text = element.textContent;
        element.innerHTML = text.split('').map(letter => 
            `<span class="letter-slide" style="transform: translateY(20px); opacity: 0;">${letter === ' ' ? '&nbsp;' : letter}</span>`
        ).join('');
        
        const letterElements = element.querySelectorAll('.letter-slide');
        letterElements.forEach((letter, index) => {
            setTimeout(() => {
                letter.style.transition = 'all 0.3s ease';
                letter.style.transform = 'translateY(0)';
                letter.style.opacity = '1';
            }, index * 30);
        });
    }

    // Loading animations
    showLoadingAnimation(container, type = 'spinner') {
        const loadingElement = this.createLoadingElement(type);
        container.appendChild(loadingElement);
        return loadingElement;
    }

    createLoadingElement(type) {
        const element = document.createElement('div');
        element.className = `loading-animation loading-${type}`;
        
        switch (type) {
            case 'spinner':
                element.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
                break;
            case 'dots':
                element.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
                break;
            case 'pulse':
                element.innerHTML = '<div class="loading-pulse"></div>';
                break;
            case 'skeleton':
                element.innerHTML = '<div class="skeleton-loading"></div>';
                break;
        }
        
        return element;
    }

    hideLoadingAnimation(loadingElement) {
        if (loadingElement && loadingElement.parentNode) {
            loadingElement.style.opacity = '0';
            setTimeout(() => {
                loadingElement.remove();
            }, 300);
        }
    }

    // Performance optimizations
    optimizeForPerformance() {
        if (this.performanceMode === 'low') {
            // Disable expensive animations
            document.documentElement.style.setProperty('--animation-speed-fast', '0.1s');
            document.documentElement.style.setProperty('--animation-speed-normal', '0.2s');
            document.documentElement.style.setProperty('--animation-speed-slow', '0.3s');
            
            // Disable parallax and complex effects
            this.disableComplexAnimations();
        }
    }

    enablePowerSavingMode() {
        this.isAnimationEnabled = false;
        this.pauseAllAnimations();
        document.documentElement.classList.add('power-saving');
    }

    disableComplexAnimations() {
        const complexSelectors = [
            '.parallax',
            '.float',
            '.wobble',
            '.complex-animation'
        ];
        
        complexSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.animation = 'none';
                element.style.transform = 'none';
            });
        });
    }

    pauseAllAnimations() {
        document.querySelectorAll('*').forEach(element => {
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.animationName !== 'none') {
                element.style.animationPlayState = 'paused';
            }
        });
    }

    resumeAllAnimations() {
        document.querySelectorAll('*').forEach(element => {
            element.style.animationPlayState = 'running';
        });
    }

    toggleAnimations(enabled) {
        this.isAnimationEnabled = enabled;
        
        if (enabled) {
            document.documentElement.classList.remove('no-animations');
            this.resumeAllAnimations();
        } else {
            document.documentElement.classList.add('no-animations');
            this.pauseAllAnimations();
        }
    }

    // Utility functions
    addBounceToElement(element) {
        element.classList.add('bounce-in');
        setTimeout(() => {
            element.classList.remove('bounce-in');
        }, 600);
    }

    addShakeToElement(element) {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    }

    pulseElement(element, duration = 1000) {
        element.classList.add('pulse');
        setTimeout(() => {
            element.classList.remove('pulse');
        }, duration);
    }

    // Chain animations
    chainAnimations(animations) {
        return animations.reduce((promise, animation) => {
            return promise.then(() => {
                return new Promise(resolve => {
                    this.playAnimation(animation.name, animation.target);
                    setTimeout(resolve, animation.duration || 300);
                });
            });
        }, Promise.resolve());
    }

    // Cleanup
    destroy() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        this.animationQueue = [];
        this.observers.clear();
        this.animationRegistry.clear();
    }
}

// Global animation functions
window.animateElement = (element, animation) => animationManager.playAnimation(animation, element);
window.animateText = (element, type) => animationManager.animateText(element, type);
window.animateCounters = () => animationManager.animateCounters();
window.showLoading = (container, type) => animationManager.showLoadingAnimation(container, type);
window.hideLoading = (element) => animationManager.hideLoadingAnimation(element);

// Initialize animation manager
const animationManager = new AnimationManager();

// Setup scroll animations
animationManager.setupScrollAnimations();

// Auto-animate counters when visible
document.addEventListener('DOMContentLoaded', () => {
    const counters = document.querySelectorAll('.counter');
    if (counters.length > 0) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animationManager.animateCounters();
                    counterObserver.unobserve(entry.target);
                }
            });
        });
        
        counters.forEach(counter => counterObserver.observe(counter));
    }
});

// Export for use in other modules
window.animationManager = animationManager;
