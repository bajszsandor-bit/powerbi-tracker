/**
 * @file VideoDetail.jsx
 * @description Videó részletes oldal – YouTube iframe és magyar AI oktatói elemzés.
 */

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    setStatus('loading');
    fetch(`/api/videos/${id}`)
      .then((res) => {
        if (res.status === 404) { setStatus('notfound'); return null; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => { if (data) { setVideo(data); setStatus('ok'); } })
      .catch((err) => { setStatus('error'); setErrorMsg(err.message); });
  }, [id]);

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

  // Összefoglaló: AI > lefordított leírás > angol leírás
  const summary = video.aiSummaryHu || video.description_hu || video.description || null;

  return (
    <article className="detail">
      <nav className="detail__nav">
        <Link to="/" className="back-link">← Vissza a listához</Link>
      </nav>

      {/* ── Videó lejátszó ── */}
      <div className="detail__player">
        <iframe
          className="detail__iframe"
          src={`https://www.youtube-nocookie.com/embed/${video.id}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
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
        </div>
      </div>

      {/* ── Magyar AI elemzés ── */}
      {summary && (
        <section className="detail__section detail__analysis">
          <h3 className="detail__section-title">
            🎓 Videó elemzés – Magyar oktatói leírás
          </h3>
          <div className="detail__summary">
            {renderMarkdown(summary)}
          </div>
        </section>
      )}

      {/* ── DAX függvények ── */}
      {video.daxFunctions && video.daxFunctions.length > 0 && (
        <section className="detail__section">
          <h3 className="detail__section-title">
            📐 DAX függvények a videóban ({video.daxFunctions.length})
          </h3>
          <div className="dax-grid">
            {video.daxFunctions.map((fn) => (
              <div key={fn.name} className="dax-card">
                <h4 className="dax-card__name">{fn.name}</h4>
                {fn.description && <p className="dax-card__desc">{fn.description}</p>}
                {fn.example && (
                  <pre className="dax-card__code"><code>{fn.example}</code></pre>
                )}
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
