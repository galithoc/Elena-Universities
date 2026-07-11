/* Elena — Road to the BFA · vanilla JS app engine (STEW-ART Designs)
   No framework, no build step. Fetches data/*.json at runtime.
   Countdowns are computed in America/Puerto_Rico (AST). */
'use strict';

// ── config ───────────────────────────────────────────────────────────────
const REPO = 'galithoc/Elena-Universities';   // owner/repo for the progress writer
const BRANCH = 'main';                          // branch the Pages site is served from
const TZ = 'America/Puerto_Rico';
const LS_TOKEN = 'elena_uni_gh_token';
const LS_SEEN = 'elena_uni_seen_cl';

const KIND_PREFIX = {
  app_deadline: '⏰', supplement_deadline: '🎬', audition_registration: '⏰',
  audition: '✈️', scholarship_deadline: '💰', aid_deadline: '💰', global: '📅',
};

const STATE = { meta: null, schools: {}, order: [], progress: null, changelog: null, calFilter: 'all' };

// ── tiny helpers ─────────────────────────────────────────────────────────
const $ = (sel, el = document) => el.querySelector(sel);
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── time (AST) ───────────────────────────────────────────────────────────
function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}
function ord(iso) { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function daysUntil(iso) { return ord(iso) - ord(todayISO()); }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) { if (!iso) return 'TBD'; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${MON[m - 1]} ${d}, ${y}`; }
function monthKey(iso) { const [y, m] = iso.slice(0, 10).split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; }
function countdownText(iso) {
  const n = daysUntil(iso);
  if (n < 0) return { n: Math.abs(n), u: n === -1 ? 'day ago' : 'days ago', over: true };
  if (n === 0) return { n: 'Today', u: '', over: false };
  return { n, u: n === 1 ? 'day' : 'days', over: false };
}

// ── facts ────────────────────────────────────────────────────────────────
function isFact(v) { return v && typeof v === 'object' && 'value' in v && 'cycleStatus' in v && 'lastVerified' in v; }
function fv(fact) { if (!isFact(fact)) return null; if (fact.cycleStatus === 'tbd') return null; return fact.value; }
function factBadge(fact) {
  if (!fact) return '';
  if (fact.pendingChange) return '<span class="badge pending">confirm needed</span>';
  const cs = fact.cycleStatus;
  if (cs === 'confirmed_2027') return '<span class="badge confirmed">2027 ✓</span>';
  if (cs === 'carried_from_2026') return "<span class=\"badge carried\">last year's</span>";
  return '<span class="badge tbd">TBD</span>';
}
function walkFacts(node, cb) {
  if (isFact(node)) { cb(node); return; }
  if (Array.isArray(node)) node.forEach(v => walkFacts(v, cb));
  else if (node && typeof node === 'object') Object.values(node).forEach(v => walkFacts(v, cb));
}

// ── dated-item extractor (mirrors scripts/build_ics.py collect_items) ──────
function chooseRound(school) {
  const sp = STATE.progress.schools[school.id] || {};
  const rounds = school.rounds || [];
  if (sp.roundChoice) { const r = rounds.find(x => x.id === sp.roundChoice); if (r) return r; }
  const dated = rounds.map(r => ({ d: fv(r.academicDeadline), r })).filter(x => x.d);
  if (dated.length) return dated.sort((a, b) => ord(a.d) - ord(b.d))[0].r;
  return rounds[0] || null;
}
function collectDatedItems() {
  const items = [];
  const push = (schoolId, id, kind, fact, label, city) => {
    const v = fv(fact); if (!v) return;
    items.push({ schoolId, id, kind, date: v.slice(0, 10), fact, label, city: city || '' });
  };
  const cyc = STATE.meta.cycle || {};
  [['commonAppOpens', 'Common App opens'], ['fafsaOpens', 'FAFSA opens (2027-28)']].forEach(([k, lbl]) => {
    if (cyc[k]) items.push({ schoolId: null, id: k, kind: 'global', date: cyc[k], fact: { cycleStatus: 'confirmed_2027' }, label: lbl });
  });
  (STATE.progress.global.checklist || []).forEach(it => {
    if (it.due && it.status !== 'done' && it.status !== 'na')
      items.push({ schoolId: null, id: it.id, kind: 'global', date: it.due, fact: { cycleStatus: 'confirmed_2027' }, label: it.label });
  });
  STATE.order.forEach(sid => {
    const s = STATE.schools[sid]; if (!s) return;
    const short = s.shortName || sid;
    const rnd = chooseRound(s);
    if (rnd) push(sid, `round-${rnd.id}-app`, 'app_deadline', rnd.academicDeadline, `${short}: ${rnd.label} due`);
    const sup = s.artisticSupplement || {};
    if (fv(sup.deadline)) push(sid, 'supplement', 'supplement_deadline', sup.deadline, `${short}: prescreen / supplement due`);
    else if (rnd && fv(rnd.artsSupplementDeadline)) push(sid, `round-${rnd.id}-supp`, 'supplement_deadline', rnd.artsSupplementDeadline, `${short}: artistic supplement due`);
    (s.auditions || []).forEach(a => {
      if (a.status === 'cancelled') return;
      push(sid, a.id, 'audition', a.date, `${short}: ${a.label}`, a.city);
      push(sid, `${a.id}-reg`, 'audition_registration', a.registrationDeadline, `${short}: register for ${a.label}`);
    });
    (s.scholarships || []).forEach(sc => push(sid, sc.id, 'scholarship_deadline', sc.deadline, `${short}: ${sc.name} deadline`));
    push(sid, 'aid-priority', 'aid_deadline', (s.financialAid || {}).priorityDeadline, `${short}: FAFSA/CSS priority`);
  });
  items.sort((a, b) => ord(a.date) - ord(b.date));
  return items;
}
function schoolAccent(sid) { return (STATE.schools[sid] || {}).accent || 'var(--gold)'; }
function schoolPill(sid) {
  const s = STATE.schools[sid]; if (!s) return '';
  return `<span class="spill"><span class="dot" style="background:${esc(s.accent)}"></span>${esc(s.shortName)}</span>`;
}

// ── progress mutations (GitHub API + fallback) ─────────────────────────────
function ghToken() { return localStorage.getItem(LS_TOKEN) || ''; }
function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str) { return decodeURIComponent(escape(atob(str))); }
function authHeaders(token) { return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }; }

async function ghSaveProgress(mutator, message) {
  const token = ghToken();
  const api = `https://api.github.com/repos/${REPO}/contents/data/progress.json`;
  const get = await fetch(`${api}?ref=${BRANCH}`, { headers: authHeaders(token), cache: 'no-cache' });
  if (!get.ok) throw new Error(`GET ${get.status}`);
  const cur = await get.json();
  const remote = JSON.parse(b64decode(cur.content));
  mutator(remote); remote.updated = todayISO();
  const put = await fetch(api, {
    method: 'PUT', headers: authHeaders(token),
    body: JSON.stringify({ message, content: b64encode(JSON.stringify(remote, null, 2) + '\n'), sha: cur.sha, branch: BRANCH }),
  });
  if (!put.ok) throw new Error(`PUT ${put.status}`);
  STATE.progress = remote;
}
function copySnippet(action) {
  const text = `In the elena-universities repo, ${action}. Edit data/progress.json per CLAUDE.md, then commit and push.`;
  STATE._lastSnippet = text;
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  return text;
}
async function persist(mutator, message, humanAction) {
  if (ghToken()) {
    try { await ghSaveProgress(mutator, message); render(); toast('Saved · visible to the family shortly'); }
    catch (e) { copySnippet(humanAction); toast('Save failed — Claude snippet copied instead'); }
  } else {
    copySnippet(humanAction);
    toast('Local only — snippet copied; paste into Claude (or add a token in ⚙) to save for everyone');
  }
}
const NEXT_STATUS = { todo: 'in_progress', in_progress: 'done', done: 'todo', blocked: 'todo', na: 'todo' };
function cycleCheck(scope, itemId) {
  const mutate = p => {
    const list = scope === 'global' ? p.global.checklist : (p.schools[scope] || {}).checklist || [];
    const it = list.find(x => x.id === itemId); if (!it) return;
    it.status = NEXT_STATUS[it.status] || 'todo';
    it.doneOn = it.status === 'done' ? todayISO() : null;
  };
  mutate(STATE.progress); render();
  const label = scope === 'global' ? 'a global task' : `${(STATE.schools[scope] || {}).shortName || scope} · "${itemId}"`;
  persist(mutate, `progress: ${scope} · ${itemId} (via app)`, `advance checklist item "${itemId}" for ${label}`);
}
function setRound(sid, roundId) {
  const mutate = p => { if (p.schools[sid]) p.schools[sid].roundChoice = roundId; };
  mutate(STATE.progress); render();
  persist(mutate, `progress: ${sid} round → ${roundId} (via app)`, `set roundChoice to "${roundId}" for ${sid}`);
}
function addNote(sid, text) {
  if (!text.trim()) return;
  const id = 'n-' + Date.now();
  const entry = { id, date: todayISO(), by: 'family', text: text.trim() };
  const mutate = p => { if (p.schools[sid]) (p.schools[sid].notes = p.schools[sid].notes || []).push(entry); };
  mutate(STATE.progress); render();
  persist(mutate, `progress: note added for ${sid} (via app)`, `add a note to ${sid}: "${text.trim()}"`);
}

