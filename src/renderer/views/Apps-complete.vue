<template>
    <div class="apps-view">
        <!-- Add Custom App Dialog -->
        <dialog ref="addCustomAppDialog">
            <h3 class="mb-2">Add Custom App</h3>
            <p>Add a custom app to your apps list.</p>

            <div class="flex flex-row gap-5 mt-4 w-[35vw]">
                <div class="flex flex-col flex-none gap-2 justify-center items-center">
                    <div class="relative">
                        <img v-if="customAppIcon" :src="customAppIcon" class="size-24">
                        <Icon v-else class="size-24 text-neutral-400" icon="mdi:image"></Icon>
                        <button
                            @click="pickCustomAppIcon"
                            class="flex absolute top-0 left-0 flex-col gap-1 justify-center items-center w-full h-full rounded-xl opacity-0 backdrop-blur-sm transition duration-200 absoute bg-black/50 hover:opacity-100"
                        >
                            <Icon icon="mdi:pencil" class="size-10"></Icon>
                            <x-label>Change Icon</x-label>
                        </button>
                    </div>
                </div>
                <div class="flex flex-col gap-0.5 justify-center w-full">
                    <x-label>Name</x-label>
                    <x-input type="text" class="!max-w-full" @input="(e: any) => customAppName = e.target.value">
                        <x-label>My Awesome App</x-label>
                    </x-input>
                    <x-label class="mt-4">Path</x-label>
                    <x-input type="text" class="!max-w-full" @input="(e: any) => customAppPath = e.target.value">
                        <x-label>C:\Program Files\MyAwesomeApp\myapp.exe</x-label>
                    </x-input>
                </div>
            </div>

            <div class="flex flex-col gap-1 mt-2">
                <div class="flex flex-row gap-2 items-center my-0 font-semibold text-blue-400">
                    <Icon icon="fluent:info-32-filled" class="inline size-4"></Icon>
                    <p class="!my-0 break-normal max-w-[30vw]">
                        Please make sure the path you enter is a valid path to an executable file, otherwise the app will not work.
                    </p>
                </div>
                <div class="flex flex-row gap-2 items-center my-0 font-semibold text-blue-400">
                    <Icon icon="fluent:info-32-filled" class="inline size-4"></Icon>
                    <p class="!my-0 break-normal max-w-[30vw]">
                        Custom apps can be removed by right clicking on them and selecting "Remove Custom App".
                    </p>
                </div>
                <div class="flex flex-row gap-2 items-center my-0 font-semibold text-red-500" v-for="error, k of customAppAddErrors" :key="k">
                    <Icon icon="fluent:warning-32-filled" class="inline size-4"></Icon>
                    <p class="!my-0">{{ error }}</p>
                </div>
            </div>

            <footer>
                <x-button @click="cancelAddCustomApp" id="cancel-button">
                    <x-label>Cancel</x-label>
                </x-button>
                <x-button toggled id="add-button" :disabled="customAppAddErrors.length > 0" @click="addCustomApp">
                    <x-label>Add</x-label>
                </x-button>
            </footer>
        </dialog>
        
        <!-- Header with controls -->
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <x-label class="text-neutral-300">Apps</x-label>
                
                <!-- App count and stats -->
                <div class="text-sm text-neutral-500">
                    {{ stats.visibleApps }} visible
                    <span v-if="stats.hiddenApps > 0">, {{ stats.hiddenApps }} hidden</span>
                    <span v-if="stats.totalGroups > 0">, {{ stats.totalGroups }} groups</span>
                </div>
                
                <!-- Container status indicator -->
                <div v-if="!winboatIntegration.isContainerHealthy" 
                     class="flex items-center gap-2 px-3 py-1 bg-yellow-900/20 border border-yellow-500/30 rounded-full">
                    <Icon icon="mdi:alert-circle" class="size-4 text-yellow-400" />
                    <span class="text-xs text-yellow-300">Container Offline</span>
                </div>
            </div>
            
            <div class="flex flex-row gap-2 justify-center items-center">
                <!-- View mode toggle -->
                <x-button 
                    class="flex flex-row gap-1 items-center"
                    :toggled="uiStore.showHidden"
                    @click="uiStore.toggleShowHidden"
                >
                    <Icon :icon="uiStore.showHidden ? 'mdi:eye' : 'mdi:eye-off'" class="size-4" />
                    <x-label class="qualifier">{{ uiStore.showHidden ? 'Hide Hidden' : 'Show Hidden' }}</x-label>
                </x-button>

                <!-- Bulk action toggle -->
                <x-button
                    v-if="!uiStore.bulkActionMode"
                    class="flex flex-row gap-1 items-center"
                    @click="uiStore.enterBulkActionMode"
                >
                    <Icon icon="mdi:checkbox-multiple-marked" class="size-4" />
                    <x-label class="qualifier">Select</x-label>
                </x-button>
                
                <!-- Group management button -->
                <x-button
                    class="flex flex-row gap-1 items-center"
                    @click="openGroupManager"
                >
                    <Icon icon="mdi:folder-cog" class="size-4" />
                    <x-label class="qualifier">Manage Groups</x-label>
                </x-button>
                
                <!-- Custom app plus btn -->
                <x-button
                    class="flex flex-row gap-1 items-center"
                    @click="addCustomAppDialog!.showModal()"
                >
                    <x-icon href="#add" class="qualifier"></x-icon>
                    <x-label class="qualifier">Add Custom</x-label>
                </x-button>
                 
                <!-- Sort selector -->
                <x-select @change="(e: any) => uiStore.setSortBy(e.detail.newValue)">
                    <x-menu class="">
                        <x-menuitem value="name" :toggled="uiStore.sortBy === 'name'">
                            <x-icon href="#sort" class="qualifier"></x-icon>
                            <x-label>
                                <span class="qualifier">Sort By:</span>
                                Name
                            </x-label>
                        </x-menuitem>
                        <x-menuitem value="usage" :toggled="uiStore.sortBy === 'usage'">
                            <x-icon href="#sort" class="qualifier"></x-icon>
                            <x-label>
                                <span class="qualifier">Sort By:</span>
                                Usage
                            </x-label>
                        </x-menuitem>
                    </x-menu>
                </x-select>
                
                <!-- Search input -->
                <x-input
                    id="search-term"
                    class="m-0 w-64 max-w-64"
                    type="text"
                    maxlength="32"
                    :value="uiStore.searchInput"
                    @input="(e: any) => uiStore.setSearchInput(e.target.value)"
                >
                    <x-icon href="#search"></x-icon>
                    <x-label>Search</x-label>
                </x-input>
            </div>
        </div>

        <!-- Bulk Action Toolbar -->
        <transition name="slide-down">
            <div v-if="uiStore.bulkActionMode" class="bulk-toolbar mb-4 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <div class="text-sm text-blue-300">
                            {{ uiStore.selectedCount }} app{{ uiStore.selectedCount === 1 ? '' : 's' }} selected
                        </div>
                        
                        <!-- Select all/none buttons -->
                        <div class="flex gap-1">
                            <x-button 
                                @click="selectAllVisible"
                                size="sm"
                                class="text-xs"
                            >
                                Select All
                            </x-button>
                            <x-button 
                                @click="uiStore.clearSelection"
                                size="sm"
                                class="text-xs"
                            >
                                Clear
                            </x-button>
                        </div>
                    </div>
                    
                    <div class="flex gap-2 items-center">
                        <!-- Bulk visibility actions -->
                        <x-button 
                            v-if="uiStore.hasSelection"
                            @click="bulkHideSelected"
                            class="flex items-center gap-1"
                        >
                            <Icon icon="mdi:eye-off" class="size-4" />
                            <x-label>Hide Selected</x-label>
                        </x-button>
                        
                        <x-button 
                            v-if="uiStore.hasSelection"
                            @click="bulkShowSelected"
                            class="flex items-center gap-1"
                        >
                            <Icon icon="mdi:eye" class="size-4" />
                            <x-label>Show Selected</x-label>
                        </x-button>
                        
                        <!-- Bulk group selector -->
                        <BulkGroupSelector
                            v-if="uiStore.hasSelection"
                            :selected-app-paths="uiStore.getSelectedApps()"
                            @group-assigned="handleBulkGroupAssignment"
                            @group-created="handleGroupCreated"
                        />
                        
                        <x-button @click="uiStore.exitBulkActionMode" class="text-red-400">
                            <x-label>Cancel</x-label>
                        </x-button>
                    </div>
                </div>
            </div>
        </transition>

        <!-- Main content -->
        <div v-if="winboatIntegration.isContainerHealthy">
            <div v-if="!loading" class="px-2">
                <div v-if="filteredApps.length" class="space-y-6">
                    <!-- Ungrouped apps -->
                    <div v-if="ungroupedApps.length > 0">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-semibold text-neutral-300">Ungrouped Apps</h3>
                            <span class="text-sm text-neutral-500">({{ ungroupedApps.length }})</span>
                        </div>
                        
                        <GroupDropZone 
                            :group-id="null" 
                            group-name="Ungrouped"
                            :is-empty="ungroupedApps.length === 0"
                        >
                            <div class="grid gap-4 app-grid">
                                <AppCardEnhanced
                                    v-for="app in ungroupedApps" 
                                    :key="app.Path"
                                    :app="app"
                                    :bulk-mode="uiStore.bulkActionMode"
                                    :selected="uiStore.isAppSelected(app.Path)"
                                    @click="handleAppClick(app)"
                                    @toggle-selection="uiStore.toggleAppSelection(app.Path)"
                                    @toggle-visibility="handleToggleVisibility(app.Path)"
                                    @remove-custom="handleRemoveCustomApp(app)"
                                    @move-to-group="openGroupSelectorForApp(app)"
                                    @remove-from-group="handleRemoveFromGroup(app.Path)"
                                />
                            </div>
                        </GroupDropZone>
                    </div>

                    <!-- Grouped apps -->
                    <div v-for="group in groupStore.orderedGroups" :key="group.id" class="group-section">
                        <div 
                            class="group-header flex items-center gap-3 mb-3 p-3 rounded-lg cursor-pointer hover:bg-neutral-800/50 transition-all duration-200"
                            @click="groupStore.toggleGroupExpanded(group.id)"
                        >
                            <Icon 
                                :icon="groupStore.isGroupExpanded(group.id) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
                                class="size-5 transition-transform duration-200"
                            />
                            <div 
                                class="w-4 h-4 rounded-full"
                                :style="{ backgroundColor: group.color || '#6366f1' }"
                            ></div>
                            <h3 class="text-lg font-semibold">{{ group.name }}</h3>
                            <span class="text-sm text-neutral-500 ml-auto">
                                ({{ getAppsInGroup(group.id).length }} apps)
                            </span>
                        </div>
                        
                        <transition name="expand-collapse">
                            <div v-if="groupStore.isGroupExpanded(group.id)" class="ml-6">
                                <GroupDropZone 
                                    :group-id="group.id" 
                                    :group-name="group.name"
                                    :is-empty="getAppsInGroup(group.id).length === 0"
                                >
                                    <div v-if="getAppsInGroup(group.id).length > 0" class="grid gap-4 app-grid">
                                        <AppCardEnhanced
                                            v-for="app in getAppsInGroup(group.id)"
                                            :key="app.Path"
                                            :app="app"
                                            :bulk-mode="uiStore.bulkActionMode"
                                            :selected="uiStore.isAppSelected(app.Path)"
                                            @click="handleAppClick(app)"
                                            @toggle-selection="uiStore.toggleAppSelection(app.Path)"
                                            @toggle-visibility="handleToggleVisibility(app.Path)"
                                            @remove-custom="handleRemoveCustomApp(app)"
                                            @move-to-group="openGroupSelectorForApp(app)"
                                            @remove-from-group="handleRemoveFromGroup(app.Path)"
                                        />
                                    </div>
                                </GroupDropZone>
                            </div>
                        </transition>
                    </div>
                </div>
                
                <div v-else class="flex justify-center items-center mt-40">
                    <div class="text-center">
                        <Icon class="text-neutral-400 size-32 mb-4" icon="mdi:application-outline"></Icon>
                        <p class="text-lg text-neutral-400">No apps found</p>
                        <p class="text-sm text-neutral-500 mt-2">
                            {{ uiStore.searchInput ? 'Try a different search term' : 'Add a custom app to get started' }}
                        </p>
                    </div>
                </div>
            </div>
            
            <div v-else class="px-2">
                <div class="flex justify-center items-center mt-40">
                    <x-throbber class="w-16 h-16"></x-throbber>
                </div>
            </div>
        </div>
        
        <!-- Container offline state -->
        <div v-else class="px-2 mt-32">
            <div class="flex flex-col gap-4 justify-center items-center">
                <Icon class="text-violet-400 size-32" icon="fluent-mdl2:plug-disconnected"></Icon>
                <h1 class="text-xl font-semibold w-[30vw] text-center leading-16">
                    {{ winboatIntegration.statusMessage }}
                </h1>
            </div>
        </div>

        <!-- Error message -->
        <div v-if="error" class="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <div class="flex items-center gap-2">
                <Icon icon="mdi:alert-circle" class="size-5 text-red-400" />
                <span class="text-red-300">{{ error }}</span>
            </div>
        </div>

        <!-- Group Manager Dialog -->
        <GroupManager ref="groupManagerRef" />
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, useTemplateRef, watch, onUnmounted } from 'vue';
import { useAppManagement } from '../composables/useAppManagement';
import { useWinboatIntegration } from '../composables/useWinboatIntegration';
import { useUIStore } from '../stores/uiStore';
import { useGroupStore } from '../stores/groupStore';
import AppCardEnhanced from '../components/AppCard-enhanced.vue';
import GroupDropZone from '../components/GroupDropZone.vue';
import GroupManager from '../components/GroupManager.vue';
import BulkGroupSelector from '../components/BulkGroupSelector.vue';
import type { WinApp, AppGroup } from '../../types';
import { AppIcons, DEFAULT_ICON } from '../data/appicons';
import { WINBOAT_GUEST_API } from '../lib/constants';
import { debounce } from '../utils/debounce';
import { Jimp, JimpMime } from 'jimp';

