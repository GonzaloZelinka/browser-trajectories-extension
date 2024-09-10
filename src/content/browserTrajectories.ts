import { BrowserAction, BrowserState } from "../types";

console.log('bt content script loaded');

function parseState(rawState: string | null): boolean | null {
  console.log('parseState', rawState);
  if (rawState === 'null') {
    return null;
  }
  return rawState === 'true';

}

async function setTabId(newTabId: string): Promise<void> {
  await syncToStorage('extension-original-tab-id', newTabId);
}

async function removeTabId(): Promise<void> {
  localStorage.removeItem('extension-original-tab-id');
  await syncToStorage('extension-original-tab-id', null);
}

async function setState(newState: boolean | null): Promise<void> {
  localStorage.setItem('bt-extension-load', newState?.toString() ?? 'null');
  await syncToStorage('bt-extension-load', newState?.toString() ?? 'null');
}

async function syncToStorage(key: string, value: string | null): Promise<void> {
  return new Promise((resolve) => {
    console.log('syncToStorage', key, value);
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'forwardEventToBrowserTrajectories') {
    if (request?.event?.session !== undefined) {
      window.postMessage(
        {
          action: 'startSession',
          session: request.event.session,
        },
        '*'
      );
    } else if (request?.browserAction) {
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

    if ('error' in response) {
      throw new Error(response.error);
    }

    const newTabId = response.tabId;
    console.log('newTabId', newTabId);

    await setTabId(newTabId.toString());
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
      await setState(true);
    } else if (event.data.action === 'openTrackingTab') {
      console.log('openTrackingTab');
      await openTrackingTab();
    }
  },
  false
);

// Listen for localStorage changes
window.addEventListener('storage', async (event) => {
  console.log('storage', event);
  if (event.key === 'bt-extension-load') {
    const newState = parseState(event.newValue);
    await syncToStorage('bt-extension-load', event.newValue);
    if (newState === null) {
      await removeTabId();
      await setState(null);
      // await syncToStorage('browserState', null);
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


