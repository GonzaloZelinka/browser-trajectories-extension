console.log('bt content script loaded');

const state = localStorage.getItem('bt-extension-load');
if (!state) {
  localStorage.setItem('bt-extension-load', 'false');
  syncToStorage('bt-extension-load', 'false');
}

function parseState(rawState: string | null): boolean {
  return rawState === 'true';
}

async function getState(): Promise<boolean> {
  return parseState(localStorage.getItem('bt-extension-load'));
}

async function getTabId(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('extension-original-tab-id', (result) => {
      resolve(result['extension-original-tab-id'] || null);
    });
  });
}

async function setTabId(newTabId: string): Promise<void> {
  await syncToStorage('extension-original-tab-id', newTabId);
}

async function removeTabId(): Promise<void> {
  localStorage.removeItem('extension-original-tab-id');
  await syncToStorage('extension-original-tab-id', null);
}

async function setState(newState: boolean): Promise<void> {
  localStorage.setItem('bt-extension-load', newState.toString());
  await syncToStorage('bt-extension-load', newState.toString());
}

async function syncToStorage(key: string, value: string | null): Promise<void> {
  console.log('syncToStorage', key, value);
  return new Promise((resolve) => {
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

async function startTracking() {
  try {
    // TODO - fix type
    const response: any = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'createNewTab', url: 'https://www.google.com' },
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
    await setState(true);
  } catch (error) {
    console.error('Error creating new tab:', error);
  }
}

// Add this event listener to receive messages from the app
window.addEventListener(
  'message',
  async event => {
    if (event.origin !== 'http://localhost:3000') return;

    if (event.data.action === 'extensionLoadChanged') {
      console.log('extensionLoadChanged', event.data);
      await startTracking();
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
    if (newState === false) {
      await removeTabId();
      await setState(false);
    }
  } else if (event.key === 'extension-original-tab-id') {
    await syncToStorage('extension-original-tab-id', event.newValue);
  }
});


