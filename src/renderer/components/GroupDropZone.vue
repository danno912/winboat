<template>
    <div 
        :class="[
            'group-drop-zone',
            {
                'drop-zone--active': isDropTarget,
                'drop-zone--valid': isDropTarget && isValidDrop,
                'drop-zone--invalid': isDropTarget && !isValidDrop,
                'drop-zone--empty': isEmpty
            }
        ]"
        @dragover="handleDragOver"
        @dragenter="handleDragEnter"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
    >
        <div v-if="isEmpty && !isDropTarget" class="empty-state">
            <Icon icon="mdi:folder-plus-outline" class="size-8 text-neutral-400 mb-2" />
            <p class="text-sm text-neutral-400">Drop apps here to add to {{ groupName }}</p>
        </div>
        
        <div v-if="isDropTarget" class="drop-indicator">
            <Icon 
                :icon="isValidDrop ? 'mdi:check-circle' : 'mdi:close-circle'" 
                class="size-6 mr-2"
                :class="isValidDrop ? 'text-green-400' : 'text-red-400'"
            />
            <span :class="isValidDrop ? 'text-green-300' : 'text-red-300'">
                {{ dropMessage }}
            </span>
        </div>
        
        <slot v-else />
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useDragAndDrop } from '../composables/useDragAndDrop'

interface Props {
    groupId: string | null
    groupName?: string
    isEmpty?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    groupName: 'Ungrouped',
    isEmpty: false
})

const { 
    dragOver, 
    drop, 
    dragLeave, 
    dropZone, 
    isDragging, 
    isValidDropTarget,
    draggedApps
} = useDragAndDrop()

// Computed properties
const isDropTarget = computed(() => dropZone.value === props.groupId)
const isValidDrop = computed(() => isValidDropTarget(props.groupId))

const dropMessage = computed(() => {
    if (!isDragging.value) return ''
    
    const appCount = draggedApps.value.length
    const appText = appCount === 1 ? 'app' : 'apps'
    
    if (isValidDrop.value) {
        return `Move ${appCount} ${appText} to ${props.groupName}`
    } else {
        if (props.groupId === null) {
            return `Cannot move system apps`
        } else {
            return `App(s) already in ${props.groupName}`
        }
    }
})

// Event handlers
const handleDragOver = (event: DragEvent) => {
    if (isDragging.value) {
        dragOver(props.groupId, event)
    }
}

const handleDragEnter = (event: DragEvent) => {
    if (isDragging.value) {
        event.preventDefault()
    }
}

const handleDragLeave = (event: DragEvent) => {
    dragLeave(event)
}

const handleDrop = (event: DragEvent) => {
    drop(props.groupId, event)
}
</script>

<style scoped>
.group-drop-zone {
    min-height: 60px;
    border: 2px dashed transparent;
    border-radius: 8px;
    transition: all 0.3s ease;
    position: relative;
}

.drop-zone--active {
    border-style: dashed;
    animation: pulse-border 2s infinite;
}

.drop-zone--valid {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.05);
}

.drop-zone--invalid {
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.05);
}

.drop-zone--empty {
    border-color: rgba(255, 255, 255, 0.1);
    border-style: dashed;
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.drop-zone--empty:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.02);
}

.empty-state {
    text-align: center;
    padding: 1rem;
}

.drop-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    z-index: 10;
    white-space: nowrap;
}

@keyframes pulse-border {
    0%, 100% {
        border-opacity: 0.3;
    }
    50% {
        border-opacity: 0.8;
    }
}

/* Ensure drop zone covers the entire area when active */
.drop-zone--active::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: inherit;
    background: inherit;
    z-index: -1;
}
</style>