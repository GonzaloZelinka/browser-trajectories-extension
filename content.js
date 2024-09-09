// see - https://docs.google.com/document/d/1kbSELmkCa_X41sWa_pSdlWhqDW2PqwGmGu3PoqF8Otg/edit?usp=sharing

console.log('Content script loaded');

let isTracking = false;

// Function to initialize tracking, used for page reload/navigation
function initializeTracking() {
  chrome.runtime.sendMessage(
    {
      action: 'shouldListenersRun',
    },
    response => {
      isTracking = response.run;
      if (isTracking) {
        addEventListeners();
      }
      // else {
      //   removeHighlight(); // Remove highlight when tracking is stopped
      // }
    }
  );
}

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
}

// listeners

function handleClick(event) {
  const browserAction = {
    type: 'click',
    position: {
      x: event.clientX,
      y: event.clientY,
    },
  };

  const rawEvent = {
    tagName: event.target.tagName,
    text: event.target.textContent || null,
    isInteractable: isInteractableElement(event.target),
    inputType: event.target.type || undefined,
    isChecked:
      event.target.checked !== undefined ? event.target.checked : undefined,
    selectedOptions:
      event.target.tagName === 'SELECT'
        ? Array.from(event.target.selectedOptions).map(option => option.value)
        : undefined,
    alt: event.target.alt || undefined,
    className: event.target.className || undefined,
    elementId: event.target.id || undefined,
    xPath: getXPathForElement(event.target),
  };

  sendEventBrowserTrajectories(browserAction, rawEvent);
}

function handleKeyDown(event) {
  const browserAction = {
    type: 'keyDown',
    key: event.key,
  };

  const rawEvent = {
    tagName: event.target.tagName,
    text: event.target.textContent || null,
    isInteractable: isInteractableElement(event.target),
    inputType: event.target.type || undefined,
    className: event.target.className || undefined,
    elementId: event.target.id || undefined,
    xPath: getXPathForElement(event.target),
  };

  sendEventBrowserTrajectories(browserAction, rawEvent);
}

function handleKeyUp(event) {
  const browserAction = {
    type: 'keyUp',
    key: event.key,
  };

  const rawEvent = {
    tagName: event.target.tagName,
    text: event.target.textContent || null,
    isInteractable: isInteractableElement(event.target),
    inputType: event.target.type || undefined,
    className: event.target.className || undefined,
    elementId: event.target.id || undefined,
    xPath: getXPathForElement(event.target),
  };

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
  const navigation = performance.getEntriesByType('navigation')[0];

  if (navigation.type === 'reload') {
    browserAction = {
      type: 'pageReload',
    };
  } else if (navigation.type === 'navigate') {
    console.log('navigation type', navigation.type);
    browserAction = {
      type: 'navigate',
      url: window.location.href,
    };
  }

  sendEventBrowserTrajectories(browserAction);
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

function isInteractableElement(element) {
  const interactableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  return interactableTags.includes(element.tagName) || element.onclick !== null;
}

//from https://stackoverflow.com/questions/2661818/javascript-get-xpath-of-a-node
function getXPathForElement(element) {
  const idx = (sib, name) =>
    sib
      ? idx(sib.previousElementSibling, name || sib.localName) +
        (sib.localName == name)
      : 1;
  const segs = elm =>
    !elm || elm.nodeType !== 1
      ? ['']
      : elm.id && document.getElementById(elm.id) === elm
      ? [`id("${elm.id}")`]
      : [
          ...segs(elm.parentNode),
          elm instanceof HTMLElement
            ? `${elm.localName}[${idx(elm)}]`
            : `*[local-name() = "${elm.localName}"][${idx(elm)}]`,
        ];
  return segs(element).join('/');
}

function sendEventBrowserTrajectories(browserAction, rawEvent) {
  chrome.runtime.sendMessage({
    action: 'sendEventToBrowserTrajectories',
    browserAction,
    rawEvent,
  });
}
