import { spawn, execSync, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { MusicSourceError } from '../shared/errors';
import type { SearchResult, StreamInfo, Track } from '../shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeoutId: NodeJS.Timeout;
}

export interface BridgeManagerOptions {
  scriptPath?: string;
  pythonPath?: string;
  /** Waktu diam (ms) sebelum proses python dimatikan otomatis. Default: 5 menit (300.000 ms) */
  idleTimeoutMs?: number;
}

/**
 * Pengelola proses anak Python Bridge dengan mekanisme "Malas" (Lazy Spawning):
 * 1. Hanya dijalankan saat ada permintaan pertama (search / resolve).
 * 2. Dimatikan otomatis setelah diam selama idleTimeoutMs (default 5 menit) untuk menghemat RAM.
 * 3. Dihidupkan kembali seketika saat dibutuhkan.
 */
export class BridgeManager {
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private isShuttingDown = false;
  private restartAttempts = 0;
  private scriptPath: string;
  private pythonPath: string;
  private idleTimeoutMs: number;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(options?: BridgeManagerOptions) {
    this.scriptPath = options?.scriptPath || this.resolveScriptPath();
    this.pythonPath = options?.pythonPath || this.resolvePythonPath();
    // Default 5 menit diam
    this.idleTimeoutMs = options?.idleTimeoutMs !== undefined ? options?.idleTimeoutMs : 5 * 60 * 1000;
  }

  private resolveScriptPath(): string {
    const candidates = [
      path.resolve(process.resourcesPath || '', 'bridge/bridge_rpc.py'),
      path.resolve(process.cwd(), 'bridge/bridge_rpc.py'),
      path.resolve(__dirname, '../../bridge/bridge_rpc.py'),
      path.resolve(__dirname, '../bridge/bridge_rpc.py'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }

  private resolvePythonPath(): string {
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
      return process.env.PYTHON_PATH;
    }
    const candidates = [
      path.resolve(process.resourcesPath || '', 'python-3.12.8-embed/python.exe'),
      path.resolve(process.resourcesPath || '', 'python/python.exe'),
      path.resolve(process.cwd(), 'python-3.12.8-embed/python.exe'),
      path.resolve(process.cwd(), 'python/python.exe'),
      path.resolve(__dirname, '../../python-3.12.8-embed/python.exe'),
      path.resolve(__dirname, '../../python/python.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'python';
  }

  isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }

  getPid(): number | null {
    return this.child?.pid ?? null;
  }

  start(): void {
    if (this.child || this.isShuttingDown) return;

    this.clearIdleTimer();
    console.log(`[BridgeManager] Memulai Python bridge (eksekusi: ${this.pythonPath})...`);

    this.child = spawn(this.pythonPath, [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        // Informasikan runtime Node bawaan jika ada untuk solver JS yt-dlp
        NODE_PATH: process.execPath,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });

    const pid = this.child.pid;
    console.log(`[BridgeManager] Bridge Python aktif (PID: ${pid})`);

    this.rl = readline.createInterface({
      input: this.child.stdout!,
      crlfDelay: Infinity,
    });

    this.rl.on('line', (line) => {
      this.handleLine(line);
    });

    this.child.stderr?.on('data', (data) => {
      console.warn(`[Bridge Python STDERR]: ${data.toString().trim()}`);
    });

    this.child.on('close', (code, signal) => {
      console.log(`[BridgeManager] Bridge Python berhenti (code: ${code}, signal: ${signal})`);
      this.cleanupChild();

      for (const [, req] of this.pending) {
        clearTimeout(req.timeoutId);
        req.reject(new MusicSourceError('NETWORK', 'Bridge Python terhenti'));
      }
      this.pending.clear();

      if (!this.isShuttingDown) {
        // Jika mati secara abnormal dan masih ada pending, jadwalkan restart
        if (this.pending.size > 0) {
          this.scheduleRestart();
        }
      }
    });

    this.child.on('error', (err) => {
      console.error('[BridgeManager] Gagal spawn proses python:', err);
    });

    this.resetIdleTimer();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    if (this.idleTimeoutMs > 0 && !this.isShuttingDown) {
      this.idleTimer = setTimeout(() => {
        if (this.pending.size === 0 && this.isRunning()) {
          console.log(
            `[BridgeManager] Bridge diam selama ${this.idleTimeoutMs / 1000}s, mematikan proses untuk menghemat RAM...`
          );
          this.stopIdle();
        }
      }, this.idleTimeoutMs);
    }
  }

  /**
   * Menghentikan child process saat idle tanpa menandai shutdown permanen.
   */
  stopIdle(): void {
    this.clearIdleTimer();
    if (!this.child) return;

    const pid = this.child.pid;
    console.log(`[BridgeManager] Mematikan proses idle (PID: ${pid})...`);
    try {
      if (process.platform === 'win32' && pid) {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        this.child.kill('SIGTERM');
      }
    } catch {
      // Abaikan jika sudah keluar
    } finally {
      this.cleanupChild();
    }
  }

  private scheduleRestart(): void {
    this.restartAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.restartAttempts - 1), 10000);
    console.log(`[BridgeManager] Menjadwalkan restart bridge dalam ${delay}ms`);
    setTimeout(() => {
      if (!this.isShuttingDown && !this.child) {
        this.start();
      }
    }, delay);
  }

