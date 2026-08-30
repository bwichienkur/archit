import type { BuildingModelV2 } from '../domain/building';

export type AiProposalKind = 'room-classification'|'product-match'|'finish-suggestion'|'layout-suggestion'|'geometry-review'|'value-engineering';
export type AiProposal = { id:string; projectId:string; revisionId?:string; kind:AiProposalKind; summary:string; rationale:string; targetIds:string[]; confidence:number; proposedPatch?:unknown; createdAt:string; status:'pending'|'accepted'|'rejected' };

export function validateAiProposal(proposal:AiProposal){const issues:string[]=[];if(!proposal.summary.trim())issues.push('Summary is required.');if(!proposal.rationale.trim())issues.push('Rationale is required.');if(proposal.confidence<0||proposal.confidence>1)issues.push('Confidence must be between 0 and 1.');if(proposal.kind==='geometry-review'&&proposal.proposedPatch!=null)issues.push('Geometry-review proposals may identify issues but must not carry an auto-applied geometry patch.');return issues;}

export function acceptAiProposal(model:BuildingModelV2,proposal:AiProposal,apply:(model:BuildingModelV2,proposal:AiProposal)=>BuildingModelV2){const issues=validateAiProposal(proposal);if(issues.length)throw new Error(issues.join(' '));if(proposal.status!=='pending')throw new Error(`Proposal ${proposal.id} has already been reviewed.`);return apply(model,{...proposal,status:'accepted'});}

export function rejectAiProposal(proposal:AiProposal):AiProposal { if(proposal.status!=='pending')throw new Error(`Proposal ${proposal.id} has already been reviewed.`); return {...proposal,status:'rejected'}; }
