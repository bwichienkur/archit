import type { BuildingModelV2 } from '../domain/building';
import { diffBuildingModels } from './diff';

export type RevisionDiffPanelProps={before:BuildingModelV2;after:BuildingModelV2;beforeLabel?:string;afterLabel?:string;onSelectObject?(kind:string,id:string):void};

export function RevisionDiffPanel({before,after,beforeLabel='Before',afterLabel='After',onSelectObject}:RevisionDiffPanelProps){const diff=diffBuildingModels(before,after);return <section className="revision-diff-panel" aria-label="Revision comparison"><header><div><small>REVISION COMPARE</small><strong>{beforeLabel} → {afterLabel}</strong></div><div><span>Added {diff.summary.added??0}</span><span>Removed {diff.summary.removed??0}</span><span>Modified {diff.summary.modified??0}</span></div></header><div className="revision-change-list">{diff.changes.length===0?<p>No BIM object changes.</p>:diff.changes.map(change=><button key={`${change.kind}:${change.id}:${change.change}`} onClick={()=>onSelectObject?.(change.kind,change.id)} className={`revision-change ${change.change}`}><strong>{change.kind}</strong><span>{change.id}</span><small>{change.change}</small></button>)}</div></section>;}
