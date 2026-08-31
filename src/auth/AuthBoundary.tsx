import { useEffect, useState, type ReactNode } from 'react';
import { signIn, signOut, subscribeAuthChanged, type ArchitAuthSession } from './oidc';

export function AuthBoundary({ initialSession, children }:{initialSession:ArchitAuthSession;children:ReactNode}) {
  const [session,setSession]=useState(initialSession);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>subscribeAuthChanged(setSession),[]);

  if(!session.configured) return <>{children}</>;
  if(!session.authenticated) {
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#11171c',color:'#edf2f4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <section style={{width:'min(420px,calc(100vw - 40px))',padding:28,border:'1px solid #364149',borderRadius:10,background:'#182027',boxShadow:'0 18px 50px rgba(0,0,0,.3)'}}>
        <small style={{letterSpacing:'.16em',color:'#9aa8b2'}}>ARCHIT</small>
        <h1 style={{margin:'10px 0 8px',fontSize:24}}>Sign in to your workspace</h1>
        <p style={{margin:'0 0 20px',lineHeight:1.5,color:'#b8c2c9'}}>Your organization requires authenticated access before projects, CAD imports, revisions, exports, or live collaboration can be opened.</p>
        {error&&<p role="alert" style={{color:'#ffb4ab'}}>{error}</p>}
        <button disabled={busy} onClick={()=>{setBusy(true);setError(null);void signIn().catch(err=>{setBusy(false);setError(err instanceof Error?err.message:'Sign in failed.');});}} style={{width:'100%',padding:'11px 14px',border:0,borderRadius:6,fontWeight:700,cursor:'pointer'}}>{busy?'Redirecting…':'Sign in'}</button>
      </section>
    </main>;
  }

  return <div data-authenticated-user={session.userId??undefined} data-tenant-id={session.tenantId??undefined}>
    <div style={{position:'fixed',right:12,top:10,zIndex:10000,display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#aeb9c0',pointerEvents:'none'}}>
      <span>{session.displayName??session.email??session.userId}</span>
      <button style={{pointerEvents:'auto',fontSize:11}} onClick={()=>void signOut()}>Sign out</button>
    </div>
    {children}
  </div>;
}
