/**
 * @file LearningPath.jsx
 * @description Tanulási útvonal – 3 szint (Kezdő / Középhaladó / Haladó) videólistával és haladás követéssel.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function formatDuration(secs) {
  if (!secs) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}ó ${m}p`;
  return `${m} perc`;
}

function PathCard({ path, expanded, onToggle }) {
  const [progMap, setProgMap] = useState({});

  useEffect(() => {
    const map = {};
    path.videos.forEach(v => {
      map[v.id] = localStorage.getItem(`pbi_progress_${v.id}`) || 'Nem kezdtem';
    });
    setProgMap(map);
  }, [path.videos]);

  const doneCount = path.videos.filter(v => progMap[v.id] === 'Kész').length;
  const learningCount = path.videos.filter(v => progMap[v.id] === 'Tanulom').length;
  const pct = path.videos.length > 0 ? Math.round((doneCount / path.videos.length) * 100) : 0;

  return (
    <div className="lp-card" style={{ borderTopColor: path.color }}>
      <div className="lp-card__header" onClick={onToggle}>
        <div className="lp-card__title-row">
          <span className="lp-card__icon">{path.icon}</span>
          <div>
            <h3 className="lp-card__title" style={{ color: path.color }}>{path.title}</h3>
            <p className="lp-card__desc">{path.description}</p>
          </div>
        </div>
        <div className="lp-card__meta">
          <span className="lp-card__count">{path.videos.length} videó</span>
          <span className="lp-card__done" style={{ color: path.color }}>{doneCount} kész</span>
          <span className="lp-card__toggle">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Haladás sáv */}
      <div className="lp-progress-bar">
        <div className="lp-progress-fill" style={{ width: `${pct}%`, background: path.color }} />
      </div>
      <div className="lp-progress-label">
        <span>{doneCount}/{path.videos.length} kész</span>
        {learningCount > 0 && <span style={{ color: '#f59e0b' }}>{learningCount} tanulom</span>}
        <span>{pct}%</span>
      </div>

      {/* Videólista */}
      {expanded && (
        <div className="lp-videos">
          {path.videos.map((v, idx) => {
            const prog = progMap[v.id] || 'Nem kezdtem';
            const isDone = prog === 'Kész';
            const isLearning = prog === 'Tanulom';
            return (
              <Link key={v.id} to={`/video/${v.id}`} className={`lp-video${isDone ? ' lp-video--done' : ''}`}>
                <span className="lp-video__num" style={{ color: path.color }}>
                  {isDone ? '✅' : isLearning ? '📖' : `${idx + 1}.`}
                </span>
                {v.thumbnail_url && (
                  <img src={v.thumbnail_url} alt={v.title} className="lp-video__thumb" loading="lazy" />
                )}
                <div className="lp-video__body">
                  <p className="lp-video__title">{v.title}</p>
                  <p className="lp-video__channel">{v.channel}</p>
                  <div className="lp-video__footer">
                    {v.duration_seconds && (
                      <span className="lp-video__dur">{formatDuration(v.duration_seconds)}</span>
                    )}
                    {v.dax_functions?.length > 0 && (
                      <div className="lp-video__dax">
                        {v.dax_functions.map(fn => (
                          <span key={fn} className="dax-badge">{fn}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LearningPath() {
  const [paths, setPaths] = useState([]);
  const [expanded, setExpanded] = useState({ beginner: true, intermediate: false, advanced: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/learning-paths')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setPaths(data); setLoading(false); })
      .catch(() => { setLoading(false); setError(true); });
  }, []);

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <main className="lp-page">
      <h2 className="lp-page__title">🗺️ Tanulási útvonal</h2>
      <p className="lp-page__sub">
        Válaszd ki a szintednek megfelelő útvonalat, és haladj végig a videókon sorban.
        A haladásod automatikusan mentődik.
      </p>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <p style={{color:'#dc2626',textAlign:'center',padding:'2rem'}}>❌ Nem sikerült betölteni az útvonalakat – ellenőrizd hogy a backend fut-e.</p>
      ) : (
        <div className="lp-paths">
          {paths.map(path => (
            <PathCard
              key={path.id}
              path={path}
              expanded={!!expanded[path.id]}
              onToggle={() => toggle(path.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default LearningPath;
