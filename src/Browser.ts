import { getXPathForElement, showHighlight } from './helpers';
import { BrowserAction, BrowserState, ElementInfo } from './types';

export class Browser {
  state: BrowserState;
  lastImage?: Uint8Array;
  private boundHandleAction: (event: Event) => void;
  private boundHandleFrameNavigated: () => void;

  constructor() {
    this.state = {
      startedAt: Date.now(),
      time: 0,
      clicks: 0,
    };
    this.loadState().then(loadedState => {
      if (loadedState) this.state = loadedState;
    });
    this.boundHandleAction = this.handleAction.bind(this);
    this.boundHandleFrameNavigated = this.handleFrameNavigated.bind(this);
  }

  async loadState(): Promise<BrowserState | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get('browserState', (result) => {
        if (result.browserState) {
          resolve(JSON.parse(result.browserState));
        } else {
          resolve(null);
        }
      });
    });
  }

  async saveState() {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ browserState: JSON.stringify(this.state) }, () => {
        resolve();
      });
    });
  }

  updateScroll() {
    const size = {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    };
    this.changeState(state => {
      state.scrollSize = size;
    });
  }

  handleFrameNavigated() {
    this.lastImage = undefined;
    this.updateScroll();

    this.changeState(state => {
      state.url = window.location.href;
    });
  }

  contentUpdated() {
    try {
      // Get the DOM content
      const dom = document.documentElement.outerHTML;

      // const snapshot = await this.page.accessibility.snapshot({
      //   interestingOnly: true,
      // });

      // if (!snapshot) {
      //   throw Error('No accessibility snapshot');
      // }

      // const frame = this.page.mainFrame();
      // const framesPage = frame.page();

      // const snapshotWithIds = await addId(snapshot, framesPage);

      // const snapshotString = formatNode(snapshotWithIds);

      // Capture element bounding boxes
      const elementBoundingBoxes = this.captureElementBoundingBoxes();

      this.changeState(state => {
        state.dom = dom;
        // state.accessibilityTree = snapshotString;
        state.elementBoundingBoxes = elementBoundingBoxes;
      });

      this
    } catch (e) {
      console.debug('Error updating content', e);
    }
  }

  addEventListeners() {
    window.addEventListener('load', this.boundHandleFrameNavigated);
    window.addEventListener('click', this.boundHandleAction, { capture: true });
    window.addEventListener('keydown', this.boundHandleAction);
    window.addEventListener('keyup', this.boundHandleAction);
    window.addEventListener('resize', this.boundHandleAction);
    window.addEventListener('wheel', this.boundHandleAction);
  }

  removeEventListeners() {
    window.removeEventListener('load', this.boundHandleFrameNavigated);
    window.removeEventListener('click', this.boundHandleAction, { capture: true });
    window.removeEventListener('keydown', this.boundHandleAction);
    window.removeEventListener('keyup', this.boundHandleAction);
    window.removeEventListener('resize', this.boundHandleAction);
    window.removeEventListener('wheel', this.boundHandleAction);
  }

  handleAction = (event: Event) => {
    // Actions excluded from content update
    let browserAction: BrowserAction | null = null;
    const excludedActions = ['pointerMove', 'resize', 'render', 'wheel'];
    if (!excludedActions.includes(event.type)) {
      this.contentUpdated();
    }

    try {
      if (event.type === 'navigate') {
        browserAction = {
          type: 'navigate',
          url: window.location.href,
        };
      }

      if (event.type === 'popstate') {
        browserAction = {
          type: 'pageBack',
        };
      }

      if (event.type === 'reload') {
        browserAction = {
          type: 'pageReload',
        };
      }

      // if (event.type === "runCode") {
      //   await this.page.setContent(event.code);
      // }

      if (event.type === 'click') {

        browserAction = {
          type: 'click',
          position: {
            x: (event as MouseEvent).clientX,
            y: (event as MouseEvent).clientY,
          },
        };
        this.changeState(state => {
          state.clicks += 1;
        });
      }

      if (event.type === 'keydown') {
        browserAction = {
          type: 'keyDown',
          key: (event as KeyboardEvent).key,
        };
      }

      if (event.type === 'keyup') {
        browserAction = {
          type: 'keyUp',
          key: (event as KeyboardEvent).key,
        };
      }

      if (event.type === 'resize') {
        browserAction = {
          type: 'resize',
          size: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        };
      }

      if (event.type === 'wheel') {
        browserAction = {
          type: 'wheel',
          position: {
            x: (event as WheelEvent).clientX,
            y: (event as WheelEvent).clientY,
          },
          delta: {
            x: (event as WheelEvent).deltaX,
            y: (event as WheelEvent).deltaY,
          },
        };
      }

      if (event.type === 'mousemove') {
        const target = event.target as Element;

        if (target) showHighlight(target);
      }

      if (event.type === 'scroll') {
        const highlightedElement = document.elementFromPoint(
          window.innerWidth / 2,
          window.innerHeight / 2
        );
        if (highlightedElement) {
          showHighlight(highlightedElement);
        }
      }
    } catch (e) {
      console.debug('Error handling action', e);
    }
    // return state
    if (browserAction) {
      this.sendEventBrowserTrajectories(browserAction, this.state);
    }
  }

  changeState(updater: (state: BrowserState) => void) {
    updater(this.state);
    this.saveState();
  }

  captureElementBoundingBoxes(): ElementInfo[] {
    const interactableSelectors = [
      'a[href]:not(:has(img))',
      'a[href] img',
      'button',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[draggable="true"]',
      '.btn',
      'a[href="/notifications"]',
      'a[href="/submit"]',
      '.fa.fa-star.is-rating-item',
      'input[type="checkbox"]',
    ];

    const textSelectors = [
      'p',
      'span',
      'div:not(:has(*))',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li',
      'article',
    ];
    const modifiedTextSelectors = textSelectors.map(
      selector =>
        `:not(${interactableSelectors.join(', ')}):not(style) > ${selector}`
    );

    const combinedSelectors = [
      ...interactableSelectors,
      ...modifiedTextSelectors,
    ];
    const elements = document.querySelectorAll(combinedSelectors.join(', '));

    return Array.from(elements)
      .map(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        const isInteractable = interactableSelectors.some(selector =>
          el.matches(selector)
        );

        return {
          tagName: el.tagName,
          isInteractable,
          text: el.textContent?.trim().substring(0, 50) || null,
          alt:
            el instanceof HTMLElement
              ? el.getAttribute('alt') || undefined
              : undefined,
          className:
            el instanceof HTMLElement ? el.className || undefined : undefined,
          elementId: el instanceof HTMLElement ? el.id || undefined : undefined,
          boundingBox: {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
          },
          xpath: getXPathForElement(el),
        };
      })
      .filter((box): box is NonNullable<typeof box> => box !== null);
  }

  sendEventBrowserTrajectories(browserAction: BrowserAction, browserState: BrowserState) {
    console.log('sendEventBrowserTrajectories Browser', browserAction, browserState);
    chrome.runtime.sendMessage({
      action: 'sendEventToBrowserTrajectories',
      state: {
        browserAction,
        browserState,
      }
    });
  }
}