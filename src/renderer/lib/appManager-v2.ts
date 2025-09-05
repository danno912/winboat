import { WINBOAT_DIR, WINBOAT_GUEST_API } from "./constants";
import type { WinApp, AppGroup, Result, AppNotFoundError, GroupNotFoundError } from "../../types";
import { migrateWinApp, parseWinApp, AppNotFoundError as AppError, GroupNotFoundError as GroupError } from "../../types";
import { createLogger } from "../utils/log";
import { AppIcons } from "../data/appicons";
import { InternalApps } from "../data/internalapps";
import { WinboatConfigV2 } from "./config-v2";

const nodeFetch: typeof import('node-fetch').default = require('node-fetch');
const path: typeof import('path') = require('path');
const fs: typeof import('fs') = require('fs');
const FormData: typeof import('form-data') = require('form-data');

const logger = createLogger(path.join(WINBOAT_DIR, 'appManager.log'));
const USAGE_PATH = path.join(WINBOAT_DIR, 'appUsage.json');

// LRU Cache implementation for better memory management
class LRUCache<K, V> extends Map<K, V> {
    constructor(private maxSize: number = 200) {
        super();
    }
    
    set(key: K, value: V): this {
        if (this.size >= this.maxSize && !this.has(key)) {
            const firstKey = this.keys().next().value;
            this.delete(firstKey);
        }
        
        // Move to end (most recently used)
        if (this.has(key)) {
            this.delete(key);
        }
        
        super.set(key, value);
        return this;
    }
    
    get(key: K): V | undefined {
        const value = super.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.delete(key);
            this.set(key, value);
        }
        return value;
    }
}

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
];

export interface IAppManager {
    // App management
    getApps(): Promise<Result<WinApp[], never>>;
    updateAppCache(options?: { forceRead: boolean }): Promise<Result<void, Error>>;
    addCustomApp(name: string, path: string, icon: string): Promise<Result<WinApp, Error>>;
    removeCustomApp(app: WinApp): Promise<Result<void, Error>>;
    
    // Visibility management
    toggleAppVisibility(appPath: string): Promise<Result<WinApp, AppNotFoundError>>;
    bulkHideApps(appPaths: readonly string[]): Promise<Result<WinApp[], AppNotFoundError>>;
    getVisibleApps(): Promise<Result<WinApp[], never>>;
    getHiddenApps(): Promise<Result<WinApp[], never>>;

    // Group management
    createGroup(group: Omit<AppGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<AppGroup, never>>;
    updateGroup(id: string, update: Partial<Omit<AppGroup, 'id' | 'createdAt'>>): Promise<Result<AppGroup, GroupNotFoundError>>;
    deleteGroup(id: string): Promise<Result<void, GroupNotFoundError>>;
    
    // App-Group relationships
    assignAppToGroup(appPath: string, groupId: string | null): Promise<Result<WinApp, AppNotFoundError | GroupNotFoundError>>;
    getAppsInGroup(groupId: string): Promise<Result<WinApp[], GroupNotFoundError>>;
    getUngroupedApps(): Promise<Result<WinApp[], never>>;
    
    // Utility
    cleanup(): void;
}

export class AppManagerV2 implements IAppManager {
    private appCache = new LRUCache<string, WinApp>(500);
    private appUsageCache: { [key: string]: number } = {};
    private appLookupMap = new Map<string, WinApp>();
    private groupLookupMap = new Map<string, Set<string>>();
    private #wbConfig: WinboatConfigV2;
    
    constructor() {
        if (!fs.existsSync(USAGE_PATH)) {
            fs.writeFileSync(USAGE_PATH, "{}");
        }

        this.#wbConfig = new WinboatConfigV2();
        this.loadUsageFromDisk();
    }

    private loadUsageFromDisk(): void {
        try {
            const fsUsage = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf-8'));
            this.appUsageCache = fsUsage;
            logger.info(`Loaded ${Object.keys(fsUsage).length} app usage records`);
        } catch (error) {
            logger.error('Failed to load app usage from disk:', error);
            this.appUsageCache = {};
        }
    }

    private saveUsageToDisk(): void {
        try {
            fs.writeFileSync(USAGE_PATH, JSON.stringify(this.appUsageCache, null, 2));
        } catch (error) {
            logger.error('Failed to save app usage to disk:', error);
        }
    }

    private rebuildLookupMaps(): void {
        this.appLookupMap.clear();
        this.groupLookupMap.clear();

        // Build app lookup map
        Array.from(this.appCache.values()).forEach(app => {
            this.appLookupMap.set(app.Path, app);
            
            // Build group lookup map
            if (app.GroupId) {
                if (!this.groupLookupMap.has(app.GroupId)) {
                    this.groupLookupMap.set(app.GroupId, new Set());
                }
                this.groupLookupMap.get(app.GroupId)!.add(app.Path);
            }
        });
    }

