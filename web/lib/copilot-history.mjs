import { readStoredTurns } from './chat-storage.mjs';

const PREFIX = 'saarthi-turns:';
const INDEX_KEY = 'saarthi-chat-history';
const SCOPES = new Set(['patient', 'reference']);

/** Read resumable, tab-local patient chats without copying their contents into a second index. */
export function listCopilotHistory(storage, authorizedPatientIds, now = Date.now()) {
  const indexData = readIndex(storage);
  const recordedTimes = Object.values(indexData).filter((time) => time > 0 && time <= now);
  const migrationTime = recordedTimes.length ? Math.min(...recordedTimes) - 1000 : now;
  const allowed = new Set(authorizedPatientIds ?? []);
  const entries = [];
  for (let index = 0; index < storage.length; index += 1) {
    const storageKey = storage.key(index);
    if (typeof storageKey !== 'string' || !storageKey.startsWith(PREFIX)) continue;
    const parts = storageKey.slice(PREFIX.length).split(':');
    if (parts.length !== 2 || !parts[0] || !SCOPES.has(parts[1])) continue;
    if (!allowed.has(parts[0])) continue;
    const turns = readStoredTurns(storage, storageKey).turns;
    const lastQuestion = [...turns].reverse().find((turn) => turn.role === 'user');
    if (!lastQuestion) continue;
    // Older session transcripts did not record creation times. Start their recency clock
    // once on migration; never substitute a clinical evidence clock for a chat timestamp.
    if (!indexData[storageKey] || indexData[storageKey] <= 0) indexData[storageKey] = Math.max(1, migrationTime);
    entries.push({ patientId: parts[0], scope: parts[1], title: lastQuestion.text, storageKey,
      updatedAt: indexData[storageKey] });
  }
  storage.setItem?.(INDEX_KEY, JSON.stringify(indexData));
  return entries.sort((left, right) => right.updatedAt - left.updatedAt);
}

/** Keep only timestamps in the index; chat content remains in its scoped turn store. */
export function touchCopilotHistory(storage, storageKey, updatedAt = Date.now()) {
  if (!isHistoryKey(storageKey) || !Number.isFinite(updatedAt)) return;
  const index = readIndex(storage);
  index[storageKey] = updatedAt;
  storage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function formatHistoryAge(updatedAt, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - (updatedAt > 0 ? updatedAt : now)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isHistoryKey(storageKey) {
  if (typeof storageKey !== 'string' || !storageKey.startsWith(PREFIX)) return false;
  const parts = storageKey.slice(PREFIX.length).split(':');
  return parts.length === 2 && Boolean(parts[0]) && SCOPES.has(parts[1]);
}

function readIndex(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(INDEX_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) =>
      isHistoryKey(key) && Number.isFinite(value)));
  } catch { return {}; }
}
