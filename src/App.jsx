import { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { saveResponse, getSavedAnswer, flushPending } from './lib/supabase'
import PhotoGrid from './components/PhotoGrid'

// Just 2 gentle, playful hops — not a frustrating chase. Then it's clickable.
const MAX_DODGES = 2

export default function App() {
  const [dodges, setDodges] = useState(0)
  const [stage, setStage] = useState('ask') // 'ask' | 'second'
  const [result, setResult] = useState(null) // 'yes' | 'no' | null
  const [returning, setReturning] = useState(false) // answered on a previous visit
  const [noPos, setNoPos] = useState(null) // {top, left} within the play area
  const submittingRef = useRef(false)
  const noRef = useRef(null)
  const playRef = useRef(null) // bounded box the NO button runs inside

  const noClickable = dodges >= MAX_DODGES
  const noLabel = dodges === 0 ? 'Hindi' : dodges === 1 ? 'Uy, teka... 🥺' : 'Hindi'

  // On load: restore a previous answer; retry any queued saves.
  useEffect(() => {
    const prev = getSavedAnswer()
    if (prev === 'yes' || prev === 'no') {
      setResult(prev)
      setReturning(true)
    }
    flushPending()
  }, [])

  // Keep the runaway button inside the box if the screen rotates/resizes.
  useEffect(() => {
    const onResize = () => {
      setNoPos((p) => {
        const play = playRef.current
        const btn = noRef.current
        if (!p || !play || !btn) return p
        return {
          left: Math.min(p.left, Math.max(0, play.clientWidth - btn.offsetWidth)),
          top: Math.min(p.top, Math.max(0, play.clientHeight - btn.offsetHeight)),
        }
      })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  // Move NO to a random spot INSIDE the bounded, always-visible box.
  const dodge = useCallback(() => {
    if (noClickable) return
    const play = playRef.current
    const btn = noRef.current
    if (play && btn) {
      const maxLeft = Math.max(0, play.clientWidth - btn.offsetWidth)
      const maxTop = Math.max(0, play.clientHeight - btn.offsetHeight)
      setNoPos({ left: Math.random() * maxLeft, top: Math.random() * maxTop })
    }
    setDodges((d) => d + 1)
  }, [noClickable])

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

  // First NO: dodge a couple times (playful), then open the gentle second chance.
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
        {/* ---------- STAGE 1: the question ---------- */}
        {!result && stage === 'ask' && (
          <div className="text-center">
            <PhotoGrid />

            <h1 className="mt-7 text-3xl sm:text-4xl font-extrabold text-rose-900 leading-tight tracking-tight">
              Pwede ba tayong mag-spend ng time, kahit minsan?
            </h1>
            <p className="mt-3 text-rose-800/70 text-sm">Walang pressure, ha. 💛</p>

            {/* Bounded play area — NO button can only move inside this box,
                so it stays visible on phones and in TikTok/Messenger browsers. */}
            <div ref={playRef} className="relative mx-auto mt-8 h-56 w-full max-w-sm">
              <button
                onClick={handleYes}
                className="absolute left-1/2 top-4 -translate-x-1/2 rounded-2xl bg-rose-600 px-14 py-4 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition-transform active:scale-95 hover:bg-rose-500"
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
                style={noPos ? { position: 'absolute', left: noPos.left, top: noPos.top } : undefined}
                className={`absolute rounded-2xl px-8 py-4 text-lg font-bold shadow-md transition-all duration-200 ease-out ${
                  noPos ? '' : 'bottom-4 left-1/2 -translate-x-1/2'
                } ${noClickable ? 'bg-white text-rose-700 hover:bg-rose-50' : 'bg-white/80 text-rose-500'}`}
              >
                {noLabel}
              </button>
            </div>
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

              {/* A real, easy NO — no dodging, no guilt. */}
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
            <p className="mt-2 text-rose-800/80">
              Walang pressure. Salamat pa rin sa panahon mo.
            </p>
            <p className="mt-1 text-sm text-rose-800/60">Nandito lang ako, kahit kailan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
