import { apiFetch, apiJson } from '../auth/apiFetch';
import { currentAuthSession } from '../auth/oidc';

export type ExportJobStatus='queued'|'processing'|'completed'|'failed';
export type ExportJobRecord={
  id:string;
  projectId:string;
  revisionId:string;
  format:string;
  status:ExportJobStatus;
  progress:number;
  requestedBy:string;
  createdAt:string;
  updatedAt:string;
  artifactPath:string|null;
  error:string|null;
};

export class HttpExportGateway{
  constructor(private readonly baseUrl=import.meta.env.VITE_API_URL??'http://localhost:5080'){}

  async create(projectId:string,revisionId:string,format='json'){
    const session=await currentAuthSession();
    return apiJson<ExportJobRecord>(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/exports`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({revisionId,format,requestedBy:session.userId??'local-user'}),
    });
  }

  async list(projectId:string){
    return apiJson<ExportJobRecord[]>(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/exports`);
  }

  async get(jobId:string){
    return apiJson<ExportJobRecord>(`${this.baseUrl}/api/exports/${encodeURIComponent(jobId)}`);
  }

  async waitForCompletion(jobId:string,timeoutMs=120000,onProgress?:(job:ExportJobRecord)=>void){
    const started=Date.now();
    let delayMs=400;
    while(Date.now()-started<timeoutMs){
      const job=await this.get(jobId);
      onProgress?.(job);
      if(job.status==='completed')return job;
      if(job.status==='failed')throw new Error(job.error||`Export ${jobId} failed.`);
      await delay(delayMs);
      delayMs=Math.min(2000,Math.round(delayMs*1.35));
    }
    throw new Error(`Export ${jobId} did not finish within ${Math.round(timeoutMs/1000)} seconds.`);
  }

  async downloadArtifact(jobId:string){
    const response=await apiFetch(`${this.baseUrl}/api/exports/${encodeURIComponent(jobId)}/artifact`);
    if(!response.ok){
      const body=await response.json().catch(()=>null) as {error?:string;detail?:string}|null;
      throw new Error(body?.error??body?.detail??`Artifact request failed with HTTP ${response.status}.`);
    }
    return response.blob();
  }
}

function delay(milliseconds:number){return new Promise<void>(resolve=>window.setTimeout(resolve,milliseconds));}
