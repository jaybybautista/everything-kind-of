export function sanitizeChapter(html) {
  const document = new DOMParser().parseFromString(html || '', 'text/html');
  document.querySelectorAll('script,style,iframe,object,embed,svg,math,template').forEach(node => node.remove());
  const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR', 'PRE', 'CODE', 'A']);
  [...document.body.querySelectorAll('*')].forEach(node => {
    if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
    const href = node.tagName === 'A' ? node.getAttribute('href') : null;
    [...node.attributes].forEach(attribute => node.removeAttribute(attribute.name));
    if (href && /^(https?:|mailto:)/i.test(href)) { node.setAttribute('href', href); node.setAttribute('rel', 'noopener noreferrer'); }
  });
  return document.body.innerHTML;
}
export function resolveAnchor(text, anchor) {
  if (!anchor?.quote) return null;
  if (text.slice(anchor.start, anchor.end) === anchor.quote) return { start: anchor.start, end: anchor.end };
  const matches = [];
  for (let at = text.indexOf(anchor.quote); at >= 0; at = text.indexOf(anchor.quote, at + 1)) {
    const end = at + anchor.quote.length;
    const score = (anchor.prefix && text.slice(Math.max(0, at - anchor.prefix.length), at) === anchor.prefix ? 1 : 0) + (anchor.suffix && text.slice(end, end + anchor.suffix.length) === anchor.suffix ? 1 : 0);
    matches.push({ start: at, end, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.length === 1 || (matches[0]?.score > (matches[1]?.score || 0)) ? matches[0] : null;
}
export function highlightPassages(safeHtml, threads) {
  const parsed = new DOMParser().parseFromString(safeHtml, 'text/html');
  const text = parsed.body.textContent;
  const ranges = threads.map(thread => ({ id: thread.id, ...resolveAnchor(text, thread.anchor) })).filter(range => Number.isInteger(range.start));
  const walker = parsed.createTreeWalker(parsed.body, 4);
  const nodes = []; let node; let offset = 0;
  while ((node = walker.nextNode())) { nodes.push({ node, start: offset, end: offset + node.textContent.length }); offset += node.textContent.length; }
  for (const entry of nodes) {
    const overlaps = ranges.filter(range => range.start < entry.end && range.end > entry.start);
    if (!overlaps.length) continue;
    const stops = [...new Set([entry.start, entry.end, ...overlaps.flatMap(range => [Math.max(range.start, entry.start), Math.min(range.end, entry.end)])])].sort((a, b) => a - b);
    const fragment = parsed.createDocumentFragment();
    for (let i = 0; i < stops.length - 1; i++) {
      const content = entry.node.textContent.slice(stops[i] - entry.start, stops[i + 1] - entry.start);
      const ids = overlaps.filter(range => range.start <= stops[i] && range.end >= stops[i + 1]).map(range => range.id);
      if (!ids.length) fragment.append(parsed.createTextNode(content));
      else { const mark = parsed.createElement('mark'); mark.dataset.threadIds = ids.join(' '); mark.textContent = content; mark.title = 'Open passage conversation'; fragment.append(mark); }
    }
    entry.node.replaceWith(fragment);
  }
  return parsed.body.innerHTML;
}
export function selectedPassage(root) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const prefix = range.cloneRange(); prefix.selectNodeContents(root); prefix.setEnd(range.startContainer, range.startOffset);
  const raw = range.toString(); const quote = raw.trim();
  if (!quote || quote.length > 500) return null;
  const start = prefix.toString().length + raw.indexOf(quote);
  return { start, end: start + quote.length, quote };
}
export function tappedWord(root, x, y) {
  let range;
  if (document.caretPositionFromPoint) { const caret = document.caretPositionFromPoint(x, y); if (caret) { range = document.createRange(); range.setStart(caret.offsetNode, caret.offset); } }
  else if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
  if (!range || !root.contains(range.startContainer)) return null;
  const prefix = range.cloneRange(); prefix.selectNodeContents(root); prefix.setEnd(range.startContainer, range.startOffset);
  const text = root.textContent; let start = prefix.toString().length; let end = start;
  const word = character => character && /[\p{L}\p{N}'’-]/u.test(character);
  while (start > 0 && word(text[start - 1])) start--;
  while (end < text.length && word(text[end])) end++;
  return start < end && end - start <= 500 ? { start, end, quote: text.slice(start, end) } : null;
}
