import type { CadDocument } from '../cad/types';
import type { ArchitecturalWall, BuildingModelV2, WallOpening } from '../domain/building';
import type { BuildingSelection } from './buildingStore';

type Props = {
  document: CadDocument;
  model: BuildingModelV2;
  selection: BuildingSelection;
  onSelect(selection: BuildingSelection): void;
};

export function BuildingOverlay({ document, model, selection, onSelect }: Props) {
  const width = Math.max(document.bounds.max.x - document.bounds.min.x, 1);
  const height = Math.max(document.bounds.max.y - document.bounds.min.y, 1);
  const padding = Math.max(width, height) * 0.025;
  const viewBox = `${document.bounds.min.x - padding} ${document.bounds.min.y - padding} ${width + padding * 2} ${height + padding * 2}`;
  const flip = `translate(0 ${document.bounds.min.y + document.bounds.max.y}) scale(1 -1)`;
  const wallById = new Map(model.walls.map(wall => [wall.id, wall]));

  return <svg className="building-overlay-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-label="Editable building model overlay">
    <g transform={flip}>
      {model.rooms.map(room => <polygon
        key={room.id}
        points={room.boundary.map(point => `${point.x},${point.y}`).join(' ')}
        className={`building-room ${selection?.kind === 'room' && selection.id === room.id ? 'selected' : ''} ${room.lineage.validationState}`}
        onClick={event => { event.stopPropagation(); onSelect({ kind: 'room', id: room.id }); }}
        vectorEffect="non-scaling-stroke"
      />)}
      {model.walls.map(wall => <line
        key={wall.id}
        x1={wall.start.x}
        y1={wall.start.y}
        x2={wall.end.x}
        y2={wall.end.y}
        strokeWidth={Math.max(wall.thickness, Math.max(width, height) * 0.0015)}
        className={`building-wall ${selection?.kind === 'wall' && selection.id === wall.id ? 'selected' : ''} ${wall.lineage.validationState}`}
        onClick={event => { event.stopPropagation(); onSelect({ kind: 'wall', id: wall.id }); }}
        vectorEffect="non-scaling-stroke"
      />)}
      {model.openings.map(opening => {
        const wall = wallById.get(opening.hostWallId);
        return wall ? <OpeningSymbol key={opening.id} opening={opening} wall={wall} selected={selection?.kind === 'opening' && selection.id === opening.id} onSelect={()=>onSelect({kind:'opening',id:opening.id})}/> : null;
      })}
    </g>
  </svg>;
}

function OpeningSymbol({ opening, wall, selected, onSelect }: { opening: WallOpening; wall: ArchitecturalWall; selected: boolean; onSelect(): void }) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return null;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const startDistance = opening.offsetFromWallStart;
  const endDistance = startDistance + opening.width;
  const start = { x: wall.start.x + ux * startDistance, y: wall.start.y + uy * startDistance };
  const end = { x: wall.start.x + ux * endDistance, y: wall.start.y + uy * endDistance };
  const symbolDepth = Math.max(wall.thickness * 1.8, opening.width * .18);
  const className = `building-opening ${opening.kind} ${selected ? 'selected' : ''}`;

  if (opening.kind === 'window') {
    const a1 = { x: start.x + px * symbolDepth * .35, y: start.y + py * symbolDepth * .35 };
    const b1 = { x: end.x + px * symbolDepth * .35, y: end.y + py * symbolDepth * .35 };
    const a2 = { x: start.x - px * symbolDepth * .35, y: start.y - py * symbolDepth * .35 };
    const b2 = { x: end.x - px * symbolDepth * .35, y: end.y - py * symbolDepth * .35 };
    return <g className={className} onClick={event=>{event.stopPropagation();onSelect();}}>
      <line className="building-opening-cut" x1={start.x} y1={start.y} x2={end.x} y2={end.y} strokeWidth={Math.max(wall.thickness * 1.25, .5)} vectorEffect="non-scaling-stroke"/>
      <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} vectorEffect="non-scaling-stroke"/>
      <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} vectorEffect="non-scaling-stroke"/>
    </g>;
  }

  const leafEnd = { x: start.x + px * opening.width, y: start.y + py * opening.width };
  const arcEnd = leafEnd;
  const arcPath = `M ${end.x} ${end.y} A ${opening.width} ${opening.width} 0 0 1 ${arcEnd.x} ${arcEnd.y}`;
  return <g className={className} onClick={event=>{event.stopPropagation();onSelect();}}>
    <line className="building-opening-cut" x1={start.x} y1={start.y} x2={end.x} y2={end.y} strokeWidth={Math.max(wall.thickness * 1.25, .5)} vectorEffect="non-scaling-stroke"/>
    <line x1={start.x} y1={start.y} x2={leafEnd.x} y2={leafEnd.y} vectorEffect="non-scaling-stroke"/>
    <path d={arcPath} fill="none" vectorEffect="non-scaling-stroke"/>
  </g>;
}
