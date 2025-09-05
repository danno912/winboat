<template>
    <div>
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

        <!-- Create Group Dialog -->
        <dialog v-if="showCreateGroupDialog" @click.self="showCreateGroupDialog = false" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div @click.stop class="p-6 bg-neutral-900 rounded-xl border border-neutral-700 w-96">
                <h3 class="mb-4 text-lg font-semibold">Manage Groups</h3>
                
                <!-- Create new group -->
                <div class="mb-4">
                    <h4 class="mb-2 text-sm text-neutral-300">Create New Group</h4>
                    <div class="flex gap-2">
                        <x-input
                            type="text"
                            class="!max-w-full flex-1"
                            v-model="newGroupName"
                            placeholder="Group name"
                            @keyup.enter="handleCreateGroup"
                        >
                            <x-label>Group Name</x-label>
                        </x-input>
                        <x-button @click="handleCreateGroup" :disabled="!newGroupName.trim()">
                            <x-label>Add</x-label>
                        </x-button>
                    </div>
                </div>

                <!-- Existing groups -->
                <div v-if="appGroups.length > 0" class="mb-4">
                    <h4 class="mb-2 text-sm text-neutral-300">Existing Groups</h4>
                    <div class="space-y-2 max-h-32 overflow-y-auto">
                        <div v-for="group in appGroups" :key="group.id" 
                             class="flex items-center justify-between p-2 bg-neutral-800 rounded text-sm">
                            <div class="flex items-center gap-2">
                                <Icon class="size-3" icon="mdi:folder"></Icon>
                                <span>{{ group.name }}</span>
                                <span class="text-xs text-neutral-400">
                                    ({{ getAppsInGroupCount(group.id) }} apps)
                                </span>
                            </div>
                            <x-button @click="handleDeleteGroup(group.id)" class="!p-1 !min-w-0 text-red-400 hover:bg-red-900/20">
                                <Icon class="size-3" icon="mdi:trash-can"></Icon>
                            </x-button>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <x-button @click="showCreateGroupDialog = false">
                        <x-label>Close</x-label>
                    </x-button>
                </div>
            </div>
        </dialog>

        <!-- Desktop Integration Cleanup Dialog -->
        <dialog ref="cleanupDialog">
            <h3 class="mb-2">Desktop Integration Cleanup</h3>
            <p class="mb-4 max-w-[40vw]">This will remove all Windows apps from your Linux start menu. The apps will still be available in WinBoat, but they won't appear as native Linux applications anymore.</p>
            
            <div v-if="cleanupStatus" class="mb-4 p-3 rounded bg-neutral-800 border">
                <h4 class="text-sm font-semibold mb-2">Cleanup Results:</h4>
                <ul class="text-sm space-y-1">
                    <li class="text-green-400">✓ Removed {{ cleanupStatus.desktopEntries.removed }} desktop entries</li>
                    <li v-if="cleanupStatus.desktopEntries.errors.length > 0" class="text-yellow-400">
                        ⚠ {{ cleanupStatus.desktopEntries.errors.length }} errors occurred
                    </li>
                </ul>
                <p class="text-xs text-neutral-400 mt-2">{{ cleanupStatus.summary }}</p>
            </div>

            <div class="flex gap-2 justify-end">
                <x-button @click="cleanupDialog!.close()">
                    <x-label>Cancel</x-label>
                </x-button>
                <x-button v-if="!cleanupStatus" @click="performDesktopCleanup()" class="bg-red-600 hover:bg-red-700">
                    <x-label>Remove All Desktop Entries</x-label>
                </x-button>
                <x-button v-else @click="cleanupDialog!.close(); cleanupStatus = null" class="bg-green-600 hover:bg-green-700">
                    <x-label>Done</x-label>
                </x-button>
            </div>
        </dialog>
        
        <div class="flex flex-col gap-3 mb-6">
            <x-label class="text-neutral-300">Apps</x-label>
            <div class="flex flex-row gap-2 flex-wrap items-center">
                <!-- custom app plus btn -->
                <x-button
                    class="flex flex-row gap-1 items-center"
                    @click="addCustomAppDialog!.showModal()"
                >
                    <x-icon href="#add" class="qualifier"></x-icon>
                    <x-label class="qualifier">Add Custom</x-label>
                </x-button>
                 
                <x-select @change="(e: any) => sortBy = e.detail.newValue">
                    <x-menu class="">
                        <x-menuitem value="name" toggled>
                            <x-icon href="#sort" class="qualifier"></x-icon>
                            <x-label>
                                <span class="qualifier">
                                    Sort By:
                                </span>
                                Name</x-label>
                        </x-menuitem>
                        <x-menuitem value="usage">
                            <x-icon href="#sort" class="qualifier"></x-icon>
                            <x-label>
                                <span class="qualifier">
                                    Sort By:
                                </span>
                                Usage
                            </x-label>
                        </x-menuitem>
                        <x-menuitem value="hidden">
                            <x-icon href="#sort" class="qualifier"></x-icon>
                            <x-label>
                                <span class="qualifier">
                                    Sort By:
                                </span>
                                Hidden Status
                            </x-label>
                        </x-menuitem>
                        <x-menuitem value="group">
                            <x-icon href="#sort" class="qualifier"></x-icon>
                            <x-label>
                                <span class="qualifier">
                                    Sort By:
                                </span>
                                Group
                            </x-label>
                        </x-menuitem>
                    </x-menu>
                </x-select>
                <x-input
                    id="search-term"
                    class="m-0 w-64 max-w-64"
                    type="text"
                    maxlength="32"
                    :value="searchInput"
                    @input="(e: any) => searchInput = e.target.value"
                >
                    <x-icon href="#search"></x-icon>
                    <x-label>Search</x-label>
                </x-input>

                <!-- View Mode Toggle -->
                <x-button @click="viewMode = viewMode === 'list' ? 'groups' : 'list'" 
                         :class="{ 'toggled': viewMode === 'groups' }"
                         v-if="appGroups.length > 0">
                    <x-icon href="#view-list" class="qualifier"></x-icon>
                    <x-label class="qualifier">{{ viewMode === 'list' ? 'Group View' : 'List View' }}</x-label>
                </x-button>

                <!-- Show/Hide toggle -->
                <x-button @click="showHiddenApps = !showHiddenApps" :class="{ 'toggled': showHiddenApps }">
                    <x-icon href="#visibility" class="qualifier"></x-icon>
                    <x-label class="qualifier">{{ showHiddenApps ? 'Hide Hidden' : 'Show Hidden' }}</x-label>
                </x-button>

                <!-- Create Group button -->
                <x-button @click="showCreateGroupDialog = true">
                    <x-icon href="#add" class="qualifier"></x-icon>
                    <x-label class="qualifier">Create Group</x-label>
                </x-button>

                <!-- Desktop Cleanup button -->
                <x-button v-if="desktopIntegratedApps.size > 0" @click="cleanupDialog!.showModal()" class="bg-orange-600 hover:bg-orange-700">
                    <x-icon href="#delete" class="qualifier"></x-icon>
                    <x-label class="qualifier">Clean Desktop</x-label>
                </x-button>

                <!-- Groups info -->
                <div v-if="appGroups.length > 0" class="flex items-center gap-1 text-xs text-neutral-400">
                    <Icon class="size-3" icon="mdi:folder"></Icon>
                    <span>{{ appGroups.length }} group{{ appGroups.length !== 1 ? 's' : '' }}</span>
                </div>
                
                <!-- Desktop integration info -->
                <div v-if="desktopIntegratedApps.size > 0" class="flex items-center gap-1 text-xs text-neutral-400">
                    <Icon class="size-3" icon="mdi:menu"></Icon>
                    <span>{{ desktopIntegratedApps.size }} in start menu</span>
                </div>
            </div>
        </div>
        <div v-if="winboat.isOnline.value" class="px-2">
            <!-- List View -->
            <TransitionGroup v-if="apps.length && viewMode === 'list'" name="apps" tag="x-card" class="grid gap-4 bg-transparent border-none app-grid">
                <x-card
                    v-for="app of computedApps" :key="app.Path"
                    class="flex relative flex-row gap-2 justify-between items-center p-2 my-0 backdrop-blur-xl backdrop-brightness-150 cursor-pointer generic-hover bg-neutral-800/20"
                    :class="{ 
                        'bg-gradient-to-r from-yellow-600/20 bg-neutral-800/20': app.Source === 'custom',
                        'bg-red-900/20 border border-red-500/50': app.Hidden && showHiddenApps
                    }"
                    @click="winboat.launchApp(app)"
                >
                    <div class="flex flex-row items-center gap-2 w-[85%]">
                        <div class="relative">
                            <img class="rounded-md size-10" :src="`data:image/png;charset=utf-8;base64,${app.Icon}`" :class="{ 'grayscale': app.Hidden && showHiddenApps }"></img>
                            <Icon v-if="app.Hidden && showHiddenApps" class="absolute -top-1 -right-1 size-4 text-red-400 bg-neutral-900 rounded-full" icon="mdi:eye-off"></Icon>
                            <Icon v-if="app.GroupId && !app.Hidden" class="absolute -bottom-1 -right-1 size-3 text-blue-400 bg-neutral-900 rounded-full" icon="mdi:folder"></Icon>
                        </div>
                        <div class="flex flex-col">
                            <x-label class="truncate text-ellipsis" :class="{ 'text-red-300': app.Hidden && showHiddenApps }">{{ app.Name }}</x-label>
                            <x-label v-if="app.GroupId" class="text-xs truncate" :class="app.Hidden && showHiddenApps ? 'text-red-200' : 'text-blue-300'">{{ getGroupName(app.GroupId) }}</x-label>
                        </div>
                    </div>
                    <Icon icon="cuida:caret-right-outline"></Icon>
                    <WBContextMenu>
                        <!-- Always show hide/show option -->
                        <WBMenuItem @click.stop="toggleAppVisibility(app)">
                            <Icon class="size-4" :icon="app.Hidden ? 'mdi:eye' : 'mdi:eye-off'"></Icon>
                            <x-label>{{ app.Hidden ? 'Show App' : 'Hide App' }}</x-label>
                        </WBMenuItem>
                        
                        <!-- Group management options -->
                        <template v-if="appGroups.length > 0">
                            <WBMenuItem v-if="app.GroupId" @click.stop="assignAppToGroup(app, null)">
                                <Icon class="size-4" icon="mdi:folder-remove"></Icon>
                                <x-label>Remove from Group</x-label>
                            </WBMenuItem>
                            <WBMenuItem v-for="group in appGroups" :key="`add-${group.id}`" 
                                       v-show="app.GroupId !== group.id"
                                       @click.stop="assignAppToGroup(app, group.id)">
                                <Icon class="size-4" icon="mdi:folder-plus"></Icon>
                                <x-label>Add to {{ group.name }}</x-label>
                            </WBMenuItem>
                        </template>
                        
                        <!-- Desktop integration -->
                        <WBMenuItem @click.stop="toggleDesktopIntegration(app)">
                            <Icon class="size-4" :icon="isAppIntegrated(app) ? 'mdi:menu-open' : 'mdi:menu-plus'"></Icon>
                            <x-label>{{ isAppIntegrated(app) ? 'Remove from Start Menu' : 'Add to Start Menu' }}</x-label>
                        </WBMenuItem>
                        
                        <!-- Custom app removal -->
                        <WBMenuItem v-if="app.Source === 'custom'" @click.stop="removeCustomApp(app)">
                            <Icon class="size-4" icon="mdi:trash-can"></Icon>
                            <x-label>Remove Custom App</x-label>
                        </WBMenuItem>
                    </WBContextMenu>
                </x-card>
            </TransitionGroup>

            <!-- Group View -->
            <div v-if="apps.length && viewMode === 'groups'" class="space-y-6">
                <!-- Groups -->
                <div v-for="[groupId, groupData] in groupedApps.sortedGroups" :key="groupId" class="space-y-2">
                    <div class="flex items-center gap-2 px-2">
                        <Icon class="size-4 text-blue-400" icon="mdi:folder"></Icon>
                        <h3 class="text-lg font-semibold text-blue-300">{{ groupData.group.name }}</h3>
                        <span class="text-sm text-neutral-400">({{ groupData.apps.length }} apps)</span>
                    </div>
                    <x-card class="grid gap-3 p-4 bg-transparent border border-blue-500/20 app-grid">
                        <x-card
                            v-for="app of groupData.apps" :key="app.Path"
                            class="flex relative flex-row gap-2 justify-between items-center p-2 my-0 backdrop-blur-xl backdrop-brightness-150 cursor-pointer generic-hover bg-neutral-800/20"
                            :class="{ 
                                'bg-gradient-to-r from-yellow-600/20 bg-neutral-800/20': app.Source === 'custom',
                                'bg-red-900/20 border border-red-500/50': app.Hidden && showHiddenApps
                            }"
                            @click="winboat.launchApp(app)"
                        >
                            <div class="flex flex-row items-center gap-2 w-[85%]">
                                <div class="relative">
                                    <img class="rounded-md size-10" :src="`data:image/png;charset=utf-8;base64,${app.Icon}`" :class="{ 'grayscale': app.Hidden && showHiddenApps }"></img>
                                    <Icon v-if="app.Hidden && showHiddenApps" class="absolute -top-1 -right-1 size-4 text-red-400 bg-neutral-900 rounded-full" icon="mdi:eye-off"></Icon>
                                </div>
                                <x-label class="truncate text-ellipsis" :class="{ 'text-red-300': app.Hidden && showHiddenApps }">{{ app.Name }}</x-label>
                            </div>
                            <Icon icon="cuida:caret-right-outline"></Icon>
                            <WBContextMenu>
                                <!-- Always show hide/show option -->
                                <WBMenuItem @click.stop="toggleAppVisibility(app)">
                                    <Icon class="size-4" :icon="app.Hidden ? 'mdi:eye' : 'mdi:eye-off'"></Icon>
                                    <x-label>{{ app.Hidden ? 'Show App' : 'Hide App' }}</x-label>
                                </WBMenuItem>
                                
                                <!-- Group management options -->
                                <template v-if="appGroups.length > 0">
                                    <WBMenuItem v-if="app.GroupId" @click.stop="assignAppToGroup(app, null)">
                                        <Icon class="size-4" icon="mdi:folder-remove"></Icon>
                                        <x-label>Remove from Group</x-label>
                                    </WBMenuItem>
                                    <WBMenuItem v-for="group in appGroups" :key="`add-${group.id}`" 
                                               v-show="app.GroupId !== group.id"
                                               @click.stop="assignAppToGroup(app, group.id)">
                                        <Icon class="size-4" icon="mdi:folder-plus"></Icon>
                                        <x-label>Add to {{ group.name }}</x-label>
                                    </WBMenuItem>
                                </template>
                                
                                <!-- Desktop integration -->
                                <WBMenuItem @click.stop="toggleDesktopIntegration(app)">
                                    <Icon class="size-4" :icon="isAppIntegrated(app) ? 'mdi:menu-open' : 'mdi:menu-plus'"></Icon>
                                    <x-label>{{ isAppIntegrated(app) ? 'Remove from Start Menu' : 'Add to Start Menu' }}</x-label>
                                </WBMenuItem>
                                
                                <!-- Custom app removal -->
                                <WBMenuItem v-if="app.Source === 'custom'" @click.stop="removeCustomApp(app)">
                                    <Icon class="size-4" icon="mdi:trash-can"></Icon>
                                    <x-label>Remove Custom App</x-label>
                                </WBMenuItem>
                            </WBContextMenu>
                        </x-card>
                    </x-card>
                </div>

                <!-- Ungrouped Apps -->
                <div v-if="groupedApps.ungrouped.length > 0" class="space-y-2">
                    <div class="flex items-center gap-2 px-2">
                        <Icon class="size-4 text-neutral-400" icon="mdi:folder-outline"></Icon>
                        <h3 class="text-lg font-semibold text-neutral-300">Ungrouped</h3>
                        <span class="text-sm text-neutral-400">({{ groupedApps.ungrouped.length }} apps)</span>
                    </div>
                    <x-card class="grid gap-3 p-4 bg-transparent border border-neutral-500/20 app-grid">
                        <x-card
                            v-for="app of groupedApps.ungrouped" :key="app.Path"
                            class="flex relative flex-row gap-2 justify-between items-center p-2 my-0 backdrop-blur-xl backdrop-brightness-150 cursor-pointer generic-hover bg-neutral-800/20"
                            :class="{ 
                                'bg-gradient-to-r from-yellow-600/20 bg-neutral-800/20': app.Source === 'custom',
                                'bg-red-900/20 border border-red-500/50': app.Hidden && showHiddenApps
                            }"
                            @click="winboat.launchApp(app)"
                        >
                            <div class="flex flex-row items-center gap-2 w-[85%]">
                                <div class="relative">
                                    <img class="rounded-md size-10" :src="`data:image/png;charset=utf-8;base64,${app.Icon}`" :class="{ 'grayscale': app.Hidden && showHiddenApps }"></img>
                                    <Icon v-if="app.Hidden && showHiddenApps" class="absolute -top-1 -right-1 size-4 text-red-400 bg-neutral-900 rounded-full" icon="mdi:eye-off"></Icon>
                                </div>
                                <x-label class="truncate text-ellipsis" :class="{ 'text-red-300': app.Hidden && showHiddenApps }">{{ app.Name }}</x-label>
                            </div>
                            <Icon icon="cuida:caret-right-outline"></Icon>
                            <WBContextMenu>
                                <!-- Always show hide/show option -->
                                <WBMenuItem @click.stop="toggleAppVisibility(app)">
                                    <Icon class="size-4" :icon="app.Hidden ? 'mdi:eye' : 'mdi:eye-off'"></Icon>
                                    <x-label>{{ app.Hidden ? 'Show App' : 'Hide App' }}</x-label>
                                </WBMenuItem>
                                
                                <!-- Group management options -->
                                <template v-if="appGroups.length > 0">
                                    <WBMenuItem v-for="group in appGroups" :key="`add-${group.id}`" 
                                               @click.stop="assignAppToGroup(app, group.id)">
                                        <Icon class="size-4" icon="mdi:folder-plus"></Icon>
                                        <x-label>Add to {{ group.name }}</x-label>
                                    </WBMenuItem>
                                </template>
                                
                                <!-- Desktop integration -->
                                <WBMenuItem @click.stop="toggleDesktopIntegration(app)">
                                    <Icon class="size-4" :icon="isAppIntegrated(app) ? 'mdi:menu-open' : 'mdi:menu-plus'"></Icon>
                                    <x-label>{{ isAppIntegrated(app) ? 'Remove from Start Menu' : 'Add to Start Menu' }}</x-label>
                                </WBMenuItem>
                                
                                <!-- Custom app removal -->
                                <WBMenuItem v-if="app.Source === 'custom'" @click.stop="removeCustomApp(app)">
                                    <Icon class="size-4" icon="mdi:trash-can"></Icon>
                                    <x-label>Remove Custom App</x-label>
                                </WBMenuItem>
                            </WBContextMenu>
                        </x-card>
                    </x-card>
                </div>
            </div>
            <!-- Loading spinner only when no apps are loaded yet -->
            <div v-if="!apps.length" class="flex justify-center items-center mt-40">
                <x-throbber class="w-16 h-16"></x-throbber>
            </div>
        </div>
        <div v-else class="px-2 mt-32">
            <div class="flex flex-col gap-4 justify-center items-center">
                <Icon class="text-violet-400 size-32" icon="fluent-mdl2:plug-disconnected"></Icon>
                <h1
                    class="text-xl font-semibold w-[30vw] text-center leading-16"
                >
                    <span v-if="winboat.containerStatus.value === ContainerStatus.Exited || winboat.containerStatus.value === ContainerStatus.Dead">
                        The WinBoat Container is not running, please start it to view your apps list.
                    </span>
                    <span v-else>
                        The WinBoat Guest API is not running, please restart the container. If this problem persists, contact customer support.
                    </span>
                </h1>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { ContainerStatus, Winboat } from '../lib/winboat';
