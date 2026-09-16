import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal, FormField, FormActions, inputClass, selectClass } from '../components/ui/Modal';
import { ActionButtons, EmptyState, ErrorState, LoadingState, Pagination } from '../components/ui/TableHelpers';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { formatIDR } from '../utils';

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface AnggotaOption {
    id: number;
    no_kku: string;
    nama: string;
}

interface UnitOption {
    id: number;
    nama_unit: string;
}

interface PengeluaranRow {
    id: number;
    id_anggota: number;
    bulan: number;
    tahun: number;
    barang: number;
    anggota: (AnggotaOption & { id_unit: number | null; unit_kerja: UnitOption | null }) | null;
}

const PAGE_SIZE = 20;

const emptyForm = {
    id_anggota: '',
    bulan: new Date().getMonth() + 1,
    tahun: 2025,
    barang: '0',
};

export function PengeluaranPage() {
    const [anggotaOptions, setAnggotaOptions] = useState<AnggotaOption[]>([]);
    const [units, setUnits] = useState<UnitOption[]>([]);
    const [items, setItems] = useState<PengeluaranRow[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [filterTahun, setFilterTahun] = useState(2025);
    const [filterBulan, setFilterBulan] = useState<number | ''>('');
    const [filterUnit, setFilterUnit] = useState<number | ''>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<PengeluaranRow | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        supabase.from('anggota').select('id, no_kku, nama').order('nama')
            .then(({ data }) => setAnggotaOptions(data ?? []));
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit')
            .then(({ data }) => setUnits(data ?? []));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let matchedAnggotaIds: number[] | null = null;
            if (search) {
                const { data: matches } = await supabase
                    .from('anggota')
                    .select('id')
                    .or(`nama.ilike.%${search}%,no_kku.ilike.%${search}%`);
                matchedAnggotaIds = (matches ?? []).map((m) => m.id);
                if (matchedAnggotaIds.length === 0) {
                    setItems([]);
                    setTotal(0);
                    setLoading(false);
                    return;
                }
            }

            let query = supabase
                .from('transaksi_potongan')
                .select('id, id_anggota, bulan, tahun, barang, anggota!inner(id, no_kku, nama, id_unit, unit_kerja(id, nama_unit))', { count: 'exact' })
                .eq('tahun', filterTahun)
                .gt('barang', 0)
                .order('bulan')
                .order('nama', { referencedTable: 'anggota' })
                .range(from, to);

            if (filterBulan !== '') {
                query = query.eq('bulan', filterBulan);
            }
            if (filterUnit !== '') {
                query = query.eq('anggota.id_unit', filterUnit);
            }
            if (matchedAnggotaIds) {
                query = query.in('id_anggota', matchedAnggotaIds);
            }

            const { data, count, error: err } = await query;
            if (err) throw err;

            const rows = (data as any) as PengeluaranRow[];

            setItems(rows ?? []);
            setTotal(count ?? 0);
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data pengeluaran');
        } finally {
            setLoading(false);
        }
    }, [page, search, filterTahun, filterBulan, filterUnit]);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm({ ...emptyForm, tahun: filterTahun, bulan: filterBulan || new Date().getMonth() + 1 });
        setModalOpen(true);
    };

    const openEdit = (item: PengeluaranRow) => {
        setEditing(item);
        setForm({
            id_anggota: item.id_anggota.toString(),
            bulan: item.bulan,
            tahun: item.tahun,
            barang: String(item.barang),
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const id_anggota = Number(form.id_anggota);
            const barang = Number(form.barang) || 0;

            if (editing) {
                const { error: err } = await supabase
                    .from('transaksi_potongan')
                    .update({ barang })
                    .eq('id', editing.id);
                if (err) throw err;
            } else {
                const { data: existing } = await supabase
                    .from('transaksi_potongan')
                    .select('id')
                    .eq('id_anggota', id_anggota)
                    .eq('bulan', form.bulan)
                    .eq('tahun', form.tahun)
                    .maybeSingle();

                if (existing) {
                    const { error: err } = await supabase
                        .from('transaksi_potongan')
                        .update({ barang })
                        .eq('id', existing.id);
                    if (err) throw err;
                } else {
                    const { error: err } = await supabase
                        .from('transaksi_potongan')
                        .insert({ id_anggota, bulan: form.bulan, tahun: form.tahun, barang });
                    if (err) throw err;
                }
            }

            setModalOpen(false);
            load();
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan data pengeluaran');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: PengeluaranRow) => {
        if (!confirm(`Kosongkan data pengeluaran barang ${item.anggota?.nama} untuk ${MONTHS[item.bulan - 1]} ${item.tahun}? (Data simpanan/pinjaman bulan ini tidak akan terhapus)`)) return;
        try {
            const { error: err } = await supabase
                .from('transaksi_potongan')
                .update({ barang: 0 })
                .eq('id', item.id);
            if (err) throw err;
            load();
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus data pengeluaran');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader title="Pengeluaran" description="Potongan barang anggota koperasi (per bulan)" actionLabel="Tambah Pengeluaran" onAction={openCreate}>
                <div className="flex gap-2 items-center">
                    <select className={selectClass} value={filterTahun} onChange={(e) => { setFilterTahun(Number(e.target.value)); setPage(1); }}>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                    </select>
                    <select className={selectClass} value={filterBulan} onChange={(e) => { setFilterBulan(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
                        <option value="">Semua Bulan</option>
                        {MONTHS.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                        ))}
                    </select>
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
                            placeholder="Cari anggota..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-56"
                        />
                    </div>
                </div>
            </PageHeader>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : items.length === 0 ? (
                    <EmptyState message="Belum ada data pengeluaran untuk periode ini" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Bulan</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Anggota</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Fakultas</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Barang</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50">
                                        <td className="py-3 px-6 text-sm text-gray-600">{MONTHS[item.bulan - 1]} {item.tahun}</td>
                                        <td className="py-3 px-6 text-sm text-gray-900">{item.anggota?.nama ?? '-'} <span className="text-gray-400">({item.anggota?.no_kku})</span></td>
                                        <td className="py-3 px-6 text-sm text-gray-600">{item.anggota?.unit_kerja?.nama_unit ?? '-'}</td>
                                        <td className="py-3 px-6 text-sm font-medium text-rose-700 text-right">{formatIDR(Number(item.barang))}</td>
                                        <td className="py-3 px-6"><ActionButtons onEdit={() => openEdit(item)} onDelete={() => handleDelete(item)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination currentPage={page} lastPage={lastPage} total={total} onPageChange={setPage} />
            </div>

            <Modal open={modalOpen} title={editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'} onClose={() => setModalOpen(false)}>
                <form onSubmit={handleSubmit}>
                    <FormField label="Anggota" required>
                        <SearchableSelect
                            disabled={!!editing}
                            value={form.id_anggota}
                            onChange={(v) => setForm({ ...form, id_anggota: v })}
                            placeholder="Cari nama / no KKU..."
                            options={anggotaOptions.map((a) => ({ value: String(a.id), label: `${a.no_kku} — ${a.nama}` }))}
                        />
                    </FormField>
                    <FormField label="Bulan" required>
                        <select className={selectClass} disabled={!!editing} value={form.bulan} onChange={(e) => setForm({ ...form, bulan: Number(e.target.value) })}>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Tahun" required>
                        <input type="number" className={inputClass} disabled={!!editing} required value={form.tahun} onChange={(e) => setForm({ ...form, tahun: Number(e.target.value) })} />
                    </FormField>
                    <FormField label="Barang (Rp)" required>
                        <input type="number" min="0" className={inputClass} required value={form.barang} onChange={(e) => setForm({ ...form, barang: e.target.value })} />
                    </FormField>
                    <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
                </form>
            </Modal>
        </div>
    );
}