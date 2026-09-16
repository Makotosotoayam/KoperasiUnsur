import { createClient } from '@supabase/supabase-client';

// Inisialisasi Supabase di sisi server Vercel
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Hanya menerima metode POST untuk keamanan
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  try {
    // Ambil password yang tersimpan di database Supabase
    const { data, error } = await supabase
      .from('status_auth')
      .select('password_hash')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return res.status(500).json({ error: 'Gagal memverifikasi database' });
    }

    // Cocokkan password yang diketik user dengan yang ada di database
    if (password === data.password_hash) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
