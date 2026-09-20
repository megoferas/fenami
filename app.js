import { html, render, useState, useEffect, useMemo, useRef } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
import { SUPABASE_URL, SUPABASE_KEY, MAP_STYLE, MAP_CENTER, MAPLIBRE_JS, MAPLIBRE_CSS } from './config.js?v=4';
import { T } from './i18n.js?v=4';
import { Icon, iconSvg, CATS, CAT_ORDER, INTERESTS } from './icons.js?v=4';

if (!window.supabase) throw new Error('The Supabase library did not load (cdn.jsdelivr.net)');
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// MapLibre is loaded only when the map is opened, so it never blocks the first screen.
let mapLibPromise = null;
function loadMapLib() {
  if (window.maplibregl) return Promise.resolve();
  if (!mapLibPromise) {
    mapLibPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = MAPLIBRE_CSS;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = MAPLIBRE_JS;
      js.onload = () => resolve();
      js.onerror = () => { mapLibPromise = null; reject(new Error('maplibre failed to load')); };
      document.head.appendChild(js);
    });
  }
  return mapLibPromise;
}

// Shared translation state. App() refreshes it on every render, so all screens see the current language.
let APP = null;
const useApp = () => APP;

/* ---------- helpers ---------- */
const go = (r) => { location.hash = r; };
const pname = (p, lang) => (lang === 'ar' ? p.name_ar || p.name : p.name);
const today = () => new Date().toISOString().slice(0, 10);
const INTEREST_MAP = Object.fromEntries(INTERESTS.map((i) => [i.id, i.cats]));
const ACTIVITIES = ['coffee', 'food', 'gaming', 'cinema', 'padel', 'football', 'karting', 'entertainment', 'outdoors', 'other'];
const actIcon = (a) => (CATS[a] ? CATS[a].icon : 'star');
const actTone = (a) => (CATS[a] ? CATS[a].tone : 'pink');
const TONES = ['pink', 'green', 'pink', 'green'];

function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

function ageFrom(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return 0;
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

const locale = (lang) => (lang === 'ar' ? 'ar-EG' : 'en-GB');
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function fmtWhen(iso, lang, t) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale(lang), { hour: 'numeric', minute: '2-digit' });
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  let day;
  if (diff === 0) day = t('today');
  else if (diff === 1) day = t('tomorrow');
  else day = d.toLocaleDateString(locale(lang), { weekday: 'short', day: 'numeric', month: 'short' });
  return day + ' · ' + time;
}

