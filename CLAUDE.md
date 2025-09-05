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
   - Provides REST API at port 8000 for:
     - Retrieving installed Windows applications
     - System metrics (CPU, RAM, disk usage)
     - Running Windows apps via RemoteApp
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

- **XDG Desktop Entries**: Creates `.desktop` files in `~/.local/share/applications/`
- **Icon Management**: Extracts and stores Windows app icons as PNG files in `~/.local/share/icons/winboat/`
- **Direct App Launch**: Supports `--launch-app="C:\path\to\app.exe"` CLI arguments for direct launching
- **Smart Categorization**: Automatically categorizes apps (Games, Development, Office, Graphics, etc.)
- **UI Integration**: Context menu options to add/remove apps from start menu
- **System Cleanup**: Comprehensive cleanup tools for removing all desktop integration

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
- **Hide/Show Apps**: Apps can be hidden from the main list while remaining accessible
- **Group View Mode**: Toggle between list view and organized group view
- **Visual Indicators**: Clear visual feedback for grouped, hidden, and integrated apps

## Important Implementation Details

- The app uses a singleton pattern for Winboat and WinboatConfig classes
- Windows container uses dockur/windows as base image
- Home directory is automatically mounted in Windows for file sharing
- App usage tracking stored in `~/.winboat/appUsage.json`
- Logging to `~/.winboat/winboat.log`
- Desktop integration state tracked in reactive Vue refs for real-time UI updates
- Production desktop shortcuts use direct FreeRDP launching (inspired by WinApps architecture) to bypass Electron AppImage sandbox limitations
- **Unified launcher approach**: Both development and production desktop entries now use the WinBoat launcher script (`~/.local/bin/winboat-launcher`) for consistency and reliability
- **Secure credential handling**: The launcher script reads RDP credentials dynamically from user's WinBoat configuration files (docker-compose.yml and winboat.config.json), ensuring no hardcoded credentials in the codebase
- **Auto-installation system**: WinBoat automatically creates/updates the launcher script when desktop entries are created, requiring no manual setup from users
- **WinApps-inspired reliability**: Robust error handling, pre-flight checks, and user notifications ensure stable desktop integration suitable for production distribution