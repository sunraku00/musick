import { app, session, type BrowserWindow } from 'electron';

/**
 * Modul konfigurasi keamanan ketat sesuai Prinsip 5 PRD dan Pedoman Keamanan:
 * 1. contextIsolation: true, nodeIntegration: false, sandbox: true
 * 2. CSP ketat (connect-src 'none' di UI, karena UI dilarang melakukan fetch langsung)
 * 3. Navigasi eksternal dan jendela baru diblokir
 * 4. Permintaan izin perangkat (kamera, mikrofon, geolokasi) ditolak 100%
 * 5. Webview disabilitas total
 */
export function setupSecurityPolicies(mainWindow: BrowserWindow): void {
  const isDev = !app.isPackaged;

  // Konfigurasi Content Security Policy lewat session headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Di mode dev, Vite butuh connect-src ke ws:// untuk HMR. Di mode produksi: connect-src 'none'.
    const connectSrc = isDev ? "connect-src 'self' ws://localhost:* http://localhost:*;" : "connect-src 'none';";
    const csp = [
      "default-src 'self';",
      "script-src 'self';",
      "style-src 'self' 'unsafe-inline';",
      "img-src 'self' data: https://*.ytimg.com https://*.googleusercontent.com https://*.ggpht.com https://i.ytimg.com;",
      "media-src 'self' data: blob: https://*.googlevideo.com;",
      connectSrc,
      "font-src 'self' data:;",
      "object-src 'none';",
      "base-uri 'none';",
      "form-action 'none';",
      "frame-ancestors 'none';",
    ].join(' ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // Blokir navigasi jendela (will-navigate)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // Izinkan navigasi internal hanya ke URL dev lokal
    const allowed = isDev && (navigationUrl.startsWith('http://localhost:') || navigationUrl.startsWith('http://127.0.0.1:'));
    if (!allowed) {
      event.preventDefault();
      console.warn(`[Security] Navigasi ke ${navigationUrl} diblokir.`);
    }
  });

  // Blokir pembuatan jendela baru (window.open, target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[Security] Pembukaan jendela baru ke ${url} ditolak.`);
    return { action: 'deny' };
  });

  // Tolak seluruh permintaan izin (microphone, camera, geolocation, notification)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  // Blokir attach webview tag
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (webviewEvent) => {
      webviewEvent.preventDefault();
      console.warn('[Security] will-attach-webview diblokir.');
    });
  });
}
