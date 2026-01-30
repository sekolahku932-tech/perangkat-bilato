// @google/genai is not used directly here, but it's part of the global project context.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, LKPDItem, RPMItem, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, ArrowRight, Hammer, Download, ArrowLeft, ListTree } from 'lucide-react';
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

    const qLkpd = query(collection(db, "lkpd"), where("userId", "==", user.id));
    const unsubLkpd = onSnapshot(qLkpd, (snapshot) => {
      setLkpdList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LKPDItem[]);
    });

    const qRpm = query(collection(db, "rpm"), where("userId", "==", user.id));
    const unsubRpm = onSnapshot(qRpm, (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubLkpd(); unsubRpm(); };
  }, [user.school, user.id]);

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
        userId: user.id,
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
      setTimeout(() => setMessage(null), 3000);
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
      const result = await generateLKPDContent(rpm);
      if (result) {
        await updateDoc(doc(db, "lkpd", id), { ...result });
        setMessage({ text: 'Konten LKPD Sinkron dengan Langkah RPM!', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ text: "AI Gagal menyusun LKPD, silakan coba lagi.", type: "error" });
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
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { setMessage({ text: 'Gagal menghapus!', type: 'error' }); }
  };

  const splitByMeeting = (text: string, count: number) => {
    if (!text || text === '-') return Array(count).fill('');
    const pattern = /Pertemuan\s*(\d+)\s*:?/gi;
    const parts = text.split(pattern);
    
    if (parts.length <= 1) {
      const result = Array(count).fill('');
      result[0] = text;
      return result;
    }
    
    const result = Array(count).fill('');
    for (let i = 1; i < parts.length; i += 2) {
        const mNum = parseInt(parts[i]);
        if (mNum > 0 && mNum <= count) {
            result[mNum - 1] = (parts[i + 1] || '').trim();
        }
    }
    return result;
  };

  const renderListContent = (text: string | undefined, isPrint: boolean = false, cleanMeetingTags: boolean = false) => {
    if (!text || text === '-' || text.trim() === '') return '-';
    let processedText = text;
    if (cleanMeetingTags) processedText = text.replace(/Pertemuan\s*\d+\s*:?\s*/gi, '');
    
    const stepPattern = /(\d+[\.\)])\s+/g;
    const headerParts = processedText.split(/([A-C]\.\s+[A-Z\s]{4,})/g).filter(p => p.trim().length > 0);
    
    let items: { type: 'header' | 'step', content: string }[] = [];
    
    for (let i = 0; i < headerParts.length; i++) {
        const part = headerParts[i].trim();
        if (part.match(/^[A-C]\.\s+[A-Z\s]{4,}$/)) {
            items.push({ type: 'header', content: part.toUpperCase() });
        } else {
            const subParts = part.split(stepPattern).filter(sp => sp.trim().length > 0);
            let j = 0;
            while(j < subParts.length) {
                const sub = subParts[j].trim();
                if (sub.match(/^\d+[\.\)]$/)) {
                    const stepContent = subParts[j+1]?.trim() || '';
                    if (stepContent) { items.push({ type: 'step', content: stepContent }); j += 2; } 
                    else { j++; }
                } else {
                    if (items.length > 0 && items[items.length-1].type === 'step') { items[items.length-1].content += ' ' + sub; } 
                    else { items.push({ type: 'step', content: sub }); }
                    j++;
                }
            }
        }
    }

    if (items.length === 0) return <div className="whitespace-pre-wrap">{processedText}</div>;

    let stepCounter = 0;

    return (
      <div className="flex flex-col space-y-4 w-full">
        {items.map((item, i) => {
          if (item.type === 'header') {
            return (
              <div key={i} className={`mt-4 mb-2 border-l-[6px] border-slate-900 pl-4 bg-slate-100 py-2 rounded-r-2xl block w-full`}>
                <span className="font-black text-slate-900 text-[10px] tracking-[0.1em] uppercase font-sans leading-none">{item.content}</span>
              </div>
            );
          }
          stepCounter++;
          return (
            <div key={i} className="flex gap-4 items-start group break-inside-avoid w-full">
              <div className="shrink-0 pt-0.5">
                <div className={`font-black text-slate-800 ${isPrint ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[12px]'} bg-white rounded flex items-center justify-center border-[2px] border-slate-200 shadow-sm font-sans`}>
                  {stepCounter}
                </div>
              </div>
              <div className="flex-1">
                <div className={`leading-relaxed text-justify text-slate-800 ${isPrint ? 'text-[9pt]' : 'text-[13px]'} font-semibold`}>
                  {item.content.trim()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleBrowserPrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>LKPD - ${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; color: black; line-height: 1.6; }
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

    const renderListForWord = (text: string) => {
      const parts = text.split(/\n/g).map(l => l.replace(/^(\d+[\.\)]|\-|\*|•)\s*/, '').trim()).filter(l => l.length > 0);
      if (parts.length <= 1) return text.replace(/\n/g, '<br/>');
      return parts.map((p, i) => `<div style="margin-bottom: 3px;">${i+1}. ${p}</div>`).join('');
    };

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>LKPD</title><style>body { font-family: 'Arial', sans-serif; font-size: 10pt; } table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 5px; } .kop { text-align: center; border-bottom: 4px double black; padding-bottom: 10px; margin-bottom: 20px; } .section-title { background-color: #f3f4f6; padding: 5px; font-weight: bold; border-left: 10px solid black; margin-top: 15px; margin-bottom: 10px; } .meeting-header { background-color: #000; color: #fff; padding: 3px 15px; font-weight: bold; display: inline-block; font-size: 9pt; }</style></head><body>`;
    const footer = "</body></html>";
    
    let contentHtml = `<div class="kop"><h2 style="margin:0">${settings.schoolName}</h2><h1 style="margin:5px 0">LEMBAR KERJA PESERTA DIDIK (LKPD)</h1><p><b>${lkpd.mataPelajaran} | SEMESTER ${lkpd.semester} | TA ${activeYear}</b></p></div><table style="border:none; width:100%"><tr style="border:none"><td style="border:none; width:50%; font-weight: bold;">NAMA: ................................</td><td style="border:none; width:50%; font-weight: bold;">HARI/TGL: ................................</td></tr></table><div class="section-title">TUJUAN PEMBELAJARAN</div><p><i>"${lkpd.tujuanPembelajaran}"</i></p><div class="section-title">PETUNJUK BELAJAR</div><div>${renderListForWord(lkpd.petunjuk)}</div>`;

    for (let i = 0; i < jPertemuan; i++) {
      contentHtml += `<div style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 15px;"><div class="meeting-header">PERTEMUAN ${i + 1}</div><p><b>Ringkasan Materi:</b></p><div>${renderListForWord(materiParts[i] || '-')}</div><p><b>Langkah Kerja:</b></p><div>${renderListForWord(langkahParts[i] || '-')}</div><p><b>Tugas:</b></p><div>${renderListForWord(tugasParts[i] || '-')}</div></div>`;
    }

    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `LKPD_${lkpd.judul.replace(/ /g, '_')}.doc`; link.click();
  };

  const currentLKPD = useMemo(() => lkpdList.find(l => l.id === isEditing), [lkpdList, isEditing]);

  if (isPrintMode && currentLKPD) {
    const count = currentLKPD.jumlahPertemuan || 1;
    const materiParts = splitByMeeting(currentLKPD.materiRingkas, count);
    const langkahParts = splitByMeeting(currentLKPD.langkahKerja, count);
    const tugasParts = splitByMeeting(currentLKPD.tugasMandiri, count);

    return (
      <div className="bg-slate-100 min-h-screen p-8 animate-in fade-in duration-300 overflow-y-auto no-scrollbar">
        <div className="fixed top-8 right-8 z-[200] flex gap-3 no-print">
           <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-8 py-3 rounded-2xl text-xs font-black shadow-2xl flex items-center gap-2 hover:bg-black transition-all">
             <ArrowLeft size={16}/> KEMBALI
           </button>
           <button onClick={() => handleBrowserPrint()} className="bg-rose-600 text-white px-8 py-3 rounded-2xl text-xs font-black shadow-2xl flex items-center gap-2 hover:bg-rose-700 transition-all">
             <Printer size={16}/> CETAK SEKARANG
           </button>
        </div>

        <div ref={printRef} className="max-w-[21cm] mx-auto bg-white p-12 shadow-2xl rounded-3xl min-h-[29.7cm] text-black font-sans">
           <div className="text-center mb-6 border-b-4 border-double border-black pb-4">
              <p className="text-xs font-black uppercase tracking-widest leading-none">PEMERINTAH KABUPATEN GORONTALO</p>
              <h2 className="text-2xl font-black uppercase mt-1 leading-none">{settings.schoolName}</h2>
              <h1 className="text-xl font-black uppercase mt-3 tracking-tighter">LEMBAR KERJA PESERTA DIDIK (LKPD)</h1>
              <p className="text-[10px] font-bold mt-2 uppercase tracking-[0.2em] text-slate-500">{currentLKPD.mataPelajaran} | TA {activeYear}</p>
           </div>
           
           <div className="grid grid-cols-2 gap-10 mb-8 font-black uppercase text-[9pt] border-2 border-black p-5 rounded-2xl">
              <div className="space-y-1"><p>NAMA SISWA: ...................................................</p><p>KELAS / SEMESTER: {currentLKPD.kelas} / {currentLKPD.semester}</p></div>
              <div className="text-right space-y-1"><p>HARI/TGL: ..........................................</p><p>TARGET: PEMBELAJARAN MENDALAM</p></div>
           </div>

           <div className="space-y-10">
              <section><h3 className="font-black text-[10pt] border-l-[10px] border-black pl-4 mb-3 uppercase tracking-widest bg-slate-50 py-1">I. TUJUAN PEMBELAJARAN</h3><p className="text-justify leading-relaxed italic text-[11pt] font-semibold">"{currentLKPD.tujuanPembelajaran}"</p></section>
              <section><h3 className="font-black text-[10pt] border-l-[10px] border-black pl-4 mb-3 uppercase tracking-widest bg-slate-50 py-1">II. PETUNJUK KERJA</h3><div className="leading-relaxed whitespace-pre-wrap text-[10pt] font-medium">{currentLKPD.petunjuk}</div></section>
              
              <div className="border-t-2 border-black pt-10 space-y-16">
                 {Array.from({ length: count }).map((_, idx) => (
                    <div key={idx} className="break-inside-avoid border-b border-slate-100 pb-12 last:border-0">
                       <div className="bg-slate-900 text-white px-6 py-1.5 inline-block font-black text-[10pt] mb-6 uppercase rounded-full tracking-widest">PERTEMUAN {idx + 1}</div>
                       <div className="space-y-10">
                          <div className="pl-6 border-l-[6px] border-indigo-600">
                             <p className="font-black uppercase text-[9pt] mb-4 text-indigo-900 underline underline-offset-4 decoration-2">A. Ringkasan Materi</p>
                             <div className="text-justify leading-relaxed">{renderListContent(materiParts[idx] || '-', true, true)}</div>
                          </div>
                          <div className="pl-6 border-l-[6px] border-emerald-600">
                             <p className="font-black uppercase text-[9pt] mb-4 text-emerald-900 underline underline-offset-4 decoration-2">B. Langkah Aktivitas</p>
                             <div className="text-justify leading-relaxed">{renderListContent(langkahParts[idx] || '-', true, true)}</div>
                          </div>
                          <div className="bg-slate-50 p-8 border-2 border-dashed border-rose-200 rounded-[2rem] relative">
                             <div className="absolute -top-3 left-6 bg-rose-600 text-white px-4 py-0.5 rounded-full text-[8px] font-black uppercase">Tantangan Mandiri</div>
                             <div className="text-justify leading-relaxed font-bold">{renderListContent(tugasParts[idx] || '-', true, true)}</div>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="mt-20 grid grid-cols-2 text-center text-[9pt] font-black uppercase break-inside-avoid tracking-tighter">
              <div><p>Mengetahui,</p><p>Orang Tua / Wali Siswa</p><div className="h-24"></div><p>( .................................... )</p></div>
              <div><p>Bilato, ........................</p><p>Guru Mata Pelajaran</p><div className="h-24"></div><p className="border-b border-black inline-block min-w-[180px]">{user.name}</p><p className="mt-1 font-normal">NIP. {user.nip || '...................'}</p></div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}

      {deleteConfirmId && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4"><div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95"><div className="p-8 text-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus LKPD</h3><p className="text-slate-500 font-medium text-sm leading-relaxed">Hapus lembar kerja ini secara permanen?</p></div><div className="p-4 bg-slate-50 flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all font-sans">BATAL</button><button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg font-sans">YA, HAPUS</button></div></div></div>)}

      {showRpmPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95">
             <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3"><div className="p-2 bg-indigo-500 rounded-xl"><ListTree size={20}/></div><h3 className="font-black uppercase text-sm tracking-widest leading-none">Pilih Referensi RPM</h3></div>
                <button onClick={() => setShowRpmPicker(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20}/></button>
             </div>
             <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
                {filteredRpmForPicker.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <AlertCircle className="mx-auto text-slate-300" size={48}/>
                    <p className="text-slate-400 font-bold italic text-sm">Belum ada RPM Anda yang tersimpan. Silakan buat RPM terlebih dahulu.</p>
                  </div>
                ) : filteredRpmForPicker.map(rpm => (
                  <button key={rpm.id} onClick={() => handleSelectRpm(rpm)} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-left hover:border-indigo-500 hover:bg-white transition-all group flex items-center justify-between">
                     <div className="flex-1 pr-6">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Topik: {rpm.materi}</span>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">• {rpm.jumlahPertemuan} Pertemuan</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{rpm.tujuanPembelajaran}</h4>
                     </div>
                     <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {isEditing && currentLKPD && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-7xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3"><div className="p-2 bg-blue-500 rounded-xl shadow-lg"><PenTool size={20}/></div><div><h3 className="font-black uppercase text-sm tracking-widest leading-none">Editor Lembar Kerja</h3><p className="text-[10px] text-slate-400 font-bold tracking-tighter mt-1 uppercase">Terhubung dengan RPM: {currentLKPD.judul}</p></div></div>
                 <div className="flex gap-2">
                    <button onClick={() => setIsPrintMode(true)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all"><Printer size={14}/> PRATINJAU</button>
                    <button onClick={() => setIsEditing(null)} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-[10px] font-black transition-all">TUTUP</button>
                 </div>
              </div>
              <div className="p-8 overflow-y-auto space-y-10 no-scrollbar bg-slate-50/50">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><div className="w-1.5 h-6 bg-blue-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Identitas LKPD</h4></div>
                       <div className="grid grid-cols-1 gap-4 font-sans">
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Judul Lembar Kerja</label><input className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-black text-slate-800 outline-none" value={currentLKPD.judul} onChange={e => updateLKPD(isEditing!, 'judul', e.target.value)} /></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Petunjuk Belajar</label><textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs min-h-[100px] outline-none" value={currentLKPD.petunjuk} onChange={e => updateLKPD(isEditing!, 'petunjuk', e.target.value)} /></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Alat dan Bahan</label><textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs outline-none" value={currentLKPD.alatBahan} onChange={e => updateLKPD(isEditing!, 'alatBahan', e.target.value)} /></div>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex items-center justify-between border-b border-slate-100 pb-2"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Konten Per Pertemuan (AI)</h4></div><button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">{isLoadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} SINKRONKAN DARI RPM</button></div>
                       <div className="bg-white rounded-[40px] p-8 border border-slate-200 space-y-8 h-fit max-h-[500px] overflow-y-auto no-scrollbar shadow-inner">
                          {Array.from({ length: currentLKPD.jumlahPertemuan || 1 }).map((_, idx) => {
                             const materiParts = splitByMeeting(currentLKPD.materiRingkas, currentLKPD.jumlahPertemuan || 1);
                             const langkahParts = splitByMeeting(currentLKPD.langkahKerja, currentLKPD.jumlahPertemuan || 1);
                             const tugasParts = splitByMeeting(currentLKPD.tugasMandiri, currentLKPD.jumlahPertemuan || 1);
                             return (
                               <div key={idx} className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 space-y-6">
                                  <div className="flex items-center gap-3">
                                     <div className="px-5 py-1 bg-slate-900 text-white text-[10px] font-black rounded-full uppercase tracking-widest">PERTEMUAN {idx + 1}</div>
                                     <div className="flex-1 h-px bg-slate-200"></div>
                                  </div>
                                  <div className="space-y-6 font-sans">
                                    <div><label className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 block">A. Ringkasan Materi</label><div className="bg-white p-5 rounded-2xl border border-slate-200">{renderListContent(materiParts[idx], false, true)}</div></div>
                                    <div><label className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 block">B. Langkah Aktivitas</label><div className="bg-white p-5 rounded-2xl border border-slate-200">{renderListContent(langkahParts[idx], false, true)}</div></div>
                                    <div><label className="text-[9px] font-black text-rose-600 uppercase tracking-[0.2em] mb-3 block">C. Tantangan Mandiri</label><div className="bg-white p-5 rounded-2xl border border-rose-100">{renderListContent(tugasParts[idx], false, true)}</div></div>
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex justify-end shrink-0"><button onClick={() => setIsEditing(null)} className="bg-slate-900 text-white px-16 py-4 rounded-[2rem] text-xs font-black shadow-lg uppercase tracking-widest">SIMPAN & SELESAI</button></div>
           </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 items-end font-sans">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Mapel</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black outline-none" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>{MATA_PELAJARAN.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-1 tracking-widest">Kelas</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black outline-none" value={filterKelas} onChange={e => handleKelasChange(e.target.value as Kelas)}>{['1', '2', '3', '4', '5', '6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Semester</label><select className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-black outline-none" value={filterSemester} onChange={e => setFilterSemester(e.target.value as '1' | '2')}><option value="1">1 (Ganjil)</option><option value="2">2 (Genap)</option></select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Fase</label><div className="bg-slate-100 p-4 rounded-2xl text-xs font-black text-slate-500 border border-slate-200 uppercase">{filterFase}</div></div>
         </div>
         <button onClick={() => setShowRpmPicker(true)} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 uppercase tracking-widest"><Plus size={18}/> BUAT LKPD BARU</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
        {loading ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4 text-slate-400 italic"><Loader2 size={48} className="animate-spin text-blue-600"/><p className="text-xs font-black uppercase tracking-widest">Sinkronisasi Cloud...</p></div>
        ) : filteredLkpd.length === 0 ? (
          <div className="col-span-full py-40 text-center text-slate-400 font-black uppercase text-sm tracking-widest bg-white border-2 border-dashed border-slate-200 rounded-[48px]">Belum Ada LKPD Tersimpan</div>
        ) : filteredLkpd.map(lkpd => (
          <div key={lkpd.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex gap-6 items-center mb-8">
              <div className="p-5 bg-blue-100 text-blue-700 rounded-[2rem] group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner"><PenTool size={32}/></div>
              <div className="flex-1">
                <h4 className="text-base font-black text-slate-900 leading-tight uppercase line-clamp-2 mb-2">{lkpd.judul || 'LKPD TANPA JUDUL'}</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span className="text-indigo-600 px-3 py-1 bg-indigo-50 rounded-full">{lkpd.jumlahPertemuan || 1} PERTEMUAN</span>
                  <span className="text-blue-600 px-3 py-1 bg-blue-50 rounded-full">{lkpd.mataPelajaran}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-6 border-t border-slate-50">
              <button onClick={() => setIsEditing(lkpd.id)} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black hover:bg-black transition-all uppercase tracking-widest shadow-lg">EDIT & CETAK LKPD</button>
              <button onClick={() => setDeleteConfirmId(lkpd.id)} className="p-4 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LKPDManager;