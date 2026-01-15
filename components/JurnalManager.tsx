
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kelas, JurnalItem, MATA_PELAJARAN, SchoolSettings, AcademicYear, User, PromesItem, RPMItem } from '../types';
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  Wand2, Search, BookText, FileDown, RefreshCw,
  Sparkles, AlertCircle, Info, Lock, CalendarDays, BookOpen, User as UserIcon
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';
import { generateJournalNarrative } from '../services/geminiService';

interface JurnalManagerProps {
  user: User;
}

const JurnalManager: React.FC<JurnalManagerProps> = ({ user }) => {
  const [jurnals, setJurnals] = useState<JurnalItem[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [rpmData, setRpmData] = useState<RPMItem[]>([]);
  const [promesData, setPromesData] = useState<PromesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState('');
  const [selectedKelas, setSelectedKelas] = useState<Kelas>('1');
  const [selectedSemester, setSelectedSemester] = useState<'1' | '2'>('1');
  
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState<string | null>(null);
  const [isSyncingPromes, setIsSyncingPromes] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Jl. Trans Sulawesi, Kec. Bilato',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });

  const printRef = useRef<HTMLDivElement>(null);

  const isClassLocked = user.role === 'guru' && (user.teacherType === 'kelas' || (!user.teacherType && user.kelas !== '-' && user.kelas !== 'Multikelas'));

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setSelectedKelas(user.kelas as Kelas);
      }
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const yearList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AcademicYear[];
      setYears(yearList.filter(y => (y as any).school === user.school));
      const active = yearList.find(y => y.isActive && (y as any).school === user.school);
      if (active) setActiveYear(active.year);
    });

    const qJurnal = query(collection(db, "jurnal_harian"), where("school", "==", user.school));
    const unsubJurnal = onSnapshot(qJurnal, (snapshot) => {
      setJurnals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as JurnalItem[]);
      setLoading(false);
    });

    const qRpm = query(collection(db, "rpm"), where("school", "==", user.school));
    const unsubRpm = onSnapshot(qRpm, (snapshot) => {
      setRpmData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
    });

    const qPromes = query(collection(db, "promes"), where("school", "==", user.school));
    const unsubPromes = onSnapshot(qPromes, (snapshot) => {
      setPromesData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as PromesItem[]);
    });

    return () => { unsubSettings(); unsubYears(); unsubJurnal(); unsubRpm(); unsubPromes(); };
  }, [user.school]);

  const filteredJurnals = useMemo(() => {
    return jurnals
      .filter(j => j.tahunPelajaran === activeYear && j.kelas === selectedKelas && j.school === user.school)
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [jurnals, activeYear, selectedKelas, user.school]);

  const handleAddRow = async () => {
    try {
      await addDoc(collection(db, "jurnal_harian"), {
        userId: user.id,
        userName: user.name,
        tahunPelajaran: activeYear,
        kelas: selectedKelas,
        school: user.school,
        tanggal: new Date().toISOString().split('T')[0],
        mataPelajaran: MATA_PELAJARAN[0],
        materi: '',
        detailKegiatan: '',
        praktikPedagogis: 'Aktif',
        absenSiswa: '',
        catatanKejadian: ''
      });
    } catch (e) { console.error(e); }
  };

  const handleSyncFromPromes = async () => {
    if (!activeYear) {
      setMessage({ text: 'Tahun Pelajaran aktif tidak ditemukan!', type: 'error' });
      return;
    }
    setIsSyncingPromes(true);
    let count = 0;
    try {
      const monthMap: Record<string, number> = {
        'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
        'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
      };
      const yearParts = activeYear.split('/');
      const yearStart = parseInt(yearParts[0]);
      const yearEnd = parseInt(yearParts[1]) || yearStart + 1;
      const filteredPromes = promesData.filter(p => 
        p.kelas === selectedKelas && p.semester === selectedSemester && p.school === user.school && p.bulanPelaksanaan
      );
      if (filteredPromes.length === 0) {
        setMessage({ text: 'Tidak ada data Prosem untuk disinkronkan.', type: 'warning' });
        setIsSyncingPromes(false);
        return;
      }
      for (const p of filteredPromes) {
        const dateEntries = p.bulanPelaksanaan.split(',');
        for (const entry of dateEntries) {
          const [bulan, minggu, tanggal] = entry.split('|');
          if (!bulan || !tanggal) continue;
          const monthIndex = monthMap[bulan];
          const year = monthIndex >= 6 ? yearStart : yearEnd;
          const formattedDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(tanggal).padStart(2, '0')}`;
          const isDuplicate = jurnals.some(j => 
            j.tanggal === formattedDate && j.mataPelajaran === p.mataPelajaran && j.materi === p.materiPokok && j.kelas === selectedKelas
          );
          if (!isDuplicate) {
            await addDoc(collection(db, "jurnal_harian"), {
              userId: user.id, userName: user.name, tahunPelajaran: activeYear, kelas: selectedKelas, school: user.school,
              tanggal: formattedDate, mataPelajaran: p.mataPelajaran, materi: p.materiPokok,
              detailKegiatan: `Melaksanakan pembelajaran materi ${p.materiPokok} sesuai rencana pada Prosem.`,
              praktikPedagogis: 'Aktif', absenSiswa: '', catatanKejadian: ''
            });
            count++;
          }
        }
      }
      setMessage({ text: `Berhasil mensinkronkan ${count} log jurnal dari Prosem.`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Gagal sinkronisasi data.', type: 'error' });
    } finally {
      setIsSyncingPromes(false);
    }
  };

  const updateJurnal = async (id: string, field: keyof JurnalItem, value: any) => {
    try { await updateDoc(doc(db, "jurnal_harian", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const handleGenerateNarrative = async (item: JurnalItem) => {
    if (!user.apiKey) {
      setMessage({ text: '⚠️ Gagal: API Key belum diatur!', type: 'warning' });
      return;
    }
    setIsLoadingAI(item.id);
    try {
      const refRpm = rpmData.find(r => r.materi === item.materi && r.mataPelajaran === item.mataPelajaran);
      const result = await generateJournalNarrative(item.kelas, item.mataPelajaran, item.materi, refRpm, user.apiKey);
      if (result) {
        await updateDoc(doc(db, "jurnal_harian", item.id), {
          detailKegiatan: result.detail_kegiatan,
          praktikPedagogis: result.pedagogik
        });
        setMessage({ text: 'Narasi disusun AI (Flash Mode)!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e: any) { setMessage({ text: 'Gagal memanggil AI.', type: 'error' }); } 
    finally { setIsLoadingAI(null); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Jurnal Harian</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; font-size: 8.5pt; color: black; }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 6px; }
              th { background-color: #f3f4f6; text-transform: uppercase; font-weight: bold; }
              @media print { .no-print { display: none !important; } }
              .text-center { text-align: center; }
              .text-justify { text-align: justify; }
            </style>
          </head>
          <body onload="window.print(); window.close();">${content}</body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (loading) return (
    <div className="py-40 flex flex-col items-center justify-center gap-4 text-slate-400">
      <Loader2 size={48} className="animate-spin text-indigo-600" />
      <p className="font-black text-xs uppercase tracking-widest text-center">Sinkronisasi Jurnal Mengajar...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
          message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus Jurnal?</h3>
              <p className="text-slate-500 font-medium text-sm">Aksi ini tidak dapat dibatalkan.</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={async () => { await deleteDoc(doc(db, "jurnal_harian", deleteConfirmId)); setDeleteConfirmId(null); }} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">YA, HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><BookText size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Jurnal Harian Guru</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Dokumentasi Harian {user.school}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleSyncFromPromes} disabled={isSyncingPromes} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-emerald-700 shadow-lg transition-all disabled:opacity-50 tracking-tight">
              {isSyncingPromes ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16}/>} SINKRON DARI PROSEM
            </button>
            <button onClick={handleAddRow} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-indigo-700 shadow-lg transition-all"><Plus size={16}/> TAMBAH LOG</button>
            <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black shadow-lg transition-all"><Printer size={16}/> PRATINJAU</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Semester</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value as '1' | '2')}>
              <option value="1">Ganjil (1)</option>
              <option value="2">Genap (2)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fase / Kelas {isClassLocked && <Lock size={10} className="inline text-amber-500" />}</label>
            <select disabled={isClassLocked} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none disabled:bg-slate-100" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value as Kelas)}>
              {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Tahun Pelajaran</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black outline-none" value={activeYear} onChange={e => setActiveYear(e.target.value)}>
              <option value="">Pilih Tahun</option>
              {years.map(y => <option key={y.id} value={y.year}>{y.year}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end">
             <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 text-indigo-600">
                <Cloud size={20}/>
                <div><p className="text-[8px] font-black uppercase text-slate-400">Penyimpanan</p><p className="text-[10px] font-black uppercase tracking-widest">Sinkronisasi Cloud Aktif</p></div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1800px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black h-16 uppercase tracking-widest">
                <th className="px-6 py-2 w-16 text-center border-r border-white/5">No</th>
                <th className="px-6 py-2 w-48 border-r border-white/5">Hari / Tanggal</th>
                <th className="px-6 py-2 w-48 border-r border-white/5">Mapel</th>
                <th className="px-6 py-2 w-64 border-r border-white/5">Topik / Materi</th>
                <th className="px-6 py-2 border-r border-white/5">Detail Kegiatan</th>
                <th className="px-6 py-2 w-48 border-r border-white/5">Metode / Model</th>
                <th className="px-6 py-2 w-24 text-center border-r border-white/5">Paraf</th>
                <th className="px-6 py-2 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJurnals.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-32 text-center text-slate-400 italic font-black uppercase text-xs">Belum ada data jurnal untuk periode ini.</td></tr>
              ) : (
                filteredJurnals.map((item, idx) => (
                  <tr key={item.id} className="group hover:bg-slate-50 transition-colors align-top">
                    <td className="px-6 py-6 text-center font-black text-slate-300 border-r border-slate-50">{idx + 1}</td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <input type="date" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-black" value={item.tanggal} onChange={e => updateJurnal(item.id, 'tanggal', e.target.value)} />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] font-black uppercase text-indigo-700" value={item.mataPelajaran} onChange={e => updateJurnal(item.id, 'mataPelajaran', e.target.value)}>
                        {MATA_PELAJARAN.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-bold text-slate-800 leading-tight resize-none h-24" value={item.materi} onChange={e => updateJurnal(item.id, 'materi', e.target.value)} placeholder="Materi hari ini..." />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50 relative">
                       <textarea className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-medium text-slate-600 leading-relaxed resize-none p-0 min-h-[100px]" value={item.detailKegiatan} onChange={e => updateJurnal(item.id, 'detailKegiatan', e.target.value)} placeholder="Tulis rincian..." />
                       <button onClick={() => handleGenerateNarrative(item)} disabled={isLoadingAI === item.id} className="absolute bottom-4 right-4 bg-indigo-600 text-white p-2.5 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all">
                         {isLoadingAI === item.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>}
                       </button>
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                       <input className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold" value={item.praktikPedagogis} onChange={e => updateJurnal(item.id, 'praktikPedagogis', e.target.value)} placeholder="Model..." />
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50 text-center">
                       <div className="w-12 h-12 bg-slate-50 rounded-lg mx-auto border border-dashed border-slate-200"></div>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <button onClick={() => setDeleteConfirmId(item.id)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isPrintMode && (
        <div className="fixed inset-0 bg-white z-[300] p-10 overflow-y-auto">
          <div className="no-print mb-8 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200">
             <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-8 py-2 rounded-xl text-xs font-black">KEMBALI</button>
             <button onClick={handlePrint} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><Printer size={16}/> CETAK SEKARANG</button>
          </div>
          <div ref={printRef}>
             <div className="text-center mb-8 pb-4 border-b-4 border-double border-black">
                <h1 className="text-2xl font-black uppercase leading-tight">{settings.schoolName}</h1>
                <h2 className="text-xl font-black uppercase mt-1">JURNAL HARIAN PELAKSANAAN PEMBELAJARAN</h2>
                <div className="flex justify-center gap-10 mt-4 text-[10px] font-black uppercase">
                  <span>KELAS: {selectedKelas}</span> <span>SEMESTER: {selectedSemester}</span> <span>TAHUN: {activeYear}</span>
                </div>
             </div>
             <table className="w-full border-collapse">
               <thead>
                 <tr className="uppercase text-center text-[9pt]">
                   <th className="w-10">No</th>
                   <th className="w-32">Hari / Tanggal</th>
                   <th className="w-32">Mapel</th>
                   <th className="w-40">Topik / Materi</th>
                   <th>Detail Kegiatan</th>
                   <th className="w-32">Metode / Model</th>
                   <th className="w-16">Paraf</th>
                 </tr>
               </thead>
               <tbody>
                 {filteredJurnals.map((j, i) => (
                   <tr key={j.id} className="text-[8.5pt]">
                     <td className="text-center">{i + 1}</td>
                     <td className="text-center">{new Date(j.tanggal).toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}</td>
                     <td className="text-center uppercase">{j.mataPelajaran}</td>
                     <td className="font-bold">{j.materi}</td>
                     <td className="text-justify leading-relaxed">{j.detailKegiatan}</td>
                     <td className="text-center">{j.praktikPedagogis}</td>
                     <td></td>
                   </tr>
                 ))}
                 {filteredJurnals.length === 0 && (
                   <tr><td colSpan={7} className="text-center py-10 italic">Tidak ada data.</td></tr>
                 )}
               </tbody>
             </table>
             <div className="mt-12 grid grid-cols-2 text-center text-[9pt] font-black uppercase break-inside-avoid">
                <div><p>Mengetahui,</p><p>Kepala Sekolah</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[180px]">{settings.principalName}</p><p className="mt-0.5 font-normal">NIP. {settings.principalNip}</p></div>
                <div><p>Bilato, ........................</p><p>Guru Kelas / Mata Pelajaran</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[180px]">{user.name}</p><p className="mt-0.5 font-normal">NIP. {user.nip}</p></div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JurnalManager;
