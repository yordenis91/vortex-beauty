// Genera la versión web del manual (una sola página HTML con las capturas incrustadas)
// a partir de MANUAL_DE_USUARIO.md.
//
// Uso:  node docs/manual/generar-html.mjs [salida.html]
// Sin argumento escribe docs/manual/_manual_web.html (no se sube al repositorio).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(dir, '_manual_web.html');
const md = fs.readFileSync(path.join(dir, 'MANUAL_DE_USUARIO.md'), 'utf8').replace(/\r/g, '').split('\n');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) =>
  s.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

// Tamaño en pantalla de cada captura: las del móvil se hicieron al doble de resolución.
const PC = new Set(['05_panel_pc.png', '11_agenda_semana.png', '42_notificaciones.png']);
function image(alt, src) {
  const file = path.join(dir, src);
  const buf = fs.readFileSync(file);
  const px = buf.readUInt32BE(16);
  const width = PC.has(path.basename(src)) ? px : Math.round(px / 2);
  const name = path.basename(src);
  return `<img src="data:image/png;base64,${buf.toString('base64')}" alt="${esc(alt)}" width="${width}" data-archivo="${name}" loading="lazy">`;
}

function inline(text) {
  let t = esc(text);
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => image(alt.replace(/&amp;/g, '&'), src));
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(>])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return t;
}

const kindOf = (s) => {
  const first = s.replace(/<[^>]+>/g, '').trimStart();
  if (first.startsWith('✅')) return 'ok';
  if (first.startsWith('💡')) return 'tip';
  if (first.startsWith('⚠️')) return 'warn';
  if (first.startsWith('❓')) return 'note';
  if (first.startsWith('📸')) return 'shot';
  if (first.startsWith('👉')) return 'ref';
  return '';
};

const html = [];
const nav = [];
let i = 0;

function table(rows) {
  const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const emptyHead = head.every((c) => c === '');
  let h = '<div class="tabla"><table>';
  if (!emptyHead) h += `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
  h += `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return h;
}

function list(start, indent) {
  const items = [];
  const ordered = /^\s*\d+\.\s/.test(md[start]);
  let k = start;
  while (k < md.length) {
    const line = md[k];
    const m = line.match(/^(\s*)(\d+\.|-)\s+(.*)$/);
    if (!m || m[1].length < indent) break;
    if (m[1].length > indent) {
      const [sub, next] = list(k, m[1].length);
      items[items.length - 1] += sub;
      k = next;
      continue;
    }
    items.push(inline(m[3]));
    k++;
  }
  const tag = ordered ? 'ol' : 'ul';
  return [`<${tag}>${items.map((x) => `<li>${x}</li>`).join('')}</${tag}>`, k];
}

