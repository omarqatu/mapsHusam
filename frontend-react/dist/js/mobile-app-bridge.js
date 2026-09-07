/**
 * mobile-app-bridge.js
 * Small browser/WebView contract for the future native application shell.
 */
(function () {
    'use strict';

    function getNativeTarget() {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            return { type: 'react-native', target: window.ReactNativeWebView };
        }
        if (window.AndroidBridge && typeof window.AndroidBridge.postMessage === 'function') {
            return { type: 'android', target: window.AndroidBridge };
        }
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.app) {
            return { type: 'ios', target: window.webkit.messageHandlers.app };
        }
        return null;
    }

    function post(command, payload) {
        const message = JSON.stringify({
            source: 'psm-web',
            command,
            payload: payload || {},
            timestamp: new Date().toISOString()
        });
        const nativeTarget = getNativeTarget();
        if (!nativeTarget) return false;

        try {
            nativeTarget.target.postMessage(message);
            return true;
        } catch (error) {
            console.warn('mobile-app-bridge: native message failed', error);
            return false;
        }
    }

    window.MobileAppBridge = {
        isNative: function () { return !!getNativeTarget(); },
        post: post,
        ready: function (screen) { return post('web-ready', { screen: screen || document.title }); },
        openExternal: function (url) { return post('open-external', { url }); },
        requestNotifications: function () { return post('request-notifications'); },
        requestLocation: function () { return post('request-location'); }
    };

    window.addEventListener('mobileappback', function () {
        document.dispatchEvent(new CustomEvent('mobile-app-back'));
    });
})();
