import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PlatformDock } from './platform/PlatformDock';
import './styles.css';
import './cad/cad.css';
import './semantic/semantic.css';
import './platform/platform.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /><PlatformDock /></React.StrictMode>);
