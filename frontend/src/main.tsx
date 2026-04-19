import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'
import { AppRouter } from '@/router'
import './index.css'

const savedThemeMode = localStorage.getItem('theme-mode')
if (savedThemeMode === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,        // 2 minutes
      gcTime: 1000 * 60 * 10,           // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  </QueryClientProvider>
)
