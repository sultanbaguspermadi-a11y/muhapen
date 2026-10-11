import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, BookMarked, BookOpen, Bookmark, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Code2, Copy, Download,
  FileDown, FileUp, Gauge, GraduationCap, Heart, History, Home, Info, Languages, ListChecks,
  Menu, Moon, MoreHorizontal, Palette, PanelLeft, RotateCcw, Search, Settings, Share2,
  ShieldCheck, Sparkles, Sun, Wrench, X, Zap, Calculator, Bike, CarFront, CheckCheck,
  RefreshCw, VolumeX, Laptop, SlidersHorizontal, Brain, Shuffle, Flame, Trophy, Type,
  CircleCheck, Clipboard, ArrowUpRight, House, BookText
} from 'lucide-react';
import config from './data/config.json';
import { db, readMeta, writeMeta } from './db';
import { normalizeArabic, normalizeText, stripHarakat, todayKey, wordSearchBlob } from './arabic';

const TRACK_ICONS = { RPL: Code2, Akuntansi: Calculator, TBKR: CarFront, TSM: Bike, Umum: BookOpen };
const LOADERS = {
  RPL: () => import('./data/rpl.json'),
  Akuntansi: () => import('./data/akuntansi.json'),
  TBKR: () => import('./data/tbkr.json'),
  TSM: () => import('./data/tsm.json'),
  Umum: () => import('./data/umum.json')
};
const NAV = [
  { id: 'search', label: 'Cari', icon: Search },
  { id: 'learn', label: 'Belajar', icon: GraduationCap },
  { id: 'favorites', label: 'Favorit', icon: Bookmark },
  { id: 'settings', label: 'Pengaturan', icon: Settings }
];
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const greeting = () => {
  const h = new Date().getHours();
  if (h < 10) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
};
const dateLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

function makeQuiz(words) {
  const candidates = shuffle(words.filter(w => w.id_text && w.ar)).slice(0, 5);
  return candidates.map(word => {
    const other = shuffle(words.filter(w => w.id !== word.id && w.id_text !== word.id_text)).slice(0, 3);
    const options = shuffle([word, ...other]).map(w => ({ id: w.id, text: w.id_text }));
    return { word, options, answer: word.id };
  });
}

function IconButton({ icon: Icon, label, onClick, className = '', title, disabled = false }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={title || label} onClick={onClick} disabled={disabled}><Icon size={19} strokeWidth={1.8} /></button>;
}

