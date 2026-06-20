import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const notifyWebhook = import.meta.env.VITE_NOTIFY_WEBHOOK

// Real client only when both env vars exist; otherwise we run local-only.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseEnabled = !!supabase

const LOCAL_KEY = 'lovella_responses' // full log, every submit
const PENDING_KEY = 'lovella_pending' // answers that didn't reach Supabase yet
const ANSWER_KEY = 'lovella_answer' // her final answer (for return visits)
const DETAIL_KEY = 'lovella_detail' // her full plan (for return visits)

// Columns we send to Supabase (must match the table schema).
const COLUMNS = ['response', 'activity', 'place', 'meet_date', 'meet_time']

/* ---------- small safe localStorage helpers ---------- */
function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / storage full — ignore */
  }
}

/* ---------- return-visit helpers ---------- */
export function getSavedAnswer() {
  try {
    return localStorage.getItem(ANSWER_KEY)
  } catch {
    return null
  }
}

export function getSavedDetail() {
  try {
    return JSON.parse(localStorage.getItem(DETAIL_KEY) || 'null')
  } catch {
    return null
  }
}

function remember(payload) {
  try {
    localStorage.setItem(ANSWER_KEY, payload.response)
    localStorage.setItem(DETAIL_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

// Keep only the table columns (drop undefined/extra keys).
function toRow(payload) {
  const row = {}
  for (const key of COLUMNS) {
    if (payload[key] !== undefined && payload[key] !== '') row[key] = payload[key]
  }
  return row
}

async function insertSupabase(payload) {
  if (!supabase) return { ok: false, reason: 'not-configured' }
  try {
    const { error } = await supabase.from('responses').insert(toRow(payload))
    if (error) return { ok: false, reason: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e?.message || 'network error' }
  }
}

// Best-effort ping (Telegram bot URL, Discord webhook, etc.). Optional.
async function notify(payload) {
  if (!notifyWebhook) return
  const parts = [
    `Sagot: ${payload.response.toUpperCase()}`,
    payload.activity && `Aktibidad: ${payload.activity}`,
    payload.place && `Lugar/Tagal: ${payload.place}`,
    payload.meet_date && `Petsa: ${payload.meet_date}`,
    payload.meet_time && `Oras: ${payload.meet_time}`,
  ].filter(Boolean)
  const text = parts.join(' | ')
  try {
    await fetch(notifyWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, text }),
      keepalive: true,
    })
  } catch {
    /* never block the user on a failed ping */
  }
}

// Retry any answers that failed to reach Supabase on a previous visit.
export async function flushPending() {
  if (!supabase) return
  const pending = readJSON(PENDING_KEY)
  if (!pending.length) return
  const stillPending = []
  for (const rec of pending) {
    const res = await insertSupabase(rec)
    if (!res.ok) stillPending.push(rec)
  }
  writeJSON(PENDING_KEY, stillPending)
}

/**
 * Save an answer (object). Designed so the answer is NEVER lost:
 *   1. write locally + remember it immediately
 *   2. fire the notification (non-blocking)
 *   3. try Supabase; on failure, queue it for retry
 * Accepts: { response, activity?, place?, meet_date?, meet_time? }
 */
export async function saveResponse(payload) {
  const record = { ...payload, created_at: new Date().toISOString() }

  const log = readJSON(LOCAL_KEY)
  log.push(record)
  writeJSON(LOCAL_KEY, log)
  remember(payload)

  notify(payload)

  const res = await insertSupabase(payload)
  if (!res.ok && supabase) {
    const pending = readJSON(PENDING_KEY)
    pending.push(payload)
    writeJSON(PENDING_KEY, pending)
    return { ok: true, stored: 'queued' }
  }

  return { ok: true, stored: res.ok ? 'supabase' : 'local' }
}
