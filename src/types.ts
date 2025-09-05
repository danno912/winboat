import { type WindowsVersionKey } from "./renderer/lib/constants";
import { z } from 'zod';

export type Specs = {
    cpuThreads: number;
    ramGB: number;
    diskSpaceGB: number;
    kvmEnabled: boolean;
    dockerInstalled: boolean;
    dockerComposeInstalled: boolean,
    dockerIsInUserGroups: boolean;
    freeRDPInstalled: boolean;
    ipTablesLoaded: boolean;
    iptableNatLoaded: boolean;
}

export type InstallConfiguration = {
    windowsVersion: WindowsVersionKey;
    windowsLanguage: string;
    cpuThreads: number;
    ramGB: number;
    diskSpaceGB: number;
    username: string;
    password: string;
    customIsoPath?: string;
}

// Branded type for AppGroup IDs to prevent mixing with regular strings
export type AppGroupId = string & { readonly __brand: unique symbol };

// Legacy WinApp type for backward compatibility
export type LegacyWinApp = {
    Name: string;
    Path: string;
    Icon: string;
    Source: string;
    Usage?: number;
}

// Zod schemas for runtime validation
export const WinAppSchema = z.object({
    Name: z.string().min(1),
    Path: z.string().min(1),
    Icon: z.string(),
    Source: z.enum(['internal', 'custom', 'windows']),
    Usage: z.number().min(0).default(0),
    Hidden: z.boolean().default(false),
    GroupId: z.string().nullable().default(null)
});

export const AppGroupSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    icon: z.string().nullable().default(null),
    color: z.string().nullable().default(null),
    collapsed: z.boolean().default(false),
    order: z.number().default(0),
    createdAt: z.date().default(() => new Date()),
    updatedAt: z.date().default(() => new Date())
});

// Type inference from schemas
export type WinApp = z.infer<typeof WinAppSchema>;
export type AppGroup = z.infer<typeof AppGroupSchema>;

// Result type for better error handling
export type Result<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };

// Custom error types
export class AppNotFoundError extends Error {
    constructor(appPath: string) {
        super(`App not found: ${appPath}`);
        this.name = 'AppNotFoundError';
    }
}

export class GroupNotFoundError extends Error {
    constructor(groupId: string) {
        super(`Group not found: ${groupId}`);
        this.name = 'GroupNotFoundError';
    }
}

// Migration utility
export const migrateWinApp = (legacy: LegacyWinApp): WinApp => ({
    ...legacy,
    Source: legacy.Source as WinApp['Source'],
    Usage: legacy.Usage ?? 0,
    Hidden: false,
    GroupId: null
});

// Factory function for creating app groups
export const createAppGroup = (
    data: Pick<AppGroup, 'name'> & Partial<Pick<AppGroup, 'icon' | 'color' | 'collapsed' | 'order'>>
): AppGroup => ({
    id: crypto.randomUUID(),
    name: data.name,
    icon: data.icon ?? null,
    color: data.color ?? null,
    collapsed: data.collapsed ?? false,
    order: data.order ?? 0,
    createdAt: new Date(),
    updatedAt: new Date()
});

// Safe parsing functions
export const parseWinApp = (data: unknown): Result<WinApp, z.ZodError> => {
    const result = WinAppSchema.safeParse(data);
    return result.success 
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
};

export type ComposeConfig = {
    name: string;
    volumes: {
        [key: string]: null | string;
    };
    services: {
        windows: {
            image: string;
            container_name: string;
            environment: {
                VERSION: WindowsVersionKey;
                RAM_SIZE: string;
                CPU_CORES: string;
                DISK_SIZE: string;
                USERNAME: string;
                PASSWORD: string;
                HOME: string;
                LANGUAGE: string;
                ARGUMENTS: string;
                [key: string]: string; // Allow additional env vars
            };
            privileged: boolean;
            ports: string[];
            cap_add: string[];
            stop_grace_period: string;
            restart: string;
            volumes: string[];
            devices: string[];
        };
    };
};

export type Metrics = {
    cpu: {
        usage: number, // Percentage, from 0 to 100%
        frequency: number, // Frequency in Mhz (e.g. 2700)
    },
    ram: {
        used: number, // RAM Usage in MB (e.g. 500)
        total: number // RAM Total in MB (e.g. 4096)
        percentage: number // RAM Usage in percentage (e.g. 70%)
    },
    disk: {
        used: number, // Disk Usage in MB (e.g. 29491)
        total: number, // Disk Total in MB (e.g. 102400)
        percentage: number // Disk Usage in percentage (e.g. 70%)
    }
}

export type GuestServerVersion = {
    version: string;
    commit_hash: string;
    build_time: string;
}

export type GuestServerUpdateResponse = {
    filename: string;
    status: string;
    temp_path: string;
}