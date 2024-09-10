import { SerializedAXNodeWithId } from "./src/types";
export declare function getXPathForElement(element: Element): string;
export declare function formatNode(node: SerializedAXNodeWithId, depth?: number): string;
export declare function addIdHelper(node: SerializedAXNode, page: Page, idCounter: {
    currentId: number;
}): Promise<SerializedAXNodeWithId>;
export declare function addId(node: SerializedAXNode, page: any, startingId?: number): Promise<SerializedAXNodeWithId>;
export declare function showHighlight(element: Element): void;
export declare function removeHighlight(): void;
