import { WinApp } from '../../types';
import { createLogger } from './log';

const logger = createLogger('DesktopIntegration');
const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const os: typeof import('os') = require('os');

export class DesktopIntegration {
    private static readonly APPLICATIONS_DIR = path.join(os.homedir(), '.local', 'share', 'applications');
    private static readonly ICONS_DIR = path.join(os.homedir(), '.local', 'share', 'icons', 'winboat');
    
    /**
     * Creates a desktop entry file for a Windows app, making it appear in the Linux start menu
     */
    static async createDesktopEntry(app: WinApp, winboatExecutable?: string): Promise<boolean> {
        try {
            // Ensure directories exist
            await this.ensureDirectoriesExist();
            
            // Ensure launcher script is installed and up-to-date
            await this.ensureLauncherScript();
            
            // Generate safe filename
            const safeAppName = this.sanitizeFileName(app.Name);
            const desktopFileName = `winboat-${safeAppName}.desktop`;
            const desktopFilePath = path.join(this.APPLICATIONS_DIR, desktopFileName);
            
            // Save app icon
            const iconPath = await this.saveAppIcon(app, safeAppName);
            
            // Determine executable path - use provided path or default to WinBoat
            const execPath = winboatExecutable || this.getDefaultExecutablePath();
            
            // Generate desktop entry content
            const desktopContent = this.generateDesktopContent(app, execPath, iconPath);
            
            // Write desktop file
            fs.writeFileSync(desktopFilePath, desktopContent, 'utf8');
            
            // Make it executable
            fs.chmodSync(desktopFilePath, 0o755);
            
            // Update desktop database
            await this.updateDesktopDatabase();
            
            logger.info(`Created desktop entry for ${app.Name} at ${desktopFilePath}`);
            return true;
            
        } catch (error) {
            logger.error(`Failed to create desktop entry for ${app.Name}:`, error);
            return false;
        }
    }
    
    /**
     * Removes the desktop entry for an app
     */
    static async removeDesktopEntry(app: WinApp): Promise<boolean> {
        try {
            const safeAppName = this.sanitizeFileName(app.Name);
            const desktopFileName = `winboat-${safeAppName}.desktop`;
            const desktopFilePath = path.join(this.APPLICATIONS_DIR, desktopFileName);
            
            if (fs.existsSync(desktopFilePath)) {
                fs.unlinkSync(desktopFilePath);
                logger.info(`Removed desktop entry for ${app.Name}`);
                
                // Also remove icon if it exists
                const iconPath = path.join(this.ICONS_DIR, `${safeAppName}.png`);
                if (fs.existsSync(iconPath)) {
                    fs.unlinkSync(iconPath);
                }
            }
            
            // Update desktop database
            await this.updateDesktopDatabase();
            
            return true;
        } catch (error) {
            logger.error(`Failed to remove desktop entry for ${app.Name}:`, error);
            return false;
        }
    }
    
    /**
     * Checks if a desktop entry exists for an app
     */
    static hasDesktopEntry(app: WinApp): boolean {
        const safeAppName = this.sanitizeFileName(app.Name);
        const desktopFileName = `winboat-${safeAppName}.desktop`;
        const desktopFilePath = path.join(this.APPLICATIONS_DIR, desktopFileName);
        return fs.existsSync(desktopFilePath);
    }
    
    /**
     * Lists all WinBoat desktop entries
     */
    static listWinBoatDesktopEntries(): string[] {
        try {
            if (!fs.existsSync(this.APPLICATIONS_DIR)) {
                return [];
            }
            
            const files = fs.readdirSync(this.APPLICATIONS_DIR);
            return files.filter(file => file.startsWith('winboat-') && file.endsWith('.desktop'));
        } catch (error) {
            logger.error('Failed to list WinBoat desktop entries:', error);
            return [];
        }
    }
    
