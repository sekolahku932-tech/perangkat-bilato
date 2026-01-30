
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, CapaianPembelajaran, AnalisisCP, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Sparkles, Loader2, Eye, EyeOff, BrainCircuit, Cloud, AlertTriangle, X, FileDown, Printer, Lock, AlertCircle, ListChecks, Info, BookOpen, CheckCircle2, Key, ArrowLeft } from 'lucide-react';
import { analyzeCPToTP } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface AnalisisManagerProps {
  user: User;
}

const AnalisisManager: React.FC<AnalisisManagerProps> = ({ user }) => {
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisCP[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: '-',
    principalName: '-',
    principalNip: '-'
  });

  const [activeYear, setActiveYear] = useState('2024/2025');
  const printRef = useRef<HTMLDivElement>(null);

  const isClassLocked = user.role === 'guru' && (user.teacherType === 'kelas' || (!user.teacherType && user.kelas !== '-' && user.kelas !== 'Multikelas'));

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setFilterKelas(user.kelas as Kelas);
        updateFaseByKelas(user.kelas as Kelas);
      }
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        if (!user.mapelDiampu.includes(filterMapel)) {
          setFilterMapel(user.mapelDiampu[0]);
        }
      }
    }
  }, [user]);

  const updateFaseByKelas = (kls: Kelas) => {
    if (['1', '2'].includes(kls)) setFilterFase(Fase.A);
    else if (['3', '4'].includes(kls)) setFilterFase(Fase.B);
    else if (['5', '6'].includes(kls)) setFilterFase(Fase.C);
  };

  const handleKelasChange = (kls: Kelas) => {
    setFilterKelas(kls);
    updateFaseByKelas(kls);
  };

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find((d: any) => d.data().isActive);
      if (active) setActiveYear(active.data().year);
    });

    const qCp = query(collection(db, "cps"), where("school", "==", user.school));
    const unsubCp = onSnapshot(qCp, snap => {
      setCps(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });

    // ISOLASI: Filter berdasarkan userId
    const qAnalisis = query(collection(db, "analisis"), where("userId", "==", user.id));
    const unsubAnalisis = onSnapshot(qAnalisis, snap => {
      setAnalisis(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnalisisCP[]);
      setLoading(false);
    });
    return () => { unsubSettings(); unsubYears(); unsubCp(); unsubAnalisis(); };
  }, [user.school, user.id]);

  const filteredAnalisis = useMemo(() => {
    const currentMapelNormalized = (filterMapel || '').trim().toLowerCase();
    return analisis
      .filter(a => a.fase === filterFase && a.kelas === filterKelas && a.mataPelajaran.trim().toLowerCase() === currentMapelNormalized)
      .sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [analisis, filterFase, filterKelas, filterMapel]);

  const filteredCps = useMemo(() => {
    const currentMapelNormalized = (filterMapel || '').trim().toLowerCase();
    return cps
      .filter(cp => cp.fase === filterFase && cp.mataPelajaran.trim().toLowerCase() === currentMapelNormalized)
      .sort((a, b) => (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [cps, filterFase, filterMapel]);

  // Fix: Gemini API logic is implemented in the analyzeDocuments, analyzeCPToTP, generateRPMContent, etc. services.
  // The service uses process.env.API_KEY exclusively.
  const handleAnalyze = async (cp: CapaianPembelajaran) => {
    setIsAnalyzing(true);
    try {
      const results = await analyzeCPToTP(cp.deskripsi, cp.elemen, cp.fase, filterKelas);
      if (results && Array.isArray(results)) {
        let lastOrder = filteredAnalisis.length > 0 ? Math.max(...filteredAnalisis.map(a => a.indexOrder || 0)) : 0;
        for (const res of results) {
          lastOrder++;
          await addDoc(collection(db, "analisis"), {
            userId: user.id,
            cpId: cp.id,
            kodeCP: cp.kode, // MENYIMPAN KODE CP
            fase: filterFase,
            kelas: filterKelas,
            mataPelajaran: filterMapel,
            materi: res.materi,
            subMateri: res.subMateri || '',
            tujuanPembelajaran: res.tp,
            profilLulusan: res.profilLulusan || '', // AI-driven DPL analysis
            indexOrder: lastOrder,
            school: user.school
          });
        }
        setMessage({ text: 'Analisis AI Berhasil: TP Dirinci & Kode CP Disinkron!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      console.error(error);
      setMessage({ text: 'AI Error: Server sibuk, silakan coba beberapa saat lagi.', type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrint = () => {
    setIsPrintMode(true);
  };

  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

  return (
    <div className="space-y-6">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
         <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BrainCircuit size={24} /></div>
               <div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Analisis CP ke TP</h2>
                  <p className="text-[10px] text-emerald-600 font-black uppercase mt-1">Tenant: {user.school}</p>
               </div>
            </div>
            <button onClick={handlePrint} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg">
               <Printer size={16}/> CETAK HASIL
            </button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mapel</label>
               <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>
                  {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Fase / Kelas {isClassLocked && <Lock size={10} className="inline text-amber-500" />}</label>
               <select disabled={isClassLocked} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={filterKelas} onChange={e => handleKelasChange(e.target.value as Kelas)}>
                  {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
               </select>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
         <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
               <BookOpen size={20} className="text-blue-600" />
               <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">1. Daftar Capaian (CP)</h3>
            </div>
            <div className="space-y-4">
               {filteredCps.length === 0 ? (
                  <p className="text-center py-20 text-slate-400 italic">Belum ada CP terdaftar untuk Mapel & Fase ini.</p>
               ) : filteredCps.map(cp => (
                  <div key={cp.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 transition-all group">
                     <div className="flex items-center justify-between mb-3">
                        <span className="px-3 py-1 bg-white rounded-lg text-[10px] font-black text-blue-600 border border-blue-100 uppercase">{cp.kode} - {cp.elemen}</span>
                        <button 
                           onClick={() => handleAnalyze(cp)} 
                           disabled={isAnalyzing}
                           className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                        >
                           {isAnalyzing ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} ANALISIS AI
                        </button>
                     </div>
                     <p className="text-[11px] leading-relaxed text-slate-600 italic line-clamp-3">"{cp.deskripsi}"</p>
                  </div>
               ))}
            </div>
         </div>

         <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
               <div className="flex items-center gap-2">
                  <ListChecks size={20} className="text-emerald-600" />
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">2. Hasil Pemetaan TP Personal</h3>
               </div>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{filteredAnalisis.length} TP Terpetakan</span>
               </div>
            </div>
            
            <div className="space-y-4">
               {filteredAnalisis.length === 0 ? (
                  <div className="py-20 text-center space-y-4 opacity-40">
                     <Info size={48} className="mx-auto text-slate-300"/>
                     <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-[200px] mx-auto">Silakan klik tombol "Analisis AI" pada CP di samping untuk menghasilkan Tujuan Pembelajaran secara otomatis.</p>
                  </div>
               ) : (
                  filteredAnalisis.map((item, idx) => (
                     <div key={item.id} className="p-5 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between gap-4 mb-3">
                           <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[8px] font-black uppercase border border-indigo-100">{item.kodeCP || '-'}</span>
                           </div>
                           <button onClick={async () => { await deleteDoc(doc(db, "analisis", item.id)); }} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={14} />
                           </button>
                        </div>
                        <div className="space-y-3">
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tujuan Pembelajaran</p>
                              <p className="text-xs font-bold text-slate-800 leading-relaxed text-justify">{item.tujuanPembelajaran}</p>
                           </div>
                           <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                              <div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Lingkup Materi</p>
                                 <p className="text-[10px] font-bold text-emerald-600 uppercase">{item.materi}</p>
                              </div>
                              <div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Dimensi Profil Lulusan</p>
                                 <p className="text-[9px] font-bold text-indigo-600 italic line-clamp-1">{item.profilLulusan}</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>

      {isPrintMode && (
        <div className="fixed inset-0 bg-white z-[300] overflow-y-auto p-12 font-serif text-black">
          <div className="no-print mb-10 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200">
             <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-black shadow-xl">KEMBALI KE EDITOR</button>
             <button onClick={() => {
                const content = printRef.current?.innerHTML;
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(`<html><head><title>Analisis CP - ${settings.schoolName}</title><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: 'Arial', sans-serif; padding: 40px; } table { border-collapse: collapse; width: 100%; border: 1.5px solid black; } th, td { border: 1px solid black; padding: 8px; }</style></head><body onload="window.print(); window.close();">${content}</body></html>`);
                  printWindow.document.close();
                }
             }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-lg">CETAK PDF SEKARANG</button>
          </div>
          <div ref={printRef}>
             <div className="text-center mb-8 pb-4 border-b-4 border-double border-black">
                <h1 className="text-xl font-black uppercase">ANALISIS CAPAIAN PEMBELAJARAN KE TUJUAN PEMBELAJARAN</h1>
                <h2 className="text-lg font-bold mt-1 uppercase">{settings.schoolName}</h2>
                <div className="flex justify-center gap-10 mt-4 text-[10px] font-black uppercase font-sans">
                  <span>MATA PELAJARAN: {filterMapel}</span> <span>KELAS: {filterKelas}</span> <span>FASE: {filterFase}</span>
                </div>
             </div>
             <table className="w-full text-[10px] border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-slate-100 uppercase font-black text-center">
                    <th className="border-2 border-black w-10">No</th>
                    <th className="border-2 border-black w-20">Kode</th>
                    <th className="border-2 border-black">Tujuan Pembelajaran (TP)</th>
                    <th className="border-2 border-black w-40">Lingkup Materi</th>
                    <th className="border-2 border-black w-48">Profil Lulusan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalisis.map((item, idx) => (
                    <tr key={item.id} className="h-10">
                      <td className="border-2 border-black text-center">{idx + 1}</td>
                      <td className="border-2 border-black text-center font-bold">{item.kodeCP || '-'}</td>
                      <td className="border-2 border-black px-4 text-justify leading-relaxed">{item.tujuanPembelajaran}</td>
                      <td className="border-2 border-black px-4 uppercase font-bold text-center">{item.materi}</td>
                      <td className="border-2 border-black px-4 italic text-center">{item.profilLulusan}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
             <div className="mt-16 grid grid-cols-2 text-center text-[10px] font-black uppercase break-inside-avoid">
                <div><p>Mengetahui,</p><p>Kepala Sekolah</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[150px]">{settings.principalName}</p></div>
                <div><p>Bilato, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p><p>Guru Kelas / Mapel</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[150px]">{user.name}</p></div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisManager;
