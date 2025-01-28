/*!
 * Explorer Bookmark v1.0.0
 * (c) 2024 Rhyme Rubayet
 * Released under a custom license
 * Created: ${new Date().toISOString()}
 * Website: https://your-website.com
 */

// Prevent console access and add protection
(function () {
  const consoleOutput = console.log;
  console.log = function () {
    consoleOutput.apply(this, [
      "%c Stop!",
      "color: red; font-size: 30px; font-weight: bold;",
      "\n\nThis is a browser feature intended for developers.",
      "\nCopying, modifying, or reverse engineering this extension is strictly prohibited.",
      `\n\n© ${new Date().getFullYear()} Rhyme Rubayet. All Rights Reserved.`,
    ]);
  };
})();

// popup.js
let bookmarksData;
let searchTimeout;
let draggedNode = null;
let currentView = "file";
let currentPath = ["root"];
let navigationHistory = ["root"];
let currentHistoryIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  initExtension();
  setupEventListeners();

  // Check for pending bookmark from context menu
  chrome.runtime.sendMessage(
    { action: "getPendingBookmark" },
    (pendingBookmark) => {
      if (pendingBookmark) {
        showAddBookmarkDialog("root", pendingBookmark);
      }
    }
  );
});

function initExtension() {
  chrome.storage.sync.get(["bookmarks", "view"], ({ bookmarks, view }) => {
    bookmarksData = bookmarks || {
      root: {
        id: "root",
        name: "Bookmarks",
        type: "folder",
        children: [],
        expanded: true,
      },
    };

    // Set default view to 'file' if no view preference exists
    currentView = view || "file";
    document.getElementById("view-switcher").value = currentView;

    renderCurrentView();
    initDragAndDrop();
  });
}

function setupEventListeners() {
  const searchInput = document.getElementById("search");
  const clearButton = document.createElement("button");
  clearButton.className = "search-clear";
  clearButton.innerHTML = '<i class="bi bi-x"></i>';
  clearButton.style.display = "none";
  clearButton.title = "Clear search";
  document.querySelector(".search-container").appendChild(clearButton);

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(e), 300);
  });

  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    clearButton.style.display = "none";
    renderCurrentView();
  });

  document.getElementById("new-folder").addEventListener("click", () => {
    createFolder(currentPath[currentPath.length - 1]);
  });

  document.getElementById("add-bookmark").addEventListener("click", () => {
    showAddBookmarkDialog(currentPath[currentPath.length - 1]);
  });

  document.getElementById("view-switcher").addEventListener("change", (e) => {
    currentView = e.target.value;
    // Save view preference to storage
    chrome.storage.sync.set({ view: currentView }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error saving view preference:",
          chrome.runtime.lastError
        );
      }
    });
    renderCurrentView();
  });

  document
    .getElementById("export-btn")
    .addEventListener("click", exportBookmarks);
  document.getElementById("import-btn").addEventListener("click", handleImport);

  // Add context menu for adding bookmarks to specific folders
  document.addEventListener("contextmenu", handleContextMenu);

  // Navigation buttons
  document.getElementById("nav-back").addEventListener("click", () => {
    if (currentHistoryIndex > 0) {
      currentHistoryIndex--;
      const targetId = navigationHistory[currentHistoryIndex];
      const path = [];
      let currentNode = findNodeById(bookmarksData.root, targetId);
      while (currentNode) {
        path.unshift(currentNode.id);
        currentNode = findParentNode(bookmarksData.root, currentNode.id);
      }
      currentPath = path;
      updateNavigationButtons();
      renderFileView();
    }
  });

  document.getElementById("nav-forward").addEventListener("click", () => {
    if (currentHistoryIndex < navigationHistory.length - 1) {
      currentHistoryIndex++;
      const targetId = navigationHistory[currentHistoryIndex];
      const path = [];
      let currentNode = findNodeById(bookmarksData.root, targetId);
      while (currentNode) {
        path.unshift(currentNode.id);
        currentNode = findParentNode(bookmarksData.root, currentNode.id);
      }
      currentPath = path;
      updateNavigationButtons();
      renderFileView();
    }
  });

  document.getElementById("nav-up").addEventListener("click", () => {
    if (currentPath.length > 1) {
      const newPath = currentPath.slice(0, -1);
      const parentId = newPath[newPath.length - 1];
      navigateToFolder(parentId);
    }
  });

  document.getElementById("save-all-tabs").addEventListener("click", () => {
    showSaveAllTabsDialog();
  });

  document
    .getElementById("save-selected-tabs")
    .addEventListener("click", () => {
      showSaveSelectedTabsDialog();
    });
}

