import { useCallback, useEffect, useMemo, useState } from 'react';
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

type CategoryKind = 'anggota_simple' | 'pinjaman' | 'angsuran' | 'expense' | 'pengambilan';

interface CategoryConfig {
    key: string;
    label: string;
    table: string;
    kind: CategoryKind;
    amountLabel: string;
}

const CATEGORIES: CategoryConfig[] = [
    { key: 'simpanan_pokok', label: 'Simpanan Pokok', table: 'simpanan_pokok', kind: 'anggota_simple', amountLabel: 'Jumlah (Rp)' },
    { key: 'simpanan_khusus', label: 'Simpanan Khusus', table: 'simpanan_khusus', kind: 'anggota_simple', amountLabel: 'Jumlah (Rp)' },
    { key: 'provisi', label: 'Provisi', table: 'provisi', kind: 'anggota_simple', amountLabel: 'Jumlah (Rp)' },
    { key: 'asuransi', label: 'Asuransi', table: 'asuransi', kind: 'anggota_simple', amountLabel: 'Jumlah (Rp)' },
    { key: 'pinjaman', label: 'Pinjaman Baru (Pencairan)', table: 'pinjaman', kind: 'pinjaman', amountLabel: 'Jumlah Pinjaman (Rp)' },
    { key: 'angsuran', label: 'Angsuran (Bendahara/Anggota)', table: 'angsuran', kind: 'angsuran', amountLabel: 'Jumlah (Rp)' },
    { key: 'operasional', label: 'Operasional', table: 'operasional', kind: 'expense', amountLabel: 'Jumlah (Rp)' },
    { key: 'warung_cleo', label: 'Warung + Cleo', table: 'warung_cleo', kind: 'expense', amountLabel: 'Jumlah (Rp)' },
    { key: 'pengambilan_simpanan', label: 'Pengambilan Simpanan', table: 'pengambilan_simpanan', kind: 'pengambilan', amountLabel: 'Jumlah (Rp)' },
];

interface AnggotaOption {
    id: number;
    no_kku: string;
    nama: string;
}

interface Row {
    id: number;
    id_anggota?: number | null;
    nama_entitas?: string;
    deskripsi?: string;
    tipe?: string | null;
    keterangan?: string | null;
    bulan: number;
    tahun: number;
    jumlah: number;
    anggota?: { nama: string; no_kku: string } | null;
}

const PAGE_SIZE = 20;

