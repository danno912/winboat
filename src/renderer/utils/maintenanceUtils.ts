const fs: typeof import("fs") = require("fs");
const path: typeof import("path") = require("path");
const os: typeof import("os") = require("os");
const { execSync } = require("child_process");

import { WINBOAT_DIR } from "../lib/constants";

export interface MaintenanceReport {
    timestamp: string;
    systemInfo: {
        platform: string;
        osVersion: string;
        nodeVersion: string;
        electronVersion: string;
        winboatVersion: string;
        homeDirectory: string;
        winboatDirectory: string;
    };
    containerInfo: {
        dockerVersion: string;
        dockerComposeVersion: string;
        containerStatus: string;
        containerStats?: any;
        imageInfo?: any;
    };
    diskUsage: {
        winboatDirectory: number; // in MB
        containerImages: number; // in MB
        logs: number; // in MB
        cache: number; // in MB
        totalUsage: number; // in MB
    };
    issues: string[];
    suggestions: string[];
    healthScore: number; // 0-100
}

export interface CleanupResult {
    cleanedFiles: string[];
    freedSpace: number; // in MB
    errors: string[];
}

export class MaintenanceManager {
    private readonly winboatDir: string;
    private readonly logsDir: string;
    private readonly cacheDir: string;

    constructor() {
        this.winboatDir = WINBOAT_DIR;
        this.logsDir = path.join(this.winboatDir, 'logs');
        this.cacheDir = path.join(this.winboatDir, 'cache');
    }

    async generateReport(): Promise<MaintenanceReport> {
        const timestamp = new Date().toISOString();
        const issues: string[] = [];
        const suggestions: string[] = [];

        // System Information
        const systemInfo = {
            platform: os.platform(),
            osVersion: os.release(),
            nodeVersion: process.version,
            electronVersion: process.versions.electron || 'N/A',
            winboatVersion: await this.getWinboatVersion(),
            homeDirectory: os.homedir(),
            winboatDirectory: this.winboatDir
        };

        // Container Information
        const containerInfo = await this.getContainerInfo();

        // Disk Usage Analysis
        const diskUsage = await this.analyzeDiskUsage();

        // Health Checks
        await this.performHealthChecks(issues, suggestions);

        // Calculate Health Score
        const healthScore = this.calculateHealthScore(issues, containerInfo, diskUsage);

        return {
            timestamp,
            systemInfo,
            containerInfo,
            diskUsage,
            issues,
            suggestions,
            healthScore
        };
    }

