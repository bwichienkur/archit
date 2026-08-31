import { useRef,useState } from 'react';
import { FileSpreadsheet,Upload } from 'lucide-react';
import { HttpCatalogGateway,type CatalogImportPreview } from './catalogGateway';
import { usePlatformWorkspaceStore } from '../platform/store';
import './catalogImport.css';

const gateway=new HttpCatalogGateway();

export function CatalogImportPanel(){
  const input=useRef<HTMLInputElement>(null);
  const setProducts=usePlatformWorkspaceStore(state=>state.setProducts);
  const [preview,setPreview]=useState<CatalogImportPreview|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [applied,setApplied]=useState<number|null>(null);

  async function choose(file?:File){
    if(!file)return;
    setBusy(true);setError(null);setApplied(null);
    try{setPreview(await gateway.previewImport(file));}
    catch(reason){setPreview(null);setError(message(reason));}
    finally{setBusy(false);if(input.current)input.current.value='';}
  }

  async function apply(){
    if(!preview||preview.products.length===0||preview.issues.length>0)return;
    setBusy(true);setError(null);
    try{
      const result=await gateway.applyImport(preview.products);
      setApplied(result.applied);
      setProducts(result.products.map(record=>record.payload));
      setPreview(current=>current?{...current,products:result.products.map(record=>({externalId:record.externalId,manufacturer:record.manufacturer,sku:record.sku,name:record.name,category:record.category,unitOfMeasure:record.unitOfMeasure,payload:record.payload}))}:current);
    }catch(reason){setError(message(reason));}
    finally{setBusy(false);}
  }

  return <section className="catalog-import-panel">
    <input ref={input} hidden type="file" accept=".csv,.xlsx" onChange={event=>void choose(event.target.files?.[0])}/>
    <header><div><small>CATALOG INGESTION</small><strong>CSV / XLSX review</strong></div><button disabled={busy} onClick={()=>input.current?.click()}><Upload size={12}/>{busy?'Reading…':'Choose file'}</button></header>
    {error&&<p className="platform-inline-error">{error}</p>}
    {!preview&&<div className="catalog-import-empty"><FileSpreadsheet size={20}/><p>Upload the manufacturer catalog template as CSV or XLSX. Archit validates every row before any products are written.</p></div>}
    {preview&&<>
      <div className="catalog-import-summary"><span>{preview.format.toUpperCase()}</span><span>{preview.sourceRowCount} source rows</span><span>{preview.products.length} valid products</span><span>{preview.issues.length} issues</span></div>
      {preview.issues.length>0&&<div className="catalog-import-issues">{preview.issues.slice(0,50).map((issue,index)=><article key={`${issue.row}:${issue.field}:${index}`}><strong>Row {issue.row||'—'}{issue.field?` · ${issue.field}`:''}</strong><span>{issue.message}</span></article>)}</div>}
      <div className="catalog-import-products">{preview.products.slice(0,30).map(product=><article key={product.externalId}><div><strong>{product.name}</strong><small>{product.manufacturer} · {product.sku}</small></div><span>{product.category}</span></article>)}</div>
      {preview.products.length>30&&<small className="catalog-import-more">+ {preview.products.length-30} more products</small>}
      {applied!==null&&<p className="catalog-import-success">Applied {applied} catalog products.</p>}
      <button className="catalog-import-apply" disabled={busy||preview.products.length===0||preview.issues.length>0} onClick={()=>void apply()}>{busy?'Applying…':preview.issues.length?`Fix ${preview.issues.length} issues before apply`:`Apply ${preview.products.length} reviewed products`}</button>
    </>}
  </section>;
}

function message(value:unknown){return value instanceof Error?value.message:'Catalog import failed.';}
