// The look shared by the console and the editor panels: the game's "View logs" panel.
export const THEME = Object.freeze({
  background: '#0E2236e5',
  scrollThumb: '#3C9DFF',
  scrollTrack: '#01010119',
  inputBackground: '#00000066',
  inputBorder: '1px solid rgba(60,157,255,0.3)',
  font: 'DejaVuSansMono',
  titleFont: 'EuropeExt',
});

// Keep the game's handlers (on window and document, bubble phase) from seeing input
// meant for a panel. Pointer moves still reach the game, so aiming keeps working.
export const SWALLOWED_EVENTS = Object.freeze(['keydown', 'keypress', 'mousedown', 'mouseup', 'click', 'dblclick',
  'wheel', 'contextmenu', 'pointerdown', 'pointerup', 'touchstart', 'touchend']);

export function swallow(node) {
  for (const type of SWALLOWED_EVENTS) node.addEventListener(type, (e) => e.stopPropagation());
}
