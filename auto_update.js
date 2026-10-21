/* Shared auto-update for every app in this folder (rule 16). The Streamlit apps use it through auto_update.py.

A web app only loads this file: every 30 seconds while the page is in view it fetches the page and its own scripts and
styles again, and when any of them changed it shows a small pill in the corner: "Update ready · applies in 10s", with
"Later". At 0 the page reloads onto the new code. The countdown waits (and starts again from 10) while you type, while
a pop-up or menu is open, or while the app says it is busy:

  window.autoUpdateBusy = () => dirty ? "while saving" : "";   // a reason to wait, or "" when it can go ahead

"Later" hides the pill for 10 minutes. Opened as a plain file, or offline, it does nothing.
*/
(function () {
  const CHECK_EVERY = 30000, COUNT = 10, LATER = 10 * 60 * 1000;

  function waitReason(doc, busy) {
    const why = busy && busy();
    if (why) return why;
    const a = doc.activeElement;
    if (a && (a.tagName === "TEXTAREA" || a.isContentEditable ||
        (a.tagName === "INPUT" && !/^(checkbox|radio|button|submit|range|color|file)$/i.test(a.type)))) return "while you type";
    const open = [...doc.querySelectorAll('[role="dialog"], [role="listbox"], [data-testid="stPopoverBody"], dialog[open]')];
    if (open.some(e => e.checkVisibility ? e.checkVisibility() : e.offsetParent !== null)) return "while a pop-up is open";
    return "";
  }

  function colours(doc) {
    // the page's own colours, so the pill fits a light or a dark app
    for (const el of [doc.querySelector(".stApp"), doc.body, doc.documentElement]) {
      if (!el) continue;
      const s = doc.defaultView.getComputedStyle(el), bg = s.backgroundColor;
      if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) return {bg, fg: s.color};
    }
    return {bg: "#0D1321", fg: "#EAF0FA"};
  }

  /* Shows the pill in `doc` and counts down. o.apply() runs at 0, o.later() when "Later" is pressed, o.busy() as above.
     The count is kept on doc's window, so a script that is loaded again (a Streamlit redraw) carries on from where it was.
     Returns a function that takes the pill away and pauses the count. */
  function show(doc, o) {
    const w = doc.defaultView;
    const st = w.__autoUpdate = w.__autoUpdate || {left: COUNT};
    clearInterval(st.timer);
    let el = doc.getElementById("au-pill");
    if (!el) {
      const c = colours(doc);
      el = doc.createElement("div");
      el.id = "au-pill";
      el.setAttribute("role", "status");
      el.style.cssText = `position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:10px;
        max-width:calc(100vw - 32px);box-sizing:border-box;padding:6px 6px 6px 14px;border-radius:999px;background:${c.bg};color:${c.fg};
        border:1px solid color-mix(in srgb, ${c.fg} 40%, transparent);box-shadow:0 4px 14px rgba(0,0,0,.25);
        font:13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      el.innerHTML = '<span class="au-t"></span><button type="button" style="all:unset;cursor:pointer;padding:3px 12px;border-radius:999px;' +
        `border:1px solid color-mix(in srgb, ${c.fg} 40%, transparent)">Later</button>`;
      doc.body.appendChild(el);
    }
    const text = el.querySelector(".au-t");
    const end = reset => { clearInterval(st.timer); st.timer = null; if (reset) st.left = COUNT; el.remove(); };
    el.querySelector("button").onclick = () => { end(true); o.later(); };
    const tick = () => {
      const why = waitReason(doc, o.busy);
      if (why) { st.left = COUNT; text.textContent = "Update ready · waits " + why; return; }
      if (st.left <= 0) { end(true); o.apply(); return; }
      text.textContent = `Update ready · applies in ${st.left}s`;
      st.left -= 1;
    };
    tick();
    st.timer = setInterval(tick, 1000);
    return () => end(false);
  }

  // A web page: watches its own files
  async function fingerprint() {
    const urls = [location.href.split("#")[0]];
    document.querySelectorAll("script[src], link[rel=stylesheet][href]").forEach(e => {
      const u = new URL(e.src || e.href, location.href);
      if (u.origin === location.origin) urls.push(u.href);
    });
    const parts = [];
    for (const u of urls) {
      const r = await fetch(u, {cache: "no-store"});
      if (!r.ok) throw new Error(r.status);
      const sum = await crypto.subtle.digest("SHA-256", await r.arrayBuffer());
      parts.push(Array.from(new Uint8Array(sum), b => b.toString(16).padStart(2, "0")).join(""));
    }
    return parts.join(",");
  }

  function watch() {
    if (!/^https?:$/.test(location.protocol)) return;
    let first = null, laterUntil = 0, showing = false;
    const check = async () => {
      if (document.hidden || showing || Date.now() < laterUntil) return;
      let now;
      try { now = await fingerprint(); } catch (e) { return; }  // offline or the server is restarting: try again later
      if (first === null) { first = now; return; }
      if (now === first) return;
      showing = true;
      show(document, {apply: () => location.reload(), later: () => { showing = false; laterUntil = Date.now() + LATER; },
                      busy: () => window.autoUpdateBusy && window.autoUpdateBusy()});
    };
    check();
    setInterval(check, CHECK_EVERY);
    document.addEventListener("visibilitychange", check);
  }

  window.AutoUpdate = {show};
  if (!window.AUTO_UPDATE_EMBEDDED) watch();
})();
