import { create } from 'zustand';
import { currentAuthSession } from '../auth/oidc';
import { ensureActiveProject, getActiveProject } from './activeProject';
import { HttpProjectGateway } from './gateway';

const gateway = new HttpProjectGateway();
const initialProject = getActiveProject();

type ProjectPersistenceState = {
  projectId: string | null;
  revisionId: string | null;
  saving: boolean;
  savedAt: string | null;
  error: string | null;
  ensureProject(projectName: string): Promise<string>;
  save<TModel>(projectName: string, model: TModel, note?: string): Promise<void>;
};

export const useProjectPersistenceStore = create<ProjectPersistenceState>((set, get) => ({
  projectId: initialProject?.id ?? null,
  revisionId: null,
  saving: false,
  savedAt: null,
  error: null,

  ensureProject: async (projectName) => {
    const existing = get().projectId;
    if (existing) return existing;
    const project = await ensureActiveProject(projectName);
    set({ projectId: project.id, error: null });
    return project.id;
  },

  save: async (projectName, model, note) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const session = await currentAuthSession();
      const projectId = await get().ensureProject(projectName);
      const persistedModel = bindProjectIdentity(model, projectId, projectName);
      const revision = await gateway.createRevision(projectId, {
        parentRevisionId: get().revisionId,
        kind: 'user-edit',
        createdBy: session.userId ?? 'local-user',
        model: persistedModel,
        note,
      });
      set({ revisionId: revision.id, savedAt: revision.createdAt, saving: false, error: null });
    } catch (error) {
      set({ saving: false, error: error instanceof Error ? error.message : 'Save failed.' });
    }
  },
}));

function bindProjectIdentity<TModel>(model:TModel,projectId:string,projectName:string):TModel{
  if(!model||typeof model!=='object'||Array.isArray(model))return model;
  const record=model as Record<string,unknown>;
  if(!('projectId' in record))return model;
  return {...record,projectId,projectName:typeof record.projectName==='string'&&record.projectName.trim()?record.projectName:projectName} as TModel;
}
