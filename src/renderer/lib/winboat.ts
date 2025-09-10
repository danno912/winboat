import { ref, type Ref } from "vue";
import { WINBOAT_DIR, WINBOAT_GUEST_API } from "./constants";
import type { ComposeConfig, GuestServerUpdateResponse, GuestServerVersion, Metrics, WinApp } from "../../types";
import { createLogger } from "../utils/log";
import { AppIcons } from "../data/appicons";
import YAML from 'yaml';
import PrettyYAML from "json-to-pretty-yaml";
import { InternalApps } from "../data/internalapps";
import { getFreeRDP } from "../utils/getFreeRDP";
import { WinboatConfig } from "./config";
const nodeFetch: typeof import('node-fetch').default = require('node-fetch');
const path: typeof import('path') = require('path');
const fs: typeof import('fs') = require('fs');
const { promisify }: typeof import('util') = require('util');
const { exec }: typeof import('child_process') = require('child_process');
const remote: typeof import('@electron/remote') = require('@electron/remote');
const FormData: typeof import('form-data') = require('form-data');

const execAsync = promisify(exec);

let instance: Winboat | null = null;
const logger = createLogger(path.join(WINBOAT_DIR, 'winboat.log'));
const USAGE_PATH = path.join(WINBOAT_DIR, 'appUsage.json');

const presetApps: WinApp[] = [
    {
        Name: "⚙️ Windows Desktop",
        Icon: AppIcons[InternalApps.WINDOWS_DESKTOP],
        Source: "internal",
        Path: InternalApps.WINDOWS_DESKTOP,
        Usage: 0,
        Hidden: false,
        GroupId: null
    },
    {
        Name: "⚙️ Windows Explorer",
        Icon: AppIcons[InternalApps.WINDOWS_EXPLORER],
        Source: "internal",
        Path: "%windir%\\explorer.exe",
        Usage: 0,
        Hidden: false,
        GroupId: null
    }
]

export const ContainerStatus = {
    "Created": "created",
    "Restarting": "restarting",
    "Running": "running",
    "Paused": "paused",
    "Exited": "exited",
    "Dead": "dead"
} as const;

type ContainerStatusValue = typeof ContainerStatus[keyof typeof ContainerStatus];

class AppManager {
    appCache: WinApp[] = []
    appUsageCache: { [key: string]: number } = {};
    #wbConfig: WinboatConfig | null = null;
    
    constructor() {
        if(!fs.existsSync(USAGE_PATH)) {
            fs.writeFileSync(USAGE_PATH, "{}");
        }

        this.#wbConfig = new WinboatConfig();
    }

