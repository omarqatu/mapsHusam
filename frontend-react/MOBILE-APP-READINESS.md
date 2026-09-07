# Mobile App Readiness

This project is prepared as a responsive web application first, with a small WebView bridge for a future Android or iOS shell.

## Current mobile surfaces

- Interactive map: `public/js/mobile-tabs.js` and `public/css/mobile-tabs.css`
- No-map search: `public/js/no-map-mobile.js` and `public/css/no-map-search.css`
- Native bridge: `public/js/mobile-app-bridge.js`

The no-map page is initialized for phone and tablet widths up to 1024px. The map page keeps its existing portrait and landscape tab system.

## Native bridge contract

The web page sends JSON messages through one of these native targets when available:

- React Native: `window.ReactNativeWebView.postMessage`
- Android WebView: `window.AndroidBridge.postMessage`
- iOS WKWebView: `window.webkit.messageHandlers.app.postMessage`

Messages sent by the web page:

- `web-ready`: page is ready; payload contains `screen`
- `open-external`: request to open an external URL
- `request-notifications`: request native notification permission
- `request-location`: request native location permission

The browser remains unaffected when none of these targets exists.

## Native app responsibilities later

1. Load the deployed web origin over HTTPS; do not bundle database credentials or server secrets.
2. Handle the bridge commands above and return results through a documented custom event.
3. Request GPS and notification permissions using native APIs.
4. Forward the hardware back button to `mobileappback`, then let the page close a modal/panel before leaving the page.
5. Preserve cookies or the application session securely inside the WebView.
6. Test keyboard resize, safe-area insets, orientation changes, offline errors, and slow network states.
7. Keep API URLs relative so development proxy and production hosting remain interchangeable.

## Release checklist

- Run `npm run build`.
- Deploy the generated `dist` directory to the web server.
- Test the map at phone portrait, phone landscape, tablet portrait, and tablet landscape sizes.
- Test no-map search at the same four sizes, including category navigation, filters, results, GPS actions, and notifications.
- Verify the native app uses HTTPS and the production API origin.
- Verify Android back, iOS swipe/back navigation, GPS denial, notification denial, and external links.
