/**
 * Moving stats between devices without a backend: the save JSON, compressed
 * (deflate) and base64url-encoded behind a short prefix.
 */
import {parseSave, type GameRecord, type SaveData} from './storage';

const PREFIX = 'SHOWDOL1-';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export async function encodeSave(save: SaveData): Promise<string> {
  // Seeds and input logs only exist to resume a game, so finished games leave
  // them out to keep the code short. Unfinished games keep everything.
  const games = Object.fromEntries(
    Object.entries(save.games).map(([date, g]) =>
      [date, g.status === 'in_progress' ? g : {...g, battleSeed: '', aiSeed: '', inputLog: []}]),
  );
  const json = new TextEncoder().encode(JSON.stringify({schemaVersion: save.schemaVersion, games}));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export class TransferError extends Error {}

/** Decodes a code from `encodeSave`. Throws TransferError if it isn't one. */
export async function decodeSave(code: string): Promise<SaveData> {
  const trimmed = code.replace(/\s+/g, '');
  if (!trimmed.startsWith(PREFIX)) throw new TransferError("That doesn't look like a Showdol code.");
  let json: string;
  try {
    json = new TextDecoder().decode(await pipe(fromBase64Url(trimmed.slice(PREFIX.length)), new DecompressionStream('deflate-raw')));
  } catch {
    throw new TransferError('That code is incomplete or damaged.');
  }
  const save = parseSave(json);
  if (!Object.keys(save.games).length) throw new TransferError('That code has no games in it.');
  return save;
}

export interface MergeResult {
  save: SaveData;
  added: number;
  replaced: number;
}

/**
 * Adds imported games to this device's. When both have the same day, a
 * finished game beats an unfinished one; if both are finished, the one that
 * finished first is kept (it was the real result). Settings stay this device's.
 */
export function mergeSaves(current: SaveData, incoming: SaveData): MergeResult {
  const games = {...current.games};
  let added = 0, replaced = 0;
  for (const [date, theirs] of Object.entries(incoming.games)) {
    const mine = games[date];
    if (!mine) {
      games[date] = theirs;
      added++;
    } else if (prefer(theirs, mine)) {
      games[date] = theirs;
      replaced++;
    }
  }
  return {save: {...current, games}, added, replaced};
}

function prefer(a: GameRecord, b: GameRecord) {
  const aDone = a.status !== 'in_progress', bDone = b.status !== 'in_progress';
  if (aDone !== bDone) return aDone;
  if (aDone && bDone) return (a.finishedAt ?? '') < (b.finishedAt ?? '');
  return a.inputLog.length > b.inputLog.length;
}
