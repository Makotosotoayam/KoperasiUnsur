import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Download } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface Transaksi {
  bulan: number;
  simwa: number;
  sukarela: number;
  pokok: number;
  jasa: number;
  barang: number;
  total_jumlah: number;
}

interface Anggota {
  id: number;
  no_kku: string;
  nama: string;
  no_registrasi?: string;
  transaksi_potongan: Transaksi[];
}

interface Unit {
  id: number;
  nama_unit: string;
  anggota: Anggota[];
}

export function AnggotaByFakultasPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [tahun]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/laporan/anggota-by-unit/${tahun}`);
      setUnits(res.data.units);
    } catch (err) {
      console.error('Gagal memuat data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnit = (unitId: number) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const filteredUnits = units.map((unit) => ({
    ...unit,
    anggota: unit.anggota.filter(
      (a) =>
        a.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.no_kku.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  }));

  const calculateTotal = (transaksi: Transaksi[]) => {
    return transaksi.reduce((sum, t) => sum + Number(t.total_jumlah), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const downloadCSV = () => {
    let csv = 'Fakultas,No KKU,Nama,Total Bayaran,Simpanan Wajib,Simpanan Sukarela,Simpanan Pokok\n';
    
    filteredUnits.forEach((unit) => {
      unit.anggota.forEach((anggota) => {
        const total = calculateTotal(anggota.transaksi_potongan);
        const simwa = anggota.transaksi_potongan.reduce((sum, t) => sum + Number(t.simwa), 0);
        const sukarela = anggota.transaksi_potongan.reduce((sum, t) => sum + Number(t.sukarela), 0);
        const pokok = anggota.transaksi_potongan.reduce((sum, t) => sum + Number(t.pokok), 0);
        
        csv += `"${unit.nama_unit}","${anggota.no_kku}","${anggota.nama}",${total},${simwa},${sukarela},${pokok}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anggota-by-fakultas-${tahun}.csv`;
    a.click();
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Anggota per Fakultas</h1>
        <p className="text-gray-600">Daftar anggota koperasi dikelompokkan per unit kerja</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
          <input
            type="number"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cari Anggota</label>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Nama atau No KKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Memuat data...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUnits.map((unit) => (
            <div key={unit.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Unit Header */}
              <button
                onClick={() => toggleUnit(unit.id)}
                className="w-full px-6 py-4 bg-emerald-50 hover:bg-emerald-100 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {expandedUnits.has(unit.id) ? (
                    <ChevronUp className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-emerald-600" />
                  )}
                  <h3 className="font-semibold text-gray-900">{unit.nama_unit}</h3>
                  <span className="text-sm text-gray-500">({unit.anggota.length} anggota)</span>
                </div>
              </button>

              {/* Unit Content */}
              {expandedUnits.has(unit.id) && (
                <div className="border-t border-gray-200">
                  {unit.anggota.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No KKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Simpanan Wajib</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Simpanan Sukarela</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.anggota.map((anggota) => {
                            const simwa = anggota.transaksi_potongan.reduce((sum, t) => sum + Number(t.simwa), 0);
                            const sukarela = anggota.transaksi_potongan.reduce((sum, t) => sum + Number(t.sukarela), 0);
                            const total = calculateTotal(anggota.transaksi_potongan);

                            return (
                              <tr key={anggota.id} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-mono text-gray-900">{anggota.no_kku}</td>
                                <td className="px-6 py-4 text-sm text-gray-900">{anggota.nama}</td>
                                <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(simwa)}</td>
                                <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(sukarela)}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-right text-emerald-600">{formatCurrency(total)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-500">
                      <p>Tidak ada anggota yang sesuai dengan pencarian</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filteredUnits.every((u) => u.anggota.length === 0) && (
            <div className="text-center py-12">
              <p className="text-gray-500">Tidak ada data untuk ditampilkan</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
