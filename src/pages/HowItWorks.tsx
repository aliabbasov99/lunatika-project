export function HowItWorks() {
  const removeTopSpacing = (frame: HTMLIFrameElement) => {
    const document = frame.contentDocument
    if (!document) return
    const style = document.createElement('style')
    style.textContent = '.hiw-shell{padding-top:0!important}.hiw-stage{align-items:stretch!important}.hiw-panel{height:520px;min-height:520px;display:flex;flex-direction:column}.hiw-panel-in{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin}.hiw-panel-foot{flex:0 0 auto}@media(max-width:900px){.hiw-stage{grid-template-columns:1fr!important}.hiw-panel{height:480px;min-height:480px}}@media(max-width:560px){.hiw-panel{height:440px;min-height:440px;padding:18px!important}.hiw-body{line-height:1.65}}'
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
