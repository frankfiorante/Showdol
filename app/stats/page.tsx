'use client';

import {useEffect, useState} from 'react';
import {dateKey} from '@/game/daily';
import {computeStats, pokemonLeft} from '@/game/stats';
import {loadSave, writeSave, type SaveData} from '@/game/storage';
import {decodeSave, encodeSave, mergeSaves, TransferError} from '@/game/transfer';
import {Footer, Nav} from '@/ui/Nav';

export default function StatsPage() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setSave(loadSave());
    setToday(dateKey(new Date()));
  }, []);

  return (
    <main>
      <Nav />
      <h1 className="page-title">Stats</h1>
      {save && today ? <StatsBody save={save} today={today} /> : <p className="muted">Loading…</p>}
      {save && <Transfer save={save} onImported={setSave} />}
      <Footer />
    </main>
  );
}

function StatsBody({save, today}: {save: SaveData; today: string}) {
  const s = computeStats(save, today);
  const todays = save.games[today];
  // Today's row is highlighted once today's game is finished.
  const todayRow = !todays || todays.status === 'in_progress' ? null : todays.status === 'won' ? Math.max(1, pokemonLeft(todays) ?? 1) : 0;

  const rows = [6, 5, 4, 3, 2, 1].map(left => ({key: left, label: `${left} left`, count: s.winsByLeft[left]}));
  rows.push({key: 0, label: 'Loss', count: s.losses});
  const max = Math.max(1, ...rows.map(r => r.count));

  return (
    <>
      <section className="stat-tiles" aria-label="Summary">
        <Tile value={s.played} label="Played" />
        <Tile value={`${s.winPct}%`} label="Win rate" />
        <Tile value={s.currentStreak} label="Current streak" />
        <Tile value={s.bestStreak} label="Best streak" />
      </section>

      <section className="card">
        <h2 className="card-title">Results</h2>
        <p className="muted small">Wins by how many of your Pokémon were still standing, and losses.</p>
        {s.played === 0 ? (
          <p className="muted">No finished games yet.</p>
        ) : (
          <table className="dist">
            <caption className="sr-only">Number of games for each result</caption>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className={r.key === todayRow ? 'today' : ''}>
                  <th scope="row">{r.label}</th>
                  <td>
                    <span className="dist-bar" style={{width: `${Math.max(r.count ? 4 : 0, (100 * r.count) / max)}%`}}
                      title={`${r.label}: ${r.count} ${r.count === 1 ? 'game' : 'games'}`} />
                    <span className="dist-count">{r.count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Tile({value, label}: {value: number | string; label: string}) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/** Export/import codes for moving stats to another device. */
function Transfer({save, onImported}: {save: SaveData; onImported: (s: SaveData) => void}) {
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<{text: string; error?: boolean} | null>(null);
  const games = Object.keys(save.games).length;

  async function exportCode() {
    setCode(await encodeSave(save));
    setMessage(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage({text: 'Code copied.'});
    } catch {
      setMessage({text: 'Select the code and copy it.'});
    }
  }

  async function importCode() {
    try {
      const incoming = await decodeSave(input);
      // Merge into the freshest copy in case another tab saved meanwhile.
      const {save: merged, added, replaced} = mergeSaves(loadSave(), incoming);
      if (!writeSave(merged)) throw new TransferError("This browser isn't saving data (private mode?).");
      onImported(merged);
      setInput('');
      setMessage({text: added || replaced ? `Imported ${added} new day${added === 1 ? '' : 's'}${replaced ? `, updated ${replaced}` : ''}.` : 'Nothing new: this device already has those games.'});
    } catch (e) {
      setMessage({text: e instanceof TransferError ? e.message : 'Import failed.', error: true});
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Move your stats</h2>
      <p className="muted small">
        Stats live only in this browser. To move them to another device, copy a code here and paste it there.
        Importing adds games; it never deletes any.
      </p>
      <div className="row">
        <button onClick={exportCode} disabled={!games}>Get my code</button>
        {code && <button onClick={copy}>Copy</button>}
      </div>
      {code && <textarea className="code" readOnly value={code} rows={3} aria-label="Your export code" onFocus={e => e.target.select()} />}

      <label className="small import-label" htmlFor="import-code">Paste a code from another device</label>
      <textarea id="import-code" className="code" value={input} rows={3} onChange={e => setInput(e.target.value)}
        placeholder="SHOWDOL1-…" />
      <button onClick={importCode} disabled={!input.trim()}>Import</button>
      {message && <p className={`small ${message.error ? 'notice' : 'muted'}`} role="status">{message.text}</p>}
    </section>
  );
}
