import { computed, ref, readonly } from 'vue'
import { useMemoize, computedWithControl } from '@vueuse/core'
import { useAppStore } from '../stores/appStore'
import { useGroupStore } from '../stores/groupStore'
import { useUIStore } from '../stores/uiStore'
import type { WinApp, AppGroup, Result } from '../../types'
import { AppManagerV2 } from '../lib/appManager-v2'
import { createLogger } from '../utils/log'
import { WINBOAT_DIR } from '../lib/constants'

const path: typeof import('path') = require('path')
const logger = createLogger(path.join(WINBOAT_DIR, 'useAppManagement.log'))

// Singleton app manager instance
let appManager: AppManagerV2 | null = null

export const useAppManagement = () => {
    const appStore = useAppStore()
    const groupStore = useGroupStore()
    const uiStore = useUIStore()
    
    // Initialize app manager if not already done
    if (!appManager) {
        appManager = new AppManagerV2()
    }
    
    // Memoized computed properties for better performance
    const filteredApps = useMemoize(() => {
        let apps = appStore.apps
        
        // Apply visibility filter
        if (!uiStore.showHidden) {
            apps = apps.filter(app => !app.Hidden)
        }
        
        // Apply search filter using debounced search
        if (uiStore.debouncedSearch) {
            const searchTerm = uiStore.debouncedSearch.toLowerCase()
            apps = apps.filter(app => 
                app.Name.toLowerCase().includes(searchTerm) ||
                app.Path.toLowerCase().includes(searchTerm)
            )
        }
        
        return apps
    }, [appStore.apps, uiStore.showHidden, uiStore.debouncedSearch])
    
    const sortedApps = useMemoize(() => {
        const apps = [...filteredApps.value]
        
        return apps.sort((a, b) => {
            if (uiStore.sortBy === 'usage') {
                const usageDiff = (b.Usage || 0) - (a.Usage || 0)
                if (usageDiff !== 0) return usageDiff
            }
            return a.Name.localeCompare(b.Name)
        })
    }, [filteredApps, uiStore.sortBy])
    
    const groupedApps = useMemoize(() => {
        const groups = new Map<string | null, WinApp[]>()
        
        sortedApps.value.forEach(app => {
            const groupId = app.GroupId
            if (!groups.has(groupId)) {
                groups.set(groupId, [])
            }
            groups.get(groupId)!.push(app)
        })
        
        return groups
    }, [sortedApps])
    
    const visibleGroupedApps = computed(() => {
        const visibleGroups = new Map<string | null, WinApp[]>()
        
        // Add ungrouped apps (always visible)
        const ungroupedApps = groupedApps.value.get(null)
        if (ungroupedApps && ungroupedApps.length > 0) {
            visibleGroups.set(null, ungroupedApps)
        }
        
        // Add expanded groups
        groupStore.orderedGroups.forEach(group => {
            if (groupStore.isGroupExpanded(group.id)) {
                const groupApps = groupedApps.value.get(group.id)
                if (groupApps && groupApps.length > 0) {
                    visibleGroups.set(group.id, groupApps)
                }
            }
        })
        
        return visibleGroups
    })
    
    // Actions
    const refreshApps = async (): Promise<void> => {
        appStore.setLoading(true)
        try {
            const result = await appManager!.getApps()
            if (result.success) {
                appStore.setApps(result.data)
            } else {
                appStore.setError('Failed to load apps')
                logger.error('Failed to refresh apps')
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            appStore.setError(errorMsg)
            logger.error('Error refreshing apps:', error)
        } finally {
            appStore.setLoading(false)
        }
    }
    
    const updateAppCache = async (forceRead = false): Promise<boolean> => {
        try {
            const result = await appManager!.updateAppCache({ forceRead })
            if (result.success) {
                await refreshApps()
                return true
            } else {
                logger.error('Failed to update app cache:', result.error)
                return false
            }
        } catch (error) {
            logger.error('Error updating app cache:', error)
            return false
        }
    }
    
    const toggleAppVisibility = async (appPath: string): Promise<boolean> => {
        try {
            const result = await appManager!.toggleAppVisibility(appPath)
            if (result.success) {
                appStore.updateApp(appPath, { Hidden: result.data.Hidden })
                logger.info(`Toggled visibility for app: ${appPath}`)
                return true
            } else {
                appStore.setError(`Failed to toggle visibility: ${result.error.message}`)
                return false
            }
        } catch (error) {
            logger.error('Error toggling app visibility:', error)
            appStore.setError('Failed to toggle app visibility')
            return false
        }
    }
    
    const bulkToggleVisibility = async (appPaths: string[], hide: boolean): Promise<number> => {
        let successCount = 0
        
        for (const appPath of appPaths) {
            const app = appStore.findApp(appPath)
            if (app && app.Hidden !== hide) {
                const success = await toggleAppVisibility(appPath)
                if (success) successCount++
            }
        }
        
        logger.info(`Bulk visibility toggle: ${successCount}/${appPaths.length} apps processed`)
        return successCount
    }
    
    const addCustomApp = async (name: string, path: string, icon: string): Promise<boolean> => {
        try {
            const result = await appManager!.addCustomApp(name, path, icon)
            if (result.success) {
                appStore.addApp(result.data)
                logger.info(`Added custom app: ${name}`)
                return true
            } else {
                appStore.setError(`Failed to add custom app: ${result.error.message}`)
                return false
            }
        } catch (error) {
            logger.error('Error adding custom app:', error)
            appStore.setError('Failed to add custom app')
            return false
        }
    }
    
    const removeCustomApp = async (app: WinApp): Promise<boolean> => {
        try {
            const result = await appManager!.removeCustomApp(app)
            if (result.success) {
                appStore.removeApp(app.Path)
                logger.info(`Removed custom app: ${app.Name}`)
                return true
            } else {
                appStore.setError(`Failed to remove custom app: ${result.error.message}`)
                return false
            }
        } catch (error) {
            logger.error('Error removing custom app:', error)
            appStore.setError('Failed to remove custom app')
            return false
        }
    }
    
    const createGroup = async (groupData: Omit<AppGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<AppGroup | null> => {
        try {
            const result = await appManager!.createGroup(groupData)
            if (result.success) {
                groupStore.addGroup(groupData)
                logger.info(`Created group: ${result.data.name}`)
                return result.data
            } else {
                appStore.setError('Failed to create group')
                return null
            }
        } catch (error) {
            logger.error('Error creating group:', error)
            appStore.setError('Failed to create group')
            return null
        }
    }
    
    const assignAppToGroup = async (appPath: string, groupId: string | null): Promise<boolean> => {
        try {
            const result = await appManager!.assignAppToGroup(appPath, groupId)
            if (result.success) {
                appStore.updateApp(appPath, { GroupId: groupId })
                logger.info(`Assigned app ${appPath} to group ${groupId || 'none'}`)
                return true
            } else {
                appStore.setError(`Failed to assign app to group: ${result.error.message}`)
                return false
            }
        } catch (error) {
            logger.error('Error assigning app to group:', error)
            appStore.setError('Failed to assign app to group')
            return false
        }
    }
    
    const bulkAssignToGroup = async (appPaths: string[], groupId: string | null): Promise<number> => {
        let successCount = 0
        
        for (const appPath of appPaths) {
            const success = await assignAppToGroup(appPath, groupId)
            if (success) successCount++
        }
        
        logger.info(`Bulk group assignment: ${successCount}/${appPaths.length} apps processed`)
        return successCount
    }
    
    const deleteGroup = async (groupId: string): Promise<boolean> => {
        try {
            const result = await appManager!.deleteGroup(groupId)
            if (result.success) {
                groupStore.removeGroup(groupId)
                
                // Update apps that were in this group
                appStore.apps.forEach(app => {
                    if (app.GroupId === groupId) {
                        appStore.updateApp(app.Path, { GroupId: null })
                    }
                })
                
                logger.info(`Deleted group: ${groupId}`)
                return true
            } else {
                appStore.setError(`Failed to delete group: ${result.error.message}`)
                return false
            }
        } catch (error) {
            logger.error('Error deleting group:', error)
            appStore.setError('Failed to delete group')
            return false
        }
    }
    
    // Stats and utility functions
    const getStats = computed(() => ({
        totalApps: appStore.getAppCount(),
        visibleApps: appStore.getVisibleAppCount(),
        hiddenApps: appStore.getHiddenAppCount(),
        totalGroups: groupStore.getGroupCount(),
        selectedApps: uiStore.selectedCount
    }))
    
    const cleanup = (): void => {
        appManager?.cleanup()
        logger.info('App management cleanup completed')
    }
    
    return {
        // State (readonly)
        apps: appStore.apps,
        loading: appStore.loading,
        error: appStore.error,
        groups: groupStore.orderedGroups,
        
        // Computed properties
        filteredApps,
        sortedApps,
        groupedApps,
        visibleGroupedApps,
        stats: getStats,
        
        // Actions
        refreshApps,
        updateAppCache,
        toggleAppVisibility,
        bulkToggleVisibility,
        addCustomApp,
        removeCustomApp,
        createGroup,
        assignAppToGroup,
        bulkAssignToGroup,
        deleteGroup,
        cleanup
    }
}