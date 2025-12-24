import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import ForceUpdateModal from "@/components/ForceUpdateModal";
import Index from "./pages/Index";
import Login from "./pages/Login";
import UserLogin from "./pages/UserLogin";
import UserProfile from "./pages/UserProfile";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const APP_VERSION = 'v2.3.0';

// HTTPS redirect for production
if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
  window.location.href = window.location.href.replace('http:', 'https:');
}

const AppContent = () => {
  const { showUpdateModal, newVersion, changelog, handleUpdate } = useVersionCheck(APP_VERSION);

  return (
    <>
      <ForceUpdateModal 
        isOpen={showUpdateModal}
        newVersion={newVersion}
        changelog={changelog}
        onUpdate={handleUpdate}
      />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/user-login" element={<UserLogin />} />
        <Route path="/user-profile" element={<UserProfile />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
