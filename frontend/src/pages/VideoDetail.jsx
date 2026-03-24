/**
 * @file VideoDetail.jsx
 * @description Videó részletes oldal – automatikus magyar felirat + TTS szinkronhang + fejezet navigátor.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

/** Megvizsgálja, hogy a szöveg tartalmaz-e magyar karaktert. */
const isHungarianText = (text) => text && /[áéíóöőúüű]/i.test(text);

/**
 * Több rövid Whisper cue-t összevon ~10 másodperces TTS szegmensekbe.
 * Így a TTS egész mondatokat olvas, nem rövid töredékeket.
 */
function buildTtsSegments(cues, maxDuration = 15) {
  if (!cues?.length) return [];
  const segments = [];
  let cur = null;
  for (const cue of cues) {
    if (!cur) {
      cur = { start: cue.start, end: cue.end, text: cue.text };
    } else {
      const gap = cue.start - cur.end;
      const dur = cue.end - cur.start;
      // Új szegmens ha: > 1.5s szünet VAGY > maxDuration hosszú lett
      if (gap > 1.5 || dur > maxDuration) {
        segments.push(cur);
        cur = { start: cue.start, end: cue.end, text: cue.text };
      } else {
        cur.end = cue.end;
        cur.text += ' ' + cue.text;
      }
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

/** Markdown → React: fejlécek, lista, félkövér, inline kód, elválasztó */
const DAX_CATEGORIES = {
  Aggregáció: ['SUM','SUMX','COUNT','COUNTA','COUNTX','COUNTROWS','COUNTBLANK','DISTINCTCOUNT','AVERAGE','AVERAGEX','MIN','MINX','MAX','MAXX'],
  Szűrő: ['CALCULATE','CALCULATETABLE','FILTER','ALL','ALLEXCEPT','ALLSELECTED','VALUES','DISTINCT','KEEPFILTERS'],
  'Időszak': ['DATEADD','DATESYTD','DATESMTD','DATESQTD','SAMEPERIODLASTYEAR','TOTALYTD','TOTALMTD','PREVIOUSYEAR','PREVIOUSMONTH','PARALLELPERIOD'],
  Logikai: ['IF','IFERROR','SWITCH'],
  Matematikai: ['DIVIDE','RANKX','TOPN','EARLIER'],
  Szöveg: ['CONCATENATE','CONCATENATEX','FORMAT','BLANK','ISBLANK'],
  Kapcsolat: ['RELATED','RELATEDTABLE','USERELATIONSHIP','LOOKUPVALUE'],
  Tábla: ['GENERATE','CROSSJOIN','TREATAS','CONTAINS'],
  Változó: ['VAR','RETURN'],
  Kiválasztás: ['HASONEVALUE','SELECTEDVALUE','FIRSTNONBLANK','LASTNONBLANK'],
};
const DAX_CATEGORY_COLORS = {
  Aggregáció: '#2563eb', Szűrő: '#7c3aed', 'Időszak': '#0891b2',
  Logikai: '#d97706', Matematikai: '#059669', Szöveg: '#db2777',
  Kapcsolat: '#ea580c', Tábla: '#4f46e5', Változó: '#64748b', Kiválasztás: '#0d9488',
};
function getDaxCategory(name) {
  const upper = name?.toUpperCase();
  for (const [cat, fns] of Object.entries(DAX_CATEGORIES)) {
    if (fns.includes(upper)) return cat;
  }
  return null;
}

function DaxCard({ fn }) {
  const [copied, setCopied] = useState(false);
  const category = getDaxCategory(fn.name);
  const color = category ? DAX_CATEGORY_COLORS[category] : '#64748b';
  const docsUrl = `https://learn.microsoft.com/en-us/dax/${fn.name.toLowerCase()}-function-dax`;

  function handleCopy() {
    navigator.clipboard.writeText(fn.example || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="dax-card" style={{ borderLeftColor: color }}>
      <div className="dax-card__header">
        <h4 className="dax-card__name" style={{ color }}>{fn.name}</h4>
        {category && (
          <span className="dax-card__badge" style={{ background: color + '18', color }}>
            {category}
          </span>
        )}
      </div>
      {fn.description && <p className="dax-card__desc">{fn.description}</p>}
      {fn.example && (
        <div className="dax-card__code-wrap">
          <pre className="dax-card__code"><code>{fn.example}</code></pre>
          <button className="dax-card__copy" onClick={handleCopy} title="Másolás">
            {copied ? '✓' : '⎘'}
          </button>
        </div>
      )}
      <a
        className="dax-card__docs"
        href={docsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        📖 Microsoft Docs →
      </a>
    </div>
  );
}

function renderMarkdown(text) {
  if (!text) return null;

  function inlineFormat(line) {
    // **bold** és `code`
    const parts = line.split(/(\*\*.*?\*\*|`[^`]+`)/g);
    return parts.map((p, j) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>;
      if (p.startsWith('`') && p.endsWith('`')) return <code key={j} style={{background:'#f1f5f9',padding:'1px 4px',borderRadius:3,fontSize:'0.8em'}}>{p.slice(1,-1)}</code>;
      return p;
    });
  }

  return text.split('\n').map((line, i) => {
    if (/^### (.+)/.test(line)) return <h5 key={i} style={{margin:'10px 0 4px',fontSize:'0.82rem',fontWeight:700,color:'#1e40af'}}>{line.slice(4)}</h5>;
    if (/^## (.+)/.test(line))  return <h4 key={i} style={{margin:'12px 0 4px',fontSize:'0.88rem',fontWeight:700,color:'#1e293b',borderBottom:'1px solid #e2e8f0',paddingBottom:3}}>{line.slice(3)}</h4>;
    if (/^# (.+)/.test(line))   return <h3 key={i} style={{margin:'14px 0 6px',fontSize:'0.95rem',fontWeight:700,color:'#0f172a'}}>{line.slice(2)}</h3>;
    if (/^---+$/.test(line))    return <hr key={i} style={{border:'none',borderTop:'1px solid #e2e8f0',margin:'8px 0'}} />;
    if (/^[•\-\*] (.+)/.test(line)) return <div key={i} style={{display:'flex',gap:6,margin:'2px 0'}}><span style={{color:'#3b82f6',flexShrink:0}}>•</span><span>{inlineFormat(line.replace(/^[•\-\*] /,''))}</span></div>;
    if (/^\d+\. (.+)/.test(line)) { const m = line.match(/^(\d+)\. (.+)/); return <div key={i} style={{display:'flex',gap:6,margin:'2px 0'}}><span style={{color:'#3b82f6',flexShrink:0,minWidth:14}}>{m[1]}.</span><span>{inlineFormat(m[2])}</span></div>; }
    if (!line.trim()) return <div key={i} style={{height:6}} />;
    return <p key={i} style={{margin:'3px 0',lineHeight:1.6}}>{inlineFormat(line)}</p>;
  });
}

function VideoDetail() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [cues, setCues] = useState([]);
  const [subtitleStatus, setSubtitleStatus] = useState('idle');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('noemi');   // noemi | tamas
  const [ttsRate, setTtsRate] = useState('-10%');       // sebesség
  const [ttsPitch, setTtsPitch] = useState('-5Hz');     // magasság
  const [ytSpeed, setYtSpeed] = useState(0.75);         // YouTube lassítás TTS módban
  const [dubStatus, setDubStatus] = useState('idle');    // idle|generating|ready|error
  const [dubProgress, setDubProgress] = useState({ done: 0, total: 0 });
  const [regenSubStatus, setRegenSubStatus] = useState('idle'); // idle | loading | done
  const [whisperStatus, setWhisperStatus] = useState('idle'); // idle | loading | done | error

  // Fejezetek
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapterInput, setChapterInput] = useState('');

  // AI fejezet elemzés
  const [chapterAnalyses, setChapterAnalyses] = useState({});  // index → { status, text }
  const [expandedAnalysis, setExpandedAnalysis] = useState(null);
  const [generatingChapters, setGeneratingChapters] = useState(false);

  // Ollama elemzés
  const [ollamaStatus, setOllamaStatus] = useState('idle'); // idle | loading | done | error

  // AI kiegészítő (fejezetek nélküli videókhoz)
  const [aiSupp, setAiSupp] = useState({ status: 'idle', text: '', sources: [] });

  // Fordítás gomb
  const [translateStatus, setTranslateStatus] = useState('idle'); // idle | loading | done | error

  // AI oldalpanel
  const [panel, setPanel] = useState({ status: 'idle', analysis: '', sources: [], chapterTitle: '' });
  const panelCacheRef = useRef({}); // chapterIndex → { analysis, sources }

  // Kapcsolódó videók
  const [relatedVideos, setRelatedVideos] = useState([]);

  // Kvíz
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStatus, setQuizStatus] = useState('idle'); // idle | loading | ready | error
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Személyes jegyzetek
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const noteSaveTimerRef = useRef(null);

  // Haladás jelző
  const PROGRESS_STATES = ['Nem kezdtem', 'Tanulom', 'Kész'];
  const PROGRESS_COLORS = { 'Nem kezdtem': '#9ca3af', 'Tanulom': '#f59e0b', 'Kész': '#16a34a' };
  const [progress, setProgress] = useState('Nem kezdtem');

  // Refs – ezeket nem kell újra-renderelni
  const ttsEnabledRef = useRef(false);
  const ttsVoiceRef = useRef('noemi');
  const ttsRateRef = useRef('-10%');
  const ttsPitchRef = useRef('-5Hz');
  const lastSpokenRef = useRef(null);       // utoljára sorba tett cue – dupla indítás ellen
  const lastSubtitleRef = useRef('');       // utolsó ismert felirat – gap esetén is mutatjuk
  const currentTtsAudioRef = useRef(null);  // aktív TTS hang – leállításhoz
  const ttsQueueRef = useRef([]);           // hangsor – egymás után, megszakítás nélkül
  const ttsPlayingRef = useRef(false);      // éppen szól-e hang
  const prefetchMapRef = useRef(new Map()); // cue.start → { status:'fetching'|'ready', audio, url }
  const lastVideoTimeRef = useRef(0);       // seek detektáláshoz
  const ttsSegmentsRef = useRef([]);        // összevont TTS szegmensek (több cue = 1 blokk)
  const lastSegmentRef = useRef(null);      // utolsó lejátszott szegmens
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const cuesRef = useRef([]);
  const chaptersRef = useRef([]);
  const dubAudioRef = useRef(null);       // <audio> elem a dubtrackhoz
  const dubStatusRef = useRef('idle');
  const ytSpeedRef = useRef(0.75);
  const currentChapterIdxRef = useRef(-1); // change-detection guard – unnecessary re-renders elkerülése
  const isTtsPlayingRef = useRef(false);  // éppen szól-e TTS (YouTube szünetelve)

  // TTS beállítások → ref szinkronizálás
  useEffect(() => { ttsVoiceRef.current = ttsVoice; }, [ttsVoice]);
  useEffect(() => { ttsRateRef.current = ttsRate; }, [ttsRate]);
  useEffect(() => { ttsPitchRef.current = ttsPitch; }, [ttsPitch]);
  useEffect(() => { ytSpeedRef.current = ytSpeed; }, [ytSpeed]);

  // YouTube iframe postMessage mute/unmute – megbízhatóbb mint setVolume
  function muteYouTube(mute) {
    // 1) postMessage közvetlen – nocookie + sima YouTube egyaránt
    const iframe = document.getElementById('yt-player');
    if (iframe?.contentWindow) {
      const cmd = mute
        ? JSON.stringify({ event: 'command', func: 'mute', args: '' })
        : JSON.stringify({ event: 'command', func: 'unMute', args: '' });
      iframe.contentWindow.postMessage(cmd, '*');
    }
    // 2) IFrame API fallback
    try {
      if (playerRef.current?.mute) mute ? playerRef.current.mute() : playerRef.current.unMute();
    } catch {}
    setYtMuted(mute);
  }

  // Queue törlés – seek vagy TTS kikapcsoláskor
  function clearTtsQueue() {
    ttsQueueRef.current.forEach(item => { try { URL.revokeObjectURL(item.url); } catch {} });
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    isTtsPlayingRef.current = false;
    if (currentTtsAudioRef.current) { currentTtsAudioRef.current.pause(); currentTtsAudioRef.current.onended = null; currentTtsAudioRef.current = null; }
    prefetchMapRef.current.forEach(item => { if (item.url) try { URL.revokeObjectURL(item.url); } catch {} });
    prefetchMapRef.current.clear();
    lastSpokenRef.current = null;
  }

  // dubStatus → ref szinkronizálás
  useEffect(() => {
    dubStatusRef.current = dubStatus;
    if (dubStatus === 'ready') {
      // Régi szegmens TTS leállítása
      clearTtsQueue();
      lastSegmentRef.current = null;
    }
  }, [dubStatus]);

  // Magyar szinkronsáv generálása – teljes WAV fájl a szerveren
  async function handleGenerateDubtrack() {
    const hunCues = cues.filter(c => isHungarianText(c.text));
    if (!hunCues.length) { alert('Nincs magyar felirat ehhez a videóhoz'); return; }
    setDubStatus('generating');
    dubStatusRef.current = 'generating';
    setDubProgress({ done: 0, total: 0 });

    // Progress polling – valósidejű előrehaladás
    const pollId = setInterval(async () => {
      try {
        const pr = await fetch(`/api/videos/${id}/dubtrack-progress`);
        if (pr.ok) {
          const p = await pr.json();
          if (p.total > 0) setDubProgress({ done: p.done, total: p.total });
        }
      } catch { /* hálózati hiba – kihagyjuk */ }
    }, 800);

    try {
      const r = await fetch(`/api/videos/${id}/generate-dubtrack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: ttsVoice, rate: ttsRate, pitch: ttsPitch }),
        signal: AbortSignal.timeout(600_000), // 10 perc max
      });
      clearInterval(pollId);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setDubProgress({ done: data.cueCount, total: data.cueCount });
      setDubStatus('ready');
      dubStatusRef.current = 'ready';

      // <audio> betöltése – generálás kész → elejéről indul szinkronban
      if (dubAudioRef.current) {
        dubAudioRef.current.src = `${data.url}?t=${Date.now()}`;
        dubAudioRef.current.load();
        dubAudioRef.current.addEventListener('canplay', () => {
          if (!ttsEnabledRef.current) return;
          // Visszatekerjük az elejére és együtt indítjuk
          try { playerRef.current?.seekTo?.(0, true); } catch {}
          dubAudioRef.current.currentTime = 0;
          dubAudioRef.current.playbackRate = ytSpeedRef.current;
          dubAudioRef.current.play().catch(() => {});
          try { playerRef.current?.playVideo?.(); } catch {}
        }, { once: true });
      }
    } catch (err) {
      clearInterval(pollId);
      console.error('[DUB] Generálás hiba:', err.message);
      setDubStatus('error');
      dubStatusRef.current = 'error';
      setTimeout(() => { setDubStatus('idle'); dubStatusRef.current = 'idle'; }, 5000);
    }
  }

  // AI panel auto-betöltés fejezet váltáskor
  useEffect(() => {
    if (currentChapter !== null && chapters.length > 0) {
      loadAiPanel(currentChapter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter]);

  // ttsEnabled → ref szinkronizálás + YouTube TELJES némítás
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
    if (!ttsEnabled) {
      // KI: ezeket az onClick már elvégezte, de useEffect-ben is biztonságosan ismételjük
      clearTtsQueue();
      window.speechSynthesis?.cancel();
      muteYouTube(false);
      try { playerRef.current?.setPlaybackRate(1); } catch {}
      if (dubAudioRef.current) dubAudioRef.current.pause();
    }
    // BE eset: az onClick handler kezeli (autoplay policy miatt ott kell play()-t hívni)
  }, [ttsEnabled, ytSpeed]);

  // cues → ref szinkronizálás
  useEffect(() => {
    cuesRef.current = cues;
    // Szegmensek újraszámolása – csak magyar cue-k kerülnek bele
    ttsSegmentsRef.current = buildTtsSegments(cues.filter(c => isHungarianText(c.text)));
  }, [cues]);

  // chapters → ref szinkronizálás + első fejezet AI panel auto-betöltése
  useEffect(() => {
    chaptersRef.current = chapters;
    if (chapters.length) {
      setChapterInput(chapters.map(ch => `${ch.timeStr} ${ch.title}`).join('\n'));
      // Első fejezet elemzése automatikusan – ne kelljen lejátszani a videót
      if (currentChapter === null) {
        setCurrentChapter(0);
      }
    }
  }, [chapters]);

  // Fejezetek auto-kinyerése a videó leírásából (ha nincs még elmentve)
  useEffect(() => {
    if (chapters.length) return; // már van mentett fejezet
    if (!video?.description) return;
    const lines = video.description.split('\n');
    const parsed = [];
    for (const line of lines) {
      const m = line.match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]?\s*(.+)$/);
      if (!m) continue;
      const title = m[2].trim();
      if (!title) continue;
      const parts = m[1].split(':').map(Number);
      const time = parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0] * 3600 + parts[1] * 60 + parts[2];
      const pad = (n) => String(n).padStart(2, '0');
      const timeStr = parts.length === 2
        ? `${pad(parts[0])}:${pad(parts[1])}`
        : `${pad(parts[0])}:${pad(parts[1])}:${pad(parts[2])}`;
      parsed.push({ time, timeStr, title });
    }
    if (parsed.length >= 2) {
      // Fejezet címek fordítása magyarra a háttérben
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: parsed.map(ch => ch.title) }),
      })
        .then(r => r.json())
        .then(data => {
          const translated = parsed.map((ch, i) => ({ ...ch, title: data.translations?.[i] || ch.title }));
          setChapterInput(translated.map(ch => `${ch.timeStr} ${ch.title}`).join('\n'));
        })
        .catch(() => {
          setChapterInput(parsed.map(ch => `${ch.timeStr} ${ch.title}`).join('\n'));
        });
    }
  }, [video, chapters.length]);

  // Videó betöltése
  useEffect(() => {
    setStatus('loading');
    fetch(`/api/videos/${id}`)
      .then((res) => {
        if (res.status === 404) { setStatus('notfound'); return null; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data) {
          setVideo(data);
          setStatus('ok');
          if (data.transcriptCuesHu?.length) {
            setCues(data.transcriptCuesHu);
            setSubtitleStatus('ready');
          }
          if (data.chaptersJson?.length) {
            setChapters(data.chaptersJson);
          }
          // Dubtrack ellenőrzés – ha már generálva van, betöltjük
          fetch(`/api/videos/${id}/dubtrack`, { method: 'HEAD' })
            .then(r => {
              if (r.ok && dubAudioRef.current) {
                dubAudioRef.current.src = `/api/videos/${id}/dubtrack`;
                dubAudioRef.current.load(); // betöltés megkezdése
                setDubStatus('ready');
                dubStatusRef.current = 'ready';
                setDubProgress({ done: 1, total: 1 });
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => { setStatus('error'); setErrorMsg(err.message); });
  }, [id]);

  // Kapcsolódó videók, jegyzetek, haladás betöltése
  useEffect(() => {
    if (status !== 'ok') return;
    fetch(`/api/videos/${id}/related`)
      .then(r => r.json())
      .then(data => setRelatedVideos(data.related || []))
      .catch(() => {});
    const savedNote = localStorage.getItem(`pbi_note_${id}`) || '';
    setNote(savedNote);
    setNoteSaved(false);
    const savedProgress = localStorage.getItem(`pbi_progress_${id}`) || 'Nem kezdtem';
    setProgress(savedProgress);

    // AI Szakértői Kiegészítő – localStorage cache, ha nincs auto-generál
    const cacheKey = `pbi_ai_supp_${id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAiSupp({ status: 'ready', text: parsed.text, sources: parsed.sources || [] });
        return;
      } catch { /* cache sérült */ }
    }
    // Nincs cache → auto-generálás
    setAiSupp({ status: 'loading', text: '', sources: [] });
    fetch(`/api/videos/${id}/ai-panel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterTitle: '', chapterTime: 0, chapterEndTime: null }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.analysis) {
          const result = { text: d.analysis, sources: d.sources || [] };
          localStorage.setItem(cacheKey, JSON.stringify(result));
          setAiSupp({ status: 'ready', ...result });
        } else {
          setAiSupp({ status: 'idle', text: '', sources: [] });
        }
      })
      .catch(() => setAiSupp({ status: 'idle', text: '', sources: [] }));
  }, [id, status]);

  function handleNoteChange(e) {
    const val = e.target.value;
    setNote(val);
    setNoteSaved(false);
    clearTimeout(noteSaveTimerRef.current);
    noteSaveTimerRef.current = setTimeout(() => {
      localStorage.setItem(`pbi_note_${id}`, val);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }, 600);
  }

  function cycleProgress() {
    const idx = PROGRESS_STATES.indexOf(progress);
    const next = PROGRESS_STATES[(idx + 1) % PROGRESS_STATES.length];
    setProgress(next);
    localStorage.setItem(`pbi_progress_${id}`, next);
  }

  // Auto felirat fetch – ha nincs cue, vagy angolnak látszanak (nincs ékezetes karakter)
  useEffect(() => {
    if (status !== 'ok') return;
    const looksHungarian = cues.length > 0 && /[áéíóöőúüű]/i.test(cues[0]?.text || '');
    if (looksHungarian) return;
    setSubtitleStatus('loading');

    // 45mp timeout – ha a fordítás rate-limited, ne fagyjon be az oldal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    fetch(`/api/videos/${id}/subtitles`, { method: 'POST', signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        clearTimeout(timeoutId);
        if (data.cues?.length) {
          setCues(data.cues);
          setSubtitleStatus('ready');
        } else {
          setSubtitleStatus('unavailable');
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // AbortError = timeout → "próbáld újra" üzenet helyett csak unavailable
        setSubtitleStatus('unavailable');
      });

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [status, id]); // cues.length szándékosan nincs itt – egyszer fut le

  // YouTube IFrame API – csak egyszer hozza létre a playert, amikor az első cue megérkezik
  const hasCues = cues.length > 0;
  useEffect(() => {
    if (!hasCues) return;

    function startPolling(player) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        try {
          const t = player.getCurrentTime();

          // Felirat követés – csak magyar szöveget mutat, gap esetén az előző megmarad
          const cue = cuesRef.current.find((c) => t >= c.start && t < c.end);
          if (cue && isHungarianText(cue.text)) { lastSubtitleRef.current = cue.text; setCurrentSubtitle(cue.text); }
          else if (t < 0.5) { lastSubtitleRef.current = ''; setCurrentSubtitle(''); } // újrakezdésnél töröl

          if (ttsEnabledRef.current) {
            // ── Seek detektálás – WAV audio is ugrik ──
            const prevT = lastVideoTimeRef.current;
            if (Math.abs(t - prevT) > 2.0 && prevT > 0) {
              if (dubStatusRef.current === 'ready' && dubAudioRef.current) {
                dubAudioRef.current.currentTime = t;
              }
            }
            lastVideoTimeRef.current = t;

            // ── WAV szinkron: ha eltér >0.3s, igazítjuk (YouTube-hoz követi) ──
            if (dubStatusRef.current === 'ready' && dubAudioRef.current) {
              const audioEl = dubAudioRef.current;
              const diff = Math.abs(audioEl.currentTime - t);
              if (diff > 0.3) audioEl.currentTime = t;
            }
          }

          // Fejezet követés
          if (chaptersRef.current.length) {
            let idx = 0;
            for (let ci = 0; ci < chaptersRef.current.length; ci++) {
              if (t >= chaptersRef.current[ci].time) idx = ci;
            }
            if (idx !== currentChapterIdxRef.current) {
              currentChapterIdxRef.current = idx;
              setCurrentChapter(idx);
            }
          }
        } catch { /* player nem kész */ }
      }, 150);
    }

    function createPlayer() {
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = new window.YT.Player('yt-player', {
        events: {
          onReady(e) { startPolling(e.target); },
          onStateChange(e) {
            if (!ttsEnabledRef.current || dubStatusRef.current !== 'ready') return;
            const audioEl = dubAudioRef.current;
            if (!audioEl) return;
            if (e.data === 1) { // PLAYING
              const vt = playerRef.current?.getCurrentTime?.() || 0;
              const doPlay = () => {
                if (Math.abs(audioEl.currentTime - vt) > 0.3) audioEl.currentTime = vt;
                audioEl.playbackRate = ytSpeedRef.current;
                audioEl.play().catch(e2 => console.warn('[DUB] onState play hiba:', e2.message));
              };
              if (audioEl.readyState >= 2) {
                doPlay();
              } else {
                audioEl.addEventListener('canplay', doPlay, { once: true });
                if (audioEl.readyState === 0) audioEl.load();
              }
            } else if (e.data === 2 || e.data === 3) { // PAUSED vagy BUFFERING
              audioEl.pause();
            }
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); createPlayer(); };
      if (!document.querySelector('script[src*="iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current = null;
    };
  }, [hasCues]); // false→true átmenetnél fut egyszer

  function handleSaveChapters() {
    const lines = chapterInput.split('\n').filter(Boolean);
    const parsed = lines.map(line => {
      const m = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (!m) return null;
      const parts = m[1].split(':').map(Number);
      const time = parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0] * 3600 + parts[1] * 60 + parts[2];
      return { time, timeStr: m[1], title: m[2].trim() };
    }).filter(Boolean).sort((a, b) => a.time - b.time);
    if (!parsed.length) return;
    fetch(`/api/videos/${id}/chapters`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapters: parsed }),
    }).then(r => r.json()).then(() => setChapters(parsed));
  }

  async function handleGenerateChapters() {
    setGeneratingChapters(true);
    try {
      const r = await fetch(`/api/videos/${id}/generate-chapters`, { method: 'POST' });
      const data = await r.json();
      if (data.chapters?.length) {
        setChapters(data.chapters);
        setChapterInput(data.chapters.map(c => `${c.timeStr} ${c.title}`).join('\n'));
      } else {
        alert(data.error || 'Nem sikerült fejezeteket generálni');
      }
    } catch {
      alert('Hiba a fejezetek generálásakor');
    } finally {
      setGeneratingChapters(false);
    }
  }

  function handleAnalyzeChapter(chapterIndex) {
    const ch = chapters[chapterIndex];
    if (!ch) return;

    // Toggle: ha már nyitva van, zárjuk be
    if (expandedAnalysis === chapterIndex) {
      setExpandedAnalysis(null);
      return;
    }

    setExpandedAnalysis(chapterIndex);

    // Ha már van eredmény, csak megjelenítjük
    if (chapterAnalyses[chapterIndex]?.status === 'done') return;

    setChapterAnalyses((prev) => ({ ...prev, [chapterIndex]: { status: 'loading', text: '' } }));

    const chapterEndTime = chapters[chapterIndex + 1]?.time ?? null;

    fetch(`/api/videos/${id}/analyze-chapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterIndex,
        chapterTitle: ch.title,
        chapterTime: ch.time,
        chapterEndTime,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setChapterAnalyses((prev) => ({
          ...prev,
          [chapterIndex]: { status: 'done', text: data.analysis || '' },
        }));
      })
      .catch(() => {
        setChapterAnalyses((prev) => ({
          ...prev,
          [chapterIndex]: { status: 'error', text: 'Az elemzés nem sikerült.' },
        }));
      });
  }

  function loadAiPanel(chapterIndex) {
    const ch = chapters[chapterIndex];
    if (!ch) return;
    // Cache: ha már van eredmény, csak frissítjük a panelt
    if (panelCacheRef.current[chapterIndex]) {
      setPanel({ status: 'ready', ...panelCacheRef.current[chapterIndex], chapterTitle: ch.title });
      return;
    }
    setPanel({ status: 'loading', analysis: '', sources: [], chapterTitle: ch.title });
    const chapterEndTime = chapters[chapterIndex + 1]?.time ?? null;
    fetch(`/api/videos/${id}/ai-panel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterTitle: ch.title, chapterTime: ch.time, chapterEndTime }),
    })
      .then(r => r.json())
      .then(data => {
        const result = { analysis: data.analysis || '', sources: data.sources || [] };
        panelCacheRef.current[chapterIndex] = result;
        setPanel({ status: 'ready', ...result, chapterTitle: ch.title });
      })
      .catch(() => setPanel(p => ({ ...p, status: 'error' })));
  }

  if (status === 'loading') {
    return (
      <div className="detail-state">
        <div className="spinner" aria-label="Betöltés..." />
        <p>Betöltés...</p>
      </div>
    );
  }
  if (status === 'notfound') {
    return (
      <div className="detail-state detail-state--error">
        <p className="detail-state__title">Videó nem található</p>
        <Link to="/" className="back-link">← Vissza</Link>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="detail-state detail-state--error">
        <p className="detail-state__title">❌ Hiba: {errorMsg}</p>
        <Link to="/" className="back-link">← Vissza</Link>
      </div>
    );
  }

  const title = video.title_hu || video.title || '';
  const channel = video.channel_title || '';
  const publishedAt = video.published_at
    ? new Date(video.published_at).toLocaleDateString('hu-HU', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;
  const isHungarian = (t) => t && /[áéíóöőúüű]/i.test(t);
  // Igazi AI elemzés: van magyar szöveg ÉS nincs tele URL-ekkel (nem leírás fordítás)
  const isRealSummary = (t) => t && isHungarian(t) && !t.includes('http') && t.length < 2000;
  const summary = isRealSummary(video.aiSummaryHu) ? video.aiSummaryHu : null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const iframeSrc = `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&origin=${origin}`;

  function subtitleText() {
    if (subtitleStatus === 'loading') return '⏳ Magyar felirat betöltése...';
    if (subtitleStatus === 'unavailable') return '⚠️ Nincs felirat – kattints a 🎤 Groq Whisper gombra a generáláshoz';
    if (!hasCues) return '⏳ Felirat előkészítése...';
    return currentSubtitle || '▶ Indítsd el a videót a felirathoz';
  }

  const hasPanel = true; // mindig megjelenik az AI panel

  return (
    <article className={`detail${hasPanel ? ' detail--with-panel' : ''}`}>
      <nav className="detail__nav">
        <Link to="/" className="back-link">← Vissza a listához</Link>
      </nav>

      {/* ── Videó lejátszó ── */}
      <div className="detail__player-wrap">
        <div className="detail__player">
          <iframe
            id="yt-player"
            className="detail__iframe"
            src={iframeSrc}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* ── Dub audio elem ── */}
        <audio
          ref={dubAudioRef}
          style={{ display: 'none' }}
          preload="auto"
        />

        {/* ── Felirat sáv ── */}
        <div className={`detail__subtitle-bar${hasCues && currentSubtitle ? ' detail__subtitle-bar--active' : ''}`}>
          <span className="detail__subtitle-bar__flag">🇭🇺</span>
          <p className="detail__subtitle-bar__text">{subtitleText()}</p>

          {/* ══ Szinkron BE/KI gomb ══ */}
          <div className="detail__sub-group">
            {/* Ha nincs felirat: Whisper gomb */}
            {!hasCues && (
              <button
                className="detail__tts-settings-btn"
                disabled={whisperStatus === 'loading'}
                title="Felirat automatikus generálása"
                onClick={async () => {
                  setWhisperStatus('loading');
                  try {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => { ctrl.abort(); setWhisperStatus('error'); }, 300000);
                    const r = await fetch(`/api/videos/${id}/transcribe`, { method: 'POST', signal: ctrl.signal });
                    clearTimeout(tid);
                    const data = await r.json();
                    if (data.cues?.length) {
                      setCues(data.cues);
                      setSubtitleStatus('ready');
                      setWhisperStatus('done');
                      setTimeout(() => setWhisperStatus('idle'), 4000);
                    } else {
                      setWhisperStatus('error');
                      setTimeout(() => setWhisperStatus('idle'), 4000);
                    }
                  } catch (e) { if (e.name !== 'AbortError') { setWhisperStatus('error'); setTimeout(() => setWhisperStatus('idle'), 4000); } }
                }}
              >
                {whisperStatus === 'loading' ? '⏳ Felirat generálása...' : whisperStatus === 'done' ? '✅ Kész' : whisperStatus === 'error' ? '❌ Hiba' : '🎤 Felirat generálása'}
              </button>
            )}

            {/* Ha van felirat: Szinkron BE/KI */}
            {hasCues && (
              <button
                className={`detail__tts-btn${ttsEnabled ? ' detail__tts-btn--on' : ''}`}
                onClick={() => {
                  const newVal = !ttsEnabled;
                  setTtsEnabled(newVal);
                  if (newVal) {
                    muteYouTube(true);
                    try { playerRef.current?.setPlaybackRate(ytSpeedRef.current); } catch {}
                    if (dubStatusRef.current === 'ready' && dubAudioRef.current) {
                      // WAV kész → azonnal lejátszik
                      const audioEl = dubAudioRef.current;
                      const tryPlay = () => {
                        const t = playerRef.current?.getCurrentTime?.() || 0;
                        audioEl.currentTime = t;
                        audioEl.playbackRate = ytSpeedRef.current;
                        audioEl.play().catch(err => console.warn('[DUB] play:', err.message));
                      };
                      if (audioEl.readyState >= 2) tryPlay();
                      else { audioEl.addEventListener('canplay', tryPlay, { once: true }); if (audioEl.readyState === 0) audioEl.load(); }
                    } else if (dubStatusRef.current === 'idle') {
                      // Audio feloldása user gesture-ben (autoplay policy fix)
                      // – play()+pause() "felnyitja" az audio elemet, hogy később async is induljon
                      if (dubAudioRef.current) {
                        dubAudioRef.current.play().then(() => dubAudioRef.current.pause()).catch(() => {});
                      }
                      try { playerRef.current?.pauseVideo?.(); } catch {}
                      handleGenerateDubtrack();
                    }
                  } else {
                    muteYouTube(false);
                    try { playerRef.current?.setPlaybackRate(1); } catch {}
                    if (dubAudioRef.current) dubAudioRef.current.pause();
                  }
                }}
                title={ttsEnabled ? 'Magyar szinkronhang kikapcsolása' : 'Magyar szinkronhang bekapcsolása'}
              >
                {dubStatus === 'generating'
                  ? `⏳ ${dubProgress.total > 0 ? Math.round(dubProgress.done / dubProgress.total * 100) + '%' : '...'}`
                  : ttsEnabled ? '🔊 Szinkron BE' : '🔇 Szinkron KI'}
              </button>
            )}

            {/* Dub státusz */}
            {hasCues && dubStatus === 'generating' && (
              <span className="detail__tts-settings-btn" style={{cursor:'default',opacity:0.8}}>
                ⏳ {dubProgress.total > 0
                  ? `Szinkron ${Math.round(dubProgress.done / dubProgress.total * 100)}% (${dubProgress.done}/${dubProgress.total})`
                  : 'Szinkron generálás...'}
              </span>
            )}
            {hasCues && dubStatus === 'ready' && (
              <span className="detail__tts-settings-btn" style={{cursor:'default',color:'#16a34a'}}>
                ✅ Szinkron kész
              </span>
            )}

            {/* ⚙️ Beállítások menü */}
            <button
              className={`detail__tts-settings-btn${ttsSettingsOpen ? ' detail__tts-settings-btn--open' : ''}`}
              onClick={() => setTtsSettingsOpen((v) => !v)}
              title="Beállítások"
            >⚙️</button>

            {ttsSettingsOpen && (
              <div className="detail__tts-panel">
                {/* Felirat forrása */}
                <div style={{marginBottom:'8px',paddingBottom:'8px',borderBottom:'1px solid #333'}}>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'4px'}}>Felirat forrása</div>
                  <button
                    className="detail__tts-settings-btn"
                    disabled={whisperStatus === 'loading'}
                    onClick={async () => {
                      setWhisperStatus('loading'); setTtsSettingsOpen(false);
                      try {
                        const ctrl = new AbortController();
                        const tid = setTimeout(() => { ctrl.abort(); setWhisperStatus('error'); }, 300000);
                        const r = await fetch(`/api/videos/${id}/transcribe`, { method: 'POST', signal: ctrl.signal });
                        clearTimeout(tid);
                        const data = await r.json();
                        if (data.cues?.length) { setCues(data.cues); setSubtitleStatus('ready'); setWhisperStatus('done'); setTimeout(() => setWhisperStatus('idle'), 4000); }
                        else { setWhisperStatus('error'); setTimeout(() => setWhisperStatus('idle'), 4000); }
                      } catch { setWhisperStatus('error'); setTimeout(() => setWhisperStatus('idle'), 4000); }
                    }}
                  >{whisperStatus === 'loading' ? '⏳ Whisper...' : '🎤 Whisper újragenerálás'}</button>
                  <button
                    className="detail__tts-settings-btn"
                    disabled={regenSubStatus === 'loading'}
                    style={{marginLeft:'4px'}}
                    onClick={async () => {
                      setRegenSubStatus('loading');
                      try {
                        const r = await fetch(`/api/videos/${id}/subtitles?force=true`, { method: 'POST' });
                        const data = await r.json();
                        if (data.cues?.length) { setCues(data.cues); setSubtitleStatus('ready'); }
                        setRegenSubStatus('done'); setTimeout(() => setRegenSubStatus('idle'), 3000);
                      } catch { setRegenSubStatus('idle'); }
                    }}
                  >{regenSubStatus === 'loading' ? '⏳' : '🔄 YT felirat'}</button>
                  {(dubStatus === 'idle' || dubStatus === 'error') && hasCues && (
                    <button className="detail__tts-settings-btn" style={{marginLeft:'4px'}} onClick={() => { handleGenerateDubtrack(); setTtsSettingsOpen(false); }} title="Teljes szinkronsáv generálása">
                      🎙️ Szinkron generálása
                    </button>
                  )}
                </div>
                {/* Hang beállítások */}
                <label className="detail__tts-label">
                  Hang:
                  <select value={ttsVoice} onChange={e => { setTtsVoice(e.target.value); lastSpokenRef.current = null; }} className="detail__tts-select">
                    <option value="noemi">🎙️ Noémi (Nő)</option>
                    <option value="tamas">🎙️ Tamás (Férfi)</option>
                  </select>
                </label>
                <label className="detail__tts-label">
                  🎬 Videó sebesség:
                  <select value={ytSpeed} onChange={e => {
                    const s = parseFloat(e.target.value);
                    setYtSpeed(s);
                    if (ttsEnabled) {
                      try { playerRef.current?.setPlaybackRate(s); } catch {}
                      if (dubAudioRef.current) dubAudioRef.current.playbackRate = s;
                    }
                  }} className="detail__tts-select">
                    <option value="0.5">0.5× (nagyon lassú)</option>
                    <option value="0.75">0.75× ✅ ajánlott</option>
                    <option value="1">1× (normál)</option>
                  </select>
                </label>
                <label className="detail__tts-label">
                  🎙️ Magyar hang sebesség:
                  <select value={ttsRate} onChange={e => { setTtsRate(e.target.value); lastSpokenRef.current = null; }} className="detail__tts-select">
                    <option value="-15%">-15% (lassú)</option>
                    <option value="-10%">-10% ✅ ajánlott</option>
                    <option value="-5%">-5%</option>
                    <option value="0%">0% (normál)</option>
                    <option value="+10%">+10% (gyors)</option>
                    <option value="+20%">+20% (nagyon gyors)</option>
                  </select>
                </label>
                <label className="detail__tts-label">
                  Magasság:
                  <select value={ttsPitch} onChange={e => { setTtsPitch(e.target.value); lastSpokenRef.current = null; }} className="detail__tts-select">
                    <option value="-15Hz">-15Hz (mély)</option>
                    <option value="-10Hz">-10Hz</option>
                    <option value="-5Hz">-5Hz ✅ ajánlott</option>
                    <option value="0Hz">0Hz (alap)</option>
                    <option value="+5Hz">+5Hz</option>
                    <option value="+10Hz">+10Hz (magas)</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Cím + meta ── */}
      <div className="detail__header">
        <h2 className="detail__title">{title}</h2>
        <button
          className="detail__progress-btn"
          style={{ '--progress-color': PROGRESS_COLORS[progress] }}
          onClick={cycleProgress}
          title="Kattints a haladás váltásához"
        >
          <span className="detail__progress-dot" />
          {progress}
        </button>
        {!video.titleHu && (
          <button
            className="detail__translate-btn"
            disabled={translateStatus === 'loading'}
            onClick={async () => {
              setTranslateStatus('loading');
              try {
                const r = await fetch(`/api/videos/${id}/translate`, { method: 'POST' });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || 'Hiba');
                setVideo(v => ({ ...v, titleHu: d.titleHu, title_hu: d.titleHu, aiSummaryHu: v.aiSummaryHu || d.descriptionHu }));
                setTranslateStatus('done');
              } catch {
                setTranslateStatus('error');
              }
            }}
          >
            {translateStatus === 'loading' ? '⏳ Fordítás...' : translateStatus === 'error' ? '❌ Hiba' : '🇭🇺 Magyar fordítás'}
          </button>
        )}
        <div className="detail__meta">
          {channel && <span className="detail__channel-badge">{channel}</span>}
          {publishedAt && <span className="detail__date">📅 {publishedAt}</span>}
          {video.view_count > 0 && (
            <span className="detail__views">
              👁 {Number(video.view_count).toLocaleString('hu-HU')} megtekintés
            </span>
          )}
          {hasCues && <span className="detail__subtitle-badge">📝 Magyar felirat</span>}
        </div>
      </div>

      {/* ── Fejezetek ── */}
      {chapters.length > 0 && (
        <section className="detail__chapters">
          <h3 className="detail__section-title">📚 Fejezetek ({chapters.length})</h3>
          <ol className="chapters__list">
            {chapters.map((ch, i) => {
              const isActive = currentChapter === i;
              const duration = chapters[i + 1] ? chapters[i + 1].time - ch.time : null;
              const analysis = chapterAnalyses[i];
              const isExpanded = expandedAnalysis === i;

              return (
                <li key={i} className="chapters__item-wrap">
                  <div
                    className={`chapters__item${isActive ? ' chapters__item--active' : ''}`}
                    onClick={() => {
                      if (playerRef.current?.seekTo) playerRef.current.seekTo(ch.time, true);
                    }}
                  >
                    <span className="chapters__time">{ch.timeStr}</span>
                    <span className="chapters__title">{ch.title}</span>
                    {duration !== null && (
                      <span className="chapters__duration">
                        {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                      </span>
                    )}
                    <button
                      className={`chapters__ai-btn${isExpanded ? ' chapters__ai-btn--active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleAnalyzeChapter(i); }}
                      title="AI Elemzés kérése"
                    >
                      {analysis?.status === 'loading'
                        ? '⏳'
                        : isExpanded
                        ? '✕ Bezárás'
                        : '🤖 AI Elemzés'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className={`chapter-analysis${analysis?.status === 'loading' ? ' chapter-analysis--loading' : ''}`}>
                      {analysis?.status === 'loading' && (
                        <div className="chapter-analysis__loading">
                          <div className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} />
                          <span>Elemzés folyamatban...</span>
                        </div>
                      )}
                      {analysis?.status === 'done' && (
                        <div className="chapter-analysis__content">
                          {renderMarkdown(analysis.text)}
                        </div>
                      )}
                      {analysis?.status === 'error' && (
                        <div className="chapter-analysis__error">{analysis.text}</div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ── Fejezetek generálása (csak ha nincs fejezet, de van átírat) ── */}
      {chapters.length === 0 && cues.length > 0 && (
        <div className="chapters__generate">
          <button
            className="btn btn--primary"
            onClick={handleGenerateChapters}
            disabled={generatingChapters}
          >
            {generatingChapters ? '⏳ Generálás...' : '✨ Fejezetek automatikus generálása'}
          </button>
        </div>
      )}

      {/* ── Fejezetek szerkesztő ── */}
      <details className="chapters__editor">
        <summary>✏️ Fejezetek szerkesztése</summary>
        <textarea
          className="chapters__textarea"
          value={chapterInput}
          onChange={e => setChapterInput(e.target.value)}
          placeholder={'00:00 Bevezetés\n00:31 Következő fejezet\n...'}
          rows={8}
        />
        <button onClick={handleSaveChapters}>💾 Mentés</button>
      </details>

      {/* ── Magyar AI elemzés ── */}
      <section className="detail__section detail__analysis">
        <h3 className="detail__section-title">🎓 Videó elemzés – Magyar oktatói leírás</h3>
        {summary
          ? <div className="detail__summary">{renderMarkdown(summary)}</div>
          : ollamaStatus === 'loading'
            ? <p className="detail__summary--pending">⏳ Elemzés generálása... (kb. 1-2 perc)</p>
            : ollamaStatus === 'error'
              ? <p className="detail__summary--pending" style={{color:'#e74c3c'}}>❌ Elemzés sikertelen – próbáld újra.</p>
              : <div style={{display:'flex', flexDirection:'column', gap:'8px', alignItems:'flex-start'}}>
                  <p className="detail__summary--pending">Még nincs magyar elemzés ehhez a videóhoz.</p>
                  <button
                    className="detail__ollama-btn"
                    onClick={async () => {
                      setOllamaStatus('loading');
                      try {
                        const r = await fetch(`/api/videos/${id}/analyze-ollama`, { method: 'POST' });
                        const d = await r.json();
                        if (!r.ok) throw new Error(d.error || 'Hiba');
                        setVideo(v => ({ ...v, aiSummaryHu: d.summary }));
                        setOllamaStatus('done');
                      } catch {
                        setOllamaStatus('error');
                      }
                    }}
                  >
                    🤖 Elemzés generálása
                  </button>
                </div>
        }
      </section>

      {/* ── DAX függvények ── */}
      {video.daxFunctions?.length > 0 && (
        <section className="detail__section">
          <h3 className="detail__section-title">
            📐 DAX függvények a videóban ({video.daxFunctions.length})
          </h3>
          <div className="dax-grid">
            {video.daxFunctions.map((fn) => (
              <DaxCard key={fn.name} fn={fn} />
            ))}
          </div>
        </section>
      )}

      {/* ── Személyes jegyzetek ── */}
      <section className="detail__section detail__notes">
        <h3 className="detail__section-title">
          📝 Személyes jegyzetek
          {noteSaved && <span className="notes__saved-badge">✓ Mentve</span>}
        </h3>
        <textarea
          className="notes__textarea"
          value={note}
          onChange={handleNoteChange}
          placeholder="Ide írhatsz saját megjegyzéseket ehhez a videóhoz..."
          rows={4}
        />
      </section>

      {/* ── Kvíz ── */}
      {video.aiSummaryHu && (
        <section className="detail__section">
          <h3 className="detail__section-title">🎯 Tudás kvíz</h3>
          <p style={{fontSize:'0.85rem',color:'#666',marginBottom:'0.75rem'}}>Teszteld mit tanultál ebből a videóból – 5 kérdés, AI által generálva</p>
          <button
            className="quiz__start-btn"
            onClick={async () => {
              if (quizQuestions.length > 0) { setQuizOpen(true); return; }
              setQuizStatus('loading');
              setQuizOpen(true);
              try {
                const r = await fetch(`/api/videos/${id}/quiz`);
                const d = await r.json();
                if (!r.ok || !d.questions?.length) { setQuizStatus('error'); return; }
                setQuizQuestions(d.questions);
                setQuizAnswers({});
                setQuizSubmitted(false);
                setQuizStatus('ready');
              } catch { setQuizStatus('error'); }
            }}
          >
            🎯 Kvíz indítása
          </button>
        </section>
      )}

      {/* ── Kvíz Modal ── */}
      {quizOpen && (
        <div className="quiz__overlay" onClick={e => { if (e.target === e.currentTarget) setQuizOpen(false); }}>
          <div className="quiz__modal">
            <button className="quiz__close" onClick={() => setQuizOpen(false)}>✕</button>
            <h3 className="quiz__title">🎯 Kvíz</h3>
            <p className="quiz__subtitle">{video.titleHu || video.title}</p>

            {quizStatus === 'loading' && (
              <div style={{textAlign:'center',padding:'2rem'}}>
                <div className="spinner" style={{margin:'0 auto 1rem'}} />
                <p>AI kérdések generálása...</p>
              </div>
            )}

            {quizStatus === 'error' && (
              <p style={{color:'#dc2626',textAlign:'center',padding:'2rem'}}>
                ❌ Nem sikerült kvízt generálni – próbáld újra.
              </p>
            )}

            {quizStatus === 'ready' && (
              <>
                {quizQuestions.map((q, qi) => (
                  <div key={qi} className="quiz__question">
                    <p className="quiz__q-text">{qi + 1}. {q.q}</p>
                    <div className="quiz__options">
                      {q.options.map((opt, oi) => {
                        const selected = quizAnswers[qi] === oi;
                        const isCorrect = quizSubmitted && oi === q.correct;
                        const isWrong = quizSubmitted && selected && oi !== q.correct;
                        return (
                          <button
                            key={oi}
                            className={`quiz__option${selected ? ' quiz__option--selected' : ''}${isCorrect ? ' quiz__option--correct' : ''}${isWrong ? ' quiz__option--wrong' : ''}`}
                            disabled={quizSubmitted}
                            onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [qi]: oi }))}
                          >
                            <span className="quiz__option-letter">{['A','B','C','D'][oi]}</span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!quizSubmitted ? (
                  <button
                    className="quiz__submit-btn"
                    disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                    onClick={() => setQuizSubmitted(true)}
                  >
                    Ellenőrzés
                  </button>
                ) : (
                  <div className="quiz__result">
                    {(() => {
                      const score = quizQuestions.filter((q, i) => quizAnswers[i] === q.correct).length;
                      const pct = Math.round(score / quizQuestions.length * 100);
                      return (
                        <>
                          <p className="quiz__score">
                            {score === quizQuestions.length ? '🏆' : score >= 3 ? '✅' : '📚'} {score}/{quizQuestions.length} helyes ({pct}%)
                          </p>
                          <p className="quiz__score-msg">
                            {pct === 100 ? 'Tökéletes! Minden választ tudtál.' : pct >= 60 ? 'Jó eredmény! Még van mit tanulni.' : 'Érdemes még egyszer megnézni a videót.'}
                          </p>
                          <button className="quiz__retry-btn" onClick={() => {
                            setQuizAnswers({});
                            setQuizSubmitted(false);
                            setQuizQuestions([]);
                            setQuizStatus('idle');
                            setQuizOpen(false);
                          }}>
                            Új kvíz
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Kapcsolódó videók ── */}
      {relatedVideos.length > 0 && (
        <section className="detail__section">
          <h3 className="detail__section-title">🔗 Kapcsolódó videók</h3>
          <div className="related-grid">
            {relatedVideos.map(v => (
              <Link key={v.id} to={`/video/${v.id}`} className="related-card">
                {v.thumbnail_url && (
                  <img src={v.thumbnail_url} alt={v.title_hu || v.title} className="related-card__thumb" loading="lazy" />
                )}
                <div className="related-card__body">
                  <p className="related-card__title">{v.title_hu || v.title}</p>
                  <p className="related-card__channel">{v.channel_title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Megnyitás YouTube-on ── */}
      <div className="detail__yt-row">
        <a
          href={video.video_url || `https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="detail__yt-btn"
        >
          ▶ Megnyitás YouTube-on
        </a>
      </div>

      {/* ── AI Oldalpanel – mindig látható ── */}
      <aside className="detail__ai-panel">
        <div className="ai-panel__header">
          <span className="ai-panel__icon">🤖</span>
          <span className="ai-panel__title">AI Szakértői Kiegészítő</span>
          <span className="ai-panel__badge">Microsoft Learn</span>
        </div>

        {chapters.length > 0 ? (
          /* ── Fejezetes videó: fejezet-alapú elemzés ── */
          <>
            {panel.status === 'idle' && (
              <p className="ai-panel__idle">▶ Indítsd el a videót – fejezet váltáskor automatikusan betöltődik</p>
            )}
            {panel.status === 'loading' && (
              <div className="ai-panel__loading">
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} />
                <span>Elemzés: <strong>{panel.chapterTitle}</strong></span>
              </div>
            )}
            {panel.status === 'error' && (
              <p className="ai-panel__error">❌ Az elemzés nem sikerült – próbáld újra</p>
            )}
            {panel.status === 'ready' && (
              <>
                <div className="ai-panel__chapter-label">📌 {panel.chapterTitle}</div>
                <div className="ai-panel__content">{renderMarkdown(panel.analysis)}</div>
                {panel.sources?.length > 0 && (
                  <div className="ai-panel__sources">
                    <p className="ai-panel__sources-title">📚 Hivatalos források</p>
                    <ul>
                      {panel.sources.map((s, i) => (
                        <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* ── Fejezet nélküli videó: általános AI kiegészítő ── */
          <>
            {aiSupp.status === 'loading' && (
              <div className="ai-panel__loading">
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} />
                <span>Szakértői elemzés betöltése...</span>
              </div>
            )}
            {aiSupp.status === 'idle' && (
              <div>
                <p className="ai-panel__idle">Kattints az elemzés generálásához</p>
                <button className="detail__ollama-btn" style={{background:'#7c3aed',marginTop:'0.5rem'}} onClick={() => {
                  setAiSupp({ status: 'loading', text: '', sources: [] });
                  fetch(`/api/videos/${id}/ai-panel`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chapterTitle: '', chapterTime: 0, chapterEndTime: null }),
                  }).then(r => r.json()).then(d => {
                    if (d.analysis) {
                      const result = { text: d.analysis, sources: d.sources || [] };
                      localStorage.setItem(`pbi_ai_supp_${id}`, JSON.stringify(result));
                      setAiSupp({ status: 'ready', ...result });
                    }
                  }).catch(() => {});
                }}>🤖 Generálás</button>
              </div>
            )}
            {aiSupp.status === 'error' && (
              <p className="ai-panel__error">❌ Elemzés sikertelen – próbáld újra</p>
            )}
            {aiSupp.status === 'ready' && (
              <>
                <div className="ai-panel__content">{renderMarkdown(aiSupp.text)}</div>
                {aiSupp.sources?.length > 0 && (
                  <div className="ai-panel__sources">
                    <p className="ai-panel__sources-title">📚 Hivatalos források</p>
                    <ul>
                      {aiSupp.sources.map((s, i) => (
                        <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
                <button style={{fontSize:'0.75rem',color:'#64748b',background:'none',border:'1px solid #e2e8f0',borderRadius:5,padding:'3px 8px',cursor:'pointer',marginTop:'0.75rem'}}
                  onClick={() => {
                    localStorage.removeItem(`pbi_ai_supp_${id}`);
                    setAiSupp({ status: 'loading', text: '', sources: [] });
                    fetch(`/api/videos/${id}/ai-panel`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ chapterTitle: '', chapterTime: 0, chapterEndTime: null }),
                    }).then(r => r.json()).then(d => {
                      if (d.analysis) {
                        const result = { text: d.analysis, sources: d.sources || [] };
                        localStorage.setItem(`pbi_ai_supp_${id}`, JSON.stringify(result));
                        setAiSupp({ status: 'ready', ...result });
                      }
                    }).catch(() => {});
                  }}>↺ Újragenerálás</button>
              </>
            )}
          </>
        )}
      </aside>
    </article>
  );
}

export default VideoDetail;
