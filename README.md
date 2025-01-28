# Explorer Bookmark

![Explorer Bookmark](assets/icons/icon128.png)

**Copyright © 2024 Rhyme Rubayet. All Rights Reserved.**

## Proprietary Notice

This software, Explorer Bookmark, including its source code, design, and documentation, is proprietary and confidential. All rights are reserved. This work is protected by copyright laws and international treaties.

Unauthorized copying, modification, distribution, or use of this software, in whole or in part, is strictly prohibited. The receipt or possession of this software does not convey any rights to reproduce, disclose, or distribute its contents.

## Overview

Explorer Bookmark is a powerful Chrome extension that revolutionizes how you manage your bookmarks. With an intuitive file explorer-like interface, it provides a seamless experience for organizing and accessing your bookmarks.

## Features

### 1. Dual View Modes

- **Tree View**: Hierarchical display of bookmarks and folders
- **File View**: Grid-based layout with folder navigation

### 2. Advanced Bookmark Management

- Create, edit, and delete bookmarks and folders
- Drag-and-drop organization
- Bulk operations support
- Search functionality with real-time results

### 3. Tab Management

- Save all open tabs as bookmarks
- Selectively save specific tabs
- Organize saved tabs into new or existing folders

### 4. Import/Export Capabilities

- Export bookmarks to JSON format
- Import bookmarks with options:
  - Merge with existing bookmarks
  - Override all bookmarks
  - Save to specific folders

### 5. Navigation Features

- Breadcrumb navigation
- Forward/Back navigation
- Up-level navigation
- Quick folder creation

## Installation

### For Users

1. Download the extension from the Chrome Web Store (link coming soon)
2. Click "Add to Chrome" to install
3. Access via the toolbar icon or keyboard shortcut

### For Development

1. Clone the repository (requires authorization)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Development commands:

   ```bash
   # Watch mode for development
   npm run watch

   # Production build
   npm run build

   # Create distribution package
   npm run package
   ```

## Technical Documentation

### Project Structure

```
explorer-bookmark/
├── src/
│   ├── js/
│   │   ├── popup.js      # Main extension logic
│   │   └── background.js # Background service worker
│   ├── html/
│   │   └── popup.html    # Extension UI
│   └── css/
│       └── styles.css    # Styling
├── assets/
│   └── icons/           # Extension icons
├── dist/               # Build output
└── webpack.config.js   # Build configuration
```

### Build System

- Webpack-based build process
- Automatic minification and optimization
- Source protection measures
- Asset management and optimization

### Data Structure

Bookmarks are stored in a hierarchical structure:

```javascript
{
  root: {
    id: "root",
    name: "Bookmarks",
    type: "folder",
    children: [
      {
        id: "unique_id",
        name: "Bookmark Name",
        url: "https://example.com",
        type: "bookmark"
      },
      {
        id: "folder_id",
        name: "Folder Name",
        type: "folder",
        children: []
      }
    ]
  }
}
```

### Storage

- Uses Chrome's sync storage for cross-device synchronization
- Automatic data persistence
- Efficient data structure for quick access

## Security Features

- Code obfuscation and protection
- Console access restrictions
- Secure data handling
- Protected intellectual property

## Performance Considerations

- Efficient DOM manipulation
- Optimized search algorithms
- Lazy loading for large bookmark sets
- Minimal memory footprint

## Browser Compatibility

- Chrome/Chromium-based browsers (v88+)
- Tested on Windows, macOS, and Linux

## Support and Updates

For support inquiries or to report issues, please contact the developer directly. Regular updates and improvements will be provided through the Chrome Web Store.

## Legal

This software is proprietary and protected by copyright law. See the LICENSE file for detailed terms and conditions.

---

© 2024 Rhyme Rubayet. All Rights Reserved.
