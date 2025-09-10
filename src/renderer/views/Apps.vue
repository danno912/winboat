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

        
        <div
            class="flex flex-col gap-4 mb-6"
            :class="{
                'opacity-50 pointer-events-none':
                    winboat.containerStatus.value !== ContainerStatus.Running ||
                    !winboat.isOnline.value
            }"
        >
            <x-label class="text-neutral-300">Apps</x-label>
            <div class="flex flex-wrap gap-2 items-center justify-start">
                <!-- Refresh button -->
                <x-button
                    class="flex flex-row gap-1 items-center flex-shrink-0"
                    @click="refreshApps"
                >
                    <Icon icon="mdi:refresh" class="size-4"></Icon>
                    <x-label>Refresh</x-label>
                </x-button>

                <!-- Custom App Add Button -->
                <x-button
                    class="flex flex-row gap-1 items-center flex-shrink-0"
                    @click="addCustomAppDialog!.showModal()"
                >
                    <x-icon href="#add" class="qualifier"></x-icon>
                    <x-label class="qualifier">Add Custom</x-label>
                </x-button>
                 
                <!-- Sort By -->
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


                <!-- Search Input -->
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

                <!-- Group Filter -->  
                <div v-if="appGroups.length > 0" class="relative">
                    <button 
                        @click="showGroupFilter = !showGroupFilter"
                        class="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-md text-white text-sm focus:outline-none focus:border-violet-400 flex items-center gap-2">
                        <span>{{ groupFilterLabel }}</span>
                        <Icon class="size-4" :icon="showGroupFilter ? 'mdi:chevron-up' : 'mdi:chevron-down'"></Icon>
                    </button>
                    
                    <div v-if="showGroupFilter" 
                         class="absolute top-full left-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-md shadow-lg z-10 min-w-48">
                        <div class="p-2 space-y-2">
                            <label class="flex items-center gap-2 hover:bg-neutral-700 px-2 py-1 rounded cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    v-model="selectedGroupFilters.showUngrouped"
                                    class="rounded border-neutral-600">
                                <span class="text-sm">Ungrouped Apps</span>
                            </label>
                            <div v-for="group in appGroups" :key="group.id">
                                <label class="flex items-center gap-2 hover:bg-neutral-700 px-2 py-1 rounded cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        v-model="selectedGroupFilters.groups"
                                        :value="group.id"
                                        class="rounded border-neutral-600">
                                    <span class="text-sm">{{ group.name }}</span>
                                </label>
                            </div>
                            <div class="border-t border-neutral-600 pt-2 mt-2">
                                <button 
                                    @click="clearGroupFilters"
                                    class="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-neutral-700 w-full text-left">
                                    Clear All Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- View Mode Toggle -->
                <x-button @click="viewMode = viewMode === 'list' ? 'groups' : 'list'" 
                         :class="{ 'toggled': viewMode === 'groups' }"
                         v-if="appGroups.length > 0"
                         class="flex-shrink-0">
                    <x-icon href="#view-list" class="qualifier"></x-icon>
                    <x-label class="qualifier">{{ viewMode === 'list' ? 'Group View' : 'List View' }}</x-label>
                </x-button>

                <!-- Show/Hide toggle -->
                <x-button @click="showHiddenApps = !showHiddenApps" :class="{ 'toggled': showHiddenApps }" class="flex-shrink-0">
                    <x-icon href="#visibility" class="qualifier"></x-icon>
                    <x-label class="qualifier">{{ showHiddenApps ? 'Hide Hidden' : 'Show Hidden' }}</x-label>
                </x-button>

                <!-- Create Group button -->
                <x-button @click="showCreateGroupDialog = true" class="flex-shrink-0">
                    <x-icon href="#add" class="qualifier"></x-icon>
                    <x-label class="qualifier">Create Group</x-label>
                </x-button>

                <!-- Desktop Integration Cleanup button -->
                <x-button v-if="isDesktopIntegrationReady" @click="cleanupDesktopIntegration" class="text-orange-400 hover:text-orange-300 flex-shrink-0">
                    <x-icon href="#clean" class="qualifier"></x-icon>
                    <x-label class="qualifier">Clean Start Menu</x-label>
                </x-button>


                <!-- Groups info -->
                <div v-if="appGroups.length > 0" class="flex items-center gap-1 text-xs text-neutral-400">
                    <Icon class="size-3" icon="mdi:folder"></Icon>
                    <span>{{ appGroups.length }} group{{ appGroups.length !== 1 ? 's' : '' }}</span>
                </div>

                <!-- Desktop Integration info -->
                <div v-if="isDesktopIntegrationReady && apps.length > 0" class="flex items-center gap-1 text-xs text-neutral-400">
                    <Icon class="size-3" icon="mdi:monitor"></Icon>
                    <span>{{ Array.from(integrationStatus.values()).filter(s => s.isIntegrated).length }} integrated</span>
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
                        'opacity-50 bg-red-900/10 border border-red-500/30': app.Hidden && showHiddenApps
                    }"
                    @click="winboat.launchApp(app)"
                >
                    <div class="flex flex-row items-center gap-2 w-[85%]">
                        <div class="relative">
                            <img class="rounded-md size-10" :src="`data:image/png;charset=utf-8;base64,${app.Icon}`" :class="{ 'grayscale': app.Hidden && showHiddenApps }"></img>
                            <Icon v-if="app.Hidden && showHiddenApps" class="absolute -top-1 -right-1 size-4 text-red-400 bg-neutral-900 rounded-full" icon="mdi:eye-off"></Icon>
                            <Icon v-if="app.GroupId && !app.Hidden" class="absolute -bottom-1 -right-1 size-3 text-blue-400 bg-neutral-900 rounded-full" icon="mdi:folder"></Icon>
                            <Icon v-if="integrationStatus.get(app.Path)?.isIntegrated && !app.Hidden" class="absolute -top-1 -left-1 size-3 text-green-400 bg-neutral-900 rounded-full" icon="mdi:monitor"></Icon>
                        </div>
                        <div class="flex flex-col">
                            <x-label class="truncate text-ellipsis" :class="{ 'text-neutral-500 line-through': app.Hidden && showHiddenApps }">{{ app.Name }}</x-label>
                            <x-label v-if="app.GroupId" class="text-xs text-blue-300 truncate">{{ getGroupName(app.GroupId) }}</x-label>
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
                            
                            <!-- Desktop Integration -->
                            <WBMenuItem v-if="isDesktopIntegrationReady" @click.stop="toggleDesktopIntegration(app)">
                                <Icon class="size-4" :icon="integrationStatus.get(app.Path)?.isIntegrated ? 'mdi:monitor-off' : 'mdi:monitor-share'"></Icon>
                                <x-label>{{ integrationStatus.get(app.Path)?.isIntegrated ? 'Remove from Start Menu' : 'Add to Start Menu' }}</x-label>
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
                    <!-- Grouped Apps -->
                    <div v-for="[groupId, groupData] in groupedApps.sortedGroups" :key="groupId" class="space-y-3">
                        <div class="flex items-center gap-3 mb-3">
                            <Icon class="size-5 text-blue-400" icon="mdi:folder"></Icon>
                            <h3 class="text-lg font-semibold text-blue-300">{{ groupData.group.name }}</h3>
                            <span class="text-xs text-neutral-400 bg-neutral-800 px-2 py-1 rounded">{{ groupData.apps.length }} apps</span>
                        </div>
                        <x-card class="grid gap-4 bg-transparent border-none app-grid">
                            <x-card
                                v-for="app in groupData.apps" :key="app.Path"
                                class="flex relative flex-row gap-2 justify-between items-center p-2 my-0 backdrop-blur-xl backdrop-brightness-150 cursor-pointer generic-hover bg-neutral-800/20"
                                :class="{ 
                                    'bg-gradient-to-r from-yellow-600/20 bg-neutral-800/20': app.Source === 'custom',
                                    'opacity-50 bg-red-900/10 border border-red-500/30': app.Hidden && showHiddenApps
                                }"
                                @click="winboat.launchApp(app)"
                            >
                                <div class="flex flex-row items-center gap-2 w-[85%]">
                                    <div class="relative">
                                        <img class="rounded-md size-10" :src="`data:image/png;charset=utf-8;base64,${app.Icon}`" :class="{ 'grayscale': app.Hidden && showHiddenApps }"></img>
                                        <Icon v-if="app.Hidden && showHiddenApps" class="absolute -top-1 -right-1 size-4 text-red-400 bg-neutral-900 rounded-full" icon="mdi:eye-off"></Icon>
                                        <Icon v-if="integrationStatus.get(app.Path)?.isIntegrated && !app.Hidden" class="absolute -top-1 -left-1 size-3 text-green-400 bg-neutral-900 rounded-full" icon="mdi:monitor"></Icon>
                                    </div>
                                    <div class="flex flex-col">
                                        <x-label class="truncate text-ellipsis" :class="{ 'text-neutral-500 line-through': app.Hidden && showHiddenApps }">{{ app.Name }}</x-label>
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
                                    
                                    <!-- Desktop Integration -->
                                    <WBMenuItem v-if="isDesktopIntegrationReady" @click.stop="toggleDesktopIntegration(app)">
                                        <Icon class="size-4" :icon="integrationStatus.get(app.Path)?.isIntegrated ? 'mdi:monitor-off' : 'mdi:monitor-share'"></Icon>
                                        <x-label>{{ integrationStatus.get(app.Path)?.isIntegrated ? 'Remove from Start Menu' : 'Add to Start Menu' }}</x-label>
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
                    <div v-if="groupedApps.ungrouped.length > 0" class="space-y-3">
                        <div class="flex items-center gap-3 mb-3">
                            <Icon class="size-5 text-neutral-400" icon="mdi:folder-open"></Icon>
                            <h3 class="text-lg font-semibold text-neutral-400">Ungrouped</h3>
                            <span class="text-xs text-neutral-400 bg-neutral-800 px-2 py-1 rounded">{{ groupedApps.ungrouped.length }} apps</span>
                        </div>
                        <x-card class="grid gap-4 bg-transparent border-none app-grid">
                            <x-card
                                v-for="app in groupedApps.ungrouped" :key="app.Path"
                                class="flex relative flex-row gap-2 justify-between items-center p-2 my-0 backdrop-blur-xl backdrop-brightness-150 cursor-pointer generic-hover bg-neutral-800/20"
                                :class="{ 
                                    'bg-gradient-to-r from-yellow-600/20 bg-neutral-800/20': app.Source === 'custom',
                                    'opacity-50 bg-red-900/10 border border-red-500/30': app.Hidden && showHiddenApps
                                }"
                                @click="winboat.launchApp(app)"
                            >
                                <div class="flex flex-row items-center gap-2 w-[85%]">
                                    <div class="relative">
                                        <img class="rounded-md size-10" :src="`data:image/png;charset=utf-8;base64,${app.Icon}`" :class="{ 'grayscale': app.Hidden && showHiddenApps }"></img>
                                        <Icon v-if="app.Hidden && showHiddenApps" class="absolute -top-1 -right-1 size-4 text-red-400 bg-neutral-900 rounded-full" icon="mdi:eye-off"></Icon>
                                        <Icon v-if="integrationStatus.get(app.Path)?.isIntegrated && !app.Hidden" class="absolute -top-1 -left-1 size-3 text-green-400 bg-neutral-900 rounded-full" icon="mdi:monitor"></Icon>
                                    </div>
                                    <div class="flex flex-col">
                                        <x-label class="truncate text-ellipsis" :class="{ 'text-neutral-500 line-through': app.Hidden && showHiddenApps }">{{ app.Name }}</x-label>
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
                                        <WBMenuItem v-for="group in appGroups" :key="`add-${group.id}`" 
                                                   @click.stop="assignAppToGroup(app, group.id)">
                                            <Icon class="size-4" icon="mdi:folder-plus"></Icon>
                                            <x-label>Add to {{ group.name }}</x-label>
                                        </WBMenuItem>
                                    </template>
                                    
                                    <!-- Desktop Integration -->
                                    <WBMenuItem v-if="isDesktopIntegrationReady" @click.stop="toggleDesktopIntegration(app)">
                                        <Icon class="size-4" :icon="integrationStatus.get(app.Path)?.isIntegrated ? 'mdi:monitor-off' : 'mdi:monitor-share'"></Icon>
                                        <x-label>{{ integrationStatus.get(app.Path)?.isIntegrated ? 'Remove from Start Menu' : 'Add to Start Menu' }}</x-label>
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
                
            <div v-else class="flex justify-center items-center mt-40">
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
import { DesktopIntegration, type DesktopIntegrationStatus } from '../utils/desktopIntegration';
const nodeFetch: typeof import('node-fetch').default = require('node-fetch');
const FormData: typeof import('form-data') = require('form-data');

