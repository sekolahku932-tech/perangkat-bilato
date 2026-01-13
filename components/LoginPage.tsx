import React, { useState } from 'react';
import { School, Lock, User as UserIcon, LogIn, AlertCircle, Loader2, Database, CheckCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, doc, setDoc, getDoc, signOut } from '../services/firebase';

interface LoginPageProps {
  school: string;
  onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ school, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const getSchoolSlug = (name: string) => {
    const match = name.match(/(\d+)/);
    return match ? `sdn${match[0]}` : 'admin';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Username dan Password wajib diisi.');
      setLoading(false);
      return;
    }

    const slug = getSchoolSlug(school);
    // Format email unik per sekolah: username.sdnX@bilato.sch.id
    const email = `${cleanUsername}.${slug}@bilato.sch.id`;
    
    /**
     * FIREBASE AUTH REQUIREMENT: Password must be at least 6 characters.
     * We internally pad "admin" to "adminadmin" to satisfy this.
     */
    let finalAuthPassword = cleanPassword;
    if (cleanUsername === 'admin' && cleanPassword === 'admin') {
      finalAuthPassword = 'adminadmin'; 
    } else if (finalAuthPassword.length < 6) {
      finalAuthPassword = finalAuthPassword.padEnd(6, '0'); // Safety pad for other weak passwords
    }
    
    try {
      // 1. Coba Login Terlebih Dahulu
      const userCredential = await signInWithEmailAndPassword(auth, email, finalAuthPassword);
      
      // 2. Verifikasi/Refresh Data Firestore
      const userSnap = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Validasi kepemilikan sekolah (mencegah login lintas tenant)
        if (userData.school !== school) {
          await signOut(auth);
          setError(`Akses ditolak. Akun ini terdaftar di ${userData.school}.`);
          setLoading(false);
          return;
        }
      } else if (cleanUsername === 'admin') {
        // Kasus langka: Auth ada tapi profil Firestore hilang
        await setDoc(doc(db, "users", userCredential.user.uid), {
          username: 'admin',
          role: 'admin',
          name: `Administrator ${school}`,
          school: school,
          nip: '-',
          kelas: '-',
          teacherType: 'kelas',
          mapelDiampu: []
        });
      }

      setSuccess('Masuk Berhasil! Mempersiapkan sistem...');
    } catch (err: any) {
      console.warn("Auth Attempt Info:", err.code);

      // 3. LOGIKA OTOMATIS: Jika login gagal karena user tidak ada DAN inputnya admin/admin
      if ((err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') && 
          cleanUsername === 'admin' && cleanPassword === 'admin') {
        try {
          // Buat akun baru secara otomatis
          const newUser = await createUserWithEmailAndPassword(auth, email, finalAuthPassword);
          
          await setDoc(doc(db, "users", newUser.user.uid), {
            username: 'admin',
            role: 'admin',
            name: `Administrator ${school}`,
            school: school,
            nip: '-',
            kelas: '-',
            teacherType: 'kelas',
            mapelDiampu: []
          });
          
          setSuccess(`Inisialisasi admin ${school} berhasil!`);
        } catch (createErr: any) {
          console.error("Auto Creation Error:", createErr);
          setError('Gagal inisialisasi akun admin: ' + createErr.message);
        }
      } else {
        // Pesan error standar
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Password salah. Harap periksa kembali.');
        } else if (err.code === 'auth/user-not-found') {
          setError('Pengguna tidak ditemukan di database sekolah ini.');
        } else {
          setError('Gagal masuk: ' + (err.message || 'Kendala jaringan'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden text-slate-900">
      <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
        <School size={500} className="text-indigo-600" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} /> Ganti Sekolah
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-5 bg-indigo-600 text-white rounded-3xl shadow-2xl mb-6 animate-in zoom-in duration-700">
            <School size={48} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-tight">{school}</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Sistem Kurikulum Terpadu</p>
        </div>

        <div className="bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-8 duration-700">
          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Login Portal</h2>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">
                <Database size={10} /> Cloud Sync
              </div>
            </div>
            
            {error && (
              <div className="mb-6 p-4 rounded-2xl flex items-start gap-3 bg-red-50 border border-red-100 text-red-600 animate-in shake duration-500">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-600 animate-in fade-in">
                <CheckCircle size={20} className="shrink-0" />
                <p className="text-sm font-bold">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon size={18} />
                  </div>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all placeholder:text-slate-300"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all placeholder:text-slate-300"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-3xl shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 text-xs tracking-widest uppercase"
              >
                {loading ? <Loader2 size={18} className="animate-spin"/> : <LogIn size={18} />}
                {loading ? 'MEMVALIDASI...' : 'MASUK KE SISTEM'}
              </button>
            </form>
          </div>
          
          <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
              Bilato Unified Node v2.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;