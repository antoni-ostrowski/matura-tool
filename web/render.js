/* Rendering helpers: markdown-ish content (LaTeX + images) → HTML. Pure, testable. */

export const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** KaTeX chokes on bare `\\` outside an environment; wrap display math that uses it. */
export function fixDisplayMath(md) {
  return md.replace(/\$\$([\s\S]*?)\$\$/g, (whole, body) => {
    if (!/\\\\/.test(body)) return whole;
    if (/\\begin\{/.test(body)) return whole;
    return `$$\\begin{aligned}${body}\\end{aligned}$$`;
  });
}

export function renderMath(tex, display) {
  try {
    return globalThis.katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<code>${esc(tex)}</code>`;
  }
}

/**
 * Render mixed markdown-ish content to HTML, rendering math **before** turning
 * newlines into <br> — explanations contain newlines inside `$$…$$`, and splitting
 * those across text nodes would break the delimiters.
 */
export function mdToHtml(md) {
  md = fixDisplayMath(md || "");
  const re =
    /!\[([^\]]*)\]\(([^)]+)\)|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(md))) {
    out += esc(md.slice(last, m.index)).replace(/\n/g, "<br>");
    if (m[1] !== undefined && m[2] !== undefined) {
      out += `<img class="fig" loading="lazy" src="${esc(m[2])}" alt="${esc(m[1])}">`;
    } else if (m[3] !== undefined) {
      out += renderMath(m[3].trim(), true);
    } else if (m[4] !== undefined) {
      out += renderMath(m[4].trim(), false);
    } else if (m[5] !== undefined) {
      out += renderMath(m[5].trim(), true);
    }
    last = re.lastIndex;
  }
  out += esc(md.slice(last)).replace(/\n/g, "<br>");
  return out;
}

export function renderRich(el, md) {
  el.innerHTML = mdToHtml(md || "");
}

/** Readable one-liner for the results list: keep math content, drop delimiters. */
export function plain(text) {
  return (text || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " [rysunek] ")
    .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
    .replace(/\\\(([\s\S]*?)\\\)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function highlight(text, words) {
  let html = esc(text);
  for (const w of words) {
    if (w.length < 2) continue;
    const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`(${safe})`, "gi"), "<mark>$1</mark>");
  }
  return html;
}
