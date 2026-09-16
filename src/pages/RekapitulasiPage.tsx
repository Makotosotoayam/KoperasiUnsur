import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface RekapBulan {
  bulan: number;
  total_simwa: number;
  total_sukarela: number;
  total_pokok: number;
  total_jasa: number;
  total_barang: number;
  total_jumlah: number;
}

interface Summary {
  tahun: number;
  totalAnggota: number;
  totalBayaran: number;
  simpananWajib: number;
  simpananSukarela: number;
  simpananPokok: number;
  totalJasa: number;
  totalBarang: number;
}

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export function RekapitulasiPage() {
  const [tahun, setTahun] = useState(2025);
  const [rekapPerBulan, setRekapPerBulan] = useState<RekapBulan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: rows, error: err } = await supabase
        .from('transaksi_potongan')
        .select('bulan, id_anggota, simwa, sukarela, pokok, jasa, barang')
        .eq('tahun', tahun)
        .range(0, 9999);

      if (err) throw err;

      const perBulan: RekapBulan[] = Array.from({ length: 12 }, (_, i) => ({
        bulan: i + 1,
        total_simwa: 0,
        total_sukarela: 0,
        total_pokok: 0,
        total_jasa: 0,
        total_barang: 0,
        total_jumlah: 0,
      }));

      const anggotaSet = new Set<number>();

      for (const row of rows ?? []) {
        const idx = row.bulan - 1;
        if (idx < 0 || idx > 11) continue;
        const simwa = Number(row.simwa) || 0;
        const sukarela = Number(row.sukarela) || 0;
        const pokok = Number(row.pokok) || 0;
        const jasa = Number(row.jasa) || 0;
        const barang = Number(row.barang) || 0;

        perBulan[idx].total_simwa += simwa;
        perBulan[idx].total_sukarela += sukarela;
        perBulan[idx].total_pokok += pokok;
        perBulan[idx].total_jasa += jasa;
        perBulan[idx].total_barang += barang;
        perBulan[idx].total_jumlah += simwa + sukarela + pokok + jasa + barang;

        anggotaSet.add(row.id_anggota);
      }

      const totals = perBulan.reduce(
        (acc, m) => ({
          simpananWajib: acc.simpananWajib + m.total_simwa,
          simpananSukarela: acc.simpananSukarela + m.total_sukarela,
          simpananPokok: acc.simpananPokok + m.total_pokok,
          totalJasa: acc.totalJasa + m.total_jasa,
          totalBarang: acc.totalBarang + m.total_barang,
          totalBayaran: acc.totalBayaran + m.total_jumlah,
        }),
        { simpananWajib: 0, simpananSukarela: 0, simpananPokok: 0, totalJasa: 0, totalBarang: 0, totalBayaran: 0 }
      );

      setRekapPerBulan(perBulan.filter((m) => rows?.some((r) => r.bulan === m.bulan)));
      setSummary({ tahun, totalAnggota: anggotaSet.size, ...totals });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = rekapPerBulan.map((item) => ({
    bulan: MONTH_NAMES[item.bulan],
    'Simpanan Wajib': Number(item.total_simwa),
    'Simpanan Sukarela': Number(item.total_sukarela),
    'Simpanan Pokok': Number(item.total_pokok),
  }));

  const summaryData = summary ? [
    { name: 'Simpanan Wajib', value: Number(summary.simpananWajib) },
    { name: 'Simpanan Sukarela', value: Number(summary.simpananSukarela) },
    { name: 'Simpanan Pokok', value: Number(summary.simpananPokok) },
    { name: 'Jasa', value: Number(summary.totalJasa) },
    { name: 'Barang', value: Number(summary.totalBarang) },
  ].filter((d) => d.value > 0) : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Rekapitulasi Koperasi</h1>
        <p className="text-gray-600">Ringkasan data simpanan dan transaksi</p>
      </div>

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
        <button
          onClick={loadData}
          className="self-end px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Memuat data...</p>
        </div>
      ) : summary && rekapPerBulan.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Anggota Aktif (Transaksi)</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{summary.totalAnggota}</p>
                </div>
                <Users className="w-10 h-10 text-emerald-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Simpanan Wajib</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {formatCurrency(summary.simpananWajib).split(',')[0]}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-blue-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Simpanan Sukarela</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {formatCurrency(summary.simpananSukarela).split(',')[0]}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-amber-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Seluruh Potongan</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {formatCurrency(summary.totalBayaran).split(',')[0]}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-emerald-600 opacity-20" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Simpanan per Bulan</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bulan" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="Simpanan Wajib" fill="#10b981" />
                  <Bar dataKey="Simpanan Sukarela" fill="#3b82f6" />
                  <Bar dataKey="Simpanan Pokok" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Komposisi Total</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={summaryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {summaryData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trend Penerimaan Kumulatif</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bulan" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="Simpanan Wajib" stroke="#10b981" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Simpanan Sukarela" stroke="#3b82f6" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Rincian per Bulan</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bulan</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Simpanan Wajib</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Simpanan Sukarela</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pokok Pinjaman</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rekapPerBulan.map((item) => (
                    <tr key={item.bulan} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{MONTH_NAMES[item.bulan]}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(Number(item.total_simwa))}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(Number(item.total_sukarela))}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(Number(item.total_pokok))}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-right text-emerald-600">{formatCurrency(Number(item.total_jumlah))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">Belum ada data untuk tahun ini</div>
      )}
    </div>
  );
}