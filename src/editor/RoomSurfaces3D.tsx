import { useMemo } from 'react';
import { DoubleSide, Shape } from 'three';
import type { BuildingModelV2 } from '../domain/building';
import { buildRoomSurfaces } from '../domain/roomSurfaces';

export type SceneTransform2D = {
  centerX: number;
  centerY: number;
  scale: number;
};

type Props = {
  model: BuildingModelV2;
  transform: SceneTransform2D;
  showFloors?: boolean;
  showCeilings?: boolean;
  onSelectRoom?: (roomId: string) => void;
};

export function RoomSurfaces3D({ model, transform, showFloors = true, showCeilings = false, onSelectRoom }: Props) {
  const surfaces = useMemo(() => buildRoomSurfaces(model), [model]);
  const meshes = useMemo(() => surfaces
    .filter(surface => surface.kind === 'floor' ? showFloors : showCeilings)
    .map(surface => ({
      surface,
      shape: toShape(surface.boundary, transform),
      elevation: surface.elevation * transform.scale,
    })), [surfaces, showFloors, showCeilings, transform]);

  return <>{meshes.map(({ surface, shape, elevation }) => <mesh
    key={surface.id}
    position={[0, elevation, 0]}
    rotation={[Math.PI / 2, 0, 0]}
    receiveShadow={surface.kind === 'floor'}
    onClick={event => { event.stopPropagation(); onSelectRoom?.(surface.roomId); }}
  >
    <shapeGeometry args={[shape]}/>
    <meshStandardMaterial side={DoubleSide} transparent opacity={surface.kind === 'floor' ? .92 : .55}/>
  </mesh>)}</>;
}

function toShape(boundary: Array<{x:number;y:number}>, transform: SceneTransform2D) {
  if (boundary.length < 3) throw new Error('Room surface requires at least three boundary points.');
  const shape = new Shape();
  const first = project(boundary[0], transform);
  shape.moveTo(first.x, first.y);
  for (let index = 1; index < boundary.length; index += 1) {
    const point = project(boundary[index], transform);
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  return shape;
}

function project(point: {x:number;y:number}, transform: SceneTransform2D) {
  return {
    x: (point.x - transform.centerX) * transform.scale,
    y: (point.y - transform.centerY) * transform.scale,
  };
}
