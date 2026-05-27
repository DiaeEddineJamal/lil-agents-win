; Custom NSIS hooks for the lil agents assisted installer.
; electron-builder !include's this file and invokes any macros it recognizes
; (unrecognized macros are simply ignored, so this is safe across versions).

; Force a per-user install and skip the "all users / just me" selection page.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; Greet users with a welcome page that shows the Peach sidebar art.
; Uses the bitmap electron-builder already configures from `installerSidebar`.
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend
