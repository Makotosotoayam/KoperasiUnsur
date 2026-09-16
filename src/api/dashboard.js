import { createClient } from '@supabase/supabase-client';

// Inisialisasi koneksi ke Supabase secara aman di sisi server Vercel
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Mengambil parameter tahun dari URL panggilan dashboard (misal: 2026)
  const { tahun } = req.query;

  if (!tahun) {
    return res.status(400).json({ success: false, error: 'Parameter tahun wajib diisi' });
  }

  try {
    // 1. Ambil data simpanan pokok dari Supabase sesuai tahun yang dipilih
    const { data: dataSimpanan, error: errSimpanan } = await supabase
      .from('simpanan_pokok') 
      .select('jumlah, bulan')
      .eq('tahun', parseInt(tahun));

    if (errSimpanan) throw errSimpanan;

    // 2. Hitung total seluruh simpanan untuk kartu ringkasan
    let totalSimpanan = 0;
    
    // Siapkan struktur data grafik bulanan (Januari - Desember)
    // Nama bulan disingkat agar pas dan rapi di grafik batangnya
    const listNamaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthlyDataMap = Array.from({ length: 12 }, (_, i) => ({
      name: listNamaBulan[i],
      simpanan: 0,
      pinjaman: 0,
      pengeluaran: 0
    }));

    // Isikan data nominal dari database ke peta bulan yang sesuai
    dataSimpanan?.forEach(item => {
      const nominal = parseFloat(item.jumlah) || 0;
      totalSimpanan += nominal;

      // Karena kolom bulan Anda berisi angka murni (1 sampai 12),
      // kita kurangi 1 agar cocok dengan indeks array JavaScript (0 sampai 11)
      const bulanIdx = parseInt(item.bulan) - 1; 
      if (bulanIdx >= 0 && bulanIdx < 12) {
        monthlyDataMap[bulanIdx].simpanan += nominal;
      }
    });

    // 3. Kirimkan paket data hasil kalkulasi yang sudah bersih ke komponen React
    return res.status(200).json({
      success: true,
      summary: {
        totalSimpanan: totalSimpanan,
        totalPinjaman: 0, // Sementara 0, nanti bisa ditambahkan dari tabel pinjaman
        totalPengeluaran: 0
      },
      monthlyData: monthlyDataMap,
      unitSummary: {} // Sementara kosong, nanti dihubungkan dengan tabel anggota & unit_kerja
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
