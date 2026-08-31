import type { Point2 } from '../domain/building';

export type AnnotationKind = 'linear-dimension'|'aligned-dimension'|'angular-dimension'|'radius-dimension'|'diameter-dimension'|'leader'|'text'|'room-tag'|'door-tag'|'window-tag'|'section-marker'|'elevation-marker'|'revision-cloud';
export type AnnotationStyle = { textHeight:number; arrowSize:number; lineWeight:number; fontFamily?:string; precision?:number; unitOverride?:string };
export type Annotation = { id:string; projectId:string; revisionId?:string; levelId:string; kind:AnnotationKind; points:Point2[]; text?:string; targetIds:string[]; style:AnnotationStyle; createdBy:string; createdAt:string; updatedAt:string };

export function validateAnnotation(annotation:Annotation){const issues:string[]=[];if(annotation.points.length===0)issues.push('Annotation requires at least one point.');if(annotation.style.textHeight<=0)issues.push('Text height must be positive.');if(annotation.style.arrowSize<0)issues.push('Arrow size cannot be negative.');if(annotation.kind.includes('dimension')&&annotation.points.length<2)issues.push('Dimension annotations require at least two points.');if(annotation.kind==='text'&&!annotation.text?.trim())issues.push('Text annotation requires text.');return issues;}

export function linearDimensionValue(annotation:Annotation){if(annotation.kind!=='linear-dimension'&&annotation.kind!=='aligned-dimension')throw new Error('Annotation is not a linear dimension.');const [a,b]=annotation.points;if(!a||!b)throw new Error('Dimension requires two points.');return Math.hypot(b.x-a.x,b.y-a.y);}
