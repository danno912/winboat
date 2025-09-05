import { ref, computed } from 'vue'
import { Winboat } from '../lib/winboat'
import { useAppManagement } from './useAppManagement'
import { useAppStore } from '../stores/appStore'
import type { WinApp } from '../../types'
import { createLogger } from '../utils/log'
import { WINBOAT_DIR } from '../lib/constants'

const path: typeof import('path') = require('path')
const logger = createLogger(path.join(WINBOAT_DIR, 'winboatIntegration.log'))

// Singleton winboat instance
let winboatInstance: Winboat | null = null

export const useWinboatIntegration = () => {
    const appManagement = useAppManagement()
    const appStore = useAppStore()
    
    // Initialize winboat instance if not already done
    if (!winboatInstance) {
        winboatInstance = new Winboat()
    }
    
    // Reactive winboat status
    const isOnline = computed(() => winboatInstance?.isOnline?.value ?? false)
    const containerStatus = computed(() => winboatInstance?.containerStatus?.value ?? 'unknown')
    
    // Launch app with usage tracking
    const launchApp = async (app: WinApp): Promise<boolean> => {
        try {
            if (!winboatInstance) {
                logger.error('Winboat instance not available')
                return false
            }
            
            // Launch the app using the original winboat method
            await winboatInstance.launchApp(app)
            
            // Update usage count in our new system
            if (winboatInstance.appMgr) {
                winboatInstance.appMgr.incrementAppUsage(app.Name)
            }
            
            // Update the app in our store
            const updatedUsage = (app.Usage || 0) + 1
            appStore.updateApp(app.Path, { Usage: updatedUsage })
            
            logger.info(`Launched app: ${app.Name}, new usage count: ${updatedUsage}`)
            return true
        } catch (error) {
            logger.error(`Failed to launch app ${app.Name}:`, error)
            appStore.setError(`Failed to launch ${app.Name}`)
            return false
        }
    }
    
    // Refresh apps from both systems
    const refreshAppsFromWinboat = async (): Promise<void> => {
        try {
            if (!winboatInstance?.appMgr) {
                logger.error('Winboat app manager not available')
                return
            }
            
            // Get apps from original winboat system
            const winboatApps = await winboatInstance.appMgr.getApps()
            
            // Update our store with the fresh data
            appStore.setApps(winboatApps)
            
            // Also update our enhanced app manager cache
            await appManagement.updateAppCache(true)
            
            logger.info(`Refreshed ${winboatApps.length} apps from Winboat`)
        } catch (error) {
            logger.error('Failed to refresh apps from Winboat:', error)
            appStore.setError('Failed to refresh apps')
        }
    }
    
    // Check if container is healthy
    const isContainerHealthy = computed(() => {
        const status = containerStatus.value
        return status === 'running' && isOnline.value
    })
    
    // Get container status message
    const getStatusMessage = computed(() => {
        if (!isOnline.value) {
            const status = containerStatus.value
            if (status === 'exited' || status === 'dead') {
                return 'The WinBoat Container is not running, please start it to view your apps list.'
            }
            return 'The WinBoat Guest API is not running, please restart the container. If this problem persists, contact customer support.'
        }
        return ''
    })
    
    // Initialize the integration
    const initialize = async (): Promise<void> => {
        try {
            logger.info('Initializing Winboat integration')
            
            if (isContainerHealthy.value) {
                await refreshAppsFromWinboat()
            }
            
            // Set up watchers for winboat state changes
            if (winboatInstance?.isOnline) {
                // Watch for online status changes and refresh when coming online
                winboatInstance.isOnline.value && refreshAppsFromWinboat()
            }
            
        } catch (error) {
            logger.error('Failed to initialize Winboat integration:', error)
        }
    }
    
    return {
        // State
        isOnline,
        containerStatus,
        isContainerHealthy,
        
        // Computed
        statusMessage: getStatusMessage,
        
        // Actions
        launchApp,
        refreshAppsFromWinboat,
        initialize,
        
        // Direct access to winboat instance if needed
        winboat: winboatInstance
    }
}