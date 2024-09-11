import { ElementInfo } from './types';
import { getElementInfo, getXPathForElement, showHighlight } from './helpers';

export class BrowserHelper {
  private highlightThrottleTimeout: number | null = null;

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

  getElementInfo(element: Element): ElementInfo {
    return getElementInfo(element);
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

  handleScroll() {
    const highlightedElement = document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight / 2
    );
    if (highlightedElement) {
      this.throttledShowHighlight(highlightedElement);
    }
  }
}