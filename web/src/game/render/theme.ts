export const THEME = {
  bg: '#111827',
  path: '#78583c',
  buildable: '#1a3a1a',
  gridLine: 'rgba(255, 255, 255, 0.06)',
  hover: 'rgba(253, 224, 71, 0.35)',
  towerGhost: 'rgba(96, 165, 250, 0.45)',
  enemy: '#ef4444',
  // Per-def color tokens — strong contrast against buildable ('#1a3a1a') and path ('#78583c')
  towers: {
    cannon: '#b45309', // amber-700: heavy, warm, reads as iron/bronze
    archer: '#0e7490', // cyan-700: lighter, cooler, reads as ranger
  },
  enemies: {
    goblin: '#16a34a', // green-600: classic goblin green, distinct from path brown
  },
  // Magenta placeholder — renders for any unknown defId so bugs are visible immediately
  placeholder: '#ff00ff',
} as const;