function fmtTime(iso, lang) {
  return new Date(iso).toLocaleTimeString(locale(lang), { hour: 'numeric', minute: '2-digit' });
}

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function defaultWhen() {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

const initial = (name) => ((name || '?').trim().charAt(0) || '?').toUpperCase();

function joinError(t, msg) {
  if (/full/i.test(msg)) return t('errFull');
  if (/closed/i.test(msg)) return t('errClosed');
  if (/not available/i.test(msg)) return t('errNotVisible');
  return msg;
}

const PLAN_COLS =
  'id,title,activity,starts_at,capacity,visibility,status,host_id,place:places(id,name,name_ar,category),members:plan_members(user_id)';

/* ---------- small pieces ---------- */
function Splash() {
  return html`<div class="center"><img src="logo.jpg" alt="FENAMI" /></div>`;
}

function PlaceCard({ p }) {
  const { t, lang } = useApp();
  const c = CATS[p.category] || CATS.sports;
  return html`<a class="sticker pcard" href=${'#explore/' + p.id}>
    <span class=${'dot tone-' + c.tone}><${Icon} name=${c.icon} /></span>
    <span class="pinfo">
      <span class="pname">${pname(p, lang)}</span>
      <span class="psub">${t('cat.' + p.category)}</span>
    </span>
  </a>`;
}

function PlanCard({ p, meId }) {
  const { t, lang } = useApp();
  const members = p.members || [];
  const n = members.length;
  const joined = members.some((m) => m.user_id === meId);
  const label = joined ? t('joined') : n >= p.capacity ? t('full') : n + '/' + p.capacity;
  return html`<a class="sticker pcard" href=${'#plan/' + p.id}>
    <span class=${'dot tone-' + actTone(p.activity)}><${Icon} name=${actIcon(p.activity)} /></span>
    <span class="pinfo">
      <span class="pname">${p.title}</span>
      <span class="psub">${fmtWhen(p.starts_at, lang, t)}${p.place ? ' · ' + pname(p.place, lang) : ''}</span>
    </span>
    <span class=${'spots' + (joined ? ' in' : '')}>${label}</span>
  </a>`;
}

function Nav({ tab }) {
  const { t } = useApp();
  const items = ['home', 'explore', 'plans', 'friends', 'profile'];
  return html`<nav class="nav">
    ${items.map(
      (id) => html`<a href=${'#' + id} class=${tab === id ? 'on' : ''}>
        <span class="pill"><${Icon} name=${id} /></span>
        <span>${t('nav.' + id)}</span>
      </a>`
    )}
  </nav>`;
}

function BackBtn({ to }) {
  const { t } = useApp();
  return html`<a class="backbtn" href=${'#' + to} aria-label=${t('back')}><${Icon} name="back" /></a>`;
}

/* ---------- auth ---------- */
function AuthScreen() {
  const { t, lang, setLang } = useApp();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const creds = { email: email.trim(), password: pw };
    const { data, error } = mode === 'signup' ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) return setMsg({ bad: true, text: error.message });
    if (mode === 'signup' && !data.session) setMsg({ bad: false, text: t('checkEmail') });
  }

  return html`<div class="auth">
    <button class="chip langbtn" type="button" onClick=${() => setLang(lang === 'ar' ? 'en' : 'ar')}>
      ${lang === 'ar' ? 'English' : 'العربية'}
    </button>
    <img src="logo.jpg" alt="FENAMI" />
    <div class="tag-line">${t('tagline')}</div>
    <form class="sticker card" onSubmit=${submit}>
      <label class="label">${t('email')}
        <input class="input" type="email" required autocomplete="email" value=${email}
          onInput=${(e) => setEmail(e.target.value)} />
      </label>
      <label class="label">${t('password')}
        <input class="input" type="password" required minlength="6"
          autocomplete=${mode === 'signup' ? 'new-password' : 'current-password'} value=${pw}
          onInput=${(e) => setPw(e.target.value)} />
      </label>
      ${msg && html`<div class=${'note' + (msg.bad ? ' bad' : '')}>${msg.text}</div>`}
      <button class="btn" type="submit" disabled=${busy}>
        ${busy ? t('loading') : mode === 'signup' ? t('signup') : t('signin')}
      </button>
      <button class="linkbtn" type="button"
        onClick=${() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMsg(null); }}>
        ${mode === 'signup' ? t('toSignin') : t('toSignup')}
      </button>
    </form>
    <p class="muted" style="text-align:center;color:var(--ink)">${t('adultOnly')}</p>
  </div>`;
}

function Onboarding({ session, onDone }) {
  const { t, lang, setLang } = useApp();
  const [dn, setDn] = useState('');
  const [un, setUn] = useState('');
  const [bd, setBd] = useState('');
  const [sel, setSel] = useState([]);
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const u = un.trim().toLowerCase();
    if (!dn.trim()) return setErr(t('errName'));
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) return setErr(t('errUsername'));
    if (!bd) return setErr(t('errDate'));
    if (ageFrom(bd) < 18) return setErr(t('errAdult'));

    setBusy(true);
    const uid = session.user.id;
    let r = await sb.from('profiles').upsert({
      id: uid, username: u, display_name: dn.trim(), interests: sel, budget: budget || null,
    });
    if (r.error) {
      setBusy(false);
      return setErr(r.error.code === '23505' ? t('errTaken') : r.error.message);
    }
    r = await sb.from('profile_private').upsert({ id: uid, birth_date: bd });
    if (r.error) {
      setBusy(false);
      return setErr(/18\+/.test(r.error.message) ? t('errAdult') : r.error.message);
    }
    onDone();
  }

  return html`<form class="page" onSubmit=${submit}>
    <div class="topline">
      <div class="h2">${t('setupTitle')}</div>
      <button class="chip" type="button" onClick=${() => setLang(lang === 'ar' ? 'en' : 'ar')}>
        ${lang === 'ar' ? 'English' : 'العربية'}
      </button>
    </div>
    <label class="label">${t('displayName')}
      <input class="input" value=${dn} maxlength="40" onInput=${(e) => setDn(e.target.value)} />
    </label>
    <label class="label">${t('username')}
      <input class="input" value=${un} maxlength="20" autocapitalize="none" autocomplete="off"
        onInput=${(e) => setUn(e.target.value)} />
      <span class="muted">${t('usernameHint')}</span>
    </label>
    <label class="label">${t('birth')}
      <input class="input" type="date" value=${bd} max=${today()} onInput=${(e) => setBd(e.target.value)} />
      <span class="muted">${t('adultNote')}</span>
    </label>
    <div class="block">
      <div class="label">${t('interests')}</div>
      <div class="chips">
        ${INTERESTS.map((i) => html`<button type="button" class=${'chip' + (sel.includes(i.id) ? ' on' : '')}
          onClick=${() => toggle(i.id)}>${t('int.' + i.id)}</button>`)}
      </div>
    </div>
    <div class="block">
      <div class="label">${t('budget')}</div>
      <div class="chips">
        ${['low', 'medium', 'high'].map((b) => html`<button type="button" class=${'chip' + (budget === b ? ' on' : '')}
          onClick=${() => setBudget(budget === b ? '' : b)}>${t(b)}</button>`)}
      </div>
    </div>
    ${err && html`<div class="note bad">${err}</div>`}
    <button class="btn" type="submit" disabled=${busy}>${busy ? t('loading') : t('letsGo')}</button>
  </form>`;
}