    // Optimized app cache update - O(n) instead of O(n²)
    async updateAppCache(options: { forceRead: boolean } = { forceRead: false }): Promise<Result<void, Error>> {
        try {
            const res = await nodeFetch(`${WINBOAT_GUEST_API}/apps`);
            const newApps = await res.json() as any[];
            
            // Parse and validate each app
            const validatedApps: WinApp[] = [];
            for (const appData of newApps) {
                const parseResult = parseWinApp(appData);
                if (parseResult.success) {
                    validatedApps.push(parseResult.data);
                } else {
                    // Try to migrate legacy format
                    const migratedApp = migrateWinApp(appData);
                    validatedApps.push(migratedApp);
                }
            }
            
            // Add preset apps
            validatedApps.push(...presetApps);
            
            // Add custom apps
            validatedApps.push(...this.#wbConfig.config.customApps);

            if (this.appCache.size === validatedApps.length && !options.forceRead) {
                return { success: true, data: undefined };
            }

            // Build lookup map for existing apps for O(1) access
            const existingAppsMap = new Map<string, WinApp>();
            Array.from(this.appCache.values()).forEach(app => {
                existingAppsMap.set(app.Name, app);
            });

            // O(n) merge instead of O(n²)
            for (const app of validatedApps) {
                const existing = existingAppsMap.get(app.Name);
                app.Usage = existing?.Usage ?? this.appUsageCache[app.Name] ?? 0;
                
                // Apply hidden state from config
                app.Hidden = this.#wbConfig.config.hiddenApps.has(app.Path);
                
                // Apply group mapping from config
                app.GroupId = this.#wbConfig.config.appGroupMappings.get(app.Path) ?? null;
                
                this.appUsageCache[app.Name] = app.Usage;
                this.appCache.set(app.Path, app);
            }

            this.rebuildLookupMaps();
            
            logger.info(`Updated app cache with ${validatedApps.length} apps`);
            return { success: true, data: undefined };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to update app cache:', errorMsg);
            return { success: false, error: error as Error };
        }
    }

    async getApps(): Promise<Result<WinApp[], never>> {
        if (this.appCache.size > 0) {
            return { success: true, data: Array.from(this.appCache.values()) };
        }

        // Initialize cache from disk usage data
        const fsUsageEntries = Object.entries(this.appUsageCache);
        
        for (const [appName, usage] of fsUsageEntries) {
            // Create dummy app entries that will be populated by updateAppCache
            const dummyApp: WinApp = {
                ...presetApps[0],
                Name: appName,
                Usage: usage
            };
            this.appCache.set(dummyApp.Path, dummyApp);
        }

        await this.updateAppCache({ forceRead: true });
        return { success: true, data: Array.from(this.appCache.values()) };
    }

    async getVisibleApps(): Promise<Result<WinApp[], never>> {
        const appsResult = await this.getApps();
        if (!appsResult.success) return appsResult;
        
        const visibleApps = appsResult.data.filter(app => !app.Hidden);
        return { success: true, data: visibleApps };
    }

    async getHiddenApps(): Promise<Result<WinApp[], never>> {
        const appsResult = await this.getApps();
        if (!appsResult.success) return appsResult;
        
        const hiddenApps = appsResult.data.filter(app => app.Hidden);
        return { success: true, data: hiddenApps };
    }

    async toggleAppVisibility(appPath: string): Promise<Result<WinApp, AppNotFoundError>> {
        try {
            const app = this.appLookupMap.get(appPath);
            if (!app) {
                return { success: false, error: new AppError(appPath) };
            }

            const newHiddenState = this.#wbConfig.toggleAppVisibility(appPath);
            app.Hidden = newHiddenState;
            
            logger.info(`Toggled visibility for ${app.Name}: ${newHiddenState ? 'hidden' : 'visible'}`);
            return { success: true, data: app };
        } catch (error) {
            logger.error(`Failed to toggle app visibility: ${error}`);
            return { success: false, error: new AppError(appPath) };
        }
    }

    async bulkHideApps(appPaths: readonly string[]): Promise<Result<WinApp[], AppNotFoundError>> {
        const results: WinApp[] = [];
        const errors: string[] = [];

        for (const appPath of appPaths) {
            const result = await this.toggleAppVisibility(appPath);
            if (result.success) {
                results.push(result.data);
            } else {
                errors.push(appPath);
            }
        }

        if (errors.length > 0) {
            logger.warn(`Failed to hide ${errors.length} apps: ${errors.join(', ')}`);
            return { success: false, error: new AppError(errors[0]) };
        }

        return { success: true, data: results };
    }

    async addCustomApp(name: string, path: string, icon: string): Promise<Result<WinApp, Error>> {
        try {
            const newApp: WinApp = {
                Name: name,
                Path: path,
                Icon: icon,
                Source: "custom",
                Usage: 0,
                Hidden: false,
                GroupId: null
            };

            // Add to config
            this.#wbConfig.config.customApps.push(newApp);
            
            // Add to cache
            this.appCache.set(newApp.Path, newApp);
            this.appLookupMap.set(newApp.Path, newApp);
            
            logger.info(`Added custom app: ${name}`);
            return { success: true, data: newApp };
        } catch (error) {
            logger.error(`Failed to add custom app: ${error}`);
            return { success: false, error: error as Error };
        }
    }

    async removeCustomApp(app: WinApp): Promise<Result<void, Error>> {
        try {
            // Remove from config
            const customApps = this.#wbConfig.config.customApps;
            const index = customApps.findIndex(customApp => customApp.Path === app.Path);
            if (index !== -1) {
                customApps.splice(index, 1);
            }

            // Remove from cache
            this.appCache.delete(app.Path);
            this.appLookupMap.delete(app.Path);

            logger.info(`Removed custom app: ${app.Name}`);
            return { success: true, data: undefined };
        } catch (error) {
            logger.error(`Failed to remove custom app: ${error}`);
            return { success: false, error: error as Error };
        }
    }

    async createGroup(groupData: Omit<AppGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<AppGroup, never>> {
        const newGroup: AppGroup = {
            id: crypto.randomUUID(),
            ...groupData,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.#wbConfig.addAppGroup(newGroup);
        logger.info(`Created group: ${newGroup.name} (${newGroup.id})`);
        
        return { success: true, data: newGroup };
    }

    async updateGroup(id: string, update: Partial<Omit<AppGroup, 'id' | 'createdAt'>>): Promise<Result<AppGroup, GroupNotFoundError>> {
        const groups = this.#wbConfig.config.appGroups;
        const index = groups.findIndex(group => group.id === id);
        
        if (index === -1) {
            return { success: false, error: new GroupError(id) };
        }

        groups[index] = {
            ...groups[index],
            ...update,
            updatedAt: new Date()
        };

        logger.info(`Updated group: ${id}`);
        return { success: true, data: groups[index] };
    }

    async deleteGroup(id: string): Promise<Result<void, GroupNotFoundError>> {
        const success = this.#wbConfig.removeAppGroup(id);
        
        if (!success) {
            return { success: false, error: new GroupError(id) };
        }

        // Update apps that were in this group
        for (const [appPath, groupId] of this.#wbConfig.config.appGroupMappings.entries()) {
            if (groupId === id) {
                const app = this.appLookupMap.get(appPath);
                if (app) {
                    app.GroupId = null;
                }
            }
        }

        logger.info(`Deleted group: ${id}`);
        return { success: true, data: undefined };
    }

    async assignAppToGroup(appPath: string, groupId: string | null): Promise<Result<WinApp, AppNotFoundError | GroupNotFoundError>> {
        const app = this.appLookupMap.get(appPath);
        if (!app) {
            return { success: false, error: new AppError(appPath) };
        }

        if (groupId && !this.#wbConfig.config.appGroups.find(g => g.id === groupId)) {
            return { success: false, error: new GroupError(groupId) };
        }

        this.#wbConfig.assignAppToGroup(appPath, groupId);
        app.GroupId = groupId;
        
        logger.info(`Assigned ${app.Name} to group: ${groupId || 'none'}`);
        return { success: true, data: app };
    }

    async getAppsInGroup(groupId: string): Promise<Result<WinApp[], GroupNotFoundError>> {
        if (!this.#wbConfig.config.appGroups.find(g => g.id === groupId)) {
            return { success: false, error: new GroupError(groupId) };
        }

        const appPaths = this.groupLookupMap.get(groupId);
        if (!appPaths) {
            return { success: true, data: [] };
        }

        const apps = Array.from(appPaths)
            .map(path => this.appLookupMap.get(path))
            .filter(app => app !== undefined) as WinApp[];

        return { success: true, data: apps };
    }

    async getUngroupedApps(): Promise<Result<WinApp[], never>> {
        const appsResult = await this.getApps();
        if (!appsResult.success) return appsResult;
        
        const ungroupedApps = appsResult.data.filter(app => !app.GroupId);
        return { success: true, data: ungroupedApps };
    }

    incrementAppUsage(appName: string): void {
        this.appUsageCache[appName] = (this.appUsageCache[appName] || 0) + 1;
        
        // Update app in cache
        const app = Array.from(this.appCache.values()).find(a => a.Name === appName);
        if (app) {
            app.Usage = this.appUsageCache[appName];
        }
        
        // Save to disk (debounced)
        this.saveUsageToDisk();
    }

    cleanup(): void {
        this.appCache.clear();
        this.appLookupMap.clear();
        this.groupLookupMap.clear();
        logger.info('AppManager cleanup completed');
    }
}