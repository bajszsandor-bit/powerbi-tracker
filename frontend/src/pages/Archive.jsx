/**
 * @file Archive.jsx
 * @description Archívum oldal – tanulás-fókuszú nézet fejezet- és AI-metaadatokkal.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SORT_OPTIONS = [
  { value: 'date',     label: '📅 Dátum szerint' },
  { value: 'chapters', label: '📚 Fejezetek szerint' },
  { value: 'dax',      label: '📐 DAX count szerint' },
];

function Archive() {
  const [videos, setVideos]   = useState([]);
  const [status, setStatus]   = useState('loading');
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState('date');

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
        <p>Nem sikerült betölteni az archívumot.</p>
      </div>
    );
  }

  // Filter
  const query = search.toLowerCase();
  const filtered = videos.filter((v) => {
    const title = (v.title_hu || v.title || '').toLowerCase();
    const channel = (v.channel_title || '').toLowerCase();
    return title.includes(query) || channel.includes(query);
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'chapters') {
      const ca = a.chapters_count ?? 0;
      const cb = b.chapters_count ?? 0;
      return cb - ca;
    }
    if (sortBy === 'dax') {
      return (b.dax_mentions ?? 0) - (a.dax_mentions ?? 0);
    }
    // date (default)
    const da = a.published_at ? new Date(a.published_at) : new Date(0);
    const db = b.published_at ? new Date(b.published_at) : new Date(0);
    return db - da;
  });

  return (
    <div className="archive">
      <div className="archive__header">
        <div className="archive__header-top">
          <div>
            <h2 className="archive__title">Archívum</h2>
            <p className="archive__subtitle">
              Manuálisan hozzáadott és elemzett videók – {videos.length} videó mentve
            </p>
          </div>
          <Link to="/import" className="archive__add-btn">+ Videó hozzáadása</Link>
        </div>

        <div className="archive__toolbar">
          <input
            type="text"
            className="archive__search"
            placeholder="Keresés cím vagy csatorna alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="archive__sort">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`archive__sort-btn${sortBy === opt.value ? ' archive__sort-btn--active' : ''}`}
                onClick={() => setSortBy(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="archive__empty">
          {search ? (
            <p>Nincs találat a „{search}" keresésre.</p>
          ) : (
            <>
              <p>Még nincs archivált videó.</p>
              <Link to="/import" className="archive__add-btn">Adj hozzá egyet →</Link>
            </>
          )}
        </div>
      ) : (
        <div className="archive__list">
          {sorted.map((video) => {
            const title      = video.title_hu || video.title || '';
            const channel    = video.channel_title || '';
            const date       = video.published_at
              ? new Date(video.published_at).toLocaleDateString('hu-HU', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })
              : null;
            const chapterCount = video.chapters_count ?? 0;
            const hasSubtitles = Boolean(video.transcriptAvailable || video.has_transcript);
            const hasHuCues    = Boolean(video.transcript_cues_hu);
            const hasAi        = Boolean(video.ai_summary_hu);

            return (
              <article key={video.id} className="archive-card">
                {video.thumbnail_url ? (
                  <Link to={`/video/${video.id}`} className="archive-card__thumb-link">
                    <img
                      src={video.thumbnail_url}
                      alt={title}
                      className="archive-card__thumb"
                    />
                  </Link>
                ) : (
                  <Link to={`/video/${video.id}`} className="archive-card__thumb-link">
                    <div className="archive-card__thumb-placeholder">▶</div>
                  </Link>
                )}

                <div className="archive-card__body">
                  <Link to={`/video/${video.id}`} className="archive-card__title">
                    {title}
                  </Link>

                  <div className="archive-card__meta">
                    {channel && <span className="archive-card__channel">{channel}</span>}
                    {date    && <span className="archive-card__date">📅 {date}</span>}
                  </div>

                  <div className="archive-card__learning-meta">
                    {chapterCount > 0 && (
                      <span className="archive-card__learn-badge archive-card__learn-badge--chapters">
                        📚 {chapterCount} fejezet
                      </span>
                    )}
                    {hasHuCues && (
                      <span className="archive-card__learn-badge archive-card__learn-badge--subtitle">
                        Magyar felirat ✓
                      </span>
                    )}
                    {!hasHuCues && hasSubtitles && (
                      <span className="archive-card__learn-badge archive-card__learn-badge--subtitle-en">
                        Felirat ✓
                      </span>
                    )}
                    {hasAi && (
                      <span className="archive-card__learn-badge archive-card__learn-badge--ai">
                        AI elemzés ✓
                      </span>
                    )}
                    {video.dax_mentions > 0 && (
                      <span className="archive-card__learn-badge archive-card__learn-badge--dax">
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
