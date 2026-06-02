import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { MobileShell } from '@/components/MobileShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastViewport } from '@/components/ui/toast';
import { FullSpinner } from '@/components/ui/spinner';
import HomePage from '@/pages/HomePage';
import './lib/dayjs';
import './index.css';

// Split the heavier routes into their own chunks so the landing page stays light.
const CreateRoomPage = lazy(() => import('@/pages/CreateRoomPage'));
const RoomPage = lazy(() => import('@/pages/RoomPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <MobileShell>
          <ErrorBoundary>
            <Suspense fallback={<FullSpinner />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/create" element={<CreateRoomPage />} />
                <Route path="/room/:roomId" element={<RoomPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </MobileShell>
        <ToastViewport />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
