import type { CadDocument, CadEntity, CadPoint } from './types';

type Props = {
  document: CadDocument;
  hiddenLayerIds?: Set<string>;
  selectedEntityId?: string | null;
  onSelectEntity?: (id: string) => void;
};

type LineGeometry = { start: CadPoint; end: CadPoint };
type PolylineGeometry = { vertices: CadPoint[]; closed?: boolean };
type CircleGeometry = { center: CadPoint; radius: number };
type ArcGeometry = { center: CadPoint; radius: number; startAngle: number; endAngle: number };

export function CadReferenceLayer({ document, hiddenLayerIds = new Set(), selectedEntityId, onSelectEntity }: Props) {
  const width = Math.max(document.bounds.max.x - document.bounds.min.x, 1);
  const height = Math.max(document.bounds.max.y - document.bounds.min.y, 1);
  const padding = Math.max(width, height) * 0.025;
  const viewBox = `${document.bounds.min.x - padding} ${document.bounds.min.y - padding} ${width + padding * 2} ${height + padding * 2}`;
  const visibleLayers = new Set(document.layers.filter(layer => layer.visible && !hiddenLayerIds.has(layer.id)).map(layer => layer.id));

  return <svg className="cad-source-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
    <g transform={`translate(0 ${document.bounds.min.y + document.bounds.max.y}) scale(1 -1)`}>
      {document.entities.filter(entity => visibleLayers.has(entity.layerId)).map(entity =>
        <CadEntityShape key={entity.id} entity={entity} selected={selectedEntityId === entity.id} onSelect={onSelectEntity}/>) }
    </g>
  </svg>;
}

function CadEntityShape({ entity, selected, onSelect }: { entity: CadEntity; selected: boolean; onSelect?: (id: string) => void }) {
  const props = {
    className: `cad-entity ${selected ? 'selected' : ''} ${entity.unsupported ? 'unsupported' : ''}`,
    onClick: () => onSelect?.(entity.id),
    vectorEffect: 'non-scaling-stroke' as const
  };

  if (entity.type === 'line') {
    const geometry = entity.geometry as unknown as LineGeometry;
    if (!geometry.start || !geometry.end) return null;
    return <line {...props} x1={geometry.start.x} y1={geometry.start.y} x2={geometry.end.x} y2={geometry.end.y}/>;
  }
  if (entity.type === 'polyline') {
    const geometry = entity.geometry as unknown as PolylineGeometry;
    if (!Array.isArray(geometry.vertices) || geometry.vertices.length < 2) return null;
    const points = geometry.vertices.map(point => `${point.x},${point.y}`).join(' ');
    return geometry.closed ? <polygon {...props} points={points}/> : <polyline {...props} points={points}/>;
  }
  if (entity.type === 'circle') {
    const geometry = entity.geometry as unknown as CircleGeometry;
    if (!geometry.center || !Number.isFinite(geometry.radius)) return null;
    return <circle {...props} cx={geometry.center.x} cy={geometry.center.y} r={geometry.radius}/>;
  }
  if (entity.type === 'arc') {
    const geometry = entity.geometry as unknown as ArcGeometry;
    if (!geometry.center || !Number.isFinite(geometry.radius)) return null;
    const start = polar(geometry.center, geometry.radius, geometry.startAngle);
    const end = polar(geometry.center, geometry.radius, geometry.endAngle);
    let sweep = geometry.endAngle - geometry.startAngle;
    while (sweep < 0) sweep += Math.PI * 2;
    const largeArc = sweep > Math.PI ? 1 : 0;
    return <path {...props} d={`M ${start.x} ${start.y} A ${geometry.radius} ${geometry.radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}/>;
  }

  return null;
}

function polar(center: CadPoint, radius: number, angleRadians: number): CadPoint {
  return { x: center.x + radius * Math.cos(angleRadians), y: center.y + radius * Math.sin(angleRadians) };
}
