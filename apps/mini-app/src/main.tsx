import { createRoot } from 'react-dom/client';

import { initializeFocus } from './lib/focus';
import { initializeTelegram } from './lib/telegram';
import { LibraryPage } from './pages/LibraryPage';

import './styles/tokens.css';
import './style.css';
import './components/ui/ui.css';
import './components/checkbox.css';
import './focus.css';

initializeFocus();
initializeTelegram();
const root = document.getElementById('root')!;
if (window.location.pathname.replace(/\/+$/, '').endsWith('/admin')) {
  void import('./pages/AdminPage').then(({ AdminPage }) => createRoot(root).render(<AdminPage />));
} else {
  createRoot(root).render(<LibraryPage />);
}
