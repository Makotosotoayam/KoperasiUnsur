import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const MONTH_ABBR_MAP: Record<string, number> = {
    JAN: 1, JANUARI: 1,
    FEB: 2, FEBRUARI: 2,
    MAR: 3, MARET: 3,
    APR: 4, APRIL: 4,
    MEI: 5,
    JUN: 6, JUNI: 6,
    JUL: 7, JULI: 7,
    AGU: 8, AGUS: 8, AGUSTUS: 8,
    SEP: 9, SEPTEMBER: 9,
    OKT: 10, OKTOBER: 10,
    NOV: 11, NOVEMBER: 11,
    DES: 12, DESEMBER: 12,
};

interface ParsedRow {
    unit: string;
    no_kku: string;
    nama: string;
    cicilan_ke: string | null;
    simwa: number;
    sukarela: number;
    pokok: number;
    jasa: number;
    barang: number;
}

interface ImportResults {
    unitsFound: string[];
    unitsCreated: number;
    anggotaCreated: number;
    anggotaMatched: number;
    transaksiCreated: number;
    transaksiUpdated: number;
    rowErrors: { no_kku: string; error: string }[];
}

// Walks the sheet row-by-row. Detects "DAFTAR POTONGAN...(UNIT)" lines to know
// which unit_kerja a block of members belongs to, and treats any row whose
// first column is a positive number as a real data row (this naturally skips
// the header rows and the "Bendahara / Ketua Koperasi" signature footer that
// appears between each unit section).
function parseWorkbookSheet(sheet: XLSX.WorkSheet): ParsedRow[] {
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const parsed: ParsedRow[] = [];
    let currentUnit: string | null = null;

    for (const row of rows) {
        const firstCell = row[0] != null ? String(row[0]).trim() : '';

        if (firstCell.toUpperCase().includes('DAFTAR POTONGAN')) {
            const prefix = 'DAFTAR POTONGAN KOPERASI KESEJAHTREAAN UNSUR';
            let rest = firstCell.toUpperCase().startsWith(prefix)
                ? firstCell.slice(prefix.length).trim()
                : firstCell.trim();
            if (rest.startsWith('-')) rest = rest.slice(1).trim();
            const parenMatch = rest.match(/^\(([^)]+)\)$/);
            currentUnit = parenMatch ? parenMatch[1].trim() : rest;
            continue;
        }

        const rowNum = Number(firstCell);
        const noKku = row[1] != null ? String(row[1]).trim() : '';
        const nama = row[2] != null ? String(row[2]).trim() : '';

        const looksLikeDataRow = Number.isInteger(rowNum) && rowNum > 0 && noKku !== '' && nama !== '';
        if (!looksLikeDataRow || !currentUnit) continue;

        parsed.push({
            unit: currentUnit,
            no_kku: noKku,
            nama,
            cicilan_ke: row[4] != null ? String(row[4]).trim() : null,
            simwa: Number(row[5]) || 0,
            sukarela: Number(row[6]) || 0,
            pokok: Number(row[7]) || 0,
            jasa: Number(row[8]) || 0,
            barang: Number(row[9]) || 0,
        });
    }

    return parsed;
}

type UploadStatus =
    | { type: 'idle' }
    | { type: 'loading'; message: string }
    | { type: 'success'; results: ImportResults }
    | { type: 'error'; message: string };

