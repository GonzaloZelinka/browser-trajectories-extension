
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

export function showHighlight(element: Element) {
  let highlight = document.getElementById('bt-highlight');
  // let label = document.getElementById('bt-highlight-label');
  if (!highlight) {
    highlight = document.createElement('div');
    highlight.id = 'bt-highlight';
    highlight.style.position = 'absolute';
    highlight.style.border = '2px solid red';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '9999';
    document.body.appendChild(highlight);
  }
  // if (!label) {
  //   label = document.createElement('div');
  //   label.id = 'bt-highlight-label';
  //   label.style.position = 'absolute';
  //   label.style.backgroundColor = 'red';
  //   label.style.color = 'white';
  //   label.style.padding = '2px 5px';
  //   label.style.fontSize = '12px';
  //   label.style.pointerEvents = 'none';
  //   label.style.zIndex = '10000';
  //   document.body.appendChild(label);
  // }

  const rect = element.getBoundingClientRect();
  highlight.style.left = `${rect.left + window.scrollX}px`;
  highlight.style.top = `${rect.top + window.scrollY}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  // label.textContent = `${element.tagName.toLowerCase()} - ${getXPathForElement(
  //   element
  // )}`;
  // if (element.id) {
  //   label.textContent += `#${element.id}`;
  // } else if (element.className) {
  //   label.textContent += `.${element.className.split(' ')[0]}`;
  // }
  // label.style.left = `${rect.left + window.scrollX}px`;
  // label.style.top = `${rect.top + window.scrollY - label.offsetHeight}px`;
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

export function getElementInfo(element: Element) {
  let text: string | null = null;
  let inputType: string | undefined = undefined;
  let isChecked: boolean | undefined = undefined;
  let selectedOptions: string[] | undefined = undefined;

  if (element.hasAttribute("aria-label")) {
    text = element.getAttribute("aria-label");
  }

  if (element.tagName === "IMG") {
    text = element.getAttribute("alt");
  }

  // check if select element and get all selected options
  if (element.tagName === "OPTION") {
    const selectElement = element.parentElement as HTMLSelectElement;
    selectedOptions = Array.from(
      (selectElement as HTMLSelectElement).selectedOptions,
    ).map((option) => option.text);
  }

  if (element.tagName === "INPUT") {
    text = (element as HTMLInputElement).value;
    inputType = (element as HTMLInputElement).type;
    // because hover element has the opposite of the actual value
    isChecked = !(element as HTMLInputElement).checked;
  }

  if (!text) {
    const textNodes = Array.from(element.childNodes).filter(
      (node) =>
        node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );

    if (textNodes.length > 0) {
      text = textNodes.map((node) => node.textContent?.trim()).join(" ");
    }
  }

  const rect = element.getBoundingClientRect();
  return {
    tagName: element.tagName,
    text,
    inputType,
    isChecked,
    selectedOptions,
    boundingBox: {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height,
    },
    elementId: element.id || undefined,
    xpath: getXPathForElement(element),
  };
};
