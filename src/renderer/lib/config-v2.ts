const fs: typeof import("fs") = require("fs");
const path: typeof import("path") = require("path");
import { type WinApp, type LegacyWinApp, type AppGroup, migrateWinApp } from "../../types";
import { WINBOAT_DIR } from "./constants";
import { z } from 'zod';

// Legacy config for backward compatibility
export type LegacyWinboatConfigObj = {
    scale: number;
    smartcardEnabled: boolean;
    rdpMonitoringEnabled: boolean;
    customApps: LegacyWinApp[];
};

// New config structure with versioning
export type WinboatConfigObj = {
    version: number;
    scale: number;
    smartcardEnabled: boolean;
    rdpMonitoringEnabled: boolean;
    customApps: WinApp[];
    // App management features
    hiddenApps: Set<string>;  // Use Set for O(1) lookups
    appGroups: AppGroup[];
    appGroupMappings: Map<string, string>;  // appPath -> groupId
    groupOrder: string[];
};

// Zod schema for runtime validation
export const WinboatConfigSchema = z.object({
    version: z.number().default(2),
    scale: z.number().default(100),
    smartcardEnabled: z.boolean().default(false),
    rdpMonitoringEnabled: z.boolean().default(false),
    customApps: z.array(z.any()).default([]),  // Will be validated separately
    hiddenApps: z.array(z.string()).default([]).transform(arr => new Set(arr)),
    appGroups: z.array(z.any()).default([]),  // Will be validated separately
    appGroupMappings: z.record(z.string()).default({}).transform(obj => new Map(Object.entries(obj))),
    groupOrder: z.array(z.string()).default([])
});

const defaultConfig: WinboatConfigObj = {
    version: 2,
    scale: 100,
    smartcardEnabled: false,
    rdpMonitoringEnabled: false,
    customApps: [],
    hiddenApps: new Set(),
    appGroups: [],
    appGroupMappings: new Map(),
    groupOrder: []
};

let instance: WinboatConfigV2 | null = null;

export class WinboatConfigV2 {
    #configPath: string = path.join(WINBOAT_DIR, "winboat.config.json");
    #configData: WinboatConfigObj = { ...defaultConfig };
    #writeTimeout: NodeJS.Timeout | null = null;

    constructor() {
        if (instance) return instance;
        this.#configData = this.readConfig();
        console.log("Reading current config", this.#configData);
        instance = this;
    }

    get config(): WinboatConfigObj {
        // Return a proxy to intercept property sets
        return new Proxy(this.#configData, {
            get: (target, key) => target[key as keyof WinboatConfigObj],
            set: (target, key, value) => {
                // @ts-expect-error This is valid
                target[key as keyof WinboatConfigObj] = value;
                this.writeConfig();
                console.info("Scheduled config write to disk");
                return true;
            },
        });
    }

    set config(newConfig: WinboatConfigObj) {
        this.#configData = this.deepCloneConfig(newConfig);
        this.writeConfig();
        console.info("Scheduled config write to disk");
    }

