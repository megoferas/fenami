import { html, render, useState, useEffect, useMemo, useRef } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
import { SUPABASE_URL, SUPABASE_KEY, MAP_STYLE, MAP_CENTER, MAPLIBRE_JS, MAPLIBRE_CSS } from './config.js';
import { T } from './i18n.js';
import { Icon, iconSvg, CATS, CAT_ORDER, INTERESTS } from './icons.js';

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
const pname = (p, lang) => (lang === 'ar' ? p.name_ar || p.name : p.name);
const today = () => new Date().toISOString().slice(0, 10);
const INTEREST_MAP = Object.fromEntries(INTERESTS.map((i) => [i.id, i.cats]));

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
    <div class="tag">${t('tagline')}</div>
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
function Home({ me, places, loadError }) {
  const { t } = useApp();
  const now = today();

  const fresh = useMemo(() => places.filter((p) => p.is_new_until && p.is_new_until >= now).slice(0, 6), [places]);

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
      <div class="sticker empty"><${Icon} name="plans" /> <span>${t('tonightEmpty')}</span></div>
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

  // create the map when the map view is shown
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

  // draw the sticker pins
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

  // fly to the selected place
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
      <button class="btn btn-small" disabled>${t('planHere')}</button>
    </div>`}
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

  let body;
  if (tab === 'explore') body = html`<${Explore} places=${places} initialId=${id || null} loadError=${loadError} />`;
  else if (tab === 'plans' || tab === 'friends') body = html`<${ComingSoon} tab=${tab} />`;
  else if (tab === 'profile') body = html`<${Profile} me=${me} />`;
  else body = html`<${Home} me=${me} places=${places} loadError=${loadError} />`;

  return html`<div style="height:100%">${body}<${Nav} tab=${tab} /></div>`;
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