function handleContextMenu(e) {
  e.preventDefault();
  const node = e.target.closest(".node");
  if (node && node.classList.contains("folder")) {
    showAddBookmarkDialog(node.dataset.id);
  }
}

function showAddBookmarkDialog(folderId, bookmarkData = null) {
  if (bookmarkData) {
    // Use provided bookmark data
    showBookmarkDialog(bookmarkData.title, bookmarkData.url, folderId);
  } else {
    // Get current tab data
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      showBookmarkDialog(currentTab.title, currentTab.url, folderId);
    });
  }
}

function showBookmarkDialog(title, url, defaultFolderId) {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";

  // Get all folders for selection
  const folders = getAllFolders(bookmarksData.root);
  const folderOptions = folders
    .map(
      (folder) => `
    <div class="folder-select-item" data-id="${folder.id}">
      <i class="bi bi-folder"></i>
      <span>${escapeHtml(folder.name)}</span>
    </div>
  `
    )
    .join("");

  dialog.innerHTML = `
    <div class="modal-content">
      <h3>Add to Bookmarks</h3>
      <input type="text" id="bookmark-name" placeholder="Name" value="${escapeHtml(
        title
      )}">
      <input type="text" id="bookmark-url" placeholder="URL" value="${escapeHtml(
        url
      )}" readonly>
      <div class="folder-select-list">
        ${folderOptions}
      </div>
      <div class="modal-footer">
        <button class="new-folder-btn">
          <i class="bi bi-folder-plus"></i>
          New Folder
        </button>
        <div class="modal-footer-actions">
          <button class="cancel-btn">Cancel</button>
          <button id="save-bookmark" class="primary-btn">Save</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const saveBtn = dialog.querySelector("#save-bookmark");
  const cancelBtn = dialog.querySelector(".cancel-btn");
  const nameInput = dialog.querySelector("#bookmark-name");
  const folderItems = dialog.querySelectorAll(".folder-select-item");
  const newFolderBtn = dialog.querySelector(".new-folder-btn");

  // Set default selected folder
  let selectedFolderId = defaultFolderId;
  const defaultFolder = dialog.querySelector(`[data-id="${defaultFolderId}"]`);
  if (defaultFolder) {
    defaultFolder.classList.add("selected");
  }

  // Handle folder selection
  folderItems.forEach((item) => {
    item.addEventListener("click", () => {
      folderItems.forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      selectedFolderId = item.dataset.id;
    });
  });

  // Handle new folder creation
  newFolderBtn.addEventListener("click", () => {
    const createFolderDialog = document.createElement("div");
    createFolderDialog.className = "modal-overlay";
    createFolderDialog.innerHTML = `
      <div class="modal-content">
        <h3>Create New Folder</h3>
        <input type="text" id="new-folder-name" placeholder="Folder Name">
        <div class="modal-footer">
          <div class="modal-footer-actions">
            <button class="cancel-btn">Cancel</button>
            <button id="create-folder" class="primary-btn">Create</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(createFolderDialog);

    const createBtn = createFolderDialog.querySelector("#create-folder");
    const cancelFolderBtn = createFolderDialog.querySelector(".cancel-btn");
    const folderNameInput =
      createFolderDialog.querySelector("#new-folder-name");

    folderNameInput.focus();

    createBtn.addEventListener("click", () => {
      const folderName = folderNameInput.value.trim();
      if (!folderName) {
        alert("Please enter a folder name");
        return;
      }

      const newFolder = {
        id: Date.now().toString(),
        name: folderName,
        type: "folder",
        children: [],
        expanded: true,
      };

      const parent = findNodeById(bookmarksData.root, selectedFolderId);
      if (parent) {
        parent.children.push(newFolder);
        saveData();
        document.body.removeChild(createFolderDialog);
        document.body.removeChild(dialog);
        showBookmarkDialog(title, url, newFolder.id);
      }
    });

    cancelFolderBtn.addEventListener("click", () => {
      document.body.removeChild(createFolderDialog);
    });

    createFolderDialog.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        createBtn.click();
      } else if (e.key === "Escape") {
        cancelFolderBtn.click();
      }
    });
  });

  // Focus and select the name input
  nameInput.focus();
  nameInput.select();

  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      alert("Please enter a name for the bookmark");
      return;
    }

    addBookmark(name, url, selectedFolderId);
    document.body.removeChild(dialog);
  });

  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(dialog);
  });

  dialog.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  });
}