import { type WinApp } from '../../types';
import WBContextMenu from '../components/WBContextMenu.vue';
import WBMenuItem from '../components/WBMenuItem.vue';
import { AppIcons, DEFAULT_ICON } from '../data/appicons';
import { WINBOAT_GUEST_API } from '../lib/constants';
import { debounce } from '../utils/debounce';
import { Jimp, JimpMime } from 'jimp';
import { DesktopIntegration } from '../utils/desktopIntegration';
const nodeFetch: typeof import('node-fetch').default = require('node-fetch');
const FormData: typeof import('form-data') = require('form-data');

const winboat = new Winboat();
const apps = ref<WinApp[]>([]);
const searchInput = ref('');
const sortBy = ref('');
const addCustomAppDialog = useTemplateRef('addCustomAppDialog');
const cleanupDialog = useTemplateRef('cleanupDialog');
const customAppName = ref('');
const customAppPath = ref('');
const customAppIcon = ref(`data:image/png;base64,${AppIcons[DEFAULT_ICON]}`);

// New state for visibility and grouping
const showHiddenApps = ref(false);
const viewMode = ref<'list' | 'groups'>('list');
const selectedGroupId = ref<string | null>(null);
const appGroups = ref<any[]>([]);
const showCreateGroupDialog = ref(false);
const newGroupName = ref('');
const selectedAppsForGroup = ref<string[]>([]);

