/**
 * @file Home.jsx
 * @description Főoldal – napi Top 10 Power BI videó kártyákban megjelenítve.
 * Tartalmaz szűrőt, frissítés gombot, betöltési és hibakezelési állapotot.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

/**
 * Egy DAX függvény badge-et renderel.
 *
 * @param {{ name: string }} props
 * @returns {JSX.Element}
 */
function DaxBadge({ name }) {
  return <span className="dax-badge">{name}</span>;
}

/**
 * Egyetlen videókártyát renderel.
 *
 * @param {{ video: object }} props
 * @returns {JSX.Element}
 */
const PROG_COLOR = { 'Tanulom': '#f59e0b', 'Kész': '#16a34a' };

function VideoCard({ video }) {
  let daxFunctions = [];
  try {
    if (video.dax_functions) daxFunctions = JSON.parse(video.dax_functions);
  } catch (e) {
    console.warn(`Hibás DAX JSON a videónál (${video.id}):`, e);
  }

  const displayTitle = video.titleHu || video.title || '(Cím nélkül)';
  const score = typeof video.score === 'number' ? Math.round(video.score) : null;
  const progress = localStorage.getItem(`pbi_progress_${video.id}`) || 'Nem kezdtem';

  const ytUrl = video.video_url || `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <article className="video-card">
      <Link to={`/video/${video.id}`} className="video-card__thumb-link">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={displayTitle}
            className="video-card__thumb"
            loading="lazy"
          />
        ) : (
          <div className="video-card__thumb-placeholder">▶</div>
        )}
      </Link>
      <div className="video-card__body">
        <Link to={`/video/${video.id}`} className="video-card__title">
          {displayTitle}
        </Link>
        <p className="video-card__channel">{video.channel_title || '—'}</p>
        <div className="video-card__meta">
          {progress !== 'Nem kezdtem' && (
            <span className="video-card__progress-badge" style={{ background: PROG_COLOR[progress] + '20', color: PROG_COLOR[progress] }}>
              ● {progress}
            </span>
          )}
          {score !== null && score > 0 && (
            <span className="video-card__score" title="Relevancia pontszám">
              ⭐ {score} pont
            </span>
          )}
          {video.view_count > 0 && (
            <span className="video-card__views">
              👁 {Number(video.view_count).toLocaleString('hu-HU')}
            </span>
          )}
          {video.published_at && (
            <span className="video-card__date">
              {new Date(video.published_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          )}
          {video.transcriptAvailable && (
            <span className="video-card__transcript-badge">📝 Felirat</span>
          )}
        </div>
        {daxFunctions.length > 0 && (
          <div className="video-card__dax">
            {daxFunctions.slice(0, 5).map((fn) => (
              <DaxBadge key={fn} name={fn} />
            ))}
            {daxFunctions.length > 5 && (
              <span className="dax-badge dax-badge--more">
                +{daxFunctions.length - 5}
              </span>
            )}
          </div>
        )}
        <a
          href={ytUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="video-card__yt-link"
          title="Megnyitás YouTube-on"
          onClick={(e) => e.stopPropagation()}
        >
          ▶ YouTube
        </a>
      </div>
    </article>
  );
}

/**
 * Home oldal komponens – napi Top 10 videók listája.
 *
 * @returns {JSX.Element} A főoldal tartalma
 */
function Home() {
  const [videos, setVideos] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'empty' | 'error' | 'no-ytdlp'
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'dax'
  const [refreshing, setRefreshing] = useState(false);
  const [translateProg, setTranslateProg] = useState(null); // null | { running, done, total, current }
  const [genChaptersStatus, setGenChaptersStatus] = useState('idle'); // idle | running | done
  const [refreshStatus, setRefreshStatus] = useState(null); // null | { running, progress, total, lastMessage }

  // Értesítések – új videó figyelő
  useEffect(() => {
    async function checkNewVideos() {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();
        const newCount = data.total || 0;
        const knownCount = parseInt(localStorage.getItem('pbi_known_video_count') || '0', 10);
        if (knownCount > 0 && newCount > knownCount) {
          const diff = newCount - knownCount;
          if (Notification.permission === 'granted') {
            new Notification('Power BI Tracker – Új videók!', {
              body: `${diff} új videó érkezett a csatornákra 🎬`,
              icon: '/favicon.ico',
            });
          }
        }
        if (newCount > 0) localStorage.setItem('pbi_known_video_count', String(newCount));
      } catch { /* silent */ }
    }

    // Engedélykérés + első ellenőrzés
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    checkNewVideos();

    // 30 percenkénti ellenőrzés
    const notifInterval = setInterval(checkNewVideos, 30 * 60 * 1000);
    return () => clearInterval(notifInterval);
  }, []);

  /** Top 10 lista betöltése a backendről. */
  const loadVideos = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/top10');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.videos ?? [];
      setVideos(list);
      setLastUpdated(data.lastUpdated || null);
      setStatus(list.length === 0 ? 'empty' : 'ok');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Állapot polling (frissítés + fordítás)
  // Aktív futás esetén 1.5s, egyébként 8s – akkumulátor és hálózat kímélése mobilon
  useEffect(() => {
    let timer;

    const poll = async () => {
      try {
        // 1. Scheduler állapot (frissítés)
        const resStat = await fetch('/api/status');
        if (resStat.ok) {
          const data = await resStat.json();
          setRefreshStatus(data.running ? data : null);
          if (refreshing && !data.running) {
            setRefreshing(false);
            loadVideos();
          }
        }

        // 2. Fordítás folyamat polling
        const resTrans = await fetch('/api/translate-all/progress');
        if (resTrans.ok) {
          const data = await resTrans.json();
          setTranslateProg(data.total > 0 ? data : null);
        }
      } catch { /* silent */ }
    };

    const schedule = async () => {
      await poll();
      // Ha aktív folyamat van, 1.5s; ha nem, 8s
      const activeNow = refreshing || (translateProg?.running);
      timer = setTimeout(schedule, activeNow ? 1500 : 8000);
    };

    schedule();
    return () => clearTimeout(timer);
  }, [refreshing, translateProg?.running, loadVideos]);

  /** Frissítés gomb: POST /api/refresh */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setStatus('no-ytdlp');
          setErrorMessage(data.message || 'yt-dlp nincs telepítve');
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await loadVideos();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateAllChapters = async () => {
    setGenChaptersStatus('running');
    try {
      const res = await fetch('/api/videos/generate-chapters-all', { method: 'POST' });
      const data = await res.json();
      setGenChaptersStatus('done');
      setTimeout(() => setGenChaptersStatus('idle'), 5000);
      console.log(`Fejezet generálás indul: ${data.total} videóhoz`);
    } catch {
      setGenChaptersStatus('idle');
    }
  };

  /** Szűrt videók */
  const filtered =
    filter === 'dax'
      ? videos.filter((v) => {
          try {
            const fns = v.dax_functions ? JSON.parse(v.dax_functions) : [];
            return fns.length > 0;
          } catch (e) {
            return false;
          }
        })
      : videos;

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString('hu-HU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <main className="home">
      <div className="home__toolbar">
        <div className="home__filter">
          <button
            className={`filter-btn${filter === 'all' ? ' filter-btn--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Összes
          </button>
          <button
            className={`filter-btn${filter === 'dax' ? ' filter-btn--active' : ''}`}
            onClick={() => setFilter('dax')}
          >
            Csak DAX videók
          </button>
        </div>
        <div className="home__actions">
          {formattedDate && (
            <span className="home__last-updated">
              Utolsó frissítés: {formattedDate}
            </span>
          )}
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing || status === 'loading'}
          >
            {refreshing ? 'Frissítés...' : '🔄 Frissítés most'}
          </button>
          <button
            className="refresh-btn"
            onClick={handleGenerateAllChapters}
            disabled={genChaptersStatus === 'running'}
            title="Fejezetek automatikus generálása minden videóhoz, aminél még nincs"
          >
            {genChaptersStatus === 'running' ? '⏳ Fejezetek...' : genChaptersStatus === 'done' ? '✅ Kész!' : '✨ Fejezetek generálása'}
          </button>
        </div>
      </div>

      {refreshStatus && (
        <div className="translate-progress refresh-progress">
          <div className="translate-progress__header">
            <span className="translate-progress__label">
              🔄 Videógyűjtés folyamatban...
            </span>
            <span className="translate-progress__count">
              {refreshStatus.progress} / {refreshStatus.total} csatorna
            </span>
          </div>
          <div className="translate-progress__bar-bg">
            <div
              className="translate-progress__bar-fill translate-progress__bar-fill--refresh"
              style={{ width: `${Math.round((refreshStatus.progress / refreshStatus.total) * 100)}%` }}
            />
          </div>
          <div className="translate-progress__current">
            {refreshStatus.lastMessage || 'Csatornák átvizsgálása...'}
          </div>
        </div>
      )}

      {translateProg && (
        <div className="translate-progress">
          <div className="translate-progress__header">
            <span className="translate-progress__label">
              {translateProg.running ? '🇭🇺 Fordítás folyamatban...' : '✅ Fordítás kész!'}
            </span>
            <span className="translate-progress__count">
              {translateProg.done} / {translateProg.total}
            </span>
          </div>
          <div className="translate-progress__bar-bg">
            <div
              className="translate-progress__bar-fill"
              style={{ width: `${Math.round((translateProg.done / translateProg.total) * 100)}%` }}
            />
          </div>
          {translateProg.running && translateProg.current && (
            <div className="translate-progress__current" title={translateProg.current}>
              {translateProg.current.length > 60 ? translateProg.current.slice(0, 60) + '…' : translateProg.current}
            </div>
          )}
        </div>
      )}

      {status === 'loading' && (
        <div className="home__state">
          <div className="spinner" aria-label="Betöltés..." />
          <p>Betöltés...</p>
        </div>
      )}

      {status === 'no-ytdlp' && (
        <div className="install-guide" data-testid="install-guide">
          <h2 className="install-guide__title">⚠️ yt-dlp telepítés szükséges</h2>
          <p className="install-guide__intro">
            A videógyűjtéshez szükséges a <strong>yt-dlp</strong> eszköz. Kövesd az alábbi lépéseket:
          </p>
          <ol className="install-guide__steps">
            <li>
              Nyisd meg a{' '}
              <a
                href="https://github.com/yt-dlp/yt-dlp/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="install-guide__link"
              >
                yt-dlp Releases oldalt
              </a>
            </li>
            <li>
              Töltsd le a rendszerednek megfelelő fájlt:
              <ul className="install-guide__sub">
                <li><strong>Windows:</strong> <code>yt-dlp.exe</code></li>
                <li><strong>macOS/Linux:</strong> <code>yt-dlp</code></li>
              </ul>
            </li>
            <li>
              Másold a fájlt egy olyan mappába, amely szerepel a <code>PATH</code>-ban
              (pl. <code>C:\Windows\System32</code> Windows-on, vagy <code>/usr/local/bin</code> macOS/Linux-on)
            </li>
            <li>
              Ellenőrizd a telepítést terminálban:
              <pre className="install-guide__code">yt-dlp --version</pre>
            </li>
            <li>Ezután kattints a „Frissítés most" gombra fent.</li>
          </ol>
          <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Ellenőrzés...' : '🔄 Újrapróbálás'}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="home__state home__state--error">
          <p className="home__state-title">❌ Hiba történt</p>
          <p>{errorMessage}</p>
          <button className="refresh-btn" onClick={loadVideos}>
            Újrapróbálás
          </button>
        </div>
      )}

      {status === 'empty' && (
        <div className="home__state">
          <p className="home__state-title">Még nincsenek videók</p>
          <p>Kattints a „Frissítés most" gombra az első gyűjtés indításához.</p>
        </div>
      )}

      {status === 'ok' && (
        <>
          <h2 className="home__subtitle">
            Napi Top {filtered.length} Power BI videó
          </h2>
          {filtered.length === 0 ? (
            <p className="home__no-results">
              Nincs DAX videó a listában. Próbáld az „Összes" nézetet.
            </p>
          ) : (
            <div className="video-grid" data-testid="video-grid">
              {filtered.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default Home;
