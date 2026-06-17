export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SpatialHashGrid<T extends { x: number; y: number }> {
  private cells = new Map<string, T[]>();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  insert(node: T): void {
    const cx = Math.floor(node.x / this.cellSize);
    const cy = Math.floor(node.y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(node);
  }

  clear(): void {
    this.cells.clear();
  }

  query(bounds: Bounds): T[] {
    const startCX = Math.floor(bounds.x / this.cellSize);
    const endCX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const startCY = Math.floor(bounds.y / this.cellSize);
    const endCY = Math.floor((bounds.y + bounds.height) / this.cellSize);
    const result: T[] = [];
    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cy = startCY; cy <= endCY; cy++) {
        const k = this.key(cx, cy);
        const bucket = this.cells.get(k);
        if (bucket) {
          for (const node of bucket) {
            result.push(node);
          }
        }
      }
    }
    return result;
  }
}
