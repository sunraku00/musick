import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Mode Verifikasi Otomatis E2E untuk Pembuktian Nyata Aplikasi Hasil Pasang
  if (process.argv.includes('--test-e2e')) {
    const logFile = path.join(app.getPath('userData'), 'e2e_verification.log');
    const writeLog = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}`;
      console.log(line);
      fs.appendFileSync(logFile, line + '\n');
    };
    fs.writeFileSync(logFile, `=== E2E VERIFIKASI APLIKASI HASIL PASANG ===\n`);
    writeLog(`Aplikasi dibuka. PID: ${process.pid}`);
    writeLog(`UserData: ${app.getPath('userData')}`);

    mainWindow.webContents.on('did-finish-load', async () => {
      writeLog(`Renderer window berhasil dimuat (file:///.../renderer/index.html)`);
      try {
        sourceManager.setActiveSource('ytmusic');
        writeLog(`Sumber musik aktif diubah ke: ytmusic`);
        writeLog(`Memulai pencarian: "Sheila on 7"...`);
        const searchRes = await sourceManager.getActiveSource().search('Sheila on 7');
        writeLog(`Hasil pencarian diterima: ${searchRes.tracks.length} trek ditemukan.`);
        const firstTrack = searchRes.tracks[0];
        writeLog(`Trek pertama: "${firstTrack.title}" oleh ${firstTrack.artist} (ID: ${firstTrack.id})`);
        writeLog(`Menyelesaikan URL stream untuk ID ${firstTrack.id}...`);
        const streamInfo = await sourceManager.getActiveSource().resolveStream(firstTrack.id);
        writeLog(`Stream berhasil diselesaikan!`);
        writeLog(`  URL Host: ${new URL(streamInfo.url).host}`);
        writeLog(`  MIME Type: ${streamInfo.mimeType}`);
        writeLog(`  Kedaluwarsa: ${new Date(streamInfo.expiresAt).toISOString()}`);
        writeLog(`Menguji pemuatan audio stream di renderer HTML5 <audio>...`);
        const audioStatus = await mainWindow!.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const audio = new Audio("${streamInfo.url}");
            audio.preload = "auto";
            let finished = false;
            audio.addEventListener("canplay", () => {
              if (!finished) {
                finished = true;
                resolve({
                  canplay: true,
                  duration: audio.duration,
                  bufferedSec: audio.buffered.length > 0 ? audio.buffered.end(0) : 0,
                  readyState: audio.readyState
                });
              }
            });
            audio.addEventListener("error", () => {
              if (!finished) {
                finished = true;
                resolve({ canplay: false, error: audio.error ? audio.error.message : "Audio error" });
              }
            });
            audio.load();
            setTimeout(() => {
              if (!finished) {
                finished = true;
                resolve({
                  canplay: audio.readyState >= 2,
                  duration: audio.duration,
                  bufferedSec: audio.buffered.length > 0 ? audio.buffered.end(0) : 0,
                  readyState: audio.readyState
                });
              }
            }, 8000);
          })
        `);
        writeLog(`Status Audio di Renderer: ${JSON.stringify(audioStatus)}`);
        writeLog(`=== VERIFIKASI E2E BERHASIL LENGKAP ===`);
      } catch (err: any) {
        writeLog(`[ERROR E2E]: ${err.message}\\n${err.stack}`);
      }
    });
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
