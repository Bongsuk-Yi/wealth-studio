/* 돈불리기 — 소개 · 입력 · 출력 · 몬테카를로 · 조언 · A4 보고서
   모든 계산은 브라우저 안에서만 이루어지고, 데이터는 localStorage에만 저장됩니다. */
(() => {
'use strict';

/* ───────────── 상수 · 예시 ───────────── */
const CATS = ['부동산', '현금', '주식', 'ETF', '채권', '연금'];
const INV = ['주식', 'ETF', '채권', '연금'];
const VOL_DEF = { 부동산: .10, 현금: .01, 주식: .20, ETF: .16, 채권: .06, 연금: .10 };
const TAX_DEF = { 부동산: 0, 현금: .154, 주식: 0, ETF: .154, 채권: .154, 연금: .055, 수입: 0 };
const TAX_OPTS = [0, .033, .055, .088, .099, .154, .165, .22, .275, .33, .385];
const TAX_LABEL = { 0: '0% (비과세)', .055: '5.5% (연금소득세)', .154: '15.4% (이자·배당)', .22: '22% (해외주식 양도)' };
const taxLabel = (v) => TAX_LABEL[v] || (Math.round(v * 1000) / 10) + '%';
const MC_DEF = { runs: 5000, vol: { ...VOL_DEF }, tax: { ...TAX_DEF }, taxOn: true };
const DEF_RATE = { 부동산: .03, 현금: .02, 주식: .07, ETF: .06, 채권: .04, 연금: .05 };

const EXAMPLE = {
  years: 10, horizon: 30, age: 40, retireAge: 60, target: 1000000000,
  assets: [
    { cat: '부동산', name: '아파트(거주)', amt: 500000000, rate: .03 },
    { cat: '현금', name: '예금·적금', amt: 30000000, rate: .03 },
    { cat: '주식', name: '국내 주식', amt: 20000000, rate: .08 },
    { cat: 'ETF', name: '미국 지수 ETF', amt: 15000000, rate: .07 },
    { cat: '채권', name: '국채', amt: 10000000, rate: .04 },
    { cat: '연금', name: 'IRP·연금저축', amt: 25000000, rate: .05 },
  ],
  incomes: [
    { name: '근로소득', amt: 48000000, rate: .03, start: 1, end: 15 },
    { name: '임대소득', amt: 12000000, rate: .02, start: 1, end: 30 },
    { name: '국민연금', amt: 18000000, rate: .02, start: 16, end: 30 },
  ],
  expenses: [
    { name: '생활비', amt: 36000000, rate: .03, start: 1, end: 30 },
    { name: '자녀 교육비', amt: 6000000, rate: .05, start: 1, end: 12 },
    { name: '여행·여가', amt: 3000000, rate: .02, start: 1, end: 30 },
    { name: '노후 의료비', amt: 3000000, rate: .05, start: 20, end: 30 },
  ],
  mc: MC_DEF,
};
const blankPlan = () => ({
  years: 10, horizon: 30, age: 35, retireAge: 60, target: 0,
  assets: CATS.map((c) => ({ cat: c, name: '', amt: 0, rate: DEF_RATE[c] })),
  incomes: [{ name: '', amt: 0, rate: .03, start: 1, end: 30 }],
  expenses: [{ name: '', amt: 0, rate: .03, start: 1, end: 30 }],
  mc: clone(MC_DEF),
});

/* ───────────── 도우미 ───────────── */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (_) {} };
const numIn = (v) => { const s = String(v ?? ''); const n = +s.replace(/[^0-9]/g, '') || 0; return s.trim().startsWith('-') ? -n : n; };
const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
function kr(n) {
  if (!isFinite(n)) return '-';
  const sg = n < 0 ? '−' : ''; n = Math.abs(Math.round(n));
  const e = Math.floor(n / 1e8), m = Math.round((n % 1e8) / 1e4);
  if (e > 0) return sg + e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만' : '') + '원';
  return sg + (m ? m.toLocaleString('ko-KR') + '만원' : n.toLocaleString('ko-KR') + '원');
}
const pct = (n, d = 1) => (isFinite(n) ? (n * 100).toFixed(d) + '%' : '-');
const axisFmt = (v) => { const a = Math.abs(v); return a >= 1e8 ? (v / 1e8).toFixed(a >= 1e9 ? 0 : 1) + '억' : a >= 1e4 ? Math.round(v / 1e4).toLocaleString('ko-KR') + '만' : v; };
const alpha = (hex, a) => { let h = (hex || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return '#' + h.slice(0, 6) + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0'); };
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const todayKo = () => new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); }

/* ───────────── 상태 ───────────── */
let S = normalize(clone(EXAMPLE));
let cur = null;               // 저장된 계획 { id, name } 또는 null(예시·임시)
let isExample = true;
let savedJson = JSON.stringify(S);
let H = S.horizon;

function normalize(s) {
  s = s && typeof s === 'object' ? s : {};
  for (const k of ['assets', 'incomes', 'expenses']) if (!Array.isArray(s[k])) s[k] = [];
  s.assets = s.assets.filter((a) => a && CATS.includes(a.cat)).map((a) => ({ cat: a.cat, name: String(a.name ?? ''), amt: +a.amt || 0, rate: isFinite(+a.rate) ? +a.rate : DEF_RATE[a.cat] }));
  s.horizon = Math.max(1, Math.min(100, Math.round(+s.horizon || 30)));
  for (const k of ['incomes', 'expenses']) s[k] = s[k].map((x) => ({ name: String(x.name ?? ''), amt: +x.amt || 0, rate: +x.rate || 0, start: Math.min(s.horizon, Math.max(1, +x.start || 1)), end: Math.min(s.horizon, Math.max(1, +x.end || s.horizon)) }));
  if (!(s.years >= 1 && s.years <= s.horizon)) s.years = Math.min(10, s.horizon);
  s.years = Math.round(s.years);
  s.age = +s.age || 35; s.retireAge = +s.retireAge || 60; s.target = Math.max(0, +s.target || 0);
  s.mc = { ...clone(MC_DEF), ...(s.mc || {}) };
  s.mc.vol = { ...VOL_DEF, ...(s.mc.vol || {}) };
  s.mc.tax = { ...TAX_DEF, ...(s.mc.tax || {}) };
  return s;
}
const planName = () => (cur ? cur.name : isExample ? '예시 계획' : '저장 안 된 계획');

/* ───────────── 계산 ───────────── */
function flowAt(list, t) {
  if (t < 1) return 0;
  let s = 0;
  for (const x of list) {
    const st = +x.start || 1, en = +x.end || H;
    if (t >= st && t <= en) s += (+x.amt || 0) * Math.pow(1 + (+x.rate || 0), t - st);
  }
  return s;
}
function project(plan = S) {
  H = plan.horizon;
  const rows = []; let ci = 0, ce = 0;
  for (let t = 0; t <= H; t++) {
    const by = {}; CATS.forEach((c) => (by[c] = 0));
    for (const a of plan.assets) by[a.cat] += (+a.amt || 0) * Math.pow(1 + (+a.rate || 0), t);
    const inv = INV.reduce((s, c) => s + by[c], 0), total = CATS.reduce((s, c) => s + by[c], 0);
    const inc = flowAt(plan.incomes, t), exp = flowAt(plan.expenses, t); ci += inc; ce += exp;
    rows.push({ t, by, inv, total, inc, exp, cumInc: ci, cumExp: ce, net: total + ci - ce });
  }
  return rows;
}
const wavg = (list) => { const s = list.reduce((a, x) => a + (+x.amt || 0), 0); return s ? list.reduce((a, x) => a + (+x.amt || 0) * (+x.rate || 0), 0) / s : NaN; };

/* ───────────── 차트 ───────────── */
function theme(light) {
  if (light) return { light: true, ink: '#5E6673', grid: '#E9ECEF', accent: '#E0A800', pos: '#03A66D', neg: '#CF304A', info: '#3B82F6', surface: '#FFFFFF', c: ['#3D7BEA', '#8A94A3', '#F07B2B', '#9B5DE0', '#1FA8A1', '#E9649E'] };
  return { light: false, ink: cssVar('--muted'), grid: cssVar('--grid'), accent: cssVar('--accent'), pos: cssVar('--pos'), neg: cssVar('--neg'), info: cssVar('--info'), surface: cssVar('--surface'), c: [1, 2, 3, 4, 5, 6].map((i) => cssVar('--c' + i)) };
}
const catColor = (c, T) => T.c[CATS.indexOf(c)];
const charts = new Map();
function mk(cv, cfg) {
  const prev = charts.get(cv); if (prev) prev.destroy();
  const ch = new Chart(cv, cfg); charts.set(cv, ch); return ch;
}
function baseOpts(T, o = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false, animation: T.light ? false : { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: T.ink, boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${kr(c.parsed.y ?? c.parsed)}` } },
    },
    scales: {
      x: { ticks: { color: T.ink, maxRotation: 0, autoSkip: true, font: { size: 11 } }, grid: { color: T.grid } },
      y: { ticks: { color: T.ink, callback: axisFmt, font: { size: 11 } }, grid: { color: T.grid } },
    },
  }, o);
}
const yearLabels = () => [...Array(H + 1).keys()].map((t) => t + '년');
const line = (label, data, color, o = {}) => Object.assign({ label, data, borderColor: color, backgroundColor: alpha(color, .15), borderWidth: 2, pointRadius: 0, tension: .25 }, o);

function chartFlow(cv, P, T) {
  mk(cv, { type: 'line', data: { labels: yearLabels(), datasets: [
    line('총자산', P.map((r) => r.total), T.info),
    line('누적 수입', P.map((r) => r.cumInc), T.pos),
    line('누적 지출', P.map((r) => r.cumExp), T.neg),
    line('순자산', P.map((r) => r.net), T.accent, { borderWidth: 3 }),
  ] }, options: baseOpts(T) });
}
function chartArea(cv, P, T) {
  const o = baseOpts(T); o.scales.y.stacked = true;
  mk(cv, { type: 'line', data: { labels: yearLabels(), datasets: CATS.map((c) => line(c, P.map((r) => r.by[c]), catColor(c, T), { fill: true, backgroundColor: alpha(catColor(c, T), .55), borderWidth: 1, tension: .2 })) }, options: o });
}
function chartBar(cv, P, N, T) {
  mk(cv, { type: 'bar', data: { labels: CATS, datasets: [
    { label: '현재', data: CATS.map((c) => P[0].by[c]), backgroundColor: alpha(T.ink, .55), borderRadius: 4 },
    { label: N + '년 후', data: CATS.map((c) => P[N].by[c]), backgroundColor: CATS.map((c) => catColor(c, T)), borderRadius: 4 },
  ] }, options: baseOpts(T) });
}
function chartPie(cv, P, N, T) {
  const tot = P[N].total || 1;
  mk(cv, { type: 'doughnut', data: { labels: CATS, datasets: [{ data: CATS.map((c) => P[N].by[c]), backgroundColor: CATS.map((c) => catColor(c, T)), borderColor: T.surface, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: T.light ? false : undefined, cutout: '58%',
      plugins: { legend: { position: 'right', labels: { color: T.ink, generateLabels: (ch) => CATS.map((c, i) => ({ text: `${c}  ${pct(P[N].by[c] / tot)}  ${kr(P[N].by[c])}`, fillStyle: catColor(c, T), strokeStyle: catColor(c, T), fontColor: T.ink, index: i })) } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${kr(c.parsed)} (${pct(c.parsed / tot)})` } } } } });
}