export default function UploadLaporan() {
    const [status, setStatus] = useState<UploadStatus>({ type: 'idle' });
    const [tahun, setTahun] = useState(2025);
    const [bulan, setBulan] = useState(1);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus({ type: 'loading', message: 'Membaca file...' });

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });

            const sheetMonthPairs: { sheetName: string; bulan: number }[] = [];
            if (workbook.SheetNames.length > 1) {
                for (const name of workbook.SheetNames) {
                    const m = MONTH_ABBR_MAP[name.trim().toUpperCase()];
                    if (m) sheetMonthPairs.push({ sheetName: name, bulan: m });
                }
            }
            if (sheetMonthPairs.length === 0) {
                sheetMonthPairs.push({ sheetName: workbook.SheetNames[0], bulan });
            }

            setStatus({ type: 'loading', message: 'Memproses data anggota & transaksi...' });

            const results: ImportResults = {
                unitsFound: [],
                unitsCreated: 0,
                anggotaCreated: 0,
                anggotaMatched: 0,
                transaksiCreated: 0,
                transaksiUpdated: 0,
                rowErrors: [],
            };

            const { data: existingUnits } = await supabase.from('unit_kerja').select('id, nama_unit');
            const unitMap = new Map<string, number>((existingUnits ?? []).map((u) => [u.nama_unit, u.id]));

            const { data: existingAnggota } = await supabase.from('anggota').select('id, no_kku');
            const anggotaMap = new Map<string, number>((existingAnggota ?? []).map((a) => [a.no_kku, a.id]));

            for (const { sheetName, bulan: bulanForSheet } of sheetMonthPairs) {
                const rows = parseWorkbookSheet(workbook.Sheets[sheetName]);

                for (const row of rows) {
                    try {
                        if (!results.unitsFound.includes(row.unit)) results.unitsFound.push(row.unit);

                        let unitId = unitMap.get(row.unit);
                        if (!unitId) {
                            const { data: newUnit, error: unitErr } = await supabase
                                .from('unit_kerja')
                                .insert({ nama_unit: row.unit })
                                .select('id')
                                .single();
                            if (unitErr) throw unitErr;
                            unitId = newUnit.id;
                            unitMap.set(row.unit, unitId);
                            results.unitsCreated++;
                        }

                        let anggotaId = anggotaMap.get(row.no_kku);
                        if (!anggotaId) {
                            const { data: newAnggota, error: anggotaErr } = await supabase
                                .from('anggota')
                                .insert({ no_kku: row.no_kku, nama: row.nama, id_unit: unitId })
                                .select('id')
                                .single();
                            if (anggotaErr) throw anggotaErr;
                            anggotaId = newAnggota.id;
                            anggotaMap.set(row.no_kku, anggotaId);
                            results.anggotaCreated++;
                        } else {
                            results.anggotaMatched++;
                        }

                        const { data: existingTx } = await supabase
                            .from('transaksi_potongan')
                            .select('id')
                            .eq('id_anggota', anggotaId)
                            .eq('bulan', bulanForSheet)
                            .eq('tahun', tahun)
                            .maybeSingle();

                        const txData = {
                            simwa: row.simwa,
                            sukarela: row.sukarela,
                            pokok: row.pokok,
                            jasa: row.jasa,
                            barang: row.barang,
                            cicilan_ke: row.cicilan_ke,
                        };

                        if (existingTx) {
                            const { error: updErr } = await supabase
                                .from('transaksi_potongan')
                                .update(txData)
                                .eq('id', existingTx.id);
                            if (updErr) throw updErr;
                            results.transaksiUpdated++;
                        } else {
                            const { error: insErr } = await supabase
                                .from('transaksi_potongan')
                                .insert({ id_anggota: anggotaId, bulan: bulanForSheet, tahun, ...txData });
                            if (insErr) throw insErr;
                            results.transaksiCreated++;
                        }
                    } catch (rowErr) {
                        results.rowErrors.push({
                            no_kku: row.no_kku,
                            error: rowErr instanceof Error ? rowErr.message : String(rowErr),
                        });
                    }
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
            <div className="flex gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
                    <input
                        type="number"
                        value={tahun}
                        onChange={(e) => setTahun(Number(e.target.value))}
                        className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bulan <span className="text-gray-400 font-normal">(diabaikan jika file berisi banyak sheet)</span>
                    </label>
                    <select
                        value={bulan}
                        onChange={(e) => setBulan(Number(e.target.value))}
                        className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                        {MONTHS.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                        ))}
                    </select>
                </div>
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-emerald-400 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                    Klik untuk memilih file laporan (.xlsx atau .csv)
                </span>
                <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
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
                    <p>Unit ditemukan: {status.results.unitsFound.join(', ') || '-'}</p>
                    {status.results.unitsCreated > 0 && <p>Unit baru dibuat: {status.results.unitsCreated}</p>}
                    <p>Anggota baru: {status.results.anggotaCreated}, anggota cocok: {status.results.anggotaMatched}</p>
                    <p>Transaksi baru: {status.results.transaksiCreated}, transaksi diperbarui: {status.results.transaksiUpdated}</p>
                    {status.results.rowErrors.length > 0 && (
                        <p className="text-amber-700">Baris bermasalah: {status.results.rowErrors.length} (lihat console untuk detail)</p>
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