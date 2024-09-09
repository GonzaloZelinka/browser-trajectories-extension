// see - https://docs.google.com/document/d/1kbSELmkCa_X41sWa_pSdlWhqDW2PqwGmGu3PoqF8Otg/edit?usp=sharing

console.log('Background script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendEventToBrowserTrajectories') {
    chrome.tabs.query({ url: 'http://localhost:3000/*' }, tabs => {
      if (tabs.length > 0) {
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
  } else if (request.action === 'extensionLoadChanged') {
    // send this message to all the tabs.
    if (request.value) {
      chrome.tabs.query({}, tabs =>
        tabs.forEach(t => {
          chrome.tabs.sendMessage(t.id, { action: 'startTracking' });
        })
      );
    } else if (request.value === false) {
      chrome.tabs.query({}, tabs =>
        tabs.forEach(t => {
          chrome.tabs.sendMessage(t.id, { action: 'stopTracking' });
        })
      );
    }
  } else if (request.action === 'shouldListenersRun') {
    chrome.tabs.query({ url: 'http://localhost:3000/*' }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: 'shouldListenersRun',
          },
          response => {
            if (chrome.runtime.lastError) {
              console.error(
                '[shouldListenersRun] Error sending message:',
                chrome.runtime.lastError
              );
              sendResponse({ run: false });
            } else {
              console.log('[shouldListenersRun] sending response');
              sendResponse(response);
            }
          }
        );
      } else {
        console.log('[shouldListenersRun] No browser trajectories tab found');
        sendResponse({ run: false });
      }
    });
    return true; // Add this line to indicate that the response will be sent asynchronously
  }
});
