/**
 * @file Home.jsx
 * @description Főoldal placeholder – a napi Top 10 Power BI videót jeleníti majd meg.
 * Teljes implementáció az OUT-07 iterációban.
 */

/**
 * Home oldal komponens.
 * Jelenleg egy placeholder állapotot jelenít meg, a valódi tartalom OUT-07-ben kerül ide.
 *
 * @returns {JSX.Element} A főoldal tartalma
 */
function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem', color: '#555' }}>Napi Top 10 videó</h2>
      <p style={{ color: '#888' }}>
        A videók az OUT-07 iterációban jelennek meg. A backend már fut a localhost:3001-en.
      </p>
    </main>
  );
}

export default Home;