/* ---------- home ---------- */
function Home({ me, places, plans, loadError }) {
  const { t } = useApp();
  const now = today();

  const fresh = useMemo(() => places.filter((p) => p.is_new_until && p.is_new_until >= now).slice(0, 6), [places]);

  const soon = useMemo(() => {
    const limit = Date.now() + 24 * 3600 * 1000;
    return plans.filter((p) => new Date(p.starts_at).getTime() < limit).slice(0, 3);
  }, [plans]);

  const picks = useMemo(() => {
    const wanted = new Set();
    (me.interests || []).forEach((id) => (INTEREST_MAP[id] || []).forEach((c) => wanted.add(c)));
    let pool = places.filter((p) => wanted.has(p.category));
    if (pool.length < 4) {
      pool = places.filter((p) => ['coffee', 'food', 'entertainment', 'cinema', 'outdoors'].includes(p.category));
    }
    return pool
      .map((p) => [hash(p.id + me.id), p])
      .sort((a, b) => a[0] - b[0])
      .slice(0, 6)
      .map((x) => x[1]);
  }, [places, me]);

  return html`<div class="screen">
    <div>
      <div class="hello">${t('hey')} ${me.display_name}</div>
      <div class="loc"><${Icon} name="pin" size=${18} /> New Cairo</div>
    </div>

    <div class="block">
      <div class="h2">${t('tonight')}</div>
      ${soon.length > 0
        ? html`<div class="stack">${soon.map((p) => html`<${PlanCard} p=${p} meId=${me.id} />`)}</div>`
        : html`<div class="sticker empty"><${Icon} name="plans" /> <span>${t('tonightEmpty')}</span></div>`}
      <a class="btn btn-small" href="#new"><${Icon} name="plus" size=${20} /> ${t('createPlan')}</a>
    </div>

    ${loadError && html`<div class="note bad">${t('loadError')}</div>`}

    ${fresh.length > 0 && html`<div class="block">
      <div class="h2">${t('justAdded')}</div>
      <div class="stack">${fresh.map((p) => html`<${PlaceCard} p=${p} />`)}</div>
    </div>`}

    ${picks.length > 0 && html`<div class="block">
      <div class="h2">${t('picked')}</div>
      <div class="stack">${picks.map((p) => html`<${PlaceCard} p=${p} />`)}</div>
    </div>`}
  </div>`;
}

