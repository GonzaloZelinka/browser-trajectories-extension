// see - https://docs.google.com/document/d/1kbSELmkCa_X41sWa_pSdlWhqDW2PqwGmGu3PoqF8Otg/edit?usp=sharing

console.log('Content script loaded');

let isTracking = false;

// Add this line to initialize tracking when the script loads
initializeTracking();

// listen for activation/deactivation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startTracking') {
    isTracking = true;
    addEventListeners();
  } else if (request.action === 'stopTracking') {
    isTracking = false;
    removeEventListeners();
    removeHighlight(); // Remove highlight when tracking is stopped
  }
});

function addEventListeners() {
  document.addEventListener('click', handleClick, {
    capture: true,
  });
  window.addEventListener('resize', handleResize);
  window.addEventListener('wheel', handleWheel);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('load', checkNavigationType);
  // Add mousemove and scroll event listeners
  document.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('scroll', handleScroll);
  window.addEventListener('popstate', handleBack);
}

function removeEventListeners() {
  document.removeEventListener('click', handleClick, {
    capture: true,
  });
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('wheel', handleWheel);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  // Remove mousemove and scroll event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('popstate', handleBack);
}

// listeners

function handleBack(event) {
  // Determine if the user is going back or forward. We handle always back, because the user can click again in the link after to go forward.
  const browserAction = {
    type: 'pageBack',
  };

  sendEventBrowserTrajectories(browserAction);
}

function handleClick(event) {
  const browserAction = {
    type: 'click',
    position: {
      x: event.clientX,
      y: event.clientY,
    },
  };

  const rawEvent = getElementInfo(event.target);

  sendEventBrowserTrajectories(browserAction, rawEvent);
}

function handleKeyDown(event) {
  const browserAction = {
    type: 'keyDown',
    key: event.key,
  };

  const rawEvent = getElementInfo(event.target);

  sendEventBrowserTrajectories(browserAction, rawEvent);
}

function handleKeyUp(event) {
  const browserAction = {
    type: 'keyUp',
    key: event.key,
  };

  const rawEvent = getElementInfo(event.target);

  sendEventBrowserTrajectories(browserAction, rawEvent);
}

function handleResize(event) {
  const browserAction = {
    type: 'resize',
    size: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };

  sendEventBrowserTrajectories(browserAction);
}

function handleWheel(event) {
  const browserAction = {
    type: 'wheel',
    position: {
      x: event.clientX,
      y: event.clientY,
    },
    delta: {
      x: event.deltaX,
      y: event.deltaY,
    },
  };

  sendEventBrowserTrajectories(browserAction);
}

function checkNavigationType() {
  let browserAction;
  history.pushState(null, null, document.URL);
  const navigation = performance.getEntriesByType('navigation')[0];

  if (navigation.type === 'reload') {
    console.log('navigation type: reload');
    browserAction = {
      type: 'pageReload',
    };
  } else if (navigation.type === 'navigate') {
    console.log('navigation type: navigate');
    browserAction = {
      type: 'navigate',
      url: window.location.href,
    };
  }

  if (browserAction) {
    sendEventBrowserTrajectories(browserAction);
  }
}

function handleMouseMove(event) {
  if (!isTracking) return;

  const target = event.target;
  showHighlight(target);
}

function handleScroll() {
  if (!isTracking) return;

  const highlightedElement = document.elementFromPoint(
    window.innerWidth / 2,
    window.innerHeight / 2
  );
  if (highlightedElement) {
    showHighlight(highlightedElement);
  }
}

// element info - https://github.com/scaleapi/browser-trajectories/blob/main/src/server/browser/injected/injectGetElementInfo.ts
function getElementInfo(element) {
  let text = null;
  let inputType = undefined;
  let isChecked = undefined;
  let selectedOptions = undefined;

  if (element.hasAttribute('aria-label')) {
    text = element.getAttribute('aria-label');
  }

  if (element.tagName === 'IMG') {
    text = element.getAttribute('alt');
  }

  // check if select element and get all selected options
  if (element.tagName === 'OPTION') {
    const selectElement = element.parentElement;
    selectedOptions = Array.from(selectElement.selectedOptions).map(
      option => option.text
    );
  }

  if (element.tagName === 'INPUT') {
    text = element.value;
    inputType = element.type;
    // because hover element has the opposite of the actual value
    isChecked = !element.checked;
  }

  if (!text) {
    const textNodes = Array.from(element.childNodes).filter(
      node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );

    if (textNodes.length > 0) {
      text = textNodes.map(node => node.textContent?.trim()).join(' ');
    }
  }

  const rect = element.getBoundingClientRect();
  return {
    tagName: element.tagName,
    text,
    inputType,
    isChecked,
    selectedOptions,
    boundingBox: {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height,
    },
    elementId: element.id || undefined,
    xpath: getXPathForElement(element),
  };
}

