import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { bridgeManager } from './bridgeManager';
import { SourceManager, registerIpcHandlers } from './ipcHandlers';
import { setupSecurityPolicies } from './security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const sourceManager = new SourceManager();

function createWindow(): void {
  mainWindow = new BrowserWindow({
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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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
    // Bridge Python sekarang dimuat secara "malas" (lazy):
    // TIDAK dimulai saat app terbuka, melainkan saat permintaan pertama tiba.
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
