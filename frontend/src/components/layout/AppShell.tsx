import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Toaster } from 'sonner'

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'card-glass font-sans text-sm text-foreground border-border',
            success: '!border-green-500/30',
            error: '!border-destructive/30',
          },
        }}
      />
    </div>
  )
}
