import { getAccessToken } from './oidc';

export async function apiFetch(input:RequestInfo|URL,init:RequestInit={}):Promise<Response>{
  const token=await getAccessToken();
  const headers=new Headers(init.headers);
  if(token&&!headers.has('Authorization'))headers.set('Authorization',`Bearer ${token}`);
  return fetch(input,{...init,headers});
}

export async function apiJson<T>(input:RequestInfo|URL,init:RequestInit={}):Promise<T>{
  const response=await apiFetch(input,init);
  const body=await response.json().catch(()=>null) as (T&{error?:string;detail?:string})|null;
  if(!response.ok)throw new Error(body?.error??body?.detail??`Request failed with HTTP ${response.status}.`);
  if(body===null)throw new Error('API returned an empty response.');
  return body;
}
