import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthBoundary } from './auth/AuthBoundary';
import { bootstrapOidc } from './auth/oidc';
import { PlatformDock } from './platform/PlatformDock';
import './styles.css';
import './cad/cad.css';
import './semantic/semantic.css';
import './platform/platform.css';

async function bootstrap(){
  const root=ReactDOM.createRoot(document.getElementById('root')!);
  try{
    const session=await bootstrapOidc();
    root.render(<React.StrictMode><AuthBoundary initialSession={session}><App /><PlatformDock /></AuthBoundary></React.StrictMode>);
  }catch(error){
    const message=error instanceof Error?error.message:'Authentication initialization failed.';
    root.render(<React.StrictMode><main style={{minHeight:'100vh',display:'grid',placeItems:'center',fontFamily:'system-ui,sans-serif'}}><section><h1>Archit could not start</h1><p>{message}</p><button onClick={()=>window.location.assign('/')}>Return home</button></section></main></React.StrictMode>);
  }
}

void bootstrap();
