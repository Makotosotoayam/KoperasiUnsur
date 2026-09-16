import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const [checkLogin, setCheckLogin] = useState<boolean | null>(null);

    useEffect(() => {
        // Lakukan pengecekan tepat saat halaman pertama kali diakses lewat URL
        setCheckLogin(isAuthenticated());
    }, []);

    // Tampilkan layar kosong sebentar selama loading pengecekan (biar ga kedip lolos)
    if (checkLogin === null) {
        return <div className="min-h-screen bg-gray-50"></div>;
    }

    // Jika hasil pengecekan ternyata tidak terautentikasi, tendang ke login
    if (!checkLogin) {
        return <Navigate to="/login" replace />;
    }

    // Jika aman, baru tampilkan dashboard
    return <>{children}</>;
}