    async updateAppCache(options: { forceRead: boolean } = { forceRead: false }) {
        const res = await nodeFetch(`${WINBOAT_GUEST_API}/apps`);
        const newApps = await res.json() as WinApp[];
        newApps.push(...presetApps);
        newApps.push(...this.#wbConfig!.config.customApps);

        if(this.appCache.values.length == newApps.length && !options.forceRead) return

        for(const appIdx in newApps) {
            const app = newApps[appIdx];
            // Preserve usage count
            app.Usage = this.appCache.find((cachedApp) => cachedApp.Name == app.Name)?.Usage || 0;
            this.appUsageCache[app.Name] = app.Usage;
            
            // Set hidden state from config
            app.Hidden = this.#wbConfig!.isAppHidden(app.Path);
            
            // Set group ID from config
            app.GroupId = this.#wbConfig!.config.appGroupMappings[app.Path] || null;
        }

        this.appCache = newApps;
    }

    async getApps(): Promise<WinApp[]> {
        if(this.appCache.length > 0) {
            return this.appCache;
        }

        // Get the usage object that's on the disk
        const fsUsage = Object.entries(JSON.parse(fs.readFileSync(USAGE_PATH, 'utf-8'))) as any[]; 
        this.appCache = []; 

        // Populate appCache with dummy WinApp object containing data from the disk
        for (let i = 0; i < fsUsage.length; i++) {
            this.appCache.push({
                ...presetApps[0],
                "Name": fsUsage[i][0],
                "Usage": fsUsage[i][1]
            });
        }

        await this.updateAppCache({ forceRead: true });

        const appCacheHumanReadable = this.appCache.map(obj => {
            const res = { ...obj } as any;
            delete res.Icon;
            return res;
        })

        logger.info(`AppCache: ${JSON.stringify(appCacheHumanReadable, null, 4)}`);

        return this.appCache;
    }

    incrementAppUsage(app: WinApp) {
        app.Usage!++;
        this.appUsageCache[app.Name]++;
    }

    async writeToDisk() {
        fs.writeFileSync(USAGE_PATH, JSON.stringify(this.appUsageCache));
    }

    /**
     * Adds a custom app to WinBoat's application list
     * @param name Name of the app
     * @param path Path of the app
     * @param icon Icon of the app
     */
    async addCustomApp(name: string, path: string, icon: string) {
        const customWinApp: WinApp = {
            Name: name,
            Path: path,
            Icon: icon,
            Source: "custom",
            Usage: 0,
            Hidden: false,
            GroupId: null
        }
        this.appCache.push(customWinApp);
        this.appUsageCache[name] = 0;
        await this.writeToDisk();
        this.#wbConfig!.config.customApps = this.#wbConfig!.config.customApps.concat(customWinApp);
    }

    /**
     * Removes a custom app from WinBoat's application list
     * @param app The app to remove
     */
    async removeCustomApp(app: WinApp) {
        this.appCache = this.appCache.filter((a) => a.Name !== app.Name);
        this.appUsageCache = Object.fromEntries(Object.entries(this.appUsageCache).filter(([key]) => key !== app.Name));
        await this.writeToDisk();
        this.#wbConfig!.config.customApps = this.#wbConfig!.config.customApps.filter((a) => a.Name !== app.Name);
    }

    /**
     * Toggle app visibility (hide/show)
     * @param app The app to toggle
     */
    toggleAppVisibility(app: WinApp): boolean {
        const newHiddenState = this.#wbConfig!.toggleAppVisibility(app.Path);
        // Update the app in cache
        const cachedApp = this.appCache.find(a => a.Path === app.Path);
        if (cachedApp) {
            cachedApp.Hidden = newHiddenState;
        }
        return newHiddenState;
    }

    /**
     * Get only visible apps
     */
    getVisibleApps(): WinApp[] {
        return this.appCache.filter(app => !app.Hidden);
    }

    /**
     * Get only hidden apps
     */
    getHiddenApps(): WinApp[] {
        return this.appCache.filter(app => app.Hidden);
    }

    /**
     * Create a new app group
     */
    createAppGroup(name: string, options?: { icon?: string; color?: string }) {
        return this.#wbConfig!.createAppGroup(name, options);
    }

    /**
     * Delete an app group
     */
    deleteAppGroup(groupId: string): boolean {
        const success = this.#wbConfig!.deleteAppGroup(groupId);
        // Update cache - remove group IDs from apps
        this.appCache.forEach(app => {
            if (app.GroupId === groupId) {
                app.GroupId = null;
            }
        });
        return success;
    }

    /**
     * Assign app to group
     */
    assignAppToGroup(app: WinApp, groupId: string | null): void {
        this.#wbConfig!.assignAppToGroup(app.Path, groupId);
        // Update cache
        const cachedApp = this.appCache.find(a => a.Path === app.Path);
        if (cachedApp) {
            cachedApp.GroupId = groupId;
        }
    }

    /**
     * Get all app groups
     */
    getAppGroups() {
        return this.#wbConfig!.getAppGroups();
    }

    /**
     * Get apps in a specific group
     */
    getAppsInGroup(groupId: string): WinApp[] {
        return this.appCache.filter(app => app.GroupId === groupId);
    }

    /**
     * Get ungrouped apps
     */
    getUngroupedApps(): WinApp[] {
        return this.appCache.filter(app => !app.GroupId && !app.Hidden);
    }
}

export class Winboat {
    #healthInterval: NodeJS.Timeout | null = null;
    isOnline: Ref<boolean> = ref(false);
    guestAPIStartTime: Ref<number | null> = ref(null);
    isUpdatingGuestServer: Ref<boolean> = ref(false);
    #containerInterval: NodeJS.Timeout | null = null;
    containerStatus: Ref<ContainerStatusValue> = ref(ContainerStatus.Exited)
    containerActionLoading: Ref<boolean> = ref(false)
    #metricsInverval: NodeJS.Timeout | null = null;
    #rdpConnectionStatusInterval: NodeJS.Timeout | null = null;
    rdpConnected: Ref<boolean> = ref(false);
    metrics: Ref<Metrics> = ref<Metrics>({
        cpu: {
            usage: 0,
            frequency: 0
        },
        ram: {
            used: 0,
            total: 0,
            percentage: 0
        },
        disk: {
            used: 0,
            total: 0,
            percentage: 0
        }
    })
    #wbConfig: WinboatConfig | null = null
    appMgr: AppManager | null = null

