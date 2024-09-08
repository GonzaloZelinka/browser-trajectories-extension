console.log('Background script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendEventToLocalhost') {
    chrome.tabs.query({ url: 'http://localhost:3000/*' }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: 'forwardEventToLocalhost',
            browserAction: request.browserAction,
            rawEvent: request.rawEvent,
          },
          response => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
            } else {
              console.log('Message sent successfully');
            }
          }
        );
      } else {
        console.log('No localhost:3000 tab found');
      }
    });
  } else if (request.action === 'extensionLoadChanged') {
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
              console.log('sending response');
              sendResponse(response);
            }
          }
        );
      } else {
        console.log('No localhost:3000 tab found');
        sendResponse({ run: false });
      }
    });
    return true; // Add this line to indicate that the response will be sent asynchronously
  }
});
