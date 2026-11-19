import { spawn, execSync, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { MusicSourceError } from '../shared/errors';
import type { SearchResult, StreamInfo, Track } from '../shared/types';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeoutId: NodeJS.Timeout;
}

export class BridgeManager {
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private isShuttingDown = false;
  private restartAttempts = 0;
  private scriptPath: string;

  constructor(scriptPath?: string) {
    this.scriptPath = scriptPath || path.resolve(process.cwd(), 'bridge/bridge_rpc.py');
  }

  start(): void {
    if (this.child || this.isShuttingDown) return;

    // Menjalankan Python bridge proses anak dengan stdio terisolasi
    const pythonExe = process.env.PYTHON_PATH || 'python';
    this.child = spawn(pythonExe, [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
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
      console.log(`[BridgeManager] Bridge Python keluar (code: ${code}, signal: ${signal})`);
      this.cleanupChild();

      // Reject all pending requests
      for (const [id, req] of this.pending) {
        clearTimeout(req.timeoutId);
        req.reject(new MusicSourceError('NETWORK', 'Bridge Python terhenti'));
      }
      this.pending.clear();

      // Restart bertahap jika tidak sedang shutdown
      if (!this.isShuttingDown) {
        this.scheduleRestart();
      }
    });

    this.child.on('error', (err) => {
      console.error('[BridgeManager] Gagal spawn proses python:', err);
    });
  }

  private scheduleRestart(): void {
    this.restartAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.restartAttempts - 1), 10000);
    console.log(`[BridgeManager] Menjadwalkan restart bridge dalam ${delay}ms (percobaan ke-${this.restartAttempts})`);
    setTimeout(() => {
      if (!this.isShuttingDown) {
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
    }
  }

  async call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 25000): Promise<T> {
    if (!this.child || !this.child.stdin?.writable) {
      this.start();
      if (!this.child || !this.child.stdin?.writable) {
        throw new MusicSourceError('NETWORK', 'Bridge Python tidak tersedia');
      }
    }

    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params }) + '\n';

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new MusicSourceError('NETWORK', `Waktu permintaan RPC ${method} habis (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeoutId });

      try {
        this.child!.stdin!.write(payload);
      } catch (err) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        reject(new MusicSourceError('NETWORK', `Gagal menulis ke stdin bridge: ${err}`));
      }
    });
  }

  /**
   * Mematikan SELURUH pohon proses (termasuk python.exe dan yt-dlp) tanpa proses yatim.
   * Di Windows menggunakan `taskkill /pid <PID> /T /F`.
   */
  kill(): void {
    this.isShuttingDown = true;
    if (!this.child) return;

    const pid = this.child.pid;
    console.log(`[BridgeManager] Mematikan pohon proses bridge (PID: ${pid})...`);

    try {
      if (process.platform === 'win32' && pid) {
        // /T = terminate process tree, /F = forcefully terminate
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        this.child.kill('SIGKILL');
      }
    } catch (err) {
      // Proses mungkin sudah keluar secara wajar
    } finally {
      this.cleanupChild();
    }
  }

  // Helper metode domain
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

// Instance tunggal untuk main process
export const bridgeManager = new BridgeManager();