const nodeFetch: typeof import('node-fetch').default = require('node-fetch');
const FormData: typeof import('form-data') = require('form-data');

// Composables and stores
const appManagement = useAppManagement();
const winboatIntegration = useWinboatIntegration();
const uiStore = useUIStore();
const groupStore = useGroupStore();

// Destructure for easier access
const { 
    apps, 
    loading, 
    error, 
    filteredApps, 
    stats,
    refreshApps, 
    toggleAppVisibility,
    bulkToggleVisibility,
    addCustomApp: addCustomAppAction,
    removeCustomApp: removeCustomAppAction,
    assignAppToGroup
} = appManagement;

// Template refs
const addCustomAppDialog = useTemplateRef('addCustomAppDialog');
const groupManagerRef = useTemplateRef('groupManagerRef');

// Custom app dialog state
const customAppName = ref('');
const customAppPath = ref('');
const customAppIcon = ref(`data:image/png;base64,${AppIcons[DEFAULT_ICON]}`);

// Computed properties
const ungroupedApps = computed(() => 
    filteredApps.value.filter(app => !app.GroupId)
);

const customAppAddErrors = computed(() => {
    const errors: string[] = [];

    if (!customAppName.value) {
        errors.push("A valid name is required for your app");
    }

    if (apps.value.find((app) => app.Name === customAppName.value)) {
        errors.push("An app with this name already exists");
    }

    const appWithConflictingPath = apps.value.find((app) => app.Path === customAppPath.value);
    if (appWithConflictingPath) {
        errors.push(`An app (${appWithConflictingPath.Name}) with this path already exists`);
    }

    if (!customAppPath.value) {
        errors.push("A valid path is required for your app");
    }

    if (!customAppIcon.value) {
        errors.push("A valid icon is required for your app");
    }

    return errors;
});

