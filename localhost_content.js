// see - https://docs.google.com/document/d/1kbSELmkCa_X41sWa_pSdlWhqDW2PqwGmGu3PoqF8Otg/edit?usp=sharing
console.log('bt content script loaded');

// Setting the initial value
const state = localStorage.getItem('bt-extension-load');
if (!state) {
  localStorage.setItem('bt-extension-load', null);
}

function parseState(rawState) {
  if (rawState === 'true') {
    return true;
  }
  if (rawState === 'false') {
    return false;
  }
  return null;
}

function getState() {
  const rawState = localStorage.getItem('bt-extension-load');
  return parseState(rawState);
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
    sendResponse({ run: state });
  }
});

// Add this event listener to receive messages from the app
window.addEventListener(
  'message',
  event => {
    // Make sure the message is coming from the expected origin
    if (event.origin !== 'http://localhost:3000') return;

    // Handle the message from the app
    if (event.data.action === 'extensionLoadChanged') {
      // Forward the response to the background script if needed
      chrome.runtime.sendMessage({
        action: 'extensionLoadChanged',
        value: event.data.value,
      });
    }
  },
  false
);

// Add this function to handle localStorage changes
function handleStorageChange(event) {
  if (event.key === 'bt-extension-load') {
    // You can add more logic here to handle the change
    const state = parseState(event.newValue);
    chrome.runtime.sendMessage({
      action: 'extensionLoadChanged',
      value: state,
    });
  }
}

// Add event listener for storage changes
window.addEventListener('storage', handleStorageChange);
