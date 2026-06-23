export function renderMarkdownPreview(value: string): string {
  const blocks = extractFencedBlocks(escapeHtml(value || ""));
  const html = blocks.text
    .split(/\n{2,}/)
    .map(renderBlock)
    .join("");

  return restoreFencedBlocks(html, blocks.fences).trim();
}

function renderBlock(block: string): string {
  const trimmed = block.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("__FENCE_")) return trimmed;
  if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) return "<hr>";

  const lines = trimmed.split("\n");
  if (lines.every((line) => line.startsWith("&gt;"))) {
    return `<blockquote>${renderMarkdownPreview(lines.map((line) => line.replace(/^&gt;\s?/, "")).join("\n"))}</blockquote>`;
  }
  if (isTable(lines)) return renderTable(lines);

  const rendered = inline(trimmed)
    .replace(/^#{6}\s*(.*)$/gm, "<h6>$1</h6>")
    .replace(/^#{5}\s*(.*)$/gm, "<h5>$1</h5>")
    .replace(/^#{4}\s*(.*)$/gm, "<h4>$1</h4>")
    .replace(/^#{3}\s*(.*)$/gm, "<h3>$1</h3>")
    .replace(/^#{2}\s*(.*)$/gm, "<h2>$1</h2>")
    .replace(/^#{1}\s*(.*)$/gm, "<h1>$1</h1>")
    .replace(/^\s*[-*+]\s+(.*)$/gm, "<li>$1</li>");

  const listLines = rendered.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (listLines.length && listLines.every((line) => line.startsWith("<li>") && line.endsWith("</li>"))) {
    return `<ul>${listLines.join("")}</ul>`;
  }
  if (rendered.startsWith("<h")) return rendered;
  return `<p>${rendered.replace(/\n/g, "<br>")}</p>`;
}

function extractFencedBlocks(value: string): { text: string; fences: string[] } {
  const fences: string[] = [];
  const text = value.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_match, language, code) => {
    const lang = String(language).trim().toLowerCase();
    const body = String(code).trimEnd();
    const html = lang === "mermaid"
      ? `<pre class="mermaid">${body}</pre>`
      : `<pre><code${lang ? ` class="language-${lang}"` : ""}>${body}</code></pre>`;
    const key = `__FENCE_${fences.length}__`;
    fences.push(html);
    return key;
  });
  return { text, fences };
}

function restoreFencedBlocks(value: string, fences: string[]): string {
  return value.replace(/__FENCE_(\d+)__/g, (_match, index) => fences[Number(index)] ?? "");
}

function isTable(lines: string[]): boolean {
  return lines.length >= 2 && /^\s*\|(.+\|)+\s*$/.test(lines[0]) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[1]);
}

function renderTable(lines: string[]): string {
  const rows = lines.map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => inline(cell.trim())));
  const headers = rows[0].map((cell) => `<th>${cell}</th>`).join("");
  const body = rows.slice(2).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
}

function inline(value: string): string {
  return value
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/!\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, alt, src) => {
      const safeSrc = String(src);
      return /^(https?:\/\/|mailto:|\/|#)/i.test(safeSrc) ? `<img alt="${alt}" src="${safeSrc}" class="markdown-image" loading="lazy">` : alt;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_match, label, href) => {
      const safeHref = String(href);
      return isSafeLinkTarget(safeHref) ? `<a href="${safeHref}" target="_blank" rel="noreferrer">${label}</a>` : label;
    });
}

function isSafeLinkTarget(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|file:|\/|#|\.{1,2}\/)/i.test(href) || !/^[a-z][a-z0-9+.-]*:/i.test(href);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
