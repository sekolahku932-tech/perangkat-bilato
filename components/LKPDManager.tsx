
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, LKPDItem, RPMItem, MATA_PELAJARAN, SchoolSettings, User } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X } from 'lucide-react';
import { generateLKPDContent } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from '../services/firebase';

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
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showRpmPicker, setShowRpmPicker] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: 'SD NEGERI 5 BILATO',
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });
  
  const [activeYear, setActiveYear] = useState('2025/2026');

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
    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find((d: any) => d.data().isActive);
      if (active) setActiveYear(active.data().year);
    });
    const unsubLkpd = onSnapshot(collection(db, "lkpd"), (snapshot) => {
      setLkpdList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LKPDItem[]);
    });
    const unsubRpm = onSnapshot(collection(db, "rpm"), (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
      setLoading(false);
    });
    return () => { unsubSettings(); unsubYears(); unsubLkpd(); unsubRpm(); };
  }, []);

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
        judul: `LKPD: ${rpm.materi}`,
        tujuanPembelajaran: rpm.tujuanPembelajaran,
        petunjuk: '',
        materiRingkas: '',
        langkahKerja: '',
        tugasMandiri: '',
        refleksi: '',
        jumlahPertemuan: rpm.jumlahPertemuan || 1
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
    if (!rpm) { setMessage({ text: 'Data RPM referensi tidak ditemukan!', type: 'error' }); return; }

    setIsLoadingAI(true);
    try {
      const result = await generateLKPDContent(rpm);
      if (result) {
        await updateDoc(doc(db, "lkpd", id), { ...result });
        setMessage({ text: 'Konten LKPD disusun oleh AI!', type: 'success' });
      }
    } catch (err) {
      setMessage({ text: 'AI Error', type: 'error' });
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
      setMessage({ text: 'LKPD Dihapus!', type: 'success' });
    } catch (e) { setMessage({ text: 'Gagal!', type: 'error' }); }
  };

  const splitByMeeting = (text: string) => {
    if (!text) return [];
    const pattern = /Pertemuan\s*\d+\s*:?/gi;
    const parts = text.split(pattern);
    return parts.filter(p => p.trim().length > 0).map(p => p.trim());
  };

  const renderListContent = (text: string | undefined, cleanMeetingTags: boolean = false) => {
    if (!text) return '-';
    let processedText = text;
    if (cleanMeetingTags) processedText = text.replace(/Pertemuan\s*\d+\s*:?\s*/gi, '');
    const steps = processedText.split(/(?=\d+\.)/g).map(s => s.trim()).filter(s => s.length > 0);
    if (steps.length <= 1) return <p className="whitespace-pre-wrap text-justify leading-relaxed">{processedText}</p>;
    return (
      <ul className="space-y-3 list-none">
        {steps.map((step, i) => {
          const numberPart = step.match(/^\d+\./)?.[0] || '';
          const contentPart = step.replace(/^\d+\.\s*/, '');
          return (
            <li key={i} className="flex gap-3 items-start">
              {numberPart && <span className="shrink-0 font-black text-slate-800 mt-1">{numberPart}</span>}
              <span className="leading-relaxed text-justify flex-1">{contentPart}</span>
            </li>
          );
        })}
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
            <title>Cetak LKPD - SDN 5 Bilato</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; }
              @media print { 
                .no-print { display: none !important; }
                body { padding: 0; }
              }
              .break-inside-avoid { page-break-inside: avoid; }
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
    const materiParts = splitByMeeting(lkpd.materiRingkas);
    const langkahParts = splitByMeeting(lkpd.langkahKerja);
    const tugasParts = splitByMeeting(lkpd.tugasMandiri);
    const refleksiParts = splitByMeeting(lkpd.refleksi);

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>LKPD</title><style>table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 5px; font-family: 'Arial'; font-size: 10pt; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .uppercase { text-transform: uppercase; } h1, h2, h3 { margin: 5px 0; text-align: center; } .section-title { background-color: #f3f4f6; padding: 5px; font-weight: bold; border-left: 10px solid black; margin-top: 15px; margin-bottom: 10px; } .meeting-header { background-color: #000; color: #fff; padding: 5px 15px; font-weight: bold; display: inline-block; } .item-label { font-weight: bold; margin-top: 10px; color: #333; }</style></head><body>`;
    const footer = "</body></html>";
    
    let contentHtml = `
      <div style="text-align:center">
        <h2 style="margin:0">${settings.schoolName}</h2>
        <h1 style="margin:0">LEMBAR KERJA PESERTA DIDIK (LKPD)</h1>
        <p style="font-size:10pt"><b>${lkpd.mataPelajaran} | SEMESTER ${lkpd.semester} | TA ${activeYear}</b></p>
      </div>
      <br/>
      <table style="border:none; width:100%">
        <tr style="border:none">
          <td style="border:none; width:50%">NAMA: ................................</td>
          <td style="border:none; width:50%">HARI/TGL: ................................</td>
        </tr>
        <tr style="border:none">
          <td style="border:none">KELAS: ${lkpd.kelas}</td>
          <td style="border:none">KELOMPOK: ................................</td>
        </tr>
      </table>
      <br/>
      <div class="section-title">TUJUAN PEMBELAJARAN</div>
      <p><i>"${lkpd.tujuanPembelajaran}"</i></p>
      <div class="section-title">PETUNJUK BELAJAR</div>
      <p>${lkpd.petunjuk.replace(/\n/g, '<br/>')}</p>
    `;

    for (let i = 0; i < jPertemuan; i++) {
      contentHtml += `
        <div style="${jPertemuan > 1 ? 'border-top: 1px solid #ccc; margin-top: 20px; padding-top: 10px;' : 'margin-top: 10px;'}">
          ${jPertemuan > 1 ? `<div class="meeting-header">PERTEMUAN ${i + 1}</div>` : ''}
          <p class="item-label">MATERI RINGKAS:</p>
          <div style="padding: 10px; border: 1px dashed #ccc; background-color: #f9f9f9;">${(materiParts[i] || '-').replace(/\n/g, '<br/>')}</div>
          <table style="border:none; width:100%; margin-top: 10px;">
            <tr style="border:none">
              <td style="border:none; width:50%; vertical-align: top;">
                <p class="item-label">LANGKAH KERJA:</p>
                <p>${(langkahParts[i] || '-').replace(/\n/g, '<br/>')}</p>
              </td>
              <td style="border:none; width:50%; vertical-align: top;">
                <p class="item-label">TANTANGAN MANDIRI:</p>
                <p>${(tugasParts[i] || '-').replace(/\n/g, '<br/>')}</p>
              </td>
            </tr>
          </table>
          <p class="item-label">REFLEKSI BELAJARKU:</p>
          <p><i>${(refleksiParts[i] || '-').replace(/\n/g, '<br/>')}</i></p>
        </div>
      `;
    }

    contentHtml += `
      <br/><br/>
      <table style="border:none; width:100%">
        <tr style="border:none">
          <td style="border:none; text-align:center; width:30%">
            NILAI<br/><br/>
            <div style="border:2px solid black; width:60px; height:60px; line-height:60px; margin:auto; font-size:20pt">?</div>
          </td>
          <td style="border:none; width:40%"></td>
          <td style="border:none; text-align:center; width:30%">
            PARAF GURU<br/><br/><br/><br/><br/>
            <b>${user.name}</b>
          </td>
        </tr>
      </table>
    `;

    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LKPD_${lkpd.judul.replace(/ /g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isPrintMode && isEditing) {
    const lkpd = lkpdList.find(l => l.id === isEditing)!;
    const jPertemuan = lkpd.jumlahPertemuan || 1;
    const materiParts = splitByMeeting(lkpd.materiRingkas);
    const langkahParts = splitByMeeting(lkpd.langkahKerja);
    const tugasParts = splitByMeeting(lkpd.tugasMandiri);
    const refleksiParts = splitByMeeting(lkpd.refleksi);

    return (
      <div className="bg-white min-h-screen text-slate-900 p-8 font-sans print:p-0">
        <div className="no-print mb-6 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200">
           <div className="flex gap-2">
             <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-black">KEMBALI</button>
             <button onClick={handleExportWord} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm"><FileDown size={16}/> UNDUH WORD</button>
           </div>
           <button onClick={handlePrint} className="bg-rose-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-sm flex items-center gap-2"><Printer size={16}/> CETAK PDF</button>
        </div>

        <div ref={printRef} className="max-w-[21cm] mx-auto bg-white p-10 border-2 border-black shadow-none flex flex-col">
          <div className="text-center mb-8 pb-4 border-b-4 border-double border-black">
            <h1 className="text-xl font-black uppercase">{settings.schoolName}</h1>
            <h2 className="text-2xl font-black uppercase mt-1">LEMBAR KERJA PESERTA DIDIK (LKPD)</h2>
            <p className="text-xs font-bold mt-2 uppercase tracking-widest">{lkpd.mataPelajaran} | SEMESTER {lkpd.semester} | TA {activeYear}</p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-8 text-[12px] font-bold uppercase">
             <div className="space-y-2">
                <div className="flex"><span>NAMA</span><span className="ml-8 mr-2">:</span><div className="flex-1 border-b border-dotted border-black"></div></div>
                <div className="flex"><span>KELAS</span><span className="ml-6 mr-2">:</span><div className="flex-1">{lkpd.kelas}</div></div>
             </div>
             <div className="space-y-2">
                <div className="flex"><span>HARI/TGL</span><span className="ml-4 mr-2">:</span><div className="flex-1 border-b border-dotted border-black"></div></div>
                <div className="flex"><span>KELOMPOK</span><span className="ml-2 mr-2">:</span><div className="flex-1 border-b border-dotted border-black"></div></div>
             </div>
          </div>

          <div className="space-y-8 flex-1">
             <div>
               <h3 className="bg-slate-100 p-2 font-black text-xs border-l-8 border-black uppercase mb-3">Tujuan Pembelajaran</h3>
               <p className="text-[12px] leading-relaxed font-bold italic">"{lkpd.tujuanPembelajaran}"</p>
             </div>

             <div>
               <h3 className="bg-slate-100 p-2 font-black text-xs border-l-8 border-black uppercase mb-3">Petunjuk Belajar</h3>
               <div className="text-[12px] text-slate-700">{renderListContent(lkpd.petunjuk)}</div>
             </div>

             {/* Loop Pertemuan */}
             {Array.from({ length: jPertemuan }).map((_, idx) => (
               <div key={idx} className={`space-y-6 ${idx > 0 || jPertemuan > 1 ? 'pt-6 border-t border-slate-200' : ''} break-inside-avoid`}>
                 {jPertemuan > 1 && (
                   <div className="flex items-center gap-3">
                     <div className="bg-black text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest">PERTEMUAN {idx + 1}</div>
                     <div className="flex-1 h-0.5 bg-slate-200"></div>
                   </div>
                 )}

                 <div>
                   <p className="font-black text-[11px] mb-2 uppercase text-slate-500">Materi Ringkas:</p>
                   <div className="p-4 border-2 border-dotted border-slate-300 rounded-xl bg-slate-50 text-[12px] leading-relaxed">
                      {renderListContent(materiParts[idx] || '-', true)}
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <p className="font-black text-[11px] mb-2 uppercase text-indigo-700">Langkah Kerja:</p>
                     <div className="text-[12px]">{renderListContent(langkahParts[idx] || '-', true)}</div>
                   </div>
                   <div>
                     <p className="font-black text-[11px] mb-2 uppercase text-rose-700">Tantangan Mandiri:</p>
                     <div className="text-[12px]">{renderListContent(tugasParts[idx] || '-', true)}</div>
                   </div>
                 </div>

                 <div>
                   <p className="font-black text-[11px] mb-2 uppercase text-emerald-700">Refleksi Belajarku:</p>
                   <div className="text-[12px] italic text-slate-600 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                      {renderListContent(refleksiParts[idx] || '-', true)}
                   </div>
                 </div>
               </div>
             ))}
          </div>

          <div className="mt-12 pt-8 border-t-2 border-black flex justify-between items-center text-[10px] font-black uppercase">
             <div className="text-center">
                <p>NILAI</p>
                <div className="w-20 h-20 border-2 border-black mx-auto mt-2 flex items-center justify-center text-2xl">?</div>
             </div>
             <div className="text-center">
                <p>PARAF GURU</p>
                <div className="h-20"></div>
                <p className="border-b border-black inline-block min-w-[150px]">{user.name}</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
      {message && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus LKPD</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">Hapus lembar kerja ini dari database cloud?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100">BATAL</button>
              <button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 shadow-lg">YA, HAPUS</button>
            </div>
          </div>
        </div>
      )}

      {showRpmPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 rounded-2xl shadow-lg"><Search size={24}/></div>
                <div>
                  <h3 className="font-black uppercase text-lg tracking-widest leading-none">Pilih Referensi RPM</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1 uppercase">UNTUK KELAS {filterKelas} | SEMESTER {filterSemester}</p>
                </div>
              </div>
              <button onClick={() => setShowRpmPicker(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {filteredRpmForPicker.length === 0 ? (
                <div className="text-center py-20 text-slate-400 italic font-bold">Belum ada RPM yang disusun untuk kelas & semester ini.</div>
              ) : (
                filteredRpmForPicker.map((rpm) => (
                  <button key={rpm.id} onClick={() => handleSelectRpm(rpm)} className="w-full text-left p-6 bg-white border border-slate-200 rounded-[32px] hover:border-blue-500 transition-all group shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-black text-slate-900 uppercase line-clamp-1">{rpm.materi}</h4>
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-black">{rpm.jumlahPertemuan || 1} PERTEMUAN</span>
                        </div>
                        <p className="text-[11px] text-slate-500 italic leading-relaxed line-clamp-2">{rpm.tujuanPembelajaran}</p>
                      </div>
                      <Plus className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all" size={24}/>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-7xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-500 rounded-xl shadow-lg"><PenTool size={20}/></div>
                 <div>
                   <h3 className="font-black uppercase text-sm tracking-widest leading-none">Editor LKPD {lkpdList.find(l => l.id === isEditing)?.jumlahPertemuan || 1} Pertemuan</h3>
                   <p className="text-[10px] text-slate-400 font-bold tracking-tighter mt-1 uppercase">SINKRONISASI CLOUD AKTIF</p>
                 </div>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setIsPrintMode(true)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all"><Printer size={14}/> PRATINJAU</button>
                 <button onClick={() => setIsEditing(null)} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-[10px] font-black transition-all">TUTUP</button>
               </div>
            </div>
            <div className="p-8 overflow-y-auto space-y-10 no-scrollbar bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-blue-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Konten Lembar Kerja</h4></div>
                <button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl text-xs font-black shadow-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all">
                  {isLoadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} SUSUN OTOMATIS (AI)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Judul LKPD</label>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-800 outline-none" value={lkpdList.find(l => l.id === isEditing)?.judul} onChange={e => updateLKPD(isEditing!, 'judul', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Petunjuk Belajar (Umum)</label>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs min-h-[120px]" value={lkpdList.find(l => l.id === isEditing)?.petunjuk} onChange={e => updateLKPD(isEditing!, 'petunjuk', e.target.value)} placeholder="Tulis instruksi langkah demi langkah..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Materi Ringkas (Gunakan Pertemuan X: jika perlu)</label>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs min-h-[200px]" value={lkpdList.find(l => l.id === isEditing)?.materiRingkas} onChange={e => updateLKPD(isEditing!, 'materiRingkas', e.target.value)} placeholder="Pertemuan 1: ..." />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Langkah Kerja (Gunakan Pertemuan X: jika perlu)</label>
                    <textarea className="w-full bg-blue-50/30 border border-blue-100 rounded-2xl p-4 text-xs min-h-[200px]" value={lkpdList.find(l => l.id === isEditing)?.langkahKerja} onChange={e => updateLKPD(isEditing!, 'langkahKerja', e.target.value)} placeholder="Pertemuan 1: ..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Tugas Mandiri (Gunakan Pertemuan X: jika perlu)</label>
                    <textarea className="w-full bg-rose-50/30 border border-rose-100 rounded-2xl p-4 text-xs min-h-[200px]" value={lkpdList.find(l => l.id === isEditing)?.tugasMandiri} onChange={e => updateLKPD(isEditing!, 'tugasMandiri', e.target.value)} placeholder="Pertemuan 1: ..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Pertanyaan Refleksi (Gunakan Pertemuan X: jika perlu)</label>
                    <textarea className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-xs min-h-[200px]" value={lkpdList.find(l => l.id === isEditing)?.refleksi} onChange={e => updateLKPD(isEditing!, 'refleksi', e.target.value)} placeholder="Pertemuan 1: ..." />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={() => setIsEditing(null)} className="bg-slate-900 text-white px-12 py-3 rounded-2xl text-[11px] font-black shadow-lg">SIMPAN & SELESAI</button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default LKPDManager;