function addBookmark(name, url, folderId) {
  const newBookmark = {
    id: Date.now().toString(),
    name,
    url,
    type: "bookmark",
  };

  const folder = findNodeById(bookmarksData.root, folderId);
  if (folder) {
    folder.children.push(newBookmark);
    saveData();
    renderCurrentView();
  }
}

function renderTree(node, parentEl) {
  parentEl.innerHTML = "";
  const list = document.createElement("div");
  list.className = "tree-list";
  parentEl.appendChild(list);

  node.children.forEach((child) => {
    const el = createTreeNode(child);
    list.appendChild(el);

    if (child.type === "folder") {
      const childrenEl = document.createElement("div");
      childrenEl.className = "children";
      el.appendChild(childrenEl);

      if (child.expanded) {
        renderTree(child, childrenEl);
      }
    }
  });
}

function createTreeNode(child) {
  const el = document.createElement("div");
  el.className = `node ${child.type}${child.expanded ? " expanded" : ""}`;
  el.dataset.id = child.id;
  el.draggable = true;

  let html = '<div class="node-content">';

  if (child.type === "folder") {
    html += `
      <span class="toggle"><i class="bi bi-chevron-right"></i></span>
      <i class="bi bi-folder${
        child.expanded ? "-fill" : ""
      }" style="color: #1864ab;"></i>
      <span class="name">${escapeHtml(child.name)}</span>
      <div class="folder-actions">
        <button class="action-btn btn-new-folder" title="Create New Folder">
          <i class="bi bi-folder-plus"></i>
        </button>
        <button class="action-btn btn-delete" title="Delete Folder">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
  } else {
    html += `
      <i class="bi bi-bookmark" style="color: #495057;"></i>
      <span class="name">${escapeHtml(child.name)}</span>
      <span class="url">${escapeHtml(new URL(child.url).hostname)}</span>
      <div class="node-actions">
        <button class="action-btn btn-edit" title="Edit Bookmark">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="action-btn btn-delete" title="Delete Bookmark">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
  }

  html += "</div>";
  el.innerHTML = html;

  if (child.type === "folder") {
    // Add click handler specifically for the toggle button
    el.querySelector(".toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFolder(child);
    });

    el.querySelector(".btn-new-folder").addEventListener("click", (e) => {
      e.stopPropagation();
      createFolder(child.id);
    });

    el.querySelector(".btn-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNode(child.id);
    });

    // Add click handler for the folder name
    el.querySelector(".name").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFolder(child);
    });

    // Add click handler for the folder icon
    el.querySelector(".bi-folder, .bi-folder-fill").addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        toggleFolder(child);
      }
    );
  } else {
    el.querySelector(".btn-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      editBookmark(child);
    });

    el.querySelector(".btn-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNode(child.id);
    });

    el.addEventListener("click", (e) => {
      if (!e.target.closest("button")) {
        window.open(child.url, "_blank");
      }
    });
  }

  return el;
}

function editBookmark(bookmark) {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";
  dialog.innerHTML = `
    <div class="modal-content">
      <h3>Edit Bookmark</h3>
      <input type="text" id="edit-name" value="${escapeHtml(bookmark.name)}">
      <input type="text" id="edit-url" value="${escapeHtml(bookmark.url)}">
      <div class="modal-actions">
        <button class="cancel-btn">Cancel</button>
        <button id="save-edit" class="primary-btn">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const saveBtn = dialog.querySelector("#save-edit");
  const cancelBtn = dialog.querySelector(".cancel-btn");
  const nameInput = dialog.querySelector("#edit-name");
  const urlInput = dialog.querySelector("#edit-url");

  nameInput.focus();
  nameInput.select();

  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) {
      alert("Please fill in both name and URL");
      return;
    }

    try {
      new URL(url);
      bookmark.name = name;
      bookmark.url = url;
      saveData();
      renderCurrentView();
      document.body.removeChild(dialog);
    } catch (e) {
      alert("Please enter a valid URL");
    }
  });

  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(dialog);
  });

  dialog.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  });
}

function createFolder(parentId) {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";
  dialog.innerHTML = `
    <div class="modal-content">
      <h3>Create New Folder</h3>
      <input type="text" id="folder-name" placeholder="Folder Name">
      <div class="modal-actions">
        <button class="cancel-btn">Cancel</button>
        <button id="save-folder" class="primary-btn">Create</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const saveBtn = dialog.querySelector("#save-folder");
  const cancelBtn = dialog.querySelector(".cancel-btn");
  const nameInput = dialog.querySelector("#folder-name");

  nameInput.focus();

  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      alert("Please enter a folder name");
      return;
    }

    const newFolder = {
      id: Date.now().toString(),
      name: name,
      type: "folder",
      children: [],
      expanded: true,
    };

    const parent = findNodeById(bookmarksData.root, parentId);
    if (parent) {
      parent.children.push(newFolder);
      saveData();
      renderCurrentView();
    }
    document.body.removeChild(dialog);
  });

  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(dialog);
  });

  dialog.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  });
}

