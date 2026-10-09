/* Shared "Edit layout" helper for the plain web apps in this folder (the Streamlit apps use ui_edit.py).

An app lists its elements as defaults in code, marks them in the page, and keeps the user's changes (wording,
colour, shown, order) wherever it keeps its own data. Defaults never overwrite those changes.

  UIEdit.init({elements: {title: {label: "To-do"}, f_all: {label: "All", group: "filters", paint: "fill"}},
               load: () => state.layout, save: layout => { state.layout = layout; changed(); }, redraw: render});
  UIEdit.mark(el, "title")          // an element on the page: in Edit layout it gets a faint outline and a small ⋮⋮
  UIEdit.label(id), UIEdit.color(id), UIEdit.shown(id), UIEdit.order("filters")   // read the user's version
  UIEdit.gear(parent)               // a small ⚙ with the Edit layout switch and "Reset layout"

Element fields: label, color, group (elements in one group can be dragged into order), paint ("text" or "fill":
what the colour changes), locked (can't be hidden), fixedLabel (no wording to change).
Static elements can be marked in the HTML with data-ue="id"; UIEdit.scan() picks them up. If only part of an element
holds its wording (e.g. a <summary> inside <details>), mark that part with data-ue-text.
*/
(function () {
  const S = {elements: {}, user: {}, on: false, load: () => ({}), save: () => {}, redraw: () => {}};
  const css = document.createElement("style");
  css.textContent = `
.ue-on [data-ue]{position:relative;outline:1px dashed rgba(148,163,184,.35);outline-offset:3px;border-radius:6px}
.ue-on [data-ue][draggable=true]{cursor:grab}
.ue-on [data-ue].ue-lift{opacity:.4}
.ue-off [data-ue].ue-hidden{display:none!important}
.ue-on [data-ue].ue-hidden{opacity:.35}
button.ue-h{all:unset;box-sizing:border-box;position:absolute;top:-10px;right:-8px;z-index:20;padding:0 5px;border-radius:6px;
  border:1px solid rgba(148,163,184,.4);background:transparent;color:inherit;font:12px/1.3 -apple-system,sans-serif;letter-spacing:-1px;
  opacity:.45;cursor:pointer;display:none;width:auto;height:auto;min-width:0;min-height:0;box-shadow:none}
button.ue-h:hover{opacity:1}.ue-on button.ue-h{display:block}
.ue-menu{position:fixed;z-index:1000;min-width:220px;background:#151D2E;color:#EAF0FA;border:1px solid #29344D;border-radius:10px;
  padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.4);font:14px/1.4 -apple-system,sans-serif;display:flex;flex-direction:column;gap:8px}
.ue-menu label{display:flex;flex-direction:column;gap:3px;font-size:.8rem;color:#93A1BA}
.ue-menu label.row{flex-direction:row;align-items:center;gap:8px;color:#EAF0FA;font-size:.9rem}
.ue-menu input[type=text]{background:#0D1321;border:1px solid #29344D;color:#EAF0FA;border-radius:8px;padding:6px 8px;font:inherit}
.ue-menu input[type=color]{width:44px;height:28px;border:none;background:none;padding:0}
.ue-menu button{border-radius:999px;border:1px solid #29344D;background:#1E283D;color:#EAF0FA;padding:5px 10px;font:inherit;cursor:pointer}
.ue-gear{background:none;border:none;color:inherit;opacity:.55;cursor:pointer;font-size:1rem;padding:2px 6px}`;
  document.head.appendChild(css);
  document.documentElement.classList.add("ue-off");

  const cfg = id => Object.assign({}, S.elements[id] || {}, S.user[id] || {});
  const store = () => S.save(JSON.parse(JSON.stringify(S.user)));
  function set(id, field, value) { (S.user[id] = S.user[id] || {})[field] = value; store(); apply(); S.redraw(); }

  const UIEdit = {
    init(o) {
      Object.assign(S, o);
      S.user = Object.assign({}, S.load() || {});
      apply();
    },
    label: id => cfg(id).label,
    color: id => cfg(id).color,
    shown: id => cfg(id).shown !== false,
    get editing() { return S.on; },
    order(group) {
      const ids = Object.keys(S.elements).filter(id => S.elements[id].group === group);
      const at = id => (S.user[id] && S.user[id].order != null) ? S.user[id].order : ids.indexOf(id) * 10;
      return ids.sort((a, b) => at(a) - at(b));
    },
    // Mark an element on the page as one the user can change (call again on every redraw)
    mark(el, id, textEl) {
      if (!el || !S.elements[id]) return el;
      el.dataset.ue = id;
      const c = cfg(id), t = textEl || [...el.querySelectorAll("[data-ue-text]")].find(x => x.closest("[data-ue]") === el) || el;  // data-ue-text: the part that holds the wording (this element's own, not a marked element inside it)
      if (!c.fixedLabel && c.label != null) t.textContent = c.label;
      if (c.color) el.style[c.paint === "fill" ? "background" : "color"] = c.color;
      if (c.paint === "fill" && c.color) { el.style.borderColor = c.color; el.style.color = ink(c.color); }
      el.classList.toggle("ue-hidden", c.shown === false);
      const hp = t === el ? el : t;  // the handle sits with the wording, so it shows even in a closed <details>
      if (!hp.querySelector(":scope > .ue-h")) {
        const h = document.createElement("button");
        h.className = "ue-h"; h.type = "button"; h.textContent = "⋮⋮"; h.title = "Change or move";
        h.onclick = e => { e.preventDefault(); e.stopPropagation(); menu(el.dataset.ue, h); };
        hp.appendChild(h);
      }
      el.draggable = S.on && !!S.elements[id].group;
      return el;
    },
    scan(root) { (root || document).querySelectorAll("[data-ue]").forEach(el => UIEdit.mark(el, el.dataset.ue)); sortStatic(); },
    gear(parent) {
      const b = document.createElement("button");
      b.className = "ue-gear"; b.type = "button"; b.textContent = "⚙"; b.title = "Settings";
      b.onclick = e => { e.stopPropagation(); gearMenu(b); };
      parent.appendChild(b);
      return b;
    },
  };

  function apply() {
    document.documentElement.classList.toggle("ue-on", S.on);
    document.documentElement.classList.toggle("ue-off", !S.on);
    document.querySelectorAll("[data-ue]").forEach(el => UIEdit.mark(el, el.dataset.ue));
  }
  // Elements written into the HTML itself: put each group in the user's order
  function sortStatic() {
    const groups = new Set(Object.values(S.elements).map(e => e.group).filter(Boolean));
    groups.forEach(g => {
      const els = UIEdit.order(g).map(id => document.querySelector(`[data-ue="${id}"]`)).filter(Boolean);
      if (els.length > 1 && els.every(e => e.parentElement === els[0].parentElement)) { const a = after(els); els.forEach(e => e.parentElement.insertBefore(e, a)); }
    });
  }
  // what comes straight after a group of siblings, so they can be put back in place in any order
  function after(els) { const last = els.reduce((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? b : a); return last.nextSibling; }
  function ink(c) {
    const m = /#([0-9a-f]{6})/i.exec(c || ""); if (!m) return "";
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#0F172A" : "#fff";
  }

  // ---------- the small menus ----------
  let open = null;
  function close() { if (open) { open.remove(); open = null; } }
  document.addEventListener("click", e => { if (open && !open.contains(e.target)) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  function place(m, anchor) {
    document.body.appendChild(m); open = m;
    const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
    m.style.top = (r.bottom + h + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
  }
  function menu(id, anchor) {
    close();
    const e = S.elements[id], c = cfg(id), m = document.createElement("div");
    m.className = "ue-menu";
    m.onclick = ev => ev.stopPropagation();
    if (!e.fixedLabel && c.label != null) {
      const l = document.createElement("label"); l.textContent = "Wording";
      const i = document.createElement("input"); i.type = "text"; i.value = c.label;
      i.onchange = () => { if (i.value.trim()) set(id, "label", i.value.trim()); };
      i.onkeydown = ev => { if (ev.key === "Enter") i.blur(); };
      l.appendChild(i); m.appendChild(l);
    }
    if ("color" in e) {
      const l = document.createElement("label"); l.textContent = "Colour";
      const i = document.createElement("input"); i.type = "color"; i.value = (/#[0-9a-f]{6}/i.exec(c.color || "") || ["#3DD6C4"])[0];
      i.oninput = () => set(id, "color", i.value);
      l.appendChild(i); m.appendChild(l);
    }
    if (!e.locked) {
      const l = document.createElement("label"); l.className = "row";
      const i = document.createElement("input"); i.type = "checkbox"; i.checked = c.shown !== false;
      i.onchange = () => set(id, "shown", i.checked);
      l.append(i, "Shown"); m.appendChild(l);
    }
    const r = document.createElement("button"); r.type = "button"; r.textContent = "Reset";
    r.onclick = () => { delete S.user[id]; store(); apply(); S.redraw(); close(); };
    m.appendChild(r);
    place(m, anchor);
  }
  function gearMenu(anchor) {
    close();
    const m = document.createElement("div"); m.className = "ue-menu"; m.onclick = ev => ev.stopPropagation();
    const l = document.createElement("label"); l.className = "row";
    const i = document.createElement("input"); i.type = "checkbox"; i.checked = S.on;
    i.onchange = () => { S.on = i.checked; apply(); S.redraw(); r.hidden = !S.on; };
    l.append(i, "Edit layout"); m.appendChild(l);
    const r = document.createElement("button"); r.type = "button"; r.textContent = "Reset layout to default"; r.hidden = !S.on;
    r.onclick = () => { S.user = {}; store(); apply(); S.redraw(); close(); };
    m.appendChild(r);
    place(m, anchor);
  }

  // ---------- dragging (Edit layout only) ----------
  // The others slide aside once the dragged one is halfway over them; on drop the new order is saved.
  let drag = null, anchor = null, start = [], places = [], grid = false, horiz = false, gx = 0, gy = 0, half = 0, rest = [], seq = [];
  const mid = r => [r.left + r.width / 2, r.top + r.height / 2];
  const siblings = el => [...el.parentElement.children].filter(x => x.dataset.ue && S.elements[x.dataset.ue] &&
    S.elements[x.dataset.ue].group === S.elements[el.dataset.ue].group && x.offsetParent);
  function arrange(next) {
    const before = new Map(next.map(el => [el, el.getBoundingClientRect()]));
    next.forEach(el => drag.parentElement.insertBefore(el, anchor));
    next.forEach(el => {
      if (el === drag) return;
      const a = before.get(el), b = el.getBoundingClientRect();
      if (!(a.left - b.left || a.top - b.top)) return;
      el.style.transition = "none"; el.style.transform = `translate(${a.left - b.left}px,${a.top - b.top}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = "transform .18s ease"; el.style.transform = ""; }));
    });
    seq = next;
  }
  document.addEventListener("dragstart", e => {
    const t = S.on && e.target.closest && e.target.closest("[data-ue][draggable=true]");
    if (!t) return;
    e.stopPropagation();
    drag = t; start = siblings(t); anchor = after(start);
    const rect = new Map(start.map(el => [el, el.getBoundingClientRect()]));
    start.sort((a, b) => { const ra = rect.get(a), rb = rect.get(b); return Math.abs(mid(ra)[1] - mid(rb)[1]) < Math.min(ra.height, rb.height) / 2 ? mid(ra)[0] - mid(rb)[0] : mid(ra)[1] - mid(rb)[1]; });
    const tops = new Set(start.map(el => Math.round(rect.get(el).top))), lefts = new Set(start.map(el => Math.round(rect.get(el).left)));
    grid = tops.size > 1 && lefts.size > 1; horiz = tops.size === 1;
    const tr = rect.get(t); [gx, gy] = [e.clientX - mid(tr)[0], e.clientY - mid(tr)[1]];
    half = (horiz ? tr.width : tr.height) / 2;
    places = start.map(el => rect.get(el));
    rest = start.filter(x => x !== t).map(el => ({el, at: mid(rect.get(el))[horiz ? 0 : 1], before: start.indexOf(el) < start.indexOf(t)}));
    seq = start;
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.dataset.ue);
    setTimeout(() => t.classList.add("ue-lift"));
  }, true);
  document.addEventListener("dragover", e => {
    if (!drag || !drag.parentElement.contains(e.target)) return;
    e.preventDefault();
    let next;
    if (grid) {
      const x = e.clientX - gx, y = e.clientY - gy;
      let k = places.findIndex(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
      if (k < 0) k = places.reduce((b, r, i) => { const d = Math.hypot(x - mid(r)[0], y - mid(r)[1]); return d < b.d ? {i, d} : b; }, {i: 0, d: Infinity}).i;
      next = start.filter(el => el !== drag); next.splice(k, 0, drag);
    } else {
      const at = (horiz ? e.clientX - gx : e.clientY - gy);
      const ahead = r => r.before ? at - half > r.at : at + half > r.at;
      next = rest.filter(ahead).map(r => r.el); next.push(drag, ...rest.filter(r => !ahead(r)).map(r => r.el));
    }
    if (next.some((el, i) => el !== seq[i])) arrange(next);
  }, true);
  document.addEventListener("drop", e => {
    if (!drag || !drag.parentElement.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    seq.forEach((el, n) => { (S.user[el.dataset.ue] = S.user[el.dataset.ue] || {}).order = n * 10; });
    store();
  }, true);
  document.addEventListener("dragend", () => {
    if (!drag) return;
    drag.classList.remove("ue-lift");
    const saved = seq.every((el, n) => (S.user[el.dataset.ue] || {}).order === n * 10);
    if (!saved) start.forEach(el => drag.parentElement.insertBefore(el, anchor));  // dropped outside: back as it was
    drag = null;
    S.redraw();
  }, true);

  window.UIEdit = UIEdit;
})();
