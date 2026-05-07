import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'io.github.ithie',
    appName: 'SAR: Callsign WOLF',
    webDir: 'dist',
    ios: {
        scheme: 'app',
        hostname: 'localhost',
        scrollEnabled: false,
        backgroundColor: '#050505',
        allowsLinkPreview: false,
        limitsNavigationsToAppBoundDomains: true,
        // Orientation (landscape) + UIRequiresFullScreen: in Xcode → General → Device Orientation
        // AllowInlineMediaPlayback: in Xcode → set WKWebView allowsInlineMediaPlayback via AppDelegate
    },
};

export default config;
