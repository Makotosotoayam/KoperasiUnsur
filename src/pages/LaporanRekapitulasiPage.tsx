import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../supabaseClient';
import { selectClass } from '../components/ui/Modal';
import { formatIDR } from '../utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

interface MatrixSection {
    title: string;
    rowLabelHeader: string;
    rows: { label: string; monthly: number[]; total: number }[];
    grandTotal: number;
}

function buildEmptyMonthly(): number[] {
    return Array(12).fill(0);
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A54' } };
const SECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EE' } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};
const NUMBER_FORMAT = '#,##0';

export function LaporanRekapitulasiPage() {
    const [tahun, setTahun] = useState(2025);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [sections, setSections] = useState<MatrixSection[]>([]);
    const [unitFilter, setUnitFilter] = useState<string>('');
    const [units, setUnits] = useState<string[]>([]);
    const [filterBulan, setFilterBulan] = useState<number | ''>('');

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tahun, unitFilter]);

    async function loadData() {
        setLoading(true);
        try {
            const { data: txRows } = await supabase
                .from('transaksi_potongan')
                .select('bulan, simwa, sukarela, anggota!inner(id_unit, unit_kerja(nama_unit))')
                .eq('tahun', tahun)
                .range(0, 9999);

            const unitSimwa = new Map<string, number[]>();
            const unitSukarela = new Map<string, number[]>();
            const unitNames = new Set<string>();

            for (const row of (txRows as any) ?? []) {
                const unitName = row.anggota?.unit_kerja?.nama_unit ?? 'Tanpa Unit';
                unitNames.add(unitName);
                if (!unitSimwa.has(unitName)) unitSimwa.set(unitName, buildEmptyMonthly());
                if (!unitSukarela.has(unitName)) unitSukarela.set(unitName, buildEmptyMonthly());
                const idx = row.bulan - 1;
                if (idx < 0 || idx > 11) continue;
                unitSimwa.get(unitName)![idx] += Number(row.simwa) || 0;
                unitSukarela.get(unitName)![idx] += Number(row.sukarela) || 0;
            }

            setUnits(Array.from(unitNames).sort());

            const toRows = (map: Map<string, number[]>) =>
                Array.from(map.entries())
                    .filter(([unitName]) => !unitFilter || unitName === unitFilter)
                    .map(([label, monthly]) => ({ label, monthly, total: monthly.reduce((a, b) => a + b, 0) }))
                    .sort((a, b) => a.label.localeCompare(b.label));

            const simwaRows = toRows(unitSimwa);
            const sukarelaRows = toRows(unitSukarela);

            async function loadMemberCategory(table: string) {
                const { data } = await supabase
                    .from(table)
                    .select('bulan, jumlah, anggota(nama, id_unit, unit_kerja(nama_unit))')
                    .eq('tahun', tahun)
                    .range(0, 9999);

                const byMember = new Map<string, number[]>();
                for (const row of (data as any) ?? []) {
                    const memberUnit = row.anggota?.unit_kerja?.nama_unit ?? '';
                    if (unitFilter && memberUnit !== unitFilter) continue;
                    const name = row.anggota?.nama ?? 'Tidak diketahui';
                    if (!byMember.has(name)) byMember.set(name, buildEmptyMonthly());
                    const idx = row.bulan - 1;
                    if (idx < 0 || idx > 11) continue;
                    byMember.get(name)![idx] += Number(row.jumlah) || 0;
                }
                return Array.from(byMember.entries())
                    .map(([label, monthly]) => ({ label, monthly, total: monthly.reduce((a, b) => a + b, 0) }))
                    .sort((a, b) => a.label.localeCompare(b.label));
            }

            async function loadExpenseCategory(table: string) {
                if (unitFilter) return [];
                const { data } = await supabase
                    .from(table)
                    .select('deskripsi, bulan, jumlah')
                    .eq('tahun', tahun)
                    .range(0, 9999);

                const byDesc = new Map<string, number[]>();
                for (const row of (data as any) ?? []) {
                    const desc = row.deskripsi ?? '-';
                    if (!byDesc.has(desc)) byDesc.set(desc, buildEmptyMonthly());
                    const idx = row.bulan - 1;
                    if (idx < 0 || idx > 11) continue;
                    byDesc.get(desc)![idx] += Number(row.jumlah) || 0;
                }
                return Array.from(byDesc.entries())
                    .map(([label, monthly]) => ({ label, monthly, total: monthly.reduce((a, b) => a + b, 0) }));
            }

            async function loadAngsuran() {
                const { data } = await supabase
                    .from('angsuran')
                    .select('nama_entitas, bulan, jumlah, anggota(id_unit, unit_kerja(nama_unit))')
                    .eq('tahun', tahun)
                    .range(0, 9999);

                const byEntity = new Map<string, number[]>();
                for (const row of (data as any) ?? []) {
                    const memberUnit = row.anggota?.unit_kerja?.nama_unit ?? '';
                    if (unitFilter && memberUnit !== unitFilter) continue;
                    const name = row.nama_entitas ?? '-';
                    if (!byEntity.has(name)) byEntity.set(name, buildEmptyMonthly());
                    const idx = row.bulan - 1;
                    if (idx < 0 || idx > 11) continue;
                    byEntity.get(name)![idx] += Number(row.jumlah) || 0;
                }
                return Array.from(byEntity.entries())
                    .map(([label, monthly]) => ({ label, monthly, total: monthly.reduce((a, b) => a + b, 0) }));
            }

            const [pokokRows, khususRows, provisiRows, asuransiRows, pinjamanRows, operasionalRows, warungRows, pengambilanRows, angsuranRows] =
                await Promise.all([
                    loadMemberCategory('simpanan_pokok'),
                    loadMemberCategory('simpanan_khusus'),
                    loadMemberCategory('provisi'),
                    loadMemberCategory('asuransi'),
                    loadMemberCategory('pinjaman'),
                    loadExpenseCategory('operasional'),
                    loadExpenseCategory('warung_cleo'),
                    loadMemberCategory('pengambilan_simpanan'),
                    loadAngsuran(),
                ]);

            const makeSection = (title: string, rowLabelHeader: string, rows: MatrixSection['rows']): MatrixSection => ({
                title, rowLabelHeader, rows,
                grandTotal: rows.reduce((sum, r) => sum + r.total, 0),
            });

            setSections([
                makeSection('Rekapitulasi Simpanan Wajib', 'Unit Kerja', simwaRows),
                makeSection('Rekapitulasi Simpanan Sukarela', 'Unit Kerja', sukarelaRows),
                makeSection('Rekapitulasi Simpanan Pokok', 'Anggota', pokokRows),
                makeSection('Rekapitulasi Simpanan Khusus', 'Anggota', khususRows),
                makeSection('Rekapitulasi Provisi', 'Anggota', provisiRows),
                makeSection('Rekapitulasi Asuransi', 'Anggota', asuransiRows),
                makeSection('Rekapitulasi Pinjaman', 'Anggota', pinjamanRows),
                makeSection('Rekapitulasi Angsuran Pokok dan Jasa', 'Entitas', angsuranRows),
                makeSection('Rekapitulasi Operasional', 'Operasional', operasionalRows),
                makeSection('Rekapitulasi Warung + Cleo', 'Modal Warung + Cleo', warungRows),
                makeSection('Pengambilan Simpanan', 'Anggota', pengambilanRows),
            ]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const displayMonthIndices = filterBulan === '' ? MONTHS.map((_, i) => i) : [filterBulan - 1];
    const displayMonths = filterBulan === '' ? MONTHS : [MONTHS[filterBulan - 1]];

    const displaySections = useMemo(() => {
        return sections.map((s) => {
            const rows = s.rows.map((r) => {
                const monthly = displayMonthIndices.map((i) => r.monthly[i]);
                return { ...r, monthly, total: monthly.reduce((a, b) => a + b, 0) };
            });
            return { ...s, rows, grandTotal: rows.reduce((sum, r) => sum + r.total, 0) };
        });
    }, [sections, filterBulan]);

    const totalPemasukan = useMemo(() => {
        const names = ['Rekapitulasi Simpanan Wajib', 'Rekapitulasi Simpanan Sukarela', 'Rekapitulasi Simpanan Pokok', 'Rekapitulasi Simpanan Khusus', 'Rekapitulasi Provisi', 'Rekapitulasi Asuransi', 'Rekapitulasi Angsuran Pokok dan Jasa'];
        return displaySections.filter((s) => names.includes(s.title)).reduce((sum, s) => sum + s.grandTotal, 0);
    }, [displaySections]);

    const totalPengeluaran = useMemo(() => {
        const names = ['Rekapitulasi Pinjaman', 'Rekapitulasi Operasional', 'Rekapitulasi Warung + Cleo', 'Pengambilan Simpanan'];
        return displaySections.filter((s) => names.includes(s.title)).reduce((sum, s) => sum + s.grandTotal, 0);
    }, [displaySections]);

    async function exportToExcel() {
        setExporting(true);
        try {
            const wb = new ExcelJS.Workbook();
            const sheetLabel = filterBulan === '' ? `Laporan ${tahun}` : `${MONTHS[filterBulan - 1]} ${tahun}`;
            const ws = wb.addWorksheet(sheetLabel, {
                views: [{ state: 'frozen', ySplit: 4 }],
            });

            const totalCols = 2 + displayMonths.length + 1;
            ws.columns = [
                { width: 5 },
                { width: 32 },
                ...displayMonths.map(() => ({ width: 13 })),
                { width: 16 },
            ];

            ws.mergeCells(1, 1, 1, totalCols);
            ws.getCell(1, 1).value = 'LAPORAN SIMPAN PINJAM';
            ws.mergeCells(2, 1, 2, totalCols);
            ws.getCell(2, 1).value = `KOPERASI KESEJAHTERAAN UNIVERSITAS${unitFilter ? ' — ' + unitFilter : ''}`;
            ws.mergeCells(3, 1, 3, totalCols);
            ws.getCell(3, 1).value = filterBulan === '' ? `TAHUN ${tahun}` : `${MONTHS_FULL[filterBulan - 1]} ${tahun}`;
            for (let r = 1; r <= 3; r++) {
                const cell = ws.getCell(r, 1);
                cell.font = { bold: true, size: r === 1 ? 14 : 11 };
                cell.alignment = { horizontal: 'left' };
            }
            ws.addRow([]);

            for (const section of displaySections) {
                const titleRow = ws.addRow([section.title]);
                ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
                titleRow.getCell(1).font = { bold: true, size: 12 };
                titleRow.getCell(1).fill = SECTION_FILL;
                for (let c = 1; c <= totalCols; c++) {
                    titleRow.getCell(c).fill = SECTION_FILL;
                }

                const headerRow = ws.addRow(['No.', section.rowLabelHeader, ...displayMonths, 'Total']);
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = HEADER_FILL;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = THIN_BORDER;
                });

                section.rows.forEach((row, i) => {
                    const dataRow = ws.addRow([i + 1, row.label, ...row.monthly, row.total]);
                    dataRow.eachCell((cell, colNumber) => {
                        cell.border = THIN_BORDER;
                        if (colNumber >= 3) {
                            cell.numFmt = NUMBER_FORMAT;
                            cell.alignment = { horizontal: 'right' };
                        }
                    });
                    dataRow.getCell(totalCols).font = { bold: true };
                });

                const jumlahPerBulan = displayMonths.map((_, i) => section.rows.reduce((s, r) => s + r.monthly[i], 0));
                const jumlahRow = ws.addRow(['', 'Jumlah', ...jumlahPerBulan, section.grandTotal]);
                jumlahRow.eachCell((cell, colNumber) => {
                    cell.font = { bold: true };
                    cell.border = { ...THIN_BORDER, top: { style: 'double', color: { argb: 'FF9CA3AF' } } };
                    if (colNumber >= 3) {
                        cell.numFmt = NUMBER_FORMAT;
                        cell.alignment = { horizontal: 'right' };
                    }
                });

                ws.addRow([]);
            }

            const summaryTitle = ws.addRow(['RINGKASAN']);
            summaryTitle.getCell(1).font = { bold: true, size: 12 };

            const addSummaryRow = (label: string, value: number, color?: string) => {
                const row = ws.addRow([label, value]);
                row.getCell(1).font = { bold: true };
                row.getCell(2).font = { bold: true, color: color ? { argb: color } : undefined };
                row.getCell(2).numFmt = NUMBER_FORMAT;
                row.getCell(2).alignment = { horizontal: 'right' };
            };
            addSummaryRow('Total Pemasukan', totalPemasukan, 'FF1F7A54');
            addSummaryRow('Total Pengeluaran', totalPengeluaran, 'FFDC2626');
            addSummaryRow('Saldo', totalPemasukan - totalPengeluaran);

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Laporan_Koperasi_${tahun}${filterBulan === '' ? '' : '_' + MONTHS_FULL[filterBulan - 1]}${unitFilter ? '_' + unitFilter.replace(/\s+/g, '_') : ''}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Gagal membuat file Excel.');
        } finally {
            setExporting(false);
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Laporan Rekapitulasi Lengkap</h1>
                    <p className="text-gray-500 mt-1">Simpanan, pinjaman, operasional, dan lainnya — per unit kerja &amp; per anggota</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <select className={selectClass} value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                        <option value={2028}>2028</option>
                    </select>
                    <select className={selectClass} value={filterBulan} onChange={(e) => setFilterBulan(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">Semua Bulan</option>
                        {MONTHS_FULL.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                        ))}
                    </select>
                    <select className={selectClass} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                        <option value="">Semua Unit Kerja</option>
                        {units.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={exportToExcel}
                        disabled={loading || exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export ke Excel
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" /> Memuat laporan...
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-5">
                            <p className="text-sm text-gray-500">Total Pemasukan</p>
                            <p className="text-xl font-bold text-emerald-600 mt-1">{formatIDR(totalPemasukan)}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-5">
                            <p className="text-sm text-gray-500">Total Pengeluaran</p>
                            <p className="text-xl font-bold text-rose-600 mt-1">{formatIDR(totalPengeluaran)}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-5">
                            <p className="text-sm text-gray-500">Saldo</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{formatIDR(totalPemasukan - totalPengeluaran)}</p>
                        </div>
                    </div>

                    {displaySections.map((section) => (
                        <div key={section.title} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                <h2 className="text-base font-bold text-gray-900">{section.title}</h2>
                                <span className="text-sm font-medium text-gray-700">Total: {formatIDR(section.grandTotal)}</span>
                            </div>
                            {section.rows.length === 0 ? (
                                <p className="px-6 py-6 text-sm text-gray-400">Tidak ada data</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-2 font-medium text-gray-500">{section.rowLabelHeader}</th>
                                                {displayMonths.map((m) => <th key={m} className="px-3 py-2 font-medium text-gray-500 text-right">{m}</th>)}
                                                <th className="px-4 py-2 font-medium text-gray-500 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {section.rows.map((row) => (
                                                <tr key={row.label}>
                                                    <td className="px-4 py-2 text-gray-900">{row.label}</td>
                                                    {row.monthly.map((v, i) => (
                                                        <td key={i} className="px-3 py-2 text-right text-gray-600">{v ? formatIDR(v) : '-'}</td>
                                                    ))}
                                                    <td className="px-4 py-2 text-right font-medium text-gray-900">{formatIDR(row.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}