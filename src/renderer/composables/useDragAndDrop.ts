import { ref, computed, nextTick } from 'vue'
import type { WinApp } from '../../types'
import { useUIStore } from '../stores/uiStore'
import { useAppManagement } from './useAppManagement'
import { createLogger } from '../utils/log'
import { WINBOAT_DIR } from '../lib/constants'

const path: typeof import('path') = require('path')
const logger = createLogger(path.join(WINBOAT_DIR, 'dragAndDrop.log'))

export const useDragAndDrop = () => {
    const uiStore = useUIStore()
    const appManagement = useAppManagement()
    
    // Drag state
    const draggedApps = ref<WinApp[]>([])
    const dragPreview = ref<HTMLElement | null>(null)
    const dropZone = ref<string | null>(null)
    const isDragValid = ref(true)
    
    // Computed properties
    const isDragging = computed(() => draggedApps.value.length > 0)
    const draggedAppPaths = computed(() => draggedApps.value.map(app => app.Path))
    
    // Helper to create drag preview element
    const createDragPreview = (apps: WinApp[]): HTMLElement => {
        const preview = document.createElement('div')
        preview.className = 'drag-preview'
        
        if (apps.length === 1) {
            const app = apps[0]
            preview.innerHTML = `
                <div class="drag-preview-single">
                    <img src="data:image/png;base64,${app.Icon}" class="drag-preview-icon" />
                    <span class="drag-preview-name">${app.Name}</span>
                </div>
            `
        } else {
            preview.innerHTML = `
                <div class="drag-preview-multiple">
                    <div class="drag-preview-stack">
                        <img src="data:image/png;base64,${apps[0].Icon}" class="drag-preview-icon" />
                        <div class="drag-preview-badge">${apps.length}</div>
                    </div>
                    <span class="drag-preview-name">${apps.length} apps</span>
                </div>
            `
        }
        
        // Style the preview
        preview.style.cssText = `
            position: fixed;
            top: -1000px;
            left: -1000px;
            z-index: 10000;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 8px;
            padding: 8px 12px;
            backdrop-filter: blur(8px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            pointer-events: none;
            transform: rotate(5deg);
            color: white;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 200px;
        `
        
        document.body.appendChild(preview)
        return preview
    }
    
    // Start dragging apps
    const startDrag = (app: WinApp, event: DragEvent): void => {
        try {
            if (!event.dataTransfer) return
            
            // Determine which apps to drag
            let appsToDrag: WinApp[]
            
            if (uiStore.bulkActionMode && uiStore.isAppSelected(app.Path)) {
                // Drag all selected apps
                const selectedPaths = uiStore.getSelectedApps()
                appsToDrag = appManagement.apps.filter(a => selectedPaths.includes(a.Path))
            } else {
                // Drag just this app
                appsToDrag = [app]
            }
            
            // Check if any apps are system apps (non-draggable)
            const systemApps = appsToDrag.filter(a => a.Source === 'internal')
            if (systemApps.length > 0) {
                event.preventDefault()
                logger.warn(`Cannot drag system apps: ${systemApps.map(a => a.Name).join(', ')}`)
                return
            }
            
            draggedApps.value = appsToDrag
            
            // Create and set drag preview
            const preview = createDragPreview(appsToDrag)
            dragPreview.value = preview
            
            // Set drag image (offset to center)
            event.dataTransfer.setDragImage(preview, 0, 0)
            
            // Set drag data
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', JSON.stringify(appsToDrag.map(a => a.Path)))
            event.dataTransfer.setData('application/winboat-apps', JSON.stringify(appsToDrag))
            
            // Update UI state
            uiStore.setDraggedApp(app.Path)
            
            // Remove preview after drag starts
            nextTick(() => {
                if (dragPreview.value && document.body.contains(dragPreview.value)) {
                    document.body.removeChild(dragPreview.value)
                    dragPreview.value = null
                }
            })
            
            logger.info(`Started dragging ${appsToDrag.length} app(s): ${appsToDrag.map(a => a.Name).join(', ')}`)
        } catch (error) {
            logger.error('Error starting drag:', error)
            endDrag()
        }
    }
    
    // Handle drag over group or drop zone
    const dragOver = (target: string | null, event: DragEvent): void => {
        if (!isDragging.value) return
        
        event.preventDefault()
        event.dataTransfer!.dropEffect = 'move'
        
        // Validate drop target
        const valid = validateDropTarget(target)
        isDragValid.value = valid
        
        // Update drop zone
        dropZone.value = target
        uiStore.setDropTarget(target)
        
        // Visual feedback
        if (valid) {
            event.dataTransfer!.dropEffect = 'move'
        } else {
            event.dataTransfer!.dropEffect = 'none'
        }
    }
    
    // Validate if apps can be dropped on target
    const validateDropTarget = (target: string | null): boolean => {
        if (!isDragging.value) return false
        
        // Can always drop on "ungrouped" (null)
        if (target === null) return true
        
        // Check if target group exists
        const targetGroup = appManagement.groups.find(g => g.id === target)
        if (!targetGroup) return false
        
        // Check if any app is already in the target group
        const alreadyInGroup = draggedApps.value.some(app => app.GroupId === target)
        return !alreadyInGroup
    }
    
    // Handle drop on group or drop zone
    const drop = async (target: string | null, event: DragEvent): Promise<boolean> => {
        event.preventDefault()
        
        if (!isDragging.value || !isDragValid.value) {
            endDrag()
            return false
        }
        
        try {
            const appsToMove = [...draggedApps.value]
            let successCount = 0
            
            // Move each app to the target group
            for (const app of appsToMove) {
                const success = await appManagement.assignAppToGroup(app.Path, target)
                if (success) {
                    successCount++
                }
            }
            
            // Show result
            if (successCount === appsToMove.length) {
                const targetName = target ? 
                    appManagement.groups.find(g => g.id === target)?.name || 'Unknown Group' : 
                    'Ungrouped'
                
                logger.info(`Successfully moved ${successCount} app(s) to ${targetName}`)
                
                // Show toast notification (implement if needed)
                // showToast(`Moved ${successCount} app(s) to ${targetName}`)
            } else {
                logger.warn(`Only ${successCount}/${appsToMove.length} apps moved successfully`)
            }
            
            endDrag()
            return successCount > 0
        } catch (error) {
            logger.error('Error during drop:', error)
            endDrag()
            return false
        }
    }
    
    // End dragging
    const endDrag = (): void => {
        draggedApps.value = []
        dropZone.value = null
        isDragValid.value = true
        
        // Clean up preview if it still exists
        if (dragPreview.value && document.body.contains(dragPreview.value)) {
            document.body.removeChild(dragPreview.value)
            dragPreview.value = null
        }
        
        // Clear UI state
        uiStore.clearDragState()
    }
    
    // Handle drag leave
    const dragLeave = (event: DragEvent): void => {
        // Only clear drop zone if we're actually leaving the drop area
        const relatedTarget = event.relatedTarget as Element | null
        if (!relatedTarget || !event.currentTarget) return
        
        const dropArea = event.currentTarget as Element
        if (!dropArea.contains(relatedTarget)) {
            dropZone.value = null
            uiStore.setDropTarget(null)
        }
    }
    
    // Check if an app can be dragged
    const canDragApp = (app: WinApp): boolean => {
        // System apps cannot be dragged
        if (app.Source === 'internal') return false
        
        return true
    }
    
    // Check if a group is a valid drop target
    const isValidDropTarget = (groupId: string | null): boolean => {
        return validateDropTarget(groupId)
    }
    
    return {
        // State
        draggedApps: computed(() => draggedApps.value),
        draggedAppPaths,
        dropZone: computed(() => dropZone.value),
        isDragging,
        isDragValid: computed(() => isDragValid.value),
        
        // Methods
        startDrag,
        dragOver,
        drop,
        dragLeave,
        endDrag,
        canDragApp,
        isValidDropTarget,
        
        // Event handlers for easy use in templates
        onDragStart: startDrag,
        onDragOver: dragOver,
        onDragLeave: dragLeave,
        onDrop: drop
    }
}