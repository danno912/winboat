const fs: typeof import("fs") = require("fs");
const path: typeof import("path") = require("path");
import { type WinApp } from "../../types";
import { WINBOAT_DIR } from "./constants";

export type WinboatConfigObj = {
    scale: number;
    smartcardEnabled: boolean
    rdpMonitoringEnabled: boolean
    sessionManagementEnabled: boolean
    customApps: WinApp[]
    hiddenApps: string[] // Array of app paths that are hidden
    appGroups: { id: string; name: string; icon?: string; color?: string; collapsed?: boolean; order?: number; createdAt: string; updatedAt: string }[]
    appGroupMappings: { [appPath: string]: string } // Maps app path to group id
};

const defaultConfig: WinboatConfigObj = {
    scale: 100,
    smartcardEnabled: false,
    rdpMonitoringEnabled: false,
    sessionManagementEnabled: true,
    customApps: [],
    hiddenApps: [],
    appGroups: [],
    appGroupMappings: {}
};

let instance: WinboatConfig | null = null;

export class WinboatConfig {
    #configPath: string = path.join(WINBOAT_DIR, "winboat.config.json");
    #configData: WinboatConfigObj = { ...defaultConfig };

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
                console.info("Wrote modified config to disk");
                return true;
            },
        });
    }

    set config(newConfig: WinboatConfigObj) {
        this.#configData = { ...newConfig };
        this.writeConfig();
        console.info("Wrote modified config to disk");
    }

    writeConfig(): void {
        fs.writeFileSync(this.#configPath, JSON.stringify(this.#configData, null, 4), "utf-8");
    }

    readConfig(): WinboatConfigObj {
        if (!fs.existsSync(this.#configPath)) {
            fs.writeFileSync(this.#configPath, JSON.stringify(defaultConfig, null, 4), "utf-8");
            return { ...defaultConfig };
        }

        try {
            const rawConfig = fs.readFileSync(this.#configPath, "utf-8");
            const configObj = JSON.parse(rawConfig) as WinboatConfigObj;
            console.log("Successfully read the config file");

            // Some fields might be missing after an update, so we merge them with the default config
            for (const key in defaultConfig) {
                let hasMissing = false;
                if (!(key in configObj)) {
                    // @ts-expect-error This is valid
                    configObj[key] = defaultConfig[key];
                    hasMissing = true;
                    console.log(`Added missing config key: ${key} with default value: ${defaultConfig[key as keyof WinboatConfigObj]}`);
                }

                // If we have any missing keys, we should just write the config back to disk so those new keys are saved
                // We cannot use this.writeConfig() here since #configData is not populated yet
                if (hasMissing) {
                    fs.writeFileSync(this.#configPath, JSON.stringify(configObj, null, 4), "utf-8");
                    console.log("Wrote updated config with missing keys to disk");
                }
            }

            return { ...configObj };
        } catch (e) {
            console.error("Config’s borked, outputting the default:", e);
            return { ...defaultConfig };
        }
    }

    // App visibility management
    isAppHidden(appPath: string): boolean {
        return this.#configData.hiddenApps.includes(appPath);
    }

    toggleAppVisibility(appPath: string): boolean {
        const isCurrentlyHidden = this.isAppHidden(appPath);
        if (isCurrentlyHidden) {
            // Show the app
            this.#configData.hiddenApps = this.#configData.hiddenApps.filter(path => path !== appPath);
        } else {
            // Hide the app
            this.#configData.hiddenApps.push(appPath);
        }
        this.writeConfig();
        return !isCurrentlyHidden; // Return new hidden state
    }

    hideApp(appPath: string): void {
        if (!this.isAppHidden(appPath)) {
            this.#configData.hiddenApps.push(appPath);
            this.writeConfig();
        }
    }

    showApp(appPath: string): void {
        this.#configData.hiddenApps = this.#configData.hiddenApps.filter(path => path !== appPath);
        this.writeConfig();
    }

    // App groups management
    createAppGroup(name: string, options: { icon?: string; color?: string } = {}): { id: string; name: string; icon?: string; color?: string; collapsed?: boolean; order?: number; createdAt: string; updatedAt: string } {
        const crypto = require('crypto');
        const newGroup = {
            id: crypto.randomUUID(),
            name,
            icon: options.icon,
            color: options.color,
            collapsed: false,
            order: this.#configData.appGroups.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.#configData.appGroups.push(newGroup);
        this.writeConfig();
        return newGroup;
    }

    deleteAppGroup(groupId: string): boolean {
        const initialLength = this.#configData.appGroups.length;
        this.#configData.appGroups = this.#configData.appGroups.filter(group => group.id !== groupId);
        
        // Remove all app mappings for this group
        for (const appPath in this.#configData.appGroupMappings) {
            if (this.#configData.appGroupMappings[appPath] === groupId) {
                delete this.#configData.appGroupMappings[appPath];
            }
        }
        
        this.writeConfig();
        return this.#configData.appGroups.length < initialLength;
    }

    assignAppToGroup(appPath: string, groupId: string | null): void {
        if (groupId === null) {
            delete this.#configData.appGroupMappings[appPath];
        } else {
            this.#configData.appGroupMappings[appPath] = groupId;
        }
        this.writeConfig();
    }

    getAppGroup(groupId: string) {
        return this.#configData.appGroups.find(group => group.id === groupId);
    }

    getAppGroups() {
        return [...this.#configData.appGroups].sort((a, b) => a.order - b.order);
    }
}