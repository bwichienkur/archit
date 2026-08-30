import type { CadDocument, CadImportValidation } from './types';

export type CadImportJob = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  fileName: string;
  progress: number;
  error?: string | null;
  document?: CadDocument | null;
  validation?: CadImportValidation | null;
  projectId?: string | null;
};

export interface CadImportGateway {
  upload(file: File, projectId?: string | null, onProgress?: (job: CadImportJob) => void): Promise<CadImportJob>;
  getJob(jobId: string): Promise<CadImportJob>;
}

export class HttpCadImportGateway implements CadImportGateway {
  constructor(
    private readonly baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5080',
    private readonly timeoutMs = 5 * 60 * 1000,
  ) {}

  async upload(file: File, projectId: string | null = null, onProgress?: (job: CadImportJob) => void): Promise<CadImportJob> {
    const body = new FormData();
    body.append('file', file);
    if (projectId) body.append('projectId', projectId);
    const response = await fetch(`${this.baseUrl}/api/cad/imports`, { method: 'POST', body });
    if (!response.ok) throw new Error(await readError(response));
    const queued = await response.json() as CadImportJob;
    onProgress?.(queued);
    if (queued.status === 'completed' || queued.status === 'failed') return queued;
    return this.waitForCompletion(queued.id, onProgress);
  }

  async getJob(jobId: string): Promise<CadImportJob> {
    const response = await fetch(`${this.baseUrl}/api/cad/imports/${encodeURIComponent(jobId)}`);
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<CadImportJob>;
  }

  private async waitForCompletion(jobId: string, onProgress?: (job: CadImportJob) => void) {
    const started = Date.now();
    let delayMs = 400;
    while (Date.now() - started < this.timeoutMs) {
      await delay(delayMs);
      const job = await this.getJob(jobId);
      onProgress?.(job);
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new Error(job.error || 'CAD import failed.');
      delayMs = Math.min(2000, Math.round(delayMs * 1.35));
    }
    throw new Error(`CAD import ${jobId} did not finish within ${Math.round(this.timeoutMs / 1000)} seconds.`);
  }
}

function delay(milliseconds: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, milliseconds));
}

async function readError(response: Response): Promise<string> {
  try {
    const value = await response.json() as { error?: string; detail?: string };
    return value.error ?? value.detail ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}
