// The editor. Everything here runs in the browser: the PDF is read with
// pdf.js, edits live as overlay objects in page coordinates, and pdf-lib
// writes a real PDF back out. The server never sees a document.
import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';

const PDFJS_OPTS = {
  cMapUrl: './vendor/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: './vendor/pdfjs/standard_fonts/',
};

const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle, BlendMode,
        PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = PDFLib;

const $ = (id) => document.getElementById(id);
const el = {
  stage: $('stage'), paper: $('paper'), canvas: $('canvas'), overlay: $('overlay'),
  thumbs: $('thumbs'), empty: $('empty'), props: $('props'), side: $('side'),
  formFields: $('form-fields'), formHint: $('form-hint'), toast: $('toast'),
  filePdf: $('file-pdf'), fileImg: $('file-img'),
  pgLabel: $('pg-label'), zoomLabel: $('zoom-label'),
};

let seq = 0;
const nid = () => `a${++seq}`;

const state = {
  sources: [],      // { id, name, bytes, doc }
  pages: [],        // { uid, srcId, srcPage, rotation, baseW, baseH, annots: [] }
  index: 0,
  scale: 1.25,
  tool: 'select',
  selected: null,
  pendingImage: null,
  history: [],
  future: [],
  formFields: [],   // { name, type, value, options }
  props: { color: '#d81b1b', size: 14, font: 'Helvetica', bold: false, italic: false, opacity: 1 },
};

const page = () => state.pages[state.index];
const viewSize = (p) => (p.rotation % 180 ? { w: p.baseH, h: p.baseW } : { w: p.baseW, h: p.baseH });
const sourceOf = (p) => state.sources.find((s) => s.id === p.srcId);

/* ---------------------------------------------------------------- toast */

let toastTimer;
function toast(message, bad = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle('bad', bad);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, bad ? 7000 : 3000);
}

/* ------------------------------------------------------------ undo/redo */

const snapshot = () => JSON.stringify({ pages: state.pages, index: state.index, fields: state.formFields });

function commit() {
  state.history.push(snapshot());
  if (state.history.length > 60) state.history.shift();
  state.future.length = 0;
  refreshUndo();
}

function restore(json) {
  const s = JSON.parse(json);
  state.pages = s.pages;
  state.index = Math.min(s.index, s.pages.length - 1);
  state.formFields = s.fields;
  state.selected = null;
  renderAll();
}

function undo() {
  if (!state.history.length) return;
  state.future.push(snapshot());
  restore(state.history.pop());
  refreshUndo();
}

function redo() {
  if (!state.future.length) return;
  state.history.push(snapshot());
  restore(state.future.pop());
  refreshUndo();
}

function refreshUndo() {
  $('btn-undo').disabled = !state.history.length;
  $('btn-redo').disabled = !state.future.length;
}

/* -------------------------------------------------------------- opening */

async function openFiles(files, { append = false } = {}) {
  const list = [...files].filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
  if (!list.length) return;
  if (!append) {
    state.sources = [];
    state.pages = [];
    state.history = [];
    state.future = [];
    state.formFields = [];
    state.index = 0;
  }
  for (const file of list) {
    try {
      await addSource(file);
    } catch (err) {
      toast(`Could not open ${file.name}: ${err.message}`, true);
    }
  }
  if (!state.pages.length) return;
  if (!append) await loadFormFields();
  el.empty.hidden = true;
  el.paper.hidden = false;
  $('btn-merge').disabled = false;
  $('btn-save').disabled = false;
  refreshUndo();
  await renderAll();
  toast(`${state.pages.length} page${state.pages.length > 1 ? 's' : ''} ready`);
}

