import type { BuildingModelV2, Point2 } from '../domain/building';

export type SvgExportOptions = { levelId:string; padding?:number; includeRoomLabels?:boolean; includeSourceLineage?:boolean };

export function exportLevelToSvg(model: BuildingModelV2, options: SvgExportOptions) {
  const walls = model.walls.filter(w => w.levelId === options.levelId);
  const rooms = model.rooms.filter(r => r.levelId === options.levelId);
  if (!walls.length && !rooms.length) throw new Error(`Level ${options.levelId} has no exportable geometry.`);
  const points = [...walls.flatMap(w=>[w.start,w.end]), ...rooms.flatMap(r=>r.boundary)];
  const bounds = getBounds(points);
  const padding = options.padding ?? Math.max(bounds.width,bounds.height)*0.03;
  const minX=bounds.minX-padding, minY=bounds.minY-padding, width=bounds.width+padding*2, height=bounds.height+padding*2;
  const lineage = (ids:string[]) => options.includeSourceLineage ? ` data-source-cad="${escapeXml(ids.join(','))}"` : '';
  const roomMarkup = rooms.map(room => `<polygon id="${escapeXml(room.id)}" points="${room.boundary.map(p=>`${p.x},${p.y}`).join(' ')}" class="room"${lineage(room.lineage.sourceCadEntityIds)}/>${options.includeRoomLabels===false?'':roomLabel(room)}`).join('');
  const wallMarkup = walls.map(wall => `<line id="${escapeXml(wall.id)}" x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}" stroke-width="${wall.thickness}" class="wall"${lineage(wall.lineage.sourceCadEntityIds)}/>`).join('');
  const openings = model.openings.filter(opening => walls.some(w=>w.id===opening.hostWallId)).map(opening => {
    const wall=walls.find(w=>w.id===opening.hostWallId)!; const p=openingPoint(wall.start,wall.end,opening.offsetFromWallStart+opening.width/2);
    return `<circle id="${escapeXml(opening.id)}" cx="${p.x}" cy="${p.y}" r="${Math.max(opening.width*.08,0.05)}" class="opening"${lineage(opening.lineage.sourceCadEntityIds)}/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}"><style>.wall{stroke:#111;fill:none}.room{fill:none;stroke:#777;stroke-width:.5}.opening{fill:#fff;stroke:#111;stroke-width:.5}.room-label{font-family:sans-serif;font-size:10px;text-anchor:middle}</style><g transform="translate(0 ${bounds.minY+bounds.maxY}) scale(1 -1)">${roomMarkup}${wallMarkup}${openings}</g></svg>`;
}

function roomLabel(room: BuildingModelV2['rooms'][number]) { const c=centroid(room.boundary); return `<text x="${c.x}" y="${-c.y}" transform="scale(1 -1)" class="room-label">${escapeXml(room.name)}</text>`; }
function centroid(points:Point2[]){ const sum=points.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0}); return {x:sum.x/points.length,y:sum.y/points.length}; }
function openingPoint(a:Point2,b:Point2,d:number){ const len=Math.hypot(b.x-a.x,b.y-a.y)||1; return {x:a.x+(b.x-a.x)*d/len,y:a.y+(b.y-a.y)*d/len}; }
function getBounds(points:Point2[]){ const xs=points.map(p=>p.x),ys=points.map(p=>p.y); const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys); return {minX,maxX,minY,maxY,width:Math.max(maxX-minX,1),height:Math.max(maxY-minY,1)}; }
function escapeXml(value:string){ return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
