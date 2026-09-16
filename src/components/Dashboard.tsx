import { useEffect, useState, type ComponentType } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area,
} from 'recharts';
import { Wallet, CreditCard, Receipt, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatIDR } from '../utils';
import { supabase } from '../supabaseClient';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

interface MonthlyRow {
    name: string;
    simpanan: number;
    pinjaman: number;
    pengeluaran: number;
}

interface Summary {
    totalSimpanan: number;
    totalPinjaman: number;
    totalPengeluaran: number;
}

interface StatCardProps {
    title: string;
    amount: number;
    icon: ComponentType<{ className?: string }>;
    colorClass: string;
    trend: 'up' | 'down' | 'neutral';
    trendValue: string;
}

function StatCard({ title, amount, icon: Icon, colorClass, trend, trendValue }: StatCardProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{formatIDR(amount)}</h3>
                </div>
                <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
                {trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                ) : trend === 'down' ? (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                ) : (
                    <Minus className="w-4 h-4 text-gray-500 mr-1" />
                )}
                <span className={trend === 'up' ? 'text-emerald-600 font-medium' : trend === 'down' ? 'text-red-600 font-medium' : 'text-gray-600 font-medium'}>
                    {trendValue}
                </span>
                <span className="text-gray-500 ml-1">dari tahun lalu</span>
            </div>
        </div>
    );
}

export function Dashboard() {
    const [year, setYear] = useState(2025);
    const [monthlyData, setMonthlyData] = useState<MonthlyRow[] | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                const { data: rows, error: err } = await supabase
                    .from('transaksi_potongan')
                    .select('bulan, simwa, sukarela, pokok, jasa, barang')
                    .eq('tahun', year)
                    .range(0, 9999);

                if (err) throw err;

                const monthly: MonthlyRow[] = MONTH_NAMES.map((name) => ({
                    name, simpanan: 0, pinjaman: 0, pengeluaran: 0,
                }));

                for (const row of rows ?? []) {
                    const idx = row.bulan - 1;
                    if (idx < 0 || idx > 11) continue;
                    monthly[idx].simpanan += (Number(row.simwa) || 0) + (Number(row.sukarela) || 0);
                    monthly[idx].pinjaman += (Number(row.pokok) || 0) + (Number(row.jasa) || 0);
                    monthly[idx].pengeluaran += Number(row.barang) || 0;
                }

                const totals = monthly.reduce(
                    (acc, m) => ({
                        totalSimpanan: acc.totalSimpanan + m.simpanan,
                        totalPinjaman: acc.totalPinjaman + m.pinjaman,
                        totalPengeluaran: acc.totalPengeluaran + m.pengeluaran,
                    }),
                    { totalSimpanan: 0, totalPinjaman: 0, totalPengeluaran: 0 }
                );

                setMonthlyData(monthly);
                setSummary(totals);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [year]);

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <p className="text-gray-500">Memuat data dari Supabase...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard Akumulasi {year}</h1>
                    <p className="text-gray-500 mt-1">Ringkasan transaksi Koperasi Kesejahteraan Universitas tahun {year}</p>
                    <p className="text-xs text-emerald-600 mt-2">
                        Data live dari Supabase
                    </p>
                </div>
                <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value={2025}>Tahun 2025</option>
                    <option value={2026}>Tahun 2026</option>
                    <option value={2027}>Tahun 2027</option>
                    <option value={2028}>Tahun 2028</option>
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title={`Total Simpanan (${year})`}
                    amount={summary.totalSimpanan}
                    icon={Wallet}
                    colorClass="bg-blue-500 text-blue-600"
                    trend="up"
                    trendValue="+12.5%"
                />
                <StatCard
                    title={`Total Pinjaman (${year})`}
                    amount={summary.totalPinjaman}
                    icon={CreditCard}
                    colorClass="bg-amber-500 text-amber-600"
                    trend="up"
                    trendValue="+5.2%"
                />
                <StatCard
                    title={`Total Pengeluaran (${year})`}
                    amount={summary.totalPengeluaran}
                    icon={Receipt}
                    colorClass="bg-rose-500 text-rose-600"
                    trend="down"
                    trendValue="-2.1%"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Perbandingan Simpanan & Pinjaman</h2>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6b7280' }}
                                    tickFormatter={(value) => `${(value / 1000000)}M`}
                                />
                                <Tooltip
                                    formatter={(value) => formatIDR(Number(value))}
                                    cursor={{ fill: '#f3f4f6' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="simpanan" name="Simpanan" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="pinjaman" name="Pinjaman" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Tren Pengeluaran Koperasi</h2>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6b7280' }}
                                    tickFormatter={(value) => `${(value / 1000000)}M`}
                                />
                                <Tooltip
                                    formatter={(value) => formatIDR(Number(value))}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Area
                                    type="monotone"
                                    dataKey="pengeluaran"
                                    name="Pengeluaran"
                                    stroke="#f43f5e"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorPengeluaran)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-6">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-900">Rincian Akumulasi Bulanan {year}</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bulan</th>
                                <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Simpanan</th>
                                <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Pinjaman</th>
                                <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Pengeluaran</th>
                                <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Saldo Bersih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {monthlyData.map((row, idx) => {
                                const netBalance = row.simpanan - row.pinjaman - row.pengeluaran;
                                return (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-6 whitespace-nowrap text-sm font-medium text-gray-900">{row.name} {year}</td>
                                        <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-600 text-right">{formatIDR(row.simpanan)}</td>
                                        <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-600 text-right">{formatIDR(row.pinjaman)}</td>
                                        <td className="py-3 px-6 whitespace-nowrap text-sm text-gray-600 text-right">{formatIDR(row.pengeluaran)}</td>
                                        <td className={`py-3 px-6 whitespace-nowrap text-sm font-medium text-right ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {netBalance >= 0 ? '+' : ''}{formatIDR(netBalance)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200">
                            <tr>
                                <td className="py-4 px-6 text-sm text-gray-900">Total {year}</td>
                                <td className="py-4 px-6 text-sm text-blue-600 text-right">{formatIDR(summary.totalSimpanan)}</td>
                                <td className="py-4 px-6 text-sm text-amber-600 text-right">{formatIDR(summary.totalPinjaman)}</td>
                                <td className="py-4 px-6 text-sm text-rose-600 text-right">{formatIDR(summary.totalPengeluaran)}</td>
                                <td className="py-4 px-6 text-sm text-emerald-600 text-right">
                                    {formatIDR(summary.totalSimpanan - summary.totalPinjaman - summary.totalPengeluaran)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}