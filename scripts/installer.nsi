; NSIS Installer Script for Musick (M0 Spike)
; Mengemas runtime Python 3.12.8 embeddable + dependensi + UI React + Bridge

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Definisi Umum
!define PRODUCT_NAME "Musick"
!define PRODUCT_VERSION "0.1.0"
!define PRODUCT_PUBLISHER "Musick Project"
!define OUT_FILE "..\release\Musick-Setup-0.1.0.exe"
!define UNINST_REG_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Musick"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
InstallDirRegKey HKCU "Software\${PRODUCT_NAME}" "InstallDir"
RequestExecutionLevel user ; Tidak membutuhkan elevated UAC (per-user install)
SetCompressor /SOLID lzma

; Konfigurasi Tampilan MUI2
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite on

    ; 1. Salin Binary Peluncur Aplikasi & Konfigurasi
    File "..\Musick.exe"
    File "..\package.json"

    ; 2. Salin Folder Dist (Renderer, Preload, Main)
    CreateDirectory "$INSTDIR\dist"
    SetOutPath "$INSTDIR\dist"
    File /r "..\dist\*.*"

    ; 3. Salin Folder Bridge
    CreateDirectory "$INSTDIR\bridge"
    SetOutPath "$INSTDIR\bridge"
    File /r "..\bridge\*.*"

    ; 4. Salin Bundel Python 3.12.8 Embeddable dengan Seluruh Dependensinya
    CreateDirectory "$INSTDIR\python-3.12.8-embed"
    SetOutPath "$INSTDIR\python-3.12.8-embed"
    File /r "..\python-3.12.8-embed\*.*"

    ; 5. Pastikan folder data pengguna di %APPDATA%\Musick telah dibuat (PRD: bukan di folder instalasi)
    CreateDirectory "$APPDATA\Musick"

    ; 6. Buat Uninstaller
    SetOutPath "$INSTDIR"
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; 7. Shortcut di Menu Start
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\Musick.exe" "" "$INSTDIR\Musick.exe" 0
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0

    ; 8. Registrasi ke Windows Add/Remove Programs (HKCU)
    WriteRegStr HKCU "${UNINST_REG_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKCU "${UNINST_REG_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "${UNINST_REG_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKCU "${UNINST_REG_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKCU "${UNINST_REG_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegDWORD HKCU "${UNINST_REG_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINST_REG_KEY}" "NoRepair" 1

    ; Hitung ukuran terpasang dalam KB untuk Add/Remove Programs
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKCU "${UNINST_REG_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
    ; Hapus Shortcut Menu Start
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk"
    RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Hapus seluruh file program di instalasi
    RMDir /r "$INSTDIR\python-3.12.8-embed"
    RMDir /r "$INSTDIR\dist"
    RMDir /r "$INSTDIR\bridge"
    Delete "$INSTDIR\Musick.exe"
    Delete "$INSTDIR\package.json"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"

    ; Hapus registrasi di Windows
    DeleteRegKey HKCU "${UNINST_REG_KEY}"
    DeleteRegKey HKCU "Software\${PRODUCT_NAME}"

    ; CATATAN: Folder data pengguna $APPDATA\Musick TIDAK dihapus secara otomatis
    ; demi menjaga playlist dan preferensi pengguna (PRD: deleteAppDataOnUninstall: false).
SectionEnd
