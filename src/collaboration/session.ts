import { currentAuthSession, getAccessToken } from '../auth/oidc';
import type { CollaborationRole } from './events';
import { ProjectLiveClient, type CollaborationLiveHandlers } from './liveClient';

export type LiveCollaborationSession={client:ProjectLiveClient;userId:string;displayName:string;role:CollaborationRole;projectId:string};

export async function connectProjectCollaboration(projectId:string,handlers:CollaborationLiveHandlers={}):Promise<LiveCollaborationSession>{
  const session=await currentAuthSession();
  if(session.configured&&!session.authenticated)throw new Error('Sign in before joining live collaboration.');

  const userId=session.userId??'local-user';
  const displayName=session.displayName??session.email??userId;
  const role=normalizeRole(session.roles[0]);
  const client=new ProjectLiveClient(
    import.meta.env.VITE_API_URL??'http://localhost:5080',
    handlers,
    async()=>await getAccessToken()??'',
  );
  await client.joinProject(projectId,userId,displayName,role);
  return{client,userId,displayName,role,projectId};
}

function normalizeRole(value:string|undefined):CollaborationRole{
  switch(value?.toLowerCase()){
    case'owner':case'admin':case'architect':case'builder':case'designer':case'customer':case'viewer':return value.toLowerCase() as CollaborationRole;
    default:return'viewer';
  }
}
