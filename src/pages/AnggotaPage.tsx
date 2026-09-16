import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal, FormField, FormActions, inputClass, selectClass } from '../components/ui/Modal';
import { ActionButtons, EmptyState, ErrorState, LoadingState, Pagination } from '../components/ui/TableHelpers';

interface UnitKerja {
    id: number;
    nama_unit: string;
}

interface AnggotaRow {
    id: number;
    no_kku: string;
    nama: string;
    id_unit: number | null;
    unit_kerja: UnitKerja | null;
}

const PAGE_SIZE = 20;

const emptyForm = {
    no_kku: '',
    nama: '',
    id_unit: '',
};

export function AnggotaPage() {
    const [units, setUnits] = useState<UnitKerja[]>([]);
    const [items, setItems] = useState<AnggotaRow[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [filterUnit, setFilterUnit] = useState<number | ''>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AnggotaRow | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [addingUnit, setAddingUnit] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [savingUnit, setSavingUnit] = useState(false);

    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit')
            .then(({ data }) => setUnits(data ?? []));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let query = supabase
                .from('anggota')
                .select('id, no_kku, nama, id_unit, unit_kerja(id, nama_unit)', { count: 'exact' })
                .order('id_unit')
                .order('nama')
                .range(from, to);

            if (search) {
                query = query.or(`nama.ilike.%${search}%,no_kku.ilike.%${search}%`);
            }
            if (filterUnit !== '') {
                query = query.eq('id_unit', filterUnit);
            }

            const { data, count, error: err } = await query;
            if (err) throw err;

            setItems((data as any) ?? []);
            setTotal(count ?? 0);
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data anggota');
        } finally {
            setLoading(false);
        }
    }, [page, search, filterUnit]);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setAddingUnit(false);
        setNewUnitName('');
        setModalOpen(true);
    };

    const openEdit = (item: AnggotaRow) => {
        setEditing(item);
        setForm({
            no_kku: item.no_kku,
            nama: item.nama,
            id_unit: item.id_unit?.toString() ?? '',
        });
        setAddingUnit(false);
        setNewUnitName('');
        setModalOpen(true);
    };

    const handleAddUnit = async () => {
        const name = newUnitName.trim();
        if (!name) return;
        setSavingUnit(true);
        try {
            const { data, error: err } = await supabase
                .from('unit_kerja')
                .insert({ nama_unit: name })
                .select('id, nama_unit')
                .single();
            if (err) throw err;
            setUnits((prev) => [...prev, data].sort((a, b) => a.nama_unit.localeCompare(b.nama_unit)));
            setForm((f: any) => ({ ...f, id_unit: String(data.id) }));
            setNewUnitName('');
            setAddingUnit(false);
        } catch (err) {
            console.error(err);
            alert('Gagal menambahkan unit kerja baru. Mungkin nama unit ini sudah ada.');
        } finally {
            setSavingUnit(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            let no_kku = form.no_kku.trim();
            if (!no_kku) {
                const { data: existing } = await supabase
                    .from('anggota')
                    .select('no_kku')
                    .like('no_kku', 'LB-%');
                const usedNumbers = (existing ?? [])
                    .map((r) => parseInt(r.no_kku.replace('LB-', ''), 10))
                    .filter((n) => !isNaN(n));
                const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
                no_kku = `LB-${String(nextNumber).padStart(2, '0')}`;
            }

            const payload = {
                no_kku,
                nama: form.nama,
                id_unit: form.id_unit ? Number(form.id_unit) : null,
            };

            if (editing) {
                const { error: err } = await supabase.from('anggota').update(payload).eq('id', editing.id);
                if (err) throw err;
            } else {
                const { error: err } = await supabase.from('anggota').insert(payload);
                if (err) throw err;
            }

            setModalOpen(false);
            load();
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan data anggota. Pastikan No. KKU belum dipakai untuk tahun yang sama.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: AnggotaRow) => {
        if (!confirm(`Hapus anggota ${item.nama}? Ini juga akan menghapus riwayat transaksi terkait.`)) return;
        try {
            const { error: err } = await supabase.from('anggota').delete().eq('id', item.id);
            if (err) throw err;
            load();
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus anggota');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader title="Data Anggota" description="Kelola anggota koperasi kesejahteraan" actionLabel="Tambah Anggota" onAction={openCreate}>
                <div className="flex gap-2 items-center">
                    <select className={selectClass} value={filterUnit} onChange={(e) => { setFilterUnit(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
                        <option value="">Semua Fakultas</option>
                        {units.map((u) => (
                            <option key={u.id} value={u.id}>{u.nama_unit}</option>
                        ))}
                    </select>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari nama / no KKU..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
                        />
                    </div>
                </div>
            </PageHeader>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : items.length === 0 ? (
                    <EmptyState message="Belum ada data anggota" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">No. KKU</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Nama</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Unit Kerja</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50">
                                        <td className="py-3 px-6 text-sm font-medium text-gray-900">{item.no_kku}</td>
                                        <td className="py-3 px-6 text-sm text-gray-700">{item.nama}</td>
                                        <td className="py-3 px-6 text-sm text-gray-600">{item.unit_kerja?.nama_unit ?? '-'}</td>
                                        <td className="py-3 px-6"><ActionButtons onEdit={() => openEdit(item)} onDelete={() => handleDelete(item)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination currentPage={page} lastPage={lastPage} total={total} onPageChange={setPage} />
            </div>

            <Modal open={modalOpen} title={editing ? 'Edit Anggota' : 'Tambah Anggota'} onClose={() => setModalOpen(false)}>
                <form onSubmit={handleSubmit}>
                    <FormField label="No. KKU" required={false}>
                        <input className={inputClass} placeholder="Kosongkan jika belum ada No. KKU" value={form.no_kku} onChange={(e) => setForm({ ...form, no_kku: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-1">Jika dikosongkan, sistem akan membuat ID sementara otomatis (contoh: LB-08).</p>
                    </FormField>
                    <FormField label="Nama Lengkap" required>
                        <input className={inputClass} required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
                    </FormField>
                    <FormField label="Unit Kerja">
                        <select
                            className={selectClass}
                            value={addingUnit ? '__new__' : form.id_unit}
                            onChange={(e) => {
                                if (e.target.value === '__new__') {
                                    setAddingUnit(true);
                                } else {
                                    setAddingUnit(false);
                                    setForm({ ...form, id_unit: e.target.value });
                                }
                            }}
                        >
                            <option value="">- Pilih -</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>{u.nama_unit}</option>
                            ))}
                            <option value="__new__">+ Tambah Unit Kerja Baru...</option>
                        </select>
                        {addingUnit && (
                            <div className="flex gap-2 mt-2">
                                <input
                                    className={inputClass}
                                    placeholder="Nama unit kerja baru"
                                    value={newUnitName}
                                    onChange={(e) => setNewUnitName(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddUnit}
                                    disabled={savingUnit || !newUnitName.trim()}
                                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                    {savingUnit ? '...' : 'Simpan'}
                                </button>
                            </div>
                        )}
                    </FormField>
                    <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
                </form>
            </Modal>
        </div>
    );
}