; مثبّت ويندوز بملف واحد (setup.exe) — يُبنى في GitHub Actions بـ Inno Setup
#define AppVer GetEnv("APP_VERSION")
[Setup]
AppId=NeedleCobblerPOS
AppName=إبرة وخيط
AppVersion={#AppVer}
AppPublisher=مؤسسة إبرة وخيط الإسكافي للتجارة
DefaultDirName={autopf}\NeedleCobbler
DefaultGroupName=إبرة وخيط
UninstallDisplayIcon={app}\cobbler_accounting.exe
OutputDir=..\build\installer
OutputBaseFilename=needlecobbler-windows-setup
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\إبرة وخيط"; Filename: "{app}\cobbler_accounting.exe"
Name: "{autodesktop}\إبرة وخيط"; Filename: "{app}\cobbler_accounting.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\cobbler_accounting.exe"; Description: "{cm:LaunchProgram,إبرة وخيط}"; Flags: nowait postinstall skipifsilent
