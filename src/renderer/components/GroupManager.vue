<template>
    <dialog ref="groupManagerDialog" class="group-manager-dialog">
        <div class="dialog-content">
            <header class="dialog-header">
                <h3>Manage Groups</h3>
                <button @click="closeDialog" class="close-button">
                    <Icon icon="mdi:close" class="size-5" />
                </button>
            </header>

            <div class="dialog-body">
                <!-- Create New Group Section -->
                <div class="create-group-section mb-6">
                    <h4 class="text-lg font-semibold mb-3">Create New Group</h4>
                    <div class="flex gap-3 items-end">
                        <div class="flex-1">
                            <x-label class="text-sm">Group Name</x-label>
                            <x-input 
                                v-model="newGroupName"
                                type="text" 
                                placeholder="Enter group name..."
                                class="!max-w-full"
                                @keyup.enter="createGroup"
                            />
                        </div>
                        <div class="color-picker-container">
                            <x-label class="text-sm">Color</x-label>
                            <div class="color-picker">
                                <input
                                    v-model="newGroupColor"
                                    type="color"
                                    class="color-input"
                                />
                                <div 
                                    class="color-preview"
                                    :style="{ backgroundColor: newGroupColor }"
                                ></div>
                            </div>
                        </div>
                        <x-button 
                            @click="createGroup"
                            :disabled="!newGroupName.trim()"
                            toggled
                        >
                            <Icon icon="mdi:plus" class="size-4 mr-1" />
                            <x-label>Create</x-label>
                        </x-button>
                    </div>
                </div>

                <!-- Existing Groups -->
                <div class="existing-groups-section">
                    <h4 class="text-lg font-semibold mb-3">
                        Existing Groups ({{ groups.length }})
                    </h4>
                    
                    <div v-if="groups.length === 0" class="empty-state">
                        <Icon icon="mdi:folder-outline" class="size-12 text-neutral-400 mb-2" />
                        <p class="text-neutral-400">No groups created yet</p>
                        <p class="text-sm text-neutral-500">Create your first group above</p>
                    </div>
                    
                    <div v-else class="groups-list space-y-2">
                        <div 
                            v-for="group in orderedGroups" 
                            :key="group.id"
                            class="group-item"
                            :class="{ 'editing': editingGroupId === group.id }"
                        >
                            <!-- View Mode -->
                            <div v-if="editingGroupId !== group.id" class="group-view">
                                <div class="group-info">
                                    <div 
                                        class="group-color-indicator"
                                        :style="{ backgroundColor: group.color || '#6366f1' }"
                                    ></div>
                                    <div class="group-details">
                                        <h5 class="group-name">{{ group.name }}</h5>
                                        <p class="group-stats text-xs text-neutral-500">
                                            {{ getGroupAppCount(group.id) }} apps
                                            • Created {{ formatDate(group.createdAt) }}
                                        </p>
                                    </div>
                                </div>
                                
                                <div class="group-actions">
                                    <button 
                                        @click="startEditingGroup(group)"
                                        class="action-button"
                                        title="Edit Group"
                                    >
                                        <Icon icon="mdi:pencil" class="size-4" />
                                    </button>
                                    <button 
                                        @click="confirmDeleteGroup(group)"
                                        class="action-button text-red-400 hover:text-red-300"
                                        title="Delete Group"
                                        :disabled="getGroupAppCount(group.id) > 0"
                                    >
                                        <Icon icon="mdi:trash-can" class="size-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Edit Mode -->
                            <div v-else class="group-edit">
                                <div class="edit-fields">
                                    <div class="flex gap-2 items-center flex-1">
                                        <input
                                            v-model="editingGroupName"
                                            type="text"
                                            class="edit-input flex-1"
                                            @keyup.enter="saveGroupEdit"
                                            @keyup.escape="cancelGroupEdit"
                                        />
                                        <input
                                            v-model="editingGroupColor"
                                            type="color"
                                            class="color-input-small"
                                        />
                                    </div>
                                </div>
                                
                                <div class="edit-actions">
                                    <button 
                                        @click="saveGroupEdit"
                                        class="action-button text-green-400 hover:text-green-300"
                                        title="Save Changes"
                                    >
                                        <Icon icon="mdi:check" class="size-4" />
                                    </button>
                                    <button 
                                        @click="cancelGroupEdit"
                                        class="action-button text-neutral-400 hover:text-neutral-300"
                                        title="Cancel"
                                    >
                                        <Icon icon="mdi:close" class="size-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer class="dialog-footer">
                <x-button @click="closeDialog">
                    <x-label>Close</x-label>
                </x-button>
            </footer>
        </div>
    </dialog>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, computed, useTemplateRef } from 'vue'
