import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { AppGroup, Result, GroupNotFoundError } from '../../types'
import { createAppGroup } from '../../types'
import { createLogger } from '../utils/log'
import { WINBOAT_DIR } from '../lib/constants'

const path: typeof import('path') = require('path')
const logger = createLogger(path.join(WINBOAT_DIR, 'groupStore.log'))

export const useGroupStore = defineStore('groups', () => {
  // State
  const groups = ref<AppGroup[]>([])
  const groupOrder = ref<string[]>([])
  
  // Computed properties
  const groupsMap = computed(() => {
    const map = new Map<string, AppGroup>()
    groups.value.forEach(group => map.set(group.id, group))
    return map
  })
  
  const orderedGroups = computed(() => {
    // Sort groups by their order in groupOrder array, then by order property
    const orderedByArray = groupOrder.value
      .map(id => groupsMap.value.get(id))
      .filter(group => group !== undefined) as AppGroup[]
    
    // Add any groups not in the order array
    const remainingGroups = groups.value
      .filter(group => !groupOrder.value.includes(group.id))
      .sort((a, b) => a.order - b.order)
    
    return [...orderedByArray, ...remainingGroups]
  })
  
  const expandedGroups = ref<Set<string>>(new Set())
  
  // Actions
  const setGroups = (newGroups: AppGroup[]) => {
    groups.value = newGroups
    logger.info(`Updated groups cache with ${newGroups.length} groups`)
  }
  
  const addGroup = (groupData: Pick<AppGroup, 'name'> & Partial<Pick<AppGroup, 'icon' | 'color' | 'collapsed' | 'order'>>): AppGroup => {
    const newGroup = createAppGroup(groupData)
    groups.value.push(newGroup)
    groupOrder.value.push(newGroup.id)
    logger.info(`Created new group: ${newGroup.name} (${newGroup.id})`)
    return newGroup
  }
  
  const updateGroup = (groupId: string, updates: Partial<Omit<AppGroup, 'id' | 'createdAt'>>): boolean => {
    const index = groups.value.findIndex(group => group.id === groupId)
    if (index === -1) return false
    
    groups.value[index] = {
      ...groups.value[index],
      ...updates,
      updatedAt: new Date()
    }
    logger.info(`Updated group: ${groupId}`)
    return true
  }
  
  const removeGroup = (groupId: string): boolean => {
    const index = groups.value.findIndex(group => group.id === groupId)
    if (index === -1) return false
    
    groups.value.splice(index, 1)
    
    // Remove from order array
    const orderIndex = groupOrder.value.indexOf(groupId)
    if (orderIndex !== -1) {
      groupOrder.value.splice(orderIndex, 1)
    }
    
    // Remove from expanded groups
    expandedGroups.value.delete(groupId)
    
    logger.info(`Removed group: ${groupId}`)
    return true
  }
  
  const findGroup = (groupId: string): AppGroup | undefined => {
    return groupsMap.value.get(groupId)
  }
  
  const reorderGroups = (newOrder: string[]) => {
    groupOrder.value = newOrder
    logger.info(`Reordered groups: ${newOrder.join(', ')}`)
  }
  
  const toggleGroupExpanded = (groupId: string) => {
    if (expandedGroups.value.has(groupId)) {
      expandedGroups.value.delete(groupId)
    } else {
      expandedGroups.value.add(groupId)
    }
  }
  
  const setGroupExpanded = (groupId: string, expanded: boolean) => {
    if (expanded) {
      expandedGroups.value.add(groupId)
    } else {
      expandedGroups.value.delete(groupId)
    }
  }
  
  const isGroupExpanded = (groupId: string): boolean => {
    return expandedGroups.value.has(groupId)
  }
  
  const getGroupCount = (): number => groups.value.length
  
  return {
    // Readonly state
    groups: readonly(groups),
    groupOrder: readonly(groupOrder),
    expandedGroups: readonly(expandedGroups),
    
    // Computed properties
    groupsMap,
    orderedGroups,
    
    // Actions
    setGroups,
    addGroup,
    updateGroup,
    removeGroup,
    findGroup,
    reorderGroups,
    toggleGroupExpanded,
    setGroupExpanded,
    isGroupExpanded,
    getGroupCount
  }
})