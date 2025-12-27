
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, RPMItem, ATPItem, PromesItem, CapaianPembelajaran, MATA_PELAJARAN, DIMENSI_PROFIL, SchoolSettings, User, LIST_SEKOLAH } from '../types';
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, ClipboardList, Info, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Heart, Brain, Zap, Smile, Search, RefreshCw, CheckSquare, Square, AlertCircle, Cpu } from 'lucide-react';
import { generateRPMContent, generateAssessmentDetails, recommendPedagogy } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from '../services/firebase';

interface RubricItem {
  aspek: string;
  level4: string;
  level3: string;
  level2: string;
  level1: string;
}

interface AsesmenRow {
  kategori: string;
  teknik: string;
  bentuk: string;
  instruksi?: string;
  instrumen?: string[];
  rubrikDetail?: RubricItem[];
}

interface RPMManagerProps {
  user: User;
}

const RPMManager: React.FC<RPMManagerProps> = ({ user }) => {
  const [rpmList, setRpmList] = useState<RPMItem[]>([]);
  const [atpData, setAtpData] = useState<ATPItem[]>([]);
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [promesData, setPromesData] = useState<PromesItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterKelas, setFilterKelas] = useState<Kelas>('1');
  const [filterSemester, setFilterSemester] = useState<'1' | '2'>('1');
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isLoadingPedagogyAI, setIsLoadingPedagogyAI] = useState(false);
  const [isLoadingAsesmenAI, setIsLoadingAsesmenAI] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>(() => {
    const savedId = localStorage.getItem('selectedSchoolId');
    const school = LIST_SEKOLAH.find(s => s.id === savedId);
    return {
      schoolName: school?.name || 'SD NEGERI BILATO',
      address: 'Kecamatan Bilato, Kabupaten Gorontalo',
      principalName: 'Nama Kepala Sekolah',
      principalNip: '-'
    };
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

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak RPM - ${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; }
              @media print { 
                .no-print { display: none !important; }
                body { padding: 0; }
              }
              .break-inside-avoid { page-break-inside: avoid; }
              table { border-collapse: collapse; }
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

  const renderAsesmenTable = (data: AsesmenRow[], isPrint = false) => {
    const categories = {
      'AWAL': { label: 'Asesmen Awal (Kesiapan)', color: 'bg-rose-600' },
      'PROSES': { label: 'Asesmen Proses (Formatif)', color: 'bg-indigo-600' },
      'AKHIR': { label: 'Asesmen Akhir (Sumatif)', color: 'bg-emerald-600' }
    };

    return (
      <div className="space-y-12">
        {data.map((row, idx) => {
          const config = categories[row.kategori as keyof typeof categories] || { label: row.kategori, color: 'bg-slate-900' };
          return (
            <div key={idx} className="break-inside-avoid">
              <div className={`flex items-center gap-3 mb-4`}>
                <div className={`px-4 py-1.5 ${config.color} text-white rounded-xl shadow-lg text-[10px] font-black uppercase tracking-widest`}>
                  {config.label}
                </div>
                <div className="flex-1 h-px bg-slate-200"></div>
                <div className="text-[11px] font-black text-slate-400 uppercase italic">
                  {row.teknik} | {row.bentuk}
                </div>
              </div>
              
              {row.instruksi && (
                <div className={`mb-4 p-4 rounded-2xl border-2 border-dashed ${isPrint ? 'bg-slate-50 border-slate-300 text-black' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <p className={`text-[11px] font-medium leading-relaxed italic`}>"Instruksi Guru: {row.instruksi}"</p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className={`w-full border-collapse border-2 border-black text-[10px] ${isPrint ? '' : 'text-slate-800'}`}>
                  <thead>
                    <tr className="bg-slate-100 text-black font-black uppercase text-center h-10">
                      <th className="border-2 border-black p-2 text-left w-32">Kriteria / Aspek</th>
                      <th className="border-2 border-black p-2 w-32">Sangat Baik (4)</th>
                      <th className="border-2 border-black p-2 w-32">Baik (3)</th>
                      <th className="border-2 border-black p-2 w-32">Cukup (2)</th>
                      <th className="border-2 border-black p-2 w-32">Perlu Bimb. (1)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.rubrikDetail?.map((rub, ridx) => (
                      <tr key={ridx}>
                        <td className={`border-2 border-black p-3 font-bold uppercase leading-tight bg-slate-50/50`}>{rub.aspek}</td>
                        <td className="border-2 border-black p-3 text-justify leading-relaxed">{rub.level4}</td>
                        <td className="border-2 border-black p-3 text-justify leading-relaxed">{rub.level3}</td>
                        <td className="border-2 border-black p-3 text-justify leading-relaxed">{rub.level2}</td>
                        <td className="border-2 border-black p-3 text-justify leading-relaxed">{rub.level1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleExportWord = () => {
    const rpm = rpmList.find(r => r.id === isEditing);
    if (!rpm) return;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>RPM</title><style>table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 5px; font-family: 'Arial'; font-size: 10px; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .uppercase { text-transform: uppercase; } ul { margin: 0; padding-left: 20px; } li { margin-bottom: 5px; text-align: justify; } h4 { margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }</style></head><body>`;
    const footer = "</body></html>";
    
    let contentHtml = `
      <div style="text-align:center">
        <h2 style="margin:0">RENCANA PEMBELAJARAN MENDALAM (RPM)</h2>
        <h3 style="margin:5px 0">${settings.schoolName}</h3>
      </div>
      <br/>
      <table style="width:100%">
        <tr><td width="30%"><b>Penyusun</b></td><td>${user.name}</td></tr>
        <tr><td><b>Satuan Pendidikan</b></td><td>${settings.schoolName}</td></tr>
        <tr><td><b>Mata Pelajaran</b></td><td>${rpm.mataPelajaran}</td></tr>
        <tr><td><b>Kelas / Semester</b></td><td>${rpm.kelas} / ${rpm.semester}</td></tr>
        <tr><td><b>Alokasi Waktu</b></td><td>${rpm.alokasiWaktu}</td></tr>
      </table>
      <br/>
      <h4>1. TUJUAN PEMBELAJARAN</h4>
      <p style="text-align:justify">${rpm.tujuanPembelajaran}</p>
      <br/>
      <h4>2. PENGALAMAN BELAJAR (3M)</h4>
      <p><b>I. MEMAHAMI (AWAL):</b><br/>${rpm.kegiatanAwal.replace(/\n/g, '<br/>')}</p>
      <p><b>II. MENGAPLIKASI (INTI):</b><br/>${rpm.kegiatanInti.replace(/\n/g, '<br/>')}</p>
      <p><b>III. MEREFLEKSI (PENUTUP):</b><br/>${rpm.kegiatanPenutup.replace(/\n/g, '<br/>')}</p>
    `;

    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPM_${rpm.materi || 'Materi'}_Kls${rpm.kelas}.doc`;
    link.click();
    URL.revokeObjectURL(url);
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
    const unsubRpm = onSnapshot(collection(db, "rpm"), (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
    });
    const unsubAtp = onSnapshot(collection(db, "atp"), (snapshot) => {
      setAtpData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });
    const unsubCps = onSnapshot(collection(db, "cps"), (snapshot) => {
      setCps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });
    const unsubPromes = onSnapshot(collection(db, "promes"), (snapshot) => {
      setPromesData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PromesItem[]);
      setLoading(false);
    });
    return () => { unsubSettings(); unsubYears(); unsubRpm(); unsubAtp(); unsubCps(); unsubPromes(); };
  }, []);

  const sortedAtpOptions = useMemo(() => {
    const filtered = atpData.filter(a => 
      a.fase === filterFase && 
      a.kelas === filterKelas && 
      (a.mataPelajaran || '').trim().toLowerCase() === filterMapel.trim().toLowerCase()
    );
    return filtered.sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
  }, [atpData, filterFase, filterKelas, filterMapel]);

  const sortedRPM = useMemo(() => {
    const filtered = rpmList.filter(r => r.fase === filterFase && r.kelas === filterKelas && r.semester === filterSemester && r.mataPelajaran === filterMapel);
    return filtered.sort((a, b) => {
      const atpA = atpData.find(atp => atp.tujuanPembelajaran === a.tujuanPembelajaran);
      const atpB = atpData.find(atp => atp.tujuanPembelajaran === b.tujuanPembelajaran);
      return (atpA?.indexOrder || 99) - (atpB?.indexOrder || 99);
    });
  }, [rpmList, atpData, filterFase, filterKelas, filterSemester, filterMapel]);

  const splitByMeeting = (text: string, count: number) => {
    if (!text) return Array(count).fill('');
    const pattern = /Pertemuan\s*\d+\s*:?/gi;
    const parts = text.split(pattern).filter(p => p !== undefined);
    if (parts[0]?.trim() === '') parts.shift();
    const result = Array(count).fill('');
    for (let i = 0; i < count; i++) {
      result[i] = (parts[i] || '').trim();
    }
    return result;
  };

  const highlightContent = (content: string) => {
    const keywords = ['Berkesadaran', 'Bermakna', 'Menggembirakan', 'Mindful', 'Meaningful', 'Joyful'];
    let result = content;
    keywords.forEach(word => {
      const regex = new RegExp(`\\b(${word})\\b`, 'gi');
      result = result.replace(regex, '<strong class="text-black font-black">$1</strong>');
    });
    return result;
  };

  const renderListContent = (text: string | undefined, cleanMeetingTags: boolean = false) => {
    if (!text) return '-';
    let processedText = text;
    if (cleanMeetingTags) processedText = text.replace(/Pertemuan\s*\d+\s*:?\s*/gi, '');
    
    let lines = processedText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length === 1) {
      const potentialSteps = processedText.split(/(?<=\.)\s+(?=[A-Z0-9])/g).map(s => s.trim()).filter(s => s.length > 0);
      if (potentialSteps.length > 1) {
        lines = potentialSteps;
      }
    }

    return (
      <ul className="space-y-2 list-none">
        {lines.map((step, i) => {
          const cleanedStep = step.replace(/^(\d+\.|\-|\*)\s*/, '');
          return (
            <li key={i} className="flex gap-2 items-start">
              <span className="shrink-0 font-black text-slate-800 mt-0.5 min-w-[1.2rem]">{i + 1}.</span>
              <span className="leading-tight text-justify flex-1" dangerouslySetInnerHTML={{ __html: highlightContent(cleanedStep) }}></span>
            </li>
          );
        })}
      </ul>
    );
  };

  const handleAddRPM = async () => {
    try {
      const docRef = await addDoc(collection(db, "rpm"), {
        atpId: '', fase: filterFase, kelas: filterKelas, semester: filterSemester, mataPelajaran: filterMapel,
        tujuanPembelajaran: '', materi: '', subMateri: '', alokasiWaktu: '', jumlahPertemuan: 1,
        asesmenAwal: '', dimensiProfil: [], praktikPedagogis: '', kemitraan: '',
        lingkunganBelajar: '', pemanfaatanDigital: '', kegiatanAwal: '', kegiatanInti: '', kegiatanPenutup: '', asesmenTeknik: ''
      });
      setIsEditing(docRef.id);
    } catch (e) { setMessage({ text: 'Gagal membuat RPM', type: 'error' }); }
  };

  const updateRPM = async (id: string, field: keyof RPMItem, value: any) => {
    try { await updateDoc(doc(db, "rpm", id), { [field]: value }); } catch (e) { console.error(e); }
  };

  const syncWithATP = async (id: string, atpId: string) => {
    const atp = atpData.find(a => a.id === atpId);
    if (!atp) return;
    const promes = promesData.find(p => p.tujuanPembelajaran === atp.tujuanPembelajaran);
    const selectedDimensi: string[] = [];
    const rawText = ((atp.dimensiProfilLulusan || '') + ' ' + (atp.tujuanPembelajaran || '')).toLowerCase();
    const mapping = [
      { key: DIMENSI_PROFIL[0], words: ['keimanan', 'ketakwaan', 'beriman', 'takwa', 'akhlak', 'tuhan', 'esa'] }, 
      { key: DIMENSI_PROFIL[1], words: ['kewargaan', 'kebinekaan', 'global', 'negara', 'warga'] },       
      { key: DIMENSI_PROFIL[2], words: ['penalaran kritis', 'bernalar kritis', 'kritis', 'analisis', 'logis'] },    
      { key: DIMENSI_PROFIL[3], words: ['kreativitas', 'kreatif', 'karya', 'cipta'] },                           
      { key: DIMENSI_PROFIL[4], words: ['kolaborasi', 'gotong royong', 'kerjasama', 'tim', 'bersama'] },          
      { key: DIMENSI_PROFIL[5], words: ['kemandirian', 'mandiri', 'sendiri', 'disiplin'] },                           
      { key: DIMENSI_PROFIL[6], words: ['kesehatan', 'jasmani', 'sehat', 'olahraga', 'fisik'] },                    
      { key: DIMENSI_PROFIL[7], words: ['komunikasi', 'bahasa', 'bicara', 'presentasi', 'interaksi'] }                    
    ];
    mapping.forEach(m => { if (m.words.some(word => rawText.includes(word))) selectedDimensi.push(m.key); });
    try {
      await updateDoc(doc(db, "rpm", id), {
        atpId, tujuanPembelajaran: atp.tujuanPembelajaran, materi: atp.materi, subMateri: atp.subMateri,
        alokasiWaktu: promes?.alokasiWaktu || atp.alokasiWaktu, asesmenAwal: atp.asesmenAwal, dimensiProfil: selectedDimensi
      });
      setMessage({ text: 'Sync Berhasil!', type: 'success' });
    } catch (e) { console.error(e); }
  };

  const handleGenerateAI = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) { setMessage({ text: 'Pilih TP dulu!', type: 'error' }); return; }
    setIsLoadingAI(true);
    try {
      const result = await generateRPMContent(rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, rpm.praktikPedagogis, rpm.alokasiWaktu, rpm.jumlahPertemuan || 1);
      if (result) { await updateDoc(doc(db, "rpm", id), { ...result }); setMessage({ text: 'Analisis AI Berhasil!', type: 'success' }); }
    } catch (err) { setMessage({ text: 'AI Error', type: 'error' }); }
    finally { setIsLoadingAI(false); }
  };

  const handleGenerateAsesmenAI = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.atpId) { setMessage({ text: 'Hubungkan ATP dulu!', type: 'error' }); return; }
    const atp = atpData.find(a => a.id === rpm.atpId);
    if (!atp) return;
    setIsLoadingAsesmenAI(true);
    try {
      const result = await generateAssessmentDetails(rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, atp.asesmenAwal, atp.asesmenProses, atp.asesmenAkhir);
      if (result) { await updateDoc(doc(db, "rpm", id), { asesmenTeknik: result }); setMessage({ text: '3 Rubrik Asesmen Selesai disusun!', type: 'success' }); }
    } catch (err) { setMessage({ text: 'Rubrik AI Error', type: 'error' }); } finally { setIsLoadingAsesmenAI(false); }
  };

  const parseAsesmen = (json: string): AsesmenRow[] | null => { try { const parsed = JSON.parse(json); return Array.isArray(parsed) ? parsed : null; } catch { return null; } };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { await deleteDoc(doc(db, "rpm", deleteConfirmId)); setDeleteConfirmId(null); setMessage({ text: 'Dihapus!', type: 'success' }); } catch (e) { setMessage({ text: 'Gagal!', type: 'error' }); }
  };

  const getRPMDate = (rpm: RPMItem) => {
    const matchingPromes = promesData.find(p => p.tujuanPembelajaran === rpm.tujuanPembelajaran && p.kelas === rpm.kelas && p.mataPelajaran === rpm.mataPelajaran);
    if (!matchingPromes || !matchingPromes.bulanPelaksanaan) return new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'});
    const dates = matchingPromes.bulanPelaksanaan.split(',');
    const lastDateRaw = dates[dates.length - 1]; 
    const parts = lastDateRaw.split('|');
    if (parts.length < 3) return new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'});
    const month = parts[0]; const day = parts[2];
    const yearParts = activeYear.split('/');
    const year = matchingPromes.semester === '1' ? yearParts[0] : yearParts[1];
    return `${day} ${month} ${year}`;
  };

  const handleRecommendPedagogy = async (id: string) => {
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.atpId) return;
    const atp = atpData.find(a => a.id === rpm.atpId);
    if (!atp) return;
    setIsLoadingPedagogyAI(true);
    try {
      const result = await recommendPedagogy(rpm.tujuanPembelajaran, atp.alurTujuanPembelajaran, rpm.materi, rpm.kelas);
      if (result) { await updateDoc(doc(db, "rpm", id), { praktikPedagogis: result.modelName }); setMessage({ text: `Rekomendasi AI: ${result.modelName}.`, type: 'info' }); }
    } catch (err) { setMessage({ text: 'Gagal mendapatkan rekomendasi AI', type: 'error' }); } finally { setIsLoadingPedagogyAI(false); }
  };

  if (isPrintMode && isEditing) {
    const rpm = rpmList.find(r => r.id === isEditing)!;
    const count = rpm.jumlahPertemuan || 1;
    const asesmenData = parseAsesmen(rpm.asesmenTeknik);
    const datumDate = getRPMDate(rpm);
    
    const awalParts = splitByMeeting(rpm.kegiatanAwal, count);
    const intiParts = splitByMeeting(rpm.kegiatanInti, count);
    const penutupParts = splitByMeeting(rpm.kegiatanPenutup, count);
    
    const SidebarSection = ({ title }: { title: string }) => (
      <div className="w-12 uppercase font-black text-[9px] text-black border-r-2 border-black shrink-0 text-center flex items-center justify-center bg-slate-50/50">
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{title}</span>
      </div>
    );

    return (
      <div className="bg-white min-h-screen text-slate-900 p-6 font-sans print:p-0">
        <div className="no-print mb-4 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200">
           <div className="flex gap-2">
             <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-black">KEMBALI</button>
             <button onClick={() => handleExportWord()} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2"><FileDown size={16}/> WORD</button>
           </div>
           <button onClick={handlePrint} className="bg-rose-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-sm flex items-center gap-2"><Printer size={16}/> CETAK PDF</button>
        </div>

        <div ref={printRef} className="max-w-[21cm] mx-auto bg-white p-4 shadow-none">
          <div className="text-center mb-6 pb-2 border-b-2 border-black">
            <h1 className="text-xl font-black uppercase tracking-[0.2em] text-black">RENCANA PEMBELAJARAN MENDALAM</h1>
            <h2 className="text-sm font-bold uppercase text-slate-600">{settings.schoolName}</h2>
          </div>

          <div className="mb-6 border-2 border-black">
            <div className="bg-slate-100 border-b-2 border-black px-3 py-1 font-black text-[10px] uppercase tracking-widest">IDENTITAS</div>
            <table className="w-full text-[10.5px] border-collapse">
              <tbody>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Penyusun / Satuan</td><td className="p-1.5 font-bold uppercase">{user.name} / {settings.schoolName}</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Tahun / Semester</td><td className="p-1.5">{activeYear} / {rpm.semester} ({rpm.semester === '1' ? 'Ganjil' : 'Genap'})</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Mata Pelajaran</td><td className="p-1.5 font-bold uppercase">{rpm.mataPelajaran}</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Kelas / Fase</td><td className="p-1.5 font-bold">{rpm.kelas} / {rpm.fase.replace('Fase ', '')}</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Bab / Topik</td><td className="p-1.5 font-bold uppercase">{rpm.materi} {rpm.subMateri ? `(${rpm.subMateri})` : ''}</td></tr>
                <tr><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Alokasi Waktu</td><td className="p-1.5 font-bold">{rpm.alokasiWaktu} ({count} Pertemuan)</td></tr>
              </tbody>
            </table>
          </div>

          <div className="flex border-2 border-black mb-6 break-inside-avoid">
            <SidebarSection title="IDENTIFIKASI" />
            <div className="flex-1 p-4 space-y-4">
              <div>
                 <p className="font-bold text-[9px] uppercase text-slate-500 mb-1">Asesmen Awal (Dari ATP):</p>
                 <div className="p-3 bg-slate-50 border-2 border-dotted border-slate-300 italic text-[10.5px] leading-tight rounded-xl">
                  {rpm.asesmenAwal || '-'}
                 </div>
              </div>
              <div>
                <p className="font-bold text-[9px] uppercase text-slate-500 mb-2">Dimensi Profil Lulusan (DPL):</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {DIMENSI_PROFIL.map((d, i) => {
                    const isChecked = rpm.dimensiProfil.includes(d);
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="mt-0.5 transition-all">
                          {isChecked ? <CheckSquare size={12} className="text-blue-600" /> : <Square size={12} className="text-slate-300" />}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[7px] font-black uppercase leading-none ${isChecked ? 'text-blue-600' : 'text-slate-300'}`}>DPL {i + 1}</span>
                          <span className={`text-[9.5px] font-bold leading-tight ${isChecked ? 'text-slate-900' : 'text-slate-400'}`}>{d}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex border-2 border-black mb-6 break-inside-avoid">
            <SidebarSection title="DESAIN" />
            <div className="flex-1 p-4 space-y-5">
              <div>
                <p className="font-black text-[9px] uppercase text-slate-500 mb-1">Tujuan Pembelajaran:</p>
                <div className="p-4 border-2 border-blue-600 bg-blue-50/20 rounded-[1.5rem] text-blue-900 font-black text-[12px] text-center leading-tight shadow-sm">
                  {rpm.tujuanPembelajaran}
                </div>
              </div>
              <div className="break-inside-avoid">
                <p className="font-black text-[9px] uppercase text-slate-500 mb-1">Praktik Pedagogis (Model):</p>
                <p className="text-[10.5px] leading-tight text-justify italic font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {rpm.praktikPedagogis}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-6 pt-2 border-t border-slate-100">
                <div className="space-y-1"><p className="font-black text-[9px] uppercase text-black">Kemitraan:</p><p className="text-[10.5px] leading-tight">{rpm.kemitraan || '-'}</p></div>
                <div className="space-y-1"><p className="font-black text-[9px] uppercase text-black">Lingkungan:</p><p className="text-[10.5px] leading-tight">{rpm.lingkunganBelajar || '-'}</p></div>
                <div className="space-y-1"><p className="font-black text-[9px] uppercase text-black">Digital:</p><p className="text-[10.5px] leading-tight">{rpm.pemanfaatanDigital || '-'}</p></div>
              </div>
            </div>
          </div>

          <div className="flex border-2 border-black break-inside-avoid mb-6">
            <SidebarSection title="PENGALAMAN BELAJAR" />
            <div className="flex-1">
               {Array.from({ length: count }).map((_, mIdx) => (
                  <div key={mIdx} className="p-5 space-y-6 border-b-2 last:border-b-0 border-black break-inside-avoid">
                    <div className="flex items-center gap-4">
                       <div className="bg-slate-900 text-white border-2 border-black px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">PERTEMUAN {mIdx + 1}</div>
                       <div className="flex-1 h-0.5 bg-slate-200"></div>
                    </div>
                    <div className="space-y-5">
                       <div className="relative pl-6 border-l-[6px] border-blue-600 rounded-sm">
                          <p className="font-black text-blue-900 text-[11px] mb-2 uppercase tracking-widest">MEMAHAMI (AWAL)</p>
                          <div className="text-[10.5px] text-slate-800">{renderListContent(awalParts[mIdx] || '-', true)}</div>
                       </div>
                       <div className="relative pl-6 border-l-[6px] border-emerald-600 rounded-sm">
                          <p className="font-black text-emerald-900 text-[11px] mb-2 uppercase tracking-widest">MENGAPLIKASI (INTI)</p>
                          <div className="text-[10.5px] text-slate-800">{renderListContent(intiParts[mIdx] || '-', true)}</div>
                       </div>
                       <div className="relative pl-6 border-l-[6px] border-rose-600 rounded-sm">
                          <p className="font-black text-rose-900 text-[11px] mb-2 uppercase tracking-widest">MEREFLEKSI (PENUTUP)</p>
                          <div className="text-[10.5px] text-slate-800">{renderListContent(penutupParts[mIdx] || '-', true)}</div>
                       </div>
                    </div>
                  </div>
               ))}
            </div>
          </div>

          <div className="flex border-2 border-black break-inside-avoid mb-10">
            <SidebarSection title="STRATEGI ASESMEN" />
            <div className="flex-1 p-6">
               {asesmenData ? renderAsesmenTable(asesmenData, true) : <div className="italic text-slate-400 text-[9px]">Instrumen asesmen belum disusun.</div>}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 text-center text-[10.5px] font-black uppercase tracking-tight break-inside-avoid px-8">
            <div>
               <p>MENGETAHUI,</p>
               <p>KEPALA SEKOLAH</p>
               <div className="h-20"></div>
               <p className="border-b-2 border-black inline-block min-w-[180px]">{settings.principalName}</p>
               <p className="mt-0.5 font-normal tracking-tighter">NIP. {settings.principalNip}</p>
            </div>
            <div>
               <p>BILATO, {datumDate}</p>
               <p>GURU KELAS/MAPEL</p>
               <div className="h-20"></div>
               <p className="border-b-2 border-black inline-block min-w-[180px]">{user.name}</p>
               <p className="mt-0.5 font-normal tracking-tighter">NIP. {user.nip || '...................'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentRpm = rpmList.find(r => r.id === isEditing);
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);
  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative theme-dpl">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus RPM</h3><p className="text-slate-500 font-medium text-sm leading-relaxed">Hapus baris RPM dari database cloud?</p></div>
            <div className="p-4 bg-slate-50 flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">BATAL</button><button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 shadow-lg">YA, HAPUS</button></div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-7xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3"><div className="p-2 bg-cyan-500 rounded-xl shadow-lg"><Rocket size={20}/></div><div><h3 className="font-black uppercase text-sm tracking-widest leading-none">Editor RPM Mendalam</h3><p className="text-[10px] text-slate-400 font-bold tracking-tighter mt-1 uppercase">Struktur: Memahami, Mengaplikasi, Merefleksi</p></div></div>
               <div className="flex gap-2"><button onClick={() => setIsPrintMode(true)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all"><Printer size={14}/> PRATINJAU</button><button onClick={() => setIsEditing(null)} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-[10px] font-black transition-all">TUTUP</button></div>
            </div>
            <div className="p-8 overflow-y-auto space-y-10 no-scrollbar bg-white">
              {isLoadingAI && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-6 animate-in fade-in">
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin"></div>
                    <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-600 animate-pulse" size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Analisis AI Berjalan</h3>
                    <p className="text-slate-500 font-medium max-w-xs leading-relaxed italic">
                      "Menyusun alur mendalam berbasis 3M untuk {rpmList.find(r => r.id === isEditing)?.jumlahPertemuan} sesi..."
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><div className="w-1.5 h-6 bg-blue-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">1. Identitas & Sesi</h4></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Fase / Kelas</label><div className="flex gap-2"><div className="flex-1 bg-slate-100 p-3 rounded-xl text-xs font-black text-slate-600 border border-slate-200">{filterFase}</div><div className="flex-1 bg-slate-100 p-3 rounded-xl text-xs font-black text-slate-600 border border-slate-200">Kelas {filterKelas}</div></div></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Jumlah Pertemuan (Manual)</label><div className="relative"><Split size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" /><input type="number" min="1" className="w-full bg-indigo-50 border border-indigo-100 rounded-xl py-3 pl-10 pr-4 text-xs font-black text-indigo-700 outline-none" value={rpmList.find(r => r.id === isEditing)?.jumlahPertemuan || 1} onChange={e => updateRPM(isEditing!, 'jumlahPertemuan', parseInt(e.target.value) || 1)} /></div></div>
                    </div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Tujuan Pembelajaran</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-800 outline-none" value={rpmList.find(r => r.id === isEditing)?.atpId} onChange={e => syncWithATP(isEditing!, e.target.value)}><option value="">-- PILIH TP DARI ATP --</option>{sortedAtpOptions.map(a => (<option key={a.id} value={a.id}>{a.tujuanPembelajaran}</option>))}</select>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex justify-between items-center"><span className="flex items-center gap-1"><PencilLine size={10}/> Model Pembelajaran</span><button onClick={() => handleRecommendPedagogy(isEditing!)} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all"><Wand2 size={10}/><span className="text-[8px] font-black uppercase">REKOMENDASI AI</span></button></label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-700 outline-none" value={rpmList.find(r => r.id === isEditing)?.praktikPedagogis || ''} onChange={e => updateRPM(isEditing!, 'praktikPedagogis', e.target.value)} /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Alokasi Waktu</label><div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-1"><span className="text-xs font-black text-slate-800">{rpmList.find(r => r.id === isEditing)?.alokasiWaktu || '0'} JP Total</span><span className="text-[10px] font-bold text-blue-600">Terdistribusi ke {rpmList.find(r => r.id === isEditing)?.jumlahPertemuan || 1} sesi</span></div></div>
                    </div>
                  </div>
                  <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-200 shadow-inner">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest ml-1">Dimensi Profil (DPL)</label>
                    <div className="grid grid-cols-1 gap-y-3">
                      {DIMENSI_PROFIL.map((dimensi, idx) => {
                        const currentDimensi = rpmList.find(r => r.id === isEditing)?.dimensiProfil || [];
                        const isChecked = currentDimensi.includes(dimensi);
                        return (
                          <label key={dimensi} className="flex items-start gap-2 cursor-pointer group">
                            <input type="checkbox" className="hidden" checked={isChecked} onChange={() => {const newDimensi = isChecked ? currentDimensi.filter(d => d !== dimensi) : [...currentDimensi, dimensi]; updateRPM(isEditing!, 'dimensiProfil', newDimensi);}} />
                            <div className={`mt-0.5 transition-all p-0.5 rounded border ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>{isChecked ? <CheckSquare size={14} className="text-white" /> : <div className="w-3.5 h-3.5" />}</div>
                            <div className="flex flex-col">
                              <span className={`text-[8px] font-black uppercase ${isChecked ? 'text-blue-600' : 'text-slate-300'}`}>DPL {idx + 1}</span>
                              <span className={`text-[10px] font-bold leading-tight ${isChecked ? 'text-slate-900' : 'text-slate-400'}`}>{dimensi}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Kemitraan (Orang Tua)</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs min-h-[100px]" value={rpmList.find(r => r.id === isEditing)?.kemitraan || ''} onChange={e => updateRPM(isEditing!, 'kemitraan', e.target.value)} /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Lingkungan Belajar</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs min-h-[100px]" value={rpmList.find(r => r.id === isEditing)?.lingkunganBelajar || ''} onChange={e => updateRPM(isEditing!, 'lingkunganBelajar', e.target.value)} /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Pemanfaatan Digital</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs min-h-[100px]" value={rpmList.find(r => r.id === isEditing)?.pemanfaatanDigital || ''} onChange={e => updateRPM(isEditing!, 'pemanfaatanDigital', e.target.value)} /></div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-cyan-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">2. Alur Pembelajaran Mendalam (Struktur 3M)</h4></div><button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="flex items-center gap-2 bg-cyan-600 text-white px-8 py-3 rounded-2xl text-xs font-black shadow-xl hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50">{isLoadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} ANALISIS CEPAT AI</button></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-blue-50 rounded-[40px] border border-blue-100 flex flex-col group/col"><h5 className="text-[10px] font-black text-blue-900 uppercase mb-4 flex items-center gap-2"><Brain size={14}/> I. MEMAHAMI</h5><textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs min-h-[250px] focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={rpmList.find(r => r.id === isEditing)?.kegiatanAwal} placeholder="Pertemuan 1: Langkah pemahaman...\n\nPertemuan 2: dst..." onChange={e => updateRPM(isEditing!, 'kegiatanAwal', e.target.value)} /></div>
                  <div className="p-6 bg-emerald-50 rounded-[40px] border border-emerald-100 flex flex-col group/col"><h5 className="text-[10px] font-black text-emerald-900 uppercase mb-4 flex items-center gap-2"><Zap size={14}/> II. MENGAPLIKASI</h5><textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs min-h-[250px] focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={rpmList.find(r => r.id === isEditing)?.kegiatanInti} placeholder="Pertemuan 1: Langkah praktik...\n\nPertemuan 2: dst..." onChange={e => updateRPM(isEditing!, 'kegiatanInti', e.target.value)} /></div>
                  <div className="p-6 bg-rose-50 rounded-[40px] border border-rose-100 flex flex-col group/col"><h5 className="text-[10px] font-black text-rose-900 uppercase mb-4 flex items-center gap-2"><RefreshCw size={14}/> III. MEREFLEKSI</h5><textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs min-h-[250px] focus:ring-2 focus:ring-rose-500 outline-none transition-all" value={rpmList.find(r => r.id === isEditing)?.kegiatanPenutup} placeholder="Pertemuan 1: Langkah refleksi...\n\nPertemuan 2: dst..." onChange={e => updateRPM(isEditing!, 'kegiatanPenutup', e.target.value)} /></div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-slate-800 rounded-full"></div>
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">3. Strategi Asesmen (Rubrik Awal, Proses & Akhir)</h4>
                  </div>
                  <button onClick={() => handleGenerateAsesmenAI(isEditing!)} disabled={isLoadingAsesmenAI} className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl text-xs font-black shadow-xl">
                    {isLoadingAsesmenAI ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16}/>} 
                    SUSUN 3 RUBRIK (AI)
                  </button>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-200">
                  {parseAsesmen(rpmList.find(r => r.id === isEditing)?.asesmenTeknik || "") ? (
                    renderAsesmenTable(parseAsesmen(rpmList.find(r => r.id === isEditing)?.asesmenTeknik || "")!)
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                      <FileText size={48} className="opacity-20"/>
                      <p className="text-xs font-black uppercase tracking-widest text-center">Klik Susun 3 Rubrik untuk menghasilkan tabel penilaian lengkap (Awal, Formatif, Sumatif)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0"><button onClick={() => setIsEditing(null)} className="bg-slate-900 text-white px-12 py-3 rounded-2xl text-[11px] font-black shadow-lg">SIMPAN & SELESAI</button></div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 items-end">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Fase</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-black" value={filterFase} onChange={e => setFilterFase(e.target.value as Fase)}>{Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Mapel</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-black" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Semester</label><select className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 text-xs font-black" value={filterSemester} onChange={e => setFilterSemester(e.target.value as '1' | '2')}><option value="1">1 (Ganjil)</option><option value="2">2 (Genap)</option></select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block flex items-center gap-1">Kelas {isClassLocked && <Lock size={10} className="text-amber-500" />}</label><div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">{['1', '2', '3', '4', '5', '6'].map(k => (<button key={k} disabled={isClassLocked && user.kelas !== k} onClick={() => handleKelasChange(k as Kelas)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${filterKelas === k ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-not-allowed' }`}>{k}</button>))}</div></div>
         </div>
         <button onClick={handleAddRPM} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all"><Plus size={18} className="inline mr-2"/> BUAT RPM</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4 text-slate-400 italic"><Loader2 size={48} className="animate-spin text-blue-600"/><p className="text-xs font-black uppercase tracking-widest">Sinkronisasi Cloud...</p></div>
        ) : sortedRPM.length === 0 ? (
          <div className="col-span-full py-40 text-center text-slate-400 font-black uppercase text-sm tracking-widest bg-white border-2 border-dashed border-slate-200 rounded-[48px]">Belum Ada RPM Tersimpan</div>
        ) : sortedRPM.map(rpm => (
          <div key={rpm.id} className="bg-white p-8 rounded-[40px] border border-slate-200 hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex gap-4 items-center mb-6">
              <div className="p-4 bg-cyan-100 text-cyan-700 rounded-3xl group-hover:bg-cyan-600 group-hover:text-white transition-all"><Rocket size={24}/></div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-slate-900 leading-tight uppercase line-clamp-2">{rpm.tujuanPembelajaran || 'TANPA JUDUL'}</h4>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[9px] font-black text-slate-400 uppercase"><span className="text-indigo-600">SEM {rpm.semester}</span><span className="text-blue-600">{rpm.praktikPedagogis}</span><span>{rpm.jumlahPertemuan || 1} Pertemuan</span><span className="flex items-center gap-1 text-emerald-500"><Cloud size={10}/> {getRPMDate(rpm)}</span></div>
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-slate-50"><button onClick={() => setIsEditing(rpm.id)} className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl text-[10px] font-black hover:bg-black transition-all uppercase tracking-widest">EDIT RPM & RUBRIK</button><button onClick={() => setDeleteConfirmId(rpm.id)} className="p-3.5 text-slate-300 hover:text-red-600 transition-all"><Trash2 size={20}/></button></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RPMManager;