async function addSource(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // pdf.js detaches the buffer it is handed, so give the worker a copy and
  // keep the pristine bytes for pdf-lib to write from later.
  const task = pdfjsLib.getDocument({ data: bytes.slice(), ...PDFJS_OPTS });
  task.onPassword = (callback, reason) => {
    const pw = prompt(reason === 1 ? `Password for ${file.name}:` : 'That password was wrong. Try again:');
    if (pw === null) task.destroy();
    else callback(pw);
  };
  const doc = await task.promise;
  const src = { id: `s${state.sources.length}_${Date.now()}`, name: file.name, bytes, doc };
  state.sources.push(src);
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const upright = p.getViewport({ scale: 1, rotation: 0 });
    state.pages.push({
      uid: nid(), srcId: src.id, srcPage: n,
      rotation: ((p.rotate % 360) + 360) % 360,
      baseW: upright.width, baseH: upright.height,
      annots: [],
    });
  }
}

// Form fields are only listed for a single, structurally untouched document,
// because rebuilding a PDF out of copied pages drops the interactive form.
async function loadFormFields() {
  state.formFields = [];
  el.side.hidden = true;
  if (state.sources.length !== 1) return;
  try {
    const doc = await PDFDocument.load(state.sources[0].bytes.slice(), { ignoreEncryption: true });
    for (const f of doc.getForm().getFields()) {
      const name = f.getName();
      if (f instanceof PDFTextField) state.formFields.push({ name, type: 'text', value: f.getText() || '' });
      else if (f instanceof PDFCheckBox) state.formFields.push({ name, type: 'check', value: f.isChecked() });
      else if (f instanceof PDFDropdown) {
        state.formFields.push({ name, type: 'choice', value: (f.getSelected() || [])[0] || '', options: f.getOptions() });
      } else if (f instanceof PDFRadioGroup) {
        state.formFields.push({ name, type: 'choice', value: f.getSelected() || '', options: f.getOptions() });
      }
    }
  } catch { /* no form, or one we cannot read — the overlay tools still work */ }
  if (state.formFields.length) {
    el.side.hidden = false;
    renderFormFields();
  }
}

function renderFormFields() {
  el.formHint.textContent = 'Typed values are written into the real form fields when you save, '
    + 'as long as you do not add, delete or reorder pages.';
  el.formFields.innerHTML = '';
  state.formFields.forEach((f, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = f.name;
    wrap.append(label);
    let input;
    if (f.type === 'check') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!f.value;
      input.onchange = () => { state.formFields[i].value = input.checked; };
    } else if (f.type === 'choice') {
      input = document.createElement('select');
      for (const o of ['', ...(f.options || [])]) {
        const opt = document.createElement('option');
        opt.value = o; opt.textContent = o || '—';
        input.append(opt);
      }
      input.value = f.value || '';
      input.onchange = () => { state.formFields[i].value = input.value; };
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = f.value;
      input.oninput = () => { state.formFields[i].value = input.value; };
    }
    wrap.append(input);
    el.formFields.append(wrap);
  });
}

/* ------------------------------------------------------------ rendering */

let renderToken = 0;

async function renderAll() {
  await renderPage();
  await renderThumbs();
  updateChrome();
}

async function renderPage() {
  const p = page();
  if (!p) return;
  const token = ++renderToken;
  const v = viewSize(p);
  const cw = Math.round(v.w * state.scale);
  const ch = Math.round(v.h * state.scale);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  el.canvas.width = Math.round(cw * dpr);
  el.canvas.height = Math.round(ch * dpr);
  el.canvas.style.width = `${cw}px`;
  el.canvas.style.height = `${ch}px`;
  el.paper.style.width = `${cw}px`;
  el.paper.style.height = `${ch}px`;

  const ctx = el.canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);

  if (p.srcId) {
    const pdfPage = await sourceOf(p).doc.getPage(p.srcPage);
    if (token !== renderToken) return;
    const viewport = pdfPage.getViewport({ scale: state.scale * dpr, rotation: p.rotation });
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  }
  if (token !== renderToken) return;
  drawAnnotLayer();
}

async function renderThumbs() {
  el.thumbs.innerHTML = '';
  state.pages.forEach((p, i) => {
    const box = document.createElement('div');
    box.className = `thumb${i === state.index ? ' on' : ''}`;
    box.dataset.index = String(i);
    const c = document.createElement('canvas');
    const v = viewSize(p);
    const s = 132 / v.w;
    c.width = Math.round(v.w * s);
    c.height = Math.round(v.h * s);
    const tag = document.createElement('span');
    tag.textContent = String(i + 1);
    box.append(c, tag);
    box.onclick = () => goto(i);
    el.thumbs.append(box);
    paintThumb(p, c, s);
  });
}