    /**
     * Removes all WinBoat desktop entries (cleanup function)
     */
    static async removeAllWinBoatEntries(): Promise<{ removed: number; errors: string[] }> {
        const entries = this.listWinBoatDesktopEntries();
        let removedCount = 0;
        const errors: string[] = [];
        
        // Remove desktop entries
        for (const entry of entries) {
            try {
                const filePath = path.join(this.APPLICATIONS_DIR, entry);
                fs.unlinkSync(filePath);
                removedCount++;
                logger.info(`Removed desktop entry: ${entry}`);
            } catch (error) {
                const errorMsg = `Failed to remove desktop entry ${entry}: ${error}`;
                logger.error(errorMsg);
                errors.push(errorMsg);
            }
        }
        
        // Clean up icons directory
        let iconCleanupError = false;
        try {
            if (fs.existsSync(this.ICONS_DIR)) {
                const iconFiles = fs.readdirSync(this.ICONS_DIR);
                let iconCount = 0;
                
                for (const iconFile of iconFiles) {
                    try {
                        fs.unlinkSync(path.join(this.ICONS_DIR, iconFile));
                        iconCount++;
                    } catch (error) {
                        const errorMsg = `Failed to remove icon ${iconFile}: ${error}`;
                        logger.warn(errorMsg);
                        errors.push(errorMsg);
                    }
                }
                
                // Try to remove the directory if it's empty
                try {
                    const remainingFiles = fs.readdirSync(this.ICONS_DIR);
                    if (remainingFiles.length === 0) {
                        fs.rmdirSync(this.ICONS_DIR);
                        logger.info('Removed WinBoat icons directory');
                    }
                } catch (error) {
                    logger.warn('Could not remove icons directory:', error);
                }
                
                logger.info(`Cleaned up ${iconCount} icon files`);
            }
        } catch (error) {
            const errorMsg = `Failed to clean up icons directory: ${error}`;
            logger.warn(errorMsg);
            errors.push(errorMsg);
            iconCleanupError = true;
        }
        
        // Update desktop database after cleanup
        try {
            await this.updateDesktopDatabase();
        } catch (error) {
            logger.warn('Failed to update desktop database after cleanup:', error);
        }
        
        const result = { removed: removedCount, errors };
        logger.info(`Desktop cleanup completed: ${removedCount} entries removed, ${errors.length} errors`);
        
        return result;
    }
    
    /**
     * Ensures the WinBoat launcher script is installed and up-to-date
     */
    static async ensureLauncherScript(): Promise<boolean> {
        try {
            const os: typeof import('os') = require('os');
            const path: typeof import('path') = require('path');
            
            const binDir = path.join(os.homedir(), '.local', 'bin');
            const launcherPath = path.join(binDir, 'winboat-launcher');
            
            // Ensure the bin directory exists
            if (!fs.existsSync(binDir)) {
                fs.mkdirSync(binDir, { recursive: true });
                logger.info(`Created directory: ${binDir}`);
            }

            // Check if launcher script already exists and is executable
            if (fs.existsSync(launcherPath)) {
                const stats = fs.statSync(launcherPath);
                if (stats.mode & 0o755) {
                    logger.info('WinBoat launcher script already exists and is executable');
                    return true;
                }
            }

            // Create/update the launcher script
            const launcherScript = this.getLauncherScriptContent();
            fs.writeFileSync(launcherPath, launcherScript, 'utf8');
            fs.chmodSync(launcherPath, 0o755);
            
            logger.info(`Created/updated WinBoat launcher script at ${launcherPath}`);
            return true;
            
        } catch (error) {
            logger.error('Failed to ensure launcher script:', error);
            return false;
        }
    }

