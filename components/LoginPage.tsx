
import React, { useState } from 'react';
import { School as SchoolIcon, Lock, User as UserIcon, LogIn, AlertCircle, Loader2, Database, CheckCircle, Code, ArrowLeft } from 'lucide-react';
import { auth, signInWithEmailAndPassword } from '../services/firebase';
import { LIST_SEKOLAH } from '../types';

const LoginPage: React.FC = () => {
  const [schoolId] = useState<string>(localStorage.getItem('selectedSchoolId') || '');
  const schoolName = LIST_SEKOLAH.find(s => s.id === schoolId)?.name || 'SD NEGERI BILATO';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{title: string, detail: string} | null>(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Email unik per sekolah: username@sdn5.bilato.sch.id
    let email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@${schoolId}.bilato.sch.id`;
    let pwd = cleanPassword.length < 6 ? cleanPassword + cleanPassword : cleanPassword;

    try {
      await signInWithEmailAndPassword(auth, email, pwd);
      setSuccess('Login Berhasil! Memuat data cloud...');
    } catch (err: any) {
      console.error("Login Error:", err.code);
      if (err.code === 'auth/configuration-not-found') {
        setError({
          title: 'Layanan Auth Belum Aktif',
          detail: 'Hubungi pengembang untuk mengaktifkan layanan autentikasi.'
        });
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError({
          title: 'Akses Ditolak',
          detail: `Username atau Password salah untuk ${schoolName}. Pastikan data yang dimasukkan benar.`
        });
      } else {
        setError({ title: 'Kesalahan Sistem', detail: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 animate-in zoom-in duration-500">
          <div className={`inline-flex items-center justify-center p-4 rounded-2xl text-white shadow-xl mb-4 ${
             schoolId === 'sdn1' ? 'bg-blue-600' :
             schoolId === 'sdn2' ? 'bg-indigo-600' :
             schoolId === 'sdn3' ? 'bg-violet-600' :
             schoolId === 'sdn4' ? 'bg-emerald-600' :
             schoolId === 'sdn5' ? 'bg-rose-600' :
             schoolId === 'sdn6' ? 'bg-amber-600' :
             schoolId === 'sdn7' ? 'bg-cyan-600' : 'bg-slate-600'
          }`}>
            <SchoolIcon size={48} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{schoolName}</h1>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.2em] mt-1">Sistem Perangkat Pembelajaran Cloud</p>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Login Guru</h2>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase">
                <Database size={10} /> {schoolId.toUpperCase()} DB
              </div>
            </div>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 animate-in shake duration-500">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase">{error.title}</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-80">{error.detail}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-600">
                <CheckCircle size={20} className="shrink-0" />
                <p className="text-xs font-bold">{success}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Username / NIP</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <UserIcon size={18} />
                  </div>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                    placeholder="USERNAME"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                    placeholder="PASSWORD"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:opacity-90 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 text-xs tracking-widest uppercase"
              >
                {loading ? <Loader2 size={18} className="animate-spin"/> : <LogIn size={18} />}
                {loading ? 'MEMPROSES...' : 'MASUK KE CLOUD'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Gunakan akun yang telah didaftarkan oleh Admin Sekolah.
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <Code size={12} /> Developed by Ariyanto Rahman
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
