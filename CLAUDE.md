# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WinBoat is an Electron application that allows running Windows apps on Linux through containerized virtualization. Windows runs as a VM inside a Docker container, with seamless integration into the Linux desktop using FreeRDP and RemoteApp protocol.

## Development Commands

### Running in Development Mode
```bash
npm run dev                 # Starts dev server with hot reload
```

### Building
```bash
npm run build-guest-server  # Build the Windows guest server component (Go binary)
npm run build:linux-gs      # Full build: guest server + Electron app for Linux
```

The guest server must be built before the main application as it's embedded in the distribution.

### Development Requirements
- Node.js for the Electron frontend
- Go for building the Windows guest server (`guest_server/`)
- Docker and Docker Compose v2 for running Windows containers
- FreeRDP 3.x.x with sound support

## Architecture

### Three-Layer Architecture

1. **Electron Frontend** (`src/renderer/`)
   - Vue 3 + TypeScript application
   - Handles UI, user interactions, and configuration
   - Communicates with main process via IPC
   - Key components in `src/renderer/views/`: Home, Apps, SetupUI, Config
   - Core business logic in `src/renderer/lib/winboat.ts`

2. **Electron Main Process** (`src/main/main.ts`)
   - Manages application lifecycle
   - Creates frameless browser window
   - Handles system-level operations

3. **Guest Server** (`guest_server/`)
   - Go application running inside Windows VM
   - Provides REST API at port 7148 for:
     - Retrieving installed Windows applications
     - System metrics (CPU, RAM, disk usage, Windows uptime)
     - Running Windows apps via RemoteApp
     - Restarting Windows OS (`/restart` endpoint)
   - Deployed as Windows service using NSSM

### Key Integration Points

- **Docker Management**: The app manages Windows containers through docker-compose configurations stored in `~/.winboat/`
- **FreeRDP Integration**: Used for RemoteApp connections to display Windows applications as native Linux windows
- **Desktop Integration**: Windows apps can be added to Linux start menu as native applications via XDG desktop entries
- **Single Instance Architecture**: Electron uses single-instance locking to handle direct app launches from desktop entries
- **Configuration**: Stored in `~/.winboat/winboat.config.json`, managed by `src/renderer/lib/config.ts`
- **Constants**: API endpoints and paths defined in `src/renderer/lib/constants.ts`

### Data Flow

#### Standard App Launch (from WinBoat UI)
1. User selects Windows app in UI
2. Frontend calls Winboat class methods (`src/renderer/lib/winboat.ts`)
3. Winboat communicates with Guest Server API (port 8000)
4. Guest Server launches app in Windows
5. FreeRDP establishes RemoteApp connection
6. Windows app appears as native Linux window

#### Direct App Launch (from Linux Start Menu)
1. User clicks desktop entry in Linux start menu
2. Desktop entry executes with `--launch-app="C:\path\to\app.exe"` argument
3. Electron single-instance system prevents duplicate and fires `second-instance` event
4. Main process sends IPC message to renderer with app path
5. Renderer finds matching app and calls `winboat.launchApp()`
6. Standard launch flow continues (steps 3-6 above)

## Desktop Integration System

WinBoat includes a comprehensive Linux desktop integration system that allows Windows apps to appear as native Linux applications in the start menu.

### Desktop Integration Features

- **XDG Desktop Entries**: Creates `.desktop` files in `~/.local/share/applications/` with proper `StartupWMClass` for taskbar icon matching
- **Icon Management**: Extracts and stores Windows app icons as PNG files in `~/.local/share/icons/winboat/` with automatic upscaling for better quality
- **Direct App Launch**: Supports `--launch-app="C:\path\to\app.exe"` CLI arguments for direct launching
- **Smart Categorization**: Automatically categorizes apps (Games, Development, Office, Graphics, etc.)
- **UI Integration**: Context menu options to add/remove apps from start menu
- **System Cleanup**: Comprehensive cleanup tools for removing all desktop integration
- **Taskbar Icon Matching**: Desktop entries include `StartupWMClass` field to ensure proper taskbar icon display in all Linux desktop environments

### Desktop Integration Files

```
~/.local/share/applications/
├── winboat-{app-name}.desktop    # Desktop entry files
└── ...

~/.local/share/icons/winboat/
├── {app-name}.png               # App icon files  
└── ...
```

### Key Components

- **DesktopIntegration utility** (`src/renderer/utils/desktopIntegration.ts`): Core desktop integration logic
- **CLI argument handling** (`src/main/main.ts`): Processes `--launch-app` arguments and implements single-instance locking
- **IPC communication** (`src/renderer/App.vue`): Handles direct app launch requests from desktop entries  
- **UI controls** (`src/renderer/views/Apps.vue`): Context menus and cleanup interface
- **Cleanup script** (`cleanup-desktop-integration.js`): Standalone system cleanup utility
- **FreeRDP wm-class handling** (`src/renderer/lib/winboat.ts`): Proper window class naming for X11 compatibility
- **WinBoat launcher script** (`~/.local/bin/winboat-launcher`): WinApps-inspired direct FreeRDP launcher for desktop entries

