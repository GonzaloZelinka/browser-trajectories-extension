import { getElementInfo, getXPathForElement, showHighlight } from './helpers';
import { BrowserAction, BrowserState, ElementInfo, BrowserImage } from './types';

export class Browser {
  state: BrowserState;
  lastImage?: Uint8Array;
  private boundHandleAction: (event: Event) => void;
  private boundHandleScroll: () => void;
  private highlightThrottleTimeout: number | null = null;
  private captureScreenshotDebounced: () => void;
  private captureScreenshotTimeout: NodeJS.Timeout | null = null;
  private isCapturingScreenshot: boolean = false;

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
    this.boundHandleScroll = this.handleScroll.bind(this);
    this.captureScreenshotDebounced = this.debounce(this.captureScreenshot.bind(this), 250);

    // Add listener for messages from background script
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
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

  async contentUpdated() {
    console.log('contentUpdated');
    try {

      // Get the DOM content
      const dom = document.documentElement.outerHTML;

      const elementBoundingBoxes = this.captureElementBoundingBoxes();

      this.changeState(state => {
        state.dom = dom;
        state.elementBoundingBoxes = elementBoundingBoxes;
      });

      // Use the debounced capture screenshot
      this.captureScreenshotDebounced();
    } catch (e) {
      console.log('Error updating content', e);
    }
  }

  parseScreenshot(dataUrl: string): BrowserImage {
    return {
      timestamp: Date.now(),
      rect: {
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight
      },
      image: dataUrl
    }
  }

  async captureBrowserImage(): Promise<BrowserImage | undefined> {
    try {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error capturing screenshot:', chrome.runtime.lastError);
            resolve(undefined);
          } else if (response && response.image) {
            const image = this.parseScreenshot(response.image);
            resolve(image);
          } else {
            console.error('Invalid response from background script');
            resolve(undefined);
          }
        });
      });
    } catch (error) {
      console.error('Error in captureBrowserImage:', error);
      return undefined;
    }
  }

  async captureScreenshot() {
    if (this.isCapturingScreenshot) return;

    this.isCapturingScreenshot = true;

    try {
      const browserImage = await this.captureBrowserImage();
      if (browserImage) {
        this.changeState(state => {
          state.image = browserImage;
        });
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    } finally {
      this.isCapturingScreenshot = false;
    }
  }

  addEventListeners() {
    window.addEventListener('click', this.boundHandleAction, { capture: true });
    window.addEventListener('keydown', this.boundHandleAction);
    window.addEventListener('keyup', this.boundHandleAction);
    window.addEventListener('resize', this.boundHandleAction);
    window.addEventListener('wheel', this.boundHandleAction);
    window.addEventListener('scroll', this.boundHandleScroll);
    window.addEventListener('mouseover', this.boundHandleAction);
  }

  removeEventListeners() {
    window.removeEventListener('click', this.boundHandleAction, { capture: true });
    window.removeEventListener('keydown', this.boundHandleAction);
    window.removeEventListener('keyup', this.boundHandleAction);
    window.removeEventListener('resize', this.boundHandleAction);
    window.removeEventListener('wheel', this.boundHandleAction);
    window.removeEventListener('scroll', this.boundHandleScroll);
    window.removeEventListener('mouseover', this.boundHandleAction);
    if (this.highlightThrottleTimeout) {
      clearTimeout(this.highlightThrottleTimeout);
    }
  }

  handleAction = async (event: Event) => {
    // Actions excluded from content update
    let browserAction: BrowserAction | null = null;
    const excludedActions = ['mouseover', 'resize', 'render', 'wheel', 'scroll'];
    if (!excludedActions.includes(event.type)) {
      await this.contentUpdated();
    }

    try {
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
        const target = event.target as Element;
        const hoveredElement = getElementInfo(target);
        console.log('hoveredElement click', hoveredElement);
        this.changeState(state => {
          state.hoveredElement = hoveredElement;
          state.clicks += 1;
        });
      }

      if (event.type === 'keydown') {
        const target = event.target as Element;
        const hoveredElement = getElementInfo(target);
        console.log('hoveredElement keydown', hoveredElement);
        this.changeState(state => {
          state.hoveredElement = hoveredElement;
        });
        browserAction = {
          type: 'keyDown',
          key: (event as KeyboardEvent).key,
        };
      }

      if (event.type === 'keyup') {
        const target = event.target as Element;
        const hoveredElement = getElementInfo(target);
        console.log('hoveredElement keyup', hoveredElement);
        this.changeState(state => {
          state.hoveredElement = hoveredElement;
        });
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

      if (event.type === 'scroll') {
        const highlightedElement = document.elementFromPoint(
          window.innerWidth / 2,
          window.innerHeight / 2
        );
        if (highlightedElement) {
          showHighlight(highlightedElement);
        }
      }

      if (event.type === 'mouseover') {
        this.throttledShowHighlight(event.target as Element);
      }
    } catch (e) {
      console.debug('Error handling action', e);
    }
    // return state
    if (browserAction) {
      this.sendEventBrowserTrajectories(browserAction);
    }
  }

  handleScroll() {
    const highlightedElement = document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight / 2
    );
    if (highlightedElement) {
      this.throttledShowHighlight(highlightedElement);
    }
  }

  throttledShowHighlight(element: Element) {
    if (this.highlightThrottleTimeout) {
      clearTimeout(this.highlightThrottleTimeout);
    }
    this.highlightThrottleTimeout = window.setTimeout(() => {
      showHighlight(element);
      this.highlightThrottleTimeout = null;
    }, 5);
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

  sendEventBrowserTrajectories(browserAction: BrowserAction) {
    chrome.storage.local.set({
      state: JSON.stringify({
        browserAction,
        browserState: this.state
      }),
    });
  }

  private debounce(func: () => void, delay: number): () => void {
    return () => {
      if (this.captureScreenshotTimeout) {
        clearTimeout(this.captureScreenshotTimeout);
      }
      this.captureScreenshotTimeout = setTimeout(() => {
        func();
        this.captureScreenshotTimeout = null;
      }, delay);
    };
  }

  private handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    if (message.type === 'navigation-complete') {
      this.contentUpdated();
    }
  }
}