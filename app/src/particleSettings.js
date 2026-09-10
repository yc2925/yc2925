export const PARTICLE_LIMITS = {
  spacing: { min: 0.12, max: 0.85, step: 0.01 },
  hue: { min: 0, max: 360, step: 1 },
  shape: { min: 0, max: 1, step: 0.01 },
}

export const DEFAULT_PARTICLES = {
  spacing: 0.28,
  hue: 214,
  shape: 0.2,
}

export function hueToCss(hue) {
  return `hsl(${Math.round(hue)} 78% 62%)`
}

export const PARTICLE_TIPS = {
  spacing: 'Distance between particles. Higher expands the whole cloud.',
  hue: 'Hue of the particles. This is content color, not the UI highlight.',
  shape: 'How irregular the outer hull is. 0% is a sphere; higher makes a lumpy blob.',
}
