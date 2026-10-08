(function (root) {
  'use strict';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const SAVE = ['TFSA', 'FHSA', 'Non-registered'];
  const IGNORE = ['Card payment / transfer', 'Work expense (reimbursed)', 'Reimbursement received', 'Transfer to Wealthsimple', 'Rent transfers'];
  const INCOME = ['Pay', 'Other income'];
  const pad = n => (n < 10 ? '0' : '') + n;
  const collapse = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  const CATS = [
    ['House', ['Rent', 'Utilities & wifi', 'Tenant insurance']],
    ['Subscriptions', ['YouTube Premium', 'Amazon Prime', 'Other subscriptions']],
    ['Transport', ['Uber / taxi', 'Transit & Bike Share', 'Gas', 'Car insurance', 'Car maintenance & parking']],
    ['Food', ['Work lunch', 'Coffee & snacks', 'Dinners out', 'Groceries']],
    ['Fun (above board)', ['Events, concerts & activities']],
    ['Fun (below board)', ['Beers & bars', 'Miscellaneous']],
    ['Health & fitness', ['Gym', 'Pharmacy & personal care']],
    ['Shopping', ['Clothing & gear', 'Amazon & household']],
    ['Trips', ['Trips']],
    ['Gifts', ['Family gifts', 'Other gifts']],
    ['Other', ['E-transfer/miscellaneous', 'Uncategorized']],
    ['Savings', SAVE],
    ['Not spending', IGNORE],
    ['Income', INCOME]
  ];

  function defaultState() {
    const categories = [];
    CATS.forEach(([g, subs]) => subs.forEach(n => categories.push({ name: n, group: g })));
    return {
      v: 1, income: 0, categories, budgets: {}, bills: [],
      travel: { yearly: 0, who: [{ name: 'Trips', cats: ['Trips'], share: 1, budgetCat: 'Trips' }] },
      rules: [['PAYMENT RECEIVED', 'Card payment / transfer'], ['UBER EATS', 'Dinners out'], ['UBER', 'Uber / taxi'],
              ['LCBO', 'Beers & bars'], ['LOBLAWS', 'Groceries'], ['NO FRILLS', 'Groceries'], ['SHOPPERS DRUG MART', 'Pharmacy & personal care'],
              ['PRESTO', 'Transit & Bike Share'], ['BIKE SHARE', 'Transit & Bike Share'], ['STARBUCKS', 'Coffee & snacks'],
              ['PETRO-CANADA', 'Gas'], ['YOUTUBE', 'YouTube Premium'], ['AMAZON PRIME', 'Amazon Prime']],
      cards: { 'Amex': 1, 'Wealthsimple': -1, 'WS Investing': 1, 'WS Cash': -1, 'TD chequing': -1, 'Cash / debit': 1, 'Bank transfer': 1, 'Adjustment': 1 },
      settings: { reimbFrom: null },
      tx: [], ui: { month: null }
    };
  }

  function parseDate(v) {
    if (v == null) return null;
    const t = collapse(v); let m;
    const mi = s => MONTHS.findIndex(x => x.toLowerCase().startsWith(s.toLowerCase().slice(0, 3)));
    if ((m = t.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    if ((m = t.match(/^(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4})$/)) && mi(m[2]) >= 0) return `${m[3]}-${pad(mi(m[2]) + 1)}-${pad(+m[1])}`;
    if ((m = t.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/)) && mi(m[1]) >= 0) return `${m[3]}-${pad(mi(m[1]) + 1)}-${pad(+m[2])}`;
    if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { const a = +m[1], b = +m[2]; return a > 12 ? `${m[3]}-${pad(b)}-${pad(a)}` : `${m[3]}-${pad(a)}-${pad(b)}`; }
    const d = new Date(t); return isNaN(d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseAmount(v) {
    if (v == null) return null; if (typeof v === 'number') return v;
    const t = String(v).trim(); if (!t) return null;
    const neg = /^\(.*\)$/.test(t) || t.includes('-');
    const digits = t.replace(/[^0-9.]/g, ''); if (!digits) return null;
    const n = parseFloat(digits); return isNaN(n) ? null : (neg ? -n : n);
  }
  function csvRows(text) {
    const rows = []; let row = [], f = '', q = false; text = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else f += c;
    }
    row.push(f); if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }
  function parseStatement(text) {
    const rows = csvRows(text); const out = { card: 'Amex', rows: [], skipped: 0, bad: 0 };
    if (!rows.length) return out;
    const hd0 = rows[0].map(c => collapse(c).toLowerCase());
    if (hd0.includes('activity_type') && hd0.includes('net_cash_amount')) {   // Wealthsimple activities export: money movement in investing accounts only
      out.card = 'WS Investing'; const ix = n => hd0.indexOf(n);
      for (const r of rows.slice(1)) {
        const at = collapse(r[ix('account_type')]), sub = collapse(r[ix('activity_sub_type')]);
        const date = parseDate(r[ix('effective_date')]), amount = parseAmount(r[ix('net_cash_amount')]);
        const invest = ['TFSA', 'FHSA', 'Non-registered'].includes(at), cashIn = at === 'Chequing' && sub === 'EFT' && amount > 0;
        if (collapse(r[ix('activity_type')]) !== 'MoneyMovement' || !(invest || cashIn)) { out.skipped++; continue; }
        if (!date || amount == null) { out.bad++; continue; }
        out.rows.push(cashIn ? { date, desc: 'WS Cash deposit', amount, card: 'WS Cash' } : { date, desc: `WS ${at} ${amount >= 0 ? 'money in' : 'money out'}`, amount, card: 'WS Investing' });
      }
      return out;
    }
    let h = rows.findIndex(r => r.some(c => collapse(c).toLowerCase() === 'date'));
    if (h < 0 && rows[0].length === 5 && parseDate(rows[0][0])) {   // TD: no header row; date, description, money out, money in, balance
      out.card = 'TD chequing';
      for (const r of rows) {
        const date = parseDate(r[0]); if (!date) { out.bad++; continue; }
        const amount = Math.round(((parseAmount(r[3]) || 0) - (parseAmount(r[2]) || 0)) * 100) / 100;
        out.rows.push({ date, desc: collapse(r[1]), amount });
      }
      return out;
    }
    if (h < 0) h = 0;
    const head = rows[h].map(c => collapse(c).toLowerCase());
    const find = keys => head.findIndex(c => keys.some(k => c.includes(k)));
    let di = head.indexOf('date'); if (di < 0) di = find(['date']);
    const si = find(['description', 'payee', 'merchant', 'details']), ai = find(['amount']);
    const ti = head.indexOf('transaction_type'), ui = head.indexOf('status');
    if (di < 0 || si < 0 || ai < 0) return out;
    if (ti >= 0) out.card = 'Wealthsimple';
    for (const r of rows.slice(h + 1)) {
      if (ui >= 0 && r[ui] && collapse(r[ui]).toLowerCase() !== 'completed') { out.skipped++; continue; }
      const isPay = ti >= 0 && collapse(r[ti]).toLowerCase() === 'payment';
      const desc = isPay ? 'PAYMENT RECEIVED - WEALTHSIMPLE' : collapse(r[si]);
      const date = parseDate(r[di]), amount = parseAmount(r[ai]);
      if (!date || amount == null) { out.bad++; continue; }
      out.rows.push({ date, desc, amount });
    }
    return out;
  }
  const makeId = r => `${r.date} | ${r.desc} | ${r.amount.toFixed(2)}`;
  function categorize(desc, rules, amount) {
    const u = String(desc).toUpperCase(); let hit = null;
    for (const r of rules) {
      const kk = collapse(r[0]).toUpperCase();
      if (kk && u.includes(kk) && (r[2] == null || r[2] === '' || (amount != null && Math.abs(Math.abs(amount) - Number(r[2])) < 0.005))) hit = r[1];
    }
    return hit || 'Uncategorized';
  }
  const txKey = t => [t.date, t.desc, t.amount.toFixed(2), t.card, t.occ].join('|');
  function addImported(state, rows, card) {
    const have = new Set(state.tx.map(txKey)); const seen = {}; let added = 0, skipped = 0;
    for (const r of rows) {
      const cd = r.card || card;
      const base = [r.date, r.desc, r.amount.toFixed(2), cd].join('|');
      seen[base] = (seen[base] || 0) + 1;
      const t = { id: makeId(r), date: r.date, desc: r.desc, amount: r.amount, card: cd, occ: seen[base], cat: categorize(r.desc, state.rules, r.amount), locked: false };
      if (have.has(txKey(t))) { skipped++; continue; }
      state.tx.push(t); have.add(txKey(t)); added++;
    }
    return { added, skipped };
  }
  function recategorize(state) { state.tx.forEach(t => { if (!t.locked) t.cat = categorize(t.desc, state.rules, t.amount); }); }
  const spendOf = (state, t) => t.amount * (state.cards[t.card] == null ? 1 : state.cards[t.card]);
  const isNotSpend = c => SAVE.includes(c) || IGNORE.includes(c) || INCOME.includes(c);
  const ymOf = d => d.slice(0, 7);
  function shiftMonth(ym, n) { let [y, m] = ym.split('-').map(Number); m += n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${pad(m)}`; }
  function monthLabel(ym) { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; }
  function latestMonth(state) { let best = null; state.tx.forEach(t => { const m = ymOf(t.date); if (!best || m > best) best = m; }); return best; }
  function billsFor(state, ym) {
    const out = {};
    (state.bills || []).forEach(b => { if ((!b.since || b.since <= ym) && (!b.until || ym <= b.until)) out[b.category] = (out[b.category] || 0) + b.amount; });
    return out;
  }
  function budgetFor(state, cat) {
    const w = state.travel.who.find(x => x.budgetCat === cat);
    if (w) return Math.round(state.travel.yearly * w.share / 12);
    const bs = (state.bills || []).filter(b => b.category === cat).reduce((a, b) => a + b.amount, 0);
    if (bs) return bs;
    return Number(state.budgets[cat]) || 0;
  }
  function budgetSource(state, cat) {
    if (state.travel.who.find(x => x.budgetCat === cat)) return 'travel';
    if ((state.bills || []).some(b => b.category === cat)) return 'bill';
    return 'manual';
  }
  function totalsByCat(state, ym) {
    const out = {};
    state.tx.forEach(t => { if (ymOf(t.date) === ym) out[t.cat] = (out[t.cat] || 0) + spendOf(state, t); });
    const b = billsFor(state, ym); Object.keys(b).forEach(c => { out[c] = (out[c] || 0) + b[c]; });
    return out;
  }
  function monthSpent(state, ym) { const t = totalsByCat(state, ym); return Object.keys(t).filter(c => !isNotSpend(c)).reduce((a, c) => a + t[c], 0); }
  function computeMonth(state, ym) {
    const tot = totalsByCat(state, ym); const groups = [];
    const order = []; state.categories.forEach(c => { if (!order.includes(c.group)) order.push(c.group); });
    order.filter(g => g !== 'Savings' && g !== 'Not spending' && g !== 'Income').forEach(g => {
      const cats = state.categories.filter(c => c.group === g).map(c => ({ name: c.name, budget: budgetFor(state, c.name), actual: tot[c.name] || 0 }));
      const budget = cats.reduce((a, c) => a + c.budget, 0), actual = cats.reduce((a, c) => a + c.actual, 0);
      groups.push({ name: g, budget, actual, left: budget - actual, pct: budget > 0 ? actual / budget : (actual > 0 ? 1 : 0), cats });
    });
    const spent = groups.reduce((a, g) => a + g.actual, 0), budget = groups.reduce((a, g) => a + g.budget, 0);
    const est = 0;
    const saved = SAVE.reduce((a, c) => a + (tot[c] || 0), 0) + est;
    const payTx = state.tx.filter(t => ymOf(t.date) === ym && t.cat === 'Pay');
    const incFromPay = payTx.length >= 2;
    const extra = -state.tx.filter(t => ymOf(t.date) === ym && t.cat === 'Other income').reduce((a, t) => a + spendOf(state, t), 0);
    const inc = (incFromPay ? -payTx.reduce((a, t) => a + spendOf(state, t), 0) : (Number(state.income) || 0)) + extra;
    const rf = state.settings && state.settings.reimbFrom, next = shiftMonth(ym, 1) + '-01';
    const inRange = t => rf && t.date >= rf && t.date < next;
    const inMonth = t => ymOf(t.date) === ym;
    const sum = (f) => state.tx.filter(f).reduce((a, t) => a + spendOf(state, t), 0);
    const work = { charged: sum(t => inMonth(t) && t.cat === 'Work expense (reimbursed)'), reimbursed: -sum(t => inMonth(t) && t.cat === 'Reimbursement received'),
                   gym: -sum(t => inMonth(t) && t.cat === 'Gym' && t.card === 'TD chequing'),
                   chargedSince: sum(t => inRange(t) && t.cat === 'Work expense (reimbursed)'), reimbursedSince: -sum(t => inRange(t) && t.cat === 'Reimbursement received'),
                   gymSince: -sum(t => inRange(t) && t.cat === 'Gym' && t.card === 'TD chequing'), tracked: !!rf };
    work.owed = work.chargedSince - work.reimbursedSince;
    const year = ym.slice(0, 4), endYm = ym;
    const ytd = cats => state.tx.filter(t => cats.includes(t.cat) && ymOf(t.date) >= year + '-01' && ymOf(t.date) <= endYm).reduce((a, t) => a + spendOf(state, t), 0);
    const who = state.travel.who.map(w => { const b = state.travel.yearly * w.share, s = ytd(w.cats); return { name: w.name, budget: b, spent: s, left: b - s }; });
    const tSpent = who.reduce((a, w) => a + w.spent, 0);
    const mNum = Number(ym.slice(5, 7)), expect = state.travel.yearly * mNum / 12;
    const biggest = state.tx.filter(t => ymOf(t.date) === ym && !isNotSpend(t.cat) && spendOf(state, t) > 0)
      .map(t => ({ t, s: spendOf(state, t) })).sort((a, b) => b.s - a.s).slice(0, 5);
    const trend = []; for (let i = 5; i >= 0; i--) { const m = shiftMonth(ym, -i); trend.push({ ym: m, spent: monthSpent(state, m) }); }
    return {
      ym, groups, spent, budget, saved, savedEstimate: est, incomeFromPay: incFromPay, extraIncome: extra, work, leftToSpend: budget - spent, leftOver: inc - spent - saved, income: inc,
      gauges: { budgetUsed: budget ? spent / budget : 0, savingsRate: inc ? saved / inc : 0, incomeSpent: inc ? spent / inc : 0 },
      travel: { yearly: state.travel.yearly, spent: tSpent, who, expect, pace: tSpent - expect },
      biggest, trend, uncategorized: state.tx.filter(t => ymOf(t.date) === ym && t.cat === 'Uncategorized').length
    };
  }
  function matchReimbursements(state) {
    let n = 0; const used = new Set();
    state.tx.filter(t => t.cat === 'Reimbursement received' && t.amount > 0).forEach(dep => {
      const dMax = new Date(dep.date + 'T00:00:00'), dMin = new Date(dMax.getTime() - 100 * 86400000);
      const cand = state.tx.map((t, i) => [t, i]).filter(([t, i]) => (t.card === 'Amex' || t.card === 'Wealthsimple') && !t.locked && !used.has(i) && t.cat !== 'Work expense (reimbursed)' &&
        Math.abs(spendOf(state, t) - dep.amount) < 0.005 && spendOf(state, t) > 0 && new Date(t.date + 'T00:00:00') <= dMax && new Date(t.date + 'T00:00:00') >= dMin)
        .sort((a, b) => b[0].date.localeCompare(a[0].date));
      if (cand.length) { const [t, i] = cand[0]; t.cat = 'Work expense (reimbursed)'; t.locked = true; used.add(i); n++; }
    });
    return n;
  }
  const mIdx = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m; };
  function wsEstimate(state, ym) {
    const td = state.settings && state.settings.tdStart; if (!td) return 0;
    const nTD = mIdx(ym) - mIdx(td) + 1; if (nTD <= 0) return 0;
    const n = Math.min(3, nTD), start = shiftMonth(ym, -(n - 1));
    const inWin = t => ymOf(t.date) >= start && ymOf(t.date) <= ym;
    const T = state.tx.filter(t => t.cat === 'Transfer to Wealthsimple' && inWin(t)).reduce((a, t) => a + spendOf(state, t), 0);
    const P = -state.tx.filter(t => t.card === 'Wealthsimple' && t.cat === 'Card payment / transfer' && inWin(t)).reduce((a, t) => a + spendOf(state, t), 0);
    const rent = (state.bills || []).filter(b => b.category === 'Rent').reduce((a, b) => a + b.amount, 0);
    return (T - P - rent * n) / n;
  }
  const api = { MONTHS, SAVE, IGNORE, CATS, defaultState, parseDate, parseAmount, csvRows, parseStatement, makeId, categorize, addImported,
                recategorize, matchReimbursements, wsEstimate, INCOME, spendOf, isNotSpend, shiftMonth, monthLabel, latestMonth, budgetFor, budgetSource, computeMonth, monthSpent, ymOf, collapse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BudgetCore = api;
})(typeof self !== 'undefined' ? self : this);
