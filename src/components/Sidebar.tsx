import { LayoutDashboard, Wallet, CreditCard, Users, Settings, LogOut, Building2, Upload, FileSpreadsheet, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../utils';
import { logout } from '../auth';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: Wallet, label: 'Simpanan', to: '/simpanan' },
    { icon: CreditCard, label: 'Pinjaman', to: '/pinjaman' },
    { icon: Users, label: 'Anggota', to: '/anggota' },
    { icon: FileSpreadsheet, label: 'Laporan Keuangan', to: '/laporan-keuangan' },
    { icon: FileSpreadsheet, label: 'Rekapitulasi Lengkap', to: '/laporan-rekapitulasi' },
    { icon: Upload, label: 'Upload Laporan Bulanan', to: '/upload-laporan' },
    { icon: Upload, label: 'Upload Laporan Keuangan', to: '/upload-laporan-keuangan' },
    { icon: Settings, label: 'Pengaturan', to: '/pengaturan' },
];

interface SidebarProps {
    open: boolean;
    onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const content = (
        <>
            <div className="p-6 flex items-center justify-between gap-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 p-2 rounded-lg">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="font-bold text-lg leading-tight text-emerald-900">
                        Koperasi<br />Kesejahteraan<br />Universitas
                    </div>
                </div>
                <button type="button" onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) => cn(
                            'flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-sm',
                            isActive
                                ? 'bg-emerald-50 text-emerald-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-600' : 'text-gray-400')} />
                                {item.label}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Keluar
                </button>
            </div>
        </>
    );

    return (
        <>
            <aside className="hidden md:flex flex-col h-full bg-white border-r border-gray-200 text-gray-800 w-64 flex-shrink-0">
                {content}
            </aside>

            {open && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={onClose} />
            )}
            <aside
                className={cn(
                    'md:hidden fixed inset-y-0 left-0 z-50 flex flex-col h-full bg-white border-r border-gray-200 text-gray-800 w-72 transform transition-transform duration-200',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {content}
            </aside>
        </>
    );
}