# WinBoat Desktop Integration Cleanup

This document explains how to clean up WinBoat desktop integration from your Linux system.

## What Gets Created

When you use WinBoat's "Add to Start Menu" feature, the following files are created on your system:

- **Desktop Entries**: `~/.local/share/applications/winboat-{app-name}.desktop`
- **App Icons**: `~/.local/share/icons/winboat/{app-name}.png`
- **Icon Directory**: `~/.local/share/icons/winboat/`

## Cleanup Methods

### Method 1: Using WinBoat Interface

1. Open WinBoat
2. Navigate to the Apps section
3. If you have apps in the start menu, you'll see a "Clean Desktop" button
4. Click the button and confirm to remove all desktop entries

### Method 2: Standalone Cleanup Script

For complete system cleanup (useful when uninstalling WinBoat):

```bash
# Preview what will be removed (safe)
node cleanup-desktop-integration.js --dry-run

# Perform actual cleanup
node cleanup-desktop-integration.js

# Clean up quietly
node cleanup-desktop-integration.js --silent
```

### Method 3: Manual Cleanup

If you prefer to clean up manually:

```bash
# Remove desktop entries
rm ~/.local/share/applications/winboat-*.desktop

# Remove icons
rm -rf ~/.local/share/icons/winboat/

# Update desktop database
update-desktop-database ~/.local/share/applications/
```

## What Cleanup Does

✅ **Removes all WinBoat desktop entries** from the start menu  
✅ **Deletes all associated app icons** from the system  
✅ **Cleans up the WinBoat icons directory**  
✅ **Updates the desktop database** to refresh the menu  
✅ **Provides detailed feedback** on what was removed  

## Important Notes

- **Safe Operation**: Cleanup only removes WinBoat-related files (prefixed with `winboat-`)
- **No Data Loss**: Your Windows apps and WinBoat configuration remain intact
- **Reversible**: You can re-add apps to the start menu anytime through WinBoat
- **System Clean**: Useful for uninstallation or system maintenance

## Troubleshooting

If some entries don't get removed:

1. Check file permissions: `ls -la ~/.local/share/applications/winboat-*.desktop`
2. Try manual removal with sudo if needed
3. Verify the desktop database update completed successfully

## Files and Directories

```
~/.local/share/applications/
├── winboat-{app1}.desktop      # Individual app launchers
├── winboat-{app2}.desktop
└── ...

~/.local/share/icons/winboat/
├── {app1}.png                  # App icons
├── {app2}.png
└── ...
```

The cleanup process ensures your Linux system returns to its original state regarding WinBoat desktop integration.