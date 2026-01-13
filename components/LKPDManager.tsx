
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, LKPDItem, RPMItem, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, ArrowRight, Hammer, Download } from 'lucide-react';
import { generateLKPDContent } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

interface LKPDManagerProps {
  user: User;
}

const LKPDManager: React.FC<LKPDManagerProps> = ({ user }) => {
  const [lkpdList, setLkpdList] = useState<LKPDItem[]>([]);
  const [rpmList, setRpmList] = useState<RPMItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterSemester, setFilterSemester] = useState<'1' | '2'>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showRpmPicker, setShowRpmPicker] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });
  
  const [activeYear, setActiveYear] = useState('2024/2025');

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

    const qLkpd = query(collection(db, "lkpd"), where("school", "==", user.school));
    const unsubLkpd = onSnapshot(qLkpd, (snapshot) => {
      setLkpdList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LKPDItem[]);
    });

    const qRpm = query(collection(db, "rpm"), where("school", "==", user.school));
    const unsubRpm = onSnapshot(qRpm, (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubLkpd(); unsubRpm(); };
  }, [user.school]);

  const filteredLkpd = useMemo(() => {
    return lkpdList.filter(l => 
      l.fase === filterFase && 
      l.kelas === filterKelas && 
      l.semester === filterSemester && 
      l.mataPelajaran === filterMapel
    );
  }, [lkpdList, filterFase, filterKelas, filterSemester, filterMapel]);

  const filteredRpmForPicker = useMemo(() => {
    return rpmList.filter(r => 
      r.fase === filterFase && 
      r.kelas === filterKelas && 
      r.semester === filterSemester && 
      r.mataPelajaran === filterMapel
    );
  }, [rpmList, filterFase, filterKelas, filterSemester, filterMapel]);

  const handleSelectRpm = async (rpm: RPMItem) => {
    try {
      const docRef = await addDoc(collection(db, "lkpd"), {
        rpmId: rpm.id,
        fase: rpm.fase,
        kelas: rpm.kelas,
        semester: rpm.semester,
        mataPelajaran: rpm.mataPelajaran,
        judul: `LEMBAR KERJA: ${rpm.materi}`,
        tujuanPembelajaran: rpm.tujuanPembelajaran,
        petunjuk: '1. Berdoalah sebelum mengerjakan.\n2. Baca materi ringkas dengan saksama.\n3. Kerjakan tugas sesuai langkah kerja.',
        alatBahan: '-',
        materiRingkas: '-',
        langkahKerja: '-',
        tugasMandiri: '-',
        refleksi: 'Bagaimana perasaanmu setelah belajar hari ini?',
        jumlahPertemuan: rpm.jumlahPertemuan || 1,
        school: user.school
      });
      setShowRpmPicker(false);
      setIsEditing(docRef.id);
      setMessage({ text: 'LKPD Baru berhasil dibuat!', type: 'success' });
    } catch (e) {
      setMessage({ text: 'Gagal membuat LKPD', type: 'error' });
    }
  };

  const handleGenerateAI = async (id: string) => {
    const lkpd = lkpdList.find(l => l.id === id);
    if (!lkpd) return;
    const rpm = rpmList.find(r => r.id === lkpd.rpmId);
    if (!rpm) { 
      setMessage({ text: 'Data RPM referensi tidak ditemukan!', type: 'error' }); 
      return; 
    }

    setIsLoadingAI(true);
    try {
      const result = await generateLKPDContent(rpm, user.apiKey);
      if (result) {
        await updateDoc(doc(db, "lkpd", id), { ...result });
        setMessage({ text: 'Konten LKPD Sinkron dengan Langkah RPM!', type: 'success' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ text: 'AI Gagal: ' + (err.message || 'Cek kuota'), type: 'error' });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const updateLKPD = async (id: string, field: keyof LKPDItem, value: any) => {
    try { await updateDoc(doc(db, "lkpd", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "lkpd", deleteConfirmId));
      setDeleteConfirmId(null);
      setMessage({ text: 'LKPD Berhasil Dihapus!', type: 'success' });
    } catch (e) { setMessage({ text: 'Gagal menghapus!', type: 'error' }); }
  };

  const splitByMeeting = (text: string, count: number) => {
    if (!text || text === '-') return Array(count).fill('');
    
    // Pattern penanda pertemuan yang lebih fleksibel
    const pattern = /Pertemuan\s*(\d+)\s*:?/gi;
    const parts = text.split(pattern);
    
    // Jika tidak ada penanda sama sekali tapi diminta lebih dari 1 pertemuan
    if (parts.length === 1 && count > 1) {
      // Sebagai fallback, masukkan semuanya ke pertemuan 1
      const result = Array(count).fill('');
      result[0] = text;
      return result;
    }

    // Jika pola split menghasilkan array ["text_sebelum_p1", "1", "isi_p1", "2", "isi_p2", ...]
    const result = Array(count).fill('');
    
    // Jika teks dimulai langsung dengan Pertemuan 1, parts[0] akan kosong
    // Kita iterasi bagian-bagiannya
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        // Cek apakah p adalah angka penanda pertemuan
        const mNum = parseInt(p);
        if (!isNaN(mNum) && mNum > 0 && mNum <= count) {
            // Isi yang mengikuti angka ini adalah konten untuk pertemuan tersebut
            result[mNum - 1] = (parts[i + 1] || '').trim();
            i++; // Loncat ke konten berikutnya
        }
    }

    // Fallback terakhir: jika hasil masih kosong semua di p2+ padahal teks aslinya ada isi
    if (count > 1 && result.slice(1).every(r => r === '') && text.length > 50) {
       // Mungkin formatnya list biasa tanpa kata "Pertemuan"
       // Kita biarkan pertemuan 1 berisi semuanya daripada kosong
       if (result[0] === '') result[0] = text;
    }

    return result;
  };

  const renderListContent = (text: string | undefined, cleanMeetingTags: boolean = false) => {
    if (!text || text === '-' || text.trim() === '') return <span className="text-slate-400 italic">Belum ada konten. Klik SINKRONKAN AI.</span>;
    let processedText = text;
    if (cleanMeetingTags) processedText = text.replace(/Pertemuan\s*\d+\s*:?\s*/gi, '');
    
    const cleaningRegex = /^(\d+[\.\)]|\-|\*|•)\s*/;
    let rawLines = processedText.split(/\n+/);
    let validLines: string[] = [];
    
    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const cleaned = trimmed.replace(cleaningRegex, '').trim();
        if (cleaned) validLines.push(cleaned);
    });

    if (validLines.length === 0) return <p className="whitespace-pre-wrap text-justify leading-relaxed">{processedText}</p>;
    
    return (
      <ul className="space-y-3 list-none">
        {validLines.map((step, i) => (
          <li key={i} className="flex gap-3 items-start group">
            <span className="shrink-0 font-black text-slate-800 mt-0.5 min-w-[1.2rem] h-5 w-5 bg-slate-100 rounded flex items-center justify-center text-[10px] border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i + 1}</span>
            <span className="leading-relaxed text-justify flex-1 text-[11px] font-medium text-slate-700">{step}</span>
          </li>
        ))}
      </ul>
    );
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>LKPD - ${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; color: black; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              .break-inside-avoid { page-break-inside: avoid; }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 5px; }
            </style>
          </head>
          <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleExportWord = () => {
    const lkpd = lkpdList.find(l => l.id === isEditing);
    if (!lkpd) return;

    const jPertemuan = lkpd.jumlahPertemuan || 1;
    const materiParts = splitByMeeting(lkpd.materiRingkas, jPertemuan);
    const langkahParts = splitByMeeting(lkpd.langkahKerja, jPertemuan);
    const tugasParts = splitByMeeting(lkpd.tugasMandiri, jPertemuan);
    const refleksiParts = splitByMeeting(lkpd.refleksi, jPertemuan);

    const renderListForWord = (text: string) => {
      const parts = text.split(/\n+/).map(l => l.replace(/^(\d+[\.\)]|\-|\*|•)\s*/, '').trim()).filter(l => l.length > 0);
      if (parts.length <= 1) return text.replace(/\n/g, '<br/>');
      return parts.map((p, i) => `<div style="margin-bottom: 3px;">${i+1}. ${p}</div>`).join('');
    };

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>LKPD</title><style>body { font-family: 'Arial', sans-serif; font-size: 10pt; } table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 5px; } .kop { text-align: center; border-bottom: 4px double black; padding-bottom: 10px; margin-bottom: 20px; } .section-title { background-color: #f3f4f6; padding: 5px; font-weight: bold; border-left: 10px solid black; margin-top: 15px; margin-bottom: 10px; } .meeting-header { background-color: #000; color: #fff; padding: 3px 15px; font-weight: bold; display: inline-block; font-size: 9pt; }</style></head><body>`;
    const footer = "</body></html>";
    
    let contentHtml = `
      <div class="kop"><h2 style="margin:0">${settings.schoolName}</h2><h1 style="margin:5px 0">LEMBAR KERJA PESERTA DIDIK (LKPD)</h1><p><b>${lkpd.mataPelajaran} | SEMESTER ${lkpd.semester} | TA ${activeYear}</b></p></div>
      <table style="border:none; width:100%"><tr style="border:none"><td style="border:none; width:50%; font-weight: bold;">NAMA: ................................</td><td style="border:none; width:50%; font-weight: bold;">HARI/TGL: ................................</td></tr></table>
      <div class="section-title">TUJUAN PEMBELAJARAN</div><p><i>"${lkpd.tujuanPembelajaran}"</i></p>
      <div class="section-title">PETUNJUK BELAJAR</div><div>${renderListForWord(lkpd.petunjuk)}</div>
    `;

    for (let i = 0; i < jPertemuan; i++) {
      contentHtml += `
        <div style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 15px;">
          <div class="meeting-header">PERTEMUAN ${i + 1}</div>
          <p><b>Ringkasan Materi:</b></p><div>${renderListForWord(materiParts[i] || '-')}</div>
          <p><b>Langkah Kerja:</b></p><div>${renderListForWord(langkahParts[i] || '-')}</div>
          <p><b>Tugas:</b></p><div>${renderListForWord(tugasParts[i] || '-')}</div>
        </div>
      `;
    }

    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LKPD_${lkpd.judul.replace(/ /g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

  const currentLKPD = useMemo(() => lkpdList.find(l => l.id === isEditing), [lkpdList, isEditing]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus LKPD</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">Hapus lembar kerja ini secara permanen?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">BATAL</button>
              <button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg">YA, HAPUS</button>
            </div>
          </div>
        </div>
      )}

      {/* Picker RPM (Untuk Buat LKPD Baru) */}
      {showRpmPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95">
             <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3"><div className="p-2 bg-indigo-500 rounded-xl"><Plus size={20}/></div><h3 className="font-black uppercase text-sm tracking-widest leading-none">Pilih Referensi RPM</h3></div>
                <button onClick={() => setShowRpmPicker(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20}/></button>
             </div>
             <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
                {filteredRpmForPicker.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-bold italic">Belum ada RPM di filter ini. Buat RPM terlebih dahulu.</div>
                ) : filteredRpmForPicker.map(rpm => (
                  <button key={rpm.id} onClick={() => handleSelectRpm(rpm)} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-left hover:border-indigo-500 hover:bg-white transition-all group flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Topik: {rpm.materi}</p>
                        <h4 className="text-sm font-black text-slate-900 line-clamp-1">{rpm.tujuanPembelajaran}</h4>
                     </div>
                     <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Editor LKPD */}
      {isEditing && currentLKPD && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-7xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-xl shadow-lg"><PenTool size={20}/></div>
                    <div><h3 className="font-black uppercase text-sm tracking-widest leading-none">Editor Lembar Kerja</h3><p className="text-[10px] text-slate-400 font-bold tracking-tighter mt-1 uppercase">Struktur LKPD Berbasis RPM</p></div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => handlePrint()} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all"><Printer size={14}/> PRATINJAU</button>
                    <button onClick={() => setIsEditing(null)} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-[10px] font-black transition-all">TUTUP</button>
                 </div>
              </div>
              <div className="p-8 overflow-y-auto space-y-10 no-scrollbar bg-white">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><div className="w-1.5 h-6 bg-blue-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Identitas LKPD</h4></div>
                       <div className="grid grid-cols-1 gap-4">
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Judul Lembar Kerja</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-black text-slate-800" value={currentLKPD.judul} onChange={e => updateLKPD(isEditing!, 'judul', e.target.value)} /></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Petunjuk Belajar</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs min-h-[100px]" value={currentLKPD.petunjuk} onChange={e => updateLKPD(isEditing!, 'petunjuk', e.target.value)} /></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Alat dan Bahan</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs" value={currentLKPD.alatBahan} onChange={e => updateLKPD(isEditing!, 'alatBahan', e.target.value)} /></div>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex items-center justify-between border-b border-slate-100 pb-2"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Materi & Langkah (AI Sync)</h4></div><button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50">{isLoadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} SINKRON KONTEN RPM</button></div>
                       <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-200 space-y-6 h-fit max-h-[500px] overflow-y-auto no-scrollbar">
                          {Array.from({ length: currentLKPD.jumlahPertemuan || 1 }).map((_, idx) => {
                             const materiParts = splitByMeeting(currentLKPD.materiRingkas, currentLKPD.jumlahPertemuan || 1);
                             const langkahParts = splitByMeeting(currentLKPD.langkahKerja, currentLKPD.jumlahPertemuan || 1);
                             const tugasParts = splitByMeeting(currentLKPD.tugasMandiri, currentLKPD.jumlahPertemuan || 1);
                             return (
                               <div key={idx} className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                                  <div className="flex items-center gap-3">
                                     <div className="px-4 py-1 bg-slate-900 text-white text-[10px] font-black rounded-full uppercase tracking-widest">Pertemuan {idx + 1}</div>
                                     <div className="flex-1 h-px bg-slate-100"></div>
                                  </div>
                                  <div><span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Ringkasan Materi</span><div className="mt-2 text-slate-700">{renderListContent(materiParts[idx])}</div></div>
                                  <div><span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Langkah Kerja</span><div className="mt-2 text-slate-700">{renderListContent(langkahParts[idx])}</div></div>
                                  <div><span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Tantangan Mandiri</span><div className="mt-2 text-slate-700">{renderListContent(tugasParts[idx])}</div></div>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex justify-end shrink-0"><button onClick={() => setIsEditing(null)} className="bg-slate-900 text-white px-12 py-3 rounded-2xl text-[11px] font-black shadow-lg">SIMPAN & SELESAI</button></div>
           </div>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 items-end">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Mapel</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-black" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-1">Kelas {isClassLocked && <Lock size={10} className="text-amber-500" />}</label><select disabled={isClassLocked} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-black disabled:bg-slate-100" value={filterKelas} onChange={e => handleKelasChange(e.target.value as Kelas)}>{['1', '2', '3', '4', '5', '6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Semester</label><select className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 text-xs font-black" value={filterSemester} onChange={e => setFilterSemester(e.target.value as '1' | '2')}><option value="1">1 (Ganjil)</option><option value="2">2 (Genap)</option></select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Fase</label><div className="bg-slate-100 p-3.5 rounded-2xl text-xs font-black text-slate-500 border border-slate-200">{filterFase}</div></div>
         </div>
         <button onClick={() => setShowRpmPicker(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2"><Plus size={18}/> BUAT LKPD</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4 text-slate-400 italic"><Loader2 size={48} className="animate-spin text-blue-600"/><p className="text-xs font-black uppercase tracking-widest">Sinkronisasi Cloud...</p></div>
        ) : filteredLkpd.length === 0 ? (
          <div className="col-span-full py-40 text-center text-slate-400 font-black uppercase text-sm tracking-widest bg-white border-2 border-dashed border-slate-200 rounded-[48px]">Belum Ada LKPD Tersimpan</div>
        ) : filteredLkpd.map(lkpd => (
          <div key={lkpd.id} className="bg-white p-8 rounded-[40px] border border-slate-200 hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex gap-4 items-center mb-6">
              <div className="p-4 bg-blue-100 text-blue-700 rounded-3xl group-hover:bg-blue-600 group-hover:text-white transition-all"><PenTool size={24}/></div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-slate-900 leading-tight uppercase line-clamp-2">{lkpd.judul || 'LKPD TANPA JUDUL'}</h4>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[9px] font-black text-slate-400 uppercase">
                  <span className="text-indigo-600">{lkpd.jumlahPertemuan || 1} PERTEMUAN</span>
                  <span className="text-blue-600">{lkpd.mataPelajaran}</span>
                  <span className="flex items-center gap-1 text-emerald-500"><Cloud size={10}/> TERSINKRON</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-slate-50">
              <button onClick={() => setIsEditing(lkpd.id)} className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl text-[10px] font-black hover:bg-black transition-all uppercase tracking-widest">EDIT & CETAK LKPD</button>
              <button onClick={() => setDeleteConfirmId(lkpd.id)} className="p-3.5 text-slate-300 hover:text-red-600 transition-all"><Trash2 size={20}/></button>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden Print Container */}
      <div className="hidden">
         <div ref={printRef} className="p-8 max-w-[21cm] mx-auto text-black">
            {currentLKPD && (
               <>
                  <div className="text-center mb-8 border-b-4 border-double border-black pb-4">
                     <h2 className="text-xl font-bold uppercase">{settings.schoolName}</h2>
                     <h1 className="text-2xl font-black uppercase mt-1">LEMBAR KERJA PESERTA DIDIK (LKPD)</h1>
                     <p className="text-xs font-bold mt-2 uppercase tracking-widest">{currentLKPD.mataPelajaran} | TAHUN PELAJARAN {activeYear}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-10 mb-8 font-black uppercase text-[10pt] border-b-2 border-black pb-6">
                     <div><p>NAMA: ...................................................</p><p className="mt-2">KELAS: {currentLKPD.kelas}</p></div>
                     <div className="text-right"><p>HARI/TGL: ..........................................</p><p className="mt-2">SEMESTER: {currentLKPD.semester}</p></div>
                  </div>
                  <div className="space-y-8">
                     <section><h3 className="font-black text-[11pt] border-l-8 border-black pl-3 mb-2 uppercase">I. TUJUAN PEMBELAJARAN</h3><p className="text-justify leading-relaxed italic">"{currentLKPD.tujuanPembelajaran}"</p></section>
                     <section><h3 className="font-black text-[11pt] border-l-8 border-black pl-3 mb-2 uppercase">II. PETUNJUK KERJA</h3><div className="leading-relaxed whitespace-pre-wrap">{currentLKPD.petunjuk}</div></section>
                     <div className="border-t-2 border-black pt-8 space-y-12">
                        {Array.from({ length: currentLKPD.jumlahPertemuan || 1 }).map((_, idx) => {
                           const materiParts = splitByMeeting(currentLKPD.materiRingkas, currentLKPD.jumlahPertemuan || 1);
                           const langkahParts = splitByMeeting(currentLKPD.langkahKerja, currentLKPD.jumlahPertemuan || 1);
                           const tugasParts = splitByMeeting(currentLKPD.tugasMandiri, currentLKPD.jumlahPertemuan || 1);
                           return (
                              <div key={idx} className="break-inside-avoid border-b border-slate-200 pb-10 last:border-0">
                                 <div className="bg-black text-white px-4 py-1 inline-block font-black text-[10pt] mb-4 uppercase">SESI / PERTEMUAN {idx + 1}</div>
                                 <div className="space-y-6">
                                    <div><p className="font-black uppercase text-[9pt] mb-2 underline">A. Ringkasan Materi</p><div className="text-justify leading-relaxed">{renderListContent(materiParts[idx] || '-', true)}</div></div>
                                    <div><p className="font-black uppercase text-[9pt] mb-2 underline">B. Langkah Aktivitas</p><div className="text-justify leading-relaxed">{renderListContent(langkahParts[idx] || '-', true)}</div></div>
                                    <div className="bg-slate-100 p-6 border-2 border-black rounded-lg"><p className="font-black uppercase text-[9pt] mb-2">C. Tantangan Mandiri / Tugas:</p><div className="text-justify leading-relaxed font-bold">{renderListContent(tugasParts[idx] || '-', true)}</div></div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  </div>
                  <div className="mt-12 grid grid-cols-2 text-center text-[10pt] font-black uppercase break-inside-avoid">
                     <div><p>Mengetahui,</p><p>Orang Tua/Wali</p><div className="h-20"></div><p>( .................................... )</p></div>
                     <div><p>Bilato, ........................</p><p>Guru Kelas/Mapel</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[150px]">{user.name}</p></div>
                  </div>
               </>
            )}
         </div>
      </div>
    </div>
  );
};

export default LKPDManager;
