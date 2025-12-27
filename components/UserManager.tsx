
import React, { useState, useEffect, useMemo } from 'react';
import { User, Role, TeacherType, MATA_PELAJARAN } from '../types';
import { 
  Trash2, Edit2, Save, X, Users, Shield, UserCheck, BookOpen, 
  Building2, AlertTriangle, Loader2, Cloud, Home, Briefcase, 
  Search, CheckSquare, Square, Filter, Info, Key, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { db, auth, collection, onSnapshot, doc, setDoc, deleteDoc, createUserWithEmailAndPassword } from '../services/firebase';

interface UserManagerProps {
  user: User;
}

const UserManager: React.FC<UserManagerProps> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showKey, setShowKey] = useState(false);
  
  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    role: 'guru',
    teacherType: 'kelas',
    name: '',
    nip: '',
    kelas: '',
    mapelDiampu: [],
    apiKey: ''
  });
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const userList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
      setUsers(userList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.nip?.includes(searchTerm)
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users, searchTerm]);

  const handleSave = async () => {
    const cleanUsername = formData.username?.trim().toLowerCase();
    const cleanPassword = formData.password?.trim();
    const cleanName = formData.name?.trim();

    if (!cleanUsername || !cleanName || (!isEditing && !cleanPassword)) {
      alert('Username, Password, dan Nama Lengkap wajib diisi!');
      return;
    }

    setIsSaving(true);
    try {
      const userEmail = `${cleanUsername}@sdn5bilato.sch.id`;
      let userPwd = cleanPassword || '';
      if (!isEditing && userPwd.length < 6) userPwd = userPwd + userPwd;

      const userPayload = {
        username: cleanUsername,
        role: formData.role || 'guru',
        teacherType: formData.teacherType || 'kelas',
        name: cleanName,
        nip: formData.nip?.trim() || '-',
        kelas: formData.kelas?.trim() || '-',
        mapelDiampu: formData.mapelDiampu || [],
        apiKey: formData.apiKey?.trim() || ''
      };

      if (isEditing) {
        await setDoc(doc(db, "users", isEditing), userPayload, { merge: true });
        setIsEditing(null);
        alert('Data profil dan API Key berhasil diperbarui!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, userEmail, userPwd);
        const firebaseUid = userCredential.user.uid;
        await setDoc(doc(db, "users", firebaseUid), userPayload);
        alert(`User @${cleanUsername} berhasil didaftarkan ke sistem!`);
      }
      resetForm();
    } catch (error: any) {
      console.error(error);
      alert('Gagal menyimpan: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      role: 'guru',
      teacherType: 'kelas',
      name: '',
      nip: '',
      kelas: '',
      mapelDiampu: [],
      apiKey: ''
    });
    setIsEditing(null);
    setShowKey(false);
  };

  const startEdit = (u: User) => {
    setIsEditing(u.id);
    setFormData({
      ...u,
      password: 'PASSWORD_HIDDEN',
      teacherType: u.teacherType || 'kelas',
      mapelDiampu: u.mapelDiampu || [],
      apiKey: u.apiKey || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleMapel = (m: string) => {
    const current = formData.mapelDiampu || [];
    if (current.includes(m)) {
      setFormData({ ...formData, mapelDiampu: current.filter(item => item !== m) });
    } else {
      setFormData({ ...formData, mapelDiampu: [...current, m] });
    }
  };

  const executeDeleteUser = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "users", deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (e) {
      alert('Gagal menghapus data.');
    }
  };

  if (loading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 size={48} className="animate-spin text-blue-600" />
        <p className="font-black text-xs uppercase tracking-widest">Sinkronisasi Database User...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus Pengguna</h3>
              <p className="text-slate-500 font-medium text-sm">Hapus data profil dari database Cloud?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={executeDeleteUser} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden sticky top-24">
            <div className={`p-6 border-b border-slate-100 flex items-center justify-between transition-colors ${isEditing ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isEditing ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  {isEditing ? <Edit2 size={20} /> : <UserCheck size={20} />}
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">
                  {isEditing ? 'Edit Profil Guru' : 'Daftarkan Guru Baru'}
                </h3>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Akses Data</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setFormData({...formData, teacherType: 'kelas'})} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all border ${formData.teacherType === 'kelas' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    <Home size={14} /> KELAS
                  </button>
                  <button onClick={() => setFormData({...formData, teacherType: 'mapel'})} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all border ${formData.teacherType === 'mapel' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    <Briefcase size={14} /> MAPEL
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Username</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none" value={formData.username} disabled={!!isEditing} onChange={e => setFormData({...formData, username: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
                  <input type="password" className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none" value={isEditing ? '********' : formData.password} disabled={!!isEditing} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Nama Lengkap</label>
                <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none uppercase" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">
                  <Key size={14}/> Gemini API Key (Kustom)
                </label>
                <div className="relative">
                  <input 
                    type={showKey ? "text" : "password"}
                    className="w-full border border-indigo-200 rounded-xl py-3 pl-4 pr-12 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="AIzaSyB..."
                    value={formData.apiKey}
                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                  />
                  <button 
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600 transition-colors"
                  >
                    {showKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
                <p className="text-[9px] text-indigo-400 italic px-1">*Kosongkan jika ingin menggunakan kunci utama sekolah.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">NIP</label>
                  <input className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Penempatan</label>
                  <select className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none bg-white" value={formData.kelas || ''} onChange={e => setFormData({...formData, kelas: e.target.value})}>
                    <option value="">-- KELAS --</option>
                    {['1','2','3','4','5','6','Multikelas','-'].map(k => <option key={k} value={k}>{k === '-' ? 'Non-Kelas' : `Kelas ${k}`}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Mapel Diampu</label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {MATA_PELAJARAN.map(m => {
                    const isChecked = (formData.mapelDiampu || []).includes(m);
                    return (
                      <button key={m} onClick={() => toggleMapel(m)} className={`flex items-center gap-3 p-3 rounded-xl border text-[11px] font-bold transition-all text-left ${isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        <span className="truncate">{m}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button onClick={handleSave} disabled={isSaving} className={`flex-1 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest ${isEditing ? 'bg-amber-600' : 'bg-blue-600'}`}>
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isEditing ? 'UPDATE PROFIL' : 'SIMPAN USER'}
                </button>
                {isEditing && (
                  <button onClick={resetForm} className="bg-slate-100 text-slate-600 p-4 rounded-xl transition-all"><X size={18} /></button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Users size={20} /></div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Daftar Guru ({filteredUsers.length})</h3>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold w-full md:w-64 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Cari Guru..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">Profil & NIP</th>
                    <th className="px-6 py-4">Tipe & Kelas</th>
                    <th className="px-6 py-4">Status API Key</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={`group transition-all ${isEditing === u.id ? 'bg-amber-50' : 'hover:bg-slate-50/30'}`}>
                      <td className="px-6 py-4">
                        <div className="font-black text-sm uppercase text-slate-900">{u.name}</div>
                        <div className="text-[10px] text-slate-400">@{u.username} • NIP: {u.nip}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase ${u.role === 'admin' ? 'text-rose-600' : 'text-blue-600'}`}>
                          {u.role} | Kelas {u.kelas}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {u.apiKey ? (
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase">
                            <CheckCircle2 size={12}/> Kustom Aktif
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-300 uppercase">
                            <Cloud size={12}/> Default Sekolah
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(u)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                          <button onClick={() => setDeleteConfirmId(u.id)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
             <Info size={20} className="text-indigo-600 mt-1 shrink-0" />
             <div className="space-y-1">
                <h4 className="text-xs font-black text-indigo-900 uppercase">Informasi Manajemen Kunci</h4>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  Untuk keamanan ekstra, <b>API Key Guru</b> disimpan terenkripsi di database Firestore. Hanya Admin yang dapat menambah atau merubah kunci tersebut. Guru yang tidak memiliki kunci kustom akan secara otomatis menggunakan kuota utama milik sekolah.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManager;