    private writeConfigAtomic(): void {
        const tempPath = `${this.#configPath}.tmp`;
        const backupPath = `${this.#configPath}.backup`;
        
        try {
            // Create backup of current config
            if (fs.existsSync(this.#configPath)) {
                fs.copyFileSync(this.#configPath, backupPath);
            }
            
            // Convert Sets and Maps to serializable format
            const serializableConfig = {
                ...this.#configData,
                hiddenApps: Array.from(this.#configData.hiddenApps),
                appGroupMappings: Object.fromEntries(this.#configData.appGroupMappings)
            };
            
            // Write to temp file first
            fs.writeFileSync(tempPath, JSON.stringify(serializableConfig, null, 4), "utf-8");
            
            // Atomic move
            fs.renameSync(tempPath, this.#configPath);
            
            // Clean up backup after successful write
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
            }
        } catch (error) {
            // Restore from backup on failure
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, this.#configPath);
            }
            console.error('Failed to write config:', error);
            throw error;
        }
    }
    
    // Debounced write to prevent excessive I/O
    writeConfig(): void {
        if (this.#writeTimeout) {
            clearTimeout(this.#writeTimeout);
        }
        
        this.#writeTimeout = setTimeout(() => {
            this.writeConfigAtomic();
        }, 500);
    }

    readConfig(): WinboatConfigObj {
        if (!fs.existsSync(this.#configPath)) {
            console.log('Config file not found, creating default');
            this.writeConfigAtomic();
            return this.deepCloneConfig(defaultConfig);
        }

        try {
            const rawConfig = fs.readFileSync(this.#configPath, "utf-8");
            const configObj = JSON.parse(rawConfig);
            console.log("Successfully read the config file");

            // Handle migration from legacy config
            if (!configObj.version || configObj.version === 1) {
                console.log('Migrating legacy config to v2');
                return this.migrateFromLegacy(configObj as LegacyWinboatConfigObj);
            }

            // Parse and validate with Zod
            const parseResult = WinboatConfigSchema.safeParse(configObj);
            if (!parseResult.success) {
                console.error('Config validation failed:', parseResult.error);
                console.log('Using default config');
                return this.deepCloneConfig(defaultConfig);
            }

            const validatedConfig = parseResult.data;
            
            // Migrate customApps to new format if needed
            validatedConfig.customApps = validatedConfig.customApps.map((app: any) => {
                if (!app.Hidden && !app.GroupId) {
                    return migrateWinApp(app as LegacyWinApp);
                }
                return app as WinApp;
            });

            return validatedConfig;
        } catch (e) {
            console.error("Config parsing failed, using default:", e);
            return this.deepCloneConfig(defaultConfig);
        }
    }
    
    private migrateFromLegacy(legacyConfig: LegacyWinboatConfigObj): WinboatConfigObj {
        const migratedConfig: WinboatConfigObj = {
            version: 2,
            scale: legacyConfig.scale,
            smartcardEnabled: legacyConfig.smartcardEnabled,
            rdpMonitoringEnabled: legacyConfig.rdpMonitoringEnabled,
            customApps: legacyConfig.customApps.map(migrateWinApp),
            hiddenApps: new Set(),
            appGroups: [],
            appGroupMappings: new Map(),
            groupOrder: []
        };
        
        // Write migrated config
        this.#configData = migratedConfig;
        this.writeConfigAtomic();
        console.log('Successfully migrated config to v2');
        
        return migratedConfig;
    }
    
    private deepCloneConfig(config: WinboatConfigObj): WinboatConfigObj {
        return {
            ...config,
            customApps: [...config.customApps],
            hiddenApps: new Set(config.hiddenApps),
            appGroups: [...config.appGroups],
            appGroupMappings: new Map(config.appGroupMappings),
            groupOrder: [...config.groupOrder]
        };
    }

    // Enhanced methods for better type safety
    get<K extends keyof WinboatConfigObj>(key: K): WinboatConfigObj[K] {
        return this.#configData[key];
    }

    set<K extends keyof WinboatConfigObj>(key: K, value: WinboatConfigObj[K]): void {
        this.#configData[key] = value;
        this.writeConfig();
    }

    // Batch update with validation
    update(updates: Partial<WinboatConfigObj>): { success: boolean; error?: string } {
        try {
            const newConfig = { ...this.#configData, ...updates };
            // Could add validation here if needed
            this.#configData = newConfig;
            this.writeConfig();
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    // App group specific methods
    addAppGroup(group: AppGroup): void {
        this.#configData.appGroups.push(group);
        this.#configData.groupOrder.push(group.id);
        this.writeConfig();
    }

    removeAppGroup(groupId: string): boolean {
        const index = this.#configData.appGroups.findIndex(g => g.id === groupId);
        if (index === -1) return false;

        this.#configData.appGroups.splice(index, 1);
        
        const orderIndex = this.#configData.groupOrder.indexOf(groupId);
        if (orderIndex !== -1) {
            this.#configData.groupOrder.splice(orderIndex, 1);
        }

        // Remove group mappings
        for (const [appPath, mappedGroupId] of this.#configData.appGroupMappings.entries()) {
            if (mappedGroupId === groupId) {
                this.#configData.appGroupMappings.delete(appPath);
            }
        }

        this.writeConfig();
        return true;
    }

    assignAppToGroup(appPath: string, groupId: string | null): void {
        if (groupId === null) {
            this.#configData.appGroupMappings.delete(appPath);
        } else {
            this.#configData.appGroupMappings.set(appPath, groupId);
        }
        this.writeConfig();
    }

    toggleAppVisibility(appPath: string): boolean {
        const isHidden = this.#configData.hiddenApps.has(appPath);
        if (isHidden) {
            this.#configData.hiddenApps.delete(appPath);
        } else {
            this.#configData.hiddenApps.add(appPath);
        }
        this.writeConfig();
        return !isHidden; // Return new hidden state
    }
}