/* ---------- explore (map + list) ---------- */
function Explore({ places, initialId, loadError }) {
  const { t, lang } = useApp();
  const [view, setView] = useState('map');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(initialId || null);
  const [mapReady, setMapReady] = useState(false);
  const [mapErr, setMapErr] = useState(false);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef([]);

  useEffect(() => {
    if (initialId) { setSel(initialId); setView('map'); }
  }, [initialId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return places.filter((p) =>
      (cat === 'all' || p.category === cat) &&
      (!s || (p.name + ' ' + (p.name_ar || '')).toLowerCase().includes(s))
    );
  }, [places, cat, q]);

  const selected = useMemo(() => places.find((p) => p.id === sel) || null, [places, sel]);

  useEffect(() => {
    if (view !== 'map') return;
    let cancelled = false;
    let map = null;
    setMapErr(false);
    loadMapLib()
      .then(() => {
        if (cancelled || !mapEl.current) return;
        try {
          map = new maplibregl.Map({
            container: mapEl.current, style: MAP_STYLE, center: MAP_CENTER, zoom: 11.2,
            attributionControl: { compact: true },
          });
        } catch (e) { setMapErr(true); return; }
        mapRef.current = map;
        map.on('click', () => setSel(null));
        setMapReady(true);
      })
      .catch(() => setMapErr(true));
    return () => {
      cancelled = true;
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      if (map) map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || view !== 'map') return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    filtered.forEach((p) => {
      const c = CATS[p.category] || CATS.sports;
      const el = document.createElement('button');
      el.className = 'pin pin-' + c.tone + (p.id === sel ? ' pin-sel' : '');
      el.setAttribute('aria-label', pname(p, lang));
      el.innerHTML = iconSvg(c.icon, p.id === sel ? 26 : 22);
      el.addEventListener('click', (ev) => { ev.stopPropagation(); setSel(p.id); });
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
    });
  }, [filtered, sel, view, mapReady, lang]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    map.flyTo({ center: [selected.lon, selected.lat], zoom: Math.max(map.getZoom(), 14.5), duration: 600 });
  }, [sel, mapReady]);

  const cats = ['all', ...CAT_ORDER.filter((c) => places.some((p) => p.category === c))];

  return html`<div class="explore">
    ${view === 'map' && html`<div class="map" ref=${mapEl}></div>`}
    ${view === 'list' && html`<div class="list">
      ${filtered.length === 0 && html`<div class="note">${t('noResults')}</div>`}
      ${filtered.slice(0, 200).map((p) => html`<${PlaceCard} p=${p} />`)}
    </div>`}

    <div class="topbar">
      <div class="searchrow">
        <label class="searchbox">
          <${Icon} name="search" size=${22} />
          <input type="text" placeholder=${t('search')} aria-label=${t('search')} value=${q}
            onInput=${(e) => setQ(e.target.value)} />
        </label>
        <button class="viewbtn" aria-label=${view === 'map' ? t('list') : t('map')}
          onClick=${() => setView(view === 'map' ? 'list' : 'map')}>
          <${Icon} name=${view === 'map' ? 'list' : 'map'} />
        </button>
      </div>
      <div class="catrow">
        ${cats.map((c) => html`<button class=${'chip' + (cat === c ? ' on' : '')} onClick=${() => setCat(c)}>
          ${c !== 'all' && html`<${Icon} name=${CATS[c].icon} size=${18} />`}
          ${c === 'all' ? t('all') : t('cat.' + c)}
        </button>`)}
      </div>
      ${(mapErr || loadError) && html`<div class="note bad">${mapErr ? t('mapError') : t('loadError')}</div>`}
    </div>

    ${selected && view === 'map' && html`<div class="sticker sheet">
      <div class="sheethead">
        <span class=${'dot tone-' + (CATS[selected.category] || CATS.sports).tone}>
          <${Icon} name=${(CATS[selected.category] || CATS.sports).icon} />
        </span>
        <span class="pinfo">
          <span class="pname">${pname(selected, lang)}</span>
          <span class="psub">${t('cat.' + selected.category)}</span>
        </span>
        <button class="sheetclose" aria-label=${t('close')} onClick=${() => setSel(null)}>
          <${Icon} name="close" />
        </button>
      </div>
      ${selected.opening_hours && html`<div class="meta"><${Icon} name="clock" size=${18} /> ${selected.opening_hours}</div>`}
      <div class="row2">
        <a class="btn btn-dark btn-small" target="_blank" rel="noopener"
          href=${'https://www.google.com/maps/search/?api=1&query=' + selected.lat + ',' + selected.lon}>
          <${Icon} name="external" size=${18} /> ${t('openMaps')}
        </a>
        ${selected.phone && html`<a class="btn btn-small" href=${'tel:' + selected.phone}>
          <${Icon} name="phone" size=${18} /> ${t('call')}
        </a>`}
      </div>
      <a class="btn btn-small" href=${'#new/' + selected.id}><${Icon} name="plus" size=${18} /> ${t('planHere')}</a>
    </div>`}
  </div>`;
}

/* ---------- plans ---------- */
function PlansTab({ me, plans, err }) {
  const { t } = useApp();
  const mine = plans.filter((p) => (p.members || []).some((m) => m.user_id === me.id));
  const others = plans.filter((p) => !mine.includes(p));
  return html`<div class="screen">
    <div class="pagehead">
      <div class="h2">${t('nav.plans')}</div>
    </div>
    <a class="btn" href="#new"><${Icon} name="plus" size=${22} /> ${t('createPlan')}</a>
    ${err && html`<div class="note bad">${t('plansError')}</div>`}
    ${plans.length === 0 && !err && html`<div class="sticker empty"><${Icon} name="plans" /> <span>${t('noPlans')}</span></div>`}
    ${mine.length > 0 && html`<div class="block">
      <div class="h2" style="font-size:22px">${t('yourPlans')}</div>
      <div class="stack">${mine.map((p) => html`<${PlanCard} p=${p} meId=${me.id} />`)}</div>
    </div>`}
    ${others.length > 0 && html`<div class="block">
      <div class="h2" style="font-size:22px">${t('comingUp')}</div>
      <div class="stack">${others.map((p) => html`<${PlanCard} p=${p} meId=${me.id} />`)}</div>
    </div>`}
  </div>`;
}

