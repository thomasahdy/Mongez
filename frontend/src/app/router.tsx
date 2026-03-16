import { createRouter } from '@tanstack/react-router';

// Root route and other routes will be defined here
export const router = createRouter({
  routeTree: [], // This will be populated as routes are created
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
