/**
 * @file Stats.jsx
 * @description Tanulási statisztikák – személyes haladás + archívum áttekintés.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__value" style={{ color }}>{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}

function Stats() {
  const [archiveStats, setArchiveStats] = useState(null);
  const [personalStats, setPersonalStats] = useState(null);

  useEffect(() => {
    // Backend statisztikák
    fetch('/api/stats')
      .then(r => r.json())
      .then(setArchiveStats)
      .catch(() => {});

    // Személyes haladás localStorage-ból
    const done = [], learning = [], noted = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('pbi_progress_')) {
        const val = localStorage.getItem(key);
        if (val === 'Kész') done.push(key.replace('pbi_progress_', ''));
        if (val === 'Tanulom') learning.push(key.replace('pbi_progress_', ''));
      }
      if (key?.startsWith('pbi_note_')) {
        const val = localStorage.getItem(key);
        if (val?.trim()) noted.push(key.replace('pbi_note_', ''));
      }
    }
    setPersonalStats({ done, learning, noted });
  }, []);

  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

  return (
    <main className="stats-page">
      <h2 className="stats-page__title">📊 Tanulási statisztikák</h2>

      {/* Személyes haladás */}
      <section className="stats-section">
        <h3 className="stats-section__title">🎯 Személyes haladás</h3>
        {personalStats ? (
          <>
            <div className="stat-cards">
              <StatCard icon="✅" label="Kész" value={personalStats.done.length} color="#16a34a"
                sub={archiveStats ? `${pct(personalStats.done.length, archiveStats.total)}% az archívumból` : ''} />
              <StatCard icon="📖" label="Tanulom" value={personalStats.learning.length} color="#f59e0b" />
              <StatCard icon="📝" label="Saját jegyzetek" value={personalStats.noted.length} color="#2563eb"
                sub="videóhoz" />
            </div>

            {/* Haladás sáv */}
            {archiveStats && (
              <div className="stats-progress-wrap">
                <div className="stats-progress-label">
                  <span>Összesített haladás</span>
                  <span>{personalStats.done.length + personalStats.learning.length} / {archiveStats.total} videó</span>
                </div>
                <div className="stats-progress-bg">
                  <div className="stats-progress-fill stats-progress-fill--done"
                    style={{ width: `${pct(personalStats.done.length, archiveStats.total)}%` }} />
                  <div className="stats-progress-fill stats-progress-fill--learning"
                    style={{ width: `${pct(personalStats.learning.length, archiveStats.total)}%`, left: `${pct(personalStats.done.length, archiveStats.total)}%` }} />
                </div>
                <div className="stats-progress-legend">
                  <span style={{color:'#16a34a'}}>■ Kész</span>
                  <span style={{color:'#f59e0b'}}>■ Tanulom</span>
                  <span style={{color:'#cbd5e1'}}>■ Nem kezdtem</span>
                </div>
              </div>
            )}

            {/* Kész videók listája */}
            {personalStats.done.length > 0 && (
              <details className="stats-details">
                <summary>✅ Kész videók ({personalStats.done.length} db)</summary>
                <div className="stats-details__list">
                  {personalStats.done.map(id => (
                    <Link key={id} to={`/video/${id}`} className="stats-details__item">
                      → {id}
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <p className="stats-empty">Még nincs személyes haladás. Nyiss meg egy videót és állítsd be az állapotát!</p>
        )}
      </section>

      {/* Archívum statisztikák */}
      <section className="stats-section">
        <h3 className="stats-section__title">📁 Archívum áttekintés</h3>
        {archiveStats ? (
          <>
            <div className="stat-cards">
              <StatCard icon="🎬" label="Összes videó" value={archiveStats.total} color="#6366f1" />
              <StatCard icon="🇭🇺" label="Magyar fordítás" value={archiveStats.translated}
                sub={`${pct(archiveStats.translated, archiveStats.total)}% kész`} color="#2563eb" />
              <StatCard icon="🤖" label="AI összefoglaló" value={archiveStats.withSummary}
                sub={`${pct(archiveStats.withSummary, archiveStats.total)}% kész`} color="#7c3aed" />
              <StatCard icon="📐" label="DAX tartalom" value={archiveStats.withDax}
                sub="videóban van DAX" color="#0891b2" />
              <StatCard icon="📺" label="Csatornák" value={archiveStats.channels} color="#ea580c" />
              <StatCard icon="💬" label="Felirat" value={archiveStats.withTranscript}
                sub="videóban van" color="#16a34a" />
            </div>

            {/* Top DAX függvények */}
            {archiveStats.topDax?.length > 0 && (
              <div className="stats-top-dax">
                <h4 className="stats-top-dax__title">🏆 Legtöbbet előforduló DAX függvények</h4>
                <div className="stats-top-dax__list">
                  {archiveStats.topDax.map((fn, i) => (
                    <div key={fn.name} className="stats-dax-row">
                      <span className="stats-dax-rank">#{i + 1}</span>
                      <span className="stats-dax-name">{fn.name}</span>
                      <div className="stats-dax-bar-bg">
                        <div className="stats-dax-bar-fill"
                          style={{ width: `${Math.round((fn.count / archiveStats.topDax[0].count) * 100)}%` }} />
                      </div>
                      <span className="stats-dax-count">{fn.count} videó</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="spinner" />
        )}
      </section>
    </main>
  );
}

export default Stats;
