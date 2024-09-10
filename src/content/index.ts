import { Browser } from "../Browser";
import { removeHighlight } from "../helpers";
console.log('Content script loaded');

let isTracking = false;
let browser: Browser | null = null;

initializeTracking();

function startTracking() {
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
  const originalTabId = await getOriginalTabId();
  const currentTabId = await getCurrentTabId();

  if (state && await isDescendantTab(currentTabId, originalTabId)) {
    startTracking();
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

async function getOriginalTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('extension-original-tab-id', (result) => {
      resolve(result['extension-original-tab-id'] ? parseInt(result['extension-original-tab-id']) : null);
    });
  });
}

async function isDescendantTab(currentTabId: number, originalTabId: number | null): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'isDescendantTab', currentTabId, originalTabId }, (response) => {
      resolve(response.isDescendant);
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

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && (changes['bt-extension-load'] || changes['extension-original-tab-id'])) {
    await initializeTracking();
  }
});
