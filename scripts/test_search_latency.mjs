import { spawn } from 'child_process';
import readline from 'readline';
import path from 'path';

const pyExe = path.resolve(process.cwd(), 'python-3.12.8-embed/python.exe');

function testBridgeSearch(query) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const py = spawn(pyExe, ['bridge/bridge_rpc.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
    const rl = readline.createInterface({ input: py.stdout });
    rl.on('line', () => {
      const elapsed = Date.now() - t0;
      py.stdin.end();
      resolve(elapsed);
    });
    py.stdin.write(JSON.stringify({ id: 1, method: 'search', params: { query } }) + '\n');
  });
}

function testWarmSearch(query) {
  return new Promise((resolve) => {
    const py = spawn(pyExe, ['bridge/bridge_rpc.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
    const rl = readline.createInterface({ input: py.stdout });
    let isFirst = true;
    let t0 = 0;

    rl.on('line', () => {
      if (isFirst) {
        isFirst = false;
        t0 = Date.now();
        py.stdin.write(JSON.stringify({ id: 2, method: 'search', params: { query } }) + '\n');
      } else {
        const elapsed = Date.now() - t0;
        py.stdin.end();
        resolve(elapsed);
      }
    });

    py.stdin.write(JSON.stringify({ id: 1, method: 'health' }) + '\n');
  });
}

async function run() {
  const cold = await testBridgeSearch('Sheila on 7 Dan');
  console.log(`Pencarian Pertama (Cold Spawn + Network): ${cold} ms`);

  const warm = await testWarmSearch('Padi Menanti Sebuah Jawaban');
  console.log(`Pencarian Hangat (Bridge Running + Network): ${warm} ms`);
}

run();
