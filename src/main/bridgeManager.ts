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

interface QueuedRequest {
  id: number;
  method: string;
  params: Record<string, unknown>;
  priority: 'high' | 'normal';
  timeoutMs: number;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  enqueuedAt: number;
}

export interface BridgeManagerOptions {
  scriptPath?: string;
  pythonPath?: string;
  /** Waktu diam (ms) sebelum proses python dimatikan otomatis. Default: 5 menit (300.000 ms) */
  idleTimeoutMs?: number;
}

/**
 * Pengelola proses anak Python Bridge dengan antrean prioritas dan lazy spawning:
 * 1. Prioritas tinggi untuk resolve / putar musik; prioritas normal untuk pencarian.
 * 2. Pencarian lama yang masih mengantre otomatis dibuang (discarded/cancelled) saat kueri baru masuk.
 * 3. Permintaan dikirim 1-per-1 ke stdin Python untuk mencegah penumpukan (head-of-line blocking).
 * 4. Dimatikan otomatis setelah diam selama idleTimeoutMs (default 5 menit) untuk menghemat RAM.
 */
export class BridgeManager {
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private queue: QueuedRequest[] = [];
  private isExecuting = false;
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

    const child = spawn(this.pythonPath, [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
      },
    });
    this.child = child;

    const pid = child.pid;
    console.log(`[BridgeManager] Bridge Python aktif (PID: ${pid})`);

    this.rl = readline.createInterface({
      input: child.stdout!,
      crlfDelay: Infinity,
    });

    this.rl.on('line', (line) => {
      this.handleLine(line);
    });

    child.stderr?.on('data', (data) => {
      console.warn(`[Bridge Python STDERR]: ${data.toString().trim()}`);
    });

    child.on('close', (code, signal) => {
      console.log(`[BridgeManager] Bridge Python berhenti (code: ${code}, signal: ${signal})`);
      if (this.child === child) {
        const hadPending = this.pending.size > 0;
        this.cleanupChild();

        if (!this.isShuttingDown && hadPending) {
          this.scheduleRestart();
        }
      }
    });

    child.on('error', (err) => {
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
    const child = this.child;
    if (!child) return;

    this.child = null;
    child.removeAllListeners('close');
    child.removeAllListeners('error');

    const pid = child.pid;
    console.log(`[BridgeManager] Mematikan proses idle (PID: ${pid})...`);
    try {
      if (process.platform === 'win32' && pid) {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
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
    this.isExecuting = false;
    for (const [, req] of this.pending) {
      clearTimeout(req.timeoutId);
      req.reject(new MusicSourceError('NETWORK', 'Bridge Python terhenti'));
    }
    this.pending.clear();
    for (const req of this.queue) {
      req.reject(new MusicSourceError('NETWORK', 'Bridge Python terhenti'));
    }
    this.queue = [];
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
      this.isExecuting = false;

      if (resp.error) {
        const code = resp.error.code || 'NETWORK';
        pending.reject(new MusicSourceError(code, resp.error.message || 'Error dari bridge'));
      } else {
        pending.resolve(resp.result);
      }
    } catch (err) {
      console.error('[BridgeManager] Gagal parse respon RPC:', line, err);
      this.isExecuting = false;
    } finally {
      this.processQueue();
      if (this.pending.size === 0 && this.queue.length === 0) {
        this.resetIdleTimer();
      }
    }
  }

  async call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 25000): Promise<T> {
    const priority = method === 'resolve' || method === 'health' ? 'high' : 'normal';

    // 1. Buang pencarian lama yang belum terkirim jika ada kueri pencarian baru (stale search discard)
    if (method === 'search') {
      this.queue = this.queue.filter((item) => {
        if (item.method === 'search') {
          item.reject(new MusicSourceError('SUPERSEDED', 'Pencarian dibatalkan karena kueri digantikan'));
          return false;
        }
        return true;
      });
    }

    const id = this.nextId++;

    return new Promise<T>((resolve, reject) => {
      const req: QueuedRequest = {
        id,
        method,
        params,
        priority,
        timeoutMs,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      if (priority === 'high') {
        // Sisipkan di posisi terdepan antrean (sebelum request prioritas normal)
        const insertIdx = this.queue.findIndex((q) => q.priority !== 'high');
        if (insertIdx === -1) {
          this.queue.push(req);
        } else {
          this.queue.splice(insertIdx, 0, req);
        }
      } else {
        this.queue.push(req);
      }

      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.isExecuting || this.queue.length === 0 || this.isShuttingDown) return;

    if (!this.isRunning() || !this.child?.stdin?.writable) {
      this.start();
      if (!this.child || !this.child.stdin?.writable) {
        const nextReq = this.queue.shift();
        nextReq?.reject(new MusicSourceError('NETWORK', 'Bridge Python tidak dapat dimulai'));
        return;
      }
    }

    const req = this.queue.shift()!;
    this.isExecuting = true;
    this.clearIdleTimer();

    const payload = JSON.stringify({ id: req.id, method: req.method, params: req.params }) + '\n';

    const timeoutId = setTimeout(() => {
      this.pending.delete(req.id);
      this.isExecuting = false;
      if (this.pending.size === 0 && this.queue.length === 0) this.resetIdleTimer();
      req.reject(new MusicSourceError('NETWORK', `Waktu permintaan RPC ${req.method} habis (${req.timeoutMs}ms)`));
      this.processQueue();
    }, req.timeoutMs);

    this.pending.set(req.id, {
      resolve: req.resolve,
      reject: req.reject,
      timeoutId,
    });

    try {
      this.child!.stdin!.write(payload);
    } catch (err) {
      clearTimeout(timeoutId);
      this.pending.delete(req.id);
      this.isExecuting = false;
      if (this.pending.size === 0 && this.queue.length === 0) this.resetIdleTimer();
      req.reject(new MusicSourceError('NETWORK', `Gagal menulis ke stdin bridge: ${err}`));
      this.processQueue();
    }
  }

  kill(): void {
    this.isShuttingDown = true;
    this.clearIdleTimer();
    const child = this.child;
    if (!child) return;

    this.child = null;
    child.removeAllListeners('close');
    child.removeAllListeners('error');

    const pid = child.pid;
    console.log(`[BridgeManager] Mematikan pohon proses bridge permanen (PID: ${pid})...`);
    try {
      if (process.platform === 'win32' && pid) {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGKILL');
      }
    } catch {
      // Abaikan jika sudah keluar
    } finally {
      this.cleanupChild();
    }
  }

  async search(query: string, filter?: string): Promise<SearchResult> {
    return this.call<SearchResult>('search', { query, filter });
  }

  async getTrack(sourceId: string): Promise<Track> {
    return this.call<Track>('track', { sourceId });
  }

  async getArtist(sourceId: string): Promise<Artist> {
    return this.call<Artist>('artist', { sourceId });
  }

  async getAlbum(sourceId: string): Promise<Album> {
    return this.call<Album>('album', { sourceId });
  }

  async resolveStream(sourceId: string): Promise<StreamInfo> {
    return this.call<StreamInfo>('resolve', { sourceId });
  }
}

export const bridgeManager = new BridgeManager();
