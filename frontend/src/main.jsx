import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import { queryClient } from "./lib/queryClient.js";
import { store } from "./store/store.js";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </Provider>,
);
