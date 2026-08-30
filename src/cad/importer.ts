import type { CadDocument, CadImportValidation } from './types';

export type CadImportJob = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  fileName: string;
  progress: number;
  error?: string;
  document?: CadDocument;
  validation?: CadImportValidation;
};

export interface CadImportGateway {
  upload(file: File): Promise<CadImportJob>;
  getJob(jobId: string): Promise<CadImportJob>;
}

export class HttpCadImportGateway implements CadImportGateway {
  constructor(private readonly baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5080') {}

  async upload(file: File): Promise<CadImportJob> {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${this.baseUrl}/api/cad/imports`, { method: 'POST', body });
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<CadImportJob>;
  }

  async getJob(jobId: string): Promise<CadImportJob> {
    const response = await fetch(`${this.baseUrl}/api/cad/imports/${encodeURIComponent(jobId)}`);
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<CadImportJob>;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const value = await response.json() as { error?: string; detail?: string };
    return value.error ?? value.detail ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}
