import { useEffect, useState } from 'react';
import { Download, RefreshCw, Server } from 'lucide-react';
import { useProjectPersistenceStore } from '../projects/store';
import { HttpExportGateway, type ExportJobRecord } from './gateway';

const gateway=new HttpExportGateway();

export function ServerExportPanel(){
  const projectId=useProjectPersistenceStore(state=>state.projectId);
  const revisionId=useProjectPersistenceStore(state=>state.revisionId);
  const [formats,setFormats]=useState<string[]>(['json']);
  const [selectedFormat,setSelectedFormat]=useState('json');
  const [jobs,setJobs]=useState<ExportJobRecord[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function refresh(){
    if(!projectId){setJobs([]);return;}
    try{setJobs(await gateway.list(projectId));}
    catch(reason){setError(message(reason));}
  }

  useEffect(()=>{
    void gateway.formats().then(values=>{
      if(values.length===0)return;
      setFormats(values);
      setSelectedFormat(current=>values.includes(current)?current:values[0]);
    }).catch(reason=>setError(message(reason)));
  },[]);
  useEffect(()=>{void refresh();},[projectId]);

  async function createExport(){
    if(!projectId||!revisionId)return;
    setBusy(true);setError(null);
    try{
      const created=await gateway.create(projectId,revisionId,selectedFormat);
      setJobs(items=>[created,...items.filter(item=>item.id!==created.id)]);
      const completed=await gateway.waitForCompletion(created.id,120000,job=>setJobs(items=>[job,...items.filter(item=>item.id!==job.id)]));
      setJobs(items=>[completed,...items.filter(item=>item.id!==completed.id)]);
    }catch(reason){setError(message(reason));}
    finally{setBusy(false);}
  }

  async function download(job:ExportJobRecord){
    setError(null);
    try{
      const blob=await gateway.downloadArtifact(job.id);
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download=`archit-${job.projectId}-${job.revisionId}.${job.format}`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),0);
    }catch(reason){setError(message(reason));}
  }

  return <section className="server-export-panel">
    <header><div><small>DURABLE ARTIFACTS</small><strong>Server exports</strong></div><button title="Refresh export jobs" disabled={!projectId} onClick={()=>void refresh()}><RefreshCw size={13}/></button></header>
    {!projectId&&<p>Import or save into an active project before creating server exports.</p>}
    {projectId&&!revisionId&&<p>Save the current BIM model first so the export is tied to an immutable project revision.</p>}
    {error&&<p className="platform-inline-error">{error}</p>}
    <div className="server-export-create-row">
      <label>Format<select value={selectedFormat} disabled={busy} onChange={event=>setSelectedFormat(event.target.value)}>{formats.map(format=><option key={format} value={format}>{format.toUpperCase()}</option>)}</select></label>
      <button className="server-export-create" disabled={!projectId||!revisionId||busy} onClick={()=>void createExport()}><Server size={13}/>{busy?'Exporting…':`Create ${selectedFormat.toUpperCase()} export`}</button>
    </div>
    <div className="server-export-jobs">{jobs.slice(0,10).map(job=><article key={job.id}>
      <div><strong>{job.format.toUpperCase()}</strong><span>{job.status}</span></div>
      <small>Revision {shortId(job.revisionId)} · {job.progress}%</small>
      {job.error&&<p>{job.error}</p>}
      <button disabled={job.status!=='completed'} onClick={()=>void download(job)}><Download size={12}/> Download</button>
    </article>)}</div>
  </section>;
}

function shortId(value:string){return value.length>12?`${value.slice(0,8)}…`:value;}
function message(value:unknown){return value instanceof Error?value.message:'Export request failed.';}
