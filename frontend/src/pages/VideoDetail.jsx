/**
 * @file VideoDetail.jsx
 * @description Videó részletes oldal – automatikus magyar felirat + TTS szinkronhang + fejezet navigátor.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

/** **félkövér** → <strong> konverzió egyszerű markdown-ból */
function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    );
    return (
      <span key={i}>
        {rendered}
        {'\n'}
      </span>
    );
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

  // Fejezetek
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapterInput, setChapterInput] = useState('');

  // AI fejezet elemzés
  const [chapterAnalyses, setChapterAnalyses] = useState({});  // index → { status, text }
  const [expandedAnalysis, setExpandedAnalysis] = useState(null);

  // Refs – ezeket nem kell újra-renderelni
  const ttsEnabledRef = useRef(false);
  const lastSpokenRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const cuesRef = useRef([]);
  const chaptersRef = useRef([]);

  // ttsEnabled → ref szinkronizálás
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
    if (!ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [ttsEnabled]);

  // cues → ref szinkronizálás
  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);

  // chapters → ref szinkronizálás
  useEffect(() => {
    chaptersRef.current = chapters;
    // Amikor fejezetek betöltődnek, pre-fill textarea szerkesztőhöz
    if (chapters.length) {
      setChapterInput(chapters.map(ch => `${ch.timeStr} ${ch.title}`).join('\n'));
    }
  }, [chapters]);

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
        }
      })
      .catch((err) => { setStatus('error'); setErrorMsg(err.message); });
  }, [id]);

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
      .catch((err) => {
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

          // Felirat követés
          const cue = cuesRef.current.find((c) => t >= c.start && t < c.end);
          setCurrentSubtitle(cue ? cue.text : '');

          if (ttsEnabledRef.current && cue && cue !== lastSpokenRef.current) {
            lastSpokenRef.current = cue;
            // Edge TTS – Microsoft Neural hang (sokkal természetesebb)
            fetch('/api/tts/speak', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: cue.text, voice: 'noemi' }),
            })
              .then((r) => r.blob())
              .then((blob) => {
                if (!ttsEnabledRef.current) return; // közben kikapcsolták
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.onended = () => URL.revokeObjectURL(url);
                audio.play().catch(() => {});
              })
              .catch(() => {
                // Edge TTS nem elérhető → fallback böngésző TTS
                if (!window.speechSynthesis) return;
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(cue.text);
                utter.lang = 'hu-HU';
                utter.rate = 1.05;
                window.speechSynthesis.speak(utter);
              });
          }

          // Fejezet követés
          if (chaptersRef.current.length) {
            let idx = 0;
            for (let ci = 0; ci < chaptersRef.current.length; ci++) {
              if (t >= chaptersRef.current[ci].time) idx = ci;
            }
            setCurrentChapter(idx);
          }
        } catch { /* player nem kész */ }
      }, 300);
    }

    function createPlayer() {
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = new window.YT.Player('yt-player', {
        events: { onReady(e) { startPolling(e.target); } },
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
  const summary = video.aiSummaryHu || video.description_hu || video.description || null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const iframeSrc = `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&origin=${origin}`;

  function subtitleText() {
    if (subtitleStatus === 'loading') return '⏳ Magyar felirat betöltése...';
    if (subtitleStatus === 'unavailable') {
      if (chapters.length > 0) return '⚠️ Automatikus felirat nem elérhető – Fejezetalapú tanulás aktív';
      return 'Ehhez a videóhoz nincs automatikus felirat';
    }
    if (!hasCues) return '⏳ Felirat előkészítése...';
    return currentSubtitle || '▶ Indítsd el a videót a felirathoz';
  }

  return (
    <article className="detail">
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

        {/* ── Felirat sáv ── */}
        <div className={`detail__subtitle-bar${hasCues && currentSubtitle ? ' detail__subtitle-bar--active' : ''}`}>
          <span className="detail__subtitle-bar__flag">🇭🇺</span>
          <p className="detail__subtitle-bar__text">{subtitleText()}</p>
          {hasCues && (
            <button
              className={`detail__tts-btn${ttsEnabled ? ' detail__tts-btn--on' : ''}`}
              onClick={() => setTtsEnabled((v) => !v)}
              title={ttsEnabled ? 'Magyar szinkronhang kikapcsolása' : 'Magyar szinkronhang bekapcsolása (Noémi Neural)'}
            >
              {ttsEnabled ? '🔊 Szinkron BE' : '🎙️ Szinkronhang'}
            </button>
          )}
        </div>
      </div>

      {/* ── Cím + meta ── */}
      <div className="detail__header">
        <h2 className="detail__title">{title}</h2>
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
      {summary && (
        <section className="detail__section detail__analysis">
          <h3 className="detail__section-title">🎓 Videó elemzés – Magyar oktatói leírás</h3>
          <div className="detail__summary">{renderMarkdown(summary)}</div>
        </section>
      )}

      {/* ── DAX függvények ── */}
      {video.daxFunctions?.length > 0 && (
        <section className="detail__section">
          <h3 className="detail__section-title">
            📐 DAX függvények a videóban ({video.daxFunctions.length})
          </h3>
          <div className="dax-grid">
            {video.daxFunctions.map((fn) => (
              <div key={fn.name} className="dax-card">
                <h4 className="dax-card__name">{fn.name}</h4>
                {fn.description && <p className="dax-card__desc">{fn.description}</p>}
                {fn.example && <pre className="dax-card__code"><code>{fn.example}</code></pre>}
              </div>
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
    </article>
  );
}

export default VideoDetail;
