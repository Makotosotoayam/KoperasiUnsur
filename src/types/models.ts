export interface Fakultas {
    id_fakultas: number;
    nama_fakultas: string;
    singkatan: string | null;
}

export interface Jabatan {
    id_jabatan: number;
    nama_jabatan: string;
}

export interface AnggotaOption {
    id_anggota: number;
    no_anggota: string;
    nama_lengkap: string;
}

export interface Anggota {
    id_anggota: number;
    no_anggota: string;
    nama_lengkap: string;
    jenis_kelamin: 'Laki-laki' | 'Perempuan' | null;
    id_fakultas: number | null;
    id_jabatan: number | null;
    status_aktif: boolean;
    tanggal_masuk: string | null;
    fakultas?: Fakultas | null;
    jabatan?: Jabatan | null;
}

export interface Simpanan {
    id_simpanan: number;
    id_anggota: number;
    jenis_simpanan: 'pokok' | 'wajib' | 'sukarela' | 'khusus';
    jumlah: string | number;
    tanggal: string;
    keterangan: string | null;
    anggota?: AnggotaOption;
}

export interface Pinjaman {
    id_pinjaman: number;
    id_anggota: number;
    jumlah_pinjaman: string | number;
    ujroh_pinjaman: string | number;
    jasa_pinjaman: string | number;
    asuransi_pinjaman: string | number;
    total_kewajiban: string | number;
    sisa_kewajiban: string | number;
    lama_cicilan: number;
    tanggal_pencairan: string;
    status: 'aktif' | 'lunas';
    anggota?: AnggotaOption;
}

export interface KasKoperasi {
    id_kas: number;
    tipe: 'pemasukan' | 'pengeluaran';
    kategori: string;
    nominal: string | number;
    tanggal: string;
    keterangan: string | null;
    id_referensi: number | null;
}

export interface AppOptions {
    fakultas: Fakultas[];
    jabatan: Jabatan[];
    anggota: AnggotaOption[];
}

export interface AuthUser {
    name: string;
    email: string;
}

export interface DashboardData {
    monthlyData: Array<{ name: string; simpanan: number; pinjaman: number; pengeluaran: number }>;
    summary: { totalSimpanan: number; totalPinjaman: number; totalPengeluaran: number };
}
