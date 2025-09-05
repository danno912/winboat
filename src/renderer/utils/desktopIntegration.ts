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
     * Gets the appropriate executable path for desktop entries
     * In development, returns a command that runs electron with the main.js file and dev server port
     * In production, would return the packaged app path
     */
    private static getDefaultExecutablePath(): string {
        const remote: typeof import('@electron/remote') = require('@electron/remote');
        const path: typeof import('path') = require('path');
        
        // Check if we're in development mode
        const isDev = process.env.NODE_ENV === 'development' || import.meta.env?.DEV;
        
        if (isDev) {
            // In development, we need to run electron with the built main.js and the dev server port
            const appPath = remote.app.getAppPath();
            const electronPath = process.execPath;
            
            // In dev mode, appPath might already point to build/main, so check and adjust
            const mainJsPath = appPath.includes('build/main') 
                ? path.join(appPath, 'main.js')
                : path.join(appPath, 'build', 'main', 'main.js');
            
            // Get the current dev server port - try to find it from running processes
            const devServerPort = this.getDevServerPort();
            
            return `"${electronPath}" "${mainJsPath}" ${devServerPort}`;
        } else {
            // In production, use the packaged executable
            return `"${process.execPath}"`;
        }
    }
    
    /**
     * Attempts to find the current Vite dev server port
     */
    private static getDevServerPort(): string {
        // In development, try to get the port from the current window location
        // This is a fallback - ideally we'd store this somewhere accessible
        if (typeof window !== 'undefined' && window.location) {
            const port = window.location.port;
            if (port) {
                return port;
            }
        }
        
        // Fallback to common Vite dev server port
        return '8080';
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
            // Convert base64 icon to binary and save
            const iconBuffer = Buffer.from(app.Icon, 'base64');
            fs.writeFileSync(iconPath, iconBuffer);
            return iconPath;
        } catch (error) {
            logger.warn(`Failed to save icon for ${app.Name}, using default:`, error);
            // Return a default icon path or empty string
            return '';
        }
    }
    
    private static generateDesktopContent(app: WinApp, execPath: string, iconPath: string): string {
        // Determine appropriate category based on app name/path
        const category = this.determineCategory(app);
        
        // In development mode, we need to set NODE_ENV
        const isDev = process.env.NODE_ENV === 'development' || import.meta.env?.DEV;
        const execCommand = isDev ? `env NODE_ENV=development ${execPath}` : execPath;
        
        return `[Desktop Entry]
Type=Application
Name=${app.Name}
Comment=Launch ${app.Name} via WinBoat
Exec=${execCommand} --launch-app="${app.Path}"
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