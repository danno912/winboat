const { execSync, exec } = require("child_process");

export interface XFreerdpSession {
    pid: number;
    appPath: string;
    commandLine: string;
    startTime: string;
    memoryUsage: number; // in MB
    cpuUsage: number; // percentage
    windowTitle?: string;
}

export class SessionManager {
    
    async getRunningXFreerdpSessions(): Promise<XFreerdpSession[]> {
        const sessions: XFreerdpSession[] = [];
        
        try {
            // Get all xfreerdp3 processes
            const psOutput = execSync('ps aux | grep xfreerdp3 | grep -v grep', { encoding: 'utf-8' }).trim();
            
            if (!psOutput) {
                return sessions;
            }
            
            const lines = psOutput.split('\n');
            
            for (const line of lines) {
                try {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 11) continue;
                    
                    const pid = parseInt(parts[1]);
                    const cpuUsage = parseFloat(parts[2]);
                    const memoryUsage = parseInt(parts[5]) / 1024; // Convert from KB to MB
                    const startTime = parts[8];
                    
                    // Extract command line starting from the 11th field
                    const commandLine = parts.slice(10).join(' ');
                    
                    // Extract app path and name directly from xfreerdp command line
                    let appPath = 'Unknown Application';
                    let windowTitle = undefined;
                    
                    // Check if this is a Windows Desktop session (fullscreen mode)
                    if (commandLine.includes('+f') || commandLine.includes('/f')) {
                        appPath = 'Windows Desktop';
                        windowTitle = '⚙️ Windows Desktop';
                    } else {
                        // Parse modern format with quotes: /app:program:"path",name:"name"
                        let modernAppMatch = commandLine.match(/\/app:program:"([^"]+)",name:"([^"]+)"/);
                        
                        // Also try without quotes for desktop integration: /app:program:path,name:name
                        // The name part should capture everything after "name:" until the next forward slash or end
                        if (!modernAppMatch) {
                            modernAppMatch = commandLine.match(/\/app:program:([^,]+),name:([^\/]+?)(?:\s+\/|$)/);
                        }
                        
                        if (modernAppMatch) {
                            const fullPath = modernAppMatch[1];
                            const appName = modernAppMatch[2].trim();
                            
                            // Use the friendly app name as the main display (appPath)
                            appPath = appName;
                            
                            // Extract just the executable name for the window title (secondary info)
                            const execName = fullPath.split('\\').pop()?.replace(/\.exe$/i, '') || fullPath;
                            windowTitle = execName;
                        } else {
                            // Fallback to older format: /app:"path"
                            const legacyAppMatch = commandLine.match(/\/app:"([^"]+)"/);
                            if (legacyAppMatch) {
                                appPath = legacyAppMatch[1];
                                // Extract just the application name from the full path
                                const appName = appPath.split('\\').pop()?.replace('.exe', '') || appPath;
                                appPath = appName;
                                windowTitle = appName; // Use executable name as window title
                            }
                        }
                    }
                    
                    sessions.push({
                        pid,
                        appPath,
                        commandLine,
                        startTime,
                        memoryUsage: Math.round(memoryUsage),
                        cpuUsage,
                        windowTitle
                    });
                } catch (error) {
                    console.warn('Error parsing xfreerdp process line:', error);
                }
            }
        } catch (error) {
            // No xfreerdp processes found or ps command failed
            console.log('No xfreerdp sessions found or error occurred:', error);
        }
        
        return sessions.sort((a, b) => a.appPath.localeCompare(b.appPath));
    }
    
    async killSession(pid: number): Promise<boolean> {
        try {
            execSync(`kill ${pid}`, { stdio: 'ignore' });
            console.log(`Killed xfreerdp session with PID ${pid}`);
            return true;
        } catch (error) {
            console.error(`Failed to kill session ${pid}:`, error);
            return false;
        }
    }
    
    async forceKillSession(pid: number): Promise<boolean> {
        try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            console.log(`Force killed xfreerdp session with PID ${pid}`);
            return true;
        } catch (error) {
            console.error(`Failed to force kill session ${pid}:`, error);
            return false;
        }
    }
    
    async killAllSessions(): Promise<{ killed: number; failed: number }> {
        const sessions = await this.getRunningXFreerdpSessions();
        let killed = 0;
        let failed = 0;
        
        for (const session of sessions) {
            const success = await this.killSession(session.pid);
            if (success) {
                killed++;
            } else {
                failed++;
            }
        }
        
        return { killed, failed };
    }
    
    async getSessionStats(): Promise<{ totalSessions: number; totalMemoryUsage: number; totalCpuUsage: number }> {
        const sessions = await this.getRunningXFreerdpSessions();
        
        const totalSessions = sessions.length;
        const totalMemoryUsage = sessions.reduce((sum, session) => sum + session.memoryUsage, 0);
        const totalCpuUsage = sessions.reduce((sum, session) => sum + session.cpuUsage, 0);
        
        return {
            totalSessions,
            totalMemoryUsage: Math.round(totalMemoryUsage),
            totalCpuUsage: Math.round(totalCpuUsage * 10) / 10 // Round to 1 decimal
        };
    }
    
    async isSessionResponding(pid: number): Promise<boolean> {
        try {
            // Send signal 0 to check if process exists and is responsive
            execSync(`kill -0 ${pid}`, { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }
    
    async getSessionUptime(pid: number): Promise<string> {
        try {
            const etimeOutput = execSync(`ps -o etime= -p ${pid}`, { encoding: 'utf-8' }).trim();
            return etimeOutput || 'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    }
}