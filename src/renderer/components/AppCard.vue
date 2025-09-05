<template>
    <x-card
        :class="[
            'app-card',
            'flex relative flex-row gap-2 justify-between items-center p-2 my-0 backdrop-blur-xl backdrop-brightness-150 cursor-pointer generic-hover bg-neutral-800/20',
            {
                'app-card--hidden': app.Hidden,
                'app-card--custom': app.Source === 'custom',
                'app-card--selected': selected,
                'border-blue-500': selected,
                'bg-gradient-to-r from-yellow-600/20 bg-neutral-800/20': app.Source === 'custom'
            }
        ]"
        @click="handleClick"
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
        <div v-if="app.Hidden" class="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center pointer-events-none">
            <Icon icon="mdi:eye-off" class="size-8 text-neutral-300" />
        </div>

        <!-- App content -->
        <div class="flex flex-row items-center gap-2 flex-1 min-w-0">
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
            </div>
            
            <div class="flex flex-col min-w-0 flex-1">
                <x-label class="truncate text-ellipsis font-medium">{{ app.Name }}</x-label>
                <div class="text-xs text-neutral-500 truncate">
                    {{ app.Source === 'custom' ? 'Custom' : app.Source === 'internal' ? 'System' : 'Windows' }}
                    <span v-if="app.Usage"> · Used {{ app.Usage }} times</span>
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
            
            <WBMenuItem v-if="app.Source === 'custom'" @click="$emit('removeCustom')">
                <Icon class="size-4" icon="mdi:trash-can"></Icon>
                <x-label>Remove Custom App</x-label>
            </WBMenuItem>
        </WBContextMenu>
    </x-card>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { WinApp } from '../../types';
import WBContextMenu from './WBContextMenu.vue';
import WBMenuItem from './WBMenuItem.vue';

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
}

const props = withDefaults(defineProps<Props>(), {
    bulkMode: false,
    selected: false,
    readonly: false
});

const emit = defineEmits<Emits>();

const handleClick = () => {
    if (!props.readonly) {
        emit('click');
    }
};
</script>

<style scoped>
.app-card {
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.app-card:hover {
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

.app-card__checkbox {
    flex-shrink: 0;
}

/* Ensure proper layering */
.app-card {
    position: relative;
    z-index: 1;
}

.app-card .context-menu {
    z-index: 10;
}
</style>