export function LaporanKeuanganPage() {
    const [categoryKey, setCategoryKey] = useState(CATEGORIES[0].key);
    const category = useMemo(() => CATEGORIES.find((c) => c.key === categoryKey)!, [categoryKey]);

    const [anggotaOptions, setAnggotaOptions] = useState<AnggotaOption[]>([]);
    const [items, setItems] = useState<Row[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [filterTahun, setFilterTahun] = useState(2025);
    const [filterBulan, setFilterBulan] = useState<number | ''>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Row | null>(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<any>({});

    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        supabase.from('anggota').select('id, no_kku, nama').order('nama')
            .then(({ data }) => setAnggotaOptions(data ?? []));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const selectCols = category.kind === 'expense'
                ? 'id, deskripsi, bulan, tahun, jumlah'
                : category.kind === 'angsuran'
                    ? 'id, nama_entitas, id_anggota, bulan, tahun, jumlah, anggota(nama, no_kku)'
                    : category.kind === 'pinjaman'
                        ? 'id, id_anggota, bulan, tahun, jumlah, keterangan, anggota(nama, no_kku)'
                        : category.kind === 'pengambilan'
                            ? 'id, id_anggota, tipe, bulan, tahun, jumlah, anggota(nama, no_kku)'
                            : 'id, id_anggota, bulan, tahun, jumlah, anggota(nama, no_kku)';

            // Check the count first — requesting .range() on a table with zero
            // matching rows causes a 416 error from PostgREST, so avoid that.
            let countQuery = supabase.from(category.table).select('id', { count: 'exact', head: true }).eq('tahun', filterTahun);
            if (filterBulan !== '') countQuery = countQuery.eq('bulan', filterBulan);
            const { count: totalCount } = await countQuery;

            if (!totalCount) {
                setItems([]);
                setTotal(0);
                setLoading(false);
                return;
            }

            let query = supabase
                .from(category.table)
                .select(selectCols, { count: 'exact' })
                .eq('tahun', filterTahun)
                .order('bulan')
                .range(from, to);

            if (filterBulan !== '') query = query.eq('bulan', filterBulan);

            const { data, count, error: err } = await query;
            if (err) throw err;

            setItems((data as any) ?? []);
            setTotal(count ?? 0);
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    }, [category, page, filterTahun, filterBulan]);

    useEffect(() => { setPage(1); }, [categoryKey]);
    useEffect(() => { load(); }, [load]);

    const emptyFormFor = () => ({
        id_anggota: '',
        nama_entitas: '',
        deskripsi: '',
        tipe: 'SW',
        keterangan: '',
        bulan: filterBulan || new Date().getMonth() + 1,
        tahun: filterTahun,
        jumlah: '',
    });

    const openCreate = () => {
        setEditing(null);
        setForm(emptyFormFor());
        setModalOpen(true);
    };

    const openEdit = (item: Row) => {
        setEditing(item);
        setForm({
            id_anggota: item.id_anggota != null ? String(item.id_anggota) : '',
            nama_entitas: item.nama_entitas ?? '',
            deskripsi: item.deskripsi ?? '',
            tipe: item.tipe ?? 'SW',
            keterangan: item.keterangan ?? '',
            bulan: item.bulan,
            tahun: item.tahun,
            jumlah: String(item.jumlah),
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const jumlah = Number(form.jumlah) || 0;
            const payload: any = { bulan: form.bulan, tahun: form.tahun, jumlah };

            if (category.kind === 'expense') {
                payload.deskripsi = form.deskripsi;
            } else if (category.kind === 'angsuran') {
                payload.nama_entitas = form.nama_entitas;
                payload.id_anggota = form.id_anggota ? Number(form.id_anggota) : null;
            } else if (category.kind === 'pinjaman') {
                payload.id_anggota = Number(form.id_anggota);
                payload.keterangan = form.keterangan || null;
            } else if (category.kind === 'pengambilan') {
                payload.id_anggota = Number(form.id_anggota);
                payload.tipe = form.tipe;
            } else {
                payload.id_anggota = Number(form.id_anggota);
            }

            if (editing) {
                const { error: err } = await supabase.from(category.table).update(payload).eq('id', editing.id);
                if (err) throw err;
            } else {
                const { error: err } = await supabase.from(category.table).insert(payload);
                if (err) throw err;
            }

            setModalOpen(false);
            load();
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: Row) => {
        if (!confirm('Hapus data ini?')) return;
        try {
            const { error: err } = await supabase.from(category.table).delete().eq('id', item.id);
            if (err) throw err;
            load();
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus data');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader title="Laporan Keuangan" description="Simpanan pokok/khusus, provisi, asuransi, pinjaman, angsuran, operasional, warung+cleo, pengambilan simpanan" actionLabel="Tambah" onAction={openCreate}>
                <div className="flex gap-2 items-center flex-wrap">
                    <select className={selectClass} value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
                        {CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                    </select>
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
                </div>
            </PageHeader>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : items.length === 0 ? (
                    <EmptyState message="Belum ada data untuk kategori/periode ini" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Bulan</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">
                                        {category.kind === 'expense' ? 'Deskripsi' : category.kind === 'angsuran' ? 'Entitas' : 'Anggota'}
                                    </th>
                                    {category.kind === 'pengambilan' && <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Tipe</th>}
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Jumlah</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50">
                                        <td className="py-3 px-6 text-sm text-gray-600">{MONTHS[item.bulan - 1]} {item.tahun}</td>
                                        <td className="py-3 px-6 text-sm text-gray-900">
                                            {category.kind === 'expense'
                                                ? item.deskripsi
                                                : category.kind === 'angsuran'
                                                    ? (item.anggota?.nama ?? item.nama_entitas)
                                                    : (item.anggota ? `${item.anggota.nama} (${item.anggota.no_kku})` : '-')}
                                        </td>
                                        {category.kind === 'pengambilan' && <td className="py-3 px-6 text-sm text-gray-600">{item.tipe}</td>}
                                        <td className="py-3 px-6 text-sm font-medium text-gray-900 text-right">{formatIDR(Number(item.jumlah))}</td>
                                        <td className="py-3 px-6"><ActionButtons onEdit={() => openEdit(item)} onDelete={() => handleDelete(item)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination currentPage={page} lastPage={lastPage} total={total} onPageChange={setPage} />
            </div>

            <Modal open={modalOpen} title={editing ? `Edit ${category.label}` : `Tambah ${category.label}`} onClose={() => setModalOpen(false)}>
                <form onSubmit={handleSubmit}>
                    {category.kind === 'expense' && (
                        <FormField label="Deskripsi" required>
                            <input className={inputClass} required value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
                        </FormField>
                    )}

                    {category.kind === 'angsuran' && (
                        <>
                            <FormField label="Nama Entitas (mis. 'BEND REKTORAT' atau nama anggota)" required>
                                <input className={inputClass} required value={form.nama_entitas} onChange={(e) => setForm({ ...form, nama_entitas: e.target.value })} />
                            </FormField>
                            <FormField label="Kaitkan ke Anggota (opsional)">
                                <SearchableSelect
                                    value={form.id_anggota}
                                    onChange={(v) => setForm({ ...form, id_anggota: v })}
                                    placeholder="Cari anggota (kosongkan jika entri bendahara)..."
                                    options={anggotaOptions.map((a) => ({ value: String(a.id), label: `${a.no_kku} — ${a.nama}` }))}
                                />
                            </FormField>
                        </>
                    )}

                    {(category.kind === 'anggota_simple' || category.kind === 'pinjaman' || category.kind === 'pengambilan') && (
                        <FormField label="Anggota" required>
                            <SearchableSelect
                                disabled={!!editing}
                                value={form.id_anggota}
                                onChange={(v) => setForm({ ...form, id_anggota: v })}
                                placeholder="Cari nama / no KKU..."
                                options={anggotaOptions.map((a) => ({ value: String(a.id), label: `${a.no_kku} — ${a.nama}` }))}
                            />
                        </FormField>
                    )}

                    {category.kind === 'pengambilan' && (
                        <FormField label="Tipe" required>
                            <select className={selectClass} value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value })}>
                                <option value="SW">SW (Simpanan Wajib)</option>
                                <option value="SS">SS (Simpanan Sukarela)</option>
                            </select>
                        </FormField>
                    )}

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
                    <FormField label={category.amountLabel} required>
                        <input type="number" min="0" className={inputClass} required value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} />
                    </FormField>

                    {category.kind === 'pinjaman' && (
                        <FormField label="Keterangan">
                            <textarea className={inputClass} rows={2} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
                        </FormField>
                    )}

                    <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
                </form>
            </Modal>
        </div>
    );
}