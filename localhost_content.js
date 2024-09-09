// see - https://docs.google.com/document/d/1kbSELmkCa_X41sWa_pSdlWhqDW2PqwGmGu3PoqF8Otg/edit?usp=sharing
console.log('bt content script loaded');

// Setting the initial value
const state = localStorage.getItem('bt-extension-load');
if (!state) {
  localStorage.setItem('bt-extension-load', false);
}

function parseState(rawState) {
  if (rawState === 'true') {
    return true;
  }
  return false;
}

function getState() {
  const rawState = localStorage.getItem('bt-extension-load');
  return parseState(rawState);
}

function getTabId() {
  return localStorage.getItem('extension-original-tab-id');
}

function setTabId(newTabId) {
  localStorage.setItem('extension-original-tab-id', newTabId.toString());
}

function removeTabId() {
  localStorage.removeItem('extension-original-tab-id');
}

function setState(newState) {
  localStorage.setItem('bt-extension-load', newState);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
  } else if (request.action === 'shouldListenersRun') {
    const state = getState();
    const tabId = getTabId();
    sendResponse({ run: state, tabId });
  }
});

function startTracking() {
  chrome.runtime.sendMessage(
    { action: 'createNewTab', url: 'https://www.google.com' },
    newTabId => {
      if (chrome.runtime.lastError) {
        console.error('Error creating new tab:', chrome.runtime.lastError);
        return;
      }

      // Store the tab ID in localStorage
      setTabId(newTabId);

      // Forward the response to the background script with the tabId
      chrome.runtime.sendMessage({
        action: 'extensionLoadChanged',
        tabId: newTabId,
      });
    }
  );
}

// Add this event listener to receive messages from the app
window.addEventListener(
  'message',
  event => {
    // Make sure the message is coming from the expected origin
    if (event.origin !== 'http://localhost:3000') return;

    // Handle the message from the app
    if (event.data.action === 'extensionLoadChanged') {
      // Forward the response to the background script if needed
      startTracking();
    }
  },
  false
);

// Add this function to handle localStorage changes
function handleStorageChange(event) {
  if (event.key === 'bt-extension-load') {
    const state = parseState(event.newValue);
    if (state === false) {
      removeTabId();
      chrome.runtime.sendMessage({
        action: 'extensionLoadChanged',
        value: state,
      });
    } else if (state === true) {
      startTracking();
    }
  }
}

// Add event listener for storage changes
window.addEventListener('storage', handleStorageChange);
