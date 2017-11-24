'use strict';

/**
 * So here we make sure everything is backwards compatible with the old GD SDK.
 * This is the main entry for a CDN hosted build.
 * The main entry for including the SDK as npm package is main.js.
 */
import SDK from './main';

const settings = (typeof TUNNL_OPTIONS === 'object' && TUNNL_OPTIONS)
    ? TUNNL_OPTIONS
    : (typeof window.vooxePreroll === 'object' && window.vooxePreroll)
        ? window.vooxePreroll
        : {};
window.tunnl = new SDK(settings);
