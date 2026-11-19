import os
import subprocess
import time

def measure_startup():
    env = dict(os.environ)
    if 'ELECTRON_RUN_AS_NODE' in env:
        del env['ELECTRON_RUN_AS_NODE']

    app_exe = r"D:\test-install-musick\Musick.exe"
    
    ps_find_window = """
    $procs = Get-Process -Name Musick -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        if ($p.MainWindowHandle -ne 0 -and $p.Responding) {
            return $p.Id
        }
    }
    return $null
    """

    runs = []
    print("Measuring startup time over 3 runs...")

    for i in range(3):
        t0 = time.perf_counter()
        proc = subprocess.Popen([app_exe], env=env)
        
        # Poll until window appears
        hwnd_found = False
        while time.perf_counter() - t0 < 10:
            res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_find_window], capture_output=True, text=True)
            if res.stdout.strip():
                hwnd_found = True
                break
            time.sleep(0.05)

        t1 = time.perf_counter()
        dur = t1 - t0
        runs.append(dur)
        print(f"  Run {i+1}: {dur:.3f} seconds (HWND ready: {hwnd_found})")

        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        time.sleep(1)

    avg = sum(runs) / len(runs)
    print(f"\nAverage Startup Time: {avg:.3f} seconds (Min: {min(runs):.3f}s, Max: {max(runs):.3f}s)")
    return avg

if __name__ == "__main__":
    measure_startup()
