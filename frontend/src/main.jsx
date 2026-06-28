//import * as Sentry from "@sentry/react";

// Sentry.init({
//   dsn: import.meta.env.VITE_SENTRY_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0",
//   integrations: [
//     Sentry.browserTracingIntegration(),
//     Sentry.replayIntegration(),
//   ],
//   tracesSampleRate: 1.0,
//   replaysSessionSampleRate: 0.1,
//   replaysOnErrorSampleRate: 1.0,
// });

import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import { queryClient } from "./lib/queryClient.js";
import { store } from "./store/store.js";
import { SocketProvider } from "./context/SocketContext.jsx";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <Provider store={store}>
        <SocketProvider>
          <App />
        </SocketProvider>
      </Provider>
    </ErrorBoundary>
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
  </QueryClientProvider>
);
