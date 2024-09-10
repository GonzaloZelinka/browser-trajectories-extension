import { Browser } from "../Browser";
import { removeHighlight } from "../helpers";
console.log('Content script loaded');

let isTracking = false;
let browser: Browser | null = null;

initializeTracking();

async function startTracking() {
  if (!browser) {
    browser = new Browser();
  }
  isTracking = true;
  browser.addEventListeners();
}

function stopTracking() {
  isTracking = false;
  console.log('stopTracking');
  if (browser) {
    browser.removeEventListeners();
    browser = null;
  }
  removeHighlight();
}

async function initializeTracking() {
  const state = await getState();
  const originalTabId = await getTabId();
  const currentTabId = await getCurrentTabId();


  if (state && originalTabId) {
    const isDescendant = await checkIsDescendantTab(currentTabId, parseInt(originalTabId));
    if (isDescendant) {
      startTracking();
    } else {
      stopTracking();
    }
  } else {
    stopTracking();
  }
}

async function getState(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get('bt-extension-load', (result) => {
      resolve(result['bt-extension-load'] === 'true');
    });
  });
}

async function getTabId(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('extension-original-tab-id', (result) => {
      resolve(result['extension-original-tab-id'] || null);
    });
  });
}

async function getCurrentTabId(): Promise<number> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, (response) => {
      resolve(response.tabId);
    });
  });
}

async function checkIsDescendantTab(currentTabId: number, originalTabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'isDescendantTab', currentTabId, originalTabId },
      (response) => {
        resolve(response.isDescendant);
      }
    );
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && (changes['bt-extension-load'] || changes['extension-original-tab-id'])) {
    await initializeTracking();
  }
});
