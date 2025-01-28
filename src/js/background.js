// background.js
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: "saveToBookmarkFolder",
    title: "Save to Explorer Bookmark ",
    contexts: ["page", "link"],
  });

  // Create right-click menu for extension icon
  chrome.contextMenus.create({
    id: "openRootFolder",
    title: "Open Bookmark Manager",
    contexts: ["action"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveToBookmarkFolder") {
    const bookmarkInfo = {
      title: tab.title,
      url: info.linkUrl || info.pageUrl,
    };

    // Store temporarily
    chrome.storage.local.set(
      {
        pendingBookmark: bookmarkInfo,
      },
      () => {
        // Open the popup to save the bookmark
        chrome.action.openPopup();
      }
    );
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPendingBookmark") {
    chrome.storage.local.get(["pendingBookmark"], (result) => {
      sendResponse(result.pendingBookmark || null);
      // Clear the pending bookmark after sending
      chrome.storage.local.remove("pendingBookmark");
    });
    return true; // Will respond asynchronously
  }
});
