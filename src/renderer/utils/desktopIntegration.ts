const fs: typeof import("fs") = require("fs");
const path: typeof import("path") = require("path");
const os: typeof import("os") = require("os");
const { execSync } = require("child_process");

import { type WinApp } from "../../types";

export interface DesktopIntegrationStatus {
    isIntegrated: boolean;
    desktopFile?: string;
    iconFile?: string;
    launcherScript?: string;
}

export class DesktopIntegration {
    private readonly applicationsDir: string;
    private readonly iconsDir: string;
    private readonly launcherDir: string;

    constructor() {
        const homeDir = os.homedir();
        this.applicationsDir = path.join(homeDir, '.local', 'share', 'applications');
        this.iconsDir = path.join(homeDir, '.local', 'share', 'icons', 'winboat');
        this.launcherDir = path.join(homeDir, '.local', 'bin', 'winboat-apps');

        // Ensure directories exist
        this.ensureDirectoriesExist();
    }

    private ensureDirectoriesExist(): void {
        [this.applicationsDir, this.iconsDir, this.launcherDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        });

        // Ensure launcher directory is in PATH
        this.ensureLauncherInPath();
    }

    private ensureLauncherInPath(): void {
        const bashrcPath = path.join(os.homedir(), '.bashrc');
        const pathAddition = `export PATH="$HOME/.local/bin/winboat-apps:$PATH"`;
        
        try {
            if (fs.existsSync(bashrcPath)) {
                const bashrcContent = fs.readFileSync(bashrcPath, 'utf-8');
                if (!bashrcContent.includes('winboat-apps')) {
                    fs.appendFileSync(bashrcPath, `\n# WinBoat launcher scripts\n${pathAddition}\n`);
                    console.log('Added WinBoat launcher directory to PATH in .bashrc');
                }
            }
        } catch (error) {
            console.warn('Could not modify .bashrc:', error);
        }
    }

    private sanitizeAppName(appName: string): string {
        return appName.toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    private getAppCategory(appPath: string): string {
        const pathLower = appPath.toLowerCase();
        
        if (pathLower.includes('game') || pathLower.includes('steam') || pathLower.includes('epic')) {
            return 'Game';
        }
        if (pathLower.includes('office') || pathLower.includes('word') || pathLower.includes('excel') || pathLower.includes('powerpoint')) {
            return 'Office';
        }
        if (pathLower.includes('visual studio') || pathLower.includes('code') || pathLower.includes('dev')) {
            return 'Development';
        }
        if (pathLower.includes('photoshop') || pathLower.includes('gimp') || pathLower.includes('paint')) {
            return 'Graphics';
        }
        if (pathLower.includes('chrome') || pathLower.includes('firefox') || pathLower.includes('browser')) {
            return 'Network';
        }
        if (pathLower.includes('vlc') || pathLower.includes('media') || pathLower.includes('player')) {
            return 'AudioVideo';
        }
        
        return 'Utility';
    }

    private async saveAppIcon(app: WinApp, sanitizedName: string): Promise<string> {
        const iconPath = path.join(this.iconsDir, `${sanitizedName}.png`);
        
        try {
            // Convert base64 icon to PNG file
            const iconBuffer = Buffer.from(app.Icon, 'base64');
            fs.writeFileSync(iconPath, iconBuffer);
            
            // Verify the icon and potentially upscale it for better quality
            try {
                const { Jimp } = require('jimp');
                const image = await Jimp.read(iconPath);
                
                // If icon is smaller than 64x64, upscale it
                if (image.bitmap.width < 64 || image.bitmap.height < 64) {
                    image.resize(64, 64, Jimp.RESIZE_BEZIER);
                    await image.writeAsync(iconPath);
                    console.log(`Upscaled icon for ${app.Name} to 64x64`);
                }
            } catch (error) {
                console.warn(`Could not process icon for ${app.Name}:`, error);
            }
            
            return iconPath;
        } catch (error) {
            console.error(`Error saving icon for ${app.Name}:`, error);
            return '';
        }
    }

    private createLauncherScript(app: WinApp, sanitizedName: string): string {
        const scriptPath = path.join(this.launcherDir, `winboat-${sanitizedName}`);
        
        // Create a wrapper script that launches the app directly via FreeRDP
        // This bypasses Electron AppImage restrictions and works in all environments
        const scriptContent = `#!/bin/bash

# WinBoat launcher script for ${app.Name}
# Generated on $(date)

# Read docker-compose.yml to get RDP credentials
DOCKER_COMPOSE="$HOME/.winboat/docker-compose.yml"
if [ ! -f "$DOCKER_COMPOSE" ]; then
    echo "Error: Docker compose file not found at $DOCKER_COMPOSE"
    exit 1
fi

# Extract username and password from docker-compose.yml using grep
USERNAME=$(grep "USERNAME:" "$DOCKER_COMPOSE" | sed 's/.*USERNAME: "\\(.*\\)"/\\1/' | tr -d '\\r')
PASSWORD=$(grep "PASSWORD:" "$DOCKER_COMPOSE" | sed 's/.*PASSWORD: "\\(.*\\)"/\\1/' | tr -d '\\r')

# Check if Docker container is running
if ! docker ps --format "{{.Names}}" | grep -q "^WinBoat$"; then
    echo "Error: WinBoat Docker container is not running"
    notify-send "WinBoat" "Docker container is not running. Please start WinBoat first." -i error
    exit 1
fi

# Get container IP (assuming default docker network)
CONTAINER_IP="localhost"

# Launch the Windows app via FreeRDP RemoteApp
# Using modern format: /app:program:"path",name:"name"
exec xfreerdp3 \\
    /v:$CONTAINER_IP:3389 \\
    /u:$USERNAME \\
    /p:$PASSWORD \\
    /app:program:"${app.Path}",name:"${app.Name}" \\
    /wm-class:"winboat-${sanitizedName}" \\
    /cert:ignore \\
    /sound:sys:pulse \\
    /clipboard \\
    /dynamic-resolution \\
    /auto-reconnect \\
    +compression \\
    /network:auto \\
    /gdi:hw \\
    /rfx \\
    /bpp:32
`;

        try {
            fs.writeFileSync(scriptPath, scriptContent);
            fs.chmodSync(scriptPath, 0o755); // Make executable
            console.log(`Created launcher script: ${scriptPath}`);
            return scriptPath;
        } catch (error) {
            console.error(`Error creating launcher script for ${app.Name}:`, error);
            return '';
        }
    }

    async integrateApp(app: WinApp): Promise<boolean> {
        try {
            const sanitizedName = this.sanitizeAppName(app.Name);
            const desktopFilePath = path.join(this.applicationsDir, `winboat-${sanitizedName}.desktop`);
            
            // Save app icon
            const iconPath = await this.saveAppIcon(app, sanitizedName);
            
            // Create launcher script
            const launcherPath = this.createLauncherScript(app, sanitizedName);
            
            // Create desktop entry
            const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=${app.Name}
Comment=Windows application via WinBoat
Exec=${launcherPath}
Icon=${iconPath}
Categories=${this.getAppCategory(app.Path)};
Terminal=false
StartupNotify=true
StartupWMClass=winboat-${sanitizedName}
Keywords=windows;app;winboat;
MimeType=application/x-ms-dos-executable;
`;

            fs.writeFileSync(desktopFilePath, desktopEntry);
            console.log(`Created desktop entry: ${desktopFilePath}`);
            
            // Update desktop database
            try {
                execSync('update-desktop-database ~/.local/share/applications', { stdio: 'ignore' });
            } catch (error) {
                console.warn('Could not update desktop database:', error);
            }
            
            return true;
        } catch (error) {
            console.error(`Error integrating app ${app.Name}:`, error);
            return false;
        }
    }

    removeAppIntegration(app: WinApp): boolean {
        try {
            const sanitizedName = this.sanitizeAppName(app.Name);
            
            const desktopFile = path.join(this.applicationsDir, `winboat-${sanitizedName}.desktop`);
            const iconFile = path.join(this.iconsDir, `${sanitizedName}.png`);
            const launcherFile = path.join(this.launcherDir, `winboat-${sanitizedName}`);
            
            // Remove files if they exist
            [desktopFile, iconFile, launcherFile].forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`Removed: ${file}`);
                }
            });
            
            // Update desktop database
            try {
                execSync('update-desktop-database ~/.local/share/applications', { stdio: 'ignore' });
            } catch (error) {
                console.warn('Could not update desktop database:', error);
            }
            
            return true;
        } catch (error) {
            console.error(`Error removing integration for ${app.Name}:`, error);
            return false;
        }
    }

    getIntegrationStatus(app: WinApp): DesktopIntegrationStatus {
        const sanitizedName = this.sanitizeAppName(app.Name);
        
        const desktopFile = path.join(this.applicationsDir, `winboat-${sanitizedName}.desktop`);
        const iconFile = path.join(this.iconsDir, `${sanitizedName}.png`);
        const launcherFile = path.join(this.launcherDir, `winboat-${sanitizedName}`);
        
        const isIntegrated = fs.existsSync(desktopFile);
        
        return {
            isIntegrated,
            desktopFile: isIntegrated ? desktopFile : undefined,
            iconFile: fs.existsSync(iconFile) ? iconFile : undefined,
            launcherScript: fs.existsSync(launcherFile) ? launcherFile : undefined
        };
    }

    async cleanupAllIntegrations(): Promise<number> {
        let removedCount = 0;
        
        try {
            // Remove all WinBoat desktop entries
            const desktopFiles = fs.readdirSync(this.applicationsDir)
                .filter(file => file.startsWith('winboat-') && file.endsWith('.desktop'));
            
            desktopFiles.forEach(file => {
                const filePath = path.join(this.applicationsDir, file);
                try {
                    fs.unlinkSync(filePath);
                    removedCount++;
                    console.log(`Removed desktop entry: ${file}`);
                } catch (error) {
                    console.warn(`Could not remove ${file}:`, error);
                }
            });
            
            // Remove all WinBoat icons
            if (fs.existsSync(this.iconsDir)) {
                const iconFiles = fs.readdirSync(this.iconsDir);
                iconFiles.forEach(file => {
                    const filePath = path.join(this.iconsDir, file);
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`Removed icon: ${file}`);
                    } catch (error) {
                        console.warn(`Could not remove icon ${file}:`, error);
                    }
                });
                
                // Remove icons directory if empty
                try {
                    fs.rmdirSync(this.iconsDir);
                    console.log('Removed WinBoat icons directory');
                } catch (error) {
                    // Directory not empty, that's fine
                }
            }
            
            // Remove all launcher scripts
            if (fs.existsSync(this.launcherDir)) {
                const launcherFiles = fs.readdirSync(this.launcherDir)
                    .filter(file => file.startsWith('winboat-'));
                
                launcherFiles.forEach(file => {
                    const filePath = path.join(this.launcherDir, file);
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`Removed launcher script: ${file}`);
                    } catch (error) {
                        console.warn(`Could not remove launcher ${file}:`, error);
                    }
                });
                
                // Remove launcher directory if empty
                try {
                    fs.rmdirSync(this.launcherDir);
                    console.log('Removed WinBoat launcher directory');
                } catch (error) {
                    // Directory not empty, that's fine
                }
            }
            
            // Update desktop database
            try {
                execSync('update-desktop-database ~/.local/share/applications', { stdio: 'ignore' });
            } catch (error) {
                console.warn('Could not update desktop database:', error);
            }
            
            return removedCount;
        } catch (error) {
            console.error('Error during cleanup:', error);
            return removedCount;
        }
    }

    isSystemReady(): boolean {
        // Check if required commands are available
        try {
            execSync('which xfreerdp3', { stdio: 'ignore' });
            execSync('which docker', { stdio: 'ignore' });
            return true;
        } catch (error) {
            console.warn('Desktop integration requirements not met:', error);
            return false;
        }
    }
}