function PlanPage({ me, id, reloadPlans }) {
  const { t, lang } = useApp();
  const [plan, setPlan] = useState(undefined);
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const [a, b] = await Promise.all([
      sb.from('plans')
        .select('id,title,activity,description,starts_at,capacity,visibility,status,host_id,place:places(id,name,name_ar,category),host:profiles!plans_host_id_fkey(display_name,username)')
        .eq('id', id).maybeSingle(),
      sb.from('plan_members')
        .select('user_id,joined_at,profile:profiles(display_name,username)')
        .eq('plan_id', id).order('joined_at'),
    ]);
    setPlan(a.data || null);
    setMembers(b.data || []);
  }
  useEffect(() => { setPlan(undefined); load(); }, [id]);

  async function act(fn) {
    setBusy(true);
    setErr('');
    const res = await fn();
    setBusy(false);
    if (res && res.error) { setErr(joinError(t, res.error.message)); return false; }
    await Promise.all([load(), reloadPlans()]);
    return true;
  }

  const join = () => act(() => sb.rpc('join_plan', { p_plan_id: id }));
  const leave = () => {
    if (!confirm(t('confirmLeave'))) return;
    act(() => sb.from('plan_members').delete().eq('plan_id', id).eq('user_id', me.id));
  };
  const cancel = async () => {
    if (!confirm(t('confirmCancel'))) return;
    const ok = await act(() => sb.from('plans').update({ status: 'cancelled' }).eq('id', id));
    if (ok) go('plans');
  };

  if (plan === undefined) return html`<div class="screen"><div class="muted">${t('loading')}</div></div>`;
  if (plan === null) {
    return html`<div class="screen">
      <div class="pagehead"><${BackBtn} to="plans" /></div>
      <div class="note bad">${t('notFound')}</div>
    </div>`;
  }

  const n = members.length;
  const joined = members.some((m) => m.user_id === me.id);
  const isHost = plan.host_id === me.id;
  const isFull = n >= plan.capacity;
  const cancelled = plan.status === 'cancelled';
  const empties = Math.min(Math.max(plan.capacity - n, 0), 4);

  return html`<div class="screen">
    <div class="pagehead"><${BackBtn} to="plans" /></div>

    <div class="sticker hero">
      <div class="herorow">
        <span class=${'dot tone-' + (actTone(plan.activity) === 'pink' ? 'green' : 'pink')}><${Icon} name=${actIcon(plan.activity)} /></span>
        <span class="muted" style="color:var(--ink)">${t('cat.' + plan.activity)}</span>
      </div>
      <div class="title">${plan.title}</div>
      ${plan.place && html`<div class="herorow"><${Icon} name="pin" size=${22} />
        <a href=${'#explore/' + plan.place.id}>${pname(plan.place, lang)}</a></div>`}
      <div class="herorow"><${Icon} name="clock" size=${22} /> <span>${fmtWhen(plan.starts_at, lang, t)}</span></div>
      <div class="tags">
        <span class="tag"><${Icon} name="lock" size=${16} /> ${t('vis.' + plan.visibility)}</span>
        <span class="tag green">${n}/${plan.capacity} ${t('going')}</span>
      </div>
      ${plan.host && html`<div class="muted" style="color:var(--ink)">${t('hostedBy')} ${plan.host.display_name}</div>`}
    </div>

    ${cancelled && html`<div class="note bad">${t('cancelled')}</div>`}

    <div class="sticker card">
      <div class="h2" style="font-size:22px">${t('whosIn')}</div>
      <div class="avatars">
        ${members.map((m, i) => {
          const name = m.profile ? m.profile.display_name : '?';
          return html`<div class="avcol">
            <div class=${'avatar tone-' + TONES[i % TONES.length]}>${initial(name)}</div>
            <div class="avname">${name}</div>
          </div>`;
        })}
        ${Array.from({ length: empties }).map(() => html`<div class="avcol">
          <div class="avatar empty"><${Icon} name="plus" size=${20} /></div>
          <div class="avname">${t('open')}</div>
        </div>`)}
      </div>
    </div>

    ${err && html`<div class="note bad">${err}</div>`}

    ${!cancelled && html`<div class="stack">
      ${joined
        ? html`<a class="btn" href=${'#chat/' + id}><${Icon} name="chat" size=${22} /> ${t('openChat')}</a>`
        : html`<div class="note">${t('chatWhenJoin')}</div>
               <button class="btn" disabled=${busy || isFull} onClick=${join}>
                 ${isFull ? t('full') : busy ? t('loading') : t('join')}
               </button>`}
      ${joined && !isHost && html`<button class="btn btn-dark btn-small" disabled=${busy} onClick=${leave}>${t('leave')}</button>`}
      ${isHost && html`<button class="btn btn-dark btn-small" disabled=${busy} onClick=${cancel}>${t('cancelPlan')}</button>`}
    </div>`}
  </div>`;
}

