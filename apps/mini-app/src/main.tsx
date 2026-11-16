import { createRoot } from 'react-dom/client';

import { initializeFocus } from './lib/focus';
import { initializeTelegram } from './lib/telegram';
import { AdminPage } from './pages/AdminPage';
import { LibraryPage } from './pages/LibraryPage';

import './styles/tokens.css';
import './style.css';
import './components/ui/ui.css';
import './components/checkbox.css';
import './focus.css';

initializeFocus();
initializeTelegram();
createRoot(document.getElementById('root')!).render(
  window.location.pathname.replace(/\/+$/, '').endsWith('/admin') ? <AdminPage /> : <LibraryPage />,
);