async function paintThumb(p, c, s) {
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  if (!p.srcId) return;
  try {
    const pdfPage = await sourceOf(p).doc.getPage(p.srcPage);
    await pdfPage.render({ canvasContext: ctx, viewport: pdfPage.getViewport({ scale: s, rotation: p.rotation }) }).promise;
  } catch { /* a thumbnail that fails to paint is not worth interrupting for */ }
}

function updateChrome() {
  el.pgLabel.textContent = state.pages.length ? `Page ${state.index + 1} of ${state.pages.length}` : '—';
  el.zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  $('pg-del').disabled = state.pages.length <= 1;
  el.overlay.classList.toggle('drawing', state.tool !== 'select');
  el.overlay.classList.toggle('pick', state.tool === 'select');
}

function goto(i) {
  if (i < 0 || i >= state.pages.length) return;
  state.index = i;
  state.selected = null;
  renderAll();
}

/* ------------------------------------------------- annotations, on screen */

function annotBBox(a) {
  if (a.type !== 'ink') return a;
  const xs = a.pts.map((q) => q[0]);
  const ys = a.pts.map((q) => q[1]);
  const pad = a.width;
  return {
    x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + pad * 2,
    h: Math.max(...ys) - Math.min(...ys) + pad * 2,
  };
}