// Desktop integration state
const desktopIntegratedApps = ref<Set<string>>(new Set());
const cleanupStatus = ref<any>(null);

const computedApps = computed(() => {
    // Ensure we have fresh data
    const currentApps = [...apps.value];
    const currentGroups = [...appGroups.value];
    
    // Filter by visibility
    let filteredApps = currentApps;
    if (!showHiddenApps.value) {
        filteredApps = filteredApps.filter(app => !app.Hidden);
    }
    
    // Filter by search input
    if (searchInput.value && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filteredApps = filteredApps.filter(app => 
            app.Name.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort apps
    return filteredApps.sort((a, b) => { 
        const sortType = sortBy.value;
        
        if (sortType === 'usage' && a.Usage !== b.Usage) {
            return (b.Usage || 0) - (a.Usage || 0);
        }
        
        if (sortType === 'hidden') {
            // Sort by hidden status: visible apps first, then hidden apps
            if (a.Hidden !== b.Hidden) {
                return a.Hidden ? 1 : -1;
            }
        }
        
        if (sortType === 'group') {
            // Sort by group: grouped apps first (by group name), then ungrouped apps last
            const aHasGroup = !!a.GroupId;
            const bHasGroup = !!b.GroupId;
            
            if (aHasGroup && !bHasGroup) return -1; // a is grouped, b is not -> a comes first
            if (!aHasGroup && bHasGroup) return 1;  // a is not grouped, b is -> b comes first
            
            if (aHasGroup && bHasGroup) {
                // Both are grouped, sort by group name
                const aGroupName = currentGroups.find(g => g.id === a.GroupId)?.name || '';
                const bGroupName = currentGroups.find(g => g.id === b.GroupId)?.name || '';
                const groupComparison = aGroupName.localeCompare(bGroupName);
                if (groupComparison !== 0) return groupComparison;
            }
            // If same group status or same group, fall through to name sorting
        }
        
        // Default: sort by name
        return a.Name.localeCompare(b.Name);
    });
})

// Grouped view computed properties
const groupedApps = computed(() => {
    const currentApps = [...apps.value];
    const currentGroups = [...appGroups.value];
    
    // Apply visibility filter
    let filteredApps = currentApps;
    if (!showHiddenApps.value) {
        filteredApps = filteredApps.filter(app => !app.Hidden);
    }
    
    // Apply search filter
    if (searchInput.value && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filteredApps = filteredApps.filter(app => 
            app.Name.toLowerCase().includes(searchTerm)
        );
    }
    
    // Group apps by their GroupId
    const grouped = {
        groups: {} as { [key: string]: { group: any, apps: any[] } },
        ungrouped: [] as any[]
    };
    
    filteredApps.forEach(app => {
        if (app.GroupId) {
            if (!grouped.groups[app.GroupId]) {
                const group = currentGroups.find(g => g.id === app.GroupId);
                if (group) {
                    grouped.groups[app.GroupId] = { group, apps: [] };
                }
            }
            if (grouped.groups[app.GroupId]) {
                grouped.groups[app.GroupId].apps.push(app);
            }
        } else {
            grouped.ungrouped.push(app);
        }
    });
    
    // Sort apps within each group
    Object.keys(grouped.groups).forEach(groupId => {
        grouped.groups[groupId].apps.sort((a, b) => a.Name.localeCompare(b.Name));
    });
    
    // Sort ungrouped apps
    grouped.ungrouped.sort((a, b) => a.Name.localeCompare(b.Name));
    
    // Sort groups by name
    const sortedGroupEntries = Object.entries(grouped.groups).sort(([, a], [, b]) => 
        a.group.name.localeCompare(b.group.name)
    );
    
    return { sortedGroups: sortedGroupEntries, ungrouped: grouped.ungrouped };
});

onMounted(async () => {
    if (winboat.isOnline.value) {
        apps.value = await winboat.appMgr!.getApps();
        appGroups.value = [...getAppGroups()];
        console.log('Initial load - Apps:', apps.value.length, 'Groups:', appGroups.value.length);

        // Check desktop integration status
        refreshDesktopIntegrationStatus();

        // Run in background, won't impact UX
        await winboat.appMgr!.updateAppCache();
        if(winboat.appMgr!.appCache.length > apps.value.length) {
            apps.value = [...winboat!.appMgr!.appCache];
            appGroups.value = [...getAppGroups()];
            // Refresh desktop integration status again after cache update
            refreshDesktopIntegrationStatus();
        }
    }

    watch(winboat.isOnline, async (newVal, _) => {
        if (newVal) {
            apps.value = await winboat.appMgr!.getApps();
            appGroups.value = [...getAppGroups()];
            console.log("Connection restored - Apps:", apps.value.length, "Groups:", appGroups.value.length);
        }
    })

    // Fetch icon for custom app path
    watch(customAppPath, async (newVal, oldVal) => {
        await debouncedFetchIcon(newVal, oldVal);
    })
})

const debouncedFetchIcon = debounce(async (newVal: string, oldVal: string) => {            
    if (newVal !== oldVal && newVal !== '') {
        const formData = new FormData();
        formData.append('path', newVal);
        const iconRes = await nodeFetch(`${WINBOAT_GUEST_API}/get-icon`, {
            method: 'POST',
            body: formData as any
        });
        const icon = await iconRes.text();
        customAppIcon.value = `data:image/png;base64,${icon}`;
        console.log(`Custom app icon fetched for ${newVal}:`, customAppIcon.value);
    }
}, 500)

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
})

