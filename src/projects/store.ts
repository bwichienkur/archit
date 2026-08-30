import { create } from 'zustand';
import { HttpProjectGateway } from './gateway';

const gateway = new HttpProjectGateway();

type ProjectPersistenceState = {
  projectId: string | null;
  revisionId: string | null;
  saving: boolean;
  savedAt: string | null;
  error: string | null;
  save<TModel>(projectName: string, model: TModel, note?: string): Promise<void>;
};

export const useProjectPersistenceStore = create<ProjectPersistenceState>((set, get) => ({
  projectId: null,
  revisionId: null,
  saving: false,
  savedAt: null,
  error: null,

  save: async (projectName, model, note) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      let projectId = get().projectId;
      if (!projectId) {
        const project = await gateway.createProject(projectName);
        projectId = project.id;
        set({ projectId });
      }

      const revision = await gateway.createRevision(projectId, {
        parentRevisionId: get().revisionId,
        kind: 'user-edit',
        createdBy: 'current-user',
        model,
        note,
      });
      set({ revisionId: revision.id, savedAt: revision.createdAt, saving: false, error: null });
    } catch (error) {
      set({ saving: false, error: error instanceof Error ? error.message : 'Save failed.' });
    }
  },
}));
