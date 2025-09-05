<template>
    <x-card
        :class="[
            'app-card group',
            'flex relative flex-row gap-2 justify-between items-center p-2 my-0 backdrop-blur-xl backdrop-brightness-150 cursor-pointer generic-hover bg-neutral-800/20',
            {
                'app-card--hidden': app.Hidden,
                'app-card--custom': app.Source === 'custom',
                'app-card--selected': selected,
                'app-card--dragging': isDraggedApp,
                'app-card--system': app.Source === 'internal',
                'border-blue-500': selected,
                'bg-gradient-to-r from-yellow-600/20 bg-neutral-800/20': app.Source === 'custom'
            }
        ]"
        :draggable="canDrag"
        @click="handleClick"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
    >
        <!-- Bulk selection checkbox -->
        <div v-if="bulkMode" class="app-card__checkbox mr-2" @click.stop>
            <input 
                type="checkbox" 
                :checked="selected"
                @change="$emit('toggleSelection')"
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
        </div>

        <!-- Hidden indicator overlay -->
        <div v-if="app.Hidden" class="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center pointer-events-none z-10">
            <Icon icon="mdi:eye-off" class="size-8 text-neutral-300" />
        </div>

        <!-- App content -->
        <div class="flex flex-row items-center gap-2 flex-1 min-w-0">
            <!-- Drag handle (visible on hover or when draggable) -->
            <div v-if="canDrag && !bulkMode" class="drag-handle opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon icon="mdi:drag" class="size-4 text-neutral-400" />
            </div>
            
            <div class="relative">
                <img 
                    class="rounded-md size-10 flex-shrink-0" 
                    :src="`data:image/png;charset=utf-8;base64,${app.Icon}`"
                    :alt="`${app.Name} icon`"
                />
                <!-- Usage indicator -->
                <div v-if="app.Usage && app.Usage > 0" 
                     class="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {{ app.Usage > 99 ? '99+' : app.Usage }}
                </div>
                <!-- System app lock indicator -->
                <div v-if="app.Source === 'internal'" 
                     class="absolute -bottom-1 -right-1 bg-neutral-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    <Icon icon="mdi:lock" class="size-2" />
                </div>
            </div>
            
            <div class="flex flex-col min-w-0 flex-1">
                <x-label class="truncate text-ellipsis font-medium">{{ app.Name }}</x-label>
                <div class="text-xs text-neutral-500 truncate">
                    {{ app.Source === 'custom' ? 'Custom' : app.Source === 'internal' ? 'System' : 'Windows' }}
                    <span v-if="app.Usage"> · Used {{ app.Usage }} times</span>
                    <span v-if="!canDrag" class="text-orange-400"> · Cannot move</span>
                </div>
            </div>
        </div>

        <!-- Action icon -->
        <Icon 
            v-if="!bulkMode" 
            icon="cuida:caret-right-outline" 
            class="flex-shrink-0"
        />

        <!-- Context menu -->
        <WBContextMenu v-if="!bulkMode">
            <WBMenuItem @click="$emit('toggleVisibility')">
                <Icon 
                    class="size-4" 
                    :icon="app.Hidden ? 'mdi:eye' : 'mdi:eye-off'"
                />
                <x-label>{{ app.Hidden ? 'Show App' : 'Hide App' }}</x-label>
            </WBMenuItem>
            
            <WBMenuItem v-if="canDrag" @click="$emit('moveToGroup')">
                <Icon class="size-4" icon="mdi:folder-move" />
                <x-label>Move to Group...</x-label>
            </WBMenuItem>
            
            <WBMenuItem v-if="app.GroupId" @click="$emit('removeFromGroup')">
                <Icon class="size-4" icon="mdi:folder-remove" />
                <x-label>Remove from Group</x-label>
            </WBMenuItem>
            
            <WBMenuItem v-if="app.Source === 'custom'" @click="$emit('removeCustom')">
                <Icon class="size-4" icon="mdi:trash-can"></Icon>
                <x-label>Remove Custom App</x-label>
            </WBMenuItem>
        </WBContextMenu>
    </x-card>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import type { WinApp } from '../../types';
import WBContextMenu from './WBContextMenu.vue';
import WBMenuItem from './WBMenuItem.vue';
import { useDragAndDrop } from '../composables/useDragAndDrop';

interface Props {
    app: WinApp;
    bulkMode?: boolean;
    selected?: boolean;
    readonly?: boolean;
}

interface Emits {
    (e: 'click'): void;
    (e: 'toggleSelection'): void;
    (e: 'toggleVisibility'): void;
    (e: 'removeCustom'): void;
    (e: 'moveToGroup'): void;
    (e: 'removeFromGroup'): void;
}

const props = withDefaults(defineProps<Props>(), {
    bulkMode: false,
    selected: false,
    readonly: false
});

const emit = defineEmits<Emits>();

const { canDragApp, startDrag, endDrag, draggedAppPaths } = useDragAndDrop();

// Computed properties
const canDrag = computed(() => !props.readonly && canDragApp(props.app));
const isDraggedApp = computed(() => draggedAppPaths.value.includes(props.app.Path));

const handleClick = () => {
    if (!props.readonly) {
        emit('click');
    }
};

const handleDragStart = (event: DragEvent) => {
    if (canDrag.value) {
        startDrag(props.app, event);
    }
};

const handleDragEnd = () => {
    endDrag();
};
</script>

<style scoped>
.app-card {
    transition: all 0.2s ease;
    border: 1px solid transparent;
    position: relative;
    z-index: 1;
    cursor: grab;
}

.app-card:hover:not(.app-card--dragging) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.app-card--hidden {
    opacity: 0.6;
}

.app-card--selected {
    border-color: rgb(59, 130, 246);
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.app-card--dragging {
    opacity: 0.5;
    transform: rotate(5deg);
    cursor: grabbing;
    z-index: 1000;
}

.app-card--system {
    cursor: default;
}

.app-card--system[draggable="false"] {
    cursor: not-allowed;
}

.app-card--system:hover {
    transform: none;
    box-shadow: none;
}

.app-card__checkbox {
    flex-shrink: 0;
}

.drag-handle {
    cursor: grab;
    padding: 2px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.drag-handle:hover {
    background: rgba(255, 255, 255, 0.1);
}

.app-card .context-menu {
    z-index: 10;
}

/* Group hover effects */
.app-card:hover .drag-handle {
    opacity: 1;
}

/* Add visual feedback for non-draggable items */
.app-card--system::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.05) 2px,
        rgba(255, 255, 255, 0.05) 4px
    );
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    border-radius: inherit;
}

.app-card--system:hover::after {
    opacity: 1;
}
</style>

<style>
/* Global drag preview styles */
.drag-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(59, 130, 246, 0.5);
    border-radius: 8px;
    padding: 8px 12px;
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    color: white;
    font-size: 14px;
    max-width: 200px;
    pointer-events: none;
    transform: rotate(5deg);
}

.drag-preview-icon {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    flex-shrink: 0;
}

.drag-preview-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.drag-preview-multiple {
    display: flex;
    align-items: center;
    gap: 8px;
}

.drag-preview-stack {
    position: relative;
}

.drag-preview-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: rgba(59, 130, 246, 1);
    color: white;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: bold;
}
</style>