    /**
     * Gets the launcher script content
     */
    private static getLauncherScriptContent(): string {
        return `#!/bin/bash
# WinBoat launcher script for desktop entries
# This wrapper handles launching Windows apps through FreeRDP directly (inspired by WinApps)

set -euo pipefail

# Constants
readonly WINBOAT_CONFIG="\${HOME}/.winboat/docker-compose.yml"
readonly WINBOAT_JSON_CONFIG="\${HOME}/.winboat/winboat.config.json"

# Error codes
readonly EC_MISSING_CONFIG=1
readonly EC_MISSING_FREERDP=2
readonly EC_NO_CONTAINER=3
readonly EC_INVALID_APP=4

# Functions
function log_error() {
    echo "ERROR: \$*" >&2
}

function log_info() {
    echo "INFO: \$*"
}

function show_notification() {
    local title="\$1"
    local message="\$2"
    if command -v notify-send >/dev/null 2>&1; then
        notify-send "\$title" "\$message"
    fi
}

function parse_compose_credentials() {
    if [[ ! -f "\$WINBOAT_CONFIG" ]]; then
        log_error "WinBoat compose configuration not found at \$WINBOAT_CONFIG"
        show_notification "WinBoat Error" "WinBoat is not configured. Please run WinBoat first."
        exit \$EC_MISSING_CONFIG
    fi

    # Extract USERNAME and PASSWORD from docker-compose.yml
    RDP_USER=\$(grep -A 20 "environment:" "\$WINBOAT_CONFIG" | grep "USERNAME:" | sed 's/.*USERNAME: *"\\?\\([^"]*\\)"\\?.*/\\1/' | head -1)
    RDP_PASS=\$(grep -A 20 "environment:" "\$WINBOAT_CONFIG" | grep "PASSWORD:" | sed 's/.*PASSWORD: *"\\?\\([^"]*\\)"\\?.*/\\1/' | head -1)

    if [[ -z "\$RDP_USER" || -z "\$RDP_PASS" ]]; then
        log_error "Could not extract RDP credentials from compose file"
        show_notification "WinBoat Error" "Invalid WinBoat configuration"
        exit \$EC_MISSING_CONFIG
    fi
}

function get_rdp_scale() {
    # Get scale from WinBoat JSON config, default to 100
    if [[ -f "\$WINBOAT_JSON_CONFIG" ]] && command -v jq >/dev/null 2>&1; then
        jq -r '.scale // 100' "\$WINBOAT_JSON_CONFIG" 2>/dev/null || echo "100"
    else
        echo "100"
    fi
}

function check_freerdp() {
    if ! command -v xfreerdp3 >/dev/null 2>&1; then
        log_error "FreeRDP 3 (xfreerdp3) not found. Please install FreeRDP."
        show_notification "WinBoat Error" "FreeRDP is not installed"
        exit \$EC_MISSING_FREERDP
    fi
}

function check_container() {
    if ! docker ps --format "table {{.Names}}" 2>/dev/null | grep -q "^WinBoat\$"; then
        log_error "WinBoat container is not running"
        show_notification "WinBoat Error" "Windows container is not running. Please start WinBoat first."
        exit \$EC_NO_CONTAINER
    fi
}

function launch_app() {
    local app_path="\$1"
    
    # Validate app path
    if [[ -z "\$app_path" ]]; then
        log_error "No application path specified"
        show_notification "WinBoat Error" "Invalid application path"
        exit \$EC_INVALID_APP
    fi

    # Extract app name for wm-class (remove path and .exe extension)
    local app_name="\${app_path##*\\\\\\\\}"  # Remove everything before last backslash
    app_name="\${app_name%.*}"            # Remove file extension
    app_name="\${app_name// /_}"          # Replace spaces with underscores for X11

    log_info "Launching: \$app_path"
    log_info "App name: \$app_name"
    log_info "RDP User: \$RDP_USER"
    log_info "RDP Scale: \$RDP_SCALE"

    # Launch app using FreeRDP (WinApps style)
    xfreerdp3 \\
        /u:"\$RDP_USER" \\
        /p:"\$RDP_PASS" \\
        /v:"127.0.0.1" \\
        /cert:ignore \\
        +clipboard \\
        -wallpaper \\
        /sound:sys:pulse \\
        /microphone:sys:pulse \\
        /floatbar \\
        /compression \\
        /scale:"\$RDP_SCALE" \\
        +auto-reconnect \\
        /wm-class:"\$app_name" \\
        /app:program:"\$app_path",name:"\$app_name" &

    local freerdp_pid=\$!
    log_info "Started FreeRDP with PID: \$freerdp_pid"
    
    # Optional: wait for process completion (commented out for background execution)
    # wait \$freerdp_pid
}

# Main execution
function main() {
    local app_path="\$1"

    # Handle --launch-app= format
    if [[ "\$app_path" == --launch-app=* ]]; then
        app_path="\${app_path#--launch-app=}"  # Remove --launch-app= prefix
        app_path="\${app_path//\\"/}"           # Remove quotes
    fi

    # Parse configuration
    parse_compose_credentials
    
    # Get RDP scale from JSON config
    RDP_SCALE=\$(get_rdp_scale)

    # Perform pre-flight checks
    check_freerdp
    check_container

    # Launch the application
    launch_app "\$app_path"
}

# Entry point
if [[ \$# -eq 0 ]]; then
    log_error "Usage: \$0 <app_path> or \$0 --launch-app=\\"<app_path>\\""
    log_error "Example: \$0 \\"C:\\\\Program Files\\\\Microsoft Office\\\\Root\\\\Office16\\\\OUTLOOK.EXE\\""
    exit \$EC_INVALID_APP
fi

main "\$1"`;
    }

    /**
     * Gets the appropriate executable path for desktop entries
     * Uses the WinApps-inspired direct launcher script for both dev and production
     */
    private static getDefaultExecutablePath(): string {
        const os: typeof import('os') = require('os');
        const path: typeof import('path') = require('path');
        
        // Use the launcher script for both dev and production
        // This bypasses Electron entirely and launches apps directly via FreeRDP
        const launcherPath = path.join(os.homedir(), '.local', 'bin', 'winboat-launcher');
        
        return launcherPath;
    }
    
    
    /**
     * Complete system cleanup - removes all WinBoat traces from the desktop environment
     */
    static async performSystemCleanup(): Promise<{ 
        desktopEntries: { removed: number; errors: string[] };
        summary: string;
    }> {
        logger.info('Starting comprehensive WinBoat system cleanup...');
        
        const desktopEntries = await this.removeAllWinBoatEntries();
        
        const summary = [
            `Desktop Entries: ${desktopEntries.removed} removed`,
            desktopEntries.errors.length > 0 ? `${desktopEntries.errors.length} errors encountered` : 'No errors'
        ].join(', ');
        
        logger.info(`System cleanup completed: ${summary}`);
        
        return {
            desktopEntries,
            summary
        };
    }
    
