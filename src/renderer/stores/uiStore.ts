import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { useDebouncedRef, useLocalStorage } from '@vueuse/core'

export const useUIStore = defineStore('ui', () => {
  // Persistent UI state (saved to localStorage)
  const searchInput = useLocalStorage('winboat-search-input', '')
  const sortBy = useLocalStorage<'name' | 'usage'>('winboat-sort-by', 'name')
  const showHidden = useLocalStorage('winboat-show-hidden', false)
  const viewMode = useLocalStorage<'grid' | 'list'>('winboat-view-mode', 'grid')
  
  // Session-only UI state
  const selectedApps = ref<Set<string>>(new Set())
  const bulkActionMode = ref(false)
  const draggedApp = ref<string | null>(null)
  const dropTarget = ref<string | null>(null)
  
  // Debounced search for better performance
  const debouncedSearch = useDebouncedRef(searchInput, 300)
  
  // Computed properties
  const hasSelection = computed(() => selectedApps.value.size > 0)
  const selectedCount = computed(() => selectedApps.value.size)
  const isDragging = computed(() => draggedApp.value !== null)
  
  // Search and filter actions
  const setSearchInput = (value: string) => {
    searchInput.value = value
  }
  
  const clearSearch = () => {
    searchInput.value = ''
  }
  
  const setSortBy = (value: 'name' | 'usage') => {
    sortBy.value = value
  }
  
  const toggleShowHidden = () => {
    showHidden.value = !showHidden.value
  }
  
  const setViewMode = (mode: 'grid' | 'list') => {
    viewMode.value = mode
  }
  
  // Selection actions
  const selectApp = (appPath: string) => {
    selectedApps.value.add(appPath)
  }
  
  const deselectApp = (appPath: string) => {
    selectedApps.value.delete(appPath)
  }
  
  const toggleAppSelection = (appPath: string) => {
    if (selectedApps.value.has(appPath)) {
      selectedApps.value.delete(appPath)
    } else {
      selectedApps.value.add(appPath)
    }
  }
  
  const selectAllApps = (appPaths: string[]) => {
    appPaths.forEach(path => selectedApps.value.add(path))
  }
  
  const clearSelection = () => {
    selectedApps.value.clear()
  }
  
  const isAppSelected = (appPath: string): boolean => {
    return selectedApps.value.has(appPath)
  }
  
  const getSelectedApps = (): string[] => {
    return Array.from(selectedApps.value)
  }
  
  // Bulk action mode
  const enterBulkActionMode = () => {
    bulkActionMode.value = true
  }
  
  const exitBulkActionMode = () => {
    bulkActionMode.value = false
    clearSelection()
  }
  
  const toggleBulkActionMode = () => {
    if (bulkActionMode.value) {
      exitBulkActionMode()
    } else {
      enterBulkActionMode()
    }
  }
  
  // Drag and drop state
  const setDraggedApp = (appPath: string | null) => {
    draggedApp.value = appPath
  }
  
  const setDropTarget = (target: string | null) => {
    dropTarget.value = target
  }
  
  const clearDragState = () => {
    draggedApp.value = null
    dropTarget.value = null
  }
  
  // Reset all UI state
  const resetUI = () => {
    clearSearch()
    clearSelection()
    exitBulkActionMode()
    clearDragState()
    setSortBy('name')
    showHidden.value = false
    setViewMode('grid')
  }
  
  return {
    // Persistent state (readonly)
    searchInput: readonly(searchInput),
    sortBy: readonly(sortBy),
    showHidden: readonly(showHidden),
    viewMode: readonly(viewMode),
    
    // Session state (readonly)
    selectedApps: readonly(selectedApps),
    bulkActionMode: readonly(bulkActionMode),
    draggedApp: readonly(draggedApp),
    dropTarget: readonly(dropTarget),
    
    // Computed properties
    debouncedSearch,
    hasSelection,
    selectedCount,
    isDragging,
    
    // Search and filter actions
    setSearchInput,
    clearSearch,
    setSortBy,
    toggleShowHidden,
    setViewMode,
    
    // Selection actions
    selectApp,
    deselectApp,
    toggleAppSelection,
    selectAllApps,
    clearSelection,
    isAppSelected,
    getSelectedApps,
    
    // Bulk action mode
    enterBulkActionMode,
    exitBulkActionMode,
    toggleBulkActionMode,
    
    // Drag and drop
    setDraggedApp,
    setDropTarget,
    clearDragState,
    
    // Utility
    resetUI
  }
})