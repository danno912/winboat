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
- **Configuration**: Stored in `~/.winboat/winboat.config.json`, managed by `src/renderer/lib/config.ts`
- **Constants**: API endpoints and paths defined in `src/renderer/lib/constants.ts`

### Data Flow
1. User selects Windows app in UI
2. Frontend calls Winboat class methods (`src/renderer/lib/winboat.ts`)
3. Winboat communicates with Guest Server API (port 8000)
4. Guest Server launches app in Windows
5. FreeRDP establishes RemoteApp connection
6. Windows app appears as native Linux window

## Important Implementation Details

- The app uses a singleton pattern for Winboat and WinboatConfig classes
- Windows container uses dockur/windows as base image
- Home directory is automatically mounted in Windows for file sharing
- App usage tracking stored in `~/.winboat/appUsage.json`
- Logging to `~/.winboat/winboat.log`