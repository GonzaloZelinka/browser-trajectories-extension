import { BrowserAction, BrowserState, ElementInfo } from './types';
export declare class Browser {
    state: BrowserState;
    lastImage?: Uint8Array;
    constructor();
    updateScroll(): void;
    handleFrameNavigated(): void;
    contentUpdated(): Promise<void>;
    addEventListeners(): void;
    removeEventListeners(): void;
    handleAction(event: Event): Promise<void>;
    changeState(updater: (state: BrowserState) => void): void;
    captureElementBoundingBoxes(): ElementInfo[];
    sendEventBrowserTrajectories(browserAction: BrowserAction, browserState: BrowserState): void;
}
