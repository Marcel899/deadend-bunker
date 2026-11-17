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

  /** Dress a scene element (#scene or the menu scene) for a state. Cheap when nothing changed. */
  function apply(el, state) {
    if (!el || !state) return;
    const sel = {}; for (const slot in D()) sel[slot] = DE.Cosmetics.selected(state, slot);
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

  /** Swatch for a colour option, small picture-word for the others. */
  function chip(slot, o) {
    if (o.c) return `<i class="cz-sw" style="background:linear-gradient(135deg, ${o.c[0]} 0 50%, ${o.c[1]} 50% 100%)"></i>`;
    return '';
  }
  /** Body of the Customize section in the Defense drawer. */
  function body(s) {
    const U = DE.Util;
    let h = `<div class="cz-name"><label for="cz-name-in"><b>Shelter name</b><small>Stencilled over the blast door. Press Enter to paint it.</small></label>
      <input id="cz-name-in" type="text" maxlength="${DE.Data.COSMETIC_NAME_MAX}" value="${esc(DE.Cosmetics.name(s))}" data-change="czName" spellcheck="false" autocomplete="off"></div>`;
    for (const slot of DE.Data.COSMETIC_ORDER) {
      const def = D()[slot], cur = DE.Cosmetics.selected(s, slot);
      h += `<div class="cz-slot"><div class="cz-head"><b>${esc(def.name)}</b><small>${esc(def.desc)}</small></div><div class="cz-opts">`;
      for (const o of def.options) {
        const own = DE.Cosmetics.owns(s, slot, o.id), on = o === cur, ok = own || U.canAfford(s.resources, o.cost);
        const tip = on ? 'In use' : own ? 'Use ' + o.name : 'Unlock ' + o.name + ' for ' + U.costText(o.cost).replace(/<[^>]+>/g, '');
        h += `<button class="cz-opt${on ? ' on' : ''}${own ? '' : ' locked'}${ok ? '' : ' cant'}" data-action="czPick" data-slot="${slot}" data-id="${o.id}" title="${esc(tip)}"${on ? ' disabled' : ''}>
          ${chip(slot, o)}<span>${esc(o.name)}</span>${own ? '' : `<em class="cost">${U.costText(o.cost)}</em>`}</button>`;
      }
      h += '</div></div>';
    }
    return h;
  }
  function status(s) { const c = DE.Cosmetics.ownedCount(s); return `${c.n}/${c.all} styles unlocked`; }

  function refreshScene() {
    const sc = document.getElementById('scene'); if (!sc) return;
    sc._czKey = null; apply(sc, DE.Game.state);
    sc.classList.remove('cz-changed'); void sc.offsetWidth; sc.classList.add('cz-changed');
  }
  // actions (actions.js has already built DE.Actions)
  if (DE.Actions) {
    DE.Actions.czPick = (p, el) => {
      const s = DE.Game.state, r = DE.Cosmetics.choose(s, p.slot, p.id);
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