// ── boot ───────────────────────────────────────────────────────────────
async function loadJSON(path) { const r = await fetch(path, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); }
async function boot() {
  try {
    const meta = await loadJSON('data/meta.json');
    const rest = await Promise.all([
      loadJSON('data/progress.json'), loadJSON('data/changelog.json'),
      ...meta.schools.map(id => loadJSON(`data/schools/${id}.json`)),
    ]);
    STATE.meta = meta; STATE.progress = rest[0]; STATE.changelog = rest[1];
    STATE.order = meta.schools; STATE.schools = {};
    rest.slice(2).forEach(s => { STATE.schools[s.id] = s; });
    document.title = meta.app.title;
    $('#subtitle').textContent = meta.app.tagline || '';
    route();
  } catch (e) {
    $('#view').innerHTML = `<div class="empty">Could not load data.<br><span class="muted">${esc(e.message)}</span></div>`;
  }
}

// ── router ─────────────────────────────────────────────────────────────
function parseHash() { const h = location.hash.replace(/^#\/?/, ''); const p = h.split('/'); return { view: p[0] || '', id: p[1] || '' }; }
const VIEWS = {
  '': renderDashboard, schools: renderSchools, school: renderSchoolDetail,
  calendar: renderCalendar, progress: renderProgress, news: renderNews,
  compare: renderCompare, travel: renderTravel,
};
function route() {
  const { view, id } = parseHash();
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === view));
  const fn = VIEWS[view] || renderDashboard;
  $('#view').innerHTML = fn(id);
  window.scrollTo(0, 0);
}
function render() { route(); }

