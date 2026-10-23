import { Outlet } from 'react-router';

/** A bare frame so the routes mount. Task 6 replaces it with the rail, the menu and sign-out. */
export function AppShell() {
  return (
    <main id="main">
      <Outlet />
    </main>
  );
}
