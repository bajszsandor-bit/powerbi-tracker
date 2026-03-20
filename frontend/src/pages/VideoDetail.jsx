/**
 * @file VideoDetail.jsx
 * @description Videó részletes oldal – YouTube iframe, magyar/angol cím+leírás toggle,
 * felirat szöveg panel, DAX függvények szekció szintaxis kiemeléssel.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * Egy DAX függvény kártyát renderel névvel, leírással és példakóddal.
 *
 * @param {{ fn: { name: string, description: string, example: string } }} props
 * @returns {JSX.Element}
 */
function DaxCard({ fn }) {
  return (
    <div className="dax-card">
      <h4 className="dax-card__name">{fn.name}</h4>
      {fn.description && (
        <p className="dax-card__desc">{fn.description}</p>
      )}
      {fn.example && (
        <pre className="dax-card__code"><code>{fn.example}</code></pre>
      )}
    </div>
  );
}

/**
 * Videó részletes oldal komponens.
 * Betölti a /api/videos/:id endpointot és megjeleníti az adatokat.
 *
 * @returns {JSX.Element}
 */
function VideoDetail() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error' | 'notfound'
  const [errorMsg, setErrorMsg] = useState('');
  const [langMode, setLangMode] = useState('hu'); // 'hu' | 'en'

  useEffect(() => {
    setStatus('loading');
    fetch(`/api/videos/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setStatus('notfound');
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setVideo(data);
        setStatus('ok');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message);
      });
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
        <Link to="/" className="back-link">← Vissza a főoldalra</Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="detail-state detail-state--error">
        <p className="detail-state__title">❌ Hiba történt</p>
        <p>{errorMsg}</p>
        <Link to="/" className="back-link">← Vissza a főoldalra</Link>
      </div>
    );
  }

  const displayTitle = langMode === 'hu' && video.titleHu
    ? video.titleHu
    : video.title;

  const displayDescription = langMode === 'hu' && video.description_hu
    ? video.description_hu
    : video.description;

  const displayTranscript = langMode === 'hu' && video.transcript_hu
    ? video.transcript_hu
    : video.transcript;

  const hasBothLang = video.titleHu || video.description_hu || video.transcript_hu;

  return (
    <article className="detail">
      <nav className="detail__nav">
        <Link to="/" className="back-link">← Vissza a főoldalra</Link>
      </nav>

      {/* YouTube iframe */}
      <div className="detail__player">
        <iframe
          className="detail__iframe"
          src={`https://www.youtube-nocookie.com/embed/${video.id}`}
          title={displayTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Cím + metaadatok */}
      <div className="detail__header">
        <h2 className="detail__title">{displayTitle}</h2>
        <p className="detail__channel">{video.channel_title}</p>
        <div className="detail__meta">
          {video.published_at && (
            <span>{new Date(video.published_at).toLocaleDateString('hu-HU')}</span>
          )}
          {video.view_count > 0 && (
            <span>👁 {video.view_count.toLocaleString('hu-HU')} megtekintés</span>
          )}
          {video.like_count > 0 && (
            <span>👍 {video.like_count.toLocaleString('hu-HU')}</span>
          )}
        </div>

        {/* Nyelv toggle */}
        {hasBothLang && (
          <div className="lang-toggle">
            <button
              className={`lang-btn${langMode === 'hu' ? ' lang-btn--active' : ''}`}
              onClick={() => setLangMode('hu')}
            >
              Magyar
            </button>
            <button
              className={`lang-btn${langMode === 'en' ? ' lang-btn--active' : ''}`}
              onClick={() => setLangMode('en')}
            >
              English
            </button>
          </div>
        )}
      </div>

      {/* Leírás */}
      {displayDescription && (
        <section className="detail__section">
          <h3 className="detail__section-title">Leírás</h3>
          <p className="detail__description">{displayDescription}</p>
        </section>
      )}

      {/* Felirat */}
      {video.transcriptAvailable && displayTranscript && (
        <section className="detail__section">
          <h3 className="detail__section-title">
            📝 Felirat {langMode === 'hu' ? '(Magyar)' : '(English)'}
          </h3>
          <div className="detail__transcript" data-testid="transcript-panel">
            <p>{displayTranscript}</p>
          </div>
        </section>
      )}

      {/* DAX függvények */}
      {video.daxFunctions && video.daxFunctions.length > 0 && (
        <section className="detail__section" data-testid="dax-section">
          <h3 className="detail__section-title">
            DAX függvények ({video.daxFunctions.length})
          </h3>
          <div className="dax-grid">
            {video.daxFunctions.map((fn) => (
              <DaxCard key={fn.name} fn={fn} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

export default VideoDetail;
