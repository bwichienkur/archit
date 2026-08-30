import type { CadDocument } from '../cad/types';
import type { BuildingModelV2 } from '../domain/building';
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
    </g>
  </svg>;
}
