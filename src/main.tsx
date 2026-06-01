import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { MobileShell } from '@/components/MobileShell';
import { ToastViewport } from '@/components/ui/toast';
import HomePage from '@/pages/HomePage';
import CreateRoomPage from '@/pages/CreateRoomPage';
import RoomPage from '@/pages/RoomPage';
import NotFoundPage from '@/pages/NotFoundPage';
import './lib/dayjs';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <MobileShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateRoomPage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </MobileShell>
        <ToastViewport />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
