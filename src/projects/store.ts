import { create } from 'zustand';
import { currentAuthSession } from '../auth/oidc';
import { HttpProjectGateway } from './gateway';

const gateway = new HttpProjectGateway();

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
  projectId: null,
  revisionId: null,
  saving: false,
  savedAt: null,
  error: null,

  ensureProject: async (projectName) => {
    const existing = get().projectId;
    if (existing) return existing;

    const session = await currentAuthSession();
    if (session.configured && !session.authenticated) throw new Error('Sign in before creating a project.');
    if (session.configured && !session.tenantId) throw new Error('Authenticated account is missing a tenant identifier.');

    const project = await gateway.createProject(projectName, session.tenantId);
    set({ projectId: project.id, error: null });
    return project.id;
  },

  save: async (projectName, model, note) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const session = await currentAuthSession();
      const projectId = await get().ensureProject(projectName);
      const revision = await gateway.createRevision(projectId, {
        parentRevisionId: get().revisionId,
        kind: 'user-edit',
        createdBy: session.userId ?? 'local-user',
        model,
        note,
      });
      set({ revisionId: revision.id, savedAt: revision.createdAt, saving: false, error: null });
    } catch (error) {
      set({ saving: false, error: error instanceof Error ? error.message : 'Save failed.' });
    }
  },
}));
