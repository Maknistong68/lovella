// Single photo shown above the question.
// To use your own photo: save the image as  public/photos/her.png
const PHOTO = '/photos/her.png'

export default function PhotoGrid() {
  return (
    <div className="flex justify-center">
      <div className="h-40 w-32 overflow-hidden rounded-2xl bg-white/40 shadow-md ring-1 ring-white/50">
        <img
          src={PHOTO}
          alt="ikaw"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={(e) => {
            // Soft placeholder until the photo is added.
            e.currentTarget.style.display = 'none'
            e.currentTarget.parentElement.classList.add('flex', 'items-center', 'justify-center')
            e.currentTarget.parentElement.innerHTML = '<span class="text-rose-800/40 text-3xl">📷</span>'
          }}
        />
      </div>
    </div>
  )
}
