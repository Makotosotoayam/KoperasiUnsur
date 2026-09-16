export const JENIS_SIMPANAN_LABELS: Record<string, string> = {
    pokok: 'Pokok',
    wajib: 'Wajib',
    sukarela: 'Sukarela',
    khusus: 'Khusus',
};

export const KATEGORI_KAS_LABELS: Record<string, string> = {
    ujroh_pinjaman: 'Ujroh Pinjaman',
    jasa_pinjaman: 'Jasa Pinjaman',
    asuransi_pinjaman: 'Asuransi Pinjaman',
    belanja_barang: 'Belanja Barang',
    honor_karyawan: 'Honor Karyawan',
    pinjaman_anggota: 'Pinjaman Anggota',
    lainnya: 'Lainnya',
};

export const STATUS_PINJAMAN_LABELS: Record<string, string> = {
    aktif: 'Aktif',
    lunas: 'Lunas',
};

export function formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}