function drawAnnotLayer() {
  const s = state.scale;
  el.overlay.querySelectorAll('.annot').forEach((n) => n.remove());
  for (const a of page().annots) {
    const box = annotBBox(a);
    const node = document.createElement('div');
    node.className = `annot ${a.type}`;
    node.dataset.id = a.id;
    node.style.left = `${box.x * s}px`;
    node.style.top = `${box.y * s}px`;
    node.style.width = `${box.w * s}px`;
    node.style.height = `${box.h * s}px`;
    node.style.opacity = String(a.opacity);

    if (a.type === 'text') {
      node.textContent = a.text;
      node.style.color = a.color;
      node.style.font = `${a.italic ? 'italic ' : ''}${a.bold ? '700 ' : ''}${a.size * s}px/1.2 ${cssFont(a.font)}`;
      node.style.width = 'auto';
      node.style.height = 'auto';
    } else if (a.type === 'whiteout') {
      node.style.background = a.color;
    } else if (a.type === 'highlight') {
      node.style.background = a.color;
      node.style.mixBlendMode = 'multiply';
    } else if (a.type === 'rect') {
      node.style.border = `${Math.max(1, a.width * s)}px solid ${a.color}`;
    } else if (a.type === 'image') {
      const img = document.createElement('img');
      img.src = a.dataUrl;
      node.append(img);
    } else if (a.type === 'ink') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${box.w} ${box.h}`);
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', a.pts.map((q) => `${q[0] - box.x},${q[1] - box.y}`).join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', a.color);
      poly.setAttribute('stroke-width', String(a.width));
      poly.setAttribute('stroke-linecap', 'round');
      poly.setAttribute('stroke-linejoin', 'round');
      svg.append(poly);
      node.append(svg);
    }

    if (a.id === state.selected) {
      node.classList.add('sel');
      if (a.type !== 'ink') {
        const h = document.createElement('div');
        h.className = 'handle';
        h.dataset.resize = a.id;
        node.append(h);
      }
    }
    el.overlay.append(node);
  }
}

const cssFont = (f) => ({
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
}[f] || 'sans-serif');

const findAnnot = (id) => page().annots.find((a) => a.id === id);

/* --------------------------------------------------------- pointer work */

function pointIn(ev) {
  const r = el.overlay.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / state.scale, y: (ev.clientY - r.top) / state.scale };
}

el.overlay.addEventListener('pointerdown', (ev) => {
  if (!state.pages.length || ev.button !== 0) return;
  // Let clicks inside an open text box place the caret as usual.
  if (ev.target.matches('textarea.editor')) return;
  // A click elsewhere commits the text box that was open, and the default
  // mousedown focus handling has to be suppressed or it steals focus back
  // from the box we are about to open.
  el.overlay.querySelector('textarea.editor')?.blur();
  ev.preventDefault();
  const pt = pointIn(ev);
  const target = ev.target.closest?.('.annot');

  if (ev.target.dataset?.resize) {
    startResize(ev, findAnnot(ev.target.dataset.resize));
    return;
  }

  if (state.tool === 'select') {
    if (target) {
      select(target.dataset.id);
      startMove(ev, findAnnot(target.dataset.id));
    } else {
      select(null);
    }
    return;
  }

  if (state.tool === 'text') {
    const a = {
      id: nid(), type: 'text', x: pt.x, y: pt.y, w: 200, h: state.props.size * 1.2,
      text: '', color: state.props.color, opacity: state.props.opacity,
      size: state.props.size, font: state.props.font, bold: state.props.bold, italic: state.props.italic,
    };
    commit();
    page().annots.push(a);
    setTool('select');
    drawAnnotLayer();
    editText(a, true);
    return;
  }

  if (state.tool === 'image') {
    if (!state.pendingImage) return;
    const img = state.pendingImage;
    const v = viewSize(page());
    const scale = Math.min(1, (v.w * 0.6) / img.width);
    commit();
    page().annots.push({
      id: nid(), type: 'image', x: pt.x, y: pt.y,
      w: img.width * scale, h: img.height * scale,
      dataUrl: img.dataUrl, mime: img.mime, color: '#000', opacity: state.props.opacity,
    });
    state.pendingImage = null;
    setTool('select');
    drawAnnotLayer();
    return;
  }

  if (state.tool === 'draw') { startInk(ev, pt); return; }
  startShape(ev, pt);
});

function startMove(ev, a) {
  const start = pointIn(ev);
  const base = a.type === 'ink' ? a.pts.map((q) => [...q]) : { x: a.x, y: a.y };
  let moved = false;
  drag(ev, (pt) => {
    const dx = pt.x - start.x;
    const dy = pt.y - start.y;
    if (!moved && Math.hypot(dx, dy) > 1) { commit(); moved = true; }
    if (!moved) return;
    if (a.type === 'ink') a.pts = base.map((q) => [q[0] + dx, q[1] + dy]);
    else { a.x = base.x + dx; a.y = base.y + dy; }
    drawAnnotLayer();
  });
}

function startResize(ev, a) {
  ev.stopPropagation();
  const start = pointIn(ev);
  const base = { w: a.w, h: a.h, size: a.size };
  let started = false;
  drag(ev, (pt) => {
    if (!started) { commit(); started = true; }
    a.w = Math.max(6, base.w + (pt.x - start.x));
    a.h = Math.max(6, base.h + (pt.y - start.y));
    if (a.type === 'text') a.size = Math.max(4, base.size * (a.h / base.h));
    drawAnnotLayer();
  });
}

function startShape(ev, origin) {
  const kind = state.tool;
  const a = {
    id: nid(), type: kind, x: origin.x, y: origin.y, w: 0, h: 0,
    color: kind === 'highlight' ? '#ffe600' : (kind === 'whiteout' ? '#ffffff' : state.props.color),
    opacity: kind === 'highlight' ? 0.4 : state.props.opacity,
    width: Math.max(1, state.props.size / 12),
  };
  commit();
  page().annots.push(a);
  drag(ev, (pt) => {
    a.x = Math.min(origin.x, pt.x);
    a.y = Math.min(origin.y, pt.y);
    a.w = Math.abs(pt.x - origin.x);
    a.h = Math.abs(pt.y - origin.y);
    drawAnnotLayer();
  }, () => {
    if (a.w < 3 || a.h < 3) page().annots.pop();
    setTool('select');
    select(a.id);
  });
}

function startInk(ev, origin) {
  const a = {
    id: nid(), type: 'ink', pts: [[origin.x, origin.y]],
    color: state.props.color, opacity: state.props.opacity,
    width: Math.max(0.5, state.props.size / 8),
  };
  commit();
  page().annots.push(a);
  drag(ev, (pt) => {
    const last = a.pts[a.pts.length - 1];
    if (Math.hypot(pt.x - last[0], pt.y - last[1]) < 0.7) return;
    a.pts.push([pt.x, pt.y]);
    drawAnnotLayer();
  }, () => {
    if (a.pts.length < 2) page().annots.pop();
    drawAnnotLayer();
  });
}

function drag(ev, onMove, onUp) {
  el.overlay.setPointerCapture(ev.pointerId);
  const move = (e) => onMove(pointIn(e));
  const up = () => {
    el.overlay.removeEventListener('pointermove', move);
    el.overlay.removeEventListener('pointerup', up);
    el.overlay.removeEventListener('pointercancel', up);
    onUp?.();
    updateChrome();
  };
  el.overlay.addEventListener('pointermove', move);
  el.overlay.addEventListener('pointerup', up);
  el.overlay.addEventListener('pointercancel', up);
}

el.overlay.addEventListener('dblclick', (ev) => {
  const node = ev.target.closest?.('.annot');
  if (!node) return;
  const a = findAnnot(node.dataset.id);
  if (a?.type === 'text') editText(a, false);
});

function editText(a, isNew) {
  const s = state.scale;
  const ta = document.createElement('textarea');
  ta.className = 'editor';
  ta.value = a.text;
  ta.style.left = `${a.x * s}px`;
  ta.style.top = `${a.y * s}px`;
  ta.style.width = `${Math.max(a.w, 60) * s}px`;
  ta.style.font = `${a.italic ? 'italic ' : ''}${a.bold ? '700 ' : ''}${a.size * s}px/1.2 ${cssFont(a.font)}`;
  ta.style.color = a.color;
  el.overlay.append(ta);

  const grow = () => {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  };
  const finish = () => {
    ta.remove();
    a.text = ta.value;
    const lines = a.text.split('\n');
    a.h = Math.max(1, lines.length) * a.size * 1.2;
    a.w = Math.max(20, measure(lines, a) );
    if (!a.text.trim()) page().annots = page().annots.filter((x) => x.id !== a.id);
    drawAnnotLayer();
  };
  ta.addEventListener('input', grow);
  ta.addEventListener('blur', finish);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); ta.blur(); }
    e.stopPropagation();
  });
  grow();
  ta.focus();
  if (!isNew) ta.select();
}

const measureCtx = document.createElement('canvas').getContext('2d');
function measure(lines, a) {
  measureCtx.font = `${a.italic ? 'italic ' : ''}${a.bold ? '700 ' : ''}${a.size}px ${cssFont(a.font)}`;
  return Math.max(...lines.map((l) => measureCtx.measureText(l).width), 20);
}

function select(id) {
  state.selected = id;
  drawAnnotLayer();
  showProps();
}

function deleteSelected() {
  if (!state.selected) return;
  commit();
  page().annots = page().annots.filter((a) => a.id !== state.selected);
  state.selected = null;
  drawAnnotLayer();
  showProps();
}

/* ------------------------------------------------------ properties bar */

function showProps() {
  const a = state.selected ? findAnnot(state.selected) : null;
  const src = a || state.props;
  el.props.hidden = false;
  $('p-color').value = toHex(src.color || '#d81b1b');
  $('p-size').value = a ? (a.type === 'text' ? a.size : Math.round((a.width || 1) * 12)) : state.props.size;
  $('p-font').value = (a?.font) || state.props.font;
  $('p-bold').checked = a ? !!a.bold : state.props.bold;
  $('p-italic').checked = a ? !!a.italic : state.props.italic;
  $('p-opacity').value = String(src.opacity ?? 1);
  $('p-delete').hidden = !a;
}

const toHex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000');

function applyProp(fn) {
  const a = state.selected ? findAnnot(state.selected) : null;
  if (a) { commit(); fn(a); drawAnnotLayer(); } else { fn(state.props); }
}

$('p-color').oninput = (e) => applyProp((t) => { t.color = e.target.value; });
$('p-opacity').oninput = (e) => applyProp((t) => { t.opacity = Number(e.target.value); });
$('p-font').onchange = (e) => applyProp((t) => { t.font = e.target.value; });
$('p-bold').onchange = (e) => applyProp((t) => { t.bold = e.target.checked; });
$('p-italic').onchange = (e) => applyProp((t) => { t.italic = e.target.checked; });
$('p-size').oninput = (e) => {
  const n = Number(e.target.value) || 14;
  applyProp((t) => {
    if (t === state.props || t.type === 'text') { t.size = n; if (t.type === 'text') t.h = (t.text.split('\n').length || 1) * n * 1.2; }
    else t.width = Math.max(0.5, n / 12);
  });
};
$('p-delete').onclick = deleteSelected;

/* ------------------------------------------------------------ page ops */

function rotatePage(dir) {
  const p = page();
  const v = viewSize(p);
  commit();
  for (const a of p.annots) {
    if (a.type === 'ink') {
      a.pts = a.pts.map(([x, y]) => (dir > 0 ? [v.h - y, x] : [y, v.w - x]));
    } else {
      const nx = dir > 0 ? v.h - (a.y + a.h) : a.y;
      const ny = dir > 0 ? a.x : v.w - (a.x + a.w);
      a.x = nx; a.y = ny;
      const w = a.w; a.w = a.h; a.h = w;
    }
  }
  p.rotation = ((p.rotation + (dir > 0 ? 90 : -90)) % 360 + 360) % 360;
  renderAll();
}

$('pg-rotate-l').onclick = () => rotatePage(-1);
$('pg-rotate-r').onclick = () => rotatePage(1);

$('pg-del').onclick = () => {
  if (state.pages.length <= 1) return;
  commit();
  state.pages.splice(state.index, 1);
  state.index = Math.min(state.index, state.pages.length - 1);
  state.selected = null;
  renderAll();
};

$('pg-dup').onclick = () => {
  commit();
  const copy = JSON.parse(JSON.stringify(page()));
  copy.uid = nid();
  copy.annots.forEach((a) => { a.id = nid(); });
  state.pages.splice(state.index + 1, 0, copy);
  goto(state.index + 1);
};

$('pg-blank').onclick = () => {
  const p = page();
  commit();
  state.pages.splice(state.index + 1, 0, {
    uid: nid(), srcId: null, srcPage: 0, rotation: 0,
    baseW: p.baseW, baseH: p.baseH, annots: [],
  });
  goto(state.index + 1);
};

$('pg-prev').onclick = () => goto(state.index - 1);
$('pg-next').onclick = () => goto(state.index + 1);

/* ---------------------------------------------------------------- zoom */

function setZoom(v) {
  state.scale = Math.min(4, Math.max(0.25, v));
  renderPage().then(updateChrome);
}

$('zoom-in').onclick = () => setZoom(state.scale * 1.2);
$('zoom-out').onclick = () => setZoom(state.scale / 1.2);
$('zoom-fit').onclick = () => {
  if (!state.pages.length) return;
  setZoom((el.stage.clientWidth - 60) / viewSize(page()).w);
};

/* --------------------------------------------------------------- tools */

function setTool(name) {
  state.tool = name;
  for (const b of $('tools').children) b.classList.toggle('on', b.dataset.tool === name);
  updateChrome();
  showProps();
}

$('tools').onclick = (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.tool === 'image') { el.fileImg.value = ''; el.fileImg.click(); return; }
  setTool(b.dataset.tool);
};

el.fileImg.onchange = async () => {
  const f = el.fileImg.files[0];
  if (!f) return;
  const dataUrl = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(f);
  });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  state.pendingImage = { dataUrl, mime: f.type, width: img.naturalWidth, height: img.naturalHeight };
  setTool('image');
  toast('Click on the page to place the image');
};

/* ------------------------------------------------------------- opening */

$('btn-open').onclick = () => { el.filePdf.value = ''; el.filePdf.dataset.append = ''; el.filePdf.click(); };
$('btn-open-2').onclick = $('btn-open').onclick;
$('btn-merge').onclick = () => { el.filePdf.value = ''; el.filePdf.dataset.append = '1'; el.filePdf.click(); };
el.filePdf.onchange = () => openFiles(el.filePdf.files, { append: el.filePdf.dataset.append === '1' });

document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragover'); });
document.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) document.body.classList.remove('dragover'); });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragover');
  openFiles(e.dataTransfer.files, { append: state.pages.length > 0 && e.shiftKey });
});

$('btn-undo').onclick = undo;
$('btn-redo').onclick = redo;

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  if (e.key === 'Escape') { select(null); setTool('select'); return; }
  if (e.key === 'PageDown') { goto(state.index + 1); return; }
  if (e.key === 'PageUp') { goto(state.index - 1); return; }
  const keys = { v: 'select', t: 'text', w: 'whiteout', h: 'highlight', d: 'draw', r: 'rect' };
  if (keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
});

/* --------------------------------------------------------------- saving */

// View coordinates are points measured from the top-left of the page *as
// displayed*, y downwards. PDF user space is y-up on the unrotated page, so
// undo the page's /Rotate here. A matching `rotate` on each drawn object then
// keeps it upright once the viewer applies that rotation again.
function viewToPdf(vx, vy, W, H, R) {
  switch (((R % 360) + 360) % 360) {
    case 90: return [vy, vx];
    case 180: return [W - vx, vy];
    case 270: return [W - vy, H - vx];
    default: return [vx, H - vy];
  }
}

const hexToRgb = (hex) => {
  const h = toHex(hex).slice(1);
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
};

const FONTS = {
  Helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  Times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  Courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

function fontFor(doc, cache, family, bold, italic) {
  const set = FONTS[family] || FONTS.Helvetica;
  const key = `${family}|${bold}|${italic}`;
  if (!cache[key]) cache[key] = doc.embedFont(set[(bold ? 1 : 0) + (italic ? 2 : 0)]);
  return cache[key];
}

// The 14 standard fonts only speak WinAnsi; anything outside it would throw
// mid-save, so replace those characters rather than lose the whole document.
function winAnsi(text) {
  let dropped = false;
  const out = [...text].map((ch) => {
    const c = ch.codePointAt(0);
    if (c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || '‘’“”–—•€…'.includes(ch)) return ch;
    dropped = true;
    return '?';
  }).join('');
  return { out, dropped };
}

const dataUrlBytes = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));

function structureUntouched() {
  const src = state.sources[0];
  return state.sources.length === 1
    && state.pages.length === src.doc.numPages
    && state.pages.every((p, i) => p.srcId === src.id && p.srcPage === i + 1);
}

async function drawAnnots(pdfPage, p, doc, fontCache) {
  if (!p.annots.length) return;
  let box;
  try { box = pdfPage.getCropBox(); } catch { box = pdfPage.getMediaBox(); }
  const { x: ox, y: oy, width: W, height: H } = box;
  const R = p.rotation;
  const at = (vx, vy) => {
    const [x, y] = viewToPdf(vx, vy, W, H, R);
    return { x: x + ox, y: y + oy };
  };
  let lostChars = false;

  for (const a of p.annots) {
    const color = hexToRgb(a.color);
    if (a.type === 'text') {
      const font = await fontFor(doc, fontCache, a.font, a.bold, a.italic);
      a.text.split('\n').forEach((line, i) => {
        const { out, dropped } = winAnsi(line);
        if (dropped) lostChars = true;
        if (!out) return;
        // 0.9em below the box top is where the browser puts the first baseline
        // at line-height 1.2, which is how the preview drew it.
        const pos = at(a.x, a.y + i * a.size * 1.2 + a.size * 0.9);
        pdfPage.drawText(out, { x: pos.x, y: pos.y, size: a.size, font, color, opacity: a.opacity, rotate: degrees(R) });
      });
    } else if (a.type === 'whiteout' || a.type === 'highlight' || a.type === 'rect') {
      const pos = at(a.x, a.y + a.h);
      const opts = { x: pos.x, y: pos.y, width: a.w, height: a.h, rotate: degrees(R), opacity: a.opacity };
      if (a.type === 'rect') {
        pdfPage.drawRectangle({ ...opts, borderColor: color, borderWidth: Math.max(0.5, a.width), borderOpacity: a.opacity, opacity: 0 });
      } else if (a.type === 'highlight') {
        pdfPage.drawRectangle({ ...opts, color, blendMode: BlendMode.Multiply });
      } else {
        pdfPage.drawRectangle({ ...opts, color });
      }
    } else if (a.type === 'ink') {
      for (let i = 1; i < a.pts.length; i++) {
        pdfPage.drawLine({
          start: at(a.pts[i - 1][0], a.pts[i - 1][1]),
          end: at(a.pts[i][0], a.pts[i][1]),
          thickness: a.width, color, opacity: a.opacity, lineCap: LineCapStyle.Round,
        });
      }
    } else if (a.type === 'image') {
      const bytes = dataUrlBytes(a.dataUrl);
      const img = /png/i.test(a.mime) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const pos = at(a.x, a.y + a.h);
      pdfPage.drawImage(img, { x: pos.x, y: pos.y, width: a.w, height: a.h, rotate: degrees(R), opacity: a.opacity });
    }
  }
  if (lostChars) toast('Some characters are not in the standard PDF fonts and were saved as "?"', true);
}

async function buildPdf() {
  const fontCache = {};
  const inPlace = structureUntouched();

  if (inPlace) {
    // Editing the original document keeps its form fields, outline and
    // metadata intact; only do it when no page was added, moved or removed.
    const doc = await PDFDocument.load(state.sources[0].bytes.slice(), { ignoreEncryption: true });
    if (state.formFields.length) applyFormFields(doc);
    const pages = doc.getPages();
    for (let i = 0; i < state.pages.length; i++) {
      const p = state.pages[i];
      pages[i].setRotation(degrees(p.rotation));
      await drawAnnots(pages[i], p, doc, fontCache);
    }
    return doc;
  }

  const doc = await PDFDocument.create();
  const loaded = new Map();
  for (const p of state.pages) {
    let target;
    if (p.srcId) {
      if (!loaded.has(p.srcId)) {
        loaded.set(p.srcId, await PDFDocument.load(sourceOf(p).bytes.slice(), { ignoreEncryption: true }));
      }
      const [copy] = await doc.copyPages(loaded.get(p.srcId), [p.srcPage - 1]);
      target = doc.addPage(copy);
    } else {
      target = doc.addPage([p.baseW, p.baseH]);
    }
    target.setRotation(degrees(p.rotation));
    await drawAnnots(target, p, doc, fontCache);
  }
  if (state.formFields.length) toast('Pages were added, moved or removed, so interactive form fields could not be kept', true);
  return doc;
}

function applyFormFields(doc) {
  const form = doc.getForm();
  for (const f of state.formFields) {
    try {
      if (f.type === 'text') form.getTextField(f.name).setText(String(f.value ?? ''));
      else if (f.type === 'check') {
        const box = form.getCheckBox(f.name);
        if (f.value) box.check(); else box.uncheck();
      } else if (f.value) {
        form.getField(f.name).select(f.value);
      }
    } catch (err) {
      console.warn(`field ${f.name}: ${err.message}`);
    }
  }
  try { form.updateFieldAppearances(); } catch { /* viewers will regenerate them */ }
}

async function save() {
  if (!state.pages.length) return;
  const btn = $('btn-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const doc = await buildPdf();
    const bytes = await doc.save({ useObjectStreams: true });
    const base = (state.sources[0]?.name || 'document').replace(/\.pdf$/i, '');
    await download(bytes, `${base}-edited.pdf`);
  } catch (err) {
    console.error(err);
    toast(`Could not save: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save as PDF';
  }
}

async function download(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      toast(`Saved ${handle.name}`);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Fall through to a plain download if the picker is unavailable.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Saved ${name} to your downloads`);
}

$('btn-save').onclick = save;

showProps();
updateChrome();
