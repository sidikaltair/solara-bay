// Keyboard + mouse input. Held keys are read every frame; one-shot presses
// (enter car, pause, confirm, mute) are queued as flags and taken once, so a
// press between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MUTE = 8;

const MOVE = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' || event.code === 'Space') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (MOVE[event.code]) {
      keys.add(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  // A key released while the tab is hidden never sends keyup: drop everything on blur.
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    // Normalised WASD / arrow movement vector.
    move() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const m = MOVE[code];
        if (m) { x += m[0]; y += m[1]; }
      }
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    brake() { return keys.has('Space'); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
