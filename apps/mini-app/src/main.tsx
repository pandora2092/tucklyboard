import { createRoot } from 'react-dom/client';

import { initializeTelegram } from './lib/telegram';
import { AdminPage } from './pages/AdminPage';
import { LibraryPage } from './pages/LibraryPage';

import './style.css';

initializeTelegram();
createRoot(document.getElementById('root')!).render(
  window.location.pathname.replace(/\/+$/, '').endsWith('/admin') ? <AdminPage /> : <LibraryPage />,
);
