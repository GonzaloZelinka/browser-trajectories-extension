// for puppeteer
// const connectionManager = new ConnectionManager();

console.log('Background script loaded');

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
        console.log('createNewTab', newWindow.tabs[0].id);
        sendResponse({ tabId: newWindow.tabs[0].id });
      } catch (error: any) {
        console.error('[createNewTab] Error:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === 'getCurrentTabId') {
    if (!sender.tab || !sender.tab.id) {
      console.error('[getCurrentTabId] No tabId found');
      return;
    }
    sendResponse({ tabId: sender.tab.id });
  } else if (request.action === 'captureScreenshot') {
    if (!sender.tab || !sender.tab.id) {
      console.error('[captureScreenshot] No tabId found');
      return;
    }
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error capturing screenshot:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log('captureScreenshot', dataUrl);
        // Send the dataUrl directly
        sendResponse({ image: dataUrl });
      }
    });
    return true; // Indicates that the response will be sent asynchronously
  }
});
