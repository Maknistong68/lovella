import { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { saveResponse, getSavedAnswer, getSavedDetail, flushPending } from './lib/supabase'
import PhotoGrid from './components/PhotoGrid'

const MAX_DODGES = 13
const NO_TAUNTS = [
  'Hindi', 'Hala!', 'Bilis!', 'Di abot!', 'Sayang!', 'Muntik na!', 'Ang kulit!',
  'Sige pa!', 'Halos na!', 'Hindi talaga!', 'Wag na!', 'Sobra ka!', 'Hala ka!',
]
const PAD_X = 12
const PAD_TOP = 64
const PAD_BOTTOM = 24

// Activity options (each detail step also allows a typed custom answer).
const ACTIVITIES = [
  { id: 'Spider-Man: Brand New Day', label: 'Spider-Man movie', emoji: '🕷️', q: 'Saang sinehan?', options: ['VOX Cinemas', 'Muvi Cinemas', 'AMC'] },
  { id: 'Coffee', label: 'Coffee', emoji: '☕', q: 'Saan tayo kape?', options: ["Dunkin'", 'Corniche', 'Starbucks'] },
  { id: 'Dinner', label: 'Dinner', emoji: '🍽️', q: 'Saan tayo kakain?', options: ['Almina', 'Time Out'] },
  { id: 'Late night drive', label: 'Late night drive', emoji: '🚗', q: 'Gaano katagal?', options: ['30 minutes', '1 oras', '3 oras'] },
]

function formatWhen(date, time) {
  if (!date) return ''
  try {
    const d = new Date(`${date}T${time || '00:00'}`)
    const opts = { weekday: 'long', month: 'long', day: 'numeric' }
    const datePart = d.toLocaleDateString('en-US', opts)
    const timePart = time ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
    return timePart ? `${datePart}, ${timePart}` : datePart
  } catch {
    return `${date} ${time}`.trim()
  }
}

export default function App() {
  const [dodges, setDodges] = useState(0)
  const [stage, setStage] = useState('ask') // 'ask' | 'second' | 'plan'
  const [planStep, setPlanStep] = useState('activity') // 'activity' | 'detail' | 'when'
  const [activity, setActivity] = useState(null) // selected ACTIVITIES entry
  const [place, setPlace] = useState('')
  const [custom, setCustom] = useState('')
  const [meetDate, setMeetDate] = useState('')
  const [meetTime, setMeetTime] = useState('')
  const [result, setResult] = useState(null) // 'yes' | 'no' | null
  const [returning, setReturning] = useState(false)
  const [savedDetail, setSavedDetail] = useState(null)
  const [noPos, setNoPos] = useState(null)

  const submittingRef = useRef(false)
  const noRef = useRef(null)
  const dodgesRef = useRef(0)
  const posRef = useRef(null)
  const lastDodgeRef = useRef(0)

  const noClickable = dodges >= MAX_DODGES
  const noLabel = noClickable ? 'Hindi' : NO_TAUNTS[Math.min(dodges, NO_TAUNTS.length - 1)]
  const scale = Math.max(0.6, 1 - Math.min(dodges, MAX_DODGES) * 0.045)
  const moveDur = Math.max(90, 220 - Math.min(dodges, MAX_DODGES) * 16)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const prev = getSavedAnswer()
    if (prev === 'yes' || prev === 'no') {
      setResult(prev)
      setReturning(true)
      setSavedDetail(getSavedDetail())
    }
    flushPending()
  }, [])

  /* ---------------- runaway NO button ---------------- */
  const dodge = useCallback(() => {
    if (dodgesRef.current >= MAX_DODGES) return
    const now = Date.now()
    if (now - lastDodgeRef.current < 110) return
    lastDodgeRef.current = now

    const next = dodgesRef.current + 1
    if (next >= MAX_DODGES) {
      posRef.current = null
      setNoPos(null)
    } else {
      const btn = noRef.current
      const w = btn?.offsetWidth || 110
      const h = btn?.offsetHeight || 52
      const vw = window.innerWidth
      const vh = window.innerHeight
      const minL = PAD_X
      const maxL = Math.max(minL, vw - w - PAD_X)
      const minT = PAD_TOP
      const maxT = Math.max(minT, vh - h - PAD_BOTTOM)
      const cur = posRef.current
      // Uniform-random anywhere on screen (corners included), but force a big
      // jump away from the current spot so it never clusters in one area.
      const minJump = Math.min(maxL - minL, maxT - minT) * 0.55
      let left = minL
      let top = minT
      for (let i = 0; i < 12; i++) {
        left = minL + Math.random() * (maxL - minL)
        top = minT + Math.random() * (maxT - minT)
        if (!cur || Math.hypot(left - cur.left, top - cur.top) >= minJump) break
      }
      const pos = { left, top, rot: Math.random() * 30 - 15 }
      posRef.current = pos
      setNoPos(pos)
    }
    dodgesRef.current = next
    setDodges(next)
  }, [])

  useEffect(() => {
    if (noClickable) return
    const onMove = (e) => {
      const btn = noRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < 95) dodge()
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [noClickable, dodge])

  useEffect(() => {
    const onResize = () => {
      setNoPos((p) => {
        const btn = noRef.current
        if (!p || !btn) return p
        const np = {
          ...p,
          left: Math.min(p.left, Math.max(PAD_X, window.innerWidth - btn.offsetWidth - PAD_X)),
          top: Math.min(p.top, Math.max(PAD_TOP, window.innerHeight - btn.offsetHeight - PAD_BOTTOM)),
        }
        posRef.current = np
        return np
      })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  /* ---------------- actions ---------------- */
  const fireConfetti = () => {
    const end = Date.now() + 1400
    const colors = ['#ff6b6b', '#ffd93d', '#ff8e53', '#ffffff']
    ;(function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors, shapes: ['circle'], scalar: 1.3 })
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors, shapes: ['circle'], scalar: 1.3 })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  }

  // Oo tapped -> celebrate, then start planning the date.
  const startPlanning = () => {
    fireConfetti()
    setStage('plan')
    setPlanStep('activity')
  }

  const chooseActivity = (a) => {
    setActivity(a)
    setPlace('')
    setCustom('')
    setPlanStep('detail')
  }

  const choosePlace = (value) => {
    setPlace(value)
    setPlanStep('when')
  }

  const confirmPlan = () => {
    if (submittingRef.current) return
    submittingRef.current = true
    const payload = {
      response: 'yes',
      activity: activity?.id,
      place,
      meet_date: meetDate,
      meet_time: meetTime,
    }
    setSavedDetail(payload)
    setResult('yes')
    saveResponse(payload)
  }

  const submitNo = () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setResult('no')
    saveResponse({ response: 'no' })
  }

  const handleNo = () => {
    if (!noClickable) {
      dodge()
      return
    }
    setStage('second')
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-full w-full bg-gradient-to-b from-amber-200 via-orange-300 to-rose-300 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* ===== STAGE: ask + chase ===== */}
        {!result && stage === 'ask' && (
          <div className="text-center">
            <PhotoGrid />
            <h1 className="mt-7 text-3xl sm:text-4xl font-extrabold text-rose-900 leading-tight tracking-tight">
              Pwede ba tayong mag-spend ng time, kahit minsan?
            </h1>
            <p className="mt-3 text-rose-800/70 text-sm">Walang pressure, ha. 💛</p>

            <div className="mt-7 flex flex-col items-center gap-4">
              <button
                onClick={startPlanning}
                className="rounded-2xl bg-rose-600 px-14 py-3.5 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition-transform active:scale-95 hover:bg-rose-500 animate-[pulseSoft_1.6s_ease-in-out_infinite]"
              >
                Oo
              </button>
              <button
                ref={noRef}
                onClick={handleNo}
                onMouseEnter={dodge}
                onTouchStart={(e) => {
                  if (!noClickable) {
                    e.preventDefault()
                    dodge()
                  }
                }}
                style={
                  noPos
                    ? {
                        position: 'fixed',
                        left: noPos.left,
                        top: noPos.top,
                        transform: `scale(${scale}) rotate(${noPos.rot}deg)`,
                        transitionDuration: `${moveDur}ms`,
                        zIndex: 50,
                      }
                    : undefined
                }
                className={`rounded-2xl px-7 py-3.5 text-lg font-bold shadow-md transition-all ease-out ${
                  noClickable ? 'bg-white text-rose-700 hover:bg-rose-50' : 'bg-white/80 text-rose-500'
                }`}
              >
                {noLabel}
              </button>
            </div>

            {noClickable && (
              <p className="mt-5 text-rose-800/70 text-sm italic animate-[fadeIn_0.4s_ease]">
                Ayan... sumuko na ako. 😅
              </p>
            )}
          </div>
        )}

        {/* ===== STAGE: gentle second chance ===== */}
        {!result && stage === 'second' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-5xl">🥺</div>
            <h2 className="mt-4 text-3xl font-extrabold text-rose-900">Aww, talaga?</h2>
            <p className="mt-2 text-rose-800/80">Isa pa ngang chance? 💛</p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <button
                onClick={startPlanning}
                className="rounded-2xl bg-rose-600 px-12 py-4 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition-transform active:scale-95 hover:bg-rose-500"
              >
                Sige, Oo na 💛
              </button>
              <button
                onClick={submitNo}
                className="text-sm font-medium text-rose-800/60 underline underline-offset-4 hover:text-rose-800"
              >
                Hindi muna ngayon
              </button>
            </div>
          </div>
        )}

        {/* ===== STAGE: planning (after Oo) ===== */}
        {!result && stage === 'plan' && (
          <div className="text-center animate-[fadeIn_0.35s_ease]">
            {/* step 1: activity */}
            {planStep === 'activity' && (
              <>
                <button onClick={() => setStage('ask')} className="text-sm text-rose-800/60 hover:text-rose-800">‹ Bumalik</button>
                <h2 className="mt-2 text-2xl font-extrabold text-rose-900">Yey! 💛 Anong gusto mo?</h2>
                <p className="mt-1 text-rose-800/70 text-sm">Ikaw bahala, ha.</p>
                <div className="mt-7 flex flex-col gap-3">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => chooseActivity(a)}
                      className="rounded-2xl bg-white/85 px-6 py-4 text-lg font-bold text-rose-700 shadow-md transition-transform active:scale-95 hover:bg-white"
                    >
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* step 2: place / duration */}
            {planStep === 'detail' && activity && (
              <>
                <button onClick={() => setPlanStep('activity')} className="text-sm text-rose-800/60 hover:text-rose-800">‹ Bumalik</button>
                <h2 className="mt-2 text-2xl font-extrabold text-rose-900">{activity.emoji} {activity.q}</h2>
                <div className="mt-6 flex flex-col gap-3">
                  {activity.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => choosePlace(opt)}
                      className="rounded-2xl bg-white/85 px-6 py-3.5 text-lg font-semibold text-rose-700 shadow-md transition-transform active:scale-95 hover:bg-white"
                    >
                      {opt}
                    </button>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <input
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      placeholder="Iba pa... (i-type mo)"
                      className="flex-1 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-rose-800 placeholder-rose-800/40 outline-none focus:bg-white"
                    />
                    <button
                      onClick={() => choosePlace(custom.trim())}
                      disabled={!custom.trim()}
                      className="rounded-2xl bg-rose-600 px-5 py-3 font-bold text-white shadow-md transition active:scale-95 hover:bg-rose-500 disabled:opacity-40"
                    >
                      Sige
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* step 3: when */}
            {planStep === 'when' && (
              <>
                <button onClick={() => setPlanStep('detail')} className="text-sm text-rose-800/60 hover:text-rose-800">‹ Bumalik</button>
                <h2 className="mt-2 text-2xl font-extrabold text-rose-900">Kailan tayo? 🗓️</h2>
                <p className="mt-1 text-rose-800/70 text-sm">{activity?.emoji} {activity?.id} · {place}</p>
                <div className="mt-6 flex flex-col gap-3 text-left">
                  <label className="text-sm font-semibold text-rose-800">Petsa
                    <input
                      type="date"
                      min={today}
                      value={meetDate}
                      onChange={(e) => setMeetDate(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-rose-800 outline-none focus:bg-white"
                    />
                  </label>
                  <label className="text-sm font-semibold text-rose-800">Oras
                    <input
                      type="time"
                      value={meetTime}
                      onChange={(e) => setMeetTime(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-rose-800 outline-none focus:bg-white"
                    />
                  </label>
                </div>
                <button
                  onClick={() => setPlanStep('review')}
                  disabled={!meetDate || !meetTime}
                  className="mt-7 w-full rounded-2xl bg-rose-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition active:scale-95 hover:bg-rose-500 disabled:opacity-40"
                >
                  Tuloy 💛
                </button>
              </>
            )}

            {/* step 4: review + SUBMIT (the only way it gets sent) */}
            {planStep === 'review' && (
              <>
                <button onClick={() => setPlanStep('when')} className="text-sm text-rose-800/60 hover:text-rose-800">‹ Bumalik</button>
                <h2 className="mt-2 text-2xl font-extrabold text-rose-900">I-check natin 👀</h2>
                <div className="mt-5 rounded-2xl bg-white/70 p-5 text-left text-rose-900 shadow-sm">
                  <div className="flex justify-between gap-3 py-1">
                    <span className="text-rose-800/60">Gagawin</span>
                    <span className="font-bold text-right">{activity?.emoji} {activity?.id}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-1 border-t border-rose-900/10">
                    <span className="text-rose-800/60">{activity?.id === 'Late night drive' ? 'Tagal' : 'Lugar'}</span>
                    <span className="font-bold text-right">{place}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-1 border-t border-rose-900/10">
                    <span className="text-rose-800/60">Kailan</span>
                    <span className="font-bold text-right">{formatWhen(meetDate, meetTime)}</span>
                  </div>
                </div>
                <button
                  onClick={confirmPlan}
                  className="mt-6 w-full rounded-2xl bg-rose-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition active:scale-95 hover:bg-rose-500"
                >
                  I-submit 💛
                </button>
                <p className="mt-3 text-xs text-rose-800/50">Pindutin ang Submit para matanggap niya. 😊</p>
              </>
            )}
          </div>
        )}

        {/* ===== RESULT: yes ===== */}
        {result === 'yes' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-6xl">🎉</div>
            <h2 className="mt-4 text-3xl font-extrabold text-rose-900">
              {returning ? 'Oo pa rin pala! 💛' : 'Yey! Salamat 💛'}
            </h2>
            {savedDetail?.activity ? (
              <div className="mt-4 rounded-2xl bg-white/60 p-5 text-rose-900 shadow-sm">
                <p className="text-lg font-bold">
                  {savedDetail.activity} · {savedDetail.place}
                </p>
                <p className="mt-1 text-rose-800">{formatWhen(savedDetail.meet_date, savedDetail.meet_time)}</p>
              </div>
            ) : (
              <p className="mt-2 text-lg text-rose-800">Kitakits tayo, ha?</p>
            )}
            <p className="mt-4 text-rose-800/80">Excited na ako. See you! 💛</p>
          </div>
        )}

        {/* ===== RESULT: no ===== */}
        {result === 'no' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-5xl">🤙</div>
            <h2 className="mt-4 text-2xl font-bold text-rose-900">Okay lang 'yan.</h2>
            <p className="mt-2 text-rose-800/80">Walang problema, ingat ka!</p>
          </div>
        )}
      </div>
    </div>
  )
}
