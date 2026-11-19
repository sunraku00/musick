import { app, BrowserWindow, protocol, net } from 'electron';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { bridgeManager } from './bridgeManager';
import { SourceManager, registerIpcHandlers } from './ipcHandlers';
import { setupSecurityPolicies } from './security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keamanan Rilis: Blokir bendera remote-debugging-port di build rilis secara default.
// Hanya build uji khusus dengan variabel MUSICK_TEST_HARNESS=1 yang dapat membuka port CDP.
if (!process.env.MUSICK_TEST_HARNESS) {
  app.commandLine.removeSwitch('remote-debugging-port');
}

// Registrasi skema app:// sebagai privileged sebelum app siap
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
const sourceManager = new SourceManager();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Musick',
    width: 1024,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#121212',
    webPreferences: {
      // PRD Prinsip 5: Keamanan UI tanpa akses Node langsung
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.cjs'),
    },
  });

  // Terapkan kebijakan keamanan ketat
  setupSecurityPolicies(mainWindow);

  // Daftarkan handler IPC bertipe
  registerIpcHandlers(sourceManager);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadURL('app://musick/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single-instance lock sesuai PRD Bagian 11
app.setName('Musick');
app.setPath('userData', path.join(app.getPath('appData'), 'Musick'));

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Daftarkan protokol kustom app:// untuk isolasi aset lokal tanpa file://
    protocol.handle('app', (request) => {
      try {
        const parsedUrl = new URL(request.url);
        let reqPath = path.normalize(decodeURIComponent(parsedUrl.pathname));
        if (reqPath.startsWith('/') || reqPath.startsWith('\\')) {
          reqPath = reqPath.slice(1);
        }
        if (!reqPath || reqPath === '.') {
          reqPath = 'index.html';
        }
        const rendererDir = path.resolve(__dirname, '../renderer');
        const resolvedPath = path.resolve(rendererDir, reqPath);

        // Keamanan: cegah path traversal keluar dari folder renderer
        const decodedUrl = decodeURIComponent(request.url);
        if (decodedUrl.includes('..') || decodedUrl.includes('%2e%2e') || decodedUrl.includes('%2E%2E')) {
          console.warn(`[Security] Percobaan path traversal diblokir: ${request.url}`);
          return new Response('Access Denied', { status: 403 });
        }

        const rel = path.relative(rendererDir, resolvedPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          console.warn(`[Security] Percobaan path traversal diblokir: ${request.url}`);
          return new Response('Access Denied', { status: 403 });
        }

        return net.fetch(pathToFileURL(resolvedPath).toString());
      } catch (err) {
        console.error('[Protocol app:// Error]:', err);
        return new Response('Internal Server Error', { status: 500 });
      }
    });

    // Bridge Python dimuat secara "malas" (lazy): saat ada permintaan pertama
    createWindow();
  });

  // Pembersihan pohon proses saat aplikasi keluar
  const cleanUpAndQuit = () => {
    bridgeManager.kill();
  };

  app.on('before-quit', cleanUpAndQuit);
  app.on('will-quit', cleanUpAndQuit);
  process.on('exit', cleanUpAndQuit);
  process.on('SIGINT', () => {
    cleanUpAndQuit();
    process.exit(0);
  });

  app.on('window-all-closed', () => {
    cleanUpAndQuit();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
