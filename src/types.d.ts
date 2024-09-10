export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ElementInfo {
    tagName: string;
    text: string | null;
    boundingBox?: Rect;
    isInteractable?: boolean;
    inputType?: string;
    isChecked?: boolean;
    selectedOptions?: string[];
    alt?: string;
    className?: string;
    elementId?: string;
    xpath?: string;
}
export interface BrowserImage {
    timestamp: number;
    rect: Rect;
    image: ArrayBuffer;
}
export interface BrowserState {
    startedAt: number;
    time: number;
    clicks: number;
    isLoading?: boolean;
    url?: string;
    viewport?: {
        width: number;
        height: number;
    };
    scrollSize?: {
        width: number;
        height: number;
    };
    hoveredElement?: ElementInfo;
    image?: BrowserImage;
    dom?: string;
    accessibilityTree?: string;
    elementBoundingBoxes?: ElementInfo[];
}
export type BrowserAction = {
    type: "navigate";
    url: string;
} | {
    type: "render";
} | {
    type: "pageBack";
} | {
    type: "pageForward";
} | {
    type: "pageReload";
} | {
    type: "runCode";
    code: string;
} | {
    type: "resize";
    size: {
        width: number;
        height: number;
    };
} | {
    type: "click";
    position: {
        x: number;
        y: number;
    };
} | {
    type: "checkboxesAndRadios";
    inputType: string;
    checked: boolean;
} | {
    type: "selectOptions";
    selectOptions: string[];
} | {
    type: "pointerMove";
    position: {
        x: number;
        y: number;
    };
} | {
    type: "wheel";
    position: {
        x: number;
        y: number;
    };
    delta: {
        x: number;
        y: number;
    };
} | {
    type: "keyDown";
    key: string;
} | {
    type: "keyUp";
    key: string;
};
export interface SerializedAXNodeWithId extends SerializedAXNode {
    id: number;
    xpath: string;
    children?: SerializedAXNodeWithId[];
    [key: string]: any;
}
