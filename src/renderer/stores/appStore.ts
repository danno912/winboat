import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { useDebouncedRef, useMemoize } from '@vueuse/core'
import type { WinApp, AppGroup, Result, AppNotFoundError, GroupNotFoundError } from '../../types'
import { createLogger } from '../utils/log'
import { WINBOAT_DIR } from '../lib/constants'

const path: typeof import('path') = require('path')
const logger = createLogger(path.join(WINBOAT_DIR, 'appStore.log'))

export const useAppStore = defineStore('apps', () => {
  // Server state (from WinBoat API)
  const apps = ref<WinApp[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdate = ref<Date | null>(null)
  
  // Computed properties with memoization for performance
  const visibleApps = useMemoize(() => 
    apps.value.filter(app => !app.Hidden),
    [apps]
  )
  
  const hiddenApps = useMemoize(() => 
    apps.value.filter(app => app.Hidden),
    [apps]
  )
  
  const appsByGroup = useMemoize(() => {
    const grouped = new Map<string | null, WinApp[]>()
    
    apps.value.forEach(app => {
      const groupId = app.GroupId
      if (!grouped.has(groupId)) {
        grouped.set(groupId, [])
      }
      grouped.get(groupId)!.push(app)
    })
    
    return grouped
  }, [apps])
  
  const ungroupedApps = computed(() => appsByGroup.value.get(null) || [])
  
  // App lookup map for O(1) access
  const appLookupMap = computed(() => {
    const map = new Map<string, WinApp>()
    apps.value.forEach(app => map.set(app.Path, app))
    return map
  })
  
  // Actions
  const setApps = (newApps: WinApp[]) => {
    apps.value = newApps
    lastUpdate.value = new Date()
    error.value = null
    logger.info(`Updated app cache with ${newApps.length} apps`)
  }
  
  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading
  }
  
  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
    if (errorMessage) {
      logger.error(`App store error: ${errorMessage}`)
    }
  }
  
  const findApp = (appPath: string): WinApp | undefined => {
    return appLookupMap.value.get(appPath)
  }
  
  const updateApp = (appPath: string, updates: Partial<WinApp>): boolean => {
    const appIndex = apps.value.findIndex(app => app.Path === appPath)
    if (appIndex === -1) return false
    
    apps.value[appIndex] = { ...apps.value[appIndex], ...updates }
    return true
  }
  
  const addApp = (app: WinApp) => {
    const existingIndex = apps.value.findIndex(existing => existing.Path === app.Path)
    if (existingIndex !== -1) {
      apps.value[existingIndex] = app
    } else {
      apps.value.push(app)
    }
  }
  
  const removeApp = (appPath: string): boolean => {
    const index = apps.value.findIndex(app => app.Path === appPath)
    if (index === -1) return false
    
    apps.value.splice(index, 1)
    return true
  }
  
  const getAppsInGroup = (groupId: string | null): WinApp[] => {
    return appsByGroup.value.get(groupId) || []
  }
  
  const getAppCount = (): number => apps.value.length
  const getVisibleAppCount = (): number => visibleApps.value.length
  const getHiddenAppCount = (): number => hiddenApps.value.length
  
  return {
    // Readonly state
    apps: readonly(apps),
    loading: readonly(loading),
    error: readonly(error),
    lastUpdate: readonly(lastUpdate),
    
    // Computed properties
    visibleApps,
    hiddenApps,
    appsByGroup,
    ungroupedApps,
    appLookupMap,
    
    // Actions
    setApps,
    setLoading,
    setError,
    findApp,
    updateApp,
    addApp,
    removeApp,
    getAppsInGroup,
    getAppCount,
    getVisibleAppCount,
    getHiddenAppCount
  }
})