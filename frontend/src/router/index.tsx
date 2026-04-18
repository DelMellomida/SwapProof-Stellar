import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { CreateDealPage } from '@/pages/CreateDealPage'
import { DealPage } from '@/pages/DealPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'create', element: <CreateDealPage /> },
      { path: 'deal/:dealId', element: <DealPage /> },
      {
        path: '*',
        element: (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-4">
            <p className="font-display text-4xl text-primary/30">404</p>
            <p className="font-display text-lg text-foreground">Page not found</p>
            <a href="/" className="text-sm text-primary hover:underline">Go home</a>
          </div>
        ),
      },
    ],
  },
])
