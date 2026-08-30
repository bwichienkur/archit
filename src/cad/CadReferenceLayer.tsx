import type { CadBlockDefinition, CadDocument, CadEntity, CadLayer, CadPoint } from './types';

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
type EllipseGeometry = { center: CadPoint; radiusX: number; radiusY: number; rotation?: number; startAngle?: number; endAngle?: number };
type SampledGeometry = { sampledPoints?: CadPoint[]; vertices?: CadPoint[] };
type TextGeometry = { position: CadPoint; text: string; height?: number; rotation?: number; width?: number };
type HatchGeometry = { loops: CadPoint[][] };
type SegmentedGeometry = { segments?: Array<{ start: CadPoint; end: CadPoint }>; vertices?: CadPoint[]; text?: string; textPosition?: CadPoint; textHeight?: number };
type BlockReferenceGeometry = { blockId?: string; blockName?: string; affine2d?: [number, number, number, number, number, number] };

export function CadReferenceLayer({ document, hiddenLayerIds = new Set(), selectedEntityId, onSelectEntity }: Props) {
  const width = Math.max(document.bounds.max.x - document.bounds.min.x, 1);
  const height = Math.max(document.bounds.max.y - document.bounds.min.y, 1);
  const padding = Math.max(width, height) * 0.025;
  const viewBox = `${document.bounds.min.x - padding} ${document.bounds.min.y - padding} ${width + padding * 2} ${height + padding * 2}`;
  const visibleLayers = new Set(document.layers.filter(layer => layer.visible && !layer.frozen && !hiddenLayerIds.has(layer.id)).map(layer => layer.id));
  const layerById = new Map(document.layers.map(layer => [layer.id, layer]));
  const entityById = new Map(document.entities.map(entity => [entity.id, entity]));
  const blockById = new Map(document.blocks.map(block => [block.id, block]));
  const blockByName = new Map(document.blocks.map(block => [block.name, block]));
  const nestedEntityIds = new Set(document.blocks.flatMap(block => block.entityIds));
  const rootEntities = document.entities.filter(entity => visibleLayers.has(entity.layerId) && !nestedEntityIds.has(entity.id));

  return <svg className="cad-source-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
    <g transform={`translate(0 ${document.bounds.min.y + document.bounds.max.y}) scale(1 -1)`}>
      {rootEntities.map(entity => <CadEntityShape
        key={entity.id}
        entity={entity}
        layer={layerById.get(entity.layerId)}
        selectedEntityId={selectedEntityId}
        onSelect={onSelectEntity}
        entityById={entityById}
        layerById={layerById}
        blockById={blockById}
        blockByName={blockByName}
        depth={0}
      />)}
    </g>
  </svg>;
}

