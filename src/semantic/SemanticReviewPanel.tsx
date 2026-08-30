import { Check, RotateCcw, X } from 'lucide-react';
import { useSemanticStore } from './store';

export function SemanticReviewPanel() {
  const { candidates, warnings, selectedCandidateId, selectCandidate, acceptCandidate, rejectCandidate, resetCandidate, acceptAll } = useSemanticStore();
  const pending = candidates.filter(item => item.reviewState === 'pending').length;
  const accepted = candidates.filter(item => item.reviewState === 'accepted').length;
  const rejected = candidates.filter(item => item.reviewState === 'rejected').length;

  if (candidates.length === 0) return <section><h3>SEMANTIC REVIEW</h3><p className="muted">No semantic candidates have been extracted yet.</p></section>;

  return <section className="semantic-review">
    <div className="section-heading"><h3>SEMANTIC REVIEW</h3><button onClick={()=>acceptAll()}>Accept all</button></div>
    <div className="review-counts"><span>{pending} pending</span><span>{accepted} accepted</span><span>{rejected} rejected</span></div>
    <div className="candidate-list">{candidates.map(item => {
      const candidate = item.candidate;
      return <div className={`candidate-row ${item.reviewState} ${selectedCandidateId===candidate.id?'selected':''}`} key={candidate.id} onClick={()=>selectCandidate(candidate.id)}>
        <div className="candidate-main"><strong>{candidate.kind}</strong><span>{Math.round(candidate.evidence.confidence*100)}%</span></div>
        <small>{candidate.evidence.method}</small>
        <div className="candidate-actions">
          <button title="Accept" onClick={event=>{event.stopPropagation();acceptCandidate(candidate.id)}}><Check size={12}/></button>
          <button title="Reject" onClick={event=>{event.stopPropagation();rejectCandidate(candidate.id)}}><X size={12}/></button>
          {item.reviewState!=='pending' && <button title="Reset review" onClick={event=>{event.stopPropagation();resetCandidate(candidate.id)}}><RotateCcw size={12}/></button>}
        </div>
      </div>})}</div>
    {warnings.length>0 && <div className="semantic-warnings">{warnings.map((warning,index)=><p key={`${warning}-${index}`}>{warning}</p>)}</div>}
  </section>;
}
