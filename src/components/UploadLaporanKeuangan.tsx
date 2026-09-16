import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

const MONTH_MAP: Record<string, number> = {
    JAN: 1, JANUARI: 1,
    FEB: 2, FEBRUARI: 2,
    MAR: 3, MARET: 3,
    APR: 4, APRIL: 4,
    MAY: 5, MEI: 5,
    JUN: 6, JUNI: 6,
    JUL: 7, JULI: 7,
    AUG: 8, AGU: 8, AGUS: 8, AGUSTUS: 8,
    SEP: 9, SEPTEMBER: 9,
    OCT: 10, OKT: 10, OKTOBER: 10,
    NOV: 11, NOVEMBER: 11,
    DEC: 12, DES: 12, DESEMBER: 12,
};

function cleanName(raw: string): string {
    return raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function normalize(name: string): string {
    return cleanName(name).toUpperCase().replace(/\s+/g, ' ').trim();
}

interface SectionConfig {
    label: string;
    table: string;
    kind: 'anggota' | 'expense' | 'angsuran' | 'pengambilan' | 'skip';
}

const SECTIONS: SectionConfig[] = [
    { label: 'SIMPANAN WAJIB', table: '', kind: 'skip' },
    { label: 'SIMPANAN POKOK', table: 'simpanan_pokok', kind: 'anggota' },
    { label: 'SIMPANAN SUKARELA', table: '', kind: 'skip' },
    { label: 'SIMPANAN KHUSUS', table: 'simpanan_khusus', kind: 'anggota' },
    { label: 'PROVISI', table: 'provisi', kind: 'anggota' },
    { label: 'ASURANSI', table: 'asuransi', kind: 'anggota' },
    { label: 'PINJAMAN', table: 'pinjaman', kind: 'anggota' },
    { label: 'ANGSURAN POKOK DAN JASA', table: 'angsuran', kind: 'angsuran' },
    { label: 'OPERASIONAL', table: 'operasional', kind: 'expense' },
    { label: 'WARUNG', table: 'warung_cleo', kind: 'expense' },
    { label: 'PENGAMBILAN SIMPANAN', table: 'pengambilan_simpanan', kind: 'pengambilan' },
];

interface ImportResults {
    sectionsProcessed: string[];
    sectionsSkipped: string[];
    rowsImported: number;
    unmatchedNames: string[];
}

type UploadStatus =
    | { type: 'idle' }
    | { type: 'loading'; message: string }
    | { type: 'success'; results: ImportResults }
    | { type: 'error'; message: string };

export default function UploadLaporanKeuangan() {
    const [status, setStatus] = useState<UploadStatus>({ type: 'idle' });
    const [tahun, setTahun] = useState(2025);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus({ type: 'loading', message: 'Membaca file...' });

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

            setStatus({ type: 'loading', message: 'Memuat data anggota untuk pencocokan nama...' });

            const { data: anggotaList } = await supabase.from('anggota').select('id, nama');
            const nameMap = new Map<string, number>();
            for (const a of anggotaList ?? []) {
                nameMap.set(normalize(a.nama), a.id);
            }

            const results: ImportResults = {
                sectionsProcessed: [],
                sectionsSkipped: [],
                rowsImported: 0,
                unmatchedNames: [],
            };

            let i = 0;
            while (i < rows.length) {
                const cell0 = rows[i][0] != null ? String(rows[i][0]).trim().toUpperCase() : '';
                const matchedSection = SECTIONS.find((s) => cell0.includes(s.label));

                if (!matchedSection) { i++; continue; }

                if (matchedSection.kind === 'skip') {
                    results.sectionsSkipped.push(matchedSection.label);
                    i++;
                    continue;
                }

                const headerRow = rows[i + 1] ?? [];
                const monthCols: Record<number, number> = {};
                headerRow.forEach((cell: any, idx: number) => {
                    if (cell == null) return;
                    const m = MONTH_MAP[String(cell).trim().toUpperCase()];
                    if (m) monthCols[idx] = m;
                });

                results.sectionsProcessed.push(matchedSection.label);
                i += 2;

                while (i < rows.length) {
                    const row = rows[i];
                    const nameCell = row[1] != null ? String(row[1]).trim() : '';
                    if (!nameCell || nameCell.toUpperCase() === 'JUMLAH' || nameCell.toUpperCase() === 'TOTAL') {
                        i++;
                        if (nameCell.toUpperCase() === 'TOTAL') break;
                        if (!nameCell) break;
                        continue;
                    }

                    let anggotaId: number | null = null;
                    if (matchedSection.kind !== 'expense') {
                        const isTreasurerRow = /^BEND\b/i.test(nameCell);
                        if (!isTreasurerRow) {
                            const key = normalize(nameCell);
                            anggotaId = nameMap.get(key) ?? null;
                            if (!anggotaId && !results.unmatchedNames.includes(nameCell)) {
                                results.unmatchedNames.push(nameCell);
                            }
                        }
                    }

                    const tipe = matchedSection.kind === 'pengambilan'
                        ? (row[2] != null ? String(row[2]).trim() : null)
                        : null;

                    for (const [colIdx, bulan] of Object.entries(monthCols)) {
                        const raw = row[Number(colIdx)];
                        const jumlah = Number(raw);
                        if (!raw || !jumlah) continue;

                        try {
                            if (matchedSection.kind === 'expense') {
                                await supabase.from(matchedSection.table).insert({
                                    deskripsi: nameCell, bulan, tahun, jumlah,
                                });
                            } else if (matchedSection.kind === 'angsuran') {
                                await supabase.from('angsuran').insert({
                                    nama_entitas: nameCell, id_anggota: anggotaId, bulan, tahun, jumlah,
                                });
                            } else if (matchedSection.kind === 'pengambilan') {
                                if (!anggotaId) continue;
                                await supabase.from('pengambilan_simpanan').insert({
                                    id_anggota: anggotaId, tipe, bulan, tahun, jumlah,
                                });
                            } else {
                                if (!anggotaId) continue;
                                await supabase.from(matchedSection.table).insert({
                                    id_anggota: anggotaId, bulan, tahun, jumlah,
                                });
                            }
                            results.rowsImported++;
                        } catch (err) {
                            console.error(`Gagal import baris ${nameCell} (${matchedSection.table}):`, err);
                        }
                    }

                    i++;
                }
            }

            setStatus({ type: 'success', results });
        } catch (err) {
            setStatus({
                type: 'error',
                message: err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses file',
            });
        } finally {
            e.target.value = '';
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-4">
            <div>
                <h2 className="text-lg font-bold text-gray-900">Upload Laporan Keuangan Lengkap</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Untuk file "LAPORAN KOPERASI" (simpanan pokok/khusus, provisi, asuransi, pinjaman, angsuran, operasional, warung+cleo, pengambilan simpanan).
                    Simpanan Wajib &amp; Sukarela dilewati karena sudah tercakup di data potongan bulanan.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
                <input
                    type="number"
                    value={tahun}
                    onChange={(e) => setTahun(Number(e.target.value))}
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-emerald-400 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Klik untuk memilih file laporan keuangan (.xlsx)</span>
                <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={status.type === 'loading'}
                />
            </label>

            {status.type === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {status.message}
                </div>
            )}

            {status.type === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800 space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                        <CheckCircle className="w-4 h-4" />
                        File berhasil diproses.
                    </div>
                    <p>Bagian diproses: {status.results.sectionsProcessed.join(', ') || '-'}</p>
                    <p>Bagian dilewati (sudah tercakup): {status.results.sectionsSkipped.join(', ') || '-'}</p>
                    <p>Baris berhasil diimpor: {status.results.rowsImported}</p>
                    {status.results.unmatchedNames.length > 0 && (
                        <div className="text-amber-700 mt-2">
                            <p className="font-medium">Nama tidak cocok dengan data anggota ({status.results.unmatchedNames.length}) — baris ini DILEWATI, perlu dicocokkan manual:</p>
                            <ul className="list-disc list-inside">
                                {status.results.unmatchedNames.map((n) => <li key={n}>{n}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {status.type === 'error' && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    {status.message}
                </div>
            )}
        </div>
    );
}