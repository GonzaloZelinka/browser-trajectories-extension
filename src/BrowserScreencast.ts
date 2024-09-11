import { BrowserImage } from './types';

export class BrowserScreencast {
  private isCapturingScreenshot: boolean = false;
  private captureScreenshotTimeout: NodeJS.Timeout | null = null;

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

  async captureScreenshot(callback: (browserImage: BrowserImage) => void) {
    if (this.isCapturingScreenshot) return;

    this.isCapturingScreenshot = true;

    try {
      const browserImage = await this.captureBrowserImage();
      if (browserImage) {
        callback(browserImage);
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    } finally {
      this.isCapturingScreenshot = false;
    }
  }

  debouncedCaptureScreenshot(callback: (browserImage: BrowserImage) => void, delay: number): () => void {
    return () => {
      if (this.captureScreenshotTimeout) {
        clearTimeout(this.captureScreenshotTimeout);
      }
      this.captureScreenshotTimeout = setTimeout(() => {
        this.captureScreenshot(callback);
        this.captureScreenshotTimeout = null;
      }, delay);
    };
  }
}