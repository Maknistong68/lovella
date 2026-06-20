import { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { saveResponse, getSavedAnswer, flushPending } from './lib/supabase'
import PhotoGrid from './components/PhotoGrid'

// NO button text cycles as it runs away. Last one is clickable for real.
const NO_LABELS = [
  'No',
  'Sigurado ka?',
  'Isipin mo muna',
  'Ang tigas naman',
  'Last chance',
  'Ok fine',
]

const EVASIONS_BEFORE_CLICKABLE = NO_LABELS.length - 1 // 5 dodges, then clickable

export default function App() {
  const [evasions, setEvasions] = useState(0)
  const [result, setResult] = useState(null) // 'yes' | 'no' | null
  const [returning, setReturning] = useState(false) // answered on a previous visit
  const [noPos, setNoPos] = useState(null) // {top, left} within the play area
  const submittingRef = useRef(false) // guards against double submit
  const noRef = useRef(null)
  const playRef = useRef(null) // the bounded area the NO button runs inside

  const noClickable = evasions >= EVASIONS_BEFORE_CLICKABLE
  const noLabel = NO_LABELS[Math.min(evasions, NO_LABELS.length - 1)]

  // On load: if she already answered, show that. Also retry any queued saves.
  useEffect(() => {
    const prev = getSavedAnswer()
    if (prev === 'yes' || prev === 'no') {
      setResult(prev)
      setReturning(true)
    }
    flushPending()
  }, [])

  // Keep the runaway button inside the play area if the viewport changes.
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

  // Move the NO button to a random spot INSIDE the bounded play area.
  // (Contained, not fullscreen — so it can never hide behind in-app browser UI.)
  const dodge = useCallback(() => {
    if (noClickable) return
    const play = playRef.current
    const btn = noRef.current
    if (play && btn) {
      const maxLeft = Math.max(0, play.clientWidth - btn.offsetWidth)
      const maxTop = Math.max(0, play.clientHeight - btn.offsetHeight)
      setNoPos({ left: Math.random() * maxLeft, top: Math.random() * maxTop })
    }
    setEvasions((e) => e + 1)
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

  // Submit once; celebrate immediately, persist in the background.
  const submit = useCallback((answer) => {
    if (submittingRef.current) return
    submittingRef.current = true
    if (answer === 'yes') fireConfetti()
    setResult(answer)
    saveResponse(answer) // fire-and-forget; storage layer handles failures
  }, [])

  const handleYes = () => submit('yes')

  const handleNo = () => {
    if (!noClickable) {
      dodge()
      return
    }
    submit('no')
  }

  return (
    <div className="min-h-full w-full bg-gradient-to-b from-amber-200 via-orange-300 to-rose-300 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {!result && (
          <div className="text-center">
            <PhotoGrid />

            <h1 className="mt-7 text-3xl sm:text-4xl font-extrabold text-rose-900 leading-tight tracking-tight">
              Pwede ba tayo mag spend ng time?
            </h1>
            <p className="mt-2 text-rose-800/70 text-sm">Can we spend some time together?</p>

            {/* Bounded play area: the NO button can only run inside this box,
                so it stays visible in TikTok/Messenger/IG in-app browsers. */}
            <div ref={playRef} className="relative mx-auto mt-8 h-60 w-full max-w-sm">
              <button
                onClick={handleYes}
                className="absolute left-1/2 top-4 -translate-x-1/2 rounded-2xl bg-rose-600 px-12 py-4 text-lg font-bold text-white shadow-lg shadow-rose-600/30 transition-transform active:scale-95 hover:bg-rose-500"
              >
                Yes
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

            {evasions > 0 && !noClickable && (
              <p className="mt-2 text-rose-800/60 text-xs italic">(subukan mo pa) 😏</p>
            )}
          </div>
        )}

        {result === 'yes' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-6xl">🎉</div>
            <h2 className="mt-4 text-3xl font-extrabold text-rose-900">
              {returning ? 'Yes pa rin! 💛' : 'Yes! Salamat.'}
            </h2>
            <p className="mt-2 text-lg text-rose-800">
              {returning ? 'Excited na ako. See you soon.' : 'See you soon. 💛'}
            </p>
          </div>
        )}

        {result === 'no' && (
          <div className="text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-5xl">🙂</div>
            <h2 className="mt-4 text-2xl font-bold text-rose-900">Sige, sa susunod nalang.</h2>
            {returning && (
              <p className="mt-2 text-sm text-rose-800/70">(nandito pa rin ako kung magbago isip mo)</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
