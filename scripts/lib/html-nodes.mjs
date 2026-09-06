export function walkElements(node, elements = []) {
  if (node && typeof node === "object" && "tagName" in node) elements.push(node);
  for (const child of node?.childNodes ?? []) walkElements(child, elements);
  if (node?.content) walkElements(node.content, elements);
  return elements;
}

export function getAttribute(element, name) {
  return element.attrs?.find((attribute) => attribute.name === name)?.value;
}
