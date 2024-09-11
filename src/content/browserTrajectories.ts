import { syncToStorage } from "../helpers";
import { BrowserAction, BrowserState } from "../types";

console.log('bt content script loaded');

function parseState(rawState: string | null): boolean | null {
  if (rawState === 'null') {
    return null;
  }
  return rawState === 'true';

}

async function removeTabId(): Promise<void> {
  localStorage.removeItem('extension-original-tab-id');
  await syncToStorage('extension-original-tab-id', null);
}

async function setState(newState: boolean | null): Promise<void> {
  localStorage.setItem('bt-extension-load', newState?.toString() ?? 'null');
  await syncToStorage('bt-extension-load', newState?.toString() ?? 'null');
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'forwardEventToBrowserTrajectories') {
    if (request?.browserAction) {
      // Forward the event to the localhost application
      window.postMessage(
        {
          action: 'pageEvent',
          browserAction: request.browserAction,
          rawEvent: request.rawEvent,
        },
        '*'
      );
    }
    sendResponse({ success: true });
  }
});

async function openTrackingTab() {
  try {
    // TODO - fix type
    const response: any = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'createNewTab', url: 'about:blank' },
        response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });

    console.log('openTrackingTab', response);

    if ('error' in response) {
      throw new Error(response.error);
    }

    await setState(false);
  } catch (error) {
    console.error('Error creating new tab:', error);
  }
}
// Add this event listener to receive messages from the app
window.addEventListener(
  'message',
  async event => {
    if (event.origin !== 'http://localhost:3000' && event.origin !== 'https://browser.labeling.app') return;

    if (event.data.action === 'extensionLoadChanged') {
      const state = parseState(localStorage.getItem('bt-extension-load'));
      if (state) {
        await startTracking()
      } else {
        await stopTracking()
      }
    }
  },
  false
);

async function stopTracking() {
  await closeTrackingTab();
  await removeTabId();
  await setState(null);
  await syncToStorage('browserState', null);
}

async function startTracking() {
  await openTrackingTab();
  await setState(true);
}

// Listen for localStorage changes
window.addEventListener('storage', async (event) => {
  if (event.key === 'bt-extension-load') {
    const newState = parseState(event.newValue);
    await syncToStorage('bt-extension-load', event.newValue);
    if (newState === null) {
      await stopTracking()
    }
  } else if (event.key === 'extension-original-tab-id') {
    await syncToStorage('extension-original-tab-id', event.newValue);
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && 'state' in changes && changes.state) {
    const state = JSON.parse(changes.state.newValue) as { browserAction: BrowserAction, browserState: BrowserState };

    window.postMessage(
      {
        action: 'pageEvent',
        browserAction: state.browserAction,
        browserState: state.browserState
      },
      '*'
    );
  }

});

async function closeTrackingTab() {
  try {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'closeTrackingTab' }, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error occurred');
    }
  } catch (error) {
    console.error('Failed to close tracking tab:', error);
  }
}




