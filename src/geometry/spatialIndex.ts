export type Bounds2 = { minX:number; minY:number; maxX:number; maxY:number };
export type SpatialItem<T> = { id:string; bounds:Bounds2; value:T };

export class GridSpatialIndex<T> {
  private readonly cells = new Map<string, Set<string>>();
  private readonly items = new Map<string, SpatialItem<T>>();
  constructor(private readonly cellSize:number) { if (!(cellSize > 0)) throw new Error('cellSize must be positive.'); }

  upsert(item:SpatialItem<T>) {
    this.remove(item.id);
    this.items.set(item.id, item);
    for (const key of this.cellKeys(item.bounds)) {
      const set=this.cells.get(key)??new Set<string>(); set.add(item.id); this.cells.set(key,set);
    }
  }

  remove(id:string) {
    const existing=this.items.get(id); if(!existing)return false;
    for(const key of this.cellKeys(existing.bounds)){const set=this.cells.get(key);set?.delete(id);if(set?.size===0)this.cells.delete(key);}
    this.items.delete(id); return true;
  }

  query(bounds:Bounds2) {
    const ids=new Set<string>();
    for(const key of this.cellKeys(bounds)) for(const id of this.cells.get(key)??[]) ids.add(id);
    return [...ids].map(id=>this.items.get(id)!).filter(item=>intersects(item.bounds,bounds));
  }

  clear(){this.cells.clear();this.items.clear();}
  get size(){return this.items.size;}

  private cellKeys(bounds:Bounds2){const keys:string[]=[];const minX=Math.floor(bounds.minX/this.cellSize),maxX=Math.floor(bounds.maxX/this.cellSize),minY=Math.floor(bounds.minY/this.cellSize),maxY=Math.floor(bounds.maxY/this.cellSize);for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)keys.push(`${x}:${y}`);return keys;}
}

function intersects(a:Bounds2,b:Bounds2){return a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY;}