    constructor() {
        if (instance) return instance;
        
        // This is a special interval which will never be destroyed
        this.#containerInterval = setInterval(async () => {
            const _containerStatus = await this.getContainerStatus();
            if (_containerStatus !== this.containerStatus.value) {
                this.containerStatus.value = _containerStatus;
                logger.info(`Winboat Container state changed to ${_containerStatus}`);

                if (_containerStatus === ContainerStatus.Running) {
                    this.createAPIInvervals();
                } else {
                    this.destroyAPIInvervals();
                }
            }
        }, 1000);

        this.#wbConfig = new WinboatConfig();

        this.appMgr = new AppManager();

        instance = this;

        return instance;
    }

    /**
     * Creates the intervals which rely on the Winboat Guest API.
     */
    createAPIInvervals() {
        logger.info("Creating Winboat API intervals...");
        const HEALTH_WAIT_MS = 1000;
        const METRICS_WAIT_MS = 1000;
        const RDP_STATUS_WAIT_MS = 1000;

        // Make sure we don't have any existing intervals
        if (this.#healthInterval) {
            clearInterval(this.#healthInterval);
            this.#healthInterval = null;
        }

        this.#healthInterval = setInterval(async () => {
            const _isOnline = await this.getHealth();
            if (_isOnline !== this.isOnline.value) {
                this.isOnline.value = _isOnline;
                logger.info(`Winboat Guest API went ${this.isOnline.value ? 'online' : 'offline'}`);

                if (this.isOnline.value) {
                    // Track when the API comes online
                    this.guestAPIStartTime.value = Date.now();
                    await this.checkVersionAndUpdateGuestServer();
                } else {
                    // Clear start time when offline
                    this.guestAPIStartTime.value = null;
                }
            }
        }, HEALTH_WAIT_MS);

        // Make sure we don't have any existing intervals
        if (this.#metricsInverval) {
            clearInterval(this.#metricsInverval);
            this.#metricsInverval = null;
        }

        this.#metricsInverval = setInterval(async () => {
            if (!this.isOnline.value) return;
            this.metrics.value = await this.getMetrics();
        }, METRICS_WAIT_MS);

        // Make sure we don't have any existing intervals
        if (this.#rdpConnectionStatusInterval) {
            clearInterval(this.#rdpConnectionStatusInterval);
            this.#rdpConnectionStatusInterval = null;
        }

        this.#rdpConnectionStatusInterval = setInterval(async () => {
            // If the guest is offline, don't even bother checking RDP status
            if (!this.isOnline.value) return;

            // If RDP monitoring is disabled, don't check status, just set it to false
            if (!this.#wbConfig?.config.rdpMonitoringEnabled) {
                this.rdpConnected.value = false;
                return;
            }

            // Check RDP status
            const _rdpConnected = await this.getRDPConnectedStatus();
            if (_rdpConnected !== this.rdpConnected.value) {
                this.rdpConnected.value = _rdpConnected;
                logger.info(`RDP connection status changed to ${_rdpConnected ? 'connected' : 'disconnected'}`);
            }
        }, RDP_STATUS_WAIT_MS);
    }

    /**
     * Destroys the intervals which rely on the Winboat Guest API.
     * This is called when the container is in any state other than Running.
     */
    destroyAPIInvervals() {
        logger.info("Destroying Winboat API intervals...");
        if (this.#healthInterval) {
            clearInterval(this.#healthInterval);
            this.#healthInterval = null;
            // Side-effect: Set isOnline to false
            this.isOnline.value = false;
        }

        if (this.#metricsInverval) {
            clearInterval(this.#metricsInverval);
            this.#metricsInverval = null;
        }

        if (this.#rdpConnectionStatusInterval) {
            clearInterval(this.#rdpConnectionStatusInterval);
            this.#rdpConnectionStatusInterval = null;
            // Side-effect: Set rdpConnected to false
            this.rdpConnected.value = false;
        }
    }

    async getHealth() {
        // If /health returns 200, then the guest is ready
        try {
            const res = await nodeFetch(`${WINBOAT_GUEST_API}/health`);
            return res.status === 200;
        } catch(e) {
            return false;
        }
    }

    async getContainerStatus() {
        try {
            const { stdout: _containerStatus } = await execAsync(`docker inspect --format="{{.State.Status}}" WinBoat`);
            return _containerStatus.trim() as ContainerStatusValue;
        } catch(e) {
            console.error("Failed to get container status, most likely we are in the process of resetting");
            return ContainerStatus.Dead;
        }
    }
    
    async getContainerUptime(): Promise<string> {
        try {
            // Get container start time using docker inspect
            const { stdout: startTimeStr } = await execAsync(`docker inspect --format="{{.State.StartedAt}}" WinBoat`);
            const startTime = new Date(startTimeStr.trim()).getTime();
            
            if (isNaN(startTime)) {
                return "";
            }
            
            const uptimeMs = Date.now() - startTime;
            const uptimeSeconds = Math.floor(uptimeMs / 1000);
            
            return this.formatUptime(uptimeSeconds);
        } catch(e) {
            console.error("Failed to get container uptime:", e);
            return "";
        }
    }

    async getMetrics() {
        const res = await nodeFetch(`${WINBOAT_GUEST_API}/metrics`);
        const metrics = await res.json() as Metrics;
        return metrics;
    }

    async getRDPConnectedStatus() {
        const res = await nodeFetch(`${WINBOAT_GUEST_API}/rdp/status`);
        const status = await res.json() as { rdpConnected: boolean };
        return status.rdpConnected;
    }

    parseCompose() {
        const composeFile = fs.readFileSync(path.join(WINBOAT_DIR, 'docker-compose.yml'), 'utf-8');
        const composeContents = YAML.parse(composeFile) as ComposeConfig;
        return composeContents;
    }

    getCredentials() {
        const compose = this.parseCompose();
        return {
            username: compose.services.windows.environment.USERNAME,
            password: compose.services.windows.environment.PASSWORD
        }
    }

    async startContainer() {
        logger.info("Starting WinBoat container...");
        this.containerActionLoading.value = true;
        try {
            const { stdout } = await execAsync("docker container start WinBoat");
            logger.info(`Container response: ${stdout}`);
        } catch(e) {
            logger.error("There was an error performing the container action.");
            logger.error(e);
            throw e;
        }
        logger.info("Successfully started WinBoat container");
        this.containerActionLoading.value = false;
    }

    async stopContainer() {
        logger.info("Stopping WinBoat container...");
        this.containerActionLoading.value = true;
        try {
            const { stdout } = await execAsync("docker container stop WinBoat");
            logger.info(`Container response: ${stdout}`);
        } catch(e) {
            logger.error("There was an error performing the container action.");
            logger.error(e);
            throw e;
        }
        logger.info("Successfully stopped WinBoat container");
        this.containerActionLoading.value = false;
    }

    async pauseContainer() {
        logger.info("Pausing WinBoat container...");
        this.containerActionLoading.value = true;
        try {
            const { stdout } = await execAsync("docker container pause WinBoat");
            logger.info(`Container response: ${stdout}`);
            // TODO: The heartbeat check should set this, but it doesn't because normal fetch timeout doesn't exist
            // Fix it once you change fetch to something else
            this.isOnline.value = false;
        } catch(e) {
            logger.error("There was an error performing the container action.");
            logger.error(e);
            throw e;
        }
        logger.info("Successfully paused WinBoat container");
        this.containerActionLoading.value = false;
    }

    async unpauseContainer() {
        logger.info("Unpausing WinBoat container...");
        this.containerActionLoading.value = true;
        try {
            const { stdout } = await execAsync("docker container unpause WinBoat");
            logger.info(`Container response: ${stdout}`);
        } catch(e) {
            logger.error("There was an error performing the container action.");
            logger.error(e);
            throw e;
        }
        logger.info("Successfully unpaused WinBoat container");
        this.containerActionLoading.value = false;
    }

    async restartGuestOS() {
        logger.info("Restarting Windows guest OS...");
        
        if (!this.isOnline.value) {
            logger.error("Cannot restart: Guest API is offline");
            return;
        }
        
        try {
            // Use the guest API restart endpoint
            const response = await nodeFetch(`${WINBOAT_GUEST_API}/restart`, { 
                method: 'POST',
                timeout: 10000 // 10 second timeout
            });
            
            if (response.ok) {
                logger.info("Windows restart initiated successfully via Guest API");
                
                // Set status to offline immediately since Windows is restarting
                this.isOnline.value = false;
                this.guestAPIStartTime.value = null;
                
                // Wait for Windows and Guest API to come back online
                this.waitForGuestAPIAfterRestart();
            } else {
                throw new Error(`Guest API restart failed: ${response.status}`);
            }
            
        } catch (error) {
            logger.error("Failed to restart Windows guest OS:", error);
            console.error("Error restarting guest OS:", error);
        }
    }

    private async waitForGuestAPIAfterRestart() {
        logger.info("Waiting for Windows and Guest API to come back online after restart...");
        
        const maxAttempts = 60; // Try for up to 5 minutes
        let attempts = 0;
        
        const checkAPI = async (): Promise<boolean> => {
            try {
                const response = await nodeFetch(`${WINBOAT_GUEST_API}/apps`);
                return response.ok;
            } catch {
                return false;
            }
        };
        
        const poll = async () => {
            attempts++;
            const isOnline = await checkAPI();
            
            if (isOnline) {
                logger.info(`Guest API is back online after ${attempts * 5} seconds`);
                this.isOnline.value = true;
                this.guestAPIStartTime.value = Date.now();
                await this.updateContainerStatus();
                return;
            }
            
            if (attempts >= maxAttempts) {
                logger.error("Guest API did not come back online within timeout period");
                return;
            }
            
            // Wait 5 seconds before next attempt
            setTimeout(poll, 5000);
        };
        
        // Start polling after initial 10 second delay (Windows needs time to boot)
        setTimeout(poll, 10000);
    }

    async replaceCompose(composeConfig: ComposeConfig) {
        logger.info("Going to replace compose config");
        this.containerActionLoading.value = true;

        const composeFilePath = path.join(WINBOAT_DIR, 'docker-compose.yml');

        // 0. Stop the current container if it's online
        if (this.containerStatus.value === ContainerStatus.Running) {
            await this.stopContainer();
        }

        // 1. Compose down the current container
        await execAsync(`docker compose -f ${composeFilePath} down`);

        // 2. Create a backup directory if it doesn't exist
        const backupDir = path.join(WINBOAT_DIR, 'backup');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
            logger.info(`Created compose backup dir: ${backupDir}`)
        }

        // 3. Move the current compose file to backup
        const backupFile = `${Date.now()}-docker-compose.yml`;
        fs.renameSync(composeFilePath, path.join(backupDir, backupFile));
        logger.info(`Backed up current compose at: ${path.join(backupDir, backupFile)}`);

        // 4. Write new compose file
        const newComposeYAML = PrettyYAML.stringify(composeConfig).replaceAll("null", "");
        fs.writeFileSync(composeFilePath, newComposeYAML, { encoding: 'utf8' });
        logger.info(`Wrote new compose file to: ${composeFilePath}`);

        // 5. Deploy the container with the new compose file
        await execAsync(`docker compose -f ${composeFilePath} up -d`);
        logger.info("Replace compose config completed, successfully deployed new container");

        this.containerActionLoading.value = false;
    }

    async resetWinboat() {
        console.info("Resetting Winboat...");

        // 1. Stop container
        await this.stopContainer();
        console.info("Stopped container");
        
        // 2. Remove the container
        await execAsync("docker rm WinBoat")
        console.info("Removed container")

        // 3. Remove the container volume
        await execAsync("docker volume rm winboat_data");
        console.info("Removed volume");
        
        // 4. Close logger
        logger.close();

        // 5. Remove WinBoat directory
        fs.rmSync(WINBOAT_DIR,  { recursive: true, force: true });
        console.info(`Removed ${WINBOAT_DIR}`);
        console.info("So long and thanks for all the fish!");
    }

    async launchApp(app: WinApp) {
        if (!this.isOnline) throw new Error('Cannot launch app, Winboat is offline');

        const { username, password } = this.getCredentials();
        logger.info(`Launching app: ${app.Name} at path ${app.Path}`);
        
        const freeRDPBin = await getFreeRDP();

        logger.info(`Using FreeRDP Command: '${freeRDPBin}'`);

        let cmd = `${freeRDPBin} /u:"${username}"\
        /p:"${password}"\
        /v:127.0.0.1\
        /cert:ignore\
        +clipboard\
        -wallpaper\
        /sound:sys:pulse\
        /microphone:sys:pulse\
        /floatbar\
        ${this.#wbConfig?.config.smartcardEnabled ? '/smartcard' : ''}\
        /compression\
        /scale:${this.#wbConfig?.config.scale ?? 100}\
        /wm-class:"${app.Name}"\
        /app:program:"${app.Path}",name:"${app.Name}" &`;

        if (app.Path == InternalApps.WINDOWS_DESKTOP) {
            cmd = `${freeRDPBin} /u:"${username}"\
                /p:"${password}"\
                /v:127.0.0.1\
                /cert:ignore\
                +clipboard\
                +f\
                /sound:sys:pulse\
                /microphone:sys:pulse\
                /floatbar\
                ${this.#wbConfig?.config.smartcardEnabled ? '/smartcard' : ''}\
                /scale:${this.#wbConfig?.config.scale ?? 100}\
                /compression &`;
        }

        // Multiple spaces become one
        cmd = cmd.replace(/\s+/g, " ");
        this.appMgr?.incrementAppUsage(app);
        this.appMgr?.writeToDisk();

        logger.info(`Launch command:\n${cmd}`);

        await execAsync(cmd);
    }

    async checkVersionAndUpdateGuestServer() {
        // 1. Get the version of the guest server and compare it to the current version
        const versionRes = await nodeFetch(`${WINBOAT_GUEST_API}/version`);
        const version = await versionRes.json() as GuestServerVersion;

        const appVersion = import.meta.env.VITE_APP_VERSION;

        if (version.version !== appVersion) {
            logger.info(`New local version of WinBoat Guest Server found: ${appVersion}`);
            logger.info(`Current version of WinBoat Guest Server: ${version.version}`);
        }

        // 2. Return early if the version is the same
        if (version.version === appVersion) {
            return;
        }

        // 3. Set update flag & grab winboat_guest_server.zip from Electron assets
        this.isUpdatingGuestServer.value = true;
        const zipPath = remote.app.isPackaged
            ? path.join(remote.app.getAppPath(), 'guest_server', 'winboat_guest_server.zip')
            : path.join(remote.app.getAppPath(), '..', '..', 'guest_server', 'winboat_guest_server.zip');

        // 4. Send the payload to the guest server, as a multipart/form-data with updateFile
        const formData = new FormData();
        formData.append('updateFile', fs.createReadStream(zipPath));

        try {
            const res = await nodeFetch(`${WINBOAT_GUEST_API}/update`, {
                method: 'POST',
                body: formData as any
            });
            if (res.status !== 200) {
                const resBody = await res.text();
                throw new Error(resBody);
            }
            const resJson = await res.json() as GuestServerUpdateResponse;
            logger.info(`Update params: ${JSON.stringify(resJson, null, 4)}`);
            logger.info("Successfully sent update payload to guest server");
            
        } catch(e) {
            logger.error("Failed to send update payload to guest server");
            logger.error(e);
            this.isUpdatingGuestServer.value = false;
            throw e;
        }

        // 5. Wait about ~3 seconds, then start scanning for health
        await new Promise(resolve => setTimeout(resolve, 3000));
        let _isOnline = await this.getHealth();
        while (!_isOnline) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            _isOnline = await this.getHealth();
        }
        logger.info("Update completed, Winboat Guest Server is online");

        // Done!
        this.isUpdatingGuestServer.value = false;
    }

    getUptime(): string {
        if (!this.isOnline.value) {
            return "Offline";
        }
        
        // Use actual Windows uptime from metrics if available
        const uptimeSeconds = this.metrics.value.uptime || 0;
        
        if (uptimeSeconds === 0) {
            // Fallback to API connection time if uptime not available
            if (!this.guestAPIStartTime.value) {
                return "Offline";
            }
            const uptimeMs = Date.now() - this.guestAPIStartTime.value;
            const seconds = Math.floor(uptimeMs / 1000);
            return this.formatUptime(seconds);
        }
        
        return this.formatUptime(uptimeSeconds);
    }
    
    private formatUptime(uptimeSeconds: number): string {
        if (uptimeSeconds < 60) {
            return `${uptimeSeconds}s`;
        } else if (uptimeSeconds < 3600) {
            const minutes = Math.floor(uptimeSeconds / 60);
            const seconds = uptimeSeconds % 60;
            return `${minutes}m ${seconds}s`;
        } else if (uptimeSeconds < 86400) {
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        } else {
            const days = Math.floor(uptimeSeconds / 86400);
            const hours = Math.floor((uptimeSeconds % 86400) / 3600);
            return `${days}d ${hours}h`;
        }
    }
}