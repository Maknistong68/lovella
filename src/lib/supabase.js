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

/* ---------- public helpers ---------- */
export function getSavedAnswer() {
  try {
    return localStorage.getItem(ANSWER_KEY)
  } catch {
    return null
  }
}

function rememberAnswer(response) {
  try {
    localStorage.setItem(ANSWER_KEY, response)
  } catch {
    /* ignore */
  }
}

async function insertSupabase(response) {
  if (!supabase) return { ok: false, reason: 'not-configured' }
  try {
    const { error } = await supabase.from('responses').insert({ response })
    if (error) return { ok: false, reason: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e?.message || 'network error' }
  }
}

// Best-effort ping to you (Telegram bot URL, Discord webhook, etc.).
async function notify(response) {
  if (!notifyWebhook) return
  const payload = {
    // works for Discord ("content") and generic webhooks ("text")
    content: `Lovella answered: ${response.toUpperCase()} — ${new Date().toLocaleString()}`,
    text: `Lovella answered: ${response.toUpperCase()} — ${new Date().toLocaleString()}`,
  }
  try {
    await fetch(notifyWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // still sends if the tab closes right after
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
    const res = await insertSupabase(rec.response)
    if (!res.ok) stillPending.push(rec)
  }
  writeJSON(PENDING_KEY, stillPending)
}

/**
 * Save an answer. Designed so the answer is NEVER lost:
 *   1. write locally + remember it immediately
 *   2. fire the notification (non-blocking)
 *   3. try Supabase; on failure, queue it for retry
 * Returns fast — the UI celebration should not wait on the network.
 */
export async function saveResponse(response) {
  const record = { response, created_at: new Date().toISOString() }

  const log = readJSON(LOCAL_KEY)
  log.push(record)
  writeJSON(LOCAL_KEY, log)
  rememberAnswer(response)

  notify(response)

  const res = await insertSupabase(response)
  if (!res.ok && supabase) {
    const pending = readJSON(PENDING_KEY)
    pending.push(record)
    writeJSON(PENDING_KEY, pending)
    return { ok: true, stored: 'queued' }
  }

  return { ok: true, stored: res.ok ? 'supabase' : 'local' }
}
