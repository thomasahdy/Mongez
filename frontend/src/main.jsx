import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.jsx';
import { Provider } from 'react-redux';
import { store } from './store/store.js';
import ErrorBoundary from './components/ErrorBoundary';
import { queryClient } from './lib/queryClient.js';
import './i18n';

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <App />
      </Provider>
    </QueryClientProvider>
  </ErrorBoundary>
);
