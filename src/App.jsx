import { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { saveResponse, getSavedAnswer, flushPending } from './lib/supabase'
import PhotoGrid from './components/PhotoGrid'

// How many times it bolts before it finally gives up and stays put.
const MAX_DODGES = 9

// Escalating playful taunts shown ON the running button.
const NO_TAUNTS = ['Hindi', 'Hala!', 'Bilis!', 'Di abot!', 'Sayang!', 'Muntik na!', 'Ang kulit!', 'Sige pa!', 'Halos na!']

// Safe margins so it never hides behind the phone's browser bars.
const PAD_X = 16
const PAD_TOP = 80
const PAD_BOTTOM = 28

export default function App() {
  const [dodges, setDodges] = useState(0)
  const [stage, setStage] = useState('ask') // 'ask' | 'second'
  const [result, setResult] = useState(null) // 'yes' | 'no' | null
  const [returning, setReturning] = useState(false)
  const [noPos, setNoPos] = useState(null) // {left, top, rot} while running; null = home
  const submittingRef = useRef(false)
  const noRef = useRef(null)
  const dodgesRef = useRef(0)
  const posRef = useRef(null)
  const lastDodgeRef = useRef(0)

  const noClickable = dodges >= MAX_DODGES
  const noLabel = noClickable ? 'Hindi' : NO_TAUNTS[Math.min(dodges, NO_TAUNTS.length - 1)]

  // Difficulty ramp: smaller + faster the longer she chases.
  const scale = Math.max(0.6, 1 - Math.min(dodges, MAX_DODGES) * 0.045)
  const moveDur = Math.max(90, 220 - Math.min(dodges, MAX_DODGES) * 16)

  useEffect(() => {
    const prev = getSavedAnswer()
    if (prev === 'yes' || prev === 'no') {
      setResult(prev)
      setReturning(true)
    }
    flushPending()
  }, [])

  // Big leap to the OPPOSITE side of the screen each time = frantic chase.
  const dodge = useCallback(() => {
    if (dodgesRef.current >= MAX_DODGES) return
    const now = Date.now()
    if (now - lastDodgeRef.current < 110) return // throttle rapid mousemove
    lastDodgeRef.current = now

    const next = dodgesRef.current + 1

    if (next >= MAX_DODGES) {
      // Gives up: come back home (inline), fully clickable.
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
      const goLeft = !cur || cur.left > vw / 2
      const goUp = !cur || cur.top > vh / 2

      const left = goLeft
        ? minL + Math.random() * Math.max(0, vw * 0.42 - minL)
        : Math.min(maxL, vw * 0.55 + Math.random() * Math.max(0, maxL - vw * 0.55))
      const top = goUp
        ? minT + Math.random() * Math.max(0, vh * 0.45 - minT)
        : Math.min(maxT, vh * 0.55 + Math.random() * Math.max(0, maxT - vh * 0.55))

      const pos = { left, top, rot: Math.random() * 26 - 13 }
      posRef.current = pos
      setNoPos(pos)
    }

    dodgesRef.current = next
    setDodges(next)
  }, [])

  // Desktop: it bolts when the cursor gets close (not just on hover).
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

  // Keep a fleeing button inside the screen on rotate/resize.
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

  const fireConfetti = () => {
    const end = Date.now() + 1200
    const colors = ['#ff6b6b', '#ffd93d', '#ff8e53', '#ffffff']
    ;(function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors, shapes: ['circle'], scalar: 1.3 })
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors, shapes: ['circle'], scalar: 1.3 })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  }

  const submit = useCallback((answer) => {
    if (submittingRef.current) return
    submittingRef.current = true
    if (answer === 'yes') fireConfetti()
    setResult(answer)
    saveResponse(answer)
  }, [])

  const handleYes = () => submit('yes')

  const handleNo = () => {
    if (!noClickable) {
      dodge()
      return
    }
    setStage('second')
  }

  return (
    <div className="min-h-full w-full bg-gradient-to-b from-amber-200 via-orange-300 to-rose-300 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* ---------- STAGE 1: the question + the chase ---------- */}
        {!result && stage === 'ask' && (
          <div className="text-center">
            <PhotoGrid />

            <h1 className="mt-7 text-3xl sm:text-4xl font-extrabold text-rose-900 leading-tight tracking-tight">
              Pwede ba tayong mag-spend ng time, kahit minsan?
            </h1>
            <p className="mt-3 text-rose-800/70 text-sm">Walang pressure, ha. 💛</p>

            <div className="mt-7 flex flex-col items-center gap-4">
              <button
                onClick={handleYes}
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

            {/* Game HUD */}
            {dodges > 0 && !noClickable && (
              <p className="mt-5 text-rose-800/70 text-sm font-semibold">
                Hulihin mo ang “Hindi”! 😜 ({dodges}/{MAX_DODGES})
              </p>
            )}
            {noClickable && (
              <p className="mt-5 text-rose-800/70 text-sm italic animate-[fadeIn_0.4s_ease]">
                Ayan... sumuko na ako. 😅
              </p>
            )}
          </div>
        )}

        {/* ---------- STAGE 2: gentle second chance ---------- */}
        {!result && stage === 'second' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-5xl">🥺</div>
            <h2 className="mt-4 text-3xl font-extrabold text-rose-900">Aww, talaga?</h2>
            <p className="mt-2 text-rose-800/80">Isa pa ngang chance? 💛</p>

            <div className="mt-8 flex flex-col items-center gap-4">
              <button
                onClick={handleYes}
                className="rounded-2xl bg-rose-600 px-12 py-4 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition-transform active:scale-95 hover:bg-rose-500"
              >
                Sige, Oo na 💛
              </button>
              <button
                onClick={() => submit('no')}
                className="text-sm font-medium text-rose-800/60 underline underline-offset-4 hover:text-rose-800"
              >
                Hindi muna ngayon
              </button>
            </div>
          </div>
        )}

        {/* ---------- RESULT: yes ---------- */}
        {result === 'yes' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-6xl">🎉</div>
            <h2 className="mt-4 text-3xl font-extrabold text-rose-900">
              {returning ? 'Oo pa rin pala! 💛' : 'Yey! Salamat 💛'}
            </h2>
            <p className="mt-2 text-lg text-rose-800">
              {returning ? 'Excited na ako, ha.' : 'Kitakits tayo, ha?'}
            </p>
          </div>
        )}

        {/* ---------- RESULT: no (kind, zero guilt) ---------- */}
        {result === 'no' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-5xl">💛</div>
            <h2 className="mt-4 text-2xl font-bold text-rose-900">Okay lang 'yan.</h2>
            <p className="mt-2 text-rose-800/80">Walang pressure. Salamat pa rin sa panahon mo.</p>
            <p className="mt-1 text-sm text-rose-800/60">Nandito lang ako, kahit kailan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
