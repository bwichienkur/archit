import type { Product } from './catalog';
import type { ConfigurationSelection, ConfigurationSession } from './configurator';

export type BuilderConfiguratorPanelProps = {
  session: ConfigurationSession;
  productsById: Record<string,Product>;
  onStatusChange?(selectionId:string,status:ConfigurationSelection['status']):void;
  onRemove?(targetId:string):void;
};

export function BuilderConfiguratorPanel({session,productsById,onStatusChange,onRemove}:BuilderConfiguratorPanelProps){
  const totals=session.selections.reduce((acc,selection)=>{acc[selection.status]=(acc[selection.status]??0)+1;return acc;},{} as Record<string,number>);
  return <section className="builder-configurator-panel" aria-label="Builder selections">
    <header><div><small>BUILDER CONFIGURATOR</small><strong>{session.selections.length} selections</strong></div><div className="builder-selection-summary"><span>Draft {totals.draft??0}</span><span>Customer {totals['customer-approved']??0}</span><span>Builder {totals['builder-approved']??0}</span><span>Locked {totals.locked??0}</span></div></header>
    <div className="builder-selection-list">{session.selections.length===0?<p>No selections have been configured.</p>:session.selections.map(selection=>{const product=productsById[selection.productId];const targetRole=selection.target.surfaceRole??selection.target.objectRole??selection.target.targetType;return <article key={selection.id} className={`builder-selection ${selection.status}`}><div><strong>{product?.name??selection.productId}</strong><small>{selection.target.roomType??'Project'} • {targetRole}</small></div><dl><div><dt>Quantity</dt><dd>{selection.quantity}</dd></div><div><dt>Waste</dt><dd>{Math.round(selection.wasteFactor*100)}%</dd></div><div><dt>Status</dt><dd>{selection.status}</dd></div></dl><div className="builder-selection-actions">{selection.status!=='locked'&&<><button onClick={()=>onStatusChange?.(selection.id,'customer-approved')}>Customer approve</button><button onClick={()=>onStatusChange?.(selection.id,'builder-approved')}>Builder approve</button><button onClick={()=>onRemove?.(selection.target.id)}>Remove</button></>}{selection.status==='builder-approved'&&<button onClick={()=>onStatusChange?.(selection.id,'locked')}>Lock</button>}</div></article>})}</div>
  </section>;
}
