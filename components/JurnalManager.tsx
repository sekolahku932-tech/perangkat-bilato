
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kelas, JurnalItem, MATA_PELAJARAN, SchoolSettings, AcademicYear, User, PromesItem, RPMItem, Fase, LIST_SEKOLAH } from '../types';
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  BookOpen, Calendar, Wand2, Save, X, Eye, EyeOff, Search, BookText, FileDown,
  Sparkles, RefreshCw, AlertCircle, Info, Lock
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from '../services/firebase';
// @google/genai used according to guidelines
import { GoogleGenAI } from "@google/genai";

interface JurnalManagerProps {
  user: User;
}

// Fixed JurnalManager component returning a valid ReactNode and having a default export
const JurnalManager: React.FC<JurnalManagerProps> = ({ user }) => {
  const [jurnals, setJurnals] = useState<JurnalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKelas, setSelectedKelas] = useState<Kelas>(user.kelas as Kelas || '1');
  const [selectedMapel, setSelectedMapel] = useState<string>(user.mapelDiampu?.[0] || MATA_PELAJARAN[0]);
  const [isLoadingAI, setIsLoadingAI] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: 'SD NEGERI 5 BILATO',
    address: 'Bilato',
    principalName: '',
    principalNip: ''
  });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "settings", "school_info"), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });
    const unsubJurnal = onSnapshot(collection(db, "jurnal"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as JurnalItem[];
      setJurnals(data);
      setLoading(false);
    });
    return () => { unsubSettings(); unsubJurnal(); };
  }, []);

  const filteredJurnals = useMemo(() => {
    return jurnals.filter(j => j.kelas === selectedKelas && j.mataPelajaran === selectedMapel)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [jurnals, selectedKelas, selectedMapel]);

  const handleAddJurnal = async () => {
    try {
      await addDoc(collection(db, "jurnal"), {
        userId: user.id,
        userName: user.name,
        tahunPelajaran: '2024/2025',
        kelas: selectedKelas,
        tanggal: new Date().toISOString().split('T')[0],
        mataPelajaran: selectedMapel,
        materi: '',
        detailKegiatan: '',
        praktikPedagogis: '',
        absenSiswa: '',
        catatanKejadian: ''
      });
    } catch (e) { console.error(e); }
  };

  const updateJurnal = async (id: string, field: keyof JurnalItem, value: any) => {
    try { await updateDoc(doc(db, "jurnal", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleGenerateAI = async (id: string) => {
    const jurnal = jurnals.find(j => j.id === id);
    if (!jurnal || !jurnal.materi) return;
    setIsLoadingAI(id);
    try {
      // Initialize ai using the recommended pattern
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Buat detail kegiatan pembelajaran ringkas untuk jurnal harian SD. Materi: ${jurnal.materi}. Mapel: ${jurnal.mataPelajaran}.`,
        config: { systemInstruction: "Anda adalah pakar kurikulum SD. Berikan narasi kegiatan yang inspiratif dan berfokus pada siswa." }
      });
      // Extract text using the .text property
      if (response.text) {
        await updateDoc(doc(db, "jurnal", id), { detailKegiatan: response.text });
      }
    } catch (e) { console.error(e); }
    finally { setIsLoadingAI(null); }
  };

  const handleDeleteJurnal = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "jurnal", deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="py-40 flex flex-col items-center justify-center gap-4 text-slate-400">
      <Loader2 size={48} className="animate-spin text-indigo-600" />
      <p className="font-black text-xs uppercase tracking-widest text-center">Memuat Jurnal Mengajar Cloud...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus Jurnal?</h3>
              <p className="text-slate-500 font-medium text-sm">Data ini akan dihapus permanen dari cloud.</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={handleDeleteJurnal} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BookText size={24} /></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Jurnal Harian KBM</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Catatan Pelaksanaan Pembelajaran</p>
          </div>
        </div>
        <button onClick={handleAddJurnal} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2">
          <Plus size={18}/> TAMBAH JURNAL
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1">
              Kelas {user.role === 'guru' && user.kelas !== '-' && <Lock size={10} className="text-amber-500" />}
            </label>
            <select disabled={user.role === 'guru' && user.kelas !== '-'} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mata Pelajaran</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={selectedMapel} onChange={e => setSelectedMapel(e.target.value)}>
              {MATA_PELAJARAN.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
               <Cloud size={18} className="text-emerald-600"/>
               <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Database Cloud Aktif</div>
            </div>
          </div>
      </div>

      <div className="space-y-6">
        {filteredJurnals.length === 0 ? (
          <div className="py-40 text-center text-slate-400 font-black uppercase text-sm tracking-widest bg-white border-2 border-dashed border-slate-200 rounded-[48px]">Belum Ada Jurnal Tersimpan</div>
        ) : (
          filteredJurnals.map(j => (
            <div key={j.id} className="bg-white p-8 rounded-[40px] border border-slate-200 hover:shadow-2xl transition-all group relative overflow-hidden">
              <div className="flex flex-col lg:flex-row gap-8">
                 <div className="lg:w-1/4 space-y-4">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal KBM</label>
                      <input type="date" className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-black" value={j.tanggal} onChange={e => updateJurnal(j.id, 'tanggal', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Materi / Pokok Bahasan</label>
                      <textarea className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold min-h-[80px]" value={j.materi} onChange={e => updateJurnal(j.id, 'materi', e.target.value)} />
                    </div>
                 </div>
                 <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Detail Kegiatan & Praktik Pedagogis</label>
                        <button onClick={() => handleGenerateAI(j.id)} disabled={isLoadingAI === j.id} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all">
                          {isLoadingAI === j.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12}/>}
                          <span className="text-[8px] font-black uppercase">Narasikan AI</span>
                        </button>
                      </div>
                      <textarea className="w-full bg-indigo-50/30 border-none rounded-2xl p-4 text-xs font-medium leading-relaxed min-h-[160px]" value={j.detailKegiatan} onChange={e => updateJurnal(j.id, 'detailKegiatan', e.target.value)} placeholder="Tuliskan detail langkah pembelajaran yang dilaksanakan..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Absensi Siswa (S/I/A)</label>
                         <input className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold" value={j.absenSiswa || ''} onChange={e => updateJurnal(j.id, 'absenSiswa', e.target.value)} placeholder="Contoh: Budi (S), Ani (A)" />
                       </div>
                       <div>
                         <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Catatan Kejadian</label>
                         <input className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold" value={j.catatanKejadian || ''} onChange={e => updateJurnal(j.id, 'catatanKejadian', e.target.value)} />
                       </div>
                    </div>
                 </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end">
                <button onClick={() => setDeleteConfirmId(j.id)} className="p-2.5 text-slate-300 hover:text-red-600 transition-all">
                  <Trash2 size={20}/>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default JurnalManager;
