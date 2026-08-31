import { currentAuthSession } from '../auth/oidc';
import { HttpProjectGateway, type ProjectRecord } from './gateway';

const storageKey='archit:active-project';
const gateway=new HttpProjectGateway();
let inFlight:Promise<ProjectRecord>|null=null;

export function getActiveProject():ProjectRecord|null{
  try{
    const raw=sessionStorage.getItem(storageKey);
    if(!raw)return null;
    const value=JSON.parse(raw) as ProjectRecord;
    return value&&typeof value.id==='string'&&typeof value.name==='string'?value:null;
  }catch{return null;}
}

export function setActiveProject(project:ProjectRecord){
  sessionStorage.setItem(storageKey,JSON.stringify(project));
}

export function clearActiveProject(){
  sessionStorage.removeItem(storageKey);
}

export async function ensureActiveProject(projectName:string):Promise<ProjectRecord>{
  const existing=getActiveProject();
  if(existing)return existing;
  if(inFlight)return inFlight;

  inFlight=(async()=>{
    const session=await currentAuthSession();
    if(session.configured&&!session.authenticated)throw new Error('Sign in before creating a project.');
    if(session.configured&&!session.tenantId)throw new Error('Authenticated account is missing a tenant identifier.');
    const project=await gateway.createProject(projectName,session.tenantId);
    setActiveProject(project);
    return project;
  })();

  try{return await inFlight;}
  finally{inFlight=null;}
}
