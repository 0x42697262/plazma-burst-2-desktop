export function el<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, style: Partial<CSSStyleDeclaration> | Readonly<Record<string, string>>, text?: string): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  Object.assign(element.style, style);
  if (text !== undefined) element.textContent = text;
  return element;
}