    private static async ensureDirectoriesExist(): Promise<void> {
        const directories = [this.APPLICATIONS_DIR, this.ICONS_DIR];
        
        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info(`Created directory: ${dir}`);
            }
        }
    }
    
    private static async saveAppIcon(app: WinApp, safeAppName: string): Promise<string> {
        const iconFileName = `${safeAppName}.png`;
        const iconPath = path.join(this.ICONS_DIR, iconFileName);
        
        try {
            // Convert base64 icon to binary
            const iconBuffer = Buffer.from(app.Icon, 'base64');
            
            // Use JIMP to load, scale, and optimize the icon
            const { Jimp, ResizeStrategy } = require('jimp');
            const image = await Jimp.fromBuffer(iconBuffer);
            
            // Get current dimensions
            const width = image.width;
            const height = image.height;
            
            // Define target size for desktop icons (64x64 is good for most desktop environments)
            const targetSize = 64;
            
            // Only upscale if the image is smaller than target size
            if (width < targetSize || height < targetSize) {
                // Scale using bicubic for better quality when upscaling
                image.resize({ w: targetSize, h: targetSize, mode: ResizeStrategy.BICUBIC });
            } else if (width !== height) {
                // If not square, make it square by cropping/resizing to the smaller dimension
                const size = Math.min(width, height);
                image.resize({ w: size, h: size, mode: ResizeStrategy.BICUBIC });
            }
            
            // Save the processed icon
            await image.write(iconPath);
            
            return iconPath;
        } catch (error) {
            logger.warn(`Failed to save icon for ${app.Name}, using default:`, error);
            
            // Try to save the original icon without processing as fallback
            try {
                const iconBuffer = Buffer.from(app.Icon, 'base64');
                fs.writeFileSync(iconPath, iconBuffer);
                return iconPath;
            } catch (fallbackError) {
                logger.error(`Failed to save even unprocessed icon for ${app.Name}:`, fallbackError);
                return '';
            }
        }
    }
    
    private static generateDesktopContent(app: WinApp, execPath: string, iconPath: string): string {
        // Determine appropriate category based on app name/path
        const category = this.determineCategory(app);
        
        // Use the launcher script directly without NODE_ENV since it bypasses Electron
        return `[Desktop Entry]
Type=Application
Name=${app.Name}
Comment=Launch ${app.Name} via WinBoat
Exec=${execPath} --launch-app="${app.Path}"
Icon=${iconPath}
Terminal=false
Categories=${category};
StartupNotify=true
MimeType=application/x-winboat-app;
Keywords=windows;app;winboat;${app.Name.toLowerCase()};
X-WinBoat-App=true
X-WinBoat-Path=${app.Path}
`;
    }
    
    private static determineCategory(app: WinApp): string {
        const name = app.Name.toLowerCase();
        const path = app.Path.toLowerCase();
        
        // Game categories
        if (name.includes('game') || path.includes('games') || 
            name.includes('steam') || name.includes('epic')) {
            return 'Game';
        }
        
        // Development tools
        if (name.includes('studio') || name.includes('code') || name.includes('git') ||
            name.includes('developer') || path.includes('development')) {
            return 'Development';
        }
        
        // Graphics and multimedia
        if (name.includes('photo') || name.includes('image') || name.includes('video') ||
            name.includes('adobe') || name.includes('gimp') || name.includes('blender')) {
            return 'Graphics';
        }
        
        // Office applications
        if (name.includes('office') || name.includes('word') || name.includes('excel') ||
            name.includes('powerpoint') || name.includes('outlook')) {
            return 'Office';
        }
        
        // Internet/Network
        if (name.includes('browser') || name.includes('chrome') || name.includes('firefox') ||
            name.includes('internet') || name.includes('mail')) {
            return 'Network';
        }
        
        // Audio/Video
        if (name.includes('media') || name.includes('player') || name.includes('music') ||
            name.includes('audio') || name.includes('video')) {
            return 'AudioVideo';
        }
        
        // Default to Utility for unknown apps
        return 'Utility';
    }
    
    /**
     * Updates the desktop database to refresh the application menu
     */
    private static async updateDesktopDatabase(): Promise<void> {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);
            
            // Update the desktop database to refresh the application menu
            await execAsync('update-desktop-database ~/.local/share/applications/');
            logger.info('Desktop database updated');
        } catch (error) {
            logger.warn('Failed to update desktop database (this is usually not critical):', error);
        }
    }
    
    private static sanitizeFileName(name: string): string {
        // Replace invalid characters with dash and remove multiple consecutive dashes
        return name
            .replace(/[^a-zA-Z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
    }
}