// ── views ──────────────────────────────────────────────────────────────
function progressStats(sid) {
  const list = (STATE.progress.schools[sid] || {}).checklist || [];
  const done = list.filter(x => x.status === 'done' || x.status === 'na').length;
  return { done, total: list.length, pct: list.length ? Math.round(done / list.length * 100) : 0 };
}
function nextItemFor(sid, items) {
  const t = ord(todayISO());
  return items.filter(i => i.schoolId === sid && ord(i.date) >= t)[0] || null;
}

function renderDashboard() {
  const items = collectDatedItems();
  const t = ord(todayISO());
  const upcoming = items.filter(i => ord(i.date) >= t);
  const overdue = items.filter(i => ord(i.date) < t && i.fact.cycleStatus === 'confirmed_2027');

  // attention strip
  const att = [];
  walkFactsAll((fact, sid) => { if (fact.pendingChange) att.push({ kind: 'pending', sid, fact }); });
  overdue.forEach(i => att.push({ kind: 'overdue', item: i }));
  const soon = [];
  const scanChecks = (scope, list) => (list || []).forEach(it => {
    if (it.status === 'blocked') soon.push({ scope, it, why: 'blocked' });
    else if (it.due && it.status !== 'done' && it.status !== 'na' && daysUntil(it.due) >= 0 && daysUntil(it.due) <= 14) soon.push({ scope, it, why: 'due' });
  });
  scanChecks('global', STATE.progress.global.checklist);
  STATE.order.forEach(sid => scanChecks(sid, (STATE.progress.schools[sid] || {}).checklist));

  let html = '';
  if (att.length || soon.length) {
    html += '<div class="attention"><h3>Needs attention</h3>';
    att.forEach(a => {
      if (a.kind === 'pending') {
        const pc = a.fact.pendingChange;
        html += `<div class="att-item"><span class="when">confirm</span><span>${schoolPill(a.sid)} — a source now shows <b>${esc(pc.proposedValue)}</b> (was ${esc(a.fact.value)}). Review &amp; confirm.</span></div>`;
      } else {
        const i = a.item;
        html += `<div class="att-item"><span class="when">${daysUntil(i.date) === 0 ? 'today' : Math.abs(daysUntil(i.date)) + 'd ago'}</span><span>${schoolPill(i.schoolId)} — <b>${esc(i.label)}</b> was ${fmtDate(i.date)}</span></div>`;
      }
    });
    soon.forEach(s => {
      const who = s.scope === 'global' ? 'Global' : (STATE.schools[s.scope] || {}).shortName;
      const when = s.why === 'blocked' ? 'blocked' : daysUntil(s.it.due) + 'd';
      html += `<div class="att-item"><span class="when">${esc(when)}</span><span>${esc(who)} — ${esc(s.it.label)}</span></div>`;
    });
    html += '</div>';
  }

  html += '<div class="sec-title">Next up</div>';
  if (!upcoming.length) html += '<div class="empty">No upcoming dates yet — most 2027 dates publish Aug–Oct.</div>';
  upcoming.slice(0, 40).forEach(i => {
    const cd = countdownText(i.date);
    html += `<div class="up-item" style="--accent:${esc(schoolAccent(i.schoolId))}">
      <div class="cd"><div class="n">${cd.n}</div><div class="u">${esc(cd.u)}</div></div>
      <div class="body">
        <div class="t">${KIND_PREFIX[i.kind] || ''} ${esc(i.label)}</div>
        <div class="d"><span class="up-date">${fmtDate(i.date)}</span> ${i.city ? '· ' + esc(i.city) + ' ' : ''}${factBadge(i.fact)}</div>
      </div></div>`;
  });
  return html;
}
function walkFactsAll(cb) {
  STATE.order.forEach(sid => walkFacts(STATE.schools[sid], f => cb(f, sid)));
}