/* ───────────── 화면 전환 ───────────── */
const VIEWS = ['intro', 'input', 'output', 'mc', 'advice'];
let view = 'intro';
function go(v) {
  if (!VIEWS.includes(v)) v = 'intro';
  view = v;
  $$('.view').forEach((el) => el.classList.toggle('on', el.id === 'v-' + v));
  $$('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === v));
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  renderView();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  e.preventDefault(); go(t.dataset.go);
});
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
function renderView() {
  H = S.horizon;
  $$('.hz').forEach((el) => (el.textContent = H));
  if (view === 'intro') renderIntro();
  if (view === 'input') renderLive();
  if (view === 'output') renderOutput();
  if (view === 'mc') { renderMcSettings(); drawMC(); mcStaleCheck(); }
  if (view === 'advice') { renderHealth(); if (!$('#chatLog').children.length) greet(); }
}

/* ───────────── 01 소개 ───────────── */
function renderIntro() {
  const P = project(), N = S.years, now = P[0], fut = P[N], tot = now.total || 1, T = theme(false);
  $('#introSnap').innerHTML = `
    <div class="hc-top"><span>${esc(planName())}</span><span>${new Date().getFullYear() + N}년 예상</span></div>
    <div><div class="note">${N}년 후 예상 순자산</div><div class="hc-big">${kr(fut.net)}</div></div>
    <div class="hc-bar">${CATS.map((c) => `<i title="${c} ${pct(now.by[c] / tot)}" style="width:${(now.by[c] / tot) * 100}%;background:${catColor(c, T)}"></i>`).join('')}</div>
    <div class="hc-grid">
      <div><span>현재 총자산</span><b>${kr(now.total)}</b></div>
      <div><span>${N}년 후 총자산</span><b>${kr(fut.total)}</b></div>
      <div><span>${N}년 누적 수입</span><b style="color:var(--pos)">${kr(fut.cumInc)}</b></div>
      <div><span>${N}년 누적 지출</span><b style="color:var(--neg)">${kr(fut.cumExp)}</b></div>
    </div>
    <button class="btn full" data-go="output">자세한 결과 보기 →</button>`;
}
$('#introExample').addEventListener('click', () => {
  if (isDirty() && !isExample) { go('input'); toast('저장 안 된 변경이 있어 입력 화면으로 이동했습니다'); return; }
  loadPlan(null, clone(EXAMPLE), true); go('output');
});

/* ───────────── 02 입력 ───────────── */
const rateOpts = (min, max, sel) => { let o = ''; for (let i = min; i <= max; i++) o += `<option value="${i / 100}"${Math.round(sel * 100) === i ? ' selected' : ''}>${i}%</option>`; return o; };
const yrOpts = (sel) => { let o = ''; for (let i = 1; i <= H; i++) o += `<option value="${i}"${+sel === i ? ' selected' : ''}>${i}년차</option>`; return o; };
let activeTab = 'basic';
const amtVal = (n) => (+n || 0).toLocaleString('ko-KR');

function renderInputs() {
  H = S.horizon;
  let h = '';
  for (const tab of ['basic', 'asset', 'inc', 'exp']) {
    h += `<div class="sect" data-sect="${tab}"${tab === activeTab ? '' : ' hidden'}>`;
    if (tab === 'basic') {
      h += `<div class="basic-grid">
        <label class="mini">현재 나이<input data-b="age" type="number" min="15" max="100" value="${S.age}"></label>
        <label class="mini">은퇴 목표 나이<input data-b="retireAge" type="number" min="30" max="100" value="${S.retireAge}"></label>
        <label class="mini">목표 순자산(원)<input data-b="target" class="amt" inputmode="numeric" value="${amtVal(S.target)}"></label>
        <label class="mini">계산 기간 (1~100년)<input data-b="horizon" type="number" min="1" max="100" value="${S.horizon}"></label>
        <label class="mini">조회 기간<select data-b="years">${Array.from({ length: H }, (_, i) => `<option value="${i + 1}"${S.years === i + 1 ? ' selected' : ''}>${i + 1}년 후</option>`).join('')}</select></label>
      </div>
      <p class="hint">계산 기간은 그래프·표·몬테카를로가 계산하는 햇수입니다. 바꾸면 마지막 연차까지로 잡힌 수입·지출도 함께 늘거나 줄어듭니다. 나이와 목표는 조언과 목표 달성 확률 계산에 쓰입니다.</p>`;
    } else if (tab === 'asset') {
      const groups = [['부동산'], ['현금'], INV], gname = ['부동산', '현금', '투자자산 (주식·ETF·채권·연금)'];
      groups.forEach((g, gi) => {
        const items = S.assets.map((a, i) => ({ a, i })).filter((x) => g.includes(x.a.cat));
        const sum = items.reduce((s, x) => s + (+x.a.amt || 0), 0);
        h += `<div class="grp"><h3><span>${gname[gi]}</span><span data-gsum="${gi}">${kr(sum)}</span></h3>`;
        for (const { a, i } of items) {
          h += `<div class="item i-asset">
            ${g.length > 1 ? `<select data-k="cat" data-l="assets" data-i="${i}" aria-label="세부 분류" style="grid-column:1/-1">${g.map((c) => `<option${c === a.cat ? ' selected' : ''}>${c}</option>`).join('')}</select>` : ''}
            <input data-k="name" data-l="assets" data-i="${i}" value="${esc(a.name)}" placeholder="항목명" aria-label="항목명">
            <input class="amt" data-k="amt" data-l="assets" data-i="${i}" inputmode="numeric" value="${amtVal(a.amt)}" aria-label="현재 평가금액(원)">
            <select data-k="rate" data-l="assets" data-i="${i}" aria-label="예상 연수익률">${rateOpts(-5, 20, a.rate)}</select>
            <button class="del" data-del="assets" data-i="${i}" aria-label="삭제">×</button></div>`;
        }
        h += `<button class="btn add" data-add="${g[0]}">+ ${g.length > 1 ? '투자자산' : g[0]} 항목 추가</button></div>`;
      });
      h += `<p class="hint">현재 평가금액(원)과 예상 연수익률을 입력하세요. 연수익률은 몬테카를로의 평균 수익률로도 쓰입니다.</p>`;
    } else {
      const L = tab === 'inc' ? 'incomes' : 'expenses', kind = tab === 'inc' ? '수입' : '지출';
      h += `<div class="grp"><h3><span>연간 ${kind} 항목</span><span data-tot="${L}">1년차 ${kr(flowAt(S[L], 1))}</span></h3>`;
      S[L].forEach((x, i) => {
        h += `<div class="item i-flow">
          <input data-k="name" data-l="${L}" data-i="${i}" value="${esc(x.name)}" placeholder="${kind} 항목명" aria-label="항목명">
          <input class="amt" data-k="amt" data-l="${L}" data-i="${i}" inputmode="numeric" value="${amtVal(x.amt)}" aria-label="연간 ${kind}액(원)">
          <button class="del" data-del="${L}" data-i="${i}" aria-label="삭제">×</button>
          <div class="meta">
            <label class="mini">연 증감률<select data-k="rate" data-l="${L}" data-i="${i}">${rateOpts(-10, 20, x.rate)}</select></label>
            <label class="mini">시작 시점<select data-k="start" data-l="${L}" data-i="${i}">${yrOpts(x.start || 1)}</select></label>
            <label class="mini">기간(까지)<select data-k="end" data-l="${L}" data-i="${i}">${yrOpts(x.end || H)}</select></label>
          </div></div>`;
      });
      h += `<button class="btn add" data-add="${L}">+ ${kind} 항목 추가</button></div>
        <p class="hint">금액은 <b>연간</b> 기준입니다. 시작 연차에 입력 금액이 발생하고 다음 해부터 매년 증감률만큼 바뀌며, 기간 연차가 지나면 0원입니다.</p>`;
    }
    h += '</div>';
  }
  $('#inputBody').innerHTML = h;
  $('#exampleTag').hidden = !isExample;
}
$$('.tabs button').forEach((bt) => bt.addEventListener('click', () => {
  activeTab = bt.dataset.tab;
  $$('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === bt)));
  $$('[data-sect]').forEach((el) => (el.hidden = el.dataset.sect !== activeTab));
}));
function setHorizon(v) {
  const old = S.horizon, h = Math.max(1, Math.min(100, Math.round(+v || old)));
  if (h === old) { renderInputs(); return; }
  for (const x of [...S.incomes, ...S.expenses]) {
    if (+x.end === old) x.end = h;
    x.end = Math.min(+x.end || h, h); x.start = Math.min(+x.start || 1, h);
  }
  S.horizon = H = h;
  if (S.years > h) S.years = h;
  changed(true);
}
const inputBody = $('#inputBody');
function applyField(el) {
  if (el.dataset.b) {
    const k = el.dataset.b;
    if (k === 'target') S.target = Math.max(0, numIn(el.value));
    else if (k === 'years') S.years = +el.value;
    else if (k !== 'horizon') S[k] = +el.value || 0;
    return;
  }
  const { l, k, i } = el.dataset; if (!l) return;
  const x = S[l][+i]; if (!x) return;
  if (k === 'name' || k === 'cat') x[k] = el.value;
  else if (k === 'amt') x.amt = numIn(el.value);
  else x[k] = +el.value;
}
inputBody.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.b === 'horizon') return;
  if (el.tagName === 'SELECT') return;
  applyField(el);
  changed(false);
});
inputBody.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.b === 'horizon') { setHorizon(el.value); return; }
  applyField(el);
  if (el.classList.contains('amt')) el.value = amtVal(numIn(el.value));
  const k = el.dataset.k;
  if (k === 'start' || k === 'end') {
    const x = S[el.dataset.l][+el.dataset.i];
    if (x.start > x.end) { if (k === 'start') x.end = x.start; else x.start = x.end; }
  }
  changed(el.tagName === 'SELECT' && (k === 'cat' || k === 'start' || k === 'end'));
});
inputBody.addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]'), a = e.target.closest('[data-add]');
  if (d) { S[d.dataset.del].splice(+d.dataset.i, 1); changed(true); }
  if (a) {
    const v = a.dataset.add;
    if (v === 'incomes' || v === 'expenses') S[v].push({ name: '', amt: 0, rate: .03, start: 1, end: H });
    else S.assets.push({ cat: v, name: '', amt: 0, rate: DEF_RATE[v] });
    changed(true);
    setTimeout(() => { const ins = $$(`[data-sect="${activeTab}"] input[data-k="name"]`); ins.at(-1)?.focus(); }, 0);
  }
});
function refreshSums() {
  const groups = [['부동산'], ['현금'], INV];
  groups.forEach((g, gi) => { const el = $(`[data-gsum="${gi}"]`); if (el) el.textContent = kr(S.assets.filter((a) => g.includes(a.cat)).reduce((s, a) => s + (+a.amt || 0), 0)); });
  for (const L of ['incomes', 'expenses']) { const el = $(`[data-tot="${L}"]`); if (el) el.textContent = '1년차 ' + kr(flowAt(S[L], 1)); }
}
function changed(rerender) {
  isExample = false;
  if (rerender) { const f = document.activeElement; const sel = f && f.dataset ? { ...f.dataset } : null; renderInputs(); if (sel && sel.k) $(`[data-l="${sel.l}"][data-k="${sel.k}"][data-i="${sel.i}"]`)?.focus(); }
  else refreshSums();
  setDirty(); saveDraft();
  if (view === 'input') renderLive();
}
function renderLive() {
  const P = project(), N = S.years, fut = P[N];
  const inc1 = flowAt(S.incomes, 1), exp1 = flowAt(S.expenses, 1);
  const rows = [
    ['현재 총자산', kr(P[0].total)], [`${N}년 후 총자산`, kr(fut.total)], [`${N}년 후 순자산`, `<span style="color:var(--accent)">${kr(fut.net)}</span>`],
    ['1년차 수입', kr(inc1)], ['1년차 지출', kr(exp1)], ['1년차 저축률', inc1 ? pct((inc1 - exp1) / inc1) : '-'], ['가중 평균 수익률', pct(wavg(S.assets))],
  ];
  $('#liveKpis').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  const T = theme(false), o = baseOpts(T); o.plugins.legend.display = false;
  mk($('#chLive'), { type: 'line', data: { labels: yearLabels(), datasets: [line('순자산', P.map((r) => r.net), T.accent, { fill: true }), line('총자산', P.map((r) => r.total), T.info)] }, options: o });
}

