Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
Name "仕込み表"
OutFile "..\deliverables\ShikomiSetup-v18-WebView2.exe"
InstallDir "$LOCALAPPDATA\仕込み表"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "0.2.2.0"
VIAddVersionKey /LANG=1041 "ProductName" "仕込み表"
VIAddVersionKey /LANG=1041 "FileDescription" "仕込み表 v18 セットアップ（WebView2同梱）"
VIAddVersionKey /LANG=1041 "FileVersion" "0.2.2"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Japanese"
!define WVKEY "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
Function DetectWebView
  StrCpy $0 ""
  SetRegView 32
  ReadRegStr $0 HKCU "${WVKEY}" "pv"
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ReadRegStr $0 HKLM "${WVKEY}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    SetRegView 64
    ReadRegStr $0 HKLM "${WVKEY}" "pv"
  ${EndIf}
  SetRegView 32
FunctionEnd
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "このインストーラーは64ビットWindows用です。"
    Abort
  ${EndIf}
  SetShellVarContext current
FunctionEnd
Section "仕込み表"
  Call DetectWebView
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File /oname=WebView2RuntimeInstaller.exe "..\src-tauri\target\.tauri\x64\35871e19-d11b-432d-9d1e-7be0ff286540\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
    DetailPrint "Microsoft Edge WebView2 Runtimeをインストールしています…"
    ClearErrors
    ExecWait '"$PLUGINSDIR\WebView2RuntimeInstaller.exe" /silent /install' $1
    ${If} ${Errors}
      MessageBox MB_ICONSTOP "WebView2のインストーラーを起動できませんでした。"
      Abort
    ${EndIf}
    Call DetectWebView
    ${If} $0 == ""
    ${OrIf} $0 == "0.0.0.0"
      MessageBox MB_ICONSTOP "WebView2の導入を確認できませんでした（終了コード $1）。Windowsを再起動してから、もう一度インストールしてください。"
      Abort
    ${EndIf}
  ${EndIf}
  SetOutPath "$INSTDIR"
  File /oname=shikomi-app-v18.exe "..\src-tauri\target\release\deps\shikomi_app_v17.exe"
  SetOutPath "$INSTDIR\runtime"
  File "..\src-tauri\runtime\node.exe"
  File "..\src-tauri\runtime\NODE-LICENSE.txt"
  SetOutPath "$INSTDIR\worker"
  File /r /x "*.test.mjs" "..\worker\*"
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateDirectory "$SMPROGRAMS\仕込み表"
  CreateShortcut "$SMPROGRAMS\仕込み表\仕込み表.lnk" "$INSTDIR\shikomi-app-v18.exe"
  CreateShortcut "$DESKTOP\仕込み表.lnk" "$INSTDIR\shikomi-app-v18.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo" "DisplayName" "仕込み表"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo" "DisplayVersion" "0.2.2"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo" "DisplayIcon" "$INSTDIR\shikomi-app-v18.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo" "UninstallString" '$\"$INSTDIR\uninstall.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo" "NoRepair" 1
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\仕込み表.lnk"
  Delete "$SMPROGRAMS\仕込み表\仕込み表.lnk"
  RMDir "$SMPROGRAMS\仕込み表"
  Delete "$INSTDIR\shikomi-app-v18.exe"
  Delete "$INSTDIR\runtime\node.exe"
  Delete "$INSTDIR\runtime\NODE-LICENSE.txt"
  RMDir "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\worker"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dev.portfolio.shikomi.demo"
SectionEnd