const winboat = new Winboat();
const apps = ref<WinApp[]>([]);
const searchInput = ref('');
const sortBy = ref('');
const addCustomAppDialog = useTemplateRef('addCustomAppDialog');
const customAppName = ref('');
const customAppPath = ref('');
const customAppIcon = ref(`data:image/png;base64,${AppIcons[DEFAULT_ICON]}`);

// New state for visibility and grouping
const showHiddenApps = ref(false);
const viewMode = ref<'list' | 'groups'>('list');
const appGroups = ref<any[]>([]);
const showCreateGroupDialog = ref(false);
const newGroupName = ref('');
const selectedGroupFilters = ref({
    groups: [] as string[],
    showUngrouped: false
});
const showGroupFilter = ref(false);

// Desktop Integration
const desktopIntegration = new DesktopIntegration();
const integrationStatus = ref(new Map<string, DesktopIntegrationStatus>());
const isDesktopIntegrationReady = ref(false);


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
    
    // Filter by group selection
    if (selectedGroupFilters.value.groups.length > 0 || selectedGroupFilters.value.showUngrouped) {
        filteredApps = filteredApps.filter(app => {
            // Show ungrouped apps if that filter is enabled
            if (selectedGroupFilters.value.showUngrouped && !app.GroupId) {
                return true;
            }
            // Show apps from selected groups
            if (selectedGroupFilters.value.groups.length > 0 && app.GroupId) {
                return selectedGroupFilters.value.groups.includes(app.GroupId);
            }
            return false;
        });
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
            // Sort by group: ungrouped first, then by group name
            const aGroupName = a.GroupId ? currentGroups.find(g => g.id === a.GroupId)?.name || '' : '';
            const bGroupName = b.GroupId ? currentGroups.find(g => g.id === b.GroupId)?.name || '' : '';
            if (aGroupName !== bGroupName) {
                return aGroupName.localeCompare(bGroupName);
            }
        }
        
        // Default: sort by name
        return a.Name.localeCompare(b.Name);
    });
})