function NewPlan({ me, places, presetPlaceId, reloadPlans }) {
  const { t, lang } = useApp();
  const [title, setTitle] = useState('');
  const [activity, setActivity] = useState('coffee');
  const [placeId, setPlaceId] = useState(presetPlaceId || null);
  const [pq, setPq] = useState('');
  const [when, setWhen] = useState(defaultWhen());
  const [cap, setCap] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const place = useMemo(() => places.find((p) => p.id === placeId) || null, [places, placeId]);
  useEffect(() => {
    if (presetPlaceId) setPlaceId(presetPlaceId);
  }, [presetPlaceId]);
  useEffect(() => {
    if (place && ACTIVITIES.includes(place.category)) setActivity(place.category);
  }, [placeId]);

  const matches = useMemo(() => {
    const s = pq.trim().toLowerCase();
    if (!s) return [];
    return places.filter((p) => (p.name + ' ' + (p.name_ar || '')).toLowerCase().includes(s)).slice(0, 6);
  }, [places, pq]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const ttl = title.trim();
    if (ttl.length < 2 || ttl.length > 60) return setErr(t('errPlanTitle'));
    if (!placeId) return setErr(t('errPlanPlace'));
    const startsAt = new Date(when);
    if (isNaN(startsAt) || startsAt.getTime() <= Date.now()) return setErr(t('errPlanWhen'));

    setBusy(true);
    const id = crypto.randomUUID();
    const { error } = await sb.from('plans').insert({
      id, host_id: me.id, kind: 'plan', title: ttl, activity, place_id: placeId,
      starts_at: startsAt.toISOString(), capacity: cap, visibility: 'public',
    });
    if (error) { setBusy(false); return setErr(error.message); }
    await reloadPlans();
    setBusy(false);
    go('plan/' + id);
  }

  return html`<form class="page" onSubmit=${submit}>
    <div class="pagehead">
      <${BackBtn} to="plans" />
      <div class="h2">${t('createPlan')}</div>
    </div>

    <label class="label">${t('newTitle')}
      <input class="input" value=${title} maxlength="60" placeholder=${t('newTitleHint')}
        onInput=${(e) => setTitle(e.target.value)} />
    </label>

    <div class="block">
      <div class="label">${t('doing')}</div>
      <div class="chips">
        ${ACTIVITIES.map((a) => html`<button type="button" class=${'chip' + (activity === a ? ' on' : '')}
          onClick=${() => setActivity(a)}><${Icon} name=${actIcon(a)} size=${18} /> ${t('cat.' + a)}</button>`)}
      </div>
    </div>

    <div class="block">
      <div class="label">${t('where')}</div>
      ${place
        ? html`<div class="chips"><button type="button" class="chip on" onClick=${() => setPlaceId(null)}>
            <${Icon} name="pin" size=${18} /> ${pname(place, lang)} <${Icon} name="close" size=${16} /></button></div>`
        : html`<input class="input" value=${pq} placeholder=${t('placeSearch')} onInput=${(e) => setPq(e.target.value)} />
               <div class="stack">
                 ${matches.map((p) => html`<button type="button" class="sticker pcard" onClick=${() => { setPlaceId(p.id); setPq(''); }}>
                   <span class=${'dot tone-' + (CATS[p.category] || CATS.sports).tone}><${Icon} name=${(CATS[p.category] || CATS.sports).icon} /></span>
                   <span class="pinfo"><span class="pname">${pname(p, lang)}</span><span class="psub">${t('cat.' + p.category)}</span></span>
                 </button>`)}
               </div>`}
    </div>

    <label class="label">${t('when')}
      <input class="input" type="datetime-local" value=${when} min=${toLocalInput(new Date())}
        onInput=${(e) => setWhen(e.target.value)} />
    </label>

    <div class="block">
      <div class="label">${t('howMany')}</div>
      <div class="stepper">
        <button type="button" aria-label="-" onClick=${() => setCap(Math.max(2, cap - 1))}><${Icon} name="minus" /></button>
        <span class="num">${cap}</span>
        <button type="button" aria-label="+" onClick=${() => setCap(Math.min(30, cap + 1))}><${Icon} name="plus" /></button>
      </div>
    </div>

    <div class="block">
      <div class="label">${t('whoJoin')}</div>
      <div class="chips">
        <button type="button" class="chip on">${t('vis.public')}</button>
        <button type="button" class="chip" disabled>${t('vis.friends')}</button>
        <button type="button" class="chip" disabled>${t('vis.invite')}</button>
      </div>
      <div class="hint">${t('publicHint')}</div>
    </div>

    ${err && html`<div class="note bad">${err}</div>`}
    <button class="btn" type="submit" disabled=${busy}>${busy ? t('loading') : t('create')}</button>
  </form>`;
}

