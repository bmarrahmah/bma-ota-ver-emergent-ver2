import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

import LoginPage from "@/pages/LoginPage";
import AdminLayout from "@/components/AdminLayout";
import DashboardPage from "@/pages/DashboardPage";
import OrangTuaAsuhListPage from "@/pages/OrangTuaAsuhListPage";
import OrangTuaAsuhDetailPage from "@/pages/OrangTuaAsuhDetailPage";
import AnakAsuhListPage from "@/pages/AnakAsuhListPage";
import AnakAsuhDetailPage from "@/pages/AnakAsuhDetailPage";
import RelasiPage from "@/pages/RelasiPage";
import DonasiPage from "@/pages/DonasiPage";
import PerkembanganPage from "@/pages/PerkembanganPage";
import LaporanPage from "@/pages/LaporanPage";
import PengaturanPage from "@/pages/PengaturanPage";
import AktivitasPage from "@/pages/AktivitasPage";
import PortalPage from "@/pages/PortalPage";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--pota-text-muted)]">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/portal/:token" element={<PortalPage />} />
          <Route path="/admin" element={<Protected><AdminLayout /></Protected>}>
            <Route index element={<DashboardPage />} />
            <Route path="orang-tua-asuh" element={<OrangTuaAsuhListPage />} />
            <Route path="orang-tua-asuh/:id" element={<OrangTuaAsuhDetailPage />} />
            <Route path="anak-asuh" element={<AnakAsuhListPage />} />
            <Route path="anak-asuh/:id" element={<AnakAsuhDetailPage />} />
            <Route path="relasi" element={<RelasiPage />} />
            <Route path="donasi" element={<DonasiPage />} />
            <Route path="perkembangan" element={<PerkembanganPage />} />
            <Route path="laporan" element={<LaporanPage />} />
            <Route path="aktivitas" element={<AktivitasPage />} />
            <Route path="pengaturan" element={<PengaturanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