// Computed property for group filter label
const groupFilterLabel = computed(() => {
    const selectedCount = selectedGroupFilters.value.groups.length;
    const showUngrouped = selectedGroupFilters.value.showUngrouped;
    
    if (selectedCount === 0 && !showUngrouped) {
        return 'All Groups';
    }
    
    const parts = [];
    if (showUngrouped) parts.push('Ungrouped');
    if (selectedCount > 0) {
        if (selectedCount === 1) {
            const groupName = appGroups.value.find(g => g.id === selectedGroupFilters.value.groups[0])?.name;
            parts.push(groupName || 'Unknown Group');
        } else {
            parts.push(`${selectedCount} Groups`);
        }
    }
    
    return parts.join(' + ');
});

// Function to clear all group filters
const clearGroupFilters = () => {
    selectedGroupFilters.value.groups = [];
    selectedGroupFilters.value.showUngrouped = false;
};

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
    
    // Apply group filter
    if (selectedGroupFilters.value.groups.length > 0 || selectedGroupFilters.value.showUngrouped) {
        filteredApps = filteredApps.filter(app => {
            // Show ungrouped apps if that filter is enabled
            if (selectedGroupFilters.value.showUngrouped && !app.GroupId) {
                return true;
            }
            // Show apps from selected groups
            if (selectedGroupFilters.value.groups.length > 0 && app.GroupId) {
                return selectedGroupFilters.value.groups.includes(app.GroupId);
            }
            return false;
        });
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

// Desktop Integration Functions
const updateIntegrationStatus = async () => {
    const newStatus = new Map<string, DesktopIntegrationStatus>();
    apps.value.forEach(app => {
        const status = desktopIntegration.getIntegrationStatus(app);
        newStatus.set(app.Path, status);
    });
    integrationStatus.value = newStatus;
};

const toggleDesktopIntegration = async (app: WinApp) => {
    try {
        const currentStatus = integrationStatus.value.get(app.Path);
        if (currentStatus?.isIntegrated) {
            const success = desktopIntegration.removeAppIntegration(app);
            if (success) {
                console.log(`Removed desktop integration for ${app.Name}`);
            }
        } else {
            const success = await desktopIntegration.integrateApp(app);
            if (success) {
                console.log(`Added desktop integration for ${app.Name}`);
            }
        }
        await updateIntegrationStatus();
    } catch (error) {
        console.error(`Error toggling desktop integration for ${app.Name}:`, error);
    }
};

const cleanupDesktopIntegration = async () => {
    try {
        const removedCount = await desktopIntegration.cleanupAllIntegrations();
        console.log(`Cleaned up ${removedCount} desktop integrations`);
        await updateIntegrationStatus();
    } catch (error) {
        console.error('Error cleaning up desktop integrations:', error);
    }
};


onMounted(async () => {
    await refreshApps();
    appGroups.value = getAppGroups();
    
    // Initialize desktop integration
    isDesktopIntegrationReady.value = desktopIntegration.isSystemReady();
    if (isDesktopIntegrationReady.value) {
        await updateIntegrationStatus();
    }

    watch(winboat.isOnline, async (newVal, _) => {
        if (newVal) {
            await refreshApps();
            appGroups.value = getAppGroups();
            console.log("Apps list: ", apps.value);
            
            // Update integration status when apps are refreshed
            if (isDesktopIntegrationReady.value) {
                await updateIntegrationStatus();
            }
        }
    })

    // Fetch icon for custom app path
    watch(customAppPath, async (newVal, oldVal) => {
        await debouncedFetchIcon(newVal, oldVal);
    })
})

async function refreshApps() {
    if (winboat.isOnline.value) {
        apps.value = await winboat.appMgr!.getApps();
        // Run in background, won't impact UX
        await winboat.appMgr!.updateAppCache();
        if(winboat.appMgr!.appCache.length !== apps.value.length) {
            apps.value = winboat!.appMgr!.appCache;
        }
    }
}

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