function App() {
  const [activeTrack, setActiveTrack] = useState(config.app.defaultTrack);
  const [page, setPage] = useState('search');
  const [loaded, setLoaded] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selectedWord, setSelectedWord] = useState(null);
  const [showTracks, setShowTracks] = useState(false);
  const [showHarakat, setShowHarakat] = useState(config.arabic.showHarakat);
  const [showLatin, setShowLatin] = useState(config.arabic.showTransliteration);
  const [arabicSize, setArabicSize] = useState(config.arabic.fontSize);
  const [themeMode, setThemeMode] = useState(config.theme.mode);
  const [bookmarkIds, setBookmarkIds] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [progress, setProgress] = useState([]);
  const [streak, setStreak] = useState(0);
  const [dailyDone, setDailyDone] = useState(false);
  const [learnMode, setLearnMode] = useState('flashcards');
  const [deck, setDeck] = useState([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quiz, setQuiz] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [lettersWord, setLettersWord] = useState(null);
  const [letterChoices, setLetterChoices] = useState([]);
  const [letterAnswer, setLetterAnswer] = useState([]);
  const [letterChecked, setLetterChecked] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [settingsReady, setSettingsReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [toast, setToast] = useState('');
  const importInput = useRef(null);
  const searchRef = useRef(null);
  const touchStartY = useRef(null);

  const activeInfo = config.tracks.find(t => t.id === activeTrack) || config.tracks[0];
  const AccentIcon = TRACK_ICONS[activeTrack] || BookOpen;

  useEffect(() => {
    let live = true;
    setLoading(true);
    const tracksToLoad = activeTrack === 'Umum' ? ['Umum'] : [activeTrack, 'Umum'];
    Promise.all(tracksToLoad.filter(t => !loaded[t]).map(async t => [t, await LOADERS[t]()]))
      .then(pairs => {
        if (!live) return;
        if (pairs.length) setLoaded(prev => ({ ...prev, ...Object.fromEntries(pairs.map(([k, mod]) => [k, mod.default])) }));
        setLoading(false);
      })
      .catch(() => { if (live) { setLoading(false); notify('Data belum berhasil dimuat. Muat ulang aplikasi.'); } });
    return () => { live = false; };
  // loaded is deliberately included so the selected track is lazily imported once.
  }, [activeTrack, loaded]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [marks, hist, prog, storedTheme, storedHarakat, storedLatin, storedSize, storedTrack] = await Promise.all([
          db.bookmarks.toArray(), db.history.orderBy('viewedAt').reverse().limit(12).toArray(), db.progress.toArray(),
          readMeta('themeMode', config.theme.mode), readMeta('showHarakat', config.arabic.showHarakat),
          readMeta('showLatin', config.arabic.showTransliteration), readMeta('arabicSize', config.arabic.fontSize), readMeta('activeTrack', config.app.defaultTrack)
        ]);
        if (!live) return;
        setBookmarkIds(new Set(marks.map(x => x.id)));
        setHistory(hist);
        setProgress(prog);
        setThemeMode(storedTheme || config.theme.mode);
        setShowHarakat(storedHarakat ?? config.arabic.showHarakat);
        setShowLatin(storedLatin ?? config.arabic.showTransliteration);
        setArabicSize(storedSize || config.arabic.fontSize);
        if (storedTrack && config.tracks.some(t => t.id === storedTrack)) setActiveTrack(storedTrack);
        const today = todayKey();
        const lastSeen = await readMeta('lastSeen', null);
        let currentStreak = await readMeta('streak', 0);
        if (lastSeen !== today) {
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
          currentStreak = lastSeen === todayKey(yesterday) ? currentStreak + 1 : 1;
          await writeMeta('streak', currentStreak);
          await writeMeta('lastSeen', today);
        }
        setStreak(currentStreak);
        setDailyDone((await readMeta(`daily-${today}`, false)) === true);
      } catch (error) {
        console.warn('SakuArab local data init:', error);
      } finally { if (live) setSettingsReady(true); }
    })();
    import('./data/similar.json').then(m => { if (live) setSimilar(m.default); }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const id = window.setInterval(() => setPlaceholderIndex(i => (i + 1) % 3), 3200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const onShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPage('search'); window.setTimeout(() => searchRef.current?.focus(), 40); }
      if (e.key === 'Escape') { setSelectedWord(null); setShowTracks(false); }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', activeInfo.accent || '#6366F1');
    root.style.setProperty('--arabic-size', `${arabicSize}px`);
    const mode = themeMode === 'auto' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : themeMode;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  }, [activeInfo.accent, arabicSize, themeMode]);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2300);
  }, []);

  const activeWords = loaded[activeTrack] || [];
  const generalWords = loaded.Umum || [];
  const searchableWords = useMemo(() => {
    const combined = activeTrack === 'Umum' ? activeWords : [...activeWords, ...generalWords];
    return combined.map(w => ({ ...w, _search: wordSearchBlob(w) }));
  }, [activeWords, generalWords, activeTrack]);
  const fuse = useMemo(() => new Fuse(searchableWords, {
    includeScore: true,
    threshold: 0.34,
    ignoreLocation: true,
    keys: [{ name: '_search', weight: 0.78 }, { name: 'ar', weight: 0.16 }, { name: 'id_text', weight: 0.06 }]
  }), [searchableWords]);
  const filteredWords = useMemo(() => {
    let result = query.trim() ? fuse.search(/[\u0600-\u06FF]/.test(query) ? normalizeArabic(query) : normalizeText(query)).map(x => x.item) : searchableWords;
    if (category) result = result.filter(w => w.category === category);
    return result;
  }, [query, category, fuse, searchableWords]);
  const categories = useMemo(() => {
    const map = new Map();
    activeWords.forEach(w => map.set(w.category, (map.get(w.category) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [activeWords]);
  const dayIndex = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const dailyWord = searchableWords.length ? searchableWords[dayIndex % searchableWords.length] : null;
  const bookmarkedWords = useMemo(() => {
    const all = [...Object.values(loaded).flat()];
    const lookup = new Map(all.map(w => [w.id, w]));
    return [...bookmarkIds].map(id => lookup.get(id)).filter(Boolean);
  }, [bookmarkIds, loaded]);
  const currentDeckWord = deck[deckIndex] || null;
  const currentQuiz = quiz[quizIndex] || null;

  const savePreference = async (key, value) => {
    await writeMeta(key, value);
  };

  const changeTrack = async (track) => {
    setActiveTrack(track);
    setQuery(''); setCategory(''); setShowTracks(false);
    await savePreference('activeTrack', track);
    setPage('search');
  };

  const openWord = async (word) => {
    setSelectedWord(word);
    try {
      await db.history.add({ id: word.id, track: word.track, viewedAt: Date.now() });
      const hist = await db.history.orderBy('viewedAt').reverse().limit(12).toArray();
      setHistory(hist);
    } catch {}
  };

  const toggleBookmark = async (word) => {
    const isSaved = bookmarkIds.has(word.id);
    const next = new Set(bookmarkIds);
    if (isSaved) { next.delete(word.id); await db.bookmarks.delete(word.id); notify('Dihapus dari favorit'); }
    else { next.add(word.id); await db.bookmarks.put({ id: word.id, track: word.track, updatedAt: Date.now() }); notify('Disimpan ke favorit'); }
    setBookmarkIds(next);
  };

  const markReviewed = async (word, known) => {
    const old = await db.progress.get(word.id);
    const intervalDays = known ? Math.min((old?.intervalDays || 0) ? old.intervalDays * 2 : 1, 30) : 0;
    const record = { id: word.id, track: word.track, repetitions: (old?.repetitions || 0) + 1, intervalDays,
      dueAt: Date.now() + intervalDays * 86400000, lastReviewed: Date.now(), known: Boolean(known) };
    await db.progress.put(record);
    setProgress(await db.progress.toArray());
  };

  const finishDaily = async () => {
    const today = todayKey();
    await writeMeta(`daily-${today}`, true);
    setDailyDone(true);
    notify('Kata hari ini selesai dipelajari!');
    if (dailyWord) await markReviewed(dailyWord, true);
  };

  const startFlashcards = () => {
    setDeck(shuffle(activeWords).slice(0, Math.min(activeWords.length, 30)));
    setDeckIndex(0); setFlipped(false); setLearnMode('flashcards'); setPage('learn');
  };
  const startQuiz = () => {
    setQuiz(makeQuiz(activeWords)); setQuizIndex(0); setQuizAnswers({}); setLearnMode('quiz'); setPage('learn');
  };
  const startLetters = () => {
    const pool = shuffle(activeWords.filter(w => stripHarakat(w.ar).replace(/\s/g, '').length >= 3));
    const word = pool[0] || activeWords[0];
    loadLettersFor(word); setLearnMode('letters'); setPage('learn');
  };
  const loadLettersFor = (word) => {
    setLettersWord(word);
    const chars = [...stripHarakat(word.ar).replace(/\s/g, '')];
    setLetterChoices(shuffle(chars.map((letter, i) => ({ key: `${i}-${letter}`, letter }))));
    setLetterAnswer([]); setLetterChecked(false);
  };

  const copyWord = async (word) => {
    const text = `${word.ar}\n${word.latin}\n${word.id_text}\n${word.example?.ar || ''}\n${word.example?.id || ''}`;
    try { await navigator.clipboard.writeText(text); notify('Kartu kata disalin'); }
    catch { notify('Salin tidak didukung di browser ini'); }
  };

  const createShareImage = async (word) => {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, activeInfo.accent); gradient.addColorStop(1, '#111827');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,.11)'; ctx.beginPath(); ctx.roundRect(58, 58, 964, 1234, 38); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '700 46px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('SakuArab', 100, 145);
    ctx.font = '400 26px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.76)'; ctx.fillText(word.track, 100, 195);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = `700 ${Math.min(arabicSize * 2.35, 92)}px "Noto Naskh Arabic", Amiri, serif`; ctx.direction = 'rtl';
    ctx.fillText(showHarakat ? word.ar : stripHarakat(word.ar), 540, 475, 850);
    ctx.direction = 'ltr'; ctx.font = '500 34px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.78)';
    if (showLatin) ctx.fillText(word.latin, 540, 555, 850);
    ctx.font = '700 48px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; wrapCanvasText(ctx, word.id_text, 540, showLatin ? 650 : 600, 820, 60);
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '400 28px Inter, sans-serif';
    const ex = word.example?.id || '';
    wrapCanvasText(ctx, ex, 540, 855, 820, 44);
    ctx.fillStyle = 'rgba(255,255,255,.68)'; ctx.font = '400 22px Inter, sans-serif'; ctx.fillText('Arab buat dunia kerja, bukan cuma hafalan.', 540, 1190);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Canvas export failed');
    const file = new File([blob], `sakua-rab-${word.id}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `SakuArab: ${word.id_text}`, text: `${word.ar} — ${word.id_text}` });
    else {
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url);
      notify('Gambar kartu kata diunduh untuk dibagikan');
    }
  };

  const exportData = async () => {
    const payload = { app: 'SakuArab', version: 1, exportedAt: new Date().toISOString(), bookmarks: await db.bookmarks.toArray(), progress: await db.progress.toArray(), history: await db.history.toArray(), meta: await db.meta.toArray() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `sakua-rab-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(url);
    notify('Cadangan progres diekspor');
  };

  const importData = async (file) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.app !== 'SakuArab') throw new Error('Format bukan ekspor SakuArab');
      await db.transaction('rw', db.bookmarks, db.progress, db.history, db.meta, async () => {
        await db.bookmarks.clear(); await db.progress.clear(); await db.history.clear(); await db.meta.clear();
        if (payload.bookmarks?.length) await db.bookmarks.bulkPut(payload.bookmarks);
        if (payload.progress?.length) await db.progress.bulkPut(payload.progress);
        if (payload.history?.length) await db.history.bulkPut(payload.history);
        if (payload.meta?.length) await db.meta.bulkPut(payload.meta);
      });
      setBookmarkIds(new Set((payload.bookmarks || []).map(x => x.id)));
      setProgress(payload.progress || []); setHistory(payload.history || []);
      setThemeMode(await readMeta('themeMode', config.theme.mode));
      notify('Data berhasil diimpor');
    } catch (error) { notify(error.message || 'File tidak dapat diimpor'); }
  };

  const selectNav = (id) => { setPage(id); setQuery(''); setCategory(''); setSelectedWord(null); };
  const beginSearch = () => { setPage('search'); window.setTimeout(() => searchRef.current?.focus(), 60); };
  const selectedIsBookmarked = selectedWord ? bookmarkIds.has(selectedWord.id) : false;
  const progressPercent = activeWords.length ? Math.round((progress.filter(p => p.track === activeTrack && p.known).length / activeWords.length) * 100) : 0;
  const learnedCount = progress.filter(p => p.track === activeTrack && p.known).length;
  const quizScore = quiz.reduce((score, q, i) => score + (quizAnswers[i] === q.answer ? 1 : 0), 0);

  const renderWordCard = (word, index) => (
    <button key={word.id} className="word-card" onClick={() => openWord(word)} style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}>
      <div className="word-card-top"><span className="word-category">{word.category}</span><span className="word-card-actions">{bookmarkIds.has(word.id) && <Bookmark size={15} fill="currentColor" />}</span></div>
      <div className="word-ar" dir="rtl">{showHarakat ? word.ar : stripHarakat(word.ar)}</div>
      {showLatin && <div className="word-latin">{word.latin}</div>}
      <div className="word-meaning">{word.id_text}</div>
      <div className="word-card-footer"><span>{word.track === 'Umum' ? 'Umum' : word.track}</span><ArrowUpRight size={15} /></div>
    </button>
  );

  const wordResults = (words, emptyTitle = 'Belum ada kosakata', emptySub = 'Coba kata lain atau ganti jurusan.') => (
    words.length ? <div className="word-grid">{words.slice(0, 80).map(renderWordCard)}</div> : <div className="empty-state"><div className="empty-icon"><Search size={25} /></div><strong>{emptyTitle}</strong><span>{emptySub}</span></div>
  );

  return (
    <div className="app-shell" style={{ '--accent': activeInfo.accent }}>
      <aside className="desktop-sidebar">
        <button className="brand-lockup" onClick={() => selectNav('search')}><span className="brand-mark"><BookOpen size={23} /></span><span><strong>SakuArab</strong><small>Kamus Arab Vokasi</small></span></button>
        <div className="sidebar-label">MENU UTAMA</div>
        <nav className="side-nav">{NAV.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => selectNav(item.id)}><Icon size={19} /><span>{item.label}</span>{item.id === 'favorites' && bookmarkIds.size > 0 && <small className="nav-count">{bookmarkIds.size}</small>}</button>; })}</nav>
        <div className="sidebar-label track-label">JALUR BELAJAR</div>
        <div className="side-tracks">{config.tracks.map(t => { const Icon = TRACK_ICONS[t.id]; return <button key={t.id} className={`track-item ${activeTrack === t.id ? 'active' : ''}`} onClick={() => changeTrack(t.id)}><span className="track-dot" style={{ background: t.accent }}><Icon size={15} /></span><span>{t.shortName}</span><small>{t.id === 'Akuntansi' ? 'Akuntansi' : t.name.replace('Rekayasa Perangkat Lunak', 'Software').replace('Teknik Bodi Kendaraan Ringan', 'Bodi Kendaraan').replace('Teknik Sepeda Motor', 'Sepeda Motor').replace('Kosakata Umum', 'Kata Umum')}</small></button>; })}</div>
        <div className="sidebar-spacer" />
        <div className="sidebar-streak"><span className="streak-icon"><Flame size={18} /></span><div><strong>{streak} hari streak</strong><small>Jaga ritme belajarmu</small></div></div>
        <div className="sidebar-foot"><span className="status-dot" /> Offline-ready <span>·</span> v1.0</div>
      </aside>

      <main className="main-area">
        <header className="topbar glass-panel">
          <div className="topbar-left">
            <div className="mobile-brand"><span className="brand-mark"><BookOpen size={20} /></span><strong>SakuArab</strong></div>
            <div className="desktop-date"><span>{dateLabel}</span><span className="date-dot">·</span><span>Belajar sedikit, konsisten</span></div>
          </div>
          <div className="topbar-actions">
            <button className="streak-chip" onClick={() => setPage('learn')}><Flame size={16} /><strong>{streak}</strong><span>hari</span></button>
            <button className="track-switcher" onClick={() => setShowTracks(true)}><span className="track-switch-icon"><AccentIcon size={16} /></span><span>{activeInfo.shortName}</span><ChevronDown size={15} /></button>
            <IconButton icon={themeMode === 'light' ? Moon : Sun} label="Ganti tampilan" onClick={() => { const next = themeMode === 'dark' ? 'light' : 'dark'; setThemeMode(next); savePreference('themeMode', next); }} className="theme-quick" />
          </div>
        </header>

        <div className="page-wrap">
          {page === 'search' && <>
            <section className="welcome-section">
              <div className="welcome-copy"><div className="eyebrow"><Sparkles size={13} /> KAMUS SAKU DIGITAL</div><h1>{greeting()}, pelajar! <span className="wave">✦</span></h1><p>Arab buat dunia kerja, bukan cuma hafalan.</p></div>
              <div className="welcome-stat"><div className="stat-ring"><BookMarked size={19} /></div><div><strong>{activeWords.length.toLocaleString('id-ID')}</strong><span>kata {activeInfo.shortName}</span></div></div>
            </section>

            <section className="search-section sticky-search">
              <div className="search-field"><Search size={21} /><input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setCategory(''); }} placeholder={['coba: server, jurnal, kampas rem…', 'ketik Arab, latin, atau Indonesia…', 'cari istilah sesuai jurusanmu…'][placeholderIndex]} aria-label="Cari kosakata" /><kbd>⌘ K</kbd>{query && <IconButton icon={X} label="Hapus pencarian" onClick={() => setQuery('')} />}</div>
              <div className="search-hints"><span>coba:</span>{['server', 'jurnal', 'kampas rem'].map((hint, i) => <button key={hint} onClick={() => { setQuery(hint); setCategory(''); }}>{hint}</button>)}<span className="hint-separator" /><span><Languages size={13} /> Arab · Latin · Indonesia</span></div>
            </section>

            {loading ? <div className="loading-state"><span className="spinner" /> Menyiapkan kamus…</div> : query.trim() || category ? <section className="content-section results-section"><div className="section-heading"><div><span className="section-kicker">HASIL PENCARIAN</span><h2>{filteredWords.length} hasil ditemukan</h2></div>{category && <button className="clear-filter" onClick={() => setCategory('')}>{category} <X size={14} /></button>}</div>{filteredWords.length ? <><div className="desktop-vocab-layout"><div className="desktop-vocab-list">{filteredWords.slice(0, 80).map((word, i) => <button key={word.id} className={`desktop-result-row ${((selectedWord && selectedWord.id === word.id) || (!selectedWord && i === 0)) ? 'selected' : ''}`} onClick={() => openWord(word)}><span className="desktop-result-ar" dir="rtl">{showHarakat ? word.ar : stripHarakat(word.ar)}</span><span className="desktop-result-copy"><strong>{word.id_text}</strong><small>{word.latin}</small><em>{word.category}</em></span><ChevronRight size={16} /></button>)}</div><aside className="desktop-word-detail">{(() => { const w = selectedWord && filteredWords.some(x => x.id === selectedWord.id) ? selectedWord : filteredWords[0]; return <><span className="word-category">{w.category}</span><div className="desktop-detail-ar" dir="rtl">{showHarakat ? w.ar : stripHarakat(w.ar)}</div>{showLatin && <div className="desktop-detail-latin">{w.latin}</div>}<h3>{w.id_text}</h3><div className="desktop-detail-example"><span>CONTOH KALIMAT</span><p className="desktop-detail-example-ar" dir="rtl">{showHarakat ? w.example?.ar : stripHarakat(w.example?.ar || '')}</p><p>{w.example?.id || 'Contoh belum tersedia.'}</p></div><div className="desktop-detail-actions"><button className={`secondary-button ${bookmarkIds.has(w.id) ? 'bookmark-action saved' : ''}`} onClick={() => toggleBookmark(w)}>{bookmarkIds.has(w.id) ? <BookMarked size={15} /> : <Bookmark size={15} />} Favorit</button><button className="secondary-button" onClick={() => copyWord(w)}><Copy size={15} /> Salin</button><button className="primary-button" onClick={() => createShareImage(w).catch(() => notify('Gagal membuat kartu gambar.'))}><Share2 size={15} /> Bagikan</button></div></>; })()}</aside></div><div className="mobile-vocab-results">{wordResults(filteredWords, 'Kata tidak ditemukan', 'Coba ejaan lain, istilah yang lebih pendek, atau jalur berbeda.')}</div></> : wordResults(filteredWords, 'Kata tidak ditemukan', 'Coba ejaan lain, istilah yang lebih pendek, atau jalur berbeda.')}</section> : <>
              <section className="daily-card" onClick={() => dailyWord && openWord(dailyWord)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && dailyWord && openWord(dailyWord)}>
                <div className="daily-glow glow-one" /><div className="daily-glow glow-two" />
                <div className="daily-top"><span className="daily-label"><Zap size={14} fill="currentColor" /> KATA HARI INI</span><span className="daily-date">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span></div>
                <div className="daily-content"><div className="daily-word-side"><div className="daily-ar" dir="rtl">{dailyWord ? (showHarakat ? dailyWord.ar : stripHarakat(dailyWord.ar)) : '—'}</div>{showLatin && <div className="daily-latin">{dailyWord?.latin}</div>}<div className="daily-meaning">{dailyWord?.id_text}</div></div><div className="daily-mark"><div className="daily-book-icon"><BookOpen size={26} /></div><span className="daily-open">Pelajari kata <ArrowRight size={14} /></span></div></div>
                <div className="daily-bottom"><span><Sparkles size={13} /> {dailyWord?.category || activeInfo.shortName}</span><button onClick={e => { e.stopPropagation(); finishDaily(); }} className={`daily-check ${dailyDone ? 'done' : ''}`}>{dailyDone ? <><CheckCircle2 size={15} /> Selesai hari ini</> : <>Tandai dipelajari <ArrowRight size={14} /></>}</button></div>
              </section>

              <section className="content-section category-section"><div className="section-heading"><div><span className="section-kicker">JELAJAHI KAMUS</span><h2>Kategori {activeInfo.shortName}</h2><p>Pilih topik yang ingin kamu kuasai.</p></div><button className="text-link" onClick={() => { setQuery(''); setCategory(''); }}>Semua kata <ArrowRight size={15} /></button></div>
                <div className="category-grid">{categories.slice(0, 8).map((cat, i) => <button key={cat.name} className="category-card" onClick={() => { setCategory(cat.name); setQuery(''); }}><span className={`category-icon icon-tone-${i % 4}`}>{[<Laptop size={18}/>, <Code2 size={18}/>, <ShieldCheck size={18}/>, <Wrench size={18}/>, <Activity size={18}/>, <BookText size={18}/>, <Gauge size={18}/>, <ListChecks size={18}/>][i % 8]}</span><span className="category-title">{cat.name}</span><span className="category-meta">{cat.count} kata <ArrowUpRight size={13} /></span></button>)}</div>
              </section>

              <section className="content-section continue-section"><div className="section-heading"><div><span className="section-kicker">PROGRESMU</span><h2>Lanjutkan belajar</h2></div><button className="text-link" onClick={() => setPage('learn')}>Buka ruang belajar <ArrowRight size={15} /></button></div><div className="continue-card"><div className="continue-icon"><GraduationCap size={22} /></div><div className="continue-main"><div className="continue-title-row"><strong>{activeInfo.name}</strong><span>{learnedCount} / {activeWords.length} kata</span></div><div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div><div className="continue-bottom"><span>{progressPercent ? `${progressPercent}% dikuasai` : 'Mulai sesi pertamamu hari ini'}</span><button onClick={startFlashcards}>Lanjutkan <ArrowRight size={14} /></button></div></div><div className="continue-percent">{progressPercent}<small>%</small></div></div></section>

              <section className="content-section recent-section"><div className="section-heading"><div><span className="section-kicker">TERAKHIR DIBUKA</span><h2>Jejak belajarmu</h2></div><button className="text-link" onClick={() => setPage('favorites')}>Koleksi saya <ArrowRight size={15} /></button></div>{history.length ? <div className="recent-list">{history.slice(0, 4).map((h, i) => { const w = [...Object.values(loaded).flat()].find(word => word.id === h.id); return w ? <button key={`${h.id}-${h.seq || i}`} className="recent-row" onClick={() => openWord(w)}><span className="recent-ar" dir="rtl">{showHarakat ? w.ar : stripHarakat(w.ar)}</span><span className="recent-info"><strong>{w.id_text}</strong><small>{w.latin}</small></span><ChevronRight size={17} /></button> : null; })}</div> : <div className="subtle-empty"><History size={18} /><span>Kata yang kamu buka akan muncul di sini.</span></div>}</section>
            </>}
          </>}

          {page === 'learn' && <section className="learn-page">
            <div className="page-title-row"><div><div className="eyebrow"><GraduationCap size={14} /> RUANG BELAJAR</div><h1>Belajar lebih melekat.</h1><p>Latihan singkat, progres nyata. Pilih mode favoritmu.</p></div><div className="learn-title-icon"><Brain size={25} /></div></div>
            <div className="learn-mode-grid">
              <button className={`learn-mode-card ${learnMode === 'flashcards' ? 'selected' : ''}`} onClick={() => { if (!deck.length) startFlashcards(); else setLearnMode('flashcards'); }}><span className="learn-mode-icon purple"><BookOpen size={20} /></span><strong>Tebak Arti</strong><small>Balik kartu dan ingat maknanya.</small><span className="mode-link">Mulai latihan <ArrowRight size={14} /></span></button>
              <button className={`learn-mode-card ${learnMode === 'quiz' ? 'selected' : ''}`} onClick={() => startQuiz()}><span className="learn-mode-icon green"><CircleHelp size={20} /></span><strong>Kuis Kilat</strong><small>5 soal singkat untuk menguji ingatan.</small><span className="mode-link">5 soal <ArrowRight size={14} /></span></button>
              <button className={`learn-mode-card ${learnMode === 'letters' ? 'selected' : ''}`} onClick={() => startLetters()}><span className="learn-mode-icon orange"><Type size={20} /></span><strong>Susun Huruf</strong><small>Rangkai huruf Arab menjadi kata.</small><span className="mode-link">Asah ejaan <ArrowRight size={14} /></span></button>
              <button className={`learn-mode-card ${learnMode === 'similar' ? 'selected' : ''}`} onClick={() => setLearnMode('similar')}><span className="learn-mode-icon red"><Languages size={20} /></span><strong>Mirip tapi Beda</strong><small>Bedakan istilah yang sering tertukar.</small><span className="mode-link">Lihat pasangan <ArrowRight size={14} /></span></button>
            </div>

            {learnMode === 'flashcards' && <div className="practice-panel"><div className="practice-heading"><div><span className="section-kicker">KARTU FLASHCARD</span><h2>Ingat tanpa mengintip</h2></div><span className="counter-pill">{deck.length ? deckIndex + 1 : 0} / {deck.length || 0}</span></div>{currentDeckWord ? <><button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(v => !v)}><span className="flashcard-overline">{flipped ? 'ARTI KATA' : 'APA ARTI KATA INI?'}</span>{!flipped ? <><span className="flashcard-ar" dir="rtl">{showHarakat ? currentDeckWord.ar : stripHarakat(currentDeckWord.ar)}</span>{showLatin && <span className="flashcard-latin">{currentDeckWord.latin}</span>}</> : <><span className="flashcard-answer">{currentDeckWord.id_text}</span><span className="flashcard-ar-small" dir="rtl">{currentDeckWord.ar}</span><span className="flashcard-example">{currentDeckWord.example?.id}</span></>}<span className="flashcard-hint"><RotateCcw size={14} /> Ketuk untuk membalik</span></button><div className="flashcard-actions"><button className="secondary-button" onClick={async () => { await markReviewed(currentDeckWord, false); setFlipped(false); setDeckIndex(i => (i + 1) % deck.length); }}><RefreshCw size={16} /> Belum tahu</button><button className="primary-button" onClick={async () => { await markReviewed(currentDeckWord, true); setFlipped(false); setDeckIndex(i => i + 1 >= deck.length ? 0 : i + 1); notify('Progres tersimpan'); }}><Check size={17} /> Sudah tahu</button></div><div className="practice-footnote"><ShieldCheck size={15} /> Progres disimpan di perangkat ini, termasuk saat offline.</div></> : <div className="empty-state"><BookOpen size={25}/><strong>Menyiapkan kartu</strong><span>Pilih jurusan jika belum ada data.</span></div>}</div>}

            {learnMode === 'quiz' && <div className="practice-panel"><div className="practice-heading"><div><span className="section-kicker">KUIS KILAT</span><h2>{quiz.length && quizIndex >= quiz.length ? 'Sesi selesai!' : 'Pilih arti yang tepat'}</h2></div><span className="counter-pill">{quiz.length ? Math.min(quizIndex + 1, quiz.length) : 0} / 5</span></div>{quiz.length && quizIndex < quiz.length ? <><div className="quiz-progress">{quiz.map((q, i) => <span key={q.word.id} className={i < quizIndex ? 'complete' : i === quizIndex ? 'current' : ''} />)}</div><div className="quiz-question"><span className="word-category">{currentQuiz.word.category}</span><div className="quiz-ar" dir="rtl">{showHarakat ? currentQuiz.word.ar : stripHarakat(currentQuiz.word.ar)}</div>{showLatin && <div className="quiz-latin">{currentQuiz.word.latin}</div>}<p>Pilih arti dalam Bahasa Indonesia.</p></div><div className="quiz-options">{currentQuiz.options.map(option => { const chosen = quizAnswers[quizIndex] === option.id; const checked = quizAnswers[quizIndex] !== undefined; const correct = option.id === currentQuiz.answer; return <button key={option.id} disabled={checked} className={`quiz-option ${checked && correct ? 'correct' : ''} ${chosen && !correct ? 'incorrect' : ''}`} onClick={() => setQuizAnswers(v => ({ ...v, [quizIndex]: option.id }))}><span className="option-radio">{checked && correct ? <Check size={15} /> : String.fromCharCode(65 + currentQuiz.options.indexOf(option))}</span><span>{option.text}</span>{checked && correct && <CheckCircle2 size={17} />}</button>; })}</div><div className="quiz-bottom"><span>{quizIndex > 0 ? `Skor sementara: ${quizScore}/${quizIndex + (quizAnswers[quizIndex] !== undefined ? 1 : 0)}` : 'Lima soal, satu menit.'}</span><button className="primary-button" disabled={quizAnswers[quizIndex] === undefined} onClick={async () => { if (quizIndex === quiz.length - 1) { const correct = quiz.filter((q, i) => quizAnswers[i] === q.answer).length; await writeMeta('lastQuizScore', correct); await writeMeta('lastQuizDate', todayKey()); setQuizIndex(quiz.length); } else setQuizIndex(i => i + 1); }}>{quizIndex === quiz.length - 1 ? 'Lihat hasil' : 'Berikutnya'} <ArrowRight size={15} /></button></div></> : <div className="quiz-result"><div className="result-trophy"><Trophy size={30} /></div><span className="section-kicker">HASIL LATIHAN</span><h3>{quizScore} dari {quiz.length || 5} benar</h3><p>{quizScore >= 4 ? 'Mantap! Ingatan kosakatamu makin kuat.' : 'Bagus sudah berlatih. Ulangi beberapa kartu agar makin melekat.'}</p><div className="result-actions"><button className="secondary-button" onClick={() => setPage('search')}>Kembali ke kamus</button><button className="primary-button" onClick={startQuiz}><RotateCcw size={15} /> Ulangi kuis</button></div><div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <span key={i} style={{ '--i': i }} />)}</div></div>}</div>}

            {learnMode === 'letters' && <div className="practice-panel"><div className="practice-heading"><div><span className="section-kicker">SUSUN HURUF</span><h2>Rangkai huruf menjadi kata</h2></div><span className="counter-pill">Tantangan</span></div>{lettersWord && <><div className="letter-prompt"><span className="word-category">{lettersWord.category}</span><strong>{lettersWord.id_text}</strong><p>Pilih huruf dari kiri ke kanan hingga membentuk kata Arab.</p></div><div className="letter-answer-area" dir="rtl">{letterAnswer.length ? letterAnswer.map(item => <button key={item.key} className="chosen-letter" onClick={() => { if (!letterChecked) { setLetterAnswer(a => a.filter(x => x.key !== item.key)); setLetterChoices(c => [...c, item].sort((a,b) => a.key.localeCompare(b.key))); } }}>{item.letter}</button>) : <span className="letter-placeholder">Susun huruf di sini</span>}</div><div className="letter-choice-area" dir="rtl">{letterChoices.map(item => <button key={item.key} disabled={letterAnswer.some(a => a.key === item.key) || letterChecked} className={`letter-tile ${letterAnswer.some(a => a.key === item.key) ? 'used' : ''}`} onClick={() => setLetterAnswer(a => [...a, item])}>{item.letter}</button>)}</div>{letterChecked && <div className={`letter-feedback ${letterAnswer.map(i => i.letter).join('') === stripHarakat(lettersWord.ar).replace(/\s/g,'') ? 'success' : 'try-again'}`}>{letterAnswer.map(i => i.letter).join('') === stripHarakat(lettersWord.ar).replace(/\s/g,'') ? 'Tepat! Susunan hurufnya benar.' : `Jawaban: ${stripHarakat(lettersWord.ar).replace(/\s/g, '')}`}</div>}<div className="quiz-bottom"><button className="secondary-button" onClick={() => loadLettersFor(shuffle(activeWords)[0])}><Shuffle size={15} /> Kata lain</button><button className="primary-button" disabled={!letterAnswer.length} onClick={() => { if (!letterChecked) setLetterChecked(true); else loadLettersFor(shuffle(activeWords.filter(w => w.id !== lettersWord.id))[0]); }}>{letterChecked ? 'Lanjut' : 'Periksa jawaban'} <ArrowRight size={15} /></button></div></>}</div>}

            {learnMode === 'similar' && <div className="practice-panel"><div className="practice-heading"><div><span className="section-kicker">MIRIP TAPI BEDA</span><h2>Jangan sampai tertukar</h2></div><span className="counter-pill">{similar.length} pasangan</span></div><div className="similar-list">{similar.filter(s => s.track === 'all' || s.track === activeTrack || (activeTrack === 'Umum' && s.track === 'Umum')).map(s => <div key={s.id} className="similar-card"><div className="similar-pair"><button onClick={() => { const w = searchableWords.find(w => normalizeArabic(w.ar) === normalizeArabic(s.first.ar)) || { ...s.first, id: s.id + '-a', track: activeTrack, category: 'Mirip tapi beda', example: { ar: '', id: '' }, tags: [] }; openWord(w); }}><span className="similar-ar" dir="rtl">{s.first.ar}</span><strong>{s.first.id_text}</strong><small>{s.first.latin}</small></button><span className="versus">VS</span><button onClick={() => { const w = searchableWords.find(w => normalizeArabic(w.ar) === normalizeArabic(s.second.ar)) || { ...s.second, id: s.id + '-b', track: activeTrack, category: 'Mirip tapi beda', example: { ar: '', id: '' }, tags: [] }; openWord(w); }}><span className="similar-ar" dir="rtl">{s.second.ar}</span><strong>{s.second.id_text}</strong><small>{s.second.latin}</small></button></div><div className="similar-tip"><Info size={15} /><span>{s.tip}</span></div></div>)}</div></div>}
          </section>}

          {page === 'favorites' && <section className="content-section full-content-page"><div className="page-title-row"><div><div className="eyebrow"><Heart size={14} /> KOLEKSI PRIBADI</div><h1>Kata favoritmu.</h1><p>Simpan istilah yang ingin kamu ingat lebih lama.</p></div><div className="page-title-icon"><Bookmark size={24} /></div></div><div className="filter-row"><span className="counter-pill"><Bookmark size={13} /> {bookmarkedWords.length} kata tersimpan</span><button className="subtle-control" onClick={() => { setQuery(''); setPage('search'); }}>Cari kata lain <Search size={15} /></button></div>{wordResults(bookmarkedWords, 'Belum ada kata favorit', 'Tekan ikon bookmark di detail kata untuk menyimpannya di sini.')}</section>}

          {page === 'settings' && <section className="content-section full-content-page settings-page"><div className="page-title-row"><div><div className="eyebrow"><SlidersHorizontal size={14} /> PREFERENSI</div><h1>Atur cara belajarmu.</h1><p>Personalisasi pengalaman SakuArab di perangkat ini.</p></div><div className="page-title-icon"><Settings size={24} /></div></div>
            <div className="settings-grid"><div className="settings-card"><div className="settings-card-head"><span className="settings-icon"><Palette size={18} /></span><div><h3>Tampilan</h3><p>Atur tema dan suasana aplikasi.</p></div></div><label className="setting-row"><span><strong>Mode tampilan</strong><small>Pilih terang, gelap, atau mengikuti sistem.</small></span><select value={themeMode} onChange={e => { setThemeMode(e.target.value); savePreference('themeMode', e.target.value); }}><option value="dark">Dark</option><option value="light">Light</option><option value="auto">Auto</option></select></label><div className="setting-row"><span><strong>Warna jurusan</strong><small>Warna aksen mengikuti jalur aktif.</small></span><span className="accent-preview" style={{ background: activeInfo.accent }} /></div></div>
              <div className="settings-card"><div className="settings-card-head"><span className="settings-icon"><Languages size={18} /></span><div><h3>Teks Arab</h3><p>Buat tulisan dan harakat nyaman dibaca.</p></div></div><div className="setting-row"><span><strong>Tampilkan harakat</strong><small>Vokal pendek dan tanda baca Arab.</small></span><button className={`toggle ${showHarakat ? 'on' : ''}`} role="switch" aria-checked={showHarakat} onClick={() => { setShowHarakat(v => !v); savePreference('showHarakat', !showHarakat); }}><span /></button></div><div className="setting-row"><span><strong>Tampilkan transliterasi</strong><small>Bantuan membaca dengan huruf Latin.</small></span><button className={`toggle ${showLatin ? 'on' : ''}`} role="switch" aria-checked={showLatin} onClick={() => { setShowLatin(v => !v); savePreference('showLatin', !showLatin); }}><span /></button></div><div className="setting-row font-setting"><span><strong>Ukuran tulisan Arab</strong><small>{arabicSize}px · bisa diubah kapan saja.</small></span><div className="range-wrap"><button onClick={() => { const n = Math.max(26, arabicSize - 2); setArabicSize(n); savePreference('arabicSize', n); }} aria-label="Kecilkan teks Arab">−</button><input type="range" min="26" max="52" step="2" value={arabicSize} onChange={e => { setArabicSize(Number(e.target.value)); savePreference('arabicSize', Number(e.target.value)); }} /><button onClick={() => { const n = Math.min(52, arabicSize + 2); setArabicSize(n); savePreference('arabicSize', n); }} aria-label="Besarkan teks Arab">+</button></div></div><div className="arabic-preview" dir="rtl">{showHarakat ? 'مَرْحَبًا بِكَ فِي سَكُو عَرَب' : 'مرحبا بك في سكو عرب'}<small dir="ltr">Contoh tulisan Arab</small></div></div>
              <div className="settings-card"><div className="settings-card-head"><span className="settings-icon"><BookMarked size={18} /></span><div><h3>Data & progres</h3><p>Semua progres tersimpan lokal, tanpa akun.</p></div></div><div className="data-stat-grid"><div><strong>{bookmarkIds.size}</strong><small>Favorit</small></div><div><strong>{progress.length}</strong><small>Kata dilatih</small></div><div><strong>{streak}</strong><small>Hari streak</small></div></div><button className="settings-action" onClick={exportData}><span className="action-icon"><FileDown size={17} /></span><span><strong>Ekspor cadangan</strong><small>Simpan bookmark, progres, dan riwayat ke JSON.</small></span><Download size={17} /></button><button className="settings-action" onClick={() => importInput.current?.click()}><span className="action-icon"><FileUp size={17} /></span><span><strong>Impor cadangan</strong><small>Pindahkan progres dari perangkat lain.</small></span><ArrowUpRight size={17} /></button><input ref={importInput} type="file" accept="application/json,.json" hidden onChange={e => { importData(e.target.files?.[0]); e.target.value = ''; }} /></div>
              <div className="settings-card about-card"><div className="settings-card-head"><span className="settings-icon"><Info size={18} /></span><div><h3>Tentang SakuArab</h3><p>Belajar kosakata vokasi dengan cara yang lebih dekat.</p></div></div><p className="about-copy">SakuArab adalah kamus Bahasa Arab untuk dunia kerja dan sekolah vokasi. Aplikasi bisa dipasang sebagai PWA; setelah file aplikasi dan data termuat, sebagian besar fitur belajar dapat digunakan tanpa koneksi.</p><div className="about-tags"><span><ShieldCheck size={13} /> Tanpa akun</span><span><VolumeX size={13} /> Tanpa audio</span><span><Zap size={13} /> Offline-ready</span></div></div>
            </div>
          </section>}
        </div>

        <footer className="main-footer"><span>© 2026 SakuArab</span><span>Arab buat dunia kerja, bukan cuma hafalan.</span><button onClick={() => setPage('settings')}>Pengaturan <ArrowUpRight size={13} /></button></footer>
      </main>

      <nav className="bottom-nav glass-panel" aria-label="Navigasi utama">{NAV.map(item => { const Icon = item.icon; return <button key={item.id} className={`bottom-nav-item ${page === item.id ? 'active' : ''}`} onClick={() => selectNav(item.id)}><span className="bottom-icon"><Icon size={19} strokeWidth={1.8} />{item.id === 'favorites' && bookmarkIds.size > 0 && <i />}</span><small>{item.label}</small></button>; })}</nav>

      {showTracks && <div className="overlay track-overlay" onClick={() => setShowTracks(false)}><section className="track-sheet" onClick={e => e.stopPropagation()}><div className="sheet-grabber" /><div className="sheet-head"><div><span className="section-kicker">PILIH JALUR BELAJAR</span><h2>Fokus jurusanmu</h2></div><IconButton icon={X} label="Tutup" onClick={() => setShowTracks(false)} /></div><div className="track-option-list">{config.tracks.map(t => { const Icon = TRACK_ICONS[t.id]; return <button key={t.id} className={`track-option ${activeTrack === t.id ? 'selected' : ''}`} onClick={() => changeTrack(t.id)}><span className="track-option-icon" style={{ background: `${t.accent}20`, color: t.accent }}><Icon size={21} /></span><span className="track-option-text"><strong>{t.name}</strong><small>{t.description}</small></span><span className="track-option-count">{t.id === 'Umum' ? generalWords.length || 102 : (loaded[t.id]?.length || 600)} kata</span>{activeTrack === t.id && <CheckCircle2 size={18} className="track-selected-check" />}</button>; })}</div><div className="track-sheet-note"><ShieldCheck size={15} /> Setiap jurusan punya warna dan kategori berbeda.</div></section></div>}

      {selectedWord && <div className={`overlay detail-overlay ${page === 'search' && (query.trim() || category) ? 'desktop-inline-hidden' : ''}`} onClick={() => setSelectedWord(null)} onTouchStart={e => { touchStartY.current = e.touches[0].clientY; }} onTouchEnd={e => { if (touchStartY.current !== null && e.changedTouches[0].clientY - touchStartY.current > 110) setSelectedWord(null); touchStartY.current = null; }}><section className="detail-sheet" onClick={e => e.stopPropagation()}><div className="sheet-grabber" /><div className="detail-topline"><span className="word-category">{selectedWord.category}</span><div className="detail-top-actions"><IconButton icon={Share2} label="Bagikan sebagai gambar" onClick={() => createShareImage(selectedWord).catch(() => notify('Gambar belum bisa dibagikan di browser ini.'))} /><IconButton icon={X} label="Tutup detail" onClick={() => setSelectedWord(null)} /></div></div><div className="detail-ar" dir="rtl">{showHarakat ? selectedWord.ar : stripHarakat(selectedWord.ar)}</div>{showLatin && <div className="detail-latin">{selectedWord.latin}</div>}<h2 className="detail-meaning">{selectedWord.id_text}</h2><div className="sound-hints">{(selectedWord.tags || []).filter(t => t.startsWith('bunyi-')).map(tag => <span key={tag} className="sound-hint"><Languages size={12} /> {tag === 'bunyi-ain' ? 'ع · ain' : tag === 'bunyi-ghain' ? 'غ · ghain' : 'ق · qaf'}</span>)}<span className="detail-track-dot" style={{ background: config.tracks.find(t => t.id === selectedWord.track)?.accent || activeInfo.accent }} /> <span>{selectedWord.track}</span></div><div className="detail-example"><div className="example-heading"><span><BookText size={15} /> CONTOH KALIMAT</span><span>AR / ID</span></div><p className="example-ar" dir="rtl">{showHarakat ? selectedWord.example?.ar : stripHarakat(selectedWord.example?.ar || '')}</p><p className="example-id">{selectedWord.example?.id || 'Contoh kalimat belum tersedia.'}</p></div><div className="detail-tags">{(selectedWord.tags || []).filter(t => !t.startsWith('bunyi-')).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div><div className="detail-action-row"><button className={`secondary-button bookmark-action ${selectedIsBookmarked ? 'saved' : ''}`} onClick={() => toggleBookmark(selectedWord)}>{selectedIsBookmarked ? <BookMarked size={17} fill="currentColor" /> : <Bookmark size={17} />} {selectedIsBookmarked ? 'Tersimpan' : 'Favorit'}</button><button className="secondary-button" onClick={() => copyWord(selectedWord)}><Copy size={16} /> Salin</button><button className="primary-button" onClick={() => createShareImage(selectedWord).catch(() => notify('Gagal membuat kartu gambar.'))}><Share2 size={16} /> Bagikan</button></div><div className="detail-tip"><Sparkles size={14} /> Tip: baca transliterasi perlahan, terutama bunyi ع, غ, dan ق.</div></section></div>}

      {toast && <div className="toast-message"><CheckCircle2 size={16} /> {toast}</div>}
      {installPrompt && <button className="install-prompt" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}><Download size={16} /> Pasang SakuArab <X size={14} onClick={e => { e.stopPropagation(); setInstallPrompt(null); }} /></button>}
    </div>
  );
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' '); let line = ''; const lines = [];
  words.forEach(word => { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test; });
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight, maxWidth));
}

export default App;
