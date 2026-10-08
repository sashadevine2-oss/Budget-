(function () {
  'use strict';
  const C = window.BudgetCore, KEY = 'budget.v1';
  let S = load(); const U = { tab: 'home', search: '', onlyUncat: false, open: {}, addCat: 'Miscellaneous', addCard: 'Cash / debit' };
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Math.round(n || 0)).replace('CA', '');
  const money2 = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(n || 0).replace('CA', '');
  const pct = n => Math.round((n || 0) * 100) + '%';
  function migrate(r) {
    const d = C.defaultState();
    r.settings = r.settings || { reimbFrom: null };
    r.cards = Object.assign({}, d.cards, r.cards || {});
    r.ui = r.ui || {};
    d.categories.forEach(c => { if (!r.categories.some(x => x.name === c.name)) r.categories.push(c); });
    return r;
  }
  function load() { try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.tx) return migrate(r); } catch (e) {} return C.defaultState(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save. Storage may be full.'); } }
  function month() { if (!S.ui.month) S.ui.month = C.latestMonth(S) || new Date().toISOString().slice(0, 7); return S.ui.month; }
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2400); }

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    add: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2.1 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.7a7 7 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>'
  };
  function tabs() {
    const T = [['home', 'Home', ICONS.home], ['activity', 'Activity', ICONS.list], ['add', 'Add', ICONS.add], ['settings', 'Settings', ICONS.gear]];
    $('#tabs').innerHTML = T.map(([k, l, i]) => `<button data-tab="${k}" class="${U.tab === k ? 'on' : ''}">${i}<span>${l}</span></button>`).join('');
  }
  function stepper() {
    return `<div class="stepper"><button data-step="-1" aria-label="Previous month">‹</button><b>${C.monthLabel(month())}</b><button data-step="1" aria-label="Next month">›</button></div>`;
  }
  function ring(p, label) {
    const s = 92, r = 41, c = 2 * Math.PI * r, v = Math.min(Math.max(p, 0), 1);
    return `<div><div class="ring"><svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle class="bg" cx="46" cy="46" r="${r}"/>${v > 0.004 ? `<circle class="fg ${p > 1 ? 'over' : ''}" cx="46" cy="46" r="${r}" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}"/>` : ''}</svg><div class="n ${p > 1 ? 'neg' : ''}">${pct(p)}</div></div><div class="ring-l">${label}</div></div>`;
  }
  function trendChart(m) {
    const W = 340, H = 130, top = 14, base = 104, n = m.trend.length, bw = 30, gap = (W - 20 - n * bw) / (n - 1 || 1);
    const max = Math.max(m.budget, ...m.trend.map(t => t.spent), 1) * 1.12, y = v => base - (v / max) * (base - top);
    const bars = m.trend.map((t, i) => { const x = 10 + i * (bw + gap), h = base - y(t.spent), cur = t.ym === m.ym;
      return `<rect x="${x.toFixed(1)}" y="${y(t.spent).toFixed(1)}" width="${bw}" height="${Math.max(h, 0).toFixed(1)}" rx="5" fill="${cur ? 'var(--ink)' : 'var(--bar)'}"/>` +
        `<text x="${(x + bw / 2).toFixed(1)}" y="${base + 14}" text-anchor="middle">${C.MONTHS[+t.ym.slice(5) - 1].slice(0, 3)}</text>` +
        (t.spent > 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y(t.spent) - 4).toFixed(1)}" text-anchor="middle">${Math.round(t.spent / 100) / 10}k</text>` : ''); }).join('');
    const by = y(m.budget).toFixed(1);
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%">${bars}${m.budget > 0 ? `<line x1="4" x2="${W - 4}" y1="${by}" y2="${by}" stroke="var(--faint)" stroke-dasharray="4 4"/>` : ''}</svg></div>${m.budget > 0 ? `<div class="sub" style="margin-top:6px">Dashed line is your monthly budget, ${money(m.budget)}.</div>` : ''}`;
  }
  function home() {
    const m = C.computeMonth(S, month());
    if (!S.tx.length) return `<h1>Budget</h1><div class="empty">No data yet.<br>Load your data file or import a statement in Settings.</div><button class="btn" data-go="settings">Open Settings</button>`;
    const lt = m.leftToSpend, lo = m.leftOver;
    const groups = m.groups.filter(g => g.budget > 0 || g.actual !== 0).map(g => `
      <div class="grp ${U.open[g.name] ? 'open' : ''}" data-grp="${esc(g.name)}">
        <div class="grow"><span>${esc(g.name)}</span><span>${money(g.actual)} of ${money(g.budget)}</span></div>
        <div class="bar"><i class="${g.pct > 1 ? 'over' : ''}" style="width:${Math.min(g.pct, 1) * 100}%"></i></div>
        <div class="subs">${g.cats.filter(c => c.budget > 0 || c.actual !== 0).map(c => `<div class="srow"><span>${esc(c.name)}</span><span class="${c.budget > 0 && c.actual > c.budget ? 'neg' : ''}">${money(c.actual)} / ${money(c.budget)}</span></div>`).join('')}</div>
      </div>`).join('');
    const tr = m.travel, ahead = tr.pace > 0;
    return `<h1>Budget</h1>${stepper()}
      <div class="tiles">
        <div class="tile"><div class="l">Spent</div><div class="v">${money(m.spent)}</div><div class="c">of ${money(m.budget)} budget</div></div>
        <div class="tile"><div class="l">Left to spend</div><div class="v ${lt < 0 ? 'neg' : ''}">${money(lt)}</div><div class="c">${lt < 0 ? 'over budget' : pct(m.gauges.budgetUsed) + ' used'}</div></div>
        <div class="tile"><div class="l">Saved</div><div class="v">${money(m.saved)}</div><div class="c">${m.income ? pct(m.gauges.savingsRate) + ' of income, net of withdrawals' : 'set income in Settings'}</div></div>
        <div class="tile"><div class="l">Left over</div><div class="v ${lo < 0 ? 'neg' : ''}">${money(lo)}</div><div class="c">${m.extraIncome > 0 ? (m.incomeFromPay ? 'your pay' : 'typed pay') + ' plus ' + money(m.extraIncome) + ' extra income, less spending and saving' : (m.incomeFromPay ? 'your pay less spending and saving' : 'typed income less spending and saving')}</div></div>
      </div>
      <div class="rings">${ring(m.gauges.budgetUsed, 'Budget used')}${ring(m.gauges.savingsRate, 'Savings rate')}${ring(m.gauges.incomeSpent, 'Income spent')}</div>
      ${m.uncategorized ? `<div class="note"><b>${m.uncategorized} purchase${m.uncategorized > 1 ? 's' : ''}</b> need a category. <a href="#" data-uncat="1" style="color:var(--fg)">Review</a></div>` : ''}
      <h2>Last 6 months</h2>${trendChart(m)}
      <h2>Where it went</h2><div class="card">${groups}</div>
      ${tr.yearly > 0 ? `<h2>Travel fund</h2><div class="travel">${ring(tr.yearly ? tr.spent / tr.yearly : 0, 'of year')}<div class="who">${tr.who.map(w => `<div><span>${esc(w.name)}</span><span>${money(w.spent)} / ${money(w.budget)}</span></div>`).join('')}<div class="sub" style="display:block;margin-top:6px">${ahead ? 'You are ' + money(tr.pace) + ' ahead of pace.' : 'You are ' + money(-tr.pace) + ' under pace.'}</div></div></div>` : ''}
      ${m.work.tracked ? `<h2>Work expenses</h2><div class="card">
        <div class="row"><div class="t">Charged to your cards</div><div class="a">${money(m.work.charged)}</div></div>
        <div class="row"><div class="t">Reimbursed by work</div><div class="a">${money(m.work.reimbursed)}</div></div>
        <div class="row"><div class="t">Gym allowance, netted against Gym</div><div class="a">${money(m.work.gym)}</div></div>
        <div class="row"><div class="t"><b>${m.work.owed >= 0 ? 'Still owed to you' : 'Received ahead of charges'}</b><div class="m">Since ${esc(S.settings.reimbFrom)}</div></div><div class="a">${money(Math.abs(m.work.owed))}</div></div></div>` : ''}
      <h2>Biggest purchases</h2><div class="card">${m.biggest.length ? m.biggest.map(b => `<div class="row"><div class="t"><div>${esc(b.t.desc)}</div><div class="m">${b.t.date.slice(5)} · ${esc(b.t.cat)}</div></div><div class="a">${money2(b.s)}</div></div>`).join('') : '<div class="row sub">Nothing this month.</div>'}</div>`;
  }
  function activity() {
    const ym = month(), q = U.search.trim().toLowerCase();
    let rows = S.tx.filter(t => t.date.startsWith(ym));
    if (U.onlyUncat) rows = rows.filter(t => t.cat === 'Uncategorized');
    if (q) rows = rows.filter(t => (t.desc + ' ' + t.cat).toLowerCase().includes(q));
    rows.sort((a, b) => b.date.localeCompare(a.date));
    const body = rows.length ? rows.map(t => { const s = C.spendOf(S, t), ns = C.isNotSpend(t.cat);
      return `<div class="row" data-tx="${S.tx.indexOf(t)}"><div class="t"><div>${esc(t.desc)}</div><div class="m">${t.date.slice(5)} · <span class="${t.cat === 'Uncategorized' ? 'neg' : ''}">${esc(t.cat)}</span> · ${esc(t.card)}</div></div><div class="a ${s < 0 && !ns ? '' : ''}" style="${ns ? 'color:var(--faint)' : ''}">${money2(s)}</div></div>`; }).join('') : '<div class="row sub">No purchases found.</div>';
    return `<h1>Activity</h1>${stepper()}<input class="search" id="q" type="search" placeholder="Search" value="${esc(U.search)}">
      <div class="chips"><button class="chip ${U.onlyUncat ? 'on' : ''}" data-chip="uncat">Needs a category</button></div><div class="card">${body}</div>`;
  }
  function add() {
    const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return `<h1>Add</h1><div class="sub">For cash, e-transfers and savings. Card purchases arrive from your statements.</div>
      <input id="a-amt" class="big" inputmode="decimal" placeholder="$0.00" autocomplete="off">
      <label class="f">Description</label><input id="a-desc" placeholder="Coffee with a friend" autocomplete="off">
      <label class="f">Category</label><button class="pick" id="a-cat"><span>${esc(U.addCat)}</span><span>›</span></button>
      <label class="f">Date</label><input id="a-date" type="date" value="${iso}">
      <label class="f">Paid with</label><select id="a-card">${['Cash / debit', 'Bank transfer'].map(c => `<option ${U.addCard === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <button class="btn" id="a-save">Add</button>`;
  }
  function numRow(label, id, val, small) { return `<div class="inline"><label>${esc(label)}${small ? `<small>${small}</small>` : ''}</label><input data-set="${id}" inputmode="decimal" value="${val === 0 || val == null ? '' : val}" placeholder="0"></div>`; }
  function settings() {
    const spendCats = S.categories.filter(c => c.group !== 'Savings' && c.group !== 'Not spending' && c.group !== 'Income');
    let lastG = '';
    const budgets = spendCats.map(c => { const src = C.budgetSource(S, c.name); let h = ''; if (c.group !== lastG) { h += `<div class="gl">${esc(c.group)}</div>`; lastG = c.group; }
      if (src === 'manual') h += numRow(c.name, 'b:' + c.name, S.budgets[c.name]);
      else h += `<div class="inline"><label>${esc(c.name)}<small>${src === 'bill' ? 'from monthly bills' : 'from travel fund'}</small></label><b>${money(C.budgetFor(S, c.name))}</b></div>`; return h; }).join('');
    const bills = (S.bills || []).map((b, i) => numRow(b.name, 'bill:' + i, b.amount, 'per month since ' + (b.since || '') + (b.until ? ' until ' + b.until : ''))).join('') || '<div class="sub">None</div>';
    const who = S.travel.who.map((w, i) => numRow(w.name + ' share (%)', 'share:' + i, Math.round(w.share * 100))).join('');
    const total = Math.round(S.travel.who.reduce((a, w) => a + w.share, 0) * 100);
    const rules = S.rules.slice().reverse().map((r, i) => `<div class="inline"><label>${esc(r[0])}<small>${esc(r[1])}</small></label><button class="x" data-delrule="${S.rules.length - 1 - i}">×</button></div>`).join('');
    return `<h1>Settings</h1>
      <h2>Income</h2><div class="card">${numRow('Monthly take-home', 'income', S.income)}</div>
      <h2>Dates</h2><div class="card">
        <div class="inline"><label>Track reimbursements from<small>Work expenses are counted from this date</small></label><input type="date" style="width:150px" data-set="reimbFrom" value="${esc(S.settings.reimbFrom || '')}"></div></div>
      <h2>Monthly bills</h2><div class="card">${bills}</div>
      <h2>Travel fund</h2><div class="card">${numRow('Yearly budget', 'travel', S.travel.yearly)}${S.travel.who.length > 1 ? who + `<div class="sub" style="padding:6px 0">Shares total ${total}%${total !== 100 ? ' (should be 100)' : ''}.</div>` : '<div class="sub" style="padding:6px 0">The monthly Trips budget is this divided by 12.</div>'}</div>
      <h2>Budgets</h2><div class="card">${budgets}</div>
      <h2>Sorting rules</h2><div class="sub">If a keyword appears in a description, it gets that category. Newer rules win.</div>
      <div class="card scroll" style="margin-top:8px">${rules || '<div class="row sub">None</div>'}</div>
      <button class="btn ghost" id="add-rule">Add a rule</button>
      <h2>Data</h2>
      <button class="btn" id="imp-st">Import a statement (CSV)</button>
      <button class="btn ghost" id="imp-data">Load a data file</button>
      <button class="btn ghost" id="exp-backup">Export a backup</button>
      <button class="btn ghost" id="exp-manual">Export hand-added entries (CSV)</button>
      <button class="btn danger" id="reset">Erase everything on this phone</button>
      <p class="sub" style="margin-top:18px">Your data stays on this phone. Nothing is sent anywhere. Export a backup now and then.</p>`;
  }
  function render() {
    tabs(); const sc = $('#screen'); const y = window.scrollY;
    sc.innerHTML = ({ home, activity, add, settings })[U.tab](); if (U.render !== U.tab) { window.scrollTo(0, 0); U.render = U.tab; } else window.scrollTo(0, y);
  }
  function sheet(html, onMount) {
    const root = $('#sheet-root'); root.innerHTML = `<div class="sheet-bg"><div class="sheet">${html}</div></div>`;
    root.querySelector('.sheet-bg').addEventListener('click', e => { if (e.target.classList.contains('sheet-bg')) closeSheet(); });
    if (onMount) onMount(root.querySelector('.sheet'));
  }
  const closeSheet = () => { $('#sheet-root').innerHTML = ''; };
  function pickCategory(current, cb) {
    const order = []; S.categories.forEach(c => { if (!order.includes(c.group)) order.push(c.group); });
    sheet('<h3>Category</h3>' + order.map(g => `<div class="gl">${esc(g)}</div>` + S.categories.filter(c => c.group === g).map(c => `<button class="opt ${c.name === current ? 'on' : ''}" data-cat="${esc(c.name)}">${esc(c.name)}</button>`).join('')).join(''),
      el => el.addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { closeSheet(); cb(b.dataset.cat); } }));
  }
  function txSheet(i) {
    const t = S.tx[i]; if (!t) return;
    const kw = C.collapse(t.desc).split(' ').slice(0, 2).join(' ').toUpperCase().slice(0, 20);
    sheet(`<h3>${esc(t.desc)}</h3><div class="sub">${t.date} · ${esc(t.card)} · ${money2(C.spendOf(S, t))}</div>
      <label class="f">Category</label><button class="pick" id="t-cat"><span>${esc(t.cat)}</span><span>›</span></button>
      <label class="f"><input type="checkbox" id="t-rule" style="width:auto;margin-right:8px;vertical-align:middle">Also sort future purchases like this one</label>
      <input id="t-kw" value="${esc(kw)}" placeholder="Keyword in the description">
      <button class="btn ghost" id="t-work">Mark as work expense</button>${t.manual ? '<button class="btn danger" id="t-del">Delete this entry</button>' : ''}<button class="btn ghost" id="t-close">Close</button>`, el => {
      el.querySelector('#t-close').onclick = closeSheet;
      el.querySelector('#t-work').onclick = () => { applyTx(i, 'Work expense (reimbursed)', ''); closeSheet(); toast('Marked as a work expense'); };
      el.querySelector('#t-cat').onclick = () => {
        const useRule = el.querySelector('#t-rule').checked, k = el.querySelector('#t-kw').value.trim();
        pickCategory(S.tx[i].cat, c => { applyTx(i, c, useRule ? k : ''); if (useRule && k) toast('Rule added'); txSheet(i); });
      };
      const del = el.querySelector('#t-del'); if (del) del.onclick = () => { S.tx.splice(i, 1); save(); closeSheet(); render(); };
    });
  }
  function applyTx(i, cat, kw) {
    const t = S.tx[i]; t.cat = cat; t.locked = true;
    if (kw) { S.rules.push([kw, cat]); C.recategorize(S); }
    save(); render();
  }
  function shareFile(name, text, type) {
    const file = new File([text], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: name }).catch(() => {});
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast('Saved ' + name);
  }
  function readFile(input, cb) { const f = input.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { cb(String(r.result), f.name); input.value = ''; }; r.readAsText(f); }

  document.addEventListener('click', e => {
    const g = e.target.closest.bind(e.target);
    let el;
    if ((el = g('[data-tab]'))) { U.tab = el.dataset.tab; render(); }
    else if ((el = g('[data-go]'))) { U.tab = el.dataset.go; render(); }
    else if ((el = g('[data-step]'))) { S.ui.month = C.shiftMonth(month(), +el.dataset.step); save(); render(); }
    else if ((el = g('[data-grp]')) && g('.grow')) { U.open[el.dataset.grp] = !U.open[el.dataset.grp]; el.classList.toggle('open'); }
    else if (g('[data-uncat]')) { e.preventDefault(); U.tab = 'activity'; U.onlyUncat = true; render(); }
    else if (g('[data-chip]')) { U.onlyUncat = !U.onlyUncat; render(); }
    else if ((el = g('[data-tx]'))) txSheet(+el.dataset.tx);
    else if (g('#a-cat')) pickCategory(U.addCat, c => { U.addCat = c; $('#a-cat span').textContent = c; });
    else if (g('#a-save')) {
      const amt = C.parseAmount($('#a-amt').value), desc = C.collapse($('#a-desc').value), date = $('#a-date').value || new Date().toISOString().slice(0, 10), card = $('#a-card').value;
      if (amt == null || amt === 0) return toast('Enter an amount');
      U.addCard = card; S.tx.push({ id: C.makeId({ date, desc: desc || U.addCat, amount: Math.abs(amt) }), date, desc: desc || U.addCat, amount: Math.abs(amt), card, occ: Date.now(), cat: U.addCat, locked: true, manual: true });
      S.ui.month = date.slice(0, 7); save(); toast('Added ' + money2(Math.abs(amt))); $('#a-amt').value = ''; $('#a-desc').value = '';
    }
    else if ((el = g('[data-delrule]'))) { S.rules.splice(+el.dataset.delrule, 1); C.recategorize(S); save(); render(); }
    else if (g('#add-rule')) {
      const kw = (prompt('Keyword to look for in a description (for example, TIM HORTONS)') || '').trim(); if (!kw) return;
      pickCategory('', c => { S.rules.push([kw.toUpperCase(), c]); C.recategorize(S); save(); render(); toast('Rule added'); });
    }
    else if (g('#imp-st')) $('#file-statement').click();
    else if (g('#imp-data')) $('#file-data').click();
    else if (g('#exp-backup')) shareFile('budget-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S), 'application/json');
    else if (g('#exp-manual')) {
      const rows = S.tx.filter(t => t.manual).map(t => [t.date, '"' + t.desc.replace(/"/g, '""') + '"', t.amount.toFixed(2), t.card, t.cat].join(','));
      shareFile('hand-added-entries.csv', 'Date,Description,Amount,Card,Category\n' + rows.join('\n'), 'text/csv');
    }
    else if (g('#reset')) { if (confirm('Erase all budget data on this phone? Export a backup first if you want to keep it.')) { localStorage.removeItem(KEY); S = C.defaultState(); render(); toast('Erased'); } }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!t.dataset || !t.dataset.set) return;
    const k = t.dataset.set;
    if (k === 'reimbFrom') { S.settings[k] = t.value || null; save(); render(); return toast('Saved'); }
    const v = C.parseAmount(t.value) || 0;
    if (k === 'income') S.income = v;
    else if (k === 'travel') S.travel.yearly = v;
    else if (k.startsWith('share:')) S.travel.who[+k.slice(6)].share = v / 100;
    else if (k.startsWith('bill:')) S.bills[+k.slice(5)].amount = v;
    else if (k.startsWith('b:')) S.budgets[k.slice(2)] = v;
    save(); if (k === 'travel' || k.startsWith('share:') || k.startsWith('bill:')) render(); toast('Saved');
  });
  document.addEventListener('input', e => { if (e.target.id === 'q') { U.search = e.target.value; const pos = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); } });
  $('#file-statement').addEventListener('change', e => readFile(e.target, text => {
    const p = C.parseStatement(text);
    if (!p.rows.length) return toast('No transactions found in that file');
    sheet(`<h3>Import ${p.rows.length} rows</h3><div class="sub">${p.skipped ? p.skipped + ' pending rows will be skipped. ' : ''}Duplicates of purchases you already have are ignored.</div>
      <label class="f">Which card is this?</label><select id="i-card">${['Amex', 'Wealthsimple', 'TD chequing', 'WS Investing'].map(c => `<option ${c === p.card ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <button class="btn" id="i-go">Import</button><button class="btn ghost" id="i-no">Cancel</button>`, el => {
      el.querySelector('#i-no').onclick = closeSheet;
      el.querySelector('#i-go').onclick = () => { const r = C.addImported(S, p.rows, el.querySelector('#i-card').value); const mm = C.matchReimbursements(S); S.ui.month = C.latestMonth(S); save(); closeSheet(); U.tab = 'home'; render(); toast(`${r.added} added, ${r.skipped} already there` + (mm ? `, ${mm} work expense${mm > 1 ? 's' : ''} matched` : '')); };
    });
  }));
  $('#file-data').addEventListener('change', e => readFile(e.target, text => {
    let d; try { d = JSON.parse(text); } catch (x) { return toast('That file could not be read'); }
    if (!d || !Array.isArray(d.tx) || !Array.isArray(d.categories)) return toast('That is not a budget data file');
    if (S.tx.length && !confirm('Replace the data on this phone with this file?')) return;
    S = migrate(d); save(); U.tab = 'home'; render(); toast('Loaded ' + d.tx.length + ' transactions');
  }));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__budget = { get state() { return S; } };
  render();
})();