function deleteNode(nodeId) {
  const node = findNodeById(bookmarksData.root, nodeId);
  if (!node) return;

  const message =
    node.type === "folder"
      ? `Are you sure you want to delete the folder "${node.name}" and all its contents?`
      : `Are you sure you want to delete the bookmark "${node.name}"?`;

  if (!confirm(message)) return;

  const parent = findParentNode(bookmarksData.root, nodeId);
  if (parent) {
    parent.children = parent.children.filter((child) => child.id !== nodeId);
    saveData();
    renderCurrentView();
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toggleFolder(folder) {
  folder.expanded = !folder.expanded;
  saveData();
  renderCurrentView();
}

function initDragAndDrop() {
  document.addEventListener("dragstart", handleDragStart);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);
}

function handleDragStart(e) {
  if (e.target.classList.contains("node")) {
    e.dataTransfer.setData("text/plain", e.target.dataset.id);
    e.target.classList.add("dragging");
  }
}

function handleDragOver(e) {
  e.preventDefault();
  const target = e.target.closest(".node");
  if (target) {
    target.classList.add("drag-over");
    const afterElement = getDragAfterElement(target, e.clientY);
  }
}

function handleDragLeave(e) {
  const target = e.target.closest(".node");
  if (target) target.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  const target = e.target.closest(".node");
  const draggedId = e.dataTransfer.getData("text/plain");

  if (target) {
    const targetNode = findNodeById(bookmarksData.root, target.dataset.id);
    if (targetNode.type === "folder") {
      moveNode(draggedId, target.dataset.id);
    }
    target.classList.remove("drag-over");
  }
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const clearButton = document.querySelector(".search-clear");

  // Show/hide clear button based on search input
  if (query) {
    clearButton.style.display = "flex";
  } else {
    clearButton.style.display = "none";
  }

  if (!query) {
    renderCurrentView();
    return;
  }

  // Show search results in current view
  if (currentView === "tree") {
    const filteredData = structuredClone(bookmarksData);
    filterTree(filteredData.root, query);
    renderTree(filteredData.root, document.getElementById("tree"));
  } else {
    // For file view, show flat list of matching bookmarks
    const fileView = document.getElementById("file");
    const matchingBookmarks = searchBookmarks(bookmarksData.root, query);

    const gridHtml = matchingBookmarks
      .map((item) => {
        if (item.type === "bookmark") {
          return `
          <div class="file-item bookmark" data-id="${item.id}">
            <div class="actions">
              <button class="action-btn btn-edit" title="Edit Bookmark">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="action-btn btn-delete" title="Delete Bookmark">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <div class="icon-name-container">
              <i class="bi bi-bookmark"></i>
              <span class="name">${escapeHtml(item.name)}</span>
              <span class="url">${escapeHtml(new URL(item.url).hostname)}</span>
            </div>
          </div>
        `;
        }
        return "";
      })
      .join("");

    fileView.innerHTML = `<div class="file-grid">${gridHtml}</div>`;

    // Add click handlers for search results
    fileView.querySelectorAll(".file-item").forEach((item) => {
      const id = item.dataset.id;
      const node = findNodeById(bookmarksData.root, id);

      item.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          window.open(node.url, "_blank");
        }
      });

      item.querySelector(".btn-edit")?.addEventListener("click", (e) => {
        e.stopPropagation();
        editBookmark(node);
      });

      item.querySelector(".btn-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNode(id);
      });
    });
  }
}

