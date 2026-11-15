import React from 'react'

const GlassSurface = ({
  children,
  className = '',
  width = '100%',
  height = 'auto',
  borderRadius = 38,
  borderWidth = 0.07,
  backgroundOpacity = 0.1,
  brightness = 1,
  blur = 14,
  saturation = 1.15,
  style,
  ...props
}) => (
  <div
    className={`glass-surface ${className}`}
    style={{
      width,
      height,
      borderRadius,
      '--glass-border-opacity': borderWidth,
      '--glass-background-opacity': backgroundOpacity,
      '--glass-brightness': brightness,
      '--glass-blur': `${blur}px`,
      '--glass-saturation': saturation,
      ...style,
    }}
    {...props}
  >
    <div className="glass-surface__shine" aria-hidden="true" />
    <div className="glass-surface__content">{children}</div>
  </div>
)

export default GlassSurface