// Helper functions
const getAppsInGroup = (groupId: string) => 
    filteredApps.value.filter(app => app.GroupId === groupId);

const handleAppClick = (app: WinApp) => {
    if (uiStore.bulkActionMode) {
        uiStore.toggleAppSelection(app.Path);
    } else {
        // Launch app using winboat integration
        winboatIntegration.launchApp(app);
    }
};

const handleToggleVisibility = async (appPath: string) => {
    await toggleAppVisibility(appPath);
};

const handleRemoveCustomApp = async (app: WinApp) => {
    await removeCustomAppAction(app);
};

const handleRemoveFromGroup = async (appPath: string) => {
    await assignAppToGroup(appPath, null);
};

const openGroupSelectorForApp = (app: WinApp) => {
    // For now, just log - could implement a context menu or modal
    console.log('Open group selector for app:', app.Name);
};

const selectAllVisible = () => {
    const visiblePaths = filteredApps.value.map(app => app.Path);
    uiStore.selectAllApps(visiblePaths);
};

const bulkHideSelected = async () => {
    const selectedPaths = uiStore.getSelectedApps();
    await bulkToggleVisibility(selectedPaths, true);
    uiStore.clearSelection();
};

const bulkShowSelected = async () => {
    const selectedPaths = uiStore.getSelectedApps();
    await bulkToggleVisibility(selectedPaths, false);
    uiStore.clearSelection();
};