/**
 * Triggers the file picker for the custom app icon, then processes the image selected
 */
function pickCustomAppIcon() {
    const filePicker = document.createElement('input');
    filePicker.type = 'file';
    filePicker.accept = 'image/*';
    filePicker.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if(!file) {
            console.log("No file selected");
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

/**
 * Cancels the add custom app dialog and resets the form
 */
function cancelAddCustomApp() {
    addCustomAppDialog.value!.close();
    resetCustomAppForm();
}

/**
 * Adds a custom app to WinBoat's application list
 */
async function addCustomApp() {
    const iconRaw = customAppIcon.value.split('data:image/png;base64,')[1];
    await winboat.appMgr!.addCustomApp(customAppName.value, customAppPath.value, iconRaw);
    apps.value = await winboat.appMgr!.getApps();
    addCustomAppDialog.value!.close();
    resetCustomAppForm();
}

/**
 * Removes a custom app from WinBoat's application list
 */
async function removeCustomApp(app: WinApp) {
    await winboat.appMgr!.removeCustomApp(app);
    apps.value = await winboat.appMgr!.getApps();
}

/**
 * Toggle app visibility (hide/show)
 */
async function toggleAppVisibility(app: WinApp) {
    const newHiddenState = winboat.appMgr!.toggleAppVisibility(app);
    
    // Update the app in the reactive array immediately
    const appIndex = apps.value.findIndex(a => a.Path === app.Path);
    if (appIndex !== -1) {
        apps.value[appIndex].Hidden = newHiddenState;
        // Force reactivity update
        apps.value = [...apps.value];
    }
}

/**
 * Create a new app group
 */
async function createAppGroup(name: string, options?: { icon?: string; color?: string }) {
    const group = winboat.appMgr!.createAppGroup(name, options);
    return group;
}

/**
 * Delete an app group
 */
async function deleteAppGroup(groupId: string) {
    const success = winboat.appMgr!.deleteAppGroup(groupId);
    if (success) {
        apps.value = await winboat.appMgr!.getApps();
    }
    return success;
}

/**
 * Assign app to group
 */
async function assignAppToGroup(app: WinApp, groupId: string | null) {
    try {
        winboat.appMgr!.assignAppToGroup(app, groupId);
        
        // Update the specific app in the reactive array immediately
        const appIndex = apps.value.findIndex(a => a.Path === app.Path);
        if (appIndex !== -1) {
            apps.value[appIndex].GroupId = groupId;
        }
        
        // Force reactivity update
        apps.value = [...apps.value];
    } catch (error) {
        console.error('Failed to assign app to group:', error);
    }
}

/**
 * Get available app groups
 */
function getAppGroups() {
    return winboat.appMgr!.getAppGroups();
}

/**
 * Handle creating a new group
 */
async function handleCreateGroup() {
    if (!newGroupName.value.trim()) return;
    
    try {
        const group = await createAppGroup(newGroupName.value.trim());
        // Force reactive update of groups
        appGroups.value = [...getAppGroups()];
        newGroupName.value = '';
        console.log('Group created:', group, 'Total groups:', appGroups.value.length);
    } catch (error) {
        console.error('Failed to create group:', error);
    }
}

/**
 * Get group name by ID
 */
function getGroupName(groupId: string): string {
    const group = appGroups.value.find(g => g.id === groupId);
    return group ? group.name : 'Unknown Group';
}

/**
 * Get count of apps in a group
 */
function getAppsInGroupCount(groupId: string): number {
    return apps.value.filter(app => app.GroupId === groupId).length;
}

/**
 * Handle deleting a group
 */
async function handleDeleteGroup(groupId: string) {
    try {
        const success = await deleteAppGroup(groupId);
        if (success) {
            // Force reactive update of groups
            appGroups.value = [...getAppGroups()];
            // Also refresh apps to update GroupId properties
            apps.value = [...await winboat.appMgr!.getApps()];
            console.log('Group deleted, remaining groups:', appGroups.value.length);
        }
    } catch (error) {
        console.error('Failed to delete group:', error);
    }
}

/**
 * Resets the custom app form to its default values
 */
async function resetCustomAppForm() {
    // So there is no visual flicker while the dialog is closing
    setTimeout(() => {
        customAppName.value = '';
        customAppPath.value = '';
        customAppIcon.value = `data:image/png;base64,${AppIcons[DEFAULT_ICON]}`;
    
        // Because of course Vue reactivity fails here :(
        addCustomAppDialog.value?.querySelectorAll('x-input')?.forEach((input: any) => {
            input.value = '';
        });
    }, 100)
}

/**
 * Desktop Integration Functions
 */

/**
 * Check if an app is integrated to the desktop (has a .desktop file)
 */
function isAppIntegrated(app: WinApp): boolean {
    return desktopIntegratedApps.value.has(app.Path);
}

/**
 * Add app to Linux start menu
 */
async function addToStartMenu(app: WinApp) {
    try {
        const success = await DesktopIntegration.createDesktopEntry(app);
        if (success) {
            desktopIntegratedApps.value.add(app.Path);
            console.log(`Successfully added ${app.Name} to start menu`);
        } else {
            console.error(`Failed to add ${app.Name} to start menu`);
        }
    } catch (error) {
        console.error(`Error adding ${app.Name} to start menu:`, error);
    }
}

/**
 * Remove app from Linux start menu
 */
async function removeFromStartMenu(app: WinApp) {
    try {
        const success = await DesktopIntegration.removeDesktopEntry(app);
        if (success) {
            desktopIntegratedApps.value.delete(app.Path);
            console.log(`Successfully removed ${app.Name} from start menu`);
        } else {
            console.error(`Failed to remove ${app.Name} from start menu`);
        }
    } catch (error) {
        console.error(`Error removing ${app.Name} from start menu:`, error);
    }
}

/**
 * Toggle desktop integration for an app
 */
async function toggleDesktopIntegration(app: WinApp) {
    if (isAppIntegrated(app)) {
        await removeFromStartMenu(app);
    } else {
        await addToStartMenu(app);
    }
}

/**
 * Refresh desktop integration status for all apps
 */
function refreshDesktopIntegrationStatus() {
    const integratedApps = new Set<string>();
    
    // Check each app to see if it has a desktop entry
    apps.value.forEach(app => {
        if (DesktopIntegration.hasDesktopEntry(app)) {
            integratedApps.add(app.Path);
        }
    });
    
    desktopIntegratedApps.value = integratedApps;
}

/**
 * Perform system cleanup to remove all desktop integration
 */
async function performDesktopCleanup() {
    try {
        console.log('Starting desktop cleanup...');
        const result = await DesktopIntegration.performSystemCleanup();
        
        // Update UI state
        cleanupStatus.value = result;
        desktopIntegratedApps.value.clear();
        
        console.log('Desktop cleanup completed:', result.summary);
    } catch (error) {
        console.error('Desktop cleanup failed:', error);
        cleanupStatus.value = {
            desktopEntries: { removed: 0, errors: [`Cleanup failed: ${error}`] },
            summary: 'Cleanup failed with errors'
        };
    }
}
</script>

<style scoped>
.app-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

x-menu .qualifier {
    display: none;
}

x-menu 

.apps-move, /* apply transition to moving elements */
.apps-enter-active,
.apps-leave-active {
  transition: all 0.5s ease;
}

.apps-enter-from,
.apps-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* ensure leaving items are taken out of layout flow so that moving
   animations can be calculated correctly. */
.apps-leave-active {
  position: absolute;
}
</style>