function renderSchools() {
  const items = collectDatedItems();
  let html = '<div class="sec-title">Schools</div><div class="grid">';
  STATE.order.forEach(sid => {
    const s = STATE.schools[sid]; const st = progressStats(sid);
    const next = nextItemFor(sid, items);
    const sp = STATE.progress.schools[sid] || {};
    const rnd = (s.rounds || []).find(r => r.id === sp.roundChoice);
    html += `<a class="school-card" href="#/school/${esc(sid)}" style="--accent:${esc(s.accent)}">
      <div class="ring" style="--p:${st.pct}" data-label="${st.done}/${st.total}"></div>
      <h3>${esc(s.shortName)}</h3>
      <div class="inst">${esc(s.institution)}</div>
      <div class="fitrow">${fitTags(s.fit)}</div>
      <div class="next">${next ? `${KIND_PREFIX[next.kind] || ''} <b>${fmtDate(next.date)}</b> — ${esc(next.label.split(': ').slice(1).join(': ') || next.label)}` : '<span class="muted">No dates yet</span>'}</div>
      <div class="row-tags">${rnd ? `<span class="tag warn">${esc(rnd.label)}</span>` : '<span class="tag">round not chosen</span>'}</div>
    </a>`;
  });
  return html + '</div>';
}
function fitTags(fit) {
  if (!fit) return '';
  const cls = v => v === 'strong' ? 'good' : v === 'weak' ? 'bad' : 'warn';
  let h = '';
  if (fit.commercial) h += `<span class="tag ${cls(fit.commercial)}">jazz/comm: ${esc(fit.commercial)}</span>`;
  if (fit.contemporary) h += `<span class="tag ${cls(fit.contemporary)}">contemp: ${esc(fit.contemporary)}</span>`;
  return h;
}

function factLine(label, fact, opts = {}) {
  if (!fact) return '';
  const v = fv(fact);
  let valHtml;
  if (v == null) valHtml = '<span class="muted">Not yet published</span>';
  else if (opts.date) valHtml = fmtDate(v);
  else if (typeof v === 'boolean') valHtml = v ? 'Yes' : 'No';
  else valHtml = esc(String(v));
  let out = `<div class="fact-line"><div class="lbl">${esc(label)}</div><div class="val${opts.date ? ' tabular' : ''}">${valHtml} ${factBadge(fact)}`;
  if (fact.pendingChange) out += `<div class="pendingbox"><b>Confirm needed:</b> a source now shows <b>${esc(fact.pendingChange.proposedValue)}</b> (seen ${fmtDate(fact.pendingChange.seenOn)}). ${esc(fact.pendingChange.note || '')}</div>`;
  if (fact.note) out += `<span class="fact-note">${esc(fact.note)}</span>`;
  if (fact.sourceUrl) out += ` <a class="src-link" href="${esc(fact.sourceUrl)}" target="_blank" rel="noopener">source ↗</a>`;
  out += '</div></div>';
  return out;
}