  private cleanupChild(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.child = null;
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    try {
      const resp = JSON.parse(line);
      const reqId = resp.id;
      const pending = this.pending.get(reqId);
      if (!pending) return;

      this.pending.delete(reqId);
      clearTimeout(pending.timeoutId);

      if (resp.error) {
        const code = resp.error.code || 'NETWORK';
        pending.reject(new MusicSourceError(code, resp.error.message || 'Error dari bridge'));
      } else {
        pending.resolve(resp.result);
      }
    } catch (err) {
      console.error('[BridgeManager] Gagal parse respon RPC:', line, err);
    } finally {
      if (this.pending.size === 0) {
        this.resetIdleTimer();
      }
    }
  }

  async call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 25000): Promise<T> {
    // Lazily start bridge if not running
    if (!this.isRunning() || !this.child?.stdin?.writable) {
      this.start();
      if (!this.child || !this.child.stdin?.writable) {
        throw new MusicSourceError('NETWORK', 'Bridge Python tidak dapat dimulai');
      }
    }

    this.clearIdleTimer();

    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params }) + '\n';

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        if (this.pending.size === 0) this.resetIdleTimer();
        reject(new MusicSourceError('NETWORK', `Waktu permintaan RPC ${method} habis (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeoutId });

      try {
        this.child!.stdin!.write(payload);
      } catch (err) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        if (this.pending.size === 0) this.resetIdleTimer();
        reject(new MusicSourceError('NETWORK', `Gagal menulis ke stdin bridge: ${err}`));
      }
    });
  }

  kill(): void {
    this.isShuttingDown = true;
    this.clearIdleTimer();
    if (!this.child) return;

    const pid = this.child.pid;
    console.log(`[BridgeManager] Mematikan pohon proses bridge permanen (PID: ${pid})...`);
    try {
      if (process.platform === 'win32' && pid) {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        this.child.kill('SIGKILL');
      }
    } catch {
      // Abaikan jika sudah keluar
    } finally {
      this.cleanupChild();
    }
  }

  async search(query: string): Promise<SearchResult> {
    return this.call<SearchResult>('search', { query });
  }

  async getTrack(sourceId: string): Promise<Track> {
    return this.call<Track>('track', { sourceId });
  }

  async resolveStream(sourceId: string): Promise<StreamInfo> {
    return this.call<StreamInfo>('resolve', { sourceId });
  }
}

export const bridgeManager = new BridgeManager();
