import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { RequireAuth } from './require-auth';
import { NotFoundPage } from './routes/not-found';
import { Overview } from './routes/overview';
import { ProductPage } from './routes/product';
import { RecordView } from './routes/record-view';
import { ResourceListPage } from './routes/resource-list';
import { SignInPage } from './routes/sign-in';

/*
 * Every signed-in page is a child of the shell, above the `*`. The record view is the `:key` child
 * of `:product/:resource`, rendered in the list's Outlet over the table. There is no create or edit
 * route: those open in a modal over the table.
 */
export const routes: RouteObject[] = [
  { path: '/signin', element: <SignInPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Overview /> },
          { path: ':product', element: <ProductPage /> },
          {
            path: ':product/:resource',
            element: <ResourceListPage />,
            children: [{ path: ':key', element: <RecordView /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