function renderSchoolDetail(id) {
  const s = STATE.schools[id];
  if (!s) return '<div class="empty">School not found. <a class="src-link" href="#/schools">Back to schools</a></div>';
  const sp = STATE.progress.schools[id] || {};
  let h = `<a class="back" href="#/schools">← All schools</a>
    <div class="detail-head" style="--accent:${esc(s.accent)}">
      <h2>${esc(s.name)}</h2><div class="inst">${esc(s.degree)} · ${esc(s.city)}, ${esc(s.state)}</div>
      <div class="kv"><span class="tag">${esc(s.applicationSystem)}</span>${fitTags(s.fit)}</div>
      ${s.fit && s.fit.note ? `<div class="sec-sub" style="margin-top:8px">${esc(s.fit.note)}</div>` : ''}
    </div>`;

  // rounds + selector
  h += '<div class="sec-title">Application rounds</div><div class="sec-sub">Tap the round Elena is applying in — it drives her countdowns.</div><div class="roundsel">';
  (s.rounds || []).forEach(r => {
    const on = sp.roundChoice === r.id;
    const d = fv(r.academicDeadline);
    h += `<button data-action="set-round" data-school="${esc(id)}" data-round="${esc(r.id)}" class="${on ? 'on' : ''}">${esc(r.label)}${r.binding ? ' (binding)' : ''}<span class="rd">${d ? fmtDate(d) : 'date TBD'}</span></button>`;
  });
  h += '</div>';
  (s.rounds || []).forEach(r => {
    if (sp.roundChoice && sp.roundChoice !== r.id) return;
    h += `<div class="card" style="--accent:${esc(s.accent)}"><h3>${esc(r.label)}</h3>`;
    h += factLine('Application deadline', r.academicDeadline, { date: true });
    h += factLine('Artistic supplement', r.artsSupplementDeadline, { date: true });
    h += factLine('Decision released', r.decisionRelease, { date: true });
    if (r.notes) h += `<div class="fact-note" style="margin-top:8px">${esc(r.notes)}</div>`;
    h += '</div>';
  });

  // artistic supplement
  const sup = s.artisticSupplement || {};
  h += '<div class="sec-title">Prescreen &amp; artistic supplement</div><div class="card" style="--accent:' + esc(s.accent) + '">';
  h += factLine('Portal', sup.portal);
  h += factLine('Fee', sup.fee);
  h += factLine('Prescreen deadline', sup.deadline, { date: true });
  h += factLine('Prescreen required', sup.prescreenRequired);
  if (sup.videoSpec && fv(sup.videoSpec)) {
    h += `<div class="fact-line"><div class="lbl">Video / materials ${factBadge(sup.videoSpec)}</div><div class="val"><ul class="spec-list">`;
    fv(sup.videoSpec).forEach(x => { h += `<li>${esc(x.text)}</li>`; });
    h += '</ul>';
    if (sup.videoSpec.sourceUrl) h += `<a class="src-link" href="${esc(sup.videoSpec.sourceUrl)}" target="_blank" rel="noopener">source ↗</a>`;
    h += '</div></div>';
  }
  h += '</div>';

  // auditions
  h += '<div class="sec-title">Auditions</div>';
  (s.auditions || []).forEach(a => {
    const virtual = a.format === 'virtual' || a.format === 'hybrid';
    h += `<div class="card" style="--accent:${esc(s.accent)}"><h3>${esc(a.label)}</h3>
      <div class="row-tags">
        <span class="tag ${virtual ? 'virtual' : ''}">${esc(a.format.replace('_', ' '))}</span>
        ${a.city ? `<span class="tag">${esc(a.city)}</span>` : ''}
        <span class="tag">${esc(a.status)}</span>${factBadge(a.date)}</div>`;
    h += factLine('Date', a.date, { date: true });
    h += factLine('Registration opens', a.registrationOpens, { date: true });
    h += factLine('Registration deadline', a.registrationDeadline, { date: true });
    if (a.registrationUrl) h += `<div class="fact-line"><div class="lbl">Register</div><div class="val"><a class="src-link" href="${esc(a.registrationUrl)}" target="_blank" rel="noopener">${esc(a.registrationUrl)} ↗</a></div></div>`;
    if (a.notes) h += `<div class="fact-note" style="margin-top:6px">${esc(a.notes)}</div>`;
    h += '</div>';
  });

  // academics
  const ac = s.academics || {};
  h += '<div class="sec-title">Academics &amp; essays</div><div class="card" style="--accent:' + esc(s.accent) + '">';
  h += factLine('Test policy', ac.testPolicy);
  h += factLine('Recommendations', ac.recommendations);
  h += factLine('Interview', ac.interview);
  if (ac.essays && fv(ac.essays)) {
    h += `<div class="fact-line"><div class="lbl">Essays ${factBadge(ac.essays)}</div><div class="val"><ul class="spec-list">`;
    fv(ac.essays).forEach(e => { h += `<li>${esc(e.prompt)}${e.wordLimit ? ` <span class="muted">(${e.wordLimit} words)</span>` : ''}</li>`; });
    h += '</ul></div></div>';
  }
  h += '</div>';

  // scholarships + aid + costs
  h += '<div class="sec-title">Scholarships &amp; aid</div>';
  (s.scholarships || []).forEach(sc => {
    h += `<div class="card" style="--accent:${esc(s.accent)}"><h3>${esc(sc.name)} <span class="tag">${esc(sc.kind)}</span></h3>`;
    h += factLine('Amount', sc.amount);
    h += factLine('Deadline', sc.deadline, { date: true });
    h += factLine('Separate application', sc.requiresSeparateApp);
    if (sc.notes) h += `<div class="fact-note" style="margin-top:6px">${esc(sc.notes)}</div>`;
    h += '</div>';
  });
  const fa = s.financialAid || {}, co = s.costs || {};
  h += '<div class="card" style="--accent:' + esc(s.accent) + '"><h3>Financial aid &amp; cost</h3>';
  h += factLine('FAFSA required', fa.fafsaRequired);
  h += factLine('CSS Profile required', fa.cssProfileRequired);
  h += factLine('Aid priority deadline', fa.priorityDeadline, { date: true });
  h += factLine(`Tuition (${esc(co.year || '')})`, co.tuitionAnnual);
  h += factLine('Est. cost of attendance', co.totalCostOfAttendance);
  h += '</div>';

  // program facts
  const pf = s.programFacts || {};
  h += '<div class="sec-title">Program facts</div><div class="card" style="--accent:' + esc(s.accent) + '">';
  h += factLine('Cohort size', pf.cohortSize);
  h += factLine('Selectivity', pf.acceptanceRate);
  if (pf.genreEmphasis && fv(pf.genreEmphasis)) h += `<div class="fact-line"><div class="lbl">Genre emphasis ${factBadge(pf.genreEmphasis)}</div><div class="val">${fv(pf.genreEmphasis).map(g => `<span class="tag">${esc(g)}</span>`).join(' ')}</div></div>`;
  h += factLine('Company / performance', pf.companyAffiliation);
  h += factLine('Notable', pf.notable);
  h += '</div>';

  // checklist (this school)
  h += '<div class="sec-title">Progress</div>' + checklistHTML(id, (sp.checklist || []));

  // notes
  h += '<div class="sec-title">Notes</div>';
  (sp.notes || []).forEach(n => { h += `<div class="note-item"><div class="meta">${fmtDate(n.date)} · ${esc(n.by)}</div>${esc(n.text)}</div>`; });
  h += `<div class="addnote"><input type="text" id="note-input-${esc(id)}" placeholder="Add a note (logistics, reminders — no essays/financials)"><button class="btn" data-action="add-note" data-school="${esc(id)}">Add</button></div>`;

  // sources
  h += '<div class="sec-title">Pages we watch</div><div class="card"><div class="sec-sub" style="margin:0 0 8px">The refresh checks these official pages for updates.</div>';
  (s.sources || []).forEach(src => { h += `<div class="fact-line"><div class="lbl">${esc(src.label)}</div><div class="val"><a class="src-link" href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.url)} ↗</a></div></div>`; });
  h += '</div>';

  // this school's changelog
  const cl = (STATE.changelog.entries || []).filter(e => e.school === id);
  if (cl.length) { h += '<div class="sec-title">What changed</div>'; cl.slice().reverse().forEach(e => { h += `<div class="news-item" style="--accent:${esc(s.accent)}"><div class="meta"><span class="date">${fmtDate(e.date)}</span><span class="tag">${esc(e.type)}</span></div><div class="text">${esc(e.text)}</div></div>`; }); }

  return h;
}

