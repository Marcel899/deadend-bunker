/* Bunker customisation (DE.Data.COSMETICS) in the overworld: writes the chosen colours onto a
 * scene element as CSS variables (the SVG in js/ui/overworld.js reads them), shows the chosen
 * emblem / roof gear / yard props through data-cz-* attributes (css/overworld.css), and paints
 * the shelter name on the lintel. Also renders the "Customize" section of the Defense drawer and
 * registers its actions. Loaded after actions.js. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Customize = (function () {
  const D = () => DE.Data.COSMETICS;
  const esc = (s) => DE.Util.escapeHtml(s);
  const VARS = { paint: ['--bk-a', '--bk-b', '--bk-c'], stripes: ['--hz-a', '--hz-b'], flag: ['--fl-a', '--fl-b', '--fl-c'] };
  const ATTR = { emblem: 'czEmblem', roof: 'czRoof', yard: 'czYard' };

  /** Dress a scene element (#scene, the menu scene or the preview) for a state. `peek` = { slot, id }
   * shows one option in place of the chosen one (hover preview). Cheap when nothing changed. */
  function apply(el, state, peek) {
    if (!el || !state) return;
    const sel = {}; for (const slot in D()) sel[slot] = DE.Cosmetics.selected(state, slot);
    if (peek && DE.Cosmetics.option(peek.slot, peek.id)) sel[peek.slot] = DE.Cosmetics.option(peek.slot, peek.id);
    const name = DE.Cosmetics.name(state);
    const key = Object.keys(sel).map(k => sel[k].id).join('|') + '|' + name;
    if (el._czKey === key && el.querySelector('.ow-stencil') === el._czStencil) return;
    el._czKey = key;
    for (const slot in VARS) VARS[slot].forEach((v, i) => el.style.setProperty(v, sel[slot].c[i]));
    // armour plates get a tint of the paint unless it's the plain default
    if (sel.paint === D().paint.options[0]) el.style.removeProperty('--bk-tint'); else el.style.setProperty('--bk-tint', sel.paint.c[1]);
    for (const slot in ATTR) el.dataset[ATTR[slot]] = sel[slot].id;
    el.querySelectorAll('.ow-stencil').forEach(t => { if (t.textContent !== name) t.textContent = name; });
    el._czStencil = el.querySelector('.ow-stencil');
  }

  /* ---- live preview in the drawer: one SVG node, built once and moved back in whenever the drawer
     HTML is rebuilt (a MutationObserver puts it back before the browser paints) ---- */
  let pvNode = null, peekOpt = null;
  function previewNode() {
    if (!pvNode) { const t = document.createElement('div'); t.innerHTML = DE.UI.Overworld.previewSvg(); pvNode = t.firstElementChild; }
    return pvNode;
  }
  function syncPreview() {
    const box = document.querySelector('#drawer-body .cz-preview'); if (!box) return;
    const node = previewNode(); if (node.parentNode !== box) box.insertBefore(node, box.firstChild);
    const sc = document.getElementById('scene');
    if (sc) for (const k of ['fence', 'gate', 'barricades', 'towers', 'lights', 'road', 'missile', 'walltier']) if (sc.dataset[k] != null && box.dataset[k] !== sc.dataset[k]) box.dataset[k] = sc.dataset[k];
    apply(box, DE.Game.state, peekOpt);
    const tag = box.querySelector('.cz-peek'); if (tag) { const o = peekOpt && DE.Cosmetics.option(peekOpt.slot, peekOpt.id); tag.textContent = o ? 'Previewing: ' + o.name : ''; tag.classList.toggle('on', !!o); }
  }
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    const watch = () => { const body = document.getElementById('drawer-body'); if (!body) return; new MutationObserver(syncPreview).observe(body, { childList: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
    // hover (or focus) an option to try it on the preview before buying
    const over = (e) => { const c = e.target.closest && e.target.closest('.cz-card'); const next = c ? { slot: c.dataset.slot, id: c.dataset.id } : null;
      if ((next && next.id) === (peekOpt && peekOpt.id) && (next && next.slot) === (peekOpt && peekOpt.slot)) return; peekOpt = next; syncPreview(); };
    document.addEventListener('pointerover', over); document.addEventListener('focusin', over);
  }

  function thumb(slot, o) {
    if (o.c) return `<i class="cz-swatch" style="--a:${o.c[0]};--b:${o.c[1]};--c:${o.c[2] || o.c[1]}"></i>`;
    const pic = DE.UI.Overworld.thumb(slot, o.id);
    return pic ? `<span class="cz-pic" data-cz-${slot}="${o.id}">${pic}</span>` : '<span class="cz-pic cz-none"></span>';
  }
  /** Body of the Customize section in the Defense drawer. */
  function body(s) {
    const U = DE.Util, ui = DE.UI.ui;
    const tab = D()[ui.czTab] ? ui.czTab : DE.Data.COSMETIC_ORDER[0];
    let h = `<div class="cz-wrap"><div class="cz-stage"><div class="cz-preview"><span class="cz-peek"></span></div>
      <label class="cz-plate" title="Stencilled over the blast door. Press Enter to paint it."><small>Shelter name</small>
        <input id="cz-name-in" type="text" maxlength="${DE.Data.COSMETIC_NAME_MAX}" value="${esc(DE.Cosmetics.name(s))}" data-change="czName" spellcheck="false" autocomplete="off"></label></div><div class="cz-side">`;
    h += '<div class="cz-tabs" role="tablist">' + DE.Data.COSMETIC_ORDER.map(slot => {
      const def = D()[slot], cur = DE.Cosmetics.selected(s, slot), own = def.options.filter(o => DE.Cosmetics.owns(s, slot, o.id)).length;
      return `<button class="cz-tab${slot === tab ? ' on' : ''}" data-action="czTab" data-tab="${slot}" role="tab" aria-selected="${slot === tab}">${thumb(slot, cur)}<span><b>${esc(def.name)}</b><small>${own}/${def.options.length}</small></span></button>`;
    }).join('') + '</div>';
    const def = D()[tab], cur = DE.Cosmetics.selected(s, tab);
    h += `<p class="cz-desc">${esc(def.desc)} <span>Hover a style to preview it.</span></p><div class="cz-grid">`;
    for (const o of def.options) {
      const own = DE.Cosmetics.owns(s, tab, o.id), on = o === cur, ok = own || U.canAfford(s.resources, o.cost);
      const state = on ? '<small class="cz-st on">Equipped</small>' : own ? '<small class="cz-st">Owned · tap to use</small>' : `<small class="cz-st cost">${DE.Icons.img('lock', 'ico-inline')} ${U.costText(o.cost)}</small>`;
      h += `<button class="cz-card${on ? ' on' : ''}${own ? '' : ' locked'}${ok ? '' : ' cant'}" data-action="czPick" data-slot="${tab}" data-id="${o.id}"${on ? ' aria-pressed="true"' : ''}>
        <span class="cz-thumb">${thumb(tab, o)}</span><b>${esc(o.name)}</b>${state}</button>`;
    }
    return h + '</div></div></div>';
  }
  function status(s) { const c = DE.Cosmetics.ownedCount(s); return `${c.n}/${c.all} styles unlocked`; }

  function refreshScene() {
    const sc = document.getElementById('scene'); if (!sc) return;
    sc._czKey = null; apply(sc, DE.Game.state);
    sc.classList.remove('cz-changed'); void sc.offsetWidth; sc.classList.add('cz-changed');
    const pv = document.querySelector('#drawer-body .cz-preview'); if (pv) { pv.classList.remove('cz-changed'); void pv.offsetWidth; pv.classList.add('cz-changed'); }
  }
  // actions (actions.js has already built DE.Actions)
  if (DE.Actions) {
    DE.Actions.czTab = (p) => { DE.UI.ui.czTab = p.tab; peekOpt = null; DE.Audio.sfx('click'); DE.UI.renderDrawer(true); };
    DE.Actions.czPick = (p, el) => {
      const s = DE.Game.state, cur = DE.Cosmetics.selected(s, p.slot);
      if (cur.id === p.id) return;
      const r = DE.Cosmetics.choose(s, p.slot, p.id);
      if (!r.ok) { DE.Audio.sfx('error'); DE.UI.toast(r.reason, 'err'); return; }
      if (r.bought) DE.UI.purchased(el, r.cost, 'Unlocked: ' + r.option.name); else DE.Audio.sfx('click');
      refreshScene(); DE.Game.afterAction();
    };
    DE.Actions.czName = (p) => {
      const s = DE.Game.state, r = DE.Cosmetics.setName(s, p.value);
      if (!r.ok) { DE.Audio.sfx('error'); DE.UI.toast(r.reason, 'err'); DE.UI.renderDrawer(true); return; }
      DE.Audio.sfx('click'); DE.UI.toast('Painted "' + r.name + '" over the door', 'ok');
      refreshScene(); DE.Game.afterAction();
    };
  }

  return { apply, body, status };
})();