const handleBulkGroupAssignment = (groupId: string | null) => {
    console.log(`Bulk assigned apps to group: ${groupId || 'ungrouped'}`);
    uiStore.clearSelection();
};

const handleGroupCreated = (group: AppGroup) => {
    console.log(`New group created: ${group.name}`);
};

const openGroupManager = () => {
    groupManagerRef.value?.openDialog();
};

// Custom app functions
const debouncedFetchIcon = debounce(async (newVal: string, oldVal: string) => {            
    if (newVal !== oldVal && newVal !== '') {
        const formData = new FormData();
        formData.append('path', newVal);
        
        try {
            const iconRes = await nodeFetch(`${WINBOAT_GUEST_API}/get-icon`, {
                method: 'POST',
                body: formData as any
            });
            const icon = await iconRes.text();
            customAppIcon.value = `data:image/png;base64,${icon}`;
            console.log(`Custom app icon fetched for ${newVal}`);
        } catch (error) {
            console.error('Failed to fetch icon:', error);
        }
    }
}, 500);

function pickCustomAppIcon() {
    const filePicker = document.createElement('input');
    filePicker.type = 'file';
    filePicker.accept = 'image/*';
    filePicker.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if(!file) {
            console.log("No file selected");
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e: any) => {
            const buf = e.target.result as ArrayBuffer;
            try {
                const image = await Jimp.read(Buffer.from(buf));
                image.resize({ w: 128, h: 128 });
                const pngBuffer = await image.getBuffer(JimpMime.png);
                customAppIcon.value = `data:image/png;base64,${pngBuffer.toString('base64')}`;
            } catch (error) {
                console.error('Image processing failed:', error);
            }
        }
        reader.readAsArrayBuffer(file);
    }
    filePicker.click();
}

