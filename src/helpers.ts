// @ts-nocheck
import { SerializedAXNodeWithId } from "./src/types";


export function getXPathForElement(element: Element): string {
  if (!element) {
    return "";
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
        getXPathForElement(element.parentNode as Element) +
        '/' +
        element.tagName.toLowerCase() +
        '[' +
        (ix + 1) +
        ']'
      );
    }
    if (sibling.nodeType === 1 && sibling.nodeName === element.nodeName) {
      ix++;
    }
  }
  return '';
}

export function formatNode(
  node: SerializedAXNodeWithId,
  depth: number = 0,
): string {
  const indent = "  ".repeat(depth);
  const idPart = node.id !== undefined ? `[${node.id}] ` : "";
  const namePart = node.name ? `'${node.name}'` : "";

  // Add additional attributes that are not role, name, id, or children or elementHandle
  const additionalAttributes = Object.keys(node)
    .filter(
      (key) =>
        !["role", "name", "id", "children", "elementHandle"].includes(key),
    )
    .map((key) => `${key}: '${node[key]}'`)
    .join(" ");

  let line = `${indent}${idPart}${node.role} ${namePart}`;
  if (additionalAttributes) {
    line += ` ${additionalAttributes}`;
  }

  if (node.children && node.children.length > 0) {
    line +=
      "\n" +
      node.children.map((child) => formatNode(child, depth + 1)).join("\n");
  }

  return line;
}

export async function addIdHelper(
  node: SerializedAXNode,
  page: Page,
  idCounter: { currentId: number },
): Promise<SerializedAXNodeWithId> {
  let xpath = "";
  const elementHandle = await node.elementHandle();
  if (elementHandle) {
    xpath = await elementHandle.evaluate((element) => {
      return getXPathForElement(element);
    });
  }

  const { children, ...rest } = node; // Destructure to exclude 'skipField'

  const nodeWithId: SerializedAXNodeWithId = {
    ...rest, // Spread the rest of the fields
    id: idCounter.currentId++, // Assign current ID and then increment
    xpath,
  };

  if (node.children) {
    nodeWithId.children = await Promise.all(
      node.children.map(
        async (child) => await addIdHelper(child, page, idCounter), // Await the promise
      ),
    );
  }

  return nodeWithId;
}

export async function addId(
  node: SerializedAXNode,
  page: any,
  startingId: number = 1,
): Promise<SerializedAXNodeWithId> {
  const idCounter = { currentId: startingId }; // Initialize a counter object
  return await addIdHelper(node, page, idCounter); // Start the recursive process
}

export function showHighlight(element: Element) {
  let highlight = document.getElementById('bt-highlight');
  let label = document.getElementById('bt-highlight-label');
  if (!highlight) {
    highlight = document.createElement('div');
    highlight.id = 'bt-highlight';
    highlight.style.position = 'absolute';
    highlight.style.border = '2px solid red';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '9999';
    document.body.appendChild(highlight);
  }
  if (!label) {
    label = document.createElement('div');
    label.id = 'bt-highlight-label';
    label.style.position = 'absolute';
    label.style.backgroundColor = 'red';
    label.style.color = 'white';
    label.style.padding = '2px 5px';
    label.style.fontSize = '12px';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '10000';
    document.body.appendChild(label);
  }

  const rect = element.getBoundingClientRect();
  highlight.style.left = `${rect.left + window.scrollX}px`;
  highlight.style.top = `${rect.top + window.scrollY}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  label.textContent = `${element.tagName.toLowerCase()} - ${getXPathForElement(
    element
  )}`;
  if (element.id) {
    label.textContent += `#${element.id}`;
  } else if (element.className) {
    label.textContent += `.${element.className.split(' ')[0]}`;
  }
  label.style.left = `${rect.left + window.scrollX}px`;
  label.style.top = `${rect.top + window.scrollY - label.offsetHeight}px`;
}

export function removeHighlight() {
  const existingHighlight = document.getElementById('bt-highlight');
  const existingLabel = document.getElementById('bt-highlight-label');
  if (existingHighlight) {
    existingHighlight.remove();
  }
  if (existingLabel) {
    existingLabel.remove();
  }
}
