import { describe, it, expect } from 'vitest';
import * as path from 'path';

export function validateAppProtocolPath(requestUrl: string, rendererDir: string): { allowed: boolean; status: number } {
  try {
    const decodedUrl = decodeURIComponent(requestUrl);
    if (decodedUrl.includes('..') || decodedUrl.includes('%2e%2e') || decodedUrl.includes('%2E%2E')) {
      return { allowed: false, status: 403 };
    }

    const parsedUrl = new URL(requestUrl);
    let reqPath = path.normalize(decodeURIComponent(parsedUrl.pathname));
    if (reqPath.startsWith('/') || reqPath.startsWith('\\')) {
      reqPath = reqPath.slice(1);
    }
    if (!reqPath || reqPath === '.') {
      reqPath = 'index.html';
    }
    const resolvedPath = path.resolve(rendererDir, reqPath);

    const rel = path.relative(rendererDir, resolvedPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return { allowed: false, status: 403 };
    }
    return { allowed: true, status: 200 };
  } catch {
    return { allowed: false, status: 500 };
  }
}

describe('App Scheme Path Traversal Guard Tests', () => {
  const fakeRendererDir = path.resolve('dist/renderer');

  it('harus mengizinkan berkas sah di dalam folder renderer', () => {
    expect(validateAppProtocolPath('app://musick/index.html', fakeRendererDir)).toEqual({
      allowed: true,
      status: 200,
    });
    expect(validateAppProtocolPath('app://musick/assets/index.js', fakeRendererDir)).toEqual({
      allowed: true,
      status: 200,
    });
  });

  it('harus menolak path traversal sederhana (../package.json)', () => {
    const res = validateAppProtocolPath('app://musick/../package.json', fakeRendererDir);
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(403);
  });

  it('harus menolak path traversal bertingkat ke root sistem (../../../../Windows/win.ini)', () => {
    const res = validateAppProtocolPath('app://musick/../../../../Windows/win.ini', fakeRendererDir);
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(403);
  });

  it('harus menolak URL encoded path traversal (%2e%2e%2fpackage.json)', () => {
    const res = validateAppProtocolPath('app://musick/%2e%2e%2fpackage.json', fakeRendererDir);
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(403);
  });

  it('harus menolak URL encoded backslash path traversal (%2e%2e%5cpackage.json)', () => {
    const res = validateAppProtocolPath('app://musick/%2e%2e%5cpackage.json', fakeRendererDir);
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(403);
  });
});
