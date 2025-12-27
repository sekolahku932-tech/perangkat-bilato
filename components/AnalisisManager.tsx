
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, CapaianPembelajaran, AnalisisCP, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Sparkles, Loader2, Eye, EyeOff, BrainCircuit, Cloud, AlertTriangle, X, FileDown, Printer, Lock, AlertCircle } from 'lucide-react';
import { analyzeCPToTP } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from '../services/firebase';

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
  
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: 'SD NEGERI 5 BILATO',
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });

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
    const unsubSettings = onSnapshot(doc(db, "settings", "school_info"), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    const unsubCp = onSnapshot(collection(db, "cps"), snap => {
      setCps(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });

    const unsubAnalisis = onSnapshot(collection(db, "analisis"), snap => {
      setAnalisis(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnalisisCP[]);
      setLoading(false);
    });
    return () => { unsubSettings(); unsubCp(); unsubAnalisis(); };
  }, []);

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

  const handleAnalyze = async (cp: CapaianPembelajaran) => {
    setIsAnalyzing(true);
    try {
      // Injeksi API Key User
      const results = await analyzeCPToTP(cp.deskripsi, cp.elemen, cp.fase, filterKelas, user.apiKey);
      if (results && Array.isArray(results)) {
        let lastOrder = filteredAnalisis.length > 0 ? Math.max(...filteredAnalisis.map(a => a.indexOrder || 0)) : 0;
        for (const res of results) {
          lastOrder++;
          await addDoc(collection(db, "analisis"), {
            cpId: cp.id,
            fase: filterFase,
            kelas: filterKelas,
            mataPelajaran: filterMapel,
            materi: res.materi,
            subMateri: res.subMateri || '',
            tujuanPembelajaran: res.tp,
            indexOrder: lastOrder
          });
        }
      }
    } catch (error) {
      console.error(error);
      alert("Gagal analisis AI. Cek kuota API Key Anda.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportWord = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Word</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 8px; font-family: 'Arial'; font-size: 10px; vertical-align: top; } .text-center { text-align: center; } .font-bold { font-weight: bold; }</style></head><body>`;
    const footer = "</body></html>";
    let tableHtml = `<div style="text-align:center"><h2 style="margin:0">ANALISIS CAPAIAN PEMBELAJARAN</h2><h3 style="margin:5px 0">${settings.schoolName}</h3></div><br/><table><thead><tr><th>NO</th><th>CP</th><th>URUTAN MATERI</th><th>TP</th></tr></thead><tbody>${filteredAnalisis.map((item, idx) => `<tr><td class="text-center">${idx + 1}</td><td>${item.tujuanPembelajaran}</td></tr>`).join('')}</tbody></table>`;
    const blob = new Blob(['\ufeff', header + tableHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ANALISIS_CP.doc`;
    link.click();
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<html><body>${content}</body></html>`);
      printWindow.document.close();
    }
  };

  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : user.mapelDiampu;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><BrainCircuit size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">ANALISIS CAPAIAN PEMBELAJARAN</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{user.apiKey ? 'Menggunakan Kunci Kustom' : 'Menggunakan Kunci Sekolah'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2"><Eye size={18} /> PRATINJAU</button>
            <button onClick={handleExportWord} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2"><FileDown size={18} /> WORD</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 flex items-center gap-1">Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterFase} disabled={isClassLocked} onChange={(e) => setFilterFase(e.target.value as Fase)}>
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 flex items-center gap-1">Pilih Kelas</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterKelas} disabled={isClassLocked} onChange={(e) => handleKelasChange(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Mapel</label><select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Daftar CP</h3></div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px] custom-scrollbar">
            {filteredCps.map(cp => (
              <div key={cp.id} className="p-6 hover:bg-slate-50 transition-colors group">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black">{cp.kode}</span>
                  <button onClick={() => handleAnalyze(cp)} disabled={isAnalyzing} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-lg shadow-emerald-100">
                    {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} ANALISIS AI
                  </button>
                </div>
                <h4 className="font-black text-slate-800 text-sm uppercase mb-2">{cp.elemen}</h4>
                <p className="text-xs text-slate-500 leading-relaxed italic line-clamp-3">{cp.deskripsi}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Hasil Pecahan TP</h3></div>
          <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest h-12">
                  <th className="px-6 py-2 w-16 text-center border-r border-white/5">No</th>
                  <th className="px-6 py-2 w-48 border-r border-white/5">Materi</th>
                  <th className="px-6 py-2">Tujuan Pembelajaran</th>
                  <th className="px-6 py-2 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAnalisis.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 group transition-colors align-top">
                    <td className="px-6 py-6 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                    <td className="px-6 py-6 border-r border-slate-50 font-black text-[11px] uppercase">{item.materi}</td>
                    <td className="px-6 py-6 border-r border-slate-50 text-[11px] font-medium text-slate-600 italic">{item.tujuanPembelajaran}</td>
                    <td className="px-6 py-6 text-center">
                      <button onClick={() => deleteDoc(doc(db, "analisis", item.id))} className="p-2 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalisisManager;