function CadEntityShape({ entity, layer, selectedEntityId, onSelect, entityById, layerById, blockById, blockByName, depth }: {
  entity: CadEntity;
  layer?: CadLayer;
  selectedEntityId?: string | null;
  onSelect?: (id: string) => void;
  entityById: Map<string, CadEntity>;
  layerById: Map<string, CadLayer>;
  blockById: Map<string, CadBlockDefinition>;
  blockByName: Map<string, CadBlockDefinition>;
  depth: number;
}) {
  const selected = selectedEntityId === entity.id;
  const common = {
    className: `cad-entity ${selected ? 'selected' : ''} ${entity.unsupported ? 'unsupported' : ''}`,
    onClick: (event: React.MouseEvent<SVGElement>) => { event.stopPropagation(); onSelect?.(entity.id); },
    vectorEffect: 'non-scaling-stroke' as const,
    style: { stroke: entity.style?.color ?? layer?.color },
    'data-source-handle': entity.sourceHandle,
    'data-layer-id': entity.layerId,
  };

  if (entity.type === 'line') {
    const geometry = entity.geometry as unknown as LineGeometry;
    if (!geometry.start || !geometry.end) return null;
    return <line {...common} x1={geometry.start.x} y1={geometry.start.y} x2={geometry.end.x} y2={geometry.end.y}/>;
  }
  if (entity.type === 'polyline') {
    const geometry = entity.geometry as unknown as PolylineGeometry;
    if (!Array.isArray(geometry.vertices) || geometry.vertices.length < 2) return null;
    const points = geometry.vertices.map(point => `${point.x},${point.y}`).join(' ');
    return geometry.closed ? <polygon {...common} points={points}/> : <polyline {...common} points={points}/>;
  }
  if (entity.type === 'circle') {
    const geometry = entity.geometry as unknown as CircleGeometry;
    if (!geometry.center || !Number.isFinite(geometry.radius)) return null;
    return <circle {...common} cx={geometry.center.x} cy={geometry.center.y} r={geometry.radius}/>;
  }
  if (entity.type === 'arc') {
    const geometry = entity.geometry as unknown as ArcGeometry;
    if (!geometry.center || !Number.isFinite(geometry.radius)) return null;
    return <path {...common} d={arcPath(geometry.center, geometry.radius, geometry.radius, geometry.startAngle, geometry.endAngle, 0)}/>;
  }
  if (entity.type === 'ellipse') {
    const geometry = entity.geometry as unknown as EllipseGeometry;
    if (!geometry.center || !Number.isFinite(geometry.radiusX) || !Number.isFinite(geometry.radiusY)) return null;
    const rotation = geometry.rotation ?? 0;
    if (geometry.startAngle == null || geometry.endAngle == null) {
      return <ellipse {...common} cx={geometry.center.x} cy={geometry.center.y} rx={geometry.radiusX} ry={geometry.radiusY} transform={`rotate(${rotation * 180 / Math.PI} ${geometry.center.x} ${geometry.center.y})`}/>;
    }
    return <path {...common} d={arcPath(geometry.center, geometry.radiusX, geometry.radiusY, geometry.startAngle, geometry.endAngle, rotation)}/>;
  }
  if (entity.type === 'spline') {
    const geometry = entity.geometry as unknown as SampledGeometry;
    const points = geometry.sampledPoints ?? geometry.vertices;
    if (!Array.isArray(points) || points.length < 2) return null;
    return <polyline {...common} points={points.map(point => `${point.x},${point.y}`).join(' ')}/>;
  }
  if (entity.type === 'text' || entity.type === 'mtext') {
    const geometry = entity.geometry as unknown as TextGeometry;
    if (!geometry.position || typeof geometry.text !== 'string') return null;
    const rotationDegrees = -(geometry.rotation ?? 0) * 180 / Math.PI;
    return <text {...common} className={`${common.className} cad-text`} x={0} y={0} fontSize={geometry.height ?? 2.5} transform={`translate(${geometry.position.x} ${geometry.position.y}) scale(1 -1) rotate(${rotationDegrees})`}>{geometry.text}</text>;
  }
  if (entity.type === 'hatch') {
    const geometry = entity.geometry as unknown as HatchGeometry;
    if (!Array.isArray(geometry.loops) || geometry.loops.length === 0) return null;
    const d = geometry.loops.map(loop => loop.length < 3 ? '' : `M ${loop.map(point => `${point.x} ${point.y}`).join(' L ')} Z`).join(' ');
    return <path {...common} className={`${common.className} cad-hatch`} d={d} fillRule="evenodd"/>;
  }
  if (entity.type === 'leader' || entity.type === 'dimension') {
    const geometry = entity.geometry as unknown as SegmentedGeometry;
    const segments = geometry.segments ?? segmentsFromVertices(geometry.vertices);
    if (segments.length === 0) return null;
    return <g className={common.className} onClick={common.onClick} data-source-handle={entity.sourceHandle}>{segments.map((segment,index)=><line key={index} {...common} onClick={undefined} x1={segment.start.x} y1={segment.start.y} x2={segment.end.x} y2={segment.end.y}/>)}{geometry.text && geometry.textPosition && <text className="cad-entity cad-text" x={0} y={0} fontSize={geometry.textHeight ?? 2.5} transform={`translate(${geometry.textPosition.x} ${geometry.textPosition.y}) scale(1 -1)`}>{geometry.text}</text>}</g>;
  }
  if (entity.type === 'solid' || entity.type === '3d-face') {
    const geometry = entity.geometry as unknown as SampledGeometry;
    const points = geometry.vertices;
    if (!Array.isArray(points) || points.length < 3) return null;
    return <polygon {...common} className={`${common.className} cad-solid`} points={points.map(point => `${point.x},${point.y}`).join(' ')}/>;
  }
  if (entity.type === 'point') {
    const point = (entity.geometry.position ?? entity.geometry.point) as CadPoint | undefined;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return <g className={common.className} onClick={common.onClick}><circle {...common} onClick={undefined} cx={point.x} cy={point.y} r={2}/><line {...common} onClick={undefined} x1={point.x-3} y1={point.y} x2={point.x+3} y2={point.y}/><line {...common} onClick={undefined} x1={point.x} y1={point.y-3} x2={point.x} y2={point.y+3}/></g>;
  }
  if (entity.type === 'block-reference' && depth < 8) {
    const geometry = entity.geometry as unknown as BlockReferenceGeometry;
    const block = (geometry.blockId ? blockById.get(geometry.blockId) : undefined) ??
      (geometry.blockName ? blockByName.get(geometry.blockName) : undefined) ??
      (entity.sourceBlockName ? blockByName.get(entity.sourceBlockName) : undefined);
    if (!block || !geometry.affine2d) return null;
    const [a,b,c,d,e,f] = geometry.affine2d;
    return <g className={common.className} onClick={common.onClick} transform={`matrix(${a} ${b} ${c} ${d} ${e} ${f})`} data-source-handle={entity.sourceHandle}>
      {block.entityIds.map(id => {
        const child = entityById.get(id);
        if (!child) return null;
        return <CadEntityShape key={`${entity.id}:${id}`} entity={child} layer={layerById.get(child.layerId)} selectedEntityId={selectedEntityId} onSelect={onSelect} entityById={entityById} layerById={layerById} blockById={blockById} blockByName={blockByName} depth={depth+1}/>;
      })}
    </g>;
  }

  return null;
}

function segmentsFromVertices(vertices?: CadPoint[]) {
  if (!Array.isArray(vertices) || vertices.length < 2) return [];
  return vertices.slice(1).map((point,index) => ({ start: vertices[index], end: point }));
}

function arcPath(center: CadPoint, radiusX: number, radiusY: number, startAngle: number, endAngle: number, rotation: number) {
  const start = ellipsePolar(center, radiusX, radiusY, startAngle, rotation);
  const end = ellipsePolar(center, radiusX, radiusY, endAngle, rotation);
  let sweep = endAngle - startAngle;
  while (sweep < 0) sweep += Math.PI * 2;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radiusX} ${radiusY} ${rotation * 180 / Math.PI} ${largeArc} 1 ${end.x} ${end.y}`;
}

function ellipsePolar(center: CadPoint, radiusX: number, radiusY: number, angle: number, rotation: number): CadPoint {
  const x = radiusX * Math.cos(angle);
  const y = radiusY * Math.sin(angle);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { x: center.x + x*cos - y*sin, y: center.y + x*sin + y*cos };
}