function checklistHTML(scope, list) {
  const st = { done: 0, total: list.length };
  list.forEach(x => { if (x.status === 'done' || x.status === 'na') st.done++; });
  const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
  let h = `<div class="progress-head"><span>${st.done} of ${st.total} done</span><span>${pct}%</span></div><div class="progress-bar"><i style="width:${pct}%"></i></div>`;
  list.forEach(it => {
    const mark = it.status === 'done' ? '✓' : it.status === 'in_progress' ? '•' : it.status === 'blocked' ? '!' : it.status === 'na' ? '–' : '';
    const dueSoon = it.due && daysUntil(it.due) >= 0 && daysUntil(it.due) <= 14 && it.status !== 'done';
    h += `<div class="check">
      <button class="box ${esc(it.status)}" data-action="cycle-check" data-scope="${esc(scope)}" data-item="${esc(it.id)}" title="${esc(it.status)} — tap to advance">${mark}</button>
      <div class="lbl ${it.status === 'done' ? 'done' : ''}">${esc(it.label)}${it.note ? `<span class="fact-note">${esc(it.note)}</span>` : ''}</div>
      ${it.due ? `<span class="due ${dueSoon ? 'soon' : ''}">${fmtDate(it.due)}</span>` : ''}
      <span class="who ${esc(it.owner)}">${it.owner === 'both' ? 'Both' : it.owner === 'parents' ? 'Mom+Dad' : 'Elena'}</span>
    </div>`;
  });
  return h;
}

function renderProgress() {
  let h = '<div class="sec-title">Global tasks</div>' + checklistHTML('global', STATE.progress.global.checklist);
  h += '<div class="sec-title">By school</div>';
  STATE.order.forEach(sid => {
    const s = STATE.schools[sid];
    h += `<div class="card" style="--accent:${esc(s.accent)}"><h3><a class="src-link" href="#/school/${esc(sid)}" style="border:none">${esc(s.shortName)} →</a></h3>${checklistHTML(sid, (STATE.progress.schools[sid] || {}).checklist || [])}</div>`;
  });
  return h;
}

