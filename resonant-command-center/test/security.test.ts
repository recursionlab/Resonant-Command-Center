import { describe, it, expect } from 'vitest';
import { sanitize, escapeHtml, safeSetInnerHTML, safeSetText } from '../src/security';

describe('sanitize', () => {
  it('strips script tags from HTML strings', () => {
    const input = '<script>alert("xss")</script><p>Hello</p>';
    const result = sanitize(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips event handler attributes (onerror, onclick, etc.)', () => {
    const input = '<img src=x onerror="alert(1)">';
    const result = sanitize(input);
    expect(result).not.toContain('onerror');
  });

  it('strips javascript: protocol URLs', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitize(input);
    expect(result).not.toContain('javascript:');
  });

  it('preserves safe HTML like <b>, <i>, <p>, <br>', () => {
    const input = '<b>bold</b> <i>italic</i> <p>paragraph</p><br>';
    const result = sanitize(input);
    expect(result).toContain('<b>bold</b>');
    expect(result).toContain('<i>italic</i>');
    expect(result).toContain('<p>paragraph</p>');
    expect(result).toContain('<br>');
  });

  it('handles empty strings', () => {
    expect(sanitize('')).toBe('');
  });

  it('handles strings with no HTML', () => {
    expect(sanitize('just plain text')).toBe('just plain text');
  });
});

describe('escapeHtml', () => {
  it('escapes < and > characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("'hello'")).toBe('&#039;hello&#039;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('safeSetInnerHTML', () => {
  it('sets sanitized HTML on an element', () => {
    const div = document.createElement('div');
    safeSetInnerHTML(div, '<b>safe</b><script>alert(1)</script>');
    expect(div.innerHTML).toContain('<b>safe</b>');
    expect(div.innerHTML).not.toContain('<script>');
  });
});

describe('safeSetText', () => {
  it('sets text content without parsing HTML', () => {
    const div = document.createElement('div');
    safeSetText(div, '<b>not bold</b>');
    expect(div.textContent).toBe('<b>not bold</b>');
    expect(div.innerHTML).toBe('&lt;b&gt;not bold&lt;/b&gt;');
  });
});
