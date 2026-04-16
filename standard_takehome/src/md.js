// Tiny browser markdown renderer. No dependencies, no build step.
// Handles what solution README files actually use: headings, paragraphs, fenced
// + inline code, ordered/unordered lists, blockquotes, bold/italic, links,
// horizontal rules, and GitHub-style pipe tables.
//
// Not a spec-compliant CommonMark parser — just enough to render reviewer-
// facing solution notes legibly.

export function renderMarkdown(md) {
  if (!md) return "";
  md = md.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  const fences = [];
  md = md.replace(/^```([^\n]*)\n([\s\S]*?)^```/gm, (_, lang, code) => {
    fences.push({ lang: lang.trim(), code });
    return `\u0000FENCE${fences.length - 1}\u0000`;
  });

  const lines = md.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fm = line.match(/^\u0000FENCE(\d+)\u0000$/);
    if (fm) {
      const f = fences[parseInt(fm[1], 10)];
      const cls = f.lang ? ` class="lang-${esc(f.lang)}"` : "";
      out.push(`<pre><code${cls}>${esc(f.code)}</code></pre>`);
      i++;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[-:\s|]+\|\s*$/.test(lines[i + 1])) {
      const header = row(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(row(lines[i]));
        i++;
      }
      const th = header.map(c => `<th>${inline(c)}</th>`).join("");
      const body = rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }

    if (/^[*-]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const ordered = /^\d+\.\s/.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\.\s/.test(lines[i]) : /^[*-]\s/.test(lines[i]))) {
        items.push(lines[i].replace(/^(?:[*-]|\d+\.)\s+/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map(it => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const qlines = [];
      while (i < lines.length && /^>/.test(lines[i])) {
        qlines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(qlines.join("\n"))}</blockquote>`);
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const plines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|---|\|.*\||[*-]\s|\d+\.\s|>\s)/.test(lines[i]) &&
      !/^\u0000FENCE\d+\u0000$/.test(lines[i])
    ) {
      plines.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(plines.join(" "))}</p>`);
  }

  return out.join("\n");
}

function row(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
}

function inline(s) {
  s = String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
    `<a href="${u.replace(/"/g, "&quot;")}" target="_blank" rel="noopener">${t}</a>`);
  return s;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
}