while (i < md.length) {
  const line = md[i];
  if (!line.trim()) { i++; continue; }
  const heading = line.match(/^(#{1,3})\s+(.*)$/);
  if (heading) {
    const level = heading[1].length;
    const text = heading[2];
    const isCover = level === 1 && html.length === 0;
    const id = isCover ? 'portada' : slug(text);
    if (isCover) nav.push({ id, text: '1. Portada' });
    if (level === 1 && /^\d+\./.test(text)) nav.push({ id, text });
    html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
    i++;
    continue;
  }
  if (/^---+$/.test(line.trim())) { html.push('<hr>'); i++; continue; }
  if (line.startsWith('|')) {
    const rows = [];
    while (i < md.length && md[i].startsWith('|')) rows.push(md[i++]);
    html.push(table(rows));
    continue;
  }
  if (line.startsWith('>')) {
    const rows = [];
    while (i < md.length && md[i].startsWith('>')) rows.push(md[i++].replace(/^>\s?/, ''));
    const body = rows.map(inline).join('<br>');
    html.push(`<blockquote class="${kindOf(body)}">${body}</blockquote>`);
    continue;
  }
  if (/^\s*(\d+\.|-)\s+/.test(line)) {
    const [h, next] = list(i, line.match(/^(\s*)/)[1].length);
    html.push(h);
    i = next;
    continue;
  }
  if (line.startsWith('![')) {
    html.push(`<figure>${inline(line)}</figure>`);
    i++;
    continue;
  }
  const rows = [];
  while (i < md.length && md[i].trim() && !/^(#|>|\||---|\s*(\d+\.|-)\s|!\[)/.test(md[i])) rows.push(md[i++]);
  const body = rows.map(inline).join('<br>');
  html.push(`<p class="${kindOf(body)}">${body}</p>`);
}

const navHtml = nav.map((n) => `<li><a href="#${n.id}">${esc(n.text)}</a></li>`).join('');

const page = `<title>Manual de Afilao</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap">
<style>
/* Documento de consulta: columna de lectura estrecha, índice lateral en pantallas grandes y desplegable en el móvil. */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --ink: #18212f; --muted: #566174; --line: #dde2ea;
  --brand: #14213d; --accent: #c4361f; --accent-soft: #fdece8;
  --ok: #e6f5ec; --ok-ink: #14532d; --tip: #e8f0fd; --tip-ink: #1e3a6e;
  --warn: #fff3dc; --warn-ink: #6b3f00; --note: #eef0f4; --note-ink: #2f3a4b;
  --font: "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0e141f; --surface: #151d2b; --ink: #e8ecf3; --muted: #9aa6b8; --line: #283242;
  --brand: #0a0f19; --accent: #ff8f7c; --accent-soft: #3a1d18;
  --ok: #12301f; --ok-ink: #a6e3bd; --tip: #14264a; --tip-ink: #b4cdfa;
  --warn: #3a2a0c; --warn-ink: #f3cd8c; --note: #1c2535; --note-ink: #c3ccda; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #0e141f; --surface: #151d2b; --ink: #e8ecf3; --muted: #9aa6b8; --line: #283242;
  --brand: #0a0f19; --accent: #ff8f7c; --accent-soft: #3a1d18;
  --ok: #12301f; --ok-ink: #a6e3bd; --tip: #14264a; --tip-ink: #b4cdfa;
  --warn: #3a2a0c; --warn-ink: #f3cd8c; --note: #1c2535; --note-ink: #c3ccda; color-scheme: dark; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 4.5rem; }
body { background: var(--bg); color: var(--ink); font: 400 1.0625rem/1.7 var(--font); }
.pagina { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 3rem; max-width: 78rem; margin: 0 auto;
  padding-block: 0 4rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.barra { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; align-items: center; gap: 0.75rem;
  background: var(--brand); color: #fff; margin-inline: calc(-1 * max(16px, env(safe-area-inset-left, 0px))); padding: 0.7rem max(16px, env(safe-area-inset-right, 0px)) 0.7rem max(16px, env(safe-area-inset-left, 0px)); }
.barra strong { font-size: 1rem; letter-spacing: 0.01em; }
.barra span { font-size: 0.85rem; opacity: 0.75; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--brand); }
nav.indice { min-width: 0; }
nav.indice ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.1rem; font-size: 0.95rem; }
nav.indice a { display: block; padding: 0.35rem 0.6rem; border-radius: 6px; color: var(--ink); text-decoration: none; }
nav.indice a:hover { background: var(--accent-soft); }
nav.indice h2 { margin: 0 0 0.5rem; font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
details.movil { margin-block: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 0.4rem 0.9rem; }
details.movil summary { cursor: pointer; font-weight: 700; padding: 0.4rem 0; }
.lateral { display: none; }
main { min-width: 0; max-width: 46rem; }
@media (min-width: 62rem) {
  .pagina { grid-template-columns: 17rem minmax(0, 1fr); }
  .barra { grid-column: 1 / -1; }
  .lateral { display: block; position: sticky; top: 4.5rem; align-self: start; max-height: calc(100vh - 6rem); overflow-y: auto; padding-top: 1.5rem; }
  details.movil { display: none; }
}
h1, h2, h3 { line-height: 1.25; text-wrap: balance; letter-spacing: -0.005em; }
h1 { font-size: 2rem; margin: 3.5rem 0 1rem; padding-top: 2rem; border-top: 1px solid var(--line); }
main > h1:first-child { margin-top: 2rem; border-top: 0; padding-top: 0; font-size: 2.4rem; }
h2 { font-size: 1.4rem; margin: 2.2rem 0 0.6rem; }
h3 { font-size: 1.12rem; margin: 1.6rem 0 0.5rem; }
p, ul, ol, blockquote, figure, .tabla { margin: 0 0 1rem; }
ul, ol { padding-left: 1.4rem; } li { margin-bottom: 0.35rem; } li > ul, li > ol { margin: 0.35rem 0 0; }
a { color: var(--accent); text-underline-offset: 0.15em; }
code { font: 0.92em var(--mono); background: var(--note); color: var(--note-ink); padding: 0.1em 0.4em; border-radius: 4px; overflow-wrap: anywhere; }
hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
.tabla { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 0.97rem; }
th, td { text-align: left; vertical-align: top; padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--line); min-width: 7rem; }
tr:last-child td { border-bottom: 0; }
th { font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); background: var(--note); }
figure { display: flex; justify-content: center; margin-block: 1.25rem 0.4rem; }
figure img { max-width: 100%; height: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: 0 2px 10px rgb(0 0 0 / 0.08); }
p.ok, p.tip, p.warn, p.note, blockquote.ok, blockquote.tip, blockquote.warn, blockquote.note { padding: 0.75rem 1rem; border-radius: 10px; }
p.ok, blockquote.ok { background: var(--ok); color: var(--ok-ink); }
p.tip, blockquote.tip { background: var(--tip); color: var(--tip-ink); }
p.warn, blockquote.warn { background: var(--warn); color: var(--warn-ink); }
p.note, blockquote.note { background: var(--note); color: var(--note-ink); }
blockquote { margin-inline: 0; padding: 0.5rem 1rem; border-radius: 10px; background: var(--note); color: var(--note-ink); }
blockquote.shot { background: transparent; color: var(--muted); font-size: 0.85rem; line-height: 1.5; padding: 0; margin-bottom: 1.6rem; text-align: center; }
p.ref { margin: 0 0 0.25rem; font-weight: 700; color: var(--muted); font-size: 0.95rem; }
strong { font-weight: 700; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
@media (max-width: 40rem) { body { font-size: 1.02rem; } h1 { font-size: 1.6rem; } main > h1:first-child { font-size: 1.9rem; } }
@media print { .barra, .lateral, details.movil, body::before { display: none; } body { background: #fff; color: #000; } h1 { break-before: page; } figure, .tabla { break-inside: avoid; } }
</style>
<div class="pagina">
  <div class="barra"><strong>Afilao</strong><span>Manual de usuario · Versión 1.0</span></div>
  <aside class="lateral"><nav class="indice" aria-label="Capítulos"><h2>Capítulos</h2><ol>${navHtml}</ol></nav></aside>
  <main>
    <details class="movil"><summary>Ir a un capítulo</summary><nav class="indice" aria-label="Capítulos"><ol>${navHtml}</ol></nav></details>
    ${html.join('\n')}
  </main>
</div>
`;
fs.writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1048576).toFixed(1)} MB, ${nav.length} capítulos`);
