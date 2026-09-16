import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { AnggotaPage } from './pages/AnggotaPage';
import { SimpananPage } from './pages/SimpananPage';
import { PinjamanPage } from './pages/PinjamanPage';
import { SettingsPage } from './pages/SettingsPage';
import { RekapitulasiPage } from './pages/RekapitulasiPage';
import { AnggotaByFakultasPage } from './pages/AnggotaByFakultasPage';
import { LaporanKeuanganPage } from './pages/LaporanKeuanganPage';
import { LaporanRekapitulasiPage } from './pages/LaporanRekapitulasiPage';
import UploadLaporan from './components/UploadLaporan';
import UploadLaporanKeuangan from './components/UploadLaporanKeuangan';

function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden fixed top-4 left-4 z-20 p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:text-gray-900"
                    aria-label="Buka menu"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <main className="flex-1 overflow-y-auto">
                    <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/simpanan" element={<SimpananPage />} />
                        <Route path="/pinjaman" element={<PinjamanPage />} />
                        <Route path="/upload-laporan" element={<UploadLaporan />} />
                        <Route path="/upload-laporan-keuangan" element={<UploadLaporanKeuangan />} />
                        <Route path="/rekapitulasi" element={<RekapitulasiPage />} />
                        <Route path="/laporan-keuangan" element={<LaporanKeuanganPage />} />
                        <Route path="/laporan-rekapitulasi" element={<LaporanRekapitulasiPage />} />
                        <Route path="/anggota-by-fakultas" element={<AnggotaByFakultasPage />} />
                        <Route path="/anggota" element={<AnggotaPage />} />
                        <Route path="/pengaturan" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/*"
                    element={
                        <ProtectedRoute>
                            <AppLayout />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;