### App Groups and Visibility Management

- **App Grouping**: Users can create custom groups and organize apps
- **Multi-Select Group Filtering**: Users can select multiple groups simultaneously to create custom filtered views
- **Hide/Show Apps**: Apps can be hidden from the main list while remaining accessible
- **Group View Mode**: Toggle between list view and organized group view
- **Smart Group Labels**: Dynamic filter button labels showing current selection (e.g., "Games + Office + Ungrouped")
- **Visual Indicators**: Clear visual feedback for grouped, hidden, and integrated apps

## Icon System

WinBoat includes a comprehensive icon management system for both the application itself and Windows applications.

### Application Icons

- **Multiple Size Variants**: WinBoat logo available in sizes from 16x16 to 512x512 for optimal display across contexts
- **High Quality Scaling**: Uses advanced resampling algorithms for crisp icons at all sizes
- **AppImage Integration**: Properly configured icons for AppImage distribution via electron-builder
- **Icon Files**: Located in `icons/` directory with variants: `winboat-16.png`, `winboat-32.png`, `winboat-48.png`, `winboat-64.png`, `winboat-128.png`, `winboat-256.png`, `winboat-512.png`

### Windows App Icons

- **Automatic Extraction**: Extracts app icons from Windows applications and stores as PNG files
- **Quality Enhancement**: Automatically upscales small icons to 64x64 for better desktop integration
- **Transparency Preservation**: Maintains PNG transparency and alpha channels
- **Taskbar Integration**: Uses `StartupWMClass` in desktop entries to ensure proper taskbar icon matching

## System Monitoring and Management

### Uptime Tracking
- **Windows OS Uptime**: Real Windows uptime from `host.Uptime()` in guest server, displayed prominently in UI
- **Container Uptime**: Docker container uptime tracked separately using container start time
- **Uptime Display**: Formatted as seconds/minutes/hours/days with automatic unit conversion

### Session Management
- **XFreeRDP Session Tracking**: Monitors running RDP sessions with PID, memory usage, CPU usage
- **Session Identification**: Parses FreeRDP command lines to identify running applications
- **Modern Format Support**: Handles both legacy `/app:"path"` and modern `/app:program:"path",name:"name"` formats
- **Session Controls**: Kill individual sessions or all sessions at once

### Guest OS Management
- **Windows Restart**: `/restart` endpoint uses PowerShell `Restart-Computer -Force` for reliable restarts
- **Status Monitoring**: Real-time Guest API and container status monitoring
- **Automatic Recovery**: Waits for Guest API to come back online after restarts

## Desktop Integration Enhancements

### Credential Management
- **Docker Compose Integration**: Desktop launcher scripts read RDP credentials from `docker-compose.yml`
- **Secure Credential Passing**: Uses FreeRDP `/from-stdin` to avoid exposing passwords in process list
- **Container Health Checks**: Verifies Docker container is running before launching apps

### FreeRDP Integration
- **Modern App Format**: Uses `/app:program:"path",name:"name"` format for better app identification
- **Session Manager Compatibility**: Session manager correctly parses both quoted and unquoted app parameters
- **Window Class Mapping**: Proper `wm-class` handling for taskbar icon matching

## Important Implementation Details

- The app uses a singleton pattern for Winboat and WinboatConfig classes
- Windows container uses dockur/windows as base image
- Home directory is automatically mounted in Windows for file sharing
- App usage tracking stored in `~/.winboat/appUsage.json`
- Logging to `~/.winboat/winboat.log`
- Desktop integration state tracked in reactive Vue refs for real-time UI updates
- Production desktop shortcuts use direct FreeRDP launching (inspired by WinApps architecture) to bypass Electron AppImage sandbox limitations
- **Per-app wrapper scripts**: Each Windows app gets its own dedicated wrapper script in `~/.local/bin/winboat-apps/winboat-{app-name}` containing the complete FreeRDP command
- **Clean desktop entries**: Desktop entries use simple `Exec=/path/to/wrapper` avoiding complex quoting and parsing issues with desktop environments
- **Secure credential handling**: Wrapper scripts read RDP credentials dynamically from docker-compose.yml at creation time, ensuring no hardcoded credentials in the codebase
- **Complete cleanup system**: System cleanup removes all desktop entries, icon files, and wrapper scripts, ensuring no leftover traces when uninstalling
- **Production ready**: Ultra-simple approach works reliably across all desktop environments and is suitable for AppImage distribution
- **Professional appearance**: High-quality icons and proper taskbar integration ensure WinBoat looks polished across all Linux desktop environments