/* ---------- chat ---------- */
function ChatPage({ me, id }) {
  const { t, lang } = useApp();
  const [plan, setPlan] = useState(undefined);
  const [members, setMembers] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);

  async function load() {
    const nowIso = new Date().toISOString();
    const [a, b, c] = await Promise.all([
      sb.from('plans').select('id,title,status').eq('id', id).maybeSingle(),
      sb.from('plan_members').select('user_id,profile:profiles(display_name)').eq('plan_id', id),
      sb.from('messages').select('id,user_id,body,created_at').eq('plan_id', id)
        .gt('expires_at', nowIso).order('created_at').limit(300),
    ]);
    setPlan(a.data || null);
    setMembers(b.data || []);
    if (!c.error) setMsgs(c.data || []);
  }

  useEffect(() => {
    setPlan(undefined);
    load();
    const channel = sb.channel('chat-' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'plan_id=eq.' + id }, () => load())
      .subscribe();
    const poll = setInterval(load, 6000); // backup in case realtime is slow
    return () => { clearInterval(poll); sb.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ block: 'end' });
  }, [msgs.length]);

  const names = useMemo(() => {
    const m = {};
    members.forEach((x) => { m[x.user_id] = x.profile ? x.profile.display_name : '?'; });
    return m;
  }, [members]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr('');
    setText('');
    const { error } = await sb.from('messages').insert({ plan_id: id, user_id: me.id, body });
    setSending(false);
    if (error) { setErr(error.message); setText(body); return; }
    load();
  }

  const isMember = members.some((m) => m.user_id === me.id);

  if (plan === undefined) return html`<div class="chat"><div class="chathead"><div class="muted">${t('loading')}</div></div></div>`;
  if (plan === null) {
    return html`<div class="chat"><div class="chathead">
      <div class="pagehead"><${BackBtn} to="plans" /></div>
      <div class="note bad">${t('notFound')}</div>
    </div></div>`;
  }

  return html`<div class="chat">
    <div class="wm" aria-hidden="true"></div>
    <div class="chathead">
      <div class="pagehead" style="justify-content:flex-start">
        <${BackBtn} to=${'plan/' + id} />
        <div>
          <div class="h2" style="font-size:22px">${plan.title}</div>
          <div class="muted">${members.map((m) => (m.profile ? m.profile.display_name : '?')).join(', ')}</div>
        </div>
      </div>
      <div class="chatnote"><${Icon} name="clock" size=${18} /> ${t('chatNotice')}</div>
    </div>

    <div class="msgs">
      ${!isMember && html`<div class="note">${t('chatNeedJoin')}</div>`}
      ${isMember && msgs.length === 0 && html`<div class="muted" style="text-align:center;margin-top:12px">${t('noMessages')}</div>`}
      ${msgs.map((m) => html`<div class=${'bubble' + (m.user_id === me.id ? ' mine' : '')}>
        <div class="bname">${names[m.user_id] || '...'}</div>
        <div class="btext">${m.body}</div>
        <div class="btime">${fmtTime(m.created_at, lang)}</div>
      </div>`)}
      <div ref=${endRef}></div>
    </div>

    ${err && html`<div class="note bad" style="margin:0 16px;position:relative;z-index:1">${err}</div>`}
    ${isMember && html`<form class="composer" onSubmit=${send}>
      <input class="input" value=${text} maxlength="1000" placeholder=${t('msgPlaceholder')}
        onInput=${(e) => setText(e.target.value)} />
      <button class="sendbtn" type="submit" aria-label=${t('send')} disabled=${sending || !text.trim()}>
        <${Icon} name="send" />
      </button>
    </form>`}
  </div>`;
}

/* ---------- other tabs ---------- */
function ComingSoon({ tab }) {
  const { t } = useApp();
  return html`<div class="screen">
    <div class="h2">${t('nav.' + tab)}</div>
    <div class="sticker empty"><${Icon} name=${tab} /> <span>${t('comingSoon')}</span></div>
  </div>`;
}

