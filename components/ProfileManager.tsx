
import React, { useState } from 'react';
import { User } from '../types';
import { 
  Save, User as UserIcon, Loader2, Sparkles, 
  Info, ShieldCheck, CheckCircle2, Key, Eye, EyeOff 
} from 'lucide-react';
import { db, doc, updateDoc } from '../services/firebase';

interface ProfileManagerProps {
  user: User;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ user }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    nip: user.nip || '',
    apiKey: user.apiKey || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, "users", user.id), {
        name: formData.name.toUpperCase(),
        nip: formData.nip,
        apiKey: formData.apiKey.trim()
      });
      setMessage({ text: 'Profil & API Key Berhasil Diperbarui!', type: 'success' });
    } catch (error: any) {
      console.error(error);
      setMessage({ text: 'Gagal memperbarui profil: ' + error.message, type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="bg-white rounded-[48px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-100">
              <UserIcon size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Profil Pengguna</h2>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">Status: {user.role} - {user.school}</p>
            </div>
          </div>
          {message && (
            <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
              <span className="text-xs font-black uppercase tracking-tight">{message.text}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Informasi Dasar</h4>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Nama Lengkap</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 px-6 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">NIP / Identitas Pegawai</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.nip}
                  onChange={e => setFormData({...formData, nip: e.target.value})}
                  placeholder="-"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <div className="w-1.5 h-6 bg-amber-600 rounded-full"></div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Pengaturan AI Gemini</h4>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-2">
                  <Key size={12} className="text-amber-600"/> Gemini API Key Personal
                </label>
                <div className="relative">
                  <input 
                    type={showKey ? "text" : "password"}
                    className="w-full bg-amber-50 border border-amber-200 rounded-3xl py-4 pl-6 pr-14 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    value={formData.apiKey}
                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                    placeholder="AIzaSy..."
                  />
                  <button 
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                  >
                    {showKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
                <div className="mt-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3">
                  <Info size={18} className="text-indigo-600 shrink-0"/>
                  <p className="text-[9px] font-bold text-indigo-700 leading-relaxed uppercase">
                    Pastikan API Key ini milik Anda sendiri. Sistem dilarang menggunakan kunci utama untuk menjamin isolasi kuota dan privasi data antar guru.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-50">
            <div className="flex items-center gap-3 text-slate-400">
               <ShieldCheck size={24} className="text-emerald-500"/>
               <p className="text-[10px] font-medium uppercase tracking-widest leading-relaxed">
                 Perangkat Pembelajaran Terpadu v2.0 <br/> Data Terenkripsi Secara Cloud
               </p>
            </div>
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-12 rounded-3xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3 text-xs tracking-widest uppercase"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />}
              SIMPAN PERUBAHAN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileManager;
