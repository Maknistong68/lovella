// Photo grid shown above the question.
// To use your own photos: drop image files into `public/photos/` named
// photo1.jpg ... photo4.jpg (or edit the paths below).
const PHOTOS = [
  '/photos/photo1.jpg',
  '/photos/photo2.jpg',
  '/photos/photo3.jpg',
  '/photos/photo4.jpg',
]

export default function PhotoGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {PHOTOS.map((src, i) => (
        <div
          key={i}
          className="aspect-square overflow-hidden rounded-2xl bg-white/40 shadow-sm ring-1 ring-white/50"
        >
          <img
            src={src}
            alt={`memory ${i + 1}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={(e) => {
              // Show a soft placeholder if the photo isn't added yet.
              e.currentTarget.style.display = 'none'
              e.currentTarget.parentElement.classList.add(
                'flex',
                'items-center',
                'justify-center'
              )
              e.currentTarget.parentElement.innerHTML =
                '<span class="text-rose-800/40 text-3xl">📷</span>'
            }}
          />
        </div>
      ))}
    </div>
  )
}
