'use strict';

import PackageJSON from '../package.json';
import VideoAd from './components/VideoAd';
import EventBus from './components/EventBus';
import ImplementationTest from './components/ImplementationTest';

import {dankLog} from './modules/dankLog';
import {
    extendDefaults,
    getCookie,
} from './modules/common';

let instance = null;

/**
 * SDK
 */
class SDK {
    /**
     * Constructor of SDK.
     * @param {Object} options
     * @return {*}
     */
    constructor(options) {
        // Make this a singleton.
        if (instance) {
            return instance;
        } else {
            instance = this;
        }

        // Set some defaults. We replace them with real given
        // values further down.
        const defaults = {
            debug: false,
            debugIMA: false,
            prefix: 'tunnl-',
            autoplay: true,
            responsive: true,
            width: 640,
            height: 360,
            locale: 'en',
            container: '',
            resumeGame: function() {
                // Legacy implementations.
            },
            pauseGame: function() {
                // Legacy implementations.
            },
            onEvent: function(event) {
                // ...
            },
            onInit: function(data) {
                // ...
            },
            onError: function(data) {
                // ...
            },
        };

        if (options) {
            this.options = extendDefaults(defaults, options);
        } else {
            this.options = defaults;
        }

        // Open the debug console when debugging is enabled.
        try {
            if (this.options.debug || localStorage.getItem('tunnl_debug')) {
                this.openConsole();
            }
        } catch (error) {
            console.log(error);
        }

        // Set a version banner within the developer console.
        const version = PackageJSON.version;
        const banner = console.log(
            '%c %c %c Tunnl.com Advertisement SDK | Version: ' +
            version + ' %c %c %c', 'background: #9854d8',
            'background: #6c2ca7', 'color: #fff; background: #450f78;',
            'background: #6c2ca7', 'background: #9854d8',
            'background: #ffffff');
        /* eslint-disable */
        console.log.apply(console, banner);
        /* eslint-enable */

        const url = (document.location.href.indexOf('localhost') !== -1)
            ? 'https://gamedistribution.com/'
            : document.location.href;

        // Call Google Analytics.
        this._googleAnalytics();

        // Call Death Star.
        this._deathStar();

        // Setup all event listeners.
        // We also send a Google Analytics event for each one of our events.
        this.eventBus = new EventBus();

        // SDK events
        this.eventBus.subscribe('SDK_READY', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SDK_ERROR', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SDK_CONTENT_START',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SDK_CONTENT_PAUSE',
            (arg) => this._onEvent(arg));

        // IMA HTML5 SDK events
        this.eventBus.subscribe('AD_SDK_LOADER_READY',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_MANAGER_READY',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_REQUEST_ADS',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_ERROR', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_FINISHED', (arg) => this._onEvent(arg));

        // Ad events
        this.eventBus.subscribe('AD_CANCELED', (arg) => {
            this._onEvent(arg);
            this.onResume(
                'Advertisement error, no worries, start / resume to content.',
                'warning');
        });
        this.eventBus.subscribe('AD_ERROR', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SAFETY_TIMER', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_BREAK_READY', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_METADATA', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('ALL_ADS_COMPLETED',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('CLICK', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('COMPLETE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('CONTENT_PAUSE_REQUESTED', (arg) => {
            this._onEvent(arg);
            this.onPause('New advertisements requested and loaded',
                'success');
        });
        this.eventBus.subscribe('CONTENT_RESUME_REQUESTED',
            (arg) => {
                this._onEvent(arg);
                this.onResume(
                    'Advertisement(s) are done. Start / resume to content.',
                    'success');
            });
        this.eventBus.subscribe('DURATION_CHANGE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('FIRST_QUARTILE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('IMPRESSION', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('INTERACTION', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('LINEAR_CHANGED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('LOADED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('LOG', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('MIDPOINT', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('PAUSED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('RESUMED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SKIPPABLE_STATE_CHANGED',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SKIPPED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('STARTED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('THIRD_QUARTILE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('USER_CLOSE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('VOLUME_CHANGED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('VOLUME_MUTED', (arg) => this._onEvent(arg));

        // Only allow ads after the pre-roll and after a certain amount of time.
        this.adRequestTimer = undefined;
        this.adRequestDelay = 60000;

        // Start our advertisement instance. Setting up the
        // adsLoader should resolve VideoAdPromise.
        this.videoAdInstance = new VideoAd(this.options);

        // Auto play of video advertisements won't work on mobile devices.
        // Causing the video to be paused.
        const mobile = (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ||
            (navigator.userAgent.toLowerCase().indexOf('android') > -1);
        const adType = (mobile)
            ? '&ad_type=image'
            : '';

        // Create the actual ad tag.
        this.videoAdInstance.tag = 'https://pub.tunnl.com/opp' +
            '?page_url=' + encodeURIComponent(url) +
            '&player_width=640' +
            '&player_height=480' + adType +
            '&asset_id=0';

        // Enable some debugging perks.
        try {
            if (localStorage.getItem('tunnl_debug')) {
                // So we can set a custom tag.
                if (localStorage.getItem('tunnl_tag')) {
                    this.videoAdInstance.tag =
                        localStorage.getItem('tunnl_tag');
                }
                // So we can call mid rolls quickly.
                if (localStorage.getItem('tunnl_midroll')) {
                    this.adRequestDelay =
                        localStorage.getItem('tunnl_midroll');
                }
            }
        } catch (error) {
            console.log(error);
        }

        // Ad ready or failed.
        // Setup our video ad promise, which should be resolved before an ad
        // can be called.
        this.videoAdPromise = new Promise((resolve, reject) => {
            // The ad is preloaded and ready.
            this.eventBus.subscribe('AD_SDK_LOADER_READY', (arg) => resolve());
            // The IMA SDK failed.
            this.eventBus.subscribe('AD_SDK_ERROR', (arg) => reject());
            // It can happen that the first ad request failed... unlucky.
            this.eventBus.subscribe('AD_CANCELED', (arg) => reject());
        });

        // Now check if everything is ready.
        this.videoAdPromise.then(() => {
            // Handle auto play behaviour.
            // Video auto play capabilities are tested within the
            // VideoAd constructor. We have to test this because browsers will
            // slowly stop support for auto play.
            // Thus we check if auto play is enabled and supported.
            // If so, then we start the adRequestTimer, blocking any attempts
            // to call any subsequent advertisement too soon, as the ad
            // will be called automatically from our video advertisement
            // instance, instead of calling the showBanner method.
            if (this.videoAdInstance.options.autoplay) {
                this.videoAdInstance.play();
                this.adRequestTimer = new Date();
            } else {
                this.onResume('Just resume to the content...', 'success');
            }

            let eventName = 'SDK_READY';
            let eventMessage = 'Everything is ready.';
            this.eventBus.broadcast(eventName, {
                name: eventName,
                message: eventMessage,
                status: 'success',
                analytics: {
                    category: 'SDK',
                    action: eventName,
                    label: eventMessage,
                },
            });
        }).catch(() => {
            let eventName = 'SDK_ERROR';
            let eventMessage = 'The SDK failed.';
            this.eventBus.broadcast(eventName, {
                name: eventName,
                message: eventMessage,
                status: 'error',
                analytics: {
                    category: 'SDK',
                    action: eventName,
                    label: eventMessage,
                },
            });
            return false;
        });
    }

    /**
     * _onEvent
     * Gives us a nice console log message for all our events going
     * through the EventBus.
     * @param {Object} event
     * @private
     */
    _onEvent(event) {
        // Show the event in the log.
        dankLog(event.name, event.message, event.status);
        // Push out a Google event for each event. Makes our
        // life easier. I think.
        try {
            /* eslint-disable */
            if (typeof window['ga'] !== 'undefined') {
                window['ga']('gd.send', {
                    hitType: 'event',
                    eventCategory: (event.analytics.category)
                        ? event.analytics.category
                        : '',
                    eventAction: (event.analytics.action)
                        ? event.analytics.action
                        : '',
                    eventLabel: (event.analytics.label)
                        ? event.analytics.label
                        : '',
                });
            }
            /* eslint-enable */
        } catch (error) {
            console.log(error);
        }
        // Now send the event to the developer.
        this.options.onEvent(event);
    }

    /**
     * _googleAnalytics
     * @private
     */
    _googleAnalytics() {
        /* eslint-disable */
        // Load Google Analytics so we can push out a Google event for
        // each of our events.
        if (typeof window['ga'] === 'undefined') {
            (function(i, s, o, g, r, a, m) {
                i['GoogleAnalyticsObject'] = r;
                i[r] = i[r] || function() {
                    (i[r].q = i[r].q || []).push(arguments);
                }, i[r].l = 1 * new Date();
                a = s.createElement(o),
                    m = s.getElementsByTagName(o)[0];
                a.async = 1;
                a.src = g;
                m.parentNode.insertBefore(a, m);
            })(window, document, 'script',
                'https://www.google-analytics.com/analytics.js', 'ga');
        }
        window['ga']('create', 'UA-60359297-23', {'name': 'gd'}, 'auto');
        // Inject Death Star id's to the page view.
        const lcl = getCookie('brzcrz_local');
        if (lcl) {
            window['ga']('gd.set', 'userId', lcl);
            window['ga']('gd.set', 'dimension1', lcl);
        }
        window['ga']('gd.send', 'pageview');

    }

    /**
     * _deathStar
     * @private
     */
    _deathStar() {
        // Project Death Star.
        // https://bitbucket.org/keygamesnetwork/datacollectionservice
        const script = document.createElement('script');
        script.innerHTML = `
            var DS_OPTIONS = {
                id: 'TUNNL',
                success: function(id) {
                    window['ga']('gd.set', 'userId', id); 
                    window['ga']('gd.set', 'dimension1', id);
                }
            }
        `;
        document.head.appendChild(script);

        // Load Death Star
        (function(window, document, element, source) {
            const ds = document.createElement(element);
            const m = document.getElementsByTagName(element)[0];
            ds.type = 'text/javascript';
            ds.async = true;
            ds.src = source;
            m.parentNode.insertBefore(ds, m);
        })(window, document, 'script',
            'https://game.gamemonkey.org/static/main.min.js');
        /* eslint-enable */
    }

    /**
     * showBanner
     * Used by our developer to call a video advertisement.
     * @public
     */
    showBanner() {
        this.videoAdPromise.then(() => {
            // Check if ad is not called too often.
            if (typeof this.adRequestTimer !== 'undefined') {
                const elapsed = (new Date()).valueOf() -
                    this.adRequestTimer.valueOf();
                if (elapsed < this.adRequestDelay) {
                    dankLog('SDK_SHOW_BANNER',
                        'The advertisement was requested too soon after ' +
                        'the previous advertisement was finished.',
                        'warning');
                    // Resume to content for legacy purposes.
                    this.onResume(
                        'Just resume to the content...',
                        'success');
                } else {
                    dankLog('SDK_SHOW_BANNER',
                        'Requested the midroll advertisement.',
                        'success');
                    this.videoAdInstance.play();
                    this.adRequestTimer = new Date();
                }
            } else {
                dankLog('SDK_SHOW_BANNER',
                    'Requested the preroll advertisement.',
                    'success');
                this.videoAdInstance.play();
                this.adRequestTimer = new Date();
            }
        }).catch((error) => {
            dankLog('SDK_SHOW_BANNER', error, 'error');
        });
    }

    /**
     * onResume
     * Called from various moments within the SDK. This sends
     * out a callback to our developer, so he/ she can allow the content to
     * resume again.
     * @param {String} message
     * @param {String} status
     */
    onResume(message, status) {
        this.options.resumeGame(); // Legacy implementations.
        let eventName = 'SDK_CONTENT_START';
        this.eventBus.broadcast(eventName, {
            name: eventName,
            message: message,
            status: status,
            analytics: {
                category: 'SDK',
                action: eventName,
                label: status,
            },
        });
    }

    /**
     * onPause
     * Called from various moments within the SDK. This sends
     * out a callback to pause the content.
     * @param {String} message
     * @param {String} status
     */
    onPause(message, status) {
        this.options.pauseGame(); // Legacy implementations.
        let eventName = 'SDK_CONTENT_PAUSE';
        this.eventBus.broadcast(eventName, {
            name: eventName,
            message: message,
            status: status,
            analytics: {
                category: 'SDK',
                action: eventName,
                label: status,
            },
        });
    }

    /**
     * openConsole
     * Enable debugging, we also set a value in localStorage,
     * so we can also enable debugging without setting the property.
     * This is nice for when we're trying to debug content that is not ours.
     * @public
     */
    openConsole() {
        try {
            const implementation = new ImplementationTest();
            implementation.start();
            localStorage.setItem('tunnl_debug', true);
        } catch (error) {
            console.log(error);
        }
    }
}

export default SDK;
