<template>
    <div>
        <x-card
            class="bg-neutral-800/20 backdrop-brightness-150 backdrop-blur-xl flex flex-row items-center justify-between">
            <div class="flex flex-row gap-4 items-center">
                <div class="border-[0.4rem] border-gray-900/30 rounded-md">
                    <img class="h-32 rounded-sm"
                        :src="wallpaper"
                        alt="Windows Wallpaper">
                </div>

                <!-- Status Text -->
                <div>
                    <div class="flex flex-row items-baseline gap-4 mb-6 flex-nowrap">
                        <h1 class="text-2xl mt-0 mb-0 whitespace-nowrap">{{ WINDOWS_VERSIONS[compose?.services.windows.environment.VERSION ??
                            '11'] ?? 'Unknown' }}</h1>
                        <div class="flex flex-row items-center gap-2 text-blue-300 whitespace-nowrap">
                            <Icon class="size-4" icon="mdi:clock-outline"></Icon>
                            <span class="text-base font-medium">Uptime: {{ uptime }}</span>
                        </div>
                    </div>
                    <div class="flex flex-row items-center gap-1.5 mb-1"
                        :class="{ 'text-green-500': winboat.isOnline.value, 'text-red-500': !winboat.isOnline.value }">
                        <Icon class="size-7" icon="material-symbols:api"></Icon>
                        <p class="!my-0 font-semibold text-lg">WinBoat Guest API -
                            {{ winboat.isOnline.value ? 'Online' : 'Offline' }}
                        </p>
                    </div>
                    <div class="flex flex-row items-center gap-1.5" :class="{
                        'text-green-500': winboat.containerStatus.value === ContainerStatus.Running,
                        'text-red-500': winboat.containerStatus.value === ContainerStatus.Exited,
                        'text-yellow-500': winboat.containerStatus.value === ContainerStatus.Paused,
                        'text-orange-500': winboat.containerStatus.value === ContainerStatus.Dead,

                    }">
                        <Icon class="size-7" icon="mdi:docker"></Icon>
                        <p class="!my-0 font-semibold text-lg">
                            Container - {{ capitalizeFirstLetter(winboat.containerStatus.value) }}{{ containerUptime ? ` (${containerUptime})` : '' }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Buttons -->
            <div v-if="!winboat.containerActionLoading.value" class="flex flex-row items-center gap-5 text-gray-200/80">
                <button title="Start" class="generic-hover" v-if="
                    winboat.containerStatus.value === ContainerStatus.Exited ||
                    winboat.containerStatus.value === ContainerStatus.Dead
                " @click="winboat.startContainer()">
                    <Icon class="w-20 h-20 text-green-300" icon="mingcute:play-fill"></Icon>
                </button>
                <button title="Stop" class="generic-hover" v-if="winboat.containerStatus.value === ContainerStatus.Running"
                    @click="winboat.stopContainer()">
                    <Icon class="w-20 h-20 text-red-300" icon="mingcute:stop-fill"></Icon>
                </button>

                <button title="Restart Guest OS" class="generic-hover" v-if="winboat.containerStatus.value === ContainerStatus.Running"
                    @click="winboat.restartGuestOS()">
                    <Icon class="w-20 h-20 text-blue-300" icon="mdi:restart"></Icon>
                </button>

                <button title="Pause / Unpause" class="generic-hover"
                    v-if="winboat.containerStatus.value === ContainerStatus.Running || winboat.containerStatus.value === ContainerStatus.Paused"
                    @click="winboat.containerStatus.value === ContainerStatus.Paused ? winboat.unpauseContainer() : winboat.pauseContainer()">
                    <Icon class="w-20 h-20 text-yellow-100" icon="mingcute:pause-line"></Icon>
                </button>
            </div>

            <div v-else>
                <x-throbber class="w-16 h-16"></x-throbber>
            </div>
        </x-card>

        <!-- Metrics -->
        <div
            class="grid grid-cols-3 w-full gap-8 transition-all duration-200"
            :class="{ 'blur-sm opacity-50': !winboat.isOnline.value }"
        >
            <x-card class="bg-neutral-800/20 backdrop-brightness-150 backdrop-blur-xl flex flex-row gap-2 pl-0 my-0">
                <apexchart class="translate-y-2" type="radialBar" :options="chartOptions" :series="[winboat.metrics.value.cpu.usage]" :width="120" :height="120" />
                <div>
                    <div class="flex flex-row gap-2 items-center mb-2">
                        <Icon class="size-8 text-violet-400" icon="solar:cpu-bold"></Icon>
                        <h2 class="my-0 text-2xl">CPU</h2>
                    </div>
                    <p class="!my-0 text-gray-400 h-6 overflow-hidden">{{ compose?.services.windows.environment.CPU_CORES }} Virtual Cores</p>
                    <p class="!my-0 text-gray-400 h-6 overflow-hidden">Frequency: {{ (winboat.metrics.value.cpu.frequency / 1000).toFixed(2) }} GHz</p>
                </div>
            </x-card>
            <x-card class="bg-neutral-800/20 backdrop-brightness-150 backdrop-blur-xl flex flex-row gap-2 pl-0 my-0">
                <apexchart class="translate-y-2" type="radialBar" :options="chartOptions" :series="[winboat.metrics.value.ram.percentage]" :width="120" :height="120" />
                <div>
                    <div class="flex flex-row gap-2 items-center mb-2">
                        <Icon class="size-8 text-violet-400" icon="game-icons:ram"></Icon>
                        <h2 class="my-0 text-2xl">RAM</h2>
                    </div>
                    <p class="!my-0 text-gray-400 h-6 overflow-hidden">{{ Math.round(winboat.metrics.value.ram.total / 1024).toFixed(2) }} GB Total RAM</p>
                    <p class="!my-0 text-gray-400 h-6 overflow-hidden">{{ (winboat.metrics.value.ram.used / 1024).toFixed(2) }} GB Used RAM</p>
                </div>
            </x-card>
            <x-card class="bg-neutral-800/20 backdrop-brightness-150 backdrop-blur-xl flex flex-row gap-2 pl-0 my-0">
                <apexchart class="translate-y-2" type="radialBar" :options="chartOptions" :series="[winboat.metrics.value.disk.percentage]" :width="120" :height="120" />
                <div>
                    <div class="flex flex-row gap-2 items-center mb-2">
                        <Icon class="size-8 text-violet-400" icon="carbon:vmdk-disk"></Icon>
                        <h2 class="my-0 text-2xl">Disk</h2>
                    </div>
                    <p class="!my-0 text-gray-400 h-6 overflow-hidden">{{ (winboat.metrics.value.disk.total / 1024).toFixed(2) }} GB Total Disk Space</p>
                    <p class="!my-0 text-gray-400 h-6 overflow-hidden">{{ (winboat.metrics.value.disk.used / 1024).toFixed(2) }} GB Used Space</p>
                </div>
            </x-card>
        </div>

        <!-- Maintenance & Sessions Section -->
        <div class="mt-8 space-y-6">
            

            <!-- Active Sessions -->
            <x-card v-if="wbConfig.config.sessionManagementEnabled" class="bg-neutral-800/20 backdrop-brightness-150 backdrop-blur-xl">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <Icon class="size-6 text-purple-400" icon="mdi:monitor-multiple"></Icon>
                        Active Sessions
                    </h3>
                    <div class="flex items-center gap-2">
                        <div class="text-sm text-neutral-400">
                            {{ sessionStats.totalSessions }} active • {{ sessionStats.totalMemoryUsage }}MB • {{ sessionStats.totalCpuUsage }}% CPU
                        </div>
                        <x-button @click="refreshSessions" :disabled="isRefreshingSessions" class="!p-2 !min-w-0">
                            <Icon class="size-4" :icon="isRefreshingSessions ? 'mdi:loading' : 'mdi:refresh'" :class="{ 'animate-spin': isRefreshingSessions }"></Icon>
                        </x-button>
                    </div>
                </div>

                <!-- Session List -->
                <div v-if="xfreerdpSessions.length === 0" class="text-center py-6 text-neutral-400">
                    <Icon class="size-12 mb-2" icon="mdi:monitor-off"></Icon>
                    <p>No active XFreeRDP sessions</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="session in xfreerdpSessions" :key="session.pid" 
                         class="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
                        
                        <div class="flex items-center gap-3">
                            <Icon class="size-5 text-purple-400" icon="mdi:application"></Icon>
                            <div>
                                <div class="font-medium">{{ session.appPath }}</div>
                                <div class="text-xs text-neutral-400">
                                    PID {{ session.pid }} • {{ session.memoryUsage }}MB • {{ session.cpuUsage }}% CPU
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <div class="text-xs text-neutral-400">{{ session.startTime }}</div>
                            <x-button @click="killSession(session.pid)" class="!p-2 !min-w-0 text-red-400 hover:text-red-300">
                                <Icon class="size-4" icon="mdi:close"></Icon>
                            </x-button>
                        </div>
                    </div>

                    <!-- Kill All Button -->
                    <div v-if="xfreerdpSessions.length > 1" class="pt-2 border-t border-neutral-700">
                        <x-button @click="killAllSessions" class="text-red-400 hover:text-red-300">
                            <Icon class="size-4" icon="mdi:close-circle-multiple"></Icon>
                            <x-label>Kill All Sessions</x-label>
                        </x-button>
                    </div>
                </div>
            </x-card>

        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { ContainerStatus, Winboat } from '../lib/winboat';
import { type ComposeConfig } from '../../types';
import { WINDOWS_VERSIONS } from '../lib/constants';
import { Icon } from '@iconify/vue';
import { capitalizeFirstLetter } from '../utils/capitalize';
import { SessionManager, type XFreerdpSession } from '../utils/sessionManager';
import { WinboatConfig } from '../lib/config';

const winboat = new Winboat();
const wbConfig = new WinboatConfig();
const compose = ref<ComposeConfig | null>(null);
const wallpaper = ref("");

// Reactive uptime that updates every second
const uptimeTimer = ref(Date.now());
const uptime = computed(() => {
    uptimeTimer.value; // This makes the computed depend on the timer
    return winboat.getUptime();
});

// Container uptime
const containerUptime = ref<string>("");


// Session Management
const sessionManager = new SessionManager();
const xfreerdpSessions = ref<XFreerdpSession[]>([]);
const sessionStats = ref({ totalSessions: 0, totalMemoryUsage: 0, totalCpuUsage: 0 });
const isRefreshingSessions = ref(false);


// Session Management Functions
const refreshSessions = async () => {
    if (!wbConfig.config.sessionManagementEnabled) {
        return; // Skip if session management is disabled
    }
    
    try {
        isRefreshingSessions.value = true;
        xfreerdpSessions.value = await sessionManager.getRunningXFreerdpSessions();
        sessionStats.value = await sessionManager.getSessionStats();
        console.log('Sessions refreshed:', xfreerdpSessions.value);
    } catch (error) {
        console.error('Error refreshing sessions:', error);
    } finally {
        isRefreshingSessions.value = false;
    }
};

const killSession = async (pid: number) => {
    try {
        const success = await sessionManager.killSession(pid);
        if (success) {
            await refreshSessions();
        }
    } catch (error) {
        console.error('Error killing session:', error);
    }
};

const killAllSessions = async () => {
    try {
        const result = await sessionManager.killAllSessions();
        console.log(`Killed ${result.killed} sessions, ${result.failed} failed`);
        await refreshSessions();
    } catch (error) {
        console.error('Error killing all sessions:', error);
    }
};

onMounted(async () => {
    compose.value = winboat.parseCompose();
    wallpaper.value = compose.value.services.windows.environment.VERSION.includes("11")
        ? "./img/wallpaper/win11.webp"
        : "./img/wallpaper/win10.webp";
    
    // Get initial container uptime if running
    if (winboat.containerStatus.value === ContainerStatus.Running) {
        containerUptime.value = await winboat.getContainerUptime();
    }
    
    // Initialize sessions if enabled
    if (wbConfig.config.sessionManagementEnabled) {
        await refreshSessions();
        
        // Set up periodic refresh for sessions
        setInterval(refreshSessions, 5000); // Refresh every 5 seconds
    }
    
    // Set up uptime timer refresh (every second)
    setInterval(async () => {
        uptimeTimer.value = Date.now();
        // Also update container uptime if running
        if (winboat.containerStatus.value === ContainerStatus.Running) {
            containerUptime.value = await winboat.getContainerUptime();
        } else {
            containerUptime.value = "";
        }
    }, 1000);
})

const chartOptions = ref({
    chart: {
        type: 'radialBar',
        offsetY: -20,
        sparkline: {
            enabled: true
        },
        width: 100,
        height: 100
    },
    plotOptions: {
        radialBar: {
            startAngle: -135,
            endAngle: 135,
            track: {
                background: '#18181b', // Unfilled section color
                strokeWidth: '97%',
                margin: 5,
                // dropShadow: {
                //     enabled: true,
                //     top: 2,
                //     left: 0,
                //     color: '#444',
                //     opacity: 1,
                //     blur: 2
                // }
            },
            dataLabels: {
                name: {
                    show: false
                },
                value: {
                    offsetY: 2,
                    fontSize: '12px',
                    color: '#FFFFFF',
                    formatter: function (val: number) {
                        return val.toFixed(1) + '%'; // Fixed to 1 decimal place
                    }
                }
            }
        }
    },
    grid: {
        padding: {
            top: -10
        }
    },
    fill: {
        type: 'solid', // Switched from gradient to solid
        colors: ['#A78AF9'] // Nice purple for the filled section
    },
    labels: ['Average Results']
})
</script>

<style scoped></style>