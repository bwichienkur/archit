export type ApprovalState = 'draft'|'customer-approved'|'builder-approved'|'locked'|'rejected';
export type ApprovalActor = { userId:string; role:'customer'|'builder'|'admin'|'designer'|'architect' };
export type ApprovalRecord = { id:string; selectionId:string; state:ApprovalState; actor:ApprovalActor; createdAt:string; note?:string };

export function transitionApproval(current:ApprovalState,next:ApprovalState,actor:ApprovalActor):ApprovalState {
  const allowed:Record<ApprovalState,ApprovalState[]>={draft:['customer-approved','builder-approved','rejected'], 'customer-approved':['builder-approved','rejected'], 'builder-approved':['locked','rejected'], locked:[], rejected:['draft']};
  if(!allowed[current].includes(next))throw new Error(`Cannot transition approval from ${current} to ${next}.`);
  if(next==='customer-approved'&&actor.role!=='customer'&&actor.role!=='admin')throw new Error('Only a customer or admin can record customer approval.');
  if((next==='builder-approved'||next==='locked')&&actor.role!=='builder'&&actor.role!=='admin')throw new Error('Only a builder or admin can record builder approval or lock a selection.');
  return next;
}

export function latestApproval(records:ApprovalRecord[],selectionId:string){return records.filter(record=>record.selectionId===selectionId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]??null;}
