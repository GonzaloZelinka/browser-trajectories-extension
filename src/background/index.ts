// for puppeteer
// const connectionManager = new ConnectionManager();

import { Browser } from "../Browser";
import { checkOriginalTabId, getOriginalTabId, syncToStorage } from "../helpers";

const browser = new Browser();

console.log('Background script loaded');

let navigationStarted: boolean = false;


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
        await syncToStorage('extension-original-tab-id', newWindow.tabs[0].id);
        sendResponse({ success: true });
      } catch (error: any) {
        console.error('[createNewTab] Error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === 'captureScreenshot') {
    (async () => {
      if (!sender.tab || !sender.tab.id) {
        console.error('[captureScreenshot] No tabId found');
        return;
      }
      if (!await checkOriginalTabId(sender.tab.id)) {
        console.log('[captureScreenshot] Not original tab');
        return;
      }
      chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 40 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Error capturing screenshot:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          // Send the dataUrl directly
          sendResponse({ image: dataUrl });
        }
      });
    })();
    return true; // Indicates that the response will be sent asynchronously
  } else if (request.action === "getCurrentTabId") {
    sendResponse({ tabId: sender.tab?.id });
  } else if (request.action === 'closeTrackingTab') {
    console.log('closing tracking tab', request);
    (async () => {
      try {
        const originalTabId = await getOriginalTabId();
        console.log('closing tracking tab', originalTabId);
        if (originalTabId) {
          await new Promise<void>((resolve, reject) => {
            chrome.tabs.remove(originalTabId, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No tab ID found' });
        }
      } catch (error: any) {
        console.error('Error closing tab:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  }
});



chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.documentLifecycle !== 'active') return;

  if (details.transitionQualifiers.includes('from_address_bar') && details.transitionType === 'typed') {
    const isOriginalTab = await checkOriginalTabId(details.tabId);
    if (!isOriginalTab) return;
    browser.changeState(state => {
      state.url = details.url;
    })
    browser.sendEventBrowserTrajectories({
      type: 'navigate',
      url: details.url,
    });
    navigationStarted = true
  } else if (details.transitionType === 'reload') {
    const isOriginalTab = await checkOriginalTabId(details.tabId);
    if (!isOriginalTab) return;
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