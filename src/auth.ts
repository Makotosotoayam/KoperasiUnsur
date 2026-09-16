import { supabase } from './supabaseClient';

const AUTH_KEY = 'sikesra_authenticated';

// Fungsi untuk mengecek status login
export function isAuthenticated(): boolean {
    const authStatus = localStorage.getItem(AUTH_KEY);
    return authStatus === 'true';
}

// Login: cek password langsung ke tabel status_auth di Supabase
export async function login(password: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('status_auth')
            .select('password_hash')
            .eq('id', 1)
            .single();

        if (error || !data) {
            console.error('Login error:', error);
            return false;
        }

        if (password === data.password_hash) {
            localStorage.setItem(AUTH_KEY, 'true');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Login error:', error);
        return false;
    }
}

// Ganti password: verifikasi password lama, lalu update ke password baru
export async function changePassword(
    currentPassword: string,
    newPassword: string
): Promise<{ success: boolean; message: string }> {
    try {
        const { data, error } = await supabase
            .from('status_auth')
            .select('password_hash')
            .eq('id', 1)
            .single();

        if (error || !data) {
            return { success: false, message: 'Gagal memuat data akun.' };
        }

        if (currentPassword !== data.password_hash) {
            return { success: false, message: 'Password saat ini salah.' };
        }

        const { error: updateError } = await supabase
            .from('status_auth')
            .update({ password_hash: newPassword })
            .eq('id', 1);

        if (updateError) {
            console.error('Update password error:', updateError);
            return { success: false, message: 'Gagal menyimpan password baru. Periksa izin akses (RLS) tabel status_auth.' };
        }

        return { success: true, message: 'Password berhasil diubah.' };
    } catch (err) {
        console.error('Change password error:', err);
        return { success: false, message: 'Terjadi kesalahan server.' };
    }
}

// WAJIB ADA: Fungsi logout yang dicari oleh Sidebar.tsx
export function logout(): void {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = '/login';
}