function renderCalendar() {
  const all = collectDatedItems();
  const filters = ['all', 'app_deadline', 'supplement_deadline', 'audition', 'scholarship_deadline', 'aid_deadline'];
  const flabel = { all: 'All', app_deadline: '⏰ Deadlines', supplement_deadline: '🎬 Prescreen', audition: '✈️ Auditions', scholarship_deadline: '💰 Scholarships', aid_deadline: '💰 Aid' };
  const dir = location.origin + location.pathname.replace(/[^/]*$/, '');
  const https = dir + STATE.meta.ics.feedPath;
  const webcal = https.replace(/^https?:/, 'webcal:');
  let h = `<div class="subscribe"><h3>📆 Subscribe to the calendar</h3>
    <p>Add every deadline &amp; audition to your phone — it updates itself as dates change.</p>
    <div class="row-tags" style="margin-top:8px">
      <a class="btn primary" href="${esc(webcal)}">Add to Apple Calendar</a>
      <button class="btn" data-action="copy-ics" data-url="${esc(https)}">Copy feed URL (Google)</button>
      <a class="btn" href="${esc(https)}" download>Download .ics</a>
    </div>
    <p class="muted" style="margin-top:8px">Google Calendar → “Other calendars → From URL”. It refreshes every ~12–24h.</p></div>`;
  h += '<div class="filterbar">' + filters.map(f => `<button data-action="cal-filter" data-f="${f}" class="${STATE.calFilter === f ? 'on' : ''}">${flabel[f]}</button>`).join('') + '</div>';
  const items = all.filter(i => STATE.calFilter === 'all' || i.kind === STATE.calFilter || (STATE.calFilter === 'audition' && i.kind === 'audition_registration'));
  let cur = '';
  items.forEach(i => {
    const mk = monthKey(i.date);
    if (mk !== cur) { h += `<div class="month">${esc(mk)}</div>`; cur = mk; }
    const [, m, d] = i.date.slice(0, 10).split('-').map(Number);
    h += `<div class="agenda"><div class="date">${MON[m - 1]} ${d}</div><div class="lbl">${KIND_PREFIX[i.kind] || ''} ${esc(i.label)} ${factBadge(i.fact)}</div></div>`;
  });
  if (!items.length) h += '<div class="empty">Nothing dated in this filter yet.</div>';
  return h;
}

function renderNews() {
  const entries = (STATE.changelog.entries || []).slice().reverse();
  const seen = localStorage.getItem(LS_SEEN);
  if (entries.length) localStorage.setItem(LS_SEEN, entries[0].id);
  let h = '<div class="sec-title">What\'s new</div>';
  let dividerShown = false;
  entries.forEach(e => {
    if (!dividerShown && seen && e.id === seen && e !== entries[0]) { h += '<div class="news-divider">— earlier —</div>'; dividerShown = true; }
    const acc = e.school ? schoolAccent(e.school) : 'var(--gold)';
    h += `<div class="news-item" style="--accent:${esc(acc)}"><div class="meta"><span class="date">${fmtDate(e.date)}</span>${e.school ? schoolPill(e.school) : ''}<span class="tag">${esc(e.type)}</span></div><div class="text">${esc(e.text)}</div></div>`;
  });
  return h;
}