/* ───────────── 계획 저장소 (localStorage) ───────────── */
const K_PLANS = 'ws.plans', K_CUR = 'ws.current', K_DRAFT = 'ws.draft';
const plans = () => lsGet(K_PLANS, []);
const isDirty = () => JSON.stringify(S) !== savedJson;
function setDirty() {
  const d = isDirty() && !isExample;
  $('#dirty').hidden = !d;
  $('#planChip').classList.toggle('dirty', d);
  $('#planChipText').textContent = planName() + (d ? ' · 변경됨' : '');
  $('#exampleTag').hidden = !isExample;
}
function saveDraft() { lsSet(K_DRAFT, { id: cur ? cur.id : null, isExample, data: S }); }
function renderPlanSel() {
  const list = plans();
  let h = '';
  if (!cur) h += `<option value="">${isExample ? '예시 계획 (저장 안 됨)' : '저장 안 된 계획'}</option>`;
  h += list.map((p) => `<option value="${p.id}"${cur && cur.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  $('#planSel').innerHTML = h;
  $('#btnDel').disabled = !cur;
  $('#planHint').textContent = list.length ? `저장된 계획 ${list.length}개 · 이 브라우저에만 저장됩니다.` : '아직 저장된 계획이 없습니다. ‘저장’을 누르면 이 브라우저에 보관됩니다.';
}
function loadPlan(meta, data, example = false) {
  S = normalize(clone(data)); cur = meta; isExample = example; savedJson = JSON.stringify(S); H = S.horizon;
  if (meta) lsSet(K_CUR, meta.id); else lsDel(K_CUR);
  saveDraft(); afterLoad();
}
function afterLoad() { renderInputs(); renderPlanSel(); setDirty(); loadMC(); renderView(); }
function storePlan(id, name) {
  const list = plans(); const i = list.findIndex((p) => p.id === id);
  const rec = { id, name, updated: new Date().toISOString(), data: S };
  if (i >= 0) list[i] = rec; else list.push(rec);
  if (!lsSet(K_PLANS, list)) { toast('저장하지 못했습니다(브라우저 저장 공간 확인)'); return false; }
  const oldKey = mcKey(); cur = { id, name }; isExample = false; savedJson = JSON.stringify(S);
  if (MC && oldKey !== mcKey()) lsSet(mcKey(), MC);
  lsSet(K_CUR, id); saveDraft(); renderPlanSel(); setDirty(); return true;
}
let nameMode = 'new';
function openName(mode) {
  nameMode = mode; $('#confirmBar').hidden = true;
  $('#nameForm').hidden = false; $('#blankWrap').hidden = mode !== 'new';
  $('#nameLabel').textContent = mode === 'new' ? '새 계획 이름' : '저장할 이름';
  $('#nameOk').textContent = mode === 'new' ? '만들기' : '저장';
  $('#nameIn').value = mode === 'saveas' && cur ? cur.name + ' (사본)' : '';
  $('#nameIn').focus();
}
let confirmFn = null;
function ask(text, fn) { $('#nameForm').hidden = true; $('#confirmText').textContent = text; $('#confirmBar').hidden = false; confirmFn = fn; }
$('#confirmYes').addEventListener('click', () => { $('#confirmBar').hidden = true; const f = confirmFn; confirmFn = null; f && f(); });
$('#confirmNo').addEventListener('click', () => { $('#confirmBar').hidden = true; confirmFn = null; renderPlanSel(); });
$('#nameCancel').addEventListener('click', () => ($('#nameForm').hidden = true));
$('#btnNew').addEventListener('click', () => openName('new'));
$('#btnSaveAs').addEventListener('click', () => openName('saveas'));
$('#btnSave').addEventListener('click', () => { if (cur) { if (storePlan(cur.id, cur.name)) toast('저장했습니다'); } else openName('saveas'); });
$('#btnDel').addEventListener('click', () => {
  if (!cur) return;
  ask(`‘${cur.name}’ 계획을 삭제할까요? 되돌릴 수 없습니다.`, () => {
    lsSet(K_PLANS, plans().filter((p) => p.id !== cur.id)); lsDel('ws.mc.' + cur.id);
    toast('삭제했습니다'); loadPlan(null, clone(EXAMPLE), true);
  });
});
$('#nameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#nameIn').value.trim(); if (!name) return;
  if (plans().some((p) => p.name === name && (!cur || p.id !== cur.id || nameMode !== 'saveas'))) { toast('같은 이름의 계획이 있습니다'); return; }
  $('#nameForm').hidden = true;
  const doIt = () => {
    if (nameMode === 'new') {
      const data = $('#startBlank').checked ? blankPlan() : S;
      S = normalize(clone(data)); cur = null; isExample = false; MC = null;
      storePlan(uid(), name); afterLoad(); toast(`‘${name}’ 계획을 만들었습니다`);
    } else { if (storePlan(uid(), name)) { toast(`‘${name}’(으)로 저장했습니다`); } }
  };
  if (nameMode === 'new' && isDirty() && !isExample) ask('저장 안 된 변경이 있습니다. 버리고 새 계획을 만들까요?', doIt); else doIt();
});
$('#planSel').addEventListener('change', (e) => {
  const id = e.target.value; if (!id) return;
  const rec = plans().find((p) => p.id === id); if (!rec) return;
  const open = () => loadPlan({ id: rec.id, name: rec.name }, rec.data);
  if (isDirty() && !isExample) ask('저장 안 된 변경이 있습니다. 버리고 다른 계획을 열까요?', open); else open();
});
window.addEventListener('beforeunload', (e) => { if (isDirty() && cur) { e.preventDefault(); e.returnValue = ''; } });

/* 불러오기 · 내보내기 */
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const safeName = () => planName().replace(/[\\/:*?"<>|]/g, '_');
$('#btnExportJson').addEventListener('click', () => download(`${safeName()}.json`, new Blob([JSON.stringify({ app: 'wealth-studio', version: 1, name: planName(), plan: S }, null, 2)], { type: 'application/json' })));
const XL_HEAD = ['구분', '분류', '항목명', '금액(원)', '수익률·증감률(%)', '시작 연차', '종료 연차'];
$('#btnTemplate').addEventListener('click', () => {
  if (!window.XLSX) { toast('엑셀 도구를 불러오는 중입니다. 잠시 뒤 다시 누르세요'); return; }
  const rows = [XL_HEAD,
    ['기본', '', '현재 나이', S.age], ['기본', '', '은퇴 목표 나이', S.retireAge], ['기본', '', '목표 순자산', S.target], ['기본', '', '계산 기간', S.horizon], ['기본', '', '조회 기간', S.years],
    ...S.assets.map((a) => ['자산', a.cat, a.name, a.amt, Math.round(a.rate * 100)]),
    ...S.incomes.map((x) => ['수입', '', x.name, x.amt, Math.round(x.rate * 100), x.start, x.end]),
    ...S.expenses.map((x) => ['지출', '', x.name, x.amt, Math.round(x.rate * 100), x.start, x.end])];
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '입력');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['작성 방법'], ['구분: 기본·자산·수입·지출 중 하나'], ['자산의 분류: 부동산·현금·주식·ETF·채권·연금'], ['금액은 원 단위, 수입·지출은 연간 금액'], ['수익률·증감률은 % 숫자 (예: 3 = 3%)']]), '설명');
  XLSX.writeFile(wb, `돈불리기_입력양식.xlsx`);
});
async function importFile(f) {
  if (!f) return;
  try {
    let data;
    if (/\.json$/i.test(f.name)) {
      const o = JSON.parse(await f.text()); data = o.plan || o;
      if (!Array.isArray(data.assets)) throw new Error('계획 파일 형식이 아닙니다');
    } else {
      if (!window.XLSX) throw new Error('엑셀 도구를 아직 불러오지 못했습니다');
      const wb = XLSX.read(await f.arrayBuffer());
      const ws = wb.Sheets['입력'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1);
      data = blankPlan(); data.assets = []; data.incomes = []; data.expenses = [];
      const num = (v) => (typeof v === 'number' ? v : numIn(v)), rate = (v) => (num(v) || 0) / 100;
      for (const r of rows) {
        const [g, c, n, a, rt, st, en] = r.map((x) => (typeof x === 'string' ? x.trim() : x));
        if (g === '기본') {
          const map = { '현재 나이': 'age', '은퇴 목표 나이': 'retireAge', '목표 순자산': 'target', '계산 기간': 'horizon', '조회 기간': 'years' };
          if (map[n]) data[map[n]] = num(a);
        } else if (g === '자산' && CATS.includes(c)) data.assets.push({ cat: c, name: String(n), amt: num(a), rate: rt === '' ? DEF_RATE[c] : rate(rt) });
        else if (g === '수입' || g === '지출') (g === '수입' ? data.incomes : data.expenses).push({ name: String(n), amt: num(a), rate: rate(rt), start: num(st) || 1, end: num(en) || 0 });
      }
      if (!data.assets.length && !data.incomes.length && !data.expenses.length) throw new Error('‘입력’ 시트에서 읽을 행이 없습니다');
    }
    const keepCur = cur;
    S = normalize(data); isExample = false; cur = keepCur;
    renderInputs(); setDirty(); saveDraft(); renderView();
    toast(`‘${f.name}’을 불러왔습니다${cur ? ' — 저장을 눌러 반영하세요' : ''}`);
  } catch (e) { toast('불러오지 못했습니다: ' + (e.message || e)); }
}
$('#fileIn').addEventListener('change', (e) => { importFile(e.target.files[0]); e.target.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => importFile(e.dataTransfer.files[0]));

/* ───────────── 03 출력 ───────────── */
function kpiHTML(P, N) {
  const now = P[0], f = P[N];
  const goal = S.target ? P.findIndex((r) => r.net >= S.target) : -1;
  const k = [
    ['현재 총자산', now.total, ''], [`${N}년 후 총자산`, f.total, ''], [`${N}년 누적 수입`, f.cumInc, 'inc'], [`${N}년 누적 지출`, f.cumExp, 'exp'],
    [`${N}년 후 순자산`, f.net, 'net'], [`${N}년 후 투자자산`, f.inv, ''], ['가중 평균 수익률', null, '', pct(wavg(S.assets)), '자산 금액 가중'],
    ['목표 도달', null, '', S.target ? (goal >= 0 ? `${goal}년 후` : `${H}년 안에 미도달`) : '목표 없음', S.target ? '목표 ' + kr(S.target) : '입력 › 기본에서 설정'],
  ];
  return k.map(([l, v, c, txt, foot]) => `<div class="kpi ${c}"><div class="k">${l}</div><div class="v">${txt ?? kr(v)}</div><div class="f">${foot ?? won(v)}</div></div>`).join('');
}
function tableHTML(P, N, compact = false) {
  const W = compact ? kr : won, f = P[N];
  let h = `<tr><th>항목</th><th>예상 수익률</th><th>현재</th><th>${N}년 후</th><th>증가액</th></tr>`;
  for (const c of CATS) {
    const items = S.assets.filter((a) => a.cat === c); if (!items.length) continue;
    h += `<tr class="grp-row"><td>${c}</td><td></td><td>${W(P[0].by[c])}</td><td>${W(f.by[c])}</td><td>${W(f.by[c] - P[0].by[c])}</td></tr>`;
    for (const a of items) {
      const fv = (+a.amt || 0) * Math.pow(1 + a.rate, N);
      h += `<tr><td>&nbsp;&nbsp;${esc(a.name || '(이름 없음)')}</td><td>${pct(a.rate, 0)}</td><td>${W(a.amt)}</td><td>${W(fv)}</td><td>${W(fv - a.amt)}</td></tr>`;
    }
  }
  h += `<tr class="sum"><td>총자산</td><td>${pct(wavg(S.assets))}</td><td>${W(P[0].total)}</td><td>${W(f.total)}</td><td>${W(f.total - P[0].total)}</td></tr>`;
  h += `<tr><td>누적 수입</td><td></td><td>-</td><td class="pos">${W(f.cumInc)}</td><td></td></tr>`;
  h += `<tr><td>누적 지출</td><td></td><td>-</td><td class="neg">${W(f.cumExp)}</td><td></td></tr>`;
  h += `<tr class="sum"><td>순자산</td><td></td><td>${W(P[0].net)}</td><td>${W(f.net)}</td><td>${W(f.net - P[0].net)}</td></tr>`;
  return h;
}
function pickOptions() {
  const o = [['net', '순자산'], ['total', '총자산'], ...CATS.map((c) => ['cat:' + c, c + ' 합계'])];
  S.assets.forEach((a, i) => o.push(['a:' + i, `자산 · ${a.name || a.cat}`]));
  S.incomes.forEach((x, i) => o.push(['i:' + i, `수입 · ${x.name || '(이름 없음)'}`]));
  S.expenses.forEach((x, i) => o.push(['e:' + i, `지출 · ${x.name || '(이름 없음)'}`]));
  return o;
}
let pickSel = 'net';
function chartPick(cv, P, N, T) {
  let data, color = T.accent, label, note = '';
  const [k, v] = pickSel.split(':');
  if (pickSel === 'net') { data = P.map((r) => r.net); label = '순자산'; }
  else if (pickSel === 'total') { data = P.map((r) => r.total); label = '총자산'; color = T.info; }
  else if (k === 'cat') { data = P.map((r) => r.by[v]); label = v; color = catColor(v, T); }
  else if (k === 'a') { const a = S.assets[+v]; if (!a) { pickSel = 'net'; return chartPick(cv, P, N, T); } data = P.map((r) => (+a.amt || 0) * Math.pow(1 + a.rate, r.t)); label = a.name || a.cat; color = catColor(a.cat, T); note = `연 ${pct(a.rate, 0)} 복리`; }
  else { const L = k === 'i' ? 'incomes' : 'expenses', x = S[L][+v]; if (!x) { pickSel = 'net'; return chartPick(cv, P, N, T); } data = P.map((r) => flowAt([x], r.t)); label = x.name || (k === 'i' ? '수입' : '지출'); color = k === 'i' ? T.pos : T.neg; note = `${x.start}~${x.end}년차 · 연 ${pct(x.rate, 0)} 증감`; }
  const o = baseOpts(T); o.plugins.legend.display = false;
  mk(cv, { type: 'line', data: { labels: yearLabels(), datasets: [line(label, data, color, { fill: true, pointRadius: data.map((_, t) => (t === N ? 5 : 0)), pointBackgroundColor: color })] }, options: o });
  return `${label}: 현재 ${kr(data[0])} → ${N}년 후 ${kr(data[N])}${note ? ' · ' + note : ''}`;
}
function renderOutput() {
  const P = project(), N = S.years, T = theme(false);
  const yr = $('#yearRange'); yr.max = H; yr.value = N;
  $('#yearLabel').textContent = N + '년 후';
  $('#targetYear').textContent = `${new Date().getFullYear() + N}년 · ${S.age + N}세`;
  $('#outSub').textContent = `${planName()} · ${todayKo()} 기준 · 계산 기간 ${H}년`;
  $('#kpis').innerHTML = kpiHTML(P, N);
  $('#resTable').innerHTML = tableHTML(P, N);
  const opts = pickOptions(); if (!opts.some((o) => o[0] === pickSel)) pickSel = 'net';
  $('#pick').innerHTML = opts.map(([v, l]) => `<option value="${v}"${v === pickSel ? ' selected' : ''}>${esc(l)}</option>`).join('');
  $('#pickNote').textContent = chartPick($('#chPick'), P, N, T);
  chartFlow($('#chFlow'), P, T); chartArea($('#chArea'), P, T); chartBar($('#chBar'), P, N, T); chartPie($('#chPie'), P, N, T);
  $('#barTitle').textContent = `현재 vs ${N}년 후`; $('#pieTitle').textContent = `${N}년 후 자산 구성비`;
}
$('#yearRange').addEventListener('input', (e) => { S.years = +e.target.value; isExample = false; setDirty(); saveDraft(); renderOutput(); const b = $('[data-b="years"]'); if (b) b.value = S.years; });
$('#pick').addEventListener('change', (e) => { pickSel = e.target.value; $('#pickNote').textContent = chartPick($('#chPick'), project(), S.years, theme(false)); });

/* ───────────── 04 몬테카를로 ───────────── */
let MC = null;
const mcKey = () => 'ws.mc.' + (cur ? cur.id : 'draft');
const mcSig = () => JSON.stringify({ ...S, target: 0, years: 0 });
function loadMC() {
  const o = lsGet(mcKey(), null);
  MC = o && o.res && o.res.pct && o.res.pct.p50.length === S.horizon + 1 ? o : null;
}
function renderMcSettings() {
  $('#mcRuns').value = String(S.mc.runs || 5000);
  $('#mcTarget').value = amtVal(S.target);
  $('#volGrid').innerHTML = CATS.map((c) => {
    let o = ''; for (let i = 0; i <= 40; i++) o += `<option value="${i / 100}"${Math.round(S.mc.vol[c] * 100) === i ? ' selected' : ''}>±${i}%</option>`;
    return `<label class="mini">${c} 변동성<select data-vol="${c}">${o}</select></label>`;
  }).join('');
  $('#taxGrid').innerHTML = [...CATS, '수입'].map((c) => `<label class="mini">${c}${c === '현금' || c === '채권' ? '(이자)' : ''} 세율<select data-tax="${c}">${TAX_OPTS.map((v) => `<option value="${v}"${Math.abs(v - S.mc.tax[c]) < 1e-9 ? ' selected' : ''}>${taxLabel(v)}</option>`).join('')}</select></label>`).join('');
  $('#taxOn').checked = S.mc.taxOn !== false;
  $('#taxGrid').style.opacity = S.mc.taxOn !== false ? 1 : .45;
}
$('#v-mc').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.vol) S.mc.vol[el.dataset.vol] = +el.value;
  else if (el.dataset.tax) S.mc.tax[el.dataset.tax] = +el.value;
  else if (el.id === 'mcRuns') S.mc.runs = +el.value;
  else if (el.id === 'taxOn') { S.mc.taxOn = el.checked; $('#taxGrid').style.opacity = el.checked ? 1 : .45; }
  else if (el.id === 'mcTarget') { S.target = numIn(el.value); el.value = amtVal(S.target); renderInputs(); if (MC) drawMC(); }
  else return;
  isExample = false; setDirty(); saveDraft(); mcStaleCheck();
});
// 시드 고정 난수(mulberry32)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function simulate(plan, p) {
  const T = plan.horizon, R = p.runs, rnd = rng(p.seed);
  let spare = null;
  const gauss = () => { if (spare !== null) { const v = spare; spare = null; return v; } let u = 0; while (u === 0) u = rnd(); const v = rnd(); const m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v); };
  const tax = p.taxOn ? p.tax : {}, tInc = tax['수입'] || 0;
  const items = plan.assets.filter((a) => (+a.amt || 0) > 0).map((a) => ({ cat: a.cat, amt: +a.amt, mu: +a.rate || 0, tr: tax[a.cat] || 0 }));
  // 누적 현금흐름(세전/세후)
  const flowPre = [0], flowAft = [0]; let ci = 0, ce = 0;
  for (let t = 1; t <= T; t++) { ci += flowAt(plan.incomes, t); ce += flowAt(plan.expenses, t); flowPre.push(ci - ce); flowAft.push(ci * (1 - tInc) - ce); }
  const net = Array.from({ length: T + 1 }, () => new Float64Array(R)), pre = Array.from({ length: T + 1 }, () => new Float64Array(R));
  const vPre = new Float64Array(items.length), vAft = new Float64Array(items.length), z = {};
  for (let r = 0; r < R; r++) {
    let s0 = 0; items.forEach((it, k) => { vPre[k] = it.amt; vAft[k] = it.amt; s0 += it.amt; });
    net[0][r] = s0; pre[0][r] = s0;
    for (let t = 1; t <= T; t++) {
      for (const c of CATS) z[c] = gauss(); // 같은 자산군은 같은 해에 함께 움직인다
      let sp = 0, sa = 0;
      for (let k = 0; k < items.length; k++) {
        const it = items[k], g = Math.max(-.95, it.mu + (p.vol[it.cat] || 0) * z[it.cat]);
        vPre[k] *= 1 + g; sp += vPre[k];
        vAft[k] *= 1 + (g > 0 ? g * (1 - it.tr) : g); sa += vAft[k];
      }
      pre[t][r] = sp + flowPre[t]; net[t][r] = sa + flowAft[t];
    }
  }
  const Q = [.1, .25, .5, .75, .9], q = Q.map(() => []), neg = [], sample = [], pre50 = [];
  const at = (a, x) => a[Math.min(a.length - 1, Math.floor(x * (a.length - 1)))];
  for (let t = 0; t <= T; t++) {
    const a = Float64Array.from(net[t]).sort();
    Q.forEach((x, i) => q[i].push(at(a, x)));
    let n = 0; while (n < a.length && a[n] < 0) n++; neg.push(n / R);
    const k = Math.min(400, a.length), out = []; for (let i = 0; i < k; i++) out.push(Math.round(a[Math.floor((i * (a.length - 1)) / (k - 1 || 1))])); sample.push(out);
    pre50.push(at(Float64Array.from(pre[t]).sort(), .5));
  }
  const det = []; for (let t = 0; t <= T; t++) { let s = 0; for (const it of items) s += it.amt * Math.pow(1 + (it.mu > 0 ? it.mu * (1 - it.tr) : it.mu), t); det.push(s + flowAft[t]); }
  return { pct: { p10: q[0], p25: q[1], p50: q[2], p75: q[3], p90: q[4] }, neg, sample, det, pre50, taxOn: !!p.taxOn };
}
const hitRate = (arr, target) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < target) lo = m + 1; else hi = m; } return (arr.length - lo) / arr.length; };
const mcFresh = () => MC && MC.sig === mcSig();
function mcStatus(text, cls) { const el = $('#mcStatus'); el.textContent = text; el.className = 'mc-status' + (cls ? ' ' + cls : ''); }
function mcStaleCheck() {
  if (!MC) { mcStatus('아직 실행한 결과가 없습니다. ‘시뮬레이션 실행’을 누르세요.'); return; }
  if (!mcFresh()) mcStatus('표시된 결과는 지금 입력값과 다릅니다. 다시 실행하세요.', 'stale');
  else mcStatus(`${planName()} · ${MC.params.runs.toLocaleString('ko-KR')}회 시뮬레이션 결과 (${new Date(MC.runAt).toLocaleString('ko-KR')})`, 'ok');
}
$('#mcRun').addEventListener('click', () => {
  const btn = $('#mcRun'); btn.disabled = true; mcStatus('계산 중…');
  setTimeout(() => {
    try {
      const p = { ...clone(S.mc), seed: (Math.random() * 2 ** 31) | 0 }, t0 = performance.now();
      MC = { params: p, res: simulate(S, p), sig: mcSig(), runAt: new Date().toISOString() };
      if (!lsSet(mcKey(), MC)) toast('결과가 커서 브라우저에 보관하지 못했습니다(화면에는 표시됨)');
      drawMC(); mcStaleCheck();
      toast(`${p.runs.toLocaleString('ko-KR')}회 계산 완료 (${Math.round(performance.now() - t0)}ms)`);
    } catch (e) { mcStatus('계산하지 못했습니다: ' + (e.message || e)); }
    btn.disabled = false;
  }, 30);
});
function mcKpiHTML(N) {
  const r = MC.res, P = r.pct, tg = S.target, lab = r.taxOn ? '세후 ' : '', Hh = P.p50.length - 1;
  const k = [
    [`${N}년 후 ${lab}중앙값`, P.p50[N], 'net'], [`${N}년 후 비관 (하위 10%)`, P.p10[N], P.p10[N] < 0 ? 'neg' : ''], [`${N}년 후 낙관 (상위 10%)`, P.p90[N], ''],
    r.taxOn ? [`${N}년 후 세금 영향`, -(r.pre50[N] - P.p50[N]), 'exp'] : [`${N}년 후 고정 수익률 계산`, r.det[N], ''],
    [`${N}년 후 마이너스 확률`, null, r.neg[N] > 0 ? 'neg' : '', pct(r.neg[N])],
    [`${N}년 후 목표 달성 확률`, null, '', tg ? pct(hitRate(r.sample[N], tg)) : '목표 없음', tg ? '목표 ' + kr(tg) : '입력 › 기본에서 설정'],
    [`${Hh}년 후 ${lab}중앙값`, P.p50[Hh], ''], [`${Hh}년 후 마이너스 확률`, null, r.neg[Hh] > 0 ? 'neg' : '', pct(r.neg[Hh])],
  ];
  return k.map(([l, v, c, txt, foot]) => `<div class="kpi ${c}"><div class="k">${l}</div><div class="v">${txt ?? kr(v)}</div><div class="f">${foot ?? (v == null ? '&nbsp;' : won(v))}</div></div>`).join('');
}
function mcTableHTML(N, compact = false) {
  const r = MC.res, P = r.pct, tg = S.target, tx = r.taxOn, W = compact ? kr : won, Hh = P.p50.length - 1;
  let h = `<tr><th>시점${tx ? ' (세후)' : ''}</th><th>비관 10%</th><th>25%</th><th>중앙값</th><th>75%</th><th>낙관 90%</th>${tx ? '<th>세전 중앙값</th>' : ''}<th>마이너스 확률</th>${tg ? '<th>목표 달성</th>' : ''}</tr>`;
  [...new Set([1, 5, 10, 20, 30, 40, 50, N, Hh])].filter((t) => t <= Hh).sort((a, b) => a - b).forEach((t) => {
    h += `<tr${t === N ? ' class="sum"' : ''}><td>${t}년 후</td><td>${W(P.p10[t])}</td><td>${W(P.p25[t])}</td><td>${W(P.p50[t])}</td><td>${W(P.p75[t])}</td><td>${W(P.p90[t])}</td>${tx ? `<td>${W(r.pre50[t])}</td>` : ''}<td>${pct(r.neg[t])}</td>${tg ? `<td>${pct(hitRate(r.sample[t], tg))}</td>` : ''}</tr>`;
  });
  return h;
}
function chartFan(cv, N, T) {
  const P = MC.res.pct, labels = P.p50.map((_, t) => t + '년'), acc = T.accent;
  const ds = (label, data, o = {}) => Object.assign({ label, data, borderWidth: 0, pointRadius: 0, tension: .2, fill: false }, o);
  const o = baseOpts(T); o.plugins.legend.labels.filter = (it) => !it.text.startsWith('_');
  const sets = [
    ds('하위 10%', P.p10, { borderColor: alpha(T.neg, .9), borderWidth: 1.5, backgroundColor: T.neg }),
    ds('10~90% 범위', P.p90, { fill: '-1', backgroundColor: alpha(acc, .14), borderColor: alpha(T.pos, .9), borderWidth: 1.5 }),
    ds('_p25', P.p25, { borderColor: alpha(acc, .45), borderWidth: 1 }),
    ds('25~75% 범위', P.p75, { fill: '-1', backgroundColor: alpha(acc, .34), borderColor: alpha(acc, .45), borderWidth: 1 }),
    ds('중앙값', P.p50, { borderColor: acc, borderWidth: 3, backgroundColor: acc, pointRadius: P.p50.map((_, t) => (t === N ? 5 : 0)) }),
  ];
  if (S.target) sets.push(ds('목표', P.p50.map(() => S.target), { borderColor: T.info, borderWidth: 1.5, borderDash: [6, 4], backgroundColor: T.info }));
  mk(cv, { type: 'line', data: { labels, datasets: sets }, options: o });
}
function chartHist(cv, N, T) {
  const a = MC.res.sample[N], lo = a[Math.floor(a.length * .01)], hi = a[Math.ceil(a.length * .99) - 1], B = 30, w = (hi - lo) / B || 1;
  const bins = Array(B).fill(0); for (const v of a) { if (v < lo || v > hi) continue; bins[Math.min(B - 1, Math.floor((v - lo) / w))]++; }
  const mids = bins.map((_, i) => lo + w * (i + .5)), tg = S.target, p50 = MC.res.pct.p50[N];
  const o = baseOpts(T); o.plugins.legend.display = false; o.interaction = { mode: 'nearest', intersect: false };
  o.plugins.tooltip = { callbacks: { title: (c) => `${kr(mids[c[0].dataIndex] - w / 2)} ~ ${kr(mids[c[0].dataIndex] + w / 2)}`, label: (c) => `비중 ${pct(c.parsed.y / a.length)}` } };
  o.scales.x.ticks.callback = (_, i) => (i % 5 === 0 ? axisFmt(mids[i]) : '');
  o.scales.y.ticks.callback = (v) => pct(v / a.length, 0);
  mk(cv, { type: 'bar', data: { labels: mids.map(kr), datasets: [{ label: '분포', data: bins, backgroundColor: mids.map((m) => (tg && m >= tg ? alpha(T.pos, .8) : m < 0 ? alpha(T.neg, .8) : alpha(T.accent, .7))), borderRadius: 2, categoryPercentage: 1, barPercentage: .92 }] }, options: o });
  return `중앙값 ${kr(p50)}${tg ? ` · 초록 막대는 목표(${kr(tg)}) 이상 — 달성 확률 ${pct(hitRate(a, tg))}` : ''}${MC.res.neg[N] > 0 ? ' · 빨간 막대는 마이너스' : ''}`;
}
function drawMC() {
  if (!MC) { $('#mcOut').hidden = true; return; }
  $('#mcOut').hidden = false;
  const N = Math.min(S.years, MC.res.pct.p50.length - 1), T = theme(false);
  $('#mcKpis').innerHTML = mcKpiHTML(N);
  $('#mcTable').innerHTML = mcTableHTML(N);
  chartFan($('#chMC'), N, T);
  $('#mcHistT').textContent = `${N}년 후 순자산 분포`;
  $('#mcHistKey').textContent = chartHist($('#chMCHist'), N, T);
}

/* ───────────── 05 조언 ───────────── */
function analyze() {
  const P = project(), N = S.years, now = P[0], fut = P[N];
  const inc1 = flowAt(S.incomes, 1), exp1 = flowAt(S.expenses, 1), saving = inc1 - exp1;
  const total = now.total, share = {}; CATS.forEach((c) => (share[c] = total ? now.by[c] / total : 0));
  const fin = total - now.by['부동산'];
  const mc = mcFresh() ? MC.res : null;
  return {
    P, N, now, fut, inc1, exp1, saving, savingRate: inc1 ? saving / inc1 : 0, monthlyExp: exp1 / 12, cash: now.by['현금'], total, fin, share,
    risky: fin ? (now.by['주식'] + now.by['ETF']) / fin : 0,
    goalYear: S.target ? P.findIndex((r) => r.net >= S.target) : -1,
    negYears: P.filter((r) => r.t >= 1 && r.inc < r.exp).map((r) => r.t), mc,
    emergency: exp1 ? now.by['현금'] / (exp1 / 12) : 0, ret: wavg(S.assets), maxShare: Math.max(...CATS.map((c) => share[c])),
    hit: mc && S.target ? hitRate(mc.sample[N], S.target) : null, toRetire: Math.max(0, S.retireAge - S.age),
  };
}
function diagnose(a) {
  const out = [], add = (level, text) => out.push({ level, text });
  if (!a.exp1) add('warn', '연간 지출이 없습니다. 지출을 입력하면 비상금·저축률 진단이 정확해집니다.');
  else if (a.emergency >= 6) add('good', `비상금(현금)이 월 지출의 ${a.emergency.toFixed(1)}개월분으로 충분합니다.`);
  else if (a.emergency >= 3) add('warn', `비상금 ${a.emergency.toFixed(1)}개월분 — 최소 기준(3개월)은 넘었습니다. 6개월분(${kr(a.monthlyExp * 6)})까지 늘려 보세요.`);
  else add('bad', `비상금이 ${a.emergency.toFixed(1)}개월분으로 부족합니다. 월 지출 3~6개월분(${kr(a.monthlyExp * 3)}~${kr(a.monthlyExp * 6)})부터 마련하세요.`);
  if (a.inc1) {
    if (a.saving < 0) add('bad', `1년차 지출이 수입보다 ${kr(-a.saving)} 많습니다. 고정지출 점검이 필요합니다.`);
    else if (a.savingRate >= .4) add('good', `저축률 ${pct(a.savingRate)} — 매우 우수합니다.`);
    else if (a.savingRate >= .2) add('warn', `저축률 ${pct(a.savingRate)} — 양호합니다. 30~40%를 목표로 해 보세요.`);
    else add('bad', `저축률 ${pct(a.savingRate)} — 20% 미만입니다. 월급날 먼저 저축하는 방식을 권합니다.`);
  }
  if (a.negYears.length) add('warn', `${a.negYears[0]}년차부터 지출이 수입보다 많은 해가 ${a.negYears.length}년 있습니다. 그 시기를 위한 자금을 따로 준비하세요.`);
  if (a.share['부동산'] > .7) add('warn', `부동산 비중이 ${pct(a.share['부동산'])}로 높아 급할 때 현금화가 어렵습니다.`);
  else if (a.maxShare > .6 && a.total) add('warn', '한 자산군 비중이 60%를 넘습니다. 분산을 고려해 보세요.');
  else if (a.total) add('good', '자산이 여러 자산군에 나뉘어 있습니다.');
  if (!a.now.by['연금']) add('warn', '연금자산이 없습니다. 연금저축·IRP는 세액공제와 노후 준비를 함께 챙길 수 있습니다.');
  if (S.target) {
    if (a.hit != null) add(a.hit >= .7 ? 'good' : a.hit >= .4 ? 'warn' : 'bad', `몬테카를로 기준 ${a.N}년 후 목표(${kr(S.target)}) 달성 확률은 ${pct(a.hit)}입니다.`);
    else if (a.goalYear >= 0 && a.goalYear <= a.N) add('good', `고정 수익률 기준 ${a.goalYear}년 후 목표(${kr(S.target)})에 도달합니다.`);
    else add('warn', `고정 수익률 기준 ${a.N}년 안에 목표(${kr(S.target)})에 도달하지 못합니다${a.goalYear > 0 ? ` (예상 ${a.goalYear}년 후)` : ''}.`);
  }
  if (a.mc && a.mc.neg[a.N] > .05) add('bad', `시뮬레이션에서 ${a.N}년 후 순자산이 마이너스가 될 확률이 ${pct(a.mc.neg[a.N])}입니다.`);
  return out;
}
function healthScore(a) {
  let s = 0;
  s += a.exp1 ? Math.min(20, (a.emergency / 6) * 20) : 10;
  s += a.inc1 ? Math.min(25, Math.max(0, a.savingRate / .4) * 25) : 0;
  s += a.total ? (1 - Math.max(0, a.maxShare - .5) / .5) * 15 : 0;
  s += a.now.by['연금'] > 0 ? 10 : 0;
  s += S.target ? (a.hit != null ? a.hit * 20 : a.goalYear >= 0 && a.goalYear <= a.N ? 20 : 8) : 10;
  s += a.negYears.length ? Math.max(0, 10 - a.negYears.length) : 10;
  return Math.round(Math.max(0, Math.min(100, s)));
}
const LV = { good: '양호', warn: '주의', bad: '개선' };
function healthHTML(a) {
  const sc = healthScore(a);
  const m = (label, value, ratio) => `<div class="metric"><div><span>${label}</span><b>${value}</b></div><div class="bar"><i style="width:${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%"></i></div></div>`;
  return `<div class="score"><b>${sc}</b><span class="note">/ 100점</span></div>
    ${m('비상금', a.exp1 ? a.emergency.toFixed(1) + '개월' : '-', a.emergency / 6)}
    ${m('저축률 (1년차)', pct(a.savingRate), a.savingRate / .4)}
    ${m('분산도 (최대 자산군 비중)', pct(a.maxShare), 1 - Math.max(0, a.maxShare - .3) / .7)}
    ${m('목표 달성 확률', a.hit != null ? pct(a.hit) : S.target ? '시뮬레이션 필요' : '목표 없음', a.hit ?? 0)}
    <ul class="diag">${diagnose(a).map((x) => `<li><span class="lv ${x.level}">${LV[x.level]}</span><span>${esc(x.text)}</span></li>`).join('')}</ul>`;
}
function renderHealth() {
  $('#health').innerHTML = `<h2>${esc(planName())} 재무 건강</h2>${healthHTML(analyze())}<p class="note">조언은 입력값에 기반한 일반적인 재무 정보이며, 공인 투자자문을 대신하지 않습니다.</p>`;
}
const TOPICS = [
  ['summary', ['종합', '진단', '전체', '요약', '평가', '점수']], ['mc', ['몬테', '시뮬', '확률', '위험', '변동', '최악', '비관']],
  ['emergency', ['비상', '예비', '긴급']], ['tax', ['절세', '세금', 'isa', 'irp', '세액공제', '연금저축']], ['retire', ['노후', '은퇴', '연금']],
  ['saving', ['저축', '지출', '절약', '가계부', '소비']], ['debt', ['대출', '부채', '빚', '상환', '이자']],
  ['allocation', ['배분', '분산', '포트폴리오', '주식', 'etf', '채권', '투자', '수익률']], ['goal', ['목표', '달성', '언제', '얼마나 모']],
  ['house', ['집', '부동산', '주택', '청약', '전세']], ['start', ['처음', '시작', '사회초년생', '초보', '뭐부터']],
];
const CHIPS = ['내 자산 종합 진단', '몬테카를로 결과 해석', '비상금은 얼마나?', '저축률 괜찮아?', '자산 배분 어떻게?', '대출 상환 vs 투자', '노후 준비', '절세 상품(ISA·IRP)', '목표 달성 방법', '집 마련 계획'];
function answer(q) {
  const a = analyze(), t = q.toLowerCase(), B = (s) => `<strong>${s}</strong>`;
  const topic = (TOPICS.find(([, w]) => w.some((x) => t.includes(x))) || ['fallback'])[0];
  switch (topic) {
    case 'summary': {
      const ic = { good: '✅', warn: '⚠️', bad: '❗' };
      return `${B(`재무 건강 점수: ${healthScore(a)}점 / 100`)}\n\n${diagnose(a).map((x) => `${ic[x.level]} ${esc(x.text)}`).join('\n')}\n\n일반적인 우선순위는 ① 비상금 → ② 고금리 부채 상환 → ③ 세제혜택 계좌 → ④ 장기 분산투자 순서입니다.`;
    }
    case 'mc': {
      if (!MC) return `아직 몬테카를로 시뮬레이션을 실행하지 않았습니다.\n${B('04 몬테카를로')} 창에서 ‘시뮬레이션 실행’을 누른 뒤 다시 물어봐 주세요.`;
      if (!a.mc) return '저장된 시뮬레이션 결과가 지금 입력값과 다릅니다. 몬테카를로 창에서 다시 실행해 주세요.';
      const P = a.mc.pct, N = a.N, spread = P.p90[N] - P.p10[N];
      return `${B(`${N}년 후 순자산 시뮬레이션 (${MC.params.runs.toLocaleString('ko-KR')}회${a.mc.taxOn ? ', 세후' : ''})`)}\n\n• 중앙값: ${B(kr(P.p50[N]))} — 절반은 이보다 많고 절반은 적습니다\n• 비관(하위 10%): ${kr(P.p10[N])}\n• 낙관(상위 10%): ${kr(P.p90[N])}\n• 범위 폭: ${kr(spread)}\n• 마이너스 확률: ${pct(a.mc.neg[N])}${a.hit != null ? `\n• 목표 달성 확률: ${B(pct(a.hit))}` : ''}\n\n${B('해석')}\n${a.hit != null ? (a.hit >= .7 ? '목표 달성 가능성이 높습니다. 하위 10% 시나리오에서도 생활이 가능한지만 점검해 두세요.' : a.hit >= .4 ? '반반에 가까운 확률입니다. 저축액을 늘리거나 기간을 늘리면 확률이 크게 오릅니다.' : '지금 계획으로는 목표 달성이 어렵습니다. 목표·기간·저축액 중 하나를 조정해 보세요.') : '목표 순자산을 입력하면 달성 확률도 계산해 드립니다.'}${spread > Math.abs(P.p50[N]) ? '\n\n⚠️ 결과 범위가 중앙값보다 넓습니다. 변동성 큰 자산 비중이 높다는 뜻이니 감내할 수 있는 수준인지 점검하세요.' : ''}`;
    }
    case 'emergency':
      if (!a.exp1) return '지출을 입력하면 필요한 비상금을 계산해 드립니다. 보통 월 지출의 3~6개월분을 권합니다.';
      return `${B('비상금 기준')}: 월 지출의 3~6개월분 (${kr(a.monthlyExp * 3)} ~ ${kr(a.monthlyExp * 6)})\n\n현재 현금 자산 ${kr(a.cash)} → ${B(`${a.emergency.toFixed(1)}개월분`)}\n${a.emergency >= 6 ? '충분합니다. 넘치는 부분은 투자 자산으로 옮겨 수익률을 높일 수 있습니다.' : `부족분 ${kr(a.monthlyExp * 6 - a.cash)}을 파킹통장·CMA처럼 바로 꺼낼 수 있는 곳에 모아 두세요.`}\n\n💡 소득이 불규칙하다면 6~12개월분이 안전합니다.`;
    case 'saving': {
      if (!a.inc1) return '수입을 입력하면 저축률을 진단해 드립니다.';
      const goal = a.inc1 * .3;
      return `1년차 수입 ${kr(a.inc1)}, 지출 ${kr(a.exp1)} → 연 저축 ${B(kr(a.saving))} (저축률 ${B(pct(a.savingRate))})\n월 기준 약 ${kr(a.saving / 12)}\n\n${a.savingRate >= .3 ? '훌륭합니다. 이제는 저축의 수익률과 세제혜택을 높이는 데 집중하세요.' : `저축률 30%가 되려면 연 ${kr(goal)} 저축이 필요합니다 (지금보다 연 ${kr(Math.max(0, goal - a.saving))} 더).`}${a.negYears.length ? `\n\n⚠️ ${a.negYears.slice(0, 10).join(', ')}${a.negYears.length > 10 ? '…' : ''}년차에는 지출이 수입보다 많습니다.` : ''}\n\n${B('실천 팁')}\n• 월급날 자동이체로 먼저 저축\n• 통신·보험·구독 같은 고정비부터 점검\n• 소득이 오르면 오른 몫의 절반 이상은 저축으로`;
    }
    case 'debt':
      return `이 계획에는 부채 항목이 따로 없습니다. 대출 원리금은 ${B('지출')} 항목으로 넣으면 계산에 반영됩니다.\n\n${B('상환 vs 투자 판단 기준')}\n• 대출금리 > 기대수익률(지금 가중평균 ${pct(a.ret)}) → ${B('상환 우선')} — 갚는 만큼 확정 수익입니다\n• 대출금리 < 기대수익률 → 비상금을 마련한 뒤 투자와 병행 가능\n• 카드론·현금서비스 같은 고금리 부채는 무조건 먼저\n• 원리금 상환액은 월 소득의 30~40% 안으로`;
    case 'allocation': {
      const g = Math.max(20, Math.min(80, 100 - S.age));
      return `${B('현재 자산 구성')}\n${CATS.map((c) => `• ${c} ${pct(a.share[c])}`).join('\n')}\n가중 평균 기대수익률 ${pct(a.ret)}\n\n금융자산 중 주식·ETF 비중: ${B(pct(a.risky))}\n‘100 − 나이’ 법칙으로 보면 ${S.age}세는 주식형 약 ${g}%, 안전자산 ${100 - g}%\n${a.risky * 100 > g + 15 ? '⚠️ 나이에 비해 위험자산 비중이 높은 편입니다. 하락장을 견딜 수 있는지 점검하세요.' : a.risky * 100 < g - 20 ? '안전자산 비중이 높은 편입니다. 오래 묻어 둘 돈이라면 분산된 지수 ETF 비중을 조금씩 늘려 볼 수 있습니다.' : '나이에 맞는 균형 잡힌 배분입니다.'}${a.share['부동산'] > .7 ? `\n\n🏠 부동산 비중이 ${pct(a.share['부동산'])}로 높아 유동성이 낮습니다.` : ''}\n\n${B('원칙')}\n• 개별 종목보다 국내외 지수 ETF로 넓게 분산\n• 1년에 1~2번 비중 맞추기(리밸런싱)\n• 3년 안에 쓸 돈은 투자하지 않기`;
    }
    case 'retire': {
      const need = a.exp1 * .7, fund = need * 25, rIdx = Math.min(a.P.length - 1, a.toRetire), atR = a.P[rIdx];
      return `현재 ${S.age}세, 은퇴 목표 ${S.retireAge}세 → ${B(`${a.toRetire}년`)} 남았습니다.\n\n은퇴 후 지금 지출의 70%(연 ${kr(need)})를 쓴다고 하면, 4% 인출 규칙으로 필요한 노후 자산은 약 ${B(kr(fund))}입니다 (연 생활비 × 25).\n\n이 계획의 ${rIdx}년 후(${S.age + rIdx}세) 예상 순자산 중 부동산을 뺀 금액(모은 저축 포함): ${B(kr(atR.net - atR.by['부동산']))}\n${atR.net - atR.by['부동산'] >= fund ? '✅ 필요 금액을 넘습니다.' : `부족분 약 ${kr(fund - (atR.net - atR.by['부동산']))} — 저축을 늘리거나 은퇴 시점·생활비를 조정해 보세요.`}\n\n${B('노후 준비 3층')}\n• 1층 국민연금 · 2층 퇴직연금 · 3층 개인연금(연금저축·IRP)\n• 국민연금 예상액은 국민연금공단 ‘내 연금 알아보기’에서 확인해 수입 항목에 넣어 보세요`;
    }
    case 'tax':
      return `${B('대표적인 절세 계좌')}\n\n• ${B('연금저축')} — 납입액 세액공제(연금저축만 연 600만원 한도)\n• ${B('IRP')} — 연금저축과 합쳐 연 900만원까지 세액공제\n  · 세액공제율은 소득 수준에 따라 13.2% 또는 16.5%\n• ${B('ISA')} — 계좌 안 손익을 합쳐 일정 금액까지 비과세, 넘는 부분은 9.9% 분리과세\n\n${B('채우는 순서(일반적)')}\n① 회사 퇴직연금 매칭이 있다면 먼저 → ② 연금저축·IRP 세액공제 한도 → ③ ISA → ④ 일반 계좌\n\n${a.now.by['연금'] ? `지금 연금자산 ${kr(a.now.by['연금'])}이 있습니다.` : '아직 연금자산이 없습니다. 세액공제만으로도 납입액의 13~16%를 돌려받는 셈입니다.'}\n\n※ 한도·세율은 세법 개정에 따라 바뀔 수 있으니 가입 전에 금융회사나 국세청 안내로 확인하세요.`;
    case 'goal': {
      if (!S.target) return `목표 순자산이 아직 없습니다. ${B('02 입력 › 기본')}에서 목표를 넣으면 도달 시점과 확률을 계산해 드립니다.`;
      const g = a.goalYear;
      return `목표 ${B(kr(S.target))}\n\n• 고정 수익률 기준: ${g >= 0 ? B(`${g}년 후 (${S.age + g}세)`) + ' 도달' : `${H}년 안에 도달하지 못함`}${a.hit != null ? `\n• 몬테카를로 기준 ${a.N}년 후 달성 확률: ${B(pct(a.hit))}` : '\n• 몬테카를로를 실행하면 달성 확률도 알려 드립니다'}\n\n${B('도달을 앞당기는 방법')}\n• 저축액 늘리기 — 매년 지출을 줄이거나 수입 항목 추가\n• 수익률 높이기 — 현금 비중이 높다면 일부를 지수 ETF로\n• 기간 늘리기 — 복리는 마지막 몇 년에 가장 크게 붙습니다`;
    }
    case 'house':
      return `${B('집 마련 계획 체크')}\n\n• 현재 부동산 비중 ${pct(a.share['부동산'])}, 현금 ${kr(a.cash)}\n• 계약금·중도금·취득세·이사비 등 구입가의 10~15%를 현금으로 따로 준비\n• 대출 원리금은 월 소득의 30~40% 안으로 (DSR 규제도 확인)\n• 무주택자라면 주택청약종합저축을 꾸준히 — 가점·납입 인정 횟수가 중요\n\n집 구입 계획이 있다면 ${B('지출')}에 계약금을, ${B('자산')}에 부동산 항목을 해당 연차에 맞춰 넣어 시뮬레이션해 보세요.`;
    case 'start':
      return `${B('처음 시작한다면 이 순서로')}\n\n1. 한 달 지출 파악 — 고정비·변동비 나누기\n2. 비상금 3~6개월분 (파킹통장·CMA)\n3. 고금리 부채가 있으면 먼저 상환\n4. 연금저축·IRP·ISA 같은 세제혜택 계좌 열기\n5. 매달 일정 금액을 지수 ETF에 자동 투자\n6. 1년에 한 번 이 계산기로 점검\n\n지금 저축률은 ${a.inc1 ? pct(a.savingRate) : '-(수입 미입력)'}입니다.`;
    default:
      return `질문을 정확히 이해하지 못했어요. 이런 주제로 물어볼 수 있습니다:\n${CHIPS.map((c) => '• ' + c).join('\n')}`;
  }
}
function addMsg(html, who) { const d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = html; $('#chatLog').appendChild(d); $('#chatLog').scrollTop = 1e9; }
function greet() { addMsg(`안녕하세요! ${esc(planName())}을(를) 보고 조언해 드릴게요.\n아래 버튼을 누르거나 궁금한 점을 입력해 보세요.`, 'bot'); }
function askBot(q) { q = q.trim(); if (!q) return; addMsg(esc(q), 'me'); setTimeout(() => addMsg(answer(q), 'bot'), 180); }
$('#chips').innerHTML = CHIPS.map((c) => `<button type="button">${c}</button>`).join('');
$('#chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) askBot(b.textContent); });
$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); askBot($('#chatText').value); $('#chatText').value = ''; });

/* ───────────── A4 보고서 ───────────── */
let orient = 'portrait';
function chartImg(fn, w = 680, h = 300) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.style.cssText = `width:${w}px;height:${h}px;position:fixed;left:-9999px;top:0`;
  const box = document.createElement('div'); box.style.cssText = `width:${w}px;height:${h}px;position:fixed;left:-9999px;top:0`;
  box.appendChild(cv); document.body.appendChild(box);
  let url = '';
  try { fn(cv, theme(true)); const ch = charts.get(cv); ch.resize(w, h); ch.update('none'); url = cv.toDataURL('image/png'); ch.destroy(); charts.delete(cv); } catch (e) { console.error(e); }
  box.remove(); return url;
}
function a4Page(inner, n, total) {
  return `<div class="a4${orient === 'landscape' ? ' land' : ''}">${inner}<div class="a4-foot">돈불리기 · ${esc(planName())} · ${todayKo()} · ${n}/${total} — 계산 결과는 일반적인 재무 정보이며 투자 권유가 아닙니다.</div></div>`;
}
function buildA4() {
  const P = project(), N = S.years, pages = [];
  const head = (t) => `<div class="a4-head"><div><h1>${t}</h1></div><span>${esc(planName())} · ${todayKo()}</span></div>`;
  pages.push(`${head('돈불리기 보고서')}
    <p class="note">현재 ${S.age}세 · 은퇴 목표 ${S.retireAge}세 · 조회 기간 ${N}년 후(${new Date().getFullYear() + N}년) · 계산 기간 ${H}년 · 연복리 명목 금액</p>
    <h2>핵심 지표</h2><div class="kpis">${kpiHTML(P, N)}</div>
    <h2>자산 구성별 결과</h2><table>${tableHTML(P, N, true)}</table>`);
  const imgs = [
    ['총자산 · 수입 · 지출 · 순자산', chartImg((cv, T) => chartFlow(cv, P, T))],
    ['자산 구분별 누적 추이', chartImg((cv, T) => chartArea(cv, P, T))],
    [`현재 vs ${N}년 후`, chartImg((cv, T) => chartBar(cv, P, N, T))],
    [`${N}년 후 자산 구성비`, chartImg((cv, T) => chartPie(cv, P, N, T))],
  ];
  pages.push(`${head('그래프')}<div class="a4-charts">${imgs.map(([t, u]) => `<div><h2>${t}</h2><img src="${u}" alt="${t}"></div>`).join('')}</div>
    <h2>연도별 순자산</h2><table><tr><th>시점</th><th>총자산</th><th>누적 수입</th><th>누적 지출</th><th>순자산</th></tr>${[...new Set([1, 3, 5, 10, 15, 20, 25, 30, 40, 50, N, H])].filter((t) => t <= H).sort((a, b) => a - b).map((t) => `<tr${t === N ? ' class="sum"' : ''}><td>${t}년 후</td><td>${kr(P[t].total)}</td><td>${kr(P[t].cumInc)}</td><td>${kr(P[t].cumExp)}</td><td>${kr(P[t].net)}</td></tr>`).join('')}</table>`);
  if ($('#incMC').checked && MC) {
    const n = Math.min(N, MC.res.pct.p50.length - 1);
    pages.push(`${head('몬테카를로 분석')}<p class="note">${MC.params.runs.toLocaleString('ko-KR')}회 · ${MC.res.taxOn ? '세후' : '세전'} · ${new Date(MC.runAt).toLocaleString('ko-KR')} 실행${mcFresh() ? '' : ' · ⚠ 현재 입력값과 다른 결과'}</p>
      <div class="kpis">${mcKpiHTML(n)}</div>
      <h2>순자산 범위</h2><img style="width:100%" src="${chartImg((cv, T) => chartFan(cv, n, T), 900, 320)}" alt="순자산 범위">
      <h2>시점별 결과</h2><table>${mcTableHTML(n, true)}</table>`);
  }
  if ($('#incAdvice').checked) {
    const a = analyze();
    pages.push(`${head('재무 진단과 조언')}${healthHTML(a)}
      <h2>권장 우선순위</h2><ol><li>비상금: 월 지출 3~6개월분 (${a.exp1 ? kr(a.monthlyExp * 3) + ' ~ ' + kr(a.monthlyExp * 6) : '지출 입력 필요'})</li><li>고금리 부채 상환</li><li>연금저축·IRP·ISA 등 세제혜택 계좌 활용</li><li>지수 ETF 중심의 장기 분산투자와 연 1~2회 리밸런싱</li></ol>
      <p class="note">조언은 입력값에 기반한 일반적인 재무 정보이며, 공인 투자자문을 대신하지 않습니다.</p>`);
  }
  $('#a4Stage').innerHTML = pages.map((p, i) => a4Page(p, i + 1, pages.length)).join('');
}
function setPrintStyle() {
  let st = $('#printPage'); if (!st) { st = document.createElement('style'); st.id = 'printPage'; document.head.appendChild(st); }
  st.textContent = `@page { size: A4 ${orient}; margin: 0; }`;
}
$('#btnA4').addEventListener('click', () => { $('#a4Overlay').hidden = false; buildA4(); setPrintStyle(); });
$('#btnCloseA4').addEventListener('click', () => ($('#a4Overlay').hidden = true));
$('#orient').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; orient = b.dataset.o; $$('#orient button').forEach((x) => x.classList.toggle('on', x === b)); buildA4(); setPrintStyle(); });
['incMC', 'incAdvice'].forEach((id) => $('#' + id).addEventListener('change', buildA4));
$('#btnPrint').addEventListener('click', () => { setPrintStyle(); window.print(); });
async function capturePages() {
  if (!window.html2canvas) throw new Error('캡처 도구를 아직 불러오지 못했습니다');
  const out = [];
  for (const p of $$('#a4Stage .a4')) out.push(await html2canvas(p, { scale: 2, backgroundColor: '#ffffff', useCORS: true }));
  return out;
}
async function busy(btn, fn) { btn.disabled = true; const t = btn.textContent; btn.textContent = '만드는 중…'; try { await fn(); } catch (e) { toast('만들지 못했습니다: ' + (e.message || e)); } btn.disabled = false; btn.textContent = t; }
$('#btnPdf').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  if (!window.jspdf) throw new Error('PDF 도구를 아직 불러오지 못했습니다');
  const cs = await capturePages(), pdf = new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: 'a4' });
  const W = orient === 'portrait' ? 210 : 297, Hh = orient === 'portrait' ? 297 : 210;
  cs.forEach((c, i) => { if (i) pdf.addPage('a4', orient); const h = Math.min(Hh, (c.height / c.width) * W); pdf.addImage(c.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, W, h); });
  pdf.save(`${safeName()}_돈불리기보고서.pdf`);
}));
$('#btnPng').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  const cs = await capturePages(), gap = 24, w = Math.max(...cs.map((c) => c.width)), h = cs.reduce((s, c) => s + c.height, 0) + gap * (cs.length - 1);
  const out = document.createElement('canvas'); out.width = w; out.height = h; const g = out.getContext('2d'); g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, h);
  let y = 0; for (const c of cs) { g.drawImage(c, 0, y); y += c.height + gap; }
  out.toBlob((b) => download(`${safeName()}_돈불리기보고서.png`, b), 'image/png');
}));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#a4Overlay').hidden) $('#a4Overlay').hidden = true; });

/* ───────────── 시작 ───────────── */
function init() {
  if (window.Chart) { Chart.defaults.font.family = cssVar('--font') || 'sans-serif'; Chart.defaults.color = cssVar('--muted'); }
  const draft = lsGet(K_DRAFT, null), list = plans(), curId = lsGet(K_CUR, null);
  const rec = curId && list.find((p) => p.id === curId);
  if (rec) {
    cur = { id: rec.id, name: rec.name }; isExample = false; S = normalize(clone(rec.data)); savedJson = JSON.stringify(S);
    if (draft && draft.id === rec.id && draft.data) S = normalize(draft.data);    // 저장 안 된 변경 복원
  } else if (draft && !draft.id && draft.data && !draft.isExample) {
    S = normalize(draft.data); isExample = false; savedJson = JSON.stringify(normalize(clone(EXAMPLE)));
  }
  H = S.horizon; loadMC();
  renderInputs(); renderPlanSel(); setDirty();
  go(location.hash.slice(1) || 'intro');
}
if (!window.Chart) { const t = setInterval(() => { if (window.Chart) { clearInterval(t); init(); } }, 50); setTimeout(() => { clearInterval(t); if (!window.Chart) { toast('그래프 도구를 불러오지 못했습니다(인터넷 연결 확인)'); } }, 8000); }
else init();
})();
