import { Browser } from "../Browser";
import { getExtensionState, getOriginalTabId, removeHighlight } from "../helpers";
console.log('Content script loaded');

let browser: Browser | null = null;

initializeTracking();

async function initializeTracking() {
  const state = await getExtensionState();
  const originalTabId = await getOriginalTabId();
  const currentTabId = await getCurrentTabId();

  if (originalTabId === currentTabId) {
    if (state) {
      if (!browser) {
        browser = new Browser();
      }
      browser.addEventListeners();
    } else {
      if (browser) {
        browser.removeEventListeners();
        browser = null;
      }
      removeHighlight();
    }
  }
}

// Add this new function to get the current tab ID
async function getCurrentTabId(): Promise<number> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getCurrentTabId" }, (response) => {
      resolve(response.tabId);
    });
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && (changes['bt-extension-load'] || changes['extension-original-tab-id'])) {
    await initializeTracking();
  }
});
