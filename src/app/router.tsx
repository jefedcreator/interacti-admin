import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { RequireAuth } from './require-auth';
import { NotFoundPage } from './routes/not-found';
import { SignInPage } from './routes/sign-in';

/*
 * Tasks 6, 9 and 10 add their pages as children of the shell, above the `*`. There is no create or
 * edit route: those open in a modal over the table.
 */
export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [{ path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
];