function cancelAddCustomApp() {
    addCustomAppDialog.value!.close();
    resetCustomAppForm();
}

async function addCustomApp() {
    const iconRaw = customAppIcon.value.split('data:image/png;base64,')[1];
    const success = await addCustomAppAction(customAppName.value, customAppPath.value, iconRaw);
    
    if (success) {
        addCustomAppDialog.value!.close();
        resetCustomAppForm();
    }
}

function resetCustomAppForm() {
    setTimeout(() => {
        customAppName.value = '';
        customAppPath.value = '';
        customAppIcon.value = `data:image/png;base64,${AppIcons[DEFAULT_ICON]}`;
    
        addCustomAppDialog.value?.querySelectorAll('x-input')?.forEach((input: any) => {
            input.value = '';
        });
    }, 100);
}

// Lifecycle
onMounted(async () => {
    // Initialize winboat integration
    await winboatIntegration.initialize();
    
    // Watch for custom app path changes to fetch icons
    watch(customAppPath, async (newVal, oldVal) => {
        await debouncedFetchIcon(newVal, oldVal);
    });
});

onUnmounted(() => {
    uiStore.resetUI();
    appManagement.cleanup();
});
</script>

<style scoped>
.apps-view {
    height: 100%;
    overflow-y: auto;
}

.app-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
}

.group-section {
    border-left: 3px solid rgba(99, 102, 241, 0.3);
    padding-left: 1rem;
    margin-left: 0.5rem;
}

.group-header:hover {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
}

.bulk-toolbar {
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%);
}

/* Animations */
.slide-down-enter-active,
.slide-down-leave-active {
    transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
    opacity: 0;
    transform: translateY(-10px);
    max-height: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
    opacity: 1;
    transform: translateY(0);
    max-height: 200px;
}

.expand-collapse-enter-active,
.expand-collapse-leave-active {
    transition: all 0.4s ease;
    overflow: hidden;
}

.expand-collapse-enter-from,
.expand-collapse-leave-to {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
}

.expand-collapse-enter-to,
.expand-collapse-leave-from {
    opacity: 1;
    max-height: 2000px;
    transform: translateY(0);
}

/* Menu styling */
:deep(x-menu .qualifier) {
    display: none;
}

/* Smooth scrolling */
.apps-view {
    scroll-behavior: smooth;
}

/* Container status styles */
.container-status {
    background: linear-gradient(90deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);
}

/* Custom scrollbar */
.apps-view::-webkit-scrollbar {
    width: 8px;
}

.apps-view::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
}

.apps-view::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
}

.apps-view::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
}
</style>