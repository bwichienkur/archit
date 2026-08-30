import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { CadImportValidation } from './types';

type Props = {
  validation: CadImportValidation;
  onClose(): void;
};

export function ValidationReport({ validation, onClose }: Props) {
  const countMatch = validation.sourceEntityCount === validation.normalizedEntityCount;

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="validation-modal" role="dialog" aria-modal="true" aria-label="CAD import validation report" onMouseDown={event => event.stopPropagation()}>
      <div className="modal-header">
        <div>
          <small>DWG IMPORT</small>
          <h2>Validation report</h2>
          <p>{validation.sourceFileName}</p>
        </div>
        <button onClick={onClose} aria-label="Close validation report"><X size={17}/></button>
      </div>

      <div className={`validation-summary ${validation.passed ? 'passed' : 'failed'}`}>
        {validation.passed ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>} 
        <div><strong>{validation.passed ? 'Import passed validation' : 'Import requires review'}</strong><span>Archit never silently repairs or discards source geometry.</span></div>
      </div>

      <div className="validation-grid">
        <Metric label="Source entities" value={validation.sourceEntityCount}/>
        <Metric label="Normalized entities" value={validation.normalizedEntityCount}/>
        <Metric label="Unsupported" value={validation.unsupportedEntityCount}/>
        <Metric label="Count check" value={countMatch ? 'Match' : 'Mismatch'}/>
      </div>

      <ReportSection title="Missing references" items={validation.missingReferences}/>
      <ReportSection title="Missing fonts" items={validation.missingFonts}/>
      <ReportSection title="Warnings" items={validation.warnings}/>

      {validation.boundsDelta && <section className="report-section">
        <h3>BOUNDING BOX DELTA</h3>
        <div className="validation-grid compact">
          <Metric label="Min X" value={format(validation.boundsDelta.minX)}/>
          <Metric label="Min Y" value={format(validation.boundsDelta.minY)}/>
          <Metric label="Max X" value={format(validation.boundsDelta.maxX)}/>
          <Metric label="Max Y" value={format(validation.boundsDelta.maxY)}/>
        </div>
      </section>}
    </div>
  </div>;
}

function ReportSection({ title, items }: { title: string; items: string[] }) {
  return <section className="report-section"><h3>{title.toUpperCase()}</h3>{items.length === 0 ? <p className="report-empty">None</p> : <ul>{items.map((item, index)=><li key={`${item}-${index}`}>{item}</li>)}</ul>}</section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="validation-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function format(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : '—';
}