function searchBookmarks(node, query) {
  let results = [];

  if (node.type === "bookmark") {
    if (
      node.name.toLowerCase().includes(query) ||
      node.url.toLowerCase().includes(query)
    ) {
      results.push(node);
    }
  }

  if (node.children) {
    node.children.forEach((child) => {
      results = results.concat(searchBookmarks(child, query));
    });
  }

  return results;
}

function filterTree(node, query) {
  node.children = node.children.filter((child) => {
    if (child.type === "folder") {
      const hasMatchingChildren = filterTree(child, query);
      return hasMatchingChildren || child.name.toLowerCase().includes(query);
    }
    return (
      child.name.toLowerCase().includes(query) ||
      child.url.toLowerCase().includes(query)
    );
  });
  return node.children.length > 0;
}

function moveNode(draggedId, targetId) {
  const draggedNode = findNodeById(bookmarksData.root, draggedId);
  const targetFolder = findNodeById(bookmarksData.root, targetId);
  const oldParent = findParentNode(bookmarksData.root, draggedId);

  if (targetFolder?.type === "folder" && targetFolder.id !== draggedId) {
    oldParent.children = oldParent.children.filter(
      (child) => child.id !== draggedId
    );
    targetFolder.children.push(draggedNode);
    saveData();
    renderCurrentView();
  }
}

function exportBookmarks() {
  const data = JSON.stringify(bookmarksData, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download(
    {
      url: url,
      filename: `bookmarks-${Date.now()}.json`,
    },
    () => URL.revokeObjectURL(url)
  );
}

function handleImport() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!importedData.root) throw new Error("Invalid format");

        showImportOptionsDialog(importedData);
      } catch (error) {
        alert("Error importing bookmarks: Invalid file format");
      }
    };

    reader.readAsText(file);
  });

  fileInput.click();
}

