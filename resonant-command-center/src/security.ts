/**
 * Security utilities for safe DOM manipulation.
 * Whitelist-based HTML sanitizer — no external dependencies.
 */

/** Tags that are safe to preserve in innerHTML */
const ALLOWED_TAGS = new Set([
  'b', 'i', 'em', 'strong', 'p', 'br', 'hr',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code', 'span', 'div',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sup', 'sub', 'del', 'ins', 'mark', 'small',
]);

/** Attributes allowed on specific tags */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  '*': new Set(['class', 'id']),
};

/** Dangerous URL protocols */
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i;

/** Event handler attributes */
const EVENT_ATTR = /^on[a-z]+$/i;

/**
 * Sanitize an HTML string by stripping dangerous tags and attributes.
 * Preserves a whitelist of safe HTML elements.
 */
export function sanitize(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return '';

  sanitizeNode(container);
  return container.innerHTML;
}

function sanitizeNode(node: HTMLElement): void {
  // Check if tag is allowed
  const tag = node.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    // Replace dangerous tag with its text content
    const text = document.createTextNode(node.textContent || '');
    node.parentNode?.replaceChild(text, node);
    return;
  }

  // Check attributes
  const allowedForTag = ALLOWED_ATTRS[tag] || new Set();
  const globalAllowed = ALLOWED_ATTRS['*'] || new Set();

  for (let i = node.attributes.length - 1; i >= 0; i--) {
    const attr = node.attributes[i];
    const attrName = attr.name.toLowerCase();

    // Strip event handlers
    if (EVENT_ATTR.test(attrName)) {
      node.removeAttribute(attr.name);
      continue;
    }

    // Strip dangerous URL protocols
    if ((attrName === 'href' || attrName === 'src') && DANGEROUS_PROTOCOLS.test(attr.value)) {
      node.removeAttribute(attr.name);
      continue;
    }

    // Strip disallowed attributes
    if (!allowedForTag.has(attrName) && !globalAllowed.has(attrName)) {
      node.removeAttribute(attr.name);
    }
  }

  // Recurse into children (iterate backwards since we may remove nodes)
  for (let i = node.children.length - 1; i >= 0; i--) {
    sanitizeNode(node.children[i] as HTMLElement);
  }
}

/**
 * Escape all HTML entities in a string. Use this when inserting
 * user-controlled data into the DOM — prefer this over innerHTML.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Safely set innerHTML with sanitization.
 */
export function safeSetInnerHTML(el: HTMLElement, html: string): void {
  el.innerHTML = sanitize(html);
}

/**
 * Safely set text content (never parses HTML).
 */
export function safeSetText(el: HTMLElement, text: string): void {
  el.textContent = text;
}
