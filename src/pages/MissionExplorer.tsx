import { useEffect } from 'react'

export function MissionExplorer({ applicationView = false }: { applicationView?: boolean }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  return (
    <div className="w-full h-full flex flex-col box-border">
      <iframe
        title="Fire Safety Atlas"
        src={applicationView ? '/artifacts/fire-safety-atlas.html#Applications' : '/artifacts/fire-safety-atlas.html'}
        className="mission-explorer-frame"
      />
    </div>
  )
}

export default MissionExplorer
