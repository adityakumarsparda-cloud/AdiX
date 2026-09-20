// Bundles the editor into one double-clickable pdf-editor.html.
//
// The served version is the same editor; this one exists so it can be used on
// a machine with no Node installed. Browsers block ES modules and fetch over
// file://, so the bundle uses the UMD build of pdf.js, hands it its worker as
// a blob (pdf.js falls back to running the worker on the main thread when the
// browser refuses that, which still works), and serves the font and CMap data
// it would normally fetch out of an inlined table.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const pub = (...p) => join(HERE, 'public', ...p);

const read = (p) => readFile(p, 'utf8');
const b64dir = async (dir) => {
  const out = {};
  for (const name of await readdir(dir)) out[name] = (await readFile(join(dir, name))).toString('base64');
  return out;
};

const [html, css, appSrc, pdfjs, worker, pdflib] = await Promise.all([
  read(pub('index.html')),
  read(pub('styles.css')),
  read(pub('app.js')),
  read(join(HERE, 'vendor-umd', 'pdf.min.js')),
  read(join(HERE, 'vendor-umd', 'pdf.worker.min.js')),
  read(pub('vendor', 'pdf-lib', 'pdf-lib.min.js')),
]);

const fonts = await b64dir(pub('vendor', 'pdfjs', 'standard_fonts'));
const cmaps = await b64dir(pub('vendor', 'pdfjs', 'cmaps'));

// The app is written as a module against pdf.js's module build; point it at
// the UMD global and at the inlined resources instead.
const app = appSrc
  .replace(/^import \* as pdfjsLib from .*$/m, () => 'const pdfjsLib = window.pdfjsLib;')
  .replace(/^pdfjsLib\.GlobalWorkerOptions\.workerSrc = .*$/m,
    () => 'pdfjsLib.GlobalWorkerOptions.workerSrc = window.__pdfWorkerUrl;')
  .replace(/cMapUrl: '[^']*'/, () => "cMapUrl: 'inline-cmaps/'")
  .replace(/standardFontDataUrl: '[^']*'/, () => "standardFontDataUrl: 'inline-fonts/'");

for (const [needle, where] of [['window.pdfjsLib', 'pdf.js global'], ['__pdfWorkerUrl', 'worker url'],
  ['inline-cmaps/', 'cmap url'], ['inline-fonts/', 'font url']]) {
  if (!app.includes(needle)) throw new Error(`bundling app.js did not rewrite the ${where}`);
}

const preamble = `
const INLINE = { 'inline-fonts/': ${JSON.stringify(fonts)}, 'inline-cmaps/': ${JSON.stringify(cmaps)} };
// pdf.js fetches font and CMap data by URL; over file:// nothing can be
// fetched, so answer those requests from the table above.
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  for (const prefix of Object.keys(INLINE)) {
    if (!url.startsWith(prefix)) continue;
    const data = INLINE[prefix][url.slice(prefix.length)];
    if (data === undefined) return Promise.resolve(new Response(null, { status: 404 }));
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return Promise.resolve(new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }));
  }
  return realFetch(input, init);
};
window.__pdfWorkerUrl = URL.createObjectURL(
  new Blob([document.getElementById('pdf-worker-src').textContent], { type: 'text/javascript' }));
`;

// Every injection goes through a replacer function: a plain replacement
// string would have $&-style sequences inside the minified libraries
// substituted into it, quietly corrupting them.
const inject = (source, needle, payload) => {
  if (!source.includes(needle)) throw new Error(`index.html no longer contains ${needle}`);
  return source.replace(needle, () => payload);
};

let bundle = inject(html, '<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`);
bundle = inject(bundle, '<script src="vendor/pdf-lib/pdf-lib.min.js"></script>',
  `<script>${pdflib}</script>\n<script>${pdfjs}</script>\n`
  + `<script id="pdf-worker-src" type="text/plain">${worker}</script>\n`
  + `<script>${preamble}</script>`);
bundle = inject(bundle, '<script type="module" src="app.js"></script>', `<script>${app}</script>`);
bundle = bundle.replace('<title>PDF Editor · local</title>', () => '<title>PDF Editor</title>');

if (bundle.includes('src="app.js"') || bundle.includes('styles.css')) throw new Error('bundle still references external files');
// An inlined library that contained a closing script tag would end its own
// <script> element early and silently break the bundle.
for (const [name, src] of [['pdf.js', pdfjs], ['pdf.worker.js', worker], ['pdf-lib', pdflib], ['app.js', app]]) {
  if (/<\/script/i.test(src)) throw new Error(`${name} contains a closing script tag and cannot be inlined as-is`);
}

const out = join(HERE, 'pdf-editor.html');
await writeFile(out, bundle);
console.log(`${out} — ${(Buffer.byteLength(bundle) / 1e6).toFixed(1)} MB, open it in a browser`);