// bounding box
function showHighlight(element) {
  removeHighlight(); // Remove any existing highlight

  const rect = element.getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.id = 'extension-highlight';
  highlight.style.position = 'fixed';
  highlight.style.border = '2px solid red';
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '9999';
  highlight.style.top = `${rect.top}px`;
  highlight.style.left = `${rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  const label = document.createElement('div');
  label.textContent = `${element.tagName.toLowerCase()} - ${getXPathForElement(
    element
  )}`;
  label.style.position = 'absolute';
  label.style.top = '-20px';
  label.style.left = '0';
  label.style.background = 'red';
  label.style.color = 'white';
  label.style.padding = '2px 4px';
  label.style.fontSize = '12px';
  label.style.whiteSpace = 'nowrap';
  label.style.overflow = 'hidden';
  label.style.textOverflow = 'ellipsis';
  label.style.maxWidth = '200px';

  highlight.appendChild(label);
  document.body.appendChild(highlight);
}

function removeHighlight() {
  const existingHighlight = document.getElementById('extension-highlight');
  if (existingHighlight) {
    existingHighlight.remove();
  }
}

// to ensure navigation events are captured
if (isTracking) {
  window.addEventListener('load', checkNavigationType);
}

// helpers

// Function to initialize tracking, used for page reload/navigation
function initializeTracking() {
  chrome.runtime.sendMessage(
    {
      action: 'shouldListenersRun',
    },
    response => {
      if (response.run) {
        // Send another message to get the current tab ID
        chrome.runtime.sendMessage(
          { action: 'getCurrentTabId' },
          tabIdResponse => {
            if (tabIdResponse.tabId.toString() === response.tabId) {
              isTracking = true;
              addEventListeners();
            } else {
              console.log('Current tab is not the target tab');
              isTracking = false;
            }
          }
        );
      } else {
        isTracking = false;
      }
    }
  );
}

function isInteractableElement(element) {
  const interactableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  return interactableTags.includes(element.tagName) || element.onclick !== null;
}

//from https://stackoverflow.com/questions/2661818/javascript-get-xpath-of-a-node
// function getXPathForElement(element) {
//   const idx = (sib, name) =>
//     sib
//       ? idx(sib.previousElementSibling, name || sib.localName) +
//         (sib.localName == name)
//       : 1;
//   const segs = elm =>
//     !elm || elm.nodeType !== 1
//       ? ['']
//       : elm.id && document.getElementById(elm.id) === elm
//       ? [`id("${elm.id}")`]
//       : [
//           ...segs(elm.parentNode),
//           elm instanceof HTMLElement
//             ? `${elm.localName}[${idx(elm)}]`
//             : `*[local-name() = "${elm.localName}"][${idx(elm)}]`,
//         ];
//   return segs(element).join('/');
// }

//from https://github.com/scaleapi/browser-trajectories/blob/main/src/server/browser/helpers/accessibilityTreeHelpers.ts
function getXPathForElement(element) {
  if (!element) {
    return '';
  }
  if (element.id !== '') {
    return `//*[@id="${element.id}"]`;
  }
  if (element === document.body) {
    return '/html/body';
  }

  let ix = 0;
  const siblings = element.parentNode ? element.parentNode.childNodes : [];
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) {
      return (
        getXPathForElement(element.parentNode) +
        '/' +
        element.tagName.toLowerCase() +
        '[' +
        (ix + 1) +
        ']'
      );
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
  return '';
}

function sendEventBrowserTrajectories(browserAction, rawEvent) {
  chrome.runtime.sendMessage({
    action: 'sendEventToBrowserTrajectories',
    browserAction,
    rawEvent,
  });
}
