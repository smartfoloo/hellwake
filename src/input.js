// Keyboard / mouse state shared by player and weapons.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDown = false;
    this.wheelDelta = 0;
    this.justPressed = new Set();

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    addEventListener('wheel', (e) => { this.wheelDelta += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
  }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this.justPressed.has(code); }

  consumeWheel() {
    const d = this.wheelDelta;
    this.wheelDelta = 0;
    return d;
  }

  // Call at the end of each frame.
  endFrame() {
    this.justPressed.clear();
  }
}