function renderCompare() {
  const rows = [
    ['App deadline', s => { const r = chooseRound(s); const d = r && fv(r.academicDeadline); return d ? fmtDate(d) + ' ' + factBadge(r.academicDeadline) : 'TBD'; }],
    ['Prescreen?', s => valBadge(s.artisticSupplement && s.artisticSupplement.prescreenRequired)],
    ['Portal', s => valBadge(s.artisticSupplement && s.artisticSupplement.portal)],
    ['Test policy', s => valBadge(s.academics && s.academics.testPolicy)],
    ['Jazz/commercial fit', s => s.fit ? esc(s.fit.commercial || '—') : '—'],
    ['Contemporary fit', s => s.fit ? esc(s.fit.contemporary || '—') : '—'],
    ['Virtual audition?', s => (s.auditions || []).some(a => a.format === 'virtual' || a.format === 'hybrid') ? '<span class="tag virtual">yes</span>' : '<span class="tag">in-person</span>'],
    ['Cohort size', s => valBadge(s.programFacts && s.programFacts.cohortSize)],
    ['Est. COA', s => valBadge(s.costs && s.costs.totalCostOfAttendance)],
    ['CSS Profile?', s => valBadge(s.financialAid && s.financialAid.cssProfileRequired)],
  ];
  let h = '<div class="sec-title">Compare</div><div class="tablewrap"><table class="compare"><thead><tr><th>—</th>';
  STATE.order.forEach(sid => { h += `<th>${schoolPill(sid)}</th>`; });
  h += '</tr></thead><tbody>';
  rows.forEach(([label, fn]) => {
    h += `<tr><th>${esc(label)}</th>`;
    STATE.order.forEach(sid => { h += `<td>${fn(STATE.schools[sid])}</td>`; });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}
function valBadge(fact) { if (!fact) return '—'; const v = fv(fact); const disp = v == null ? '<span class="muted">TBD</span>' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : esc(String(v)); return disp + ' ' + factBadge(fact); }

function renderTravel() {
  const items = collectDatedItems();
  let h = '<div class="sec-title">Travel &amp; audition clusters</div><div class="sec-sub">Every in-person audition is a flight from San Juan. Group trips where you can — and use virtual options to skip flights entirely.</div>';
  // virtual box
  const virtual = STATE.order.filter(sid => (STATE.schools[sid].auditions || []).some(a => a.format === 'virtual' || a.format === 'hybrid'));
  h += '<div class="virtual-box"><h3>✈️ Skip the flight — virtual options</h3>';
  virtual.forEach(sid => {
    const a = (STATE.schools[sid].auditions || []).find(x => x.format === 'virtual' || x.format === 'hybrid');
    h += `<div class="region-line" style="padding:6px 0">${schoolPill(sid)} — <span class="muted">${esc(a.notes || a.label)}</span></div>`;
  });
  h += '</div>';
  const regions = STATE.meta.regions || {};
  Object.keys(regions).forEach(rk => {
    const r = regions[rk];
    h += `<div class="region"><h3>${esc(r.label)}</h3><div class="note">${esc(r.note)}</div>`;
    r.schools.forEach(sid => {
      const s = STATE.schools[sid]; if (!s) return;
      const auds = items.filter(i => i.schoolId === sid && i.kind === 'audition');
      const datestr = auds.length ? auds.map(a => fmtDate(a.date)).join(', ') : 'dates TBD';
      h += `<div class="school-line">${schoolPill(sid)} <span class="muted">— ${esc(datestr)}</span> <a class="src-link" href="#/school/${esc(sid)}">details →</a></div>`;
    });
    h += '</div>';
  });
  return h;
}

// ── settings sheet ─────────────────────────────────────────────────────
function openSettings() {
  const body = $('#settings-body');
  const has = !!ghToken();
  body.innerHTML = `
    <p>Tick off checklists and notes right in the app and share them with the whole family. To save with one tap, paste a GitHub token below (stored only in this browser).</p>
    <label>GitHub fine-grained token <span class="muted">(repo <b>${esc(REPO)}</b>, Contents: read/write)</span></label>
    <input type="password" id="token-input" placeholder="${has ? '•••••• saved' : 'github_pat_...'}" autocomplete="off">
    <div class="row-tags" style="margin-top:12px">
      <button class="btn primary" data-action="save-token">Save token</button>
      ${has ? '<button class="btn" data-action="clear-token">Remove</button>' : ''}
    </div>
    <p style="margin-top:16px">Without a token, ticking a box copies a ready-to-paste snippet you can drop into a Claude session instead.</p>
    ${STATE._lastSnippet ? `<label>Last snippet</label><div class="snippet">${esc(STATE._lastSnippet)}</div>` : ''}
    <p style="margin-top:16px"><a class="src-link" href="https://github.com/${esc(REPO)}" target="_blank" rel="noopener">Open the repo ↗</a></p>`;
  $('#settings-backdrop').hidden = false; $('#settings-sheet').hidden = false;
}
function closeSettings() { $('#settings-backdrop').hidden = true; $('#settings-sheet').hidden = true; }

// ── events ─────────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]'); if (!t) return;
  const a = t.dataset.action;
  if (a === 'cycle-check') cycleCheck(t.dataset.scope, t.dataset.item);
  else if (a === 'set-round') setRound(t.dataset.school, t.dataset.round);
  else if (a === 'add-note') { const inp = $(`#note-input-${CSS.escape(t.dataset.school)}`); if (inp) { addNote(t.dataset.school, inp.value); inp.value = ''; } }
  else if (a === 'cal-filter') { STATE.calFilter = t.dataset.f; render(); }
  else if (a === 'copy-ics') { if (navigator.clipboard) navigator.clipboard.writeText(t.dataset.url); toast('Feed URL copied'); }
  else if (a === 'save-token') { const v = $('#token-input').value.trim(); if (v) { localStorage.setItem(LS_TOKEN, v); toast('Token saved to this browser'); closeSettings(); render(); } }
  else if (a === 'clear-token') { localStorage.removeItem(LS_TOKEN); toast('Token removed'); openSettings(); }
});
$('#open-settings').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', closeSettings);
$('#settings-backdrop').addEventListener('click', closeSettings);
window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });

boot();
