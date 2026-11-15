export function HowItWorks() {
  const removeTopSpacing = (frame: HTMLIFrameElement) => {
    const document = frame.contentDocument
    if (!document) return
    const style = document.createElement('style')
    style.textContent = '.hiw-shell{padding-top:0!important}'
    document.head.appendChild(style)
  }

  return (
    <div className="how-it-works-page">
      <iframe
        title="Lunatika How It Works"
        src="/artifacts/Lunatika%20How%20It%20Works.html"
        className="how-it-works-frame"
        onLoad={(event) => removeTopSpacing(event.currentTarget)}
      />
    </div>
  )
}

export default HowItWorks
