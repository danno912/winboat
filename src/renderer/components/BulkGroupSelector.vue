<template>
    <div class="bulk-group-selector">
        <x-select @change="handleGroupSelect" class="group-selector">
            <x-menu>
                <x-menuitem 
                    value=""
                    class="text-neutral-400 italic"
                >
                    <Icon icon="mdi:folder-move" class="size-4 mr-2" />
                    <x-label>Choose group...</x-label>
                </x-menuitem>
                
                <hr class="menu-separator" />
                
                <!-- Ungrouped option -->
                <x-menuitem 
                    value="ungrouped"
                    :disabled="!canMoveToUngrouped"
                >
                    <Icon icon="mdi:folder-remove" class="size-4 mr-2" />
                    <x-label>Remove from groups</x-label>
                </x-menuitem>
                
                <hr v-if="availableGroups.length > 0" class="menu-separator" />
                
                <!-- Available groups -->
                <x-menuitem 
                    v-for="group in availableGroups"
                    :key="group.id"
                    :value="group.id"
                >
                    <div 
                        class="group-color-indicator"
                        :style="{ backgroundColor: group.color || '#6366f1' }"
                    ></div>
                    <x-label class="ml-2">{{ group.name }}</x-label>
                    <span class="ml-auto text-xs text-neutral-500">
                        ({{ getGroupAppCount(group.id) }})
                    </span>
                </x-menuitem>
                
                <hr class="menu-separator" />
                
                <!-- Create new group option -->
                <x-menuitem 
                    value="new-group"
                    class="text-blue-400"
                >
                    <Icon icon="mdi:plus" class="size-4 mr-2" />
                    <x-label>Create new group...</x-label>
                </x-menuitem>
            </x-menu>
        </x-select>
        
        <!-- Quick create new group inline -->
        <div v-if="showNewGroupForm" class="new-group-form mt-3">
            <div class="flex gap-2 items-end">
                <div class="flex-1">
                    <x-label class="text-xs text-neutral-400">Group Name</x-label>
                    <x-input
                        v-model="newGroupName"
                        type="text"
                        placeholder="Enter group name..."
                        class="!max-w-full"
                        @keyup.enter="createGroupAndAssign"
                        @keyup.escape="cancelNewGroup"
                    />
                </div>
                <div class="color-picker-container">
                    <x-label class="text-xs text-neutral-400">Color</x-label>
                    <input
                        v-model="newGroupColor"
                        type="color"
                        class="color-input-small"
                    />
                </div>
                <x-button 
                    @click="createGroupAndAssign"
                    :disabled="!newGroupName.trim()"
                    class="bg-blue-600 hover:bg-blue-500"
                    size="sm"
                >
                    <Icon icon="mdi:check" class="size-4" />
                </x-button>
                <x-button 
                    @click="cancelNewGroup"
                    size="sm"
                >
                    <Icon icon="mdi:close" class="size-4" />
                </x-button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, computed } from 'vue'
import { useGroupStore } from '../stores/groupStore'
import { useAppManagement } from '../composables/useAppManagement'
import type { AppGroup } from '../../types'

interface Props {
    selectedAppPaths: string[]
}

interface Emits {
    (e: 'groupAssigned', groupId: string | null): void
    (e: 'groupCreated', group: AppGroup): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const groupStore = useGroupStore()
const appManagement = useAppManagement()

// State
const showNewGroupForm = ref(false)
const newGroupName = ref('')
const newGroupColor = ref('#6366f1')

// Computed
const availableGroups = computed(() => groupStore.orderedGroups)

const canMoveToUngrouped = computed(() => {
    // Can move to ungrouped if at least one selected app is currently in a group
    return props.selectedAppPaths.some(path => {
        const app = appManagement.apps.find(a => a.Path === path)
        return app?.GroupId !== null
    })
})

const getGroupAppCount = (groupId: string): number => {
    return appManagement.apps.filter(app => app.GroupId === groupId).length
}

// Methods
const handleGroupSelect = async (event: any) => {
    const selectedValue = event.detail.newValue
    
    if (!selectedValue) return
    
    if (selectedValue === 'new-group') {
        showNewGroupForm.value = true
        return
    }
    
    const targetGroupId = selectedValue === 'ungrouped' ? null : selectedValue
    
    // Assign all selected apps to the chosen group
    let successCount = 0
    for (const appPath of props.selectedAppPaths) {
        const success = await appManagement.assignAppToGroup(appPath, targetGroupId)
        if (success) successCount++
    }
    
    if (successCount > 0) {
        emit('groupAssigned', targetGroupId)
        
        // Show feedback
        const groupName = targetGroupId ? 
            availableGroups.value.find(g => g.id === targetGroupId)?.name || 'Unknown Group' :
            'Ungrouped'
            
        console.log(`Moved ${successCount}/${props.selectedAppPaths.length} apps to ${groupName}`)
    }
}

const createGroupAndAssign = async () => {
    const name = newGroupName.value.trim()
    if (!name) return
    
    // Create the new group
    const newGroup = await appManagement.createGroup({
        name,
        color: newGroupColor.value,
        collapsed: false,
        order: availableGroups.value.length
    })
    
    if (newGroup) {
        // Assign selected apps to the new group
        let successCount = 0
        for (const appPath of props.selectedAppPaths) {
            const success = await appManagement.assignAppToGroup(appPath, newGroup.id)
            if (success) successCount++
        }
        
        emit('groupCreated', newGroup)
        emit('groupAssigned', newGroup.id)
        
        console.log(`Created group "${name}" and moved ${successCount} apps`)
        
        cancelNewGroup()
    }
}

const cancelNewGroup = () => {
    showNewGroupForm.value = false
    newGroupName.value = ''
    newGroupColor.value = '#6366f1'
}
</script>

<style scoped>
.bulk-group-selector {
    min-width: 200px;
}

.group-selector {
    width: 100%;
}

.menu-separator {
    border: none;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 4px 0;
}

.group-color-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}

.new-group-form {
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
}

.color-input-small {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    cursor: pointer;
    background: none;
}

.color-picker-container {
    min-width: 50px;
}

/* Style the menu items */
:deep(.x-menuitem) {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    transition: all 0.2s ease;
}

:deep(.x-menuitem:hover) {
    background: rgba(255, 255, 255, 0.1);
}

:deep(.x-menuitem[disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
}

:deep(.x-menuitem[disabled]:hover) {
    background: none;
}
</style>