function showImportOptionsDialog(importedData) {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";

  // Get all folders for selection
  const folders = getAllFolders(bookmarksData.root);
  const folderOptions = folders
    .map(
      (folder) => `
    <div class="folder-select-item" data-id="${folder.id}">
      <i class="bi bi-folder"></i>
      <span>${escapeHtml(folder.name)}</span>
    </div>
  `
    )
    .join("");

  dialog.innerHTML = `
    <div class="modal-content">
      <h3>Import Bookmarks</h3>
      <div class="import-options">
        <div class="import-mode">
          <p class="option-label">Import Mode:</p>
          <label class="radio-option">
            <input type="radio" name="importMode" value="merge" checked>
            <span>Merge with existing bookmarks</span>
          </label>
          <label class="radio-option">
            <input type="radio" name="importMode" value="override">
            <span>Override all existing bookmarks</span>
          </label>
        </div>
        <div class="folder-name-input">
          <input type="text" id="new-folder-name" placeholder="New folder name (optional)">
        </div>
        <div class="folder-select-list">
          <p class="select-folder-text">Or select existing folder (optional):</p>
          ${folderOptions}
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-actions">
          <button class="cancel-btn">Cancel</button>
          <button id="import-confirm" class="primary-btn">Import</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const importBtn = dialog.querySelector("#import-confirm");
  const cancelBtn = dialog.querySelector(".cancel-btn");
  const newFolderInput = dialog.querySelector("#new-folder-name");
  const folderItems = dialog.querySelectorAll(".folder-select-item");
  const importModeInputs = dialog.querySelectorAll('input[name="importMode"]');

  let selectedFolderId = "root";

  // Handle folder selection
  folderItems.forEach((item) => {
    item.addEventListener("click", () => {
      folderItems.forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      selectedFolderId = item.dataset.id;
      newFolderInput.value = ""; // Clear new folder input when selecting existing folder
    });
  });

  importBtn.addEventListener("click", () => {
    const importMode = dialog.querySelector(
      'input[name="importMode"]:checked'
    ).value;
    const newFolderName = newFolderInput.value.trim();

    if (importMode === "override") {
      if (
        !confirm("This will delete all your existing bookmarks. Are you sure?")
      ) {
        return;
      }
      bookmarksData = importedData;
    } else {
      // Merge mode
      let targetFolderId = selectedFolderId;

      // If new folder name is provided, create new folder
      if (newFolderName) {
        const newFolder = {
          id: Date.now().toString(),
          name: newFolderName,
          type: "folder",
          children: [],
          expanded: true,
        };

        const parent = findNodeById(bookmarksData.root, selectedFolderId);
        parent.children.push(newFolder);
        targetFolderId = newFolder.id;
      }

      // Add imported bookmarks to target folder
      if (targetFolderId === "root") {
        bookmarksData.root.children = bookmarksData.root.children.concat(
          importedData.root.children
        );
      } else {
        const targetFolder = findNodeById(bookmarksData.root, targetFolderId);
        targetFolder.children = targetFolder.children.concat(
          importedData.root.children
        );
      }
    }

    saveData();
    // Reset navigation state
    currentPath = ["root"];
    navigationHistory = ["root"];
    currentHistoryIndex = 0;
    renderCurrentView();
    document.body.removeChild(dialog);
  });

  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(dialog);
  });

  dialog.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      importBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  });
}

function saveData() {
  chrome.storage.sync.set({ bookmarks: bookmarksData }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving bookmarks:", chrome.runtime.lastError);
      alert("Error saving bookmarks. Please try again.");
    }
  });
}

// Helper functions
function findNodeById(node, targetId) {
  if (node.id === targetId) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}

function findParentNode(node, targetId) {
  for (const child of node.children || []) {
    if (child.id === targetId) return node;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".node:not(.dragging)"),
  ];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function renderCurrentView() {
  const treeView = document.getElementById("tree");
  const fileView = document.getElementById("file");
  const fileNavigation = document.getElementById("file-navigation");

  if (currentView === "tree") {
    treeView.style.display = "block";
    fileView.style.display = "none";
    fileNavigation.style.display = "none";
    renderTree(bookmarksData.root, treeView);
  } else {
    treeView.style.display = "none";
    fileView.style.display = "block";
    fileNavigation.style.display = "flex";
    updateNavigationButtons();
    renderFileView();
  }
}

function renderFileView() {
  const fileView = document.getElementById("file");
  const breadcrumb = document.getElementById("breadcrumb");

  // Render breadcrumb with full path
  const breadcrumbHtml = currentPath
    .map((id, index) => {
      const node = findNodeById(bookmarksData.root, id);
      return `
      <div class="breadcrumb-item" data-id="${id}">
        <i class="bi bi-folder"></i>
        <span>${escapeHtml(node.name)}</span>
      </div>
      ${
        index < currentPath.length - 1
          ? '<div class="breadcrumb-separator">/</div>'
          : ""
      }
    `;
    })
    .join("");

  breadcrumb.innerHTML = breadcrumbHtml;

  // Get current folder from the last item in the path
  const currentFolder = findNodeById(
    bookmarksData.root,
    currentPath[currentPath.length - 1]
  );
  const gridHtml = currentFolder.children
    .map((item) => {
      if (item.type === "folder") {
        return `
        <div class="file-item folder" data-id="${item.id}">
          <div class="actions">
            <button class="action-btn btn-new-folder" title="Create New Folder">
              <i class="bi bi-folder-plus"></i>
            </button>
            <button class="action-btn btn-delete" title="Delete Folder">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <div class="icon-name-container">
            <i class="bi bi-folder"></i>
            <span class="name">${escapeHtml(item.name)}</span>
          </div>
        </div>
      `;
      } else {
        return `
        <div class="file-item bookmark" data-id="${item.id}">
          <div class="actions">
            <button class="action-btn btn-edit" title="Edit Bookmark">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="action-btn btn-delete" title="Delete Bookmark">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <div class="icon-name-container">
            <i class="bi bi-bookmark"></i>
            <span class="name">${escapeHtml(item.name)}</span>
            <span class="url">${escapeHtml(new URL(item.url).hostname)}</span>
          </div>
        </div>
      `;
      }
    })
    .join("");

  fileView.innerHTML = `<div class="file-grid">${gridHtml}</div>`;

  // Add click handlers
  fileView.querySelectorAll(".file-item").forEach((item) => {
    const id = item.dataset.id;
    const node = findNodeById(bookmarksData.root, id);

    if (node.type === "folder") {
      item.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          navigateToFolder(id);
        }
      });

      item.querySelector(".btn-new-folder")?.addEventListener("click", (e) => {
        e.stopPropagation();
        createFolder(id);
      });
    } else {
      item.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          window.open(node.url, "_blank");
        }
      });

      item.querySelector(".btn-edit")?.addEventListener("click", (e) => {
        e.stopPropagation();
        editBookmark(node);
      });
    }

    item.querySelector(".btn-delete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNode(id);
    });
  });

  // Add click handlers for breadcrumb
  breadcrumb.querySelectorAll(".breadcrumb-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      navigateToFolder(id);
    });
  });
}

// Helper function to get all folders
function getAllFolders(node, path = "") {
  let folders = [];
  if (node.type === "folder") {
    folders.push({
      id: node.id,
      name: path ? `${path} / ${node.name}` : node.name,
    });
    node.children.forEach((child) => {
      if (child.type === "folder") {
        folders = folders.concat(
          getAllFolders(child, path ? `${path} / ${node.name}` : node.name)
        );
      }
    });
  }
  return folders;
}

function navigateToFolder(folderId) {
  // Don't add root to history if we're already at root
  if (
    folderId === "root" &&
    currentPath[0] === "root" &&
    currentPath.length === 1
  ) {
    return;
  }

  // Remove forward history when navigating to a new path
  if (currentHistoryIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, currentHistoryIndex + 1);
  }

  // Build the full path to the target folder
  const path = [];
  let currentNode = findNodeById(bookmarksData.root, folderId);
  while (currentNode) {
    path.unshift(currentNode.id);
    currentNode = findParentNode(bookmarksData.root, currentNode.id);
  }

  navigationHistory.push(folderId);
  currentHistoryIndex = navigationHistory.length - 1;
  currentPath = path;

  updateNavigationButtons();
  renderFileView();
}

function updateNavigationButtons() {
  const navBack = document.getElementById("nav-back");
  const navForward = document.getElementById("nav-forward");
  const navUp = document.getElementById("nav-up");

  // Disable back button if at root or at the start of history
  navBack.disabled =
    currentHistoryIndex <= 0 ||
    (currentPath.length === 1 && currentPath[0] === "root");
  navForward.disabled = currentHistoryIndex >= navigationHistory.length - 1;
  navUp.disabled = currentPath.length <= 1;
}

function showSaveAllTabsDialog() {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";

  // Get all folders for selection
  const folders = getAllFolders(bookmarksData.root);
  const folderOptions = folders
    .map(
      (folder) => `
    <div class="folder-select-item" data-id="${folder.id}">
      <i class="bi bi-folder"></i>
      <span>${escapeHtml(folder.name)}</span>
    </div>
  `
    )
    .join("");

  dialog.innerHTML = `
      <div class="modal-content">
      <h3>Save All Tabs</h3>
      <div class="folder-name-input">
        <input type="text" id="new-folder-name" placeholder="New folder name (optional)">
      </div>
      <div class="folder-select-list">
        <p class="select-folder-text">Or select existing folder:</p>
        ${folderOptions}
      </div>
      <div class="modal-footer">
        <div class="modal-footer-actions">
        <button class="cancel-btn">Cancel</button>
          <button id="save-tabs" class="primary-btn">Save</button>
        </div>
      </div>
      </div>
    `;

  document.body.appendChild(dialog);

  const saveBtn = dialog.querySelector("#save-tabs");
  const cancelBtn = dialog.querySelector(".cancel-btn");
  const newFolderInput = dialog.querySelector("#new-folder-name");
  const folderItems = dialog.querySelectorAll(".folder-select-item");

  let selectedFolderId = "root";

  // Handle folder selection
  folderItems.forEach((item) => {
    item.addEventListener("click", () => {
      folderItems.forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      selectedFolderId = item.dataset.id;
      newFolderInput.value = ""; // Clear new folder input when selecting existing folder
    });
  });

  // Handle save button click
  saveBtn.addEventListener("click", () => {
    const newFolderName = newFolderInput.value.trim();

    // Get all open tabs
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      let targetFolderId = selectedFolderId;

      // If new folder name is provided or no folder is selected, create new folder
      if (newFolderName || selectedFolderId === "root") {
        const folderName = newFolderName || new Date().toLocaleString();
        const newFolder = {
          id: Date.now().toString(),
          name: folderName,
          type: "folder",
          children: [],
          expanded: true,
        };

        const parent = findNodeById(bookmarksData.root, selectedFolderId);
        parent.children.push(newFolder);
        targetFolderId = newFolder.id;
      }

      // Add all tabs as bookmarks
      tabs.forEach((tab) => {
        const bookmark = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: tab.title,
          url: tab.url,
          type: "bookmark",
        };

        const folder = findNodeById(bookmarksData.root, targetFolderId);
        folder.children.push(bookmark);
      });

      saveData();
      renderCurrentView();
      document.body.removeChild(dialog);
    });
  });

  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(dialog);
  });

  dialog.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  });
}

function showSaveSelectedTabsDialog() {
  // First, get all tabs to show selection
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const dialog = document.createElement("div");
    dialog.className = "modal-overlay";

    // Get all folders for selection
    const folders = getAllFolders(bookmarksData.root);
    const folderOptions = folders
      .map(
        (folder) => `
      <div class="folder-select-item" data-id="${folder.id}">
        <i class="bi bi-folder"></i>
        <span>${escapeHtml(folder.name)}</span>
      </div>
    `
      )
      .join("");

    // Create tabs selection list
    const tabsList = tabs
      .map(
        (tab) => `
      <div class="tab-select-item" data-id="${tab.id}">
        <label class="tab-checkbox">
          <input type="checkbox" checked>
          <span class="tab-info">
            <img src="${
              tab.favIconUrl || "bi bi-globe"
            }" class="tab-favicon" width="16" height="16">
            <span class="tab-title">${escapeHtml(tab.title)}</span>
          </span>
        </label>
      </div>
    `
      )
      .join("");

    dialog.innerHTML = `
      <div class="modal-content save-selected-tabs">
        <h3>Save Selected Tabs</h3>
        <div class="folder-name-input">
          <input type="text" id="new-folder-name" placeholder="New folder name (optional)">
        </div>
        <div class="folder-select-list">
          <p class="select-folder-text">Or select existing folder:</p>
          ${folderOptions}
        </div>
        <div class="tabs-select-list">
          <div class="tabs-select-header">
            <p class="select-tabs-text">Select tabs to save:</p>
            <div class="select-all-wrapper">
              <label class="tab-checkbox">
                <input type="checkbox" id="select-all-tabs" checked>
                <span>Select All</span>
              </label>
            </div>
          </div>
          ${tabsList}
        </div>
        <div class="modal-footer">
          <div class="modal-footer-actions">
            <button class="cancel-btn">Cancel</button>
            <button id="save-tabs" class="primary-btn">Save Selected</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const saveBtn = dialog.querySelector("#save-tabs");
    const cancelBtn = dialog.querySelector(".cancel-btn");
    const newFolderInput = dialog.querySelector("#new-folder-name");
    const folderItems = dialog.querySelectorAll(".folder-select-item");
    const selectAllCheckbox = dialog.querySelector("#select-all-tabs");
    const tabCheckboxes = dialog.querySelectorAll(
      ".tab-select-item input[type='checkbox']"
    );

    let selectedFolderId = "root";

    // Handle folder selection
    folderItems.forEach((item) => {
      item.addEventListener("click", () => {
        folderItems.forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");
        selectedFolderId = item.dataset.id;
        newFolderInput.value = ""; // Clear new folder input when selecting existing folder
      });
    });

    // Handle select all checkbox
    selectAllCheckbox.addEventListener("change", (e) => {
      tabCheckboxes.forEach((checkbox) => {
        checkbox.checked = e.target.checked;
      });
    });

    // Handle individual checkbox changes
    tabCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        selectAllCheckbox.checked = Array.from(tabCheckboxes).every(
          (cb) => cb.checked
        );
      });
    });

    // Handle save button click
    saveBtn.addEventListener("click", () => {
      const newFolderName = newFolderInput.value.trim();
      let targetFolderId = selectedFolderId;

      // If new folder name is provided or no folder is selected, create new folder
      if (newFolderName || selectedFolderId === "root") {
        const folderName = newFolderName || new Date().toLocaleString();
        const newFolder = {
          id: Date.now().toString(),
          name: folderName,
          type: "folder",
          children: [],
          expanded: true,
        };

        const parent = findNodeById(bookmarksData.root, selectedFolderId);
        parent.children.push(newFolder);
        targetFolderId = newFolder.id;
      }

      // Get selected tabs
      const selectedTabs = Array.from(tabCheckboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => {
          const tabItem = checkbox.closest(".tab-select-item");
          return tabs.find((tab) => tab.id.toString() === tabItem.dataset.id);
        });

      // Add selected tabs as bookmarks
      selectedTabs.forEach((tab) => {
        const bookmark = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: tab.title,
          url: tab.url,
          type: "bookmark",
        };

        const folder = findNodeById(bookmarksData.root, targetFolderId);
        folder.children.push(bookmark);
      });

      saveData();
      renderCurrentView();
      document.body.removeChild(dialog);
    });

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(dialog);
    });

    dialog.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        saveBtn.click();
      } else if (e.key === "Escape") {
        cancelBtn.click();
      }
    });
  });
}
