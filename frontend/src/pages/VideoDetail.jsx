/**
 * @file VideoDetail.jsx
 * @description Videó részletes oldal – YouTube iframe és magyar leírás/elemzés.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

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
  const description = video.description_hu || video.description || '';
  const channel = video.channel_title || '';
  const publishedAt = video.published_at
    ? new Date(video.published_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <article className="detail">
      <nav className="detail__nav">
        <Link to="/" className="back-link">← Vissza</Link>
      </nav>

      {/* Videó lejátszó */}
      <div className="detail__player">
        <iframe
          className="detail__iframe"
          src={`https://www.youtube-nocookie.com/embed/${video.id}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Cím + csatorna + dátum */}
      <div className="detail__header">
        <h2 className="detail__title">{title}</h2>
        <div className="detail__meta">
          {channel && <span className="detail__channel">{channel}</span>}
          {publishedAt && <span>{publishedAt}</span>}
          {video.view_count > 0 && (
            <span>👁 {Number(video.view_count).toLocaleString('hu-HU')}</span>
          )}
        </div>
      </div>

      {/* Magyar oktató leírás */}
      {description && (
        <section className="detail__section">
          <h3 className="detail__section-title">📋 Videó tartalma</h3>
          <p className="detail__description">{description}</p>
        </section>
      )}

      {/* DAX függvények – ha van */}
      {video.daxFunctions && video.daxFunctions.length > 0 && (
        <section className="detail__section">
          <h3 className="detail__section-title">
            📐 DAX függvények ({video.daxFunctions.length})
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
    </article>
  );
}

export default VideoDetail;