function Profile({ me }) {
  const { t, lang, setLang } = useApp();
  return html`<div class="screen">
    <div class="sticker" style="padding:18px;display:flex;flex-direction:column;gap:4px">
      <div class="h2">${me.display_name}</div>
      <div class="muted">@${me.username}</div>
    </div>
    <div class="block">
      <div class="h2" style="font-size:20px">${t('language')}</div>
      <div class="chips">
        <button class=${'chip' + (lang === 'en' ? ' on' : '')} onClick=${() => setLang('en')}>English</button>
        <button class=${'chip' + (lang === 'ar' ? ' on' : '')} onClick=${() => setLang('ar')}>العربية</button>
      </div>
    </div>
    <button class="btn btn-dark" onClick=${() => sb.auth.signOut()}>
      <${Icon} name="logout" /> ${t('signOut')}
    </button>
  </div>`;
}

/* ---------- shell ---------- */
function Shell({ me, route }) {
  const [places, setPlaces] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [plans, setPlans] = useState([]);
  const [plansErr, setPlansErr] = useState(false);
  const [tab, id] = route.split('/');

  useEffect(() => {
    sb.from('places')
      .select('id,name,name_ar,category,lat,lon,address,opening_hours,phone,website,instagram,is_new_until')
      .eq('status', 'approved')
      .limit(1000)
      .then(({ data, error }) => {
        if (error) setLoadError(true);
        else setPlaces(data || []);
      });
  }, []);

  async function loadPlans() {
    const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const { data, error } = await sb.from('plans').select(PLAN_COLS)
      .eq('status', 'open').gte('starts_at', since).order('starts_at').limit(100);
    if (error) { setPlansErr(true); return; }
    setPlansErr(false);
    setPlans(data || []);
  }
  useEffect(() => {
    loadPlans();
    const timer = setInterval(loadPlans, 30000);
    return () => clearInterval(timer);
  }, []);

  let body;
  let navTab = tab;
  let showNav = true;
  if (tab === 'explore') body = html`<${Explore} places=${places} initialId=${id || null} loadError=${loadError} />`;
  else if (tab === 'plans') body = html`<${PlansTab} me=${me} plans=${plans} err=${plansErr} />`;
  else if (tab === 'plan' && id) { body = html`<${PlanPage} me=${me} id=${id} reloadPlans=${loadPlans} />`; navTab = 'plans'; }
  else if (tab === 'new') { body = html`<${NewPlan} me=${me} places=${places} presetPlaceId=${id || null} reloadPlans=${loadPlans} />`; navTab = 'plans'; showNav = false; }
  else if (tab === 'chat' && id) { body = html`<${ChatPage} me=${me} id=${id} />`; navTab = 'plans'; showNav = false; }
  else if (tab === 'friends') body = html`<${ComingSoon} tab=${tab} />`;
  else if (tab === 'profile') body = html`<${Profile} me=${me} />`;
  else { body = html`<${Home} me=${me} places=${places} plans=${plans} loadError=${loadError} />`; navTab = 'home'; }

  return html`<div style="height:100%">${body}${showNav && html`<${Nav} tab=${navTab} />`}</div>`;
}

/* ---------- app root ---------- */
function App() {
  const [lang, setLangState] = useState(
    localStorage.getItem('lang') || ((navigator.language || '').startsWith('ar') ? 'ar' : 'en')
  );
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(undefined);
  const [route, setRoute] = useState(location.hash.slice(1) || 'home');

  const setLang = (l) => { localStorage.setItem('lang', l); setLangState(l); };
  const t = (k) => (T[lang] && T[lang][k]) || T.en[k] || k;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || 'home');
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function loadMe(uid) {
    const [a, b] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      sb.from('profile_private').select('id').eq('id', uid).maybeSingle(),
    ]);
    setMe(a.data && b.data ? a.data : null); // null = needs onboarding
  }

  const uid = session && session.user ? session.user.id : null;
  useEffect(() => {
    if (uid) { setMe(undefined); loadMe(uid); }
    else setMe(undefined);
  }, [uid]);

  let screen;
  if (session === undefined) screen = html`<${Splash} />`;
  else if (!session) screen = html`<${AuthScreen} />`;
  else if (me === undefined) screen = html`<${Splash} />`;
  else if (me === null) screen = html`<${Onboarding} session=${session} onDone=${() => loadMe(uid)} />`;
  else screen = html`<${Shell} me=${me} route=${route} />`;

  APP = { t, lang, setLang };
  return screen;
}

render(html`<${App} />`, document.getElementById('app'));
window.__mounted = true;
const boot = document.getElementById('boot');
if (boot) boot.remove();
