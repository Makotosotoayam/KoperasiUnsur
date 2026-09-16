import { useEffect, useState } from 'react';
import { Database, Shield, Building2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal, FormField, FormActions, inputClass } from '../components/ui/Modal';
import { ActionButtons } from '../components/ui/TableHelpers';
import { changePassword } from '../auth';

interface Stats {
    totalAnggota: number;
    totalUnit: number;
    totalTransaksi: number;
}

interface UnitRow {
    id: number;
    nama_unit: string;
    jumlahAnggota: number;
}

export function SettingsPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [units, setUnits] = useState<UnitRow[]>([]);
    const [loading, setLoading] = useState(true);

    // --- state untuk form ganti password ---
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // --- state untuk tampil/sembunyi password ---
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // --- state untuk kelola unit kerja (rename) ---
    const [unitModalOpen, setUnitModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
    const [unitNameInput, setUnitNameInput] = useState('');
    const [savingUnit, setSavingUnit] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [{ count: anggotaCount }, { count: unitCount }, { count: transaksiCount }, { data: unitList }, { data: anggotaList }] =
                await Promise.all([
                    supabase.from('anggota').select('id', { count: 'exact', head: true }),
                    supabase.from('unit_kerja').select('id', { count: 'exact', head: true }),
                    supabase.from('transaksi_potongan').select('id', { count: 'exact', head: true }),
                    supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit'),
                    supabase.from('anggota').select('id_unit'),
                ]);

            const countByUnit = new Map<number, number>();
            for (const a of anggotaList ?? []) {
                if (a.id_unit) countByUnit.set(a.id_unit, (countByUnit.get(a.id_unit) ?? 0) + 1);
            }

            setStats({
                totalAnggota: anggotaCount ?? 0,
                totalUnit: unitCount ?? 0,
                totalTransaksi: transaksiCount ?? 0,
            });

            setUnits((unitList ?? []).map((u) => ({
                id: u.id,
                nama_unit: u.nama_unit,
                jumlahAnggota: countByUnit.get(u.id) ?? 0,
            })));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        setPwMessage(null);

        if (newPassword.length < 6) {
            setPwMessage({ type: 'error', text: 'Password baru minimal 6 karakter.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwMessage({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
            return;
        }

        setPwLoading(true);
        const result = await changePassword(currentPassword, newPassword);
        setPwLoading(false);

        setPwMessage({ type: result.success ? 'success' : 'error', text: result.message });
        if (result.success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
    }

    function openRenameUnit(unit: UnitRow) {
        setEditingUnit(unit);
        setUnitNameInput(unit.nama_unit);
        setUnitModalOpen(true);
    }

    async function handleSaveUnitName(e: React.FormEvent) {
        e.preventDefault();
        if (!editingUnit) return;
        const trimmed = unitNameInput.trim();
        if (!trimmed) return;

        setSavingUnit(true);
        try {
            const { error: err } = await supabase
                .from('unit_kerja')
                .update({ nama_unit: trimmed })
                .eq('id', editingUnit.id);
            if (err) throw err;

            setUnits((prev) =>
                prev
                    .map((u) => (u.id === editingUnit.id ? { ...u, nama_unit: trimmed } : u))
                    .sort((a, b) => a.nama_unit.localeCompare(b.nama_unit))
            );
            setUnitModalOpen(false);
        } catch (err) {
            console.error(err);
            alert('Gagal mengubah nama unit kerja. Mungkin nama ini sudah dipakai unit lain.');
        } finally {
            setSavingUnit(false);
        }
    }

    async function handleDeleteUnit(unit: UnitRow) {
        if (unit.jumlahAnggota > 0) {
            alert(
                `Tidak bisa menghapus "${unit.nama_unit}" karena masih ada ${unit.jumlahAnggota} anggota di dalamnya. Pindahkan anggota tersebut ke unit lain terlebih dahulu lewat halaman Anggota.`
            );
            return;
        }
        if (!confirm(`Hapus unit kerja "${unit.nama_unit}"? Tindakan ini tidak bisa dibatalkan.`)) return;

        try {
            const { error: err } = await supabase.from('unit_kerja').delete().eq('id', unit.id);
            if (err) throw err;
            setUnits((prev) => prev.filter((u) => u.id !== unit.id));
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus unit kerja.');
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <PageHeader title="Pengaturan" description="Informasi aplikasi dan data master" />

            {loading ? (
                <p className="text-gray-500">Memuat...</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <Shield className="w-5 h-5 text-emerald-600" />
                                </div>
                                <h2 className="font-semibold text-gray-900">Akun</h2>
                            </div>
                            <form onSubmit={handleChangePassword} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Password Saat Ini</label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        {currentPassword && (
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                            >
                                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Password Baru</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        {newPassword && (
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                            >
                                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Konfirmasi Password Baru</label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        {confirmPassword && (
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {pwMessage && (
                                    <p className={`text-xs ${pwMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {pwMessage.text}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={pwLoading}
                                    className="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                                >
                                    {pwLoading ? 'Menyimpan...' : 'Ubah Password'}
                                </button>
                            </form>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Database className="w-5 h-5 text-blue-600" />
                                </div>
                                <h2 className="font-semibold text-gray-900">Database</h2>
                            </div>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Total Anggota</dt>
                                    <dd className="font-medium text-gray-900">{stats?.totalAnggota} orang</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Total Unit Kerja</dt>
                                    <dd className="font-medium text-gray-900">{stats?.totalUnit} unit</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Total Transaksi Bulanan</dt>
                                    <dd className="font-medium text-gray-900">{stats?.totalTransaksi} baris</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <Building2 className="w-5 h-5 text-amber-600" />
                                </div>
                                <h2 className="font-semibold text-gray-900">Unit Kerja</h2>
                            </div>
                            <p className="text-sm text-gray-500">
                                Unit kerja baru dapat ditambahkan langsung dari halaman Anggota saat menambah/mengedit anggota.
                                Untuk mengubah nama atau menghapus unit kerja, gunakan daftar di bawah.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">Daftar Unit Kerja</h3>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {units.map((u) => (
                                <li key={u.id} className="px-6 py-3 text-sm flex items-center justify-between gap-4">
                                    <span className="flex-1">{u.nama_unit}</span>
                                    <span className="text-gray-400 whitespace-nowrap">{u.jumlahAnggota} anggota</span>
                                    <ActionButtons onEdit={() => openRenameUnit(u)} onDelete={() => handleDeleteUnit(u)} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}

            <Modal open={unitModalOpen} title="Ubah Nama Unit Kerja" onClose={() => setUnitModalOpen(false)}>
                <form onSubmit={handleSaveUnitName}>
                    <FormField label="Nama Unit Kerja" required>
                        <input
                            className={inputClass}
                            required
                            value={unitNameInput}
                            onChange={(e) => setUnitNameInput(e.target.value)}
                        />
                    </FormField>
                    <FormActions onCancel={() => setUnitModalOpen(false)} saving={savingUnit} />
                </form>
            </Modal>
        </div>
    );
}