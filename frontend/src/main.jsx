/**
 * @file main.jsx
 * @description React alkalmazás belépési pont – root DOM csomópontba rendereli az App komponenst.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