    private async getWinboatVersion(): Promise<string> {
        try {
            const packageJsonPath = path.join(__dirname, '../../../package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                return packageJson.version || 'Unknown';
            }
            return 'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    }

    private async getContainerInfo(): Promise<any> {
        const info: any = {
            dockerVersion: 'N/A',
            dockerComposeVersion: 'N/A',
            containerStatus: 'N/A'
        };

        try {
            // Get Docker version
            const dockerVersion = execSync('docker --version', { encoding: 'utf-8' }).trim();
            info.dockerVersion = dockerVersion;
        } catch (error) {
            // Docker not available
        }

        try {
            // Get Docker Compose version
            const composeVersion = execSync('docker compose version', { encoding: 'utf-8' }).trim();
            info.dockerComposeVersion = composeVersion;
        } catch (error) {
            try {
                // Try docker-compose (v1)
                const composeVersion = execSync('docker-compose --version', { encoding: 'utf-8' }).trim();
                info.dockerComposeVersion = composeVersion;
            } catch (error2) {
                // Docker Compose not available
            }
        }

        try {
            // Get WinBoat container status
            const containerStatus = execSync('docker ps -a --filter "name=winboat" --format "table {{.Names}}\\t{{.Status}}"', { encoding: 'utf-8' });
            info.containerStatus = containerStatus.trim() || 'No containers found';

            // Get container stats if running
            try {
                const stats = execSync('docker stats winboat --no-stream --format "table {{.CPUPerc}}\\t{{.MemUsage}}"', { encoding: 'utf-8' });
                info.containerStats = stats.trim();
            } catch (error) {
                // Container not running
            }

            // Get image info
            try {
                const imageInfo = execSync('docker images --filter "reference=dockur/windows" --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"', { encoding: 'utf-8' });
                info.imageInfo = imageInfo.trim();
            } catch (error) {
                // Image not found
            }

        } catch (error) {
            // Docker commands failed
        }

        return info;
    }

    private async analyzeDiskUsage(): Promise<any> {
        const usage = {
            winboatDirectory: 0,
            containerImages: 0,
            logs: 0,
            cache: 0,
            totalUsage: 0
        };

        try {
            // WinBoat directory size
            if (fs.existsSync(this.winboatDir)) {
                usage.winboatDirectory = await this.getDirectorySize(this.winboatDir);
            }

            // Container images size
            try {
                const imagesOutput = execSync('docker system df --format "table {{.Type}}\\t{{.Size}}"', { encoding: 'utf-8' });
                const lines = imagesOutput.split('\n');
                for (const line of lines) {
                    if (line.includes('Images')) {
                        const sizeMatch = line.match(/(\d+\.?\d*)(GB|MB)/);
                        if (sizeMatch) {
                            const size = parseFloat(sizeMatch[1]);
                            const unit = sizeMatch[2];
                            usage.containerImages = unit === 'GB' ? size * 1024 : size;
                        }
                    }
                }
            } catch (error) {
                // Docker not available
            }

            // Logs size
            if (fs.existsSync(this.logsDir)) {
                usage.logs = await this.getDirectorySize(this.logsDir);
            }

            // Cache size
            if (fs.existsSync(this.cacheDir)) {
                usage.cache = await this.getDirectorySize(this.cacheDir);
            }

            usage.totalUsage = usage.winboatDirectory + usage.containerImages + usage.logs + usage.cache;

        } catch (error) {
            console.error('Error analyzing disk usage:', error);
        }

        return usage;
    }

    private async getDirectorySize(dirPath: string): Promise<number> {
        let totalSize = 0;

        const calculateSize = (currentPath: string) => {
            try {
                const stats = fs.statSync(currentPath);
                if (stats.isDirectory()) {
                    const files = fs.readdirSync(currentPath);
                    for (const file of files) {
                        calculateSize(path.join(currentPath, file));
                    }
                } else {
                    totalSize += stats.size;
                }
            } catch (error) {
                // Skip inaccessible files
            }
        };

        calculateSize(dirPath);
        return Math.round(totalSize / (1024 * 1024)); // Convert to MB
    }

    private async performHealthChecks(issues: string[], suggestions: string[]): Promise<void> {
        // Check if Docker is installed and running
        try {
            execSync('docker --version', { stdio: 'ignore' });
        } catch (error) {
            issues.push('Docker is not installed or not accessible');
            suggestions.push('Install Docker and ensure it is running');
        }

        // Check if Docker Compose is available
        try {
            execSync('docker compose version', { stdio: 'ignore' });
        } catch (error) {
            try {
                execSync('docker-compose --version', { stdio: 'ignore' });
            } catch (error2) {
                issues.push('Docker Compose is not available');
                suggestions.push('Install Docker Compose v2 for better performance');
            }
        }

        // Check if FreeRDP is installed
        try {
            execSync('which xfreerdp3', { stdio: 'ignore' });
        } catch (error) {
            issues.push('FreeRDP 3 is not installed');
            suggestions.push('Install FreeRDP 3 for RemoteApp functionality');
        }

        // Check WinBoat directory permissions
        try {
            fs.accessSync(this.winboatDir, fs.constants.W_OK);
        } catch (error) {
            issues.push('WinBoat directory is not writable');
            suggestions.push('Fix WinBoat directory permissions');
        }

        // Check for large log files
        if (fs.existsSync(this.logsDir)) {
            const logFiles = fs.readdirSync(this.logsDir);
            for (const file of logFiles) {
                const filePath = path.join(this.logsDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (stats.size > 50 * 1024 * 1024) { // > 50MB
                        issues.push(`Large log file detected: ${file} (${Math.round(stats.size / (1024 * 1024))}MB)`);
                        suggestions.push('Consider cleaning up old log files');
                    }
                } catch (error) {
                    // Skip inaccessible files
                }
            }
        }

        // Check available disk space
        try {
            const usage = await this.analyzeDiskUsage();
            if (usage.totalUsage > 10 * 1024) { // > 10GB
                suggestions.push('Consider cleaning up unused containers and images to free disk space');
            }
        } catch (error) {
            // Skip if cannot analyze
        }

        // Check for orphaned containers
        try {
            const orphanedContainers = execSync('docker ps -a --filter "status=exited" --filter "name=winboat" --format "{{.Names}}"', { encoding: 'utf-8' }).trim();
            if (orphanedContainers) {
                issues.push('Orphaned WinBoat containers detected');
                suggestions.push('Remove orphaned containers to free resources');
            }
        } catch (error) {
            // Docker not available
        }
    }

    private calculateHealthScore(issues: string[], containerInfo: any, diskUsage: any): number {
        let score = 100;

        // Deduct points for issues
        score -= issues.length * 10;

        // Deduct points if Docker is not available
        if (containerInfo.dockerVersion === 'N/A') {
            score -= 30;
        }

        // Deduct points for excessive disk usage (>5GB)
        if (diskUsage.totalUsage > 5 * 1024) {
            score -= 10;
        }

        // Deduct points for very high disk usage (>10GB)
        if (diskUsage.totalUsage > 10 * 1024) {
            score -= 20;
        }

        return Math.max(0, Math.min(100, score));
    }

    async cleanupLogs(olderThanDays: number = 7): Promise<CleanupResult> {
        const result: CleanupResult = {
            cleanedFiles: [],
            freedSpace: 0,
            errors: []
        };

        try {
            if (!fs.existsSync(this.logsDir)) {
                return result;
            }

            const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
            const logFiles = fs.readdirSync(this.logsDir);

            for (const file of logFiles) {
                const filePath = path.join(this.logsDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (stats.mtime < cutoffDate) {
                        const sizeInMB = Math.round(stats.size / (1024 * 1024));
                        fs.unlinkSync(filePath);
                        result.cleanedFiles.push(file);
                        result.freedSpace += sizeInMB;
                        console.log(`Cleaned up log file: ${file} (${sizeInMB}MB)`);
                    }
                } catch (error) {
                    result.errors.push(`Could not clean ${file}: ${error}`);
                }
            }
        } catch (error) {
            result.errors.push(`Error cleaning logs: ${error}`);
        }

        return result;
    }

    async cleanupCache(): Promise<CleanupResult> {
        const result: CleanupResult = {
            cleanedFiles: [],
            freedSpace: 0,
            errors: []
        };

        try {
            if (!fs.existsSync(this.cacheDir)) {
                return result;
            }

            const cacheFiles = fs.readdirSync(this.cacheDir);

            for (const file of cacheFiles) {
                const filePath = path.join(this.cacheDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    const sizeInMB = Math.round(stats.size / (1024 * 1024));
                    
                    if (stats.isDirectory()) {
                        // Recursively remove directory
                        fs.rmSync(filePath, { recursive: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                    
                    result.cleanedFiles.push(file);
                    result.freedSpace += sizeInMB;
                    console.log(`Cleaned up cache: ${file} (${sizeInMB}MB)`);
                } catch (error) {
                    result.errors.push(`Could not clean ${file}: ${error}`);
                }
            }
        } catch (error) {
            result.errors.push(`Error cleaning cache: ${error}`);
        }

        return result;
    }

    async cleanupContainers(): Promise<CleanupResult> {
        const result: CleanupResult = {
            cleanedFiles: [],
            freedSpace: 0,
            errors: []
        };

        try {
            // Remove stopped containers
            const stoppedContainers = execSync('docker ps -a --filter "status=exited" --filter "name=winboat" --format "{{.Names}}"', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
            
            for (const container of stoppedContainers) {
                try {
                    execSync(`docker rm ${container}`, { stdio: 'ignore' });
                    result.cleanedFiles.push(`Container: ${container}`);
                    console.log(`Removed stopped container: ${container}`);
                } catch (error) {
                    result.errors.push(`Could not remove container ${container}: ${error}`);
                }
            }

            // Clean unused images (be careful not to remove the Windows image)
            try {
                const pruneOutput = execSync('docker image prune -f', { encoding: 'utf-8' });
                const sizeMatch = pruneOutput.match(/Total reclaimed space: (\d+\.?\d*)(GB|MB|KB|B)/);
                if (sizeMatch) {
                    const size = parseFloat(sizeMatch[1]);
                    const unit = sizeMatch[2];
                    let sizeInMB = size;
                    if (unit === 'GB') sizeInMB = size * 1024;
                    else if (unit === 'KB') sizeInMB = size / 1024;
                    else if (unit === 'B') sizeInMB = size / (1024 * 1024);
                    
                    result.freedSpace += Math.round(sizeInMB);
                    result.cleanedFiles.push('Unused Docker images');
                }
            } catch (error) {
                result.errors.push(`Could not prune images: ${error}`);
            }

        } catch (error) {
            result.errors.push(`Error cleaning containers: ${error}`);
        }

        return result;
    }

    async performFullCleanup(): Promise<{ logs: CleanupResult; cache: CleanupResult; containers: CleanupResult }> {
        console.log('Starting full WinBoat cleanup...');
        
        const results = {
            logs: await this.cleanupLogs(),
            cache: await this.cleanupCache(),
            containers: await this.cleanupContainers()
        };

        const totalFreed = results.logs.freedSpace + results.cache.freedSpace + results.containers.freedSpace;
        console.log(`Full cleanup completed. Total space freed: ${totalFreed}MB`);

        return results;
    }

    async exportReport(report: MaintenanceReport, outputPath?: string): Promise<string> {
        const fileName = `winboat-maintenance-report-${new Date().toISOString().slice(0, 10)}.json`;
        const filePath = outputPath || path.join(this.winboatDir, fileName);

        try {
            fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
            console.log(`Maintenance report exported to: ${filePath}`);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to export report: ${error}`);
        }
    }

    async getSystemRequirements(): Promise<{ met: string[]; missing: string[]; optional: string[] }> {
        const requirements = {
            met: [] as string[],
            missing: [] as string[],
            optional: [] as string[]
        };

        // Essential requirements
        const essential = [
            { name: 'Docker', command: 'docker --version', description: 'Container runtime' },
            { name: 'Docker Compose v2', command: 'docker compose version', description: 'Container orchestration' },
        ];

        // Optional requirements
        const optional = [
            { name: 'FreeRDP 3', command: 'xfreerdp3 --version', description: 'Remote desktop client' },
            { name: 'Docker Compose v1', command: 'docker-compose --version', description: 'Legacy container orchestration' }
        ];

        for (const req of essential) {
            try {
                execSync(req.command, { stdio: 'ignore' });
                requirements.met.push(`${req.name}: ${req.description}`);
            } catch (error) {
                requirements.missing.push(`${req.name}: ${req.description}`);
            }
        }

        for (const req of optional) {
            try {
                execSync(req.command, { stdio: 'ignore' });
                requirements.optional.push(`${req.name}: ${req.description} ✓`);
            } catch (error) {
                requirements.optional.push(`${req.name}: ${req.description} ✗`);
            }
        }

        return requirements;
    }
}