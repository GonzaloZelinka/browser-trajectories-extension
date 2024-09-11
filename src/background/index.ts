// for puppeteer
// const connectionManager = new ConnectionManager();

import { Browser } from "../Browser";

const browser = new Browser();

console.log('Background script loaded');

let tabTree: { [key: number]: number | null } = {};

let navigationStarted: boolean = false;

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId) {
    tabTree[tab.id!] = tab.openerTabId;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabTree[tabId];
});

async function isDescendantTab(currentTabId: number): Promise<boolean> {
  const originalTabId = await getOriginalTabId();
  let checkTabId: number | null = currentTabId;
  while (checkTabId) {
    if (checkTabId === originalTabId) {
      return true;
    }
    checkTabId = tabTree[checkTabId] || null;
  }
  return false;
}

function setOriginalTabId(tabId: number) {
  chrome.storage.local.set({ 'extension-original-tab-id': tabId });
}

async function getOriginalTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('extension-original-tab-id', (result) => {
      resolve(result['extension-original-tab-id'] || null);
    });
  });
}

async function getWindowIdForTab(tabId: number): Promise<number | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting tab:', chrome.runtime.lastError);
        resolve(undefined);
      } else {
        resolve(tab.windowId);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendEventToBrowserTrajectories') {
    chrome.tabs.query({ url: 'http://localhost:3000/*' }, tabs => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: 'forwardEventToBrowserTrajectories',
            browserAction: request.browserAction,
            rawEvent: request.rawEvent,
          },
          response => {
            if (chrome.runtime.lastError) {
              console.error(
                '[forwardEventToBrowserTrajectories] Error sending message:',
                chrome.runtime.lastError
              );
            } else {
              console.log(
                '[forwardEventToBrowserTrajectories] Message sent successfully'
              );
            }
          }
        );
      }
    });
  } else if (request.action === 'createNewTab') {
    (async () => {
      try {
        const newWindow = await chrome.windows.create({ url: request.url, focused: true });
        if (!newWindow || !newWindow.tabs || !newWindow.tabs[0].id) {
          throw new Error('No tabId found');
        }
        setOriginalTabId(newWindow.tabs[0].id);
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('[createNewTab] Error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === 'captureScreenshot') {
    if (!sender.tab || !sender.tab.id) {
      console.error('[captureScreenshot] No tabId found');
      return;
    }
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error capturing screenshot:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        // Send the dataUrl directly
        sendResponse({ image: dataUrl });
      }
    });
    return true; // Indicates that the response will be sent asynchronously
  } else if (request.action === 'isDescendantTab') {
    const currentTabId = sender.tab?.id
    if (!currentTabId) {
      console.error('[isDescendantTab] No tabId found');
      return;
    }
    const isDescendant = isDescendantTab(currentTabId);
    sendResponse({ isDescendant });
    return true;
  }
});

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.documentLifecycle !== 'active') return;

  if (details.transitionQualifiers.includes('from_address_bar') && details.transitionType === 'typed') {
    const isDescendant = await isDescendantTab(details.tabId);
    if (!isDescendant) return;
    browser.changeState(state => {
      state.url = details.url;
    })
    browser.sendEventBrowserTrajectories({
      type: 'navigate',
      url: details.url,
    });
    navigationStarted = true
  } else if (details.transitionType === 'reload') {
    const isDescendant = await isDescendantTab(details.tabId);
    if (!isDescendant) return;
    browser.sendEventBrowserTrajectories({
      type: 'pageReload',
    });
  }

})

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0 && navigationStarted) {  // Only for main frame
    chrome.tabs.sendMessage(details.tabId, { type: 'navigation-complete' });
    navigationStarted = false;
  }
});