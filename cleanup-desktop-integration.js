#!/usr/bin/env node

/**
 * WinBoat Desktop Integration Cleanup Utility
 * 
 * This standalone script removes all WinBoat desktop entries and related files
 * from the Linux desktop environment. Useful for system cleanup or uninstallation.
 * 
 * Usage: node cleanup-desktop-integration.js [--dry-run] [--silent]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const APPLICATIONS_DIR = path.join(os.homedir(), '.local', 'share', 'applications');
const ICONS_DIR = path.join(os.homedir(), '.local', 'share', 'icons', 'winboat');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isSilent = args.includes('--silent');

function log(message, force = false) {
    if (!isSilent || force) {
        console.log(message);
    }
}

function logError(message) {
    console.error(`❌ ${message}`);
}

function logSuccess(message) {
    if (!isSilent) {
        console.log(`✅ ${message}`);
    }
}

function logWarning(message) {
    if (!isSilent) {
        console.log(`⚠️  ${message}`);
    }
}

/**
 * Find all WinBoat desktop entries
 */
function findWinBoatDesktopEntries() {
    try {
        if (!fs.existsSync(APPLICATIONS_DIR)) {
            return [];
        }
        
        const files = fs.readdirSync(APPLICATIONS_DIR);
        return files.filter(file => file.startsWith('winboat-') && file.endsWith('.desktop'));
    } catch (error) {
        logError(`Failed to scan applications directory: ${error.message}`);
        return [];
    }
}

/**
 * Remove desktop entries
 */
async function removeDesktopEntries(entries) {
    let removedCount = 0;
    const errors = [];
    
    for (const entry of entries) {
        const filePath = path.join(APPLICATIONS_DIR, entry);
        
        if (isDryRun) {
            log(`Would remove: ${filePath}`);
            removedCount++;
        } else {
            try {
                fs.unlinkSync(filePath);
                logSuccess(`Removed desktop entry: ${entry}`);
                removedCount++;
            } catch (error) {
                const errorMsg = `Failed to remove ${entry}: ${error.message}`;
                logError(errorMsg);
                errors.push(errorMsg);
            }
        }
    }
    
    return { removed: removedCount, errors };
}

/**
 * Remove icon files and directory
 */
async function removeIcons() {
    let removedIconCount = 0;
    const errors = [];
    
    if (!fs.existsSync(ICONS_DIR)) {
        log('Icons directory does not exist, skipping');
        return { removed: 0, errors: [] };
    }
    
    try {
        const iconFiles = fs.readdirSync(ICONS_DIR);
        
        for (const iconFile of iconFiles) {
            const iconPath = path.join(ICONS_DIR, iconFile);
            
            if (isDryRun) {
                log(`Would remove icon: ${iconPath}`);
                removedIconCount++;
            } else {
                try {
                    fs.unlinkSync(iconPath);
                    logSuccess(`Removed icon: ${iconFile}`);
                    removedIconCount++;
                } catch (error) {
                    const errorMsg = `Failed to remove icon ${iconFile}: ${error.message}`;
                    logError(errorMsg);
                    errors.push(errorMsg);
                }
            }
        }
        
        // Try to remove the directory if it's empty
        if (!isDryRun) {
            try {
                const remainingFiles = fs.readdirSync(ICONS_DIR);
                if (remainingFiles.length === 0) {
                    fs.rmdirSync(ICONS_DIR);
                    logSuccess('Removed WinBoat icons directory');
                }
            } catch (error) {
                logWarning(`Could not remove icons directory: ${error.message}`);
            }
        } else {
            log(`Would remove directory: ${ICONS_DIR}`);
        }
        
    } catch (error) {
        const errorMsg = `Failed to process icons directory: ${error.message}`;
        logError(errorMsg);
        errors.push(errorMsg);
    }
    
    return { removed: removedIconCount, errors };
}

/**
 * Update desktop database
 */
async function updateDesktopDatabase() {
    if (isDryRun) {
        log('Would update desktop database');
        return;
    }
    
    try {
        await execAsync('update-desktop-database ~/.local/share/applications/');
        logSuccess('Updated desktop database');
    } catch (error) {
        logWarning(`Failed to update desktop database: ${error.message}`);
    }
}

/**
 * Main cleanup function
 */
async function performCleanup() {
    log('🧹 WinBoat Desktop Integration Cleanup', true);
    log('=====================================', true);
    
    if (isDryRun) {
        log('🔍 DRY RUN MODE - No files will be actually deleted', true);
        log('');
    }
    
    // Find desktop entries
    const entries = findWinBoatDesktopEntries();
    log(`Found ${entries.length} WinBoat desktop entries`);
    
    if (entries.length === 0 && !fs.existsSync(ICONS_DIR)) {
        log('✨ No WinBoat desktop integration found - system is already clean!', true);
        return;
    }
    
    // Remove desktop entries
    const desktopResult = await removeDesktopEntries(entries);
    
    // Remove icons
    const iconResult = await removeIcons();
    
    // Update desktop database
    await updateDesktopDatabase();
    
    // Summary
    log('');
    log('📊 Cleanup Summary:', true);
    log(`   Desktop Entries: ${desktopResult.removed} removed`, true);
    log(`   Icon Files: ${iconResult.removed} removed`, true);
    
    const totalErrors = desktopResult.errors.length + iconResult.errors.length;
    if (totalErrors > 0) {
        log(`   Errors: ${totalErrors} encountered`, true);
        
        if (!isSilent) {
            log('');
            log('❌ Errors encountered:');
            [...desktopResult.errors, ...iconResult.errors].forEach(error => {
                log(`   ${error}`);
            });
        }
    } else {
        log('   Status: All operations completed successfully! ✨', true);
    }
    
    if (isDryRun) {
        log('');
        log('💡 Run without --dry-run to perform actual cleanup', true);
    }
}

/**
 * Show help
 */
function showHelp() {
    console.log(`
WinBoat Desktop Integration Cleanup Utility

This script removes all WinBoat desktop entries and related files from your
Linux desktop environment.

Usage: node cleanup-desktop-integration.js [options]

Options:
  --dry-run    Show what would be removed without actually deleting anything
  --silent     Suppress all output except errors and final summary
  --help       Show this help message

Examples:
  node cleanup-desktop-integration.js --dry-run    # Preview what would be removed
  node cleanup-desktop-integration.js              # Perform actual cleanup
  node cleanup-desktop-integration.js --silent     # Clean up quietly
`);
}

// Main execution
if (args.includes('--help')) {
    showHelp();
} else {
    performCleanup().catch(error => {
        logError(`Cleanup failed: ${error.message}`);
        process.exit(1);
    });
}