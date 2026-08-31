import { useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import type { BuildingModelV2, RoofPlane } from '../domain/building';
import { roofPointElevation } from '../domain/roofSolver';
import type { SceneTransform2D } from './RoomSurfaces3D';

type Props={model:BuildingModelV2;transform:SceneTransform2D;selectedId?:string|null;onSelect?(roofPlaneId:string):void};

export function RoofPlanes3D({model,transform,selectedId,onSelect}:Props){const geometries=useMemo(()=>model.roofPlanes.map(plane=>({plane,geometry:roofGeometry(plane,transform)})),[model.roofPlanes,transform]);return <>{geometries.map(({plane,geometry})=><mesh key={plane.id} geometry={geometry} castShadow receiveShadow onClick={event=>{event.stopPropagation();onSelect?.(plane.id)}}><meshStandardMaterial side={DoubleSide} color={selectedId===plane.id?'#d9a441':'#747b80'} roughness={.82}/></mesh>)}</>;}

function roofGeometry(plane:RoofPlane,transform:SceneTransform2D){if(plane.boundary.length<3)throw new Error(`Roof plane ${plane.id} requires at least three points.`);const contour=plane.boundary.map(point=>new Vector2((point.x-transform.centerX)*transform.scale,(point.y-transform.centerY)*transform.scale));const faces=ShapeUtils.triangulateShape(contour,[]);const positions:number[]=[];for(const point of plane.boundary)positions.push((point.x-transform.centerX)*transform.scale,roofPointElevation(plane,point)*transform.scale,(point.y-transform.centerY)*transform.scale);const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(faces.flat());geometry.computeVertexNormals();return geometry;}
