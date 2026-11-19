#include <windows.h>
#include <shlobj.h>
#include <stdio.h>
#include <stdlib.h>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // 1. Dapatkan lokasi direktori instalasi aplikasi
    char appDir[MAX_PATH];
    GetModuleFileNameA(NULL, appDir, MAX_PATH);
    char *lastSlash = strrchr(appDir, '\\');
    if (lastSlash != NULL) {
        *lastSlash = '\0';
    }
    SetCurrentDirectoryA(appDir);

    // 2. Pastikan direktori %APPDATA%\Musick ada untuk data pengguna
    char appDataDir[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_APPDATA, NULL, 0, appDataDir))) {
        char musickDataDir[MAX_PATH];
        snprintf(musickDataDir, sizeof(musickDataDir), "%s\\Musick", appDataDir);
        CreateDirectoryA(musickDataDir, NULL);
    }

    // 3. Konfigurasi eksekusi aplikasi
    // Cek apakah ada executable node / electron lokal atau di sistem
    char cmdLine[1024];
    snprintf(cmdLine, sizeof(cmdLine), "node.exe \"%s\\dist\\main\\index.js\"", appDir);

    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE; // Jangan tampilkan console window
    ZeroMemory(&pi, sizeof(pi));

    if (CreateProcessA(NULL, cmdLine, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, appDir, &si, &pi)) {
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        return 0;
    }

    return 1;
}
