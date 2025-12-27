
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, ATPItem, AnalisisCP, CapaianPembelajaran, MATA_PELAJARAN, SchoolSettings, User, DIMENSI_PROFIL } from '../types';
import { Plus, Trash2, Sparkles, Loader2, Save, Eye, EyeOff, Search, CheckCircle2, X, AlertTriangle, RefreshCcw, Info, ClipboardCopy, Cloud, DownloadCloud, FileDown, Printer, Edit2, Wand2, Lock, ListTree } from 'lucide-react';
import { completeATPDetails } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from '../services/firebase';

interface ATPManagerProps {
  user: User;
}

const ATPManager: React.FC<ATPManagerProps> = ({ user }) => {
  const [atpData, setAtpData] = useState<ATPItem[]>([]);
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [allAnalisis, setAllAnalisis] = useState<AnalisisCP[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [editModalItem, setEditModalItem] = useState<ATPItem | null>(null);

  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);

  useEffect(() => {
    setLoading(true);
    const unsubATP = onSnapshot(collection(db, "atp"), (snap) => {
      setAtpData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
      setLoading(false);
    });
    return () => unsubATP();
  }, []);

  const handleAIComplete = async (id: string) => {
    const item = atpData.find(i => i.id === id);
    if (!item || !item.tujuanPembelajaran) return;
    setIsProcessingId(id);
    try {
      // Injeksi API Key User
      const suggestions = await completeATPDetails(item.tujuanPembelajaran, item.materi, item.kelas, user.apiKey);
      if (suggestions) {
        await updateDoc(doc(db, "atp", id), {
          alurTujuanPembelajaran: suggestions.alurTujuan,
          alokasiWaktu: item.alokasiWaktu || suggestions.alokasiWaktu,
          dimensiProfilLulusan: item.dimensiProfilLulusan || suggestions.dimensiOfProfil,
          asesmenAwal: item.asesmenAwal || suggestions.asesmenAwal,
          asesmenProses: item.asesmenProses || suggestions.asesmenProses,
          asesmenAkhir: item.asesmenAkhir || suggestions.asesmenAkhir,
          sumberBelajar: item.sumberBelajar || suggestions.sumberBelajar
        });
        alert('Detail ATP dilengkapi AI');
      }
    } catch (err) {
      alert('Gagal menghubungi AI. Cek kuota API Key Anda.');
    } finally { setIsProcessingId(null); }
  };

  const filteredAtp = useMemo(() => {
    return atpData.filter(item => item.fase === filterFase && item.kelas === filterKelas && item.mataPelajaran === filterMapel);
  }, [atpData, filterFase, filterKelas, filterMapel]);

  const updateField = async (id: string, field: keyof ATPItem, value: any) => {
    try { await updateDoc(doc(db, "atp", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : user.mapelDiampu;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><ListTree size={24} /></div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">ALUR TUJUAN PEMBELAJARAN</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{user.apiKey ? 'Personal Key Active' : 'System Key Active'}</p>
              </div>
           </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={filterFase} disabled={isClassLocked} onChange={(e) => setFilterFase(e.target.value as Fase)}>
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Pilih Kelas</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterKelas} disabled={isClassLocked} onChange={(e) => setFilterKelas(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Mapel</label><select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1500px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black h-16 uppercase tracking-widest">
                <th className="px-6 py-4">Tujuan Pembelajaran (TP)</th>
                <th className="px-6 py-4">Alur Tujuan (ATP)</th>
                <th className="px-6 py-4 w-56">Materi</th>
                <th className="px-6 py-4 w-28 text-center">Aksi AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAtp.map((item) => (
                <tr key={item.id} className="align-top group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-6 border-r border-slate-100">
                    <textarea className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-900 leading-relaxed resize-none p-0 h-24" value={item.tujuanPembelajaran} onChange={e => updateField(item.id, 'tujuanPembelajaran', e.target.value)} />
                  </td>
                  <td className="px-6 py-6 border-r border-slate-100 bg-blue-50/10">
                    <textarea className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-blue-900 leading-loose resize-none p-0 h-40 whitespace-pre-line" value={item.alurTujuanPembelajaran} onChange={e => updateField(item.id, 'alurTujuanPembelajaran', e.target.value)} />
                  </td>
                  <td className="px-6 py-6 border-r border-slate-100">
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-black uppercase mb-2" value={item.materi} placeholder="Materi" onChange={e => updateField(item.id, 'materi', e.target.value)} />
                  </td>
                  <td className="px-6 py-6 text-center">
                    <button onClick={() => handleAIComplete(item.id)} disabled={isProcessingId === item.id} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-indigo-700 disabled:opacity-50">
                      {isProcessingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} AI
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ATPManager;
