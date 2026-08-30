import { apiFetch } from '../auth/apiFetch';

export type ProjectRecord = {
  id: string;
  tenantId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRevision<TModel = unknown> = {
  id: string;
  projectId: string;
  parentRevisionId: string | null;
  kind: 'import' | 'semantic' | 'user-edit' | 'configuration';
  createdAt: string;
  createdBy: string;
  sourceImportId: string | null;
  model: TModel;
  note?: string | null;
};

export interface ProjectGateway {
  createProject(name: string, tenantId?: string | null): Promise<ProjectRecord>;
  listProjects(tenantId?: string | null): Promise<ProjectRecord[]>;
  getProject(projectId:string):Promise<ProjectRecord>;
  createRevision<TModel>(projectId: string, input: {
    parentRevisionId?: string | null;
    kind: ProjectRevision['kind'];
    createdBy: string;
    sourceImportId?: string | null;
    model: TModel;
    note?: string | null;
  }): Promise<ProjectRevision<TModel>>;
  listRevisions<TModel=unknown>(projectId:string):Promise<ProjectRevision<TModel>[]>;
  getRevision<TModel=unknown>(projectId:string,revisionId:string):Promise<ProjectRevision<TModel>>;
}

export class HttpProjectGateway implements ProjectGateway {
  constructor(private readonly baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5080') {}

  async createProject(name: string, tenantId: string | null = null): Promise<ProjectRecord> {
    const response = await apiFetch(`${this.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tenantId }),
    });
    return readJson<ProjectRecord>(response);
  }

  async listProjects(tenantId:string|null=null){const query=tenantId?`?tenantId=${encodeURIComponent(tenantId)}`:'';return readJson<ProjectRecord[]>(await apiFetch(`${this.baseUrl}/api/projects${query}`));}
  async getProject(projectId:string){return readJson<ProjectRecord>(await apiFetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}`));}

  async createRevision<TModel>(projectId: string, input: {
    parentRevisionId?: string | null;
    kind: ProjectRevision['kind'];
    createdBy: string;
    sourceImportId?: string | null;
    model: TModel;
    note?: string | null;
  }): Promise<ProjectRevision<TModel>> {
    const response = await apiFetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return readJson<ProjectRevision<TModel>>(response);
  }

  async listRevisions<TModel=unknown>(projectId:string){return readJson<ProjectRevision<TModel>[]>(await apiFetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/revisions`));}
  async getRevision<TModel=unknown>(projectId:string,revisionId:string){return readJson<ProjectRevision<TModel>>(await apiFetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/revisions/${encodeURIComponent(revisionId)}`));}
}

export async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & { error?: string; detail?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? body?.detail ?? `Request failed with HTTP ${response.status}.`);
  if (!body) throw new Error('API returned an empty response.');
  return body;
}
