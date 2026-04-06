/**
 * @file Search.jsx
 * @description Keresési oldal – teljes szöveges keresés videók között.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | loading | done
  const [inputVal, setInputVal] = useState(searchParams.get('q') || '');

  useEffect(() => {
    const query = searchParams.get('q') || '';
    setInputVal(query);
    setQ(query);
    if (query.length < 2) { setResults([]); setStatus('idle'); return; }
    setStatus('loading');
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => {
        setResults(data.results || []);
        setTotal(data.total || 0);
        setStatus('done');
      })
      .catch(() => setStatus('done'));
  }, [searchParams]);

  function handleSubmit(e) {
    e.preventDefault();
    if (inputVal.trim().length >= 2) setSearchParams({ q: inputVal.trim() });
  }

  const progress = (id) => localStorage.getItem(`pbi_progress_${id}`) || 'Nem kezdtem';
  const PROG_COLOR = { 'Tanulom': '#f59e0b', 'Kész': '#16a34a' };

  return (
    <main className="search-page">
      <form className="search-page__form" onSubmit={handleSubmit}>
        <input
          className="search-page__input"
          type="search"
          placeholder="Keresés videók, DAX függvények, témák között..."
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          autoFocus
        />
        <button type="submit" className="search-page__btn">Keresés</button>
      </form>

      {status === 'loading' && (
        <div className="search-page__state">
          <div className="spinner" />
          <p>Keresés...</p>
        </div>
      )}

      {status === 'done' && results.length === 0 && (
        <div className="search-page__state">
          <p>Nincs találat: <strong>{q}</strong></p>
        </div>
      )}

      {status === 'done' && results.length > 0 && (
        <>
          <p className="search-page__count">
            <strong>{total}</strong> találat – „{q}"
            {total > 30 && <span> (első 30 megjelenítve)</span>}
          </p>
          <div className="search-results">
            {results.map(v => {
              const prog = progress(v.id);
              return (
                <Link key={v.id} to={`/video/${v.id}`} className="search-result">
                  {v.thumbnail_url && (
                    <img src={v.thumbnail_url} alt={v.title} className="search-result__thumb" loading="lazy" />
                  )}
                  <div className="search-result__body">
                    <div className="search-result__header">
                      <p className="search-result__title">{v.title}</p>
                      {prog !== 'Nem kezdtem' && (
                        <span className="search-result__prog" style={{ color: PROG_COLOR[prog] }}>● {prog}</span>
                      )}
                    </div>
                    <p className="search-result__channel">{v.channel}</p>
                    {v.snippet && <p className="search-result__snippet">{v.snippet}</p>}
                    {v.dax_functions?.length > 0 && (
                      <div className="search-result__dax">
                        {v.dax_functions.map(fn => (
                          <span key={fn} className="dax-badge">{fn}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

export default Search;
