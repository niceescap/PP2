// ═══════════════════════════════════════════════════════════════
// Minimal XML parser for the test suite.
//
// Node has no DOMParser. The GPX parser only needs element traversal,
// attributes and text content, so this implements just that subset
// and plugs itself in through the `domParser` option.
// ═══════════════════════════════════════════════════════════════

class FakeElement {
  constructor(
    public tagName: string,
    public attributes: Record<string, string>,
    public children: FakeElement[] = [],
    public text: string = ''
  ) {}

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  get textContent(): string {
    if (this.children.length === 0) return this.text;
    return this.text + this.children.map(c => c.textContent).join('');
  }

  getElementsByTagName(tag: string): FakeElement[] {
    const out: FakeElement[] = [];
    const collect = (el: FakeElement) => {
      for (const child of el.children) {
        if (child.tagName === tag) out.push(child);
        collect(child);
      }
    };
    collect(this);
    return out;
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === 'parsererror') return null;
    return null;
  }
}

class FakeDocument {
  constructor(public root: FakeElement) {}

  get documentElement(): FakeElement {
    return this.root;
  }

  getElementsByTagName(tag: string): FakeElement[] {
    return this.root.getElementsByTagName(tag);
  }

  querySelector(selector: string): FakeElement | null {
    return this.root.querySelector(selector);
  }
}

/** Parse an XML string into the minimal element tree. */
export function parseXml(xml: string): XMLDocument {
  const stack: FakeElement[] = [];
  let root: FakeElement | null = null;

  const tagPattern = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const decode = (s: string) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

  while ((match = tagPattern.exec(xml)) !== null) {
    // Text content of the current element
    const text = xml.slice(lastIndex, match.index);
    if (stack.length > 0 && text.trim().length > 0) {
      stack[stack.length - 1].text += decode(text.trim());
    }
    lastIndex = tagPattern.lastIndex;

    const [full, closing, tag, attrPart, selfClosing] = match;
    if (full.startsWith('<?') || full.startsWith('<!--') || full.startsWith('<![CDATA[')) {
      continue;
    }

    if (closing) {
      if (stack.length > 0) stack.pop();
      continue;
    }

    const attributes: Record<string, string> = {};
    const attrPattern = /([\w.:-]+)\s*=\s*"([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrPattern.exec(attrPart || '')) !== null) {
      attributes[attrMatch[1]] = decode(attrMatch[2]);
    }

    const element = new FakeElement(tag, attributes);
    if (stack.length > 0) stack[stack.length - 1].children.push(element);
    else if (!root) root = element;

    if (!selfClosing) stack.push(element);
  }

  return new FakeDocument(root ?? new FakeElement('#document', {})) as unknown as XMLDocument;
}

/** Parser that reports a malformed document, like a browser DOMParser. */
export function parseXmlStrict(xml: string): XMLDocument {
  // Unbalanced tags mean the document is malformed.
  const opens = (xml.match(/<[A-Za-z_][\w.:-]*(?:\s[^>]*)?>/g) || []).length;
  const closes = (xml.match(/<\/[A-Za-z_][\w.:-]*>/g) || []).length;
  const selfClosing = (xml.match(/<[A-Za-z_][\w.:-]*(?:\s[^>]*)?\/>/g) || []).length;

  if (opens - closes - selfClosing !== 0) {
    throw new Error('Malformed XML');
  }
  return parseXml(xml);
}
