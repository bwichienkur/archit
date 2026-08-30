import { UserManager, WebStorageStateStore, type User, type UserManagerSettings } from 'oidc-client-ts';

export type ArchitAuthSession = {
  configured: boolean;
  authenticated: boolean;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  tenantId: string | null;
  roles: string[];
  expiresAt: number | null;
};

const authority = import.meta.env.VITE_OIDC_AUTHORITY as string | undefined;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined;
const apiScope = import.meta.env.VITE_OIDC_API_SCOPE as string | undefined;
const configured = Boolean(authority && clientId);

const settings: UserManagerSettings | null = configured ? {
  authority: authority!,
  client_id: clientId!,
  redirect_uri: (import.meta.env.VITE_OIDC_REDIRECT_URI as string | undefined) ?? `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: (import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI as string | undefined) ?? window.location.origin,
  response_type: 'code',
  scope: ['openid','profile','email',apiScope].filter(Boolean).join(' '),
  automaticSilentRenew: true,
  monitorSession: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
} : null;

const manager = settings ? new UserManager(settings) : null;

export function authConfigured(){ return configured; }

export async function bootstrapOidc(): Promise<ArchitAuthSession> {
  if(!manager) return anonymousSession(false);
  if(window.location.pathname === '/auth/callback') {
    try {
      await manager.signinRedirectCallback();
      window.history.replaceState({}, document.title, '/');
    } catch(error) {
      console.error('OIDC callback failed', error);
      throw error;
    }
  }
  return sessionFromUser(await manager.getUser());
}

export async function currentAuthSession(): Promise<ArchitAuthSession> {
  if(!manager) return anonymousSession(false);
  return sessionFromUser(await manager.getUser());
}

export async function signIn(returnTo = window.location.pathname + window.location.search) {
  if(!manager) throw new Error('OIDC is not configured.');
  sessionStorage.setItem('archit:returnTo', safeReturnTo(returnTo));
  await manager.signinRedirect({ state: { returnTo: safeReturnTo(returnTo) } });
}

export async function signOut() {
  if(!manager) return;
  await manager.signoutRedirect();
}

export async function getAccessToken(): Promise<string | null> {
  if(!manager) return null;
  let user = await manager.getUser();
  if(!user || user.expired) {
    try { user = await manager.signinSilent(); }
    catch { return null; }
  }
  return user?.access_token ?? null;
}

export function subscribeAuthChanged(handler:(session:ArchitAuthSession)=>void){
  if(!manager) return () => undefined;
  const changed=(user:User|null)=>handler(sessionFromUser(user));
  const loaded=(user:User)=>changed(user);
  const unloaded=()=>changed(null);
  manager.events.addUserLoaded(loaded);
  manager.events.addUserUnloaded(unloaded);
  manager.events.addAccessTokenExpired(unloaded);
  return ()=>{manager.events.removeUserLoaded(loaded);manager.events.removeUserUnloaded(unloaded);manager.events.removeAccessTokenExpired(unloaded);};
}

function sessionFromUser(user:User|null):ArchitAuthSession {
  if(!user || user.expired) return anonymousSession(true);
  const profile=user.profile as Record<string,unknown>;
  return {
    configured:true,
    authenticated:true,
    userId:stringClaim(profile,'sub'),
    displayName:stringClaim(profile,'name') ?? stringClaim(profile,'preferred_username') ?? stringClaim(profile,'email'),
    email:stringClaim(profile,'email'),
    tenantId:stringClaim(profile,'tenant_id') ?? stringClaim(profile,'tid') ?? ((import.meta.env.VITE_TENANT_ID as string | undefined) || null),
    roles:roleClaims(profile),
    expiresAt:user.expires_at ?? null,
  };
}
function anonymousSession(isConfigured:boolean):ArchitAuthSession{return{configured:isConfigured,authenticated:false,userId:null,displayName:null,email:null,tenantId:(import.meta.env.VITE_TENANT_ID as string | undefined)||null,roles:[],expiresAt:null};}
function stringClaim(profile:Record<string,unknown>,key:string){const value=profile[key];return typeof value==='string'&&value.trim()?value:null;}
function roleClaims(profile:Record<string,unknown>){const raw=profile.role??profile.roles;if(typeof raw==='string')return[raw];if(Array.isArray(raw))return raw.filter((value):value is string=>typeof value==='string');return[];}
function safeReturnTo(value:string){return value.startsWith('/')&&!value.startsWith('//')?value:'/';}