import { useGroupStore } from '../stores/groupStore'
import { useAppManagement } from '../composables/useAppManagement'
import type { AppGroup } from '../../types'

const groupStore = useGroupStore()
const appManagement = useAppManagement()
const groupManagerDialog = useTemplateRef('groupManagerDialog')

// State
const newGroupName = ref('')
const newGroupColor = ref('#6366f1')
const editingGroupId = ref<string | null>(null)
const editingGroupName = ref('')
const editingGroupColor = ref('')

// Computed
const groups = computed(() => groupStore.groups)
const orderedGroups = computed(() => groupStore.orderedGroups)

// Methods
const openDialog = () => {
    groupManagerDialog.value?.showModal()
}

const closeDialog = () => {
    groupManagerDialog.value?.close()
    resetCreateForm()
    cancelGroupEdit()
}

const resetCreateForm = () => {
    newGroupName.value = ''
    newGroupColor.value = '#6366f1'
}

const createGroup = async () => {
    const name = newGroupName.value.trim()
    if (!name) return

    const success = await appManagement.createGroup({
        name,
        color: newGroupColor.value,
        collapsed: false,
        order: groups.value.length
    })

    if (success) {
        resetCreateForm()
    }
}

const startEditingGroup = (group: AppGroup) => {
    editingGroupId.value = group.id
    editingGroupName.value = group.name
    editingGroupColor.value = group.color || '#6366f1'
}

const saveGroupEdit = async () => {
    if (!editingGroupId.value) return

    const name = editingGroupName.value.trim()
    if (!name) return

    const success = await groupStore.updateGroup(editingGroupId.value, {
        name,
        color: editingGroupColor.value
    })

    if (success) {
        cancelGroupEdit()
    }
}

const cancelGroupEdit = () => {
    editingGroupId.value = null
    editingGroupName.value = ''
    editingGroupColor.value = ''
}

const confirmDeleteGroup = async (group: AppGroup) => {
    const appCount = getGroupAppCount(group.id)
    
    if (appCount > 0) {
        alert(`Cannot delete "${group.name}" because it contains ${appCount} apps. Move or remove the apps first.`)
        return
    }

    const confirmed = confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)
    if (!confirmed) return

    await appManagement.deleteGroup(group.id)
}

const getGroupAppCount = (groupId: string): number => {
    return appManagement.apps.filter(app => app.GroupId === groupId).length
}

const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    }).format(new Date(date))
}

// Expose methods to parent
defineExpose({
    openDialog,
    closeDialog
})
</script>

<style scoped>
.group-manager-dialog {
    min-width: 500px;
    max-width: 700px;
    width: 90vw;
    max-height: 80vh;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
    backdrop-filter: blur(20px);
    color: white;
}

.dialog-content {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem 1rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
}

.close-button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
}

.close-button:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
}

.dialog-body {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
}

.create-group-section {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1.5rem;
}

.color-picker {
    position: relative;
    width: 40px;
    height: 32px;
}

.color-input {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
}

.color-preview {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 0.2s;
}

.color-preview:hover {
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
}

.empty-state {
    text-align: center;
    padding: 3rem 1rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
}

.groups-list {
    max-height: 300px;
    overflow-y: auto;
}

.group-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s;
}

.group-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
}

.group-item.editing {
    border-color: rgba(59, 130, 246, 0.5);
    background: rgba(59, 130, 246, 0.1);
}

.group-view {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.group-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
}

.group-color-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex-shrink: 0;
}

.group-details {
    flex: 1;
    min-width: 0;
}

.group-name {
    margin: 0;
    font-weight: 500;
    color: white;
}

.group-stats {
    margin: 0.25rem 0 0 0;
}

.group-actions {
    display: flex;
    gap: 0.5rem;
}

.action-button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-button:hover:not(:disabled) {
    color: white;
    background: rgba(255, 255, 255, 0.1);
}

.action-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.group-edit {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.edit-fields {
    flex: 1;
}

.edit-input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: white;
    font-size: 0.875rem;
}

.edit-input:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.color-input-small {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    cursor: pointer;
    background: none;
}

.edit-actions {
    display: flex;
    gap: 0.5rem;
}

.dialog-footer {
    padding: 1rem 2rem 1.5rem 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: flex-end;
}

/* Custom scrollbar for groups list */
.groups-list::-webkit-scrollbar {
    width: 6px;
}

.groups-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}

.groups-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
}

.groups-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}
</style>