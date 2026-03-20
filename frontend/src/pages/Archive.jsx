/**
 * @file Archive.jsx
 * @description Archívum oldal – manuálisan importált és elemzett videók.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Archive() {
  const [videos, setVideos] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    fetch('/api/archive')
      .then((res) => res.json())
      .then((data) => {
        setVideos(data.videos || []);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="archive-state">
        <div className="spinner" aria-label="Betöltés..." />
        <p>Betöltés...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="archive-state archive-state--error">
        <p>❌ Nem sikerült betölteni az archívumot.</p>
      </div>
    );
  }

  return (
    <div className="archive">
      <div className="archive__header">
        <h2 className="archive__title">📁 Archívum</h2>
        <p className="archive__subtitle">
          Manuálisan hozzáadott és elemzett videók – ezek frissítéskor megmaradnak.
        </p>
        <Link to="/import" className="archive__add-btn">+ Videó hozzáadása</Link>
      </div>

      {videos.length === 0 ? (
        <div className="archive__empty">
          <p>Még nincs archivált videó.</p>
          <Link to="/import" className="archive__add-btn">Adj hozzá egyet →</Link>
        </div>
      ) : (
        <div className="archive__list">
          {videos.map((video) => {
            const title = video.title_hu || video.title || '';
            const channel = video.channel_title || '';
            const date = video.published_at
              ? new Date(video.published_at).toLocaleDateString('hu-HU', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })
              : null;

            return (
              <article key={video.id} className="archive-card">
                {video.thumbnail_url && (
                  <Link to={`/video/${video.id}`} className="archive-card__thumb-link">
                    <img
                      src={video.thumbnail_url}
                      alt={title}
                      className="archive-card__thumb"
                    />
                  </Link>
                )}
                <div className="archive-card__body">
                  <Link to={`/video/${video.id}`} className="archive-card__title">
                    {title}
                  </Link>
                  <div className="archive-card__meta">
                    {channel && <span className="archive-card__channel">{channel}</span>}
                    {date && <span className="archive-card__date">📅 {date}</span>}
                    {video.transcriptAvailable && (
                      <span className="archive-card__badge">📝 Magyar felirat</span>
                    )}
                    {video.dax_mentions > 0 && (
                      <span className="archive-card__badge archive-card__badge--dax">
                        📐 {video.dax_mentions} DAX
                      </span>
                    )}
                  </div>
                  <div className="archive-card__actions">
                    <Link to={`/video/${video.id}`} className="archive-card__detail-btn">
                      Elemzés megtekintése →
                    </Link>
                    <a
                      href={video.video_url || `https://www.youtube.com/watch?v=${video.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="archive-card__yt-link"
                    >
                      ▶ YouTube
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Archive;
