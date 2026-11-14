import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { installApiFetchRewrite } from './utils/apiBase';
import App from './App.tsx';
import './index.css';

installApiFetchRewrite();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
