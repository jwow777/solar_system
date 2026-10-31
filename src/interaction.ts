export class ClickGesture {
  private pointers = new Map<number, { x: number; y: number }>();
  private dragged = false;

  down(id: number, x: number, y: number) {
    if (!this.pointers.size) this.dragged = false;
    else this.dragged = true;
    this.pointers.set(id, { x, y });
  }

  move(id: number, x: number, y: number) {
    const start = this.pointers.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) >= 6) this.dragged = true;
  }

  up(id: number, x: number, y: number): boolean {
    this.move(id, x, y);
    const click = this.pointers.has(id) && this.pointers.size === 1 && !this.dragged;
    this.pointers.delete(id);
    return click;
  }

  cancel() { this.pointers.clear(); this.dragged = true; }
}
