import { BrowserHelper } from './BrowserHelper';
import { BrowserScreencast } from './BrowserScreencast';
import { BrowserAction, BrowserState, BrowserImage } from './types';

export class Browser {
  state: BrowserState;
  lastImage?: Uint8Array;
  private boundHandleAction: (event: Event) => void;
  private boundHandleScroll: () => void;
  private captureScreenshotDebounced: () => void;
  private browserHelper: BrowserHelper;
  private browserScreencast: BrowserScreencast;

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

    this.browserHelper = new BrowserHelper();
    this.browserScreencast = new BrowserScreencast();

    this.captureScreenshotDebounced = this.browserScreencast.debouncedCaptureScreenshot(
      this.updateStateWithScreenshot.bind(this),
      250
    );

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

      const elementBoundingBoxes = this.browserHelper.captureElementBoundingBoxes();

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

  updateStateWithScreenshot(browserImage: BrowserImage) {
    this.changeState(state => {
      state.image = browserImage;
    });
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
        const hoveredElement = this.browserHelper.getElementInfo(target);
        console.log('hoveredElement click', hoveredElement);
        this.changeState(state => {
          state.hoveredElement = hoveredElement;
          state.clicks += 1;
        });
      }

      if (event.type === 'keydown') {
        const target = event.target as Element;
        const hoveredElement = this.browserHelper.getElementInfo(target);
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
        const hoveredElement = this.browserHelper.getElementInfo(target);
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
        this.browserHelper.handleScroll();
      }

      if (event.type === 'mouseover') {
        this.browserHelper.throttledShowHighlight(event.target as Element);
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
    this.browserHelper.handleScroll();
  }

  changeState(updater: (state: BrowserState) => void) {
    updater(this.state);
    this.saveState();
  }

  sendEventBrowserTrajectories(browserAction: BrowserAction) {
    chrome.storage.local.set({
      state: JSON.stringify({
        browserAction,
        browserState: this.state
      }),
    });
  }

  private handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    if (message.type === 'navigation-complete') {
      this.contentUpdated();
    }
  }
}