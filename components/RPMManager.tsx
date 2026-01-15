
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, Kelas, RPMItem, ATPItem, PromesItem, CapaianPembelajaran, MATA_PELAJARAN, DIMENSI_PROFIL, SchoolSettings, User } from '../types';
// Add ArrowLeft to lucide-react imports to fix line 537 error
import { Plus, Trash2, Rocket, Sparkles, Loader2, CheckCircle2, Printer, Cloud, FileText, Split, AlertTriangle, FileDown, Wand2, PencilLine, Lock, Brain, Zap, RefreshCw, PenTool, Search, AlertCircle, X, CheckSquare, Square, Cpu, ClipboardList, BookOpen, Edit2, Globe, Activity, LayoutList, Target, ArrowLeft } from 'lucide-react';
import { generateRPMContent, generateAssessmentDetails, recommendPedagogy } from '../services/geminiService';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';

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
  soalAtauTugas?: string;
  rubrikDetail?: RubricItem[];
}

interface RPMManagerProps {
  user: User;
  onNavigate: (menu: any) => void;
}

const RPMManager: React.FC<RPMManagerProps> = ({ user, onNavigate }) => {
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
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: '-',
    principalName: '-',
    principalNip: '-'
  });
  
  const [activeYear, setActiveYear] = useState('2024/2025');

  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);

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

    const qRpm = query(collection(db, "rpm"), where("school", "==", user.school));
    const unsubRpm = onSnapshot(qRpm, (snapshot) => {
      setRpmList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RPMItem[]);
    });

    const qAtp = query(collection(db, "atp"), where("school", "==", user.school));
    const unsubAtp = onSnapshot(qAtp, (snapshot) => {
      setAtpData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const qCps = query(collection(db, "cps"), where("school", "==", user.school));
    const unsubCps = onSnapshot(qCps, (snapshot) => {
      setCps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CapaianPembelajaran[]);
    });

    const qPromes = query(collection(db, "promes"), where("school", "==", user.school));
    const unsubPromes = onSnapshot(qPromes, (snapshot) => {
      setPromesData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as PromesItem[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubRpm(); unsubAtp(); unsubCps(); unsubPromes(); };
  }, [user.school]);

  const currentRpm = useMemo(() => {
    if (!isEditing) return null;
    return rpmList.find(r => r.id === isEditing) || null;
  }, [rpmList, isEditing]);

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
    if (!text || text === '-') return Array(count).fill('');
    
    // Pattern untuk mendeteksi "Pertemuan X:"
    const pattern = /Pertemuan\s*(\d+)\s*:?/gi;
    const parts = text.split(pattern);
    
    // Jika tidak ada pembagi "Pertemuan X", masukkan semuanya ke Pertemuan 1
    if (parts.length <= 1) {
      const result = Array(count).fill('');
      result[0] = text.trim();
      return result;
    }

    const result = Array(count).fill('');
    // Loop melalui parts yang dihasilkan oleh split dengan capturing group (\d+)
    // parts[0] = teks sebelum label pertama (biasanya kosong)
    // parts[1] = "1" (angka pertemuan)
    // parts[2] = "Isi teks pertemuan 1"
    for (let i = 1; i < parts.length; i += 2) {
        const mNum = parseInt(parts[i]);
        if (mNum > 0 && mNum <= count) {
            // Append teks ke index yang sesuai
            result[mNum - 1] = (parts[i + 1] || '').trim();
        }
    }
    
    // Fallback: Jika setelah diproses array masih dominan kosong padahal input panjang
    if (result.slice(1).every(r => r === '') && text.length > 50 && result[0] === '') {
       result[0] = text;
    }

    return result;
  };

  const processFilosofiTags = (content: string, useHtmlBadge = true) => {
    if (!content) return content;
    const mapping = [
      { key: 'Berkesadaran', color: 'bg-indigo-100/50 text-indigo-900 border-indigo-500', regex: /\[Berkesadaran\]|Berkesadaran\.?/gi },
      { key: 'Bermakna', color: 'bg-emerald-100/50 text-emerald-900 border-emerald-500', regex: /\[Bermakna\]|Bermakna\.?/gi },
      { key: 'Menggembirakan', color: 'bg-rose-100/50 text-rose-900 border-rose-500', regex: /\[Menggembirakan\]|Menggembirakan\.?/gi }
    ];
    let processedText = content;
    mapping.forEach(m => {
      if (useHtmlBadge) {
        const badgeHtml = `<span class="inline-block mx-1 px-2.5 py-0.5 ${m.color} font-black rounded-lg border-[1.5px] text-[10px] leading-tight uppercase align-middle whitespace-nowrap shadow-sm">${m.key}</span>`;
        processedText = processedText.replace(m.regex, badgeHtml);
      } else {
        processedText = processedText.replace(m.regex, ` [${m.key}] `);
      }
    });
    return processedText;
  };

  const renderListContent = (text: string | undefined, cleanMeetingTags: boolean = false) => {
    if (!text || text === '-' || text.trim() === '') return '-';
    let processedText = text;
    if (cleanMeetingTags) processedText = text.replace(/Pertemuan\s*\d+\s*:?\s*/gi, '');
    
    const cleaningRegex = /^(\d+[\.\)]|\-|\*|•)\s*/;
    const redundantHeaderRegex = /^(\d+[\.\)])?\s*(I\.|II\.|III\.|I\s|II\s|III\s)?\s*(MEMAHAMI|MENGAPLIKASI|MEREFLEKSI|Sintaks|SINTAKS|MODEL|Langkah-langkah|Rincian|Kegiatan)\s*(\(.*\))?:?\s*$/i;

    let rawLines = processedText.split(/\n+/);
    let validLines: string[] = [];
    
    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        if (redundantHeaderRegex.test(trimmed)) return;

        const innerSplits = trimmed.split(/\s+(?=\d+[\.\)])/g);
        innerSplits.forEach(part => {
            const cleaned = part.trim().replace(cleaningRegex, '').trim();
            if (cleaned.length > 0 && !redundantHeaderRegex.test(cleaned)) {
               validLines.push(cleaned);
            }
        });
    });

    if (validLines.length === 0) return '-';

    return (
      <ul className="space-y-6 list-none flex flex-col items-stretch">
        {validLines.map((cleanedStep, i) => (
          <li key={i} className="flex gap-5 items-start group">
            <div className="shrink-0 flex flex-col items-center">
              <span className="font-black text-slate-800 min-w-[2.5rem] h-10 w-10 bg-slate-100 rounded-2xl flex items-center justify-center text-[15px] border border-slate-200 shadow-sm group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all duration-300">
                {i + 1}
              </span>
              {i < validLines.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 mt-2 min-h-[1.5rem]"></div>}
            </div>
            <div className="flex-1 pt-2 pb-1">
              <span className="leading-relaxed text-justify text-slate-700 text-[14px] block font-medium" dangerouslySetInnerHTML={{ __html: processFilosofiTags(cleanedStep) }}></span>
            </div>
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
            <title>Cetak RPM - ${user.school}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 20px; color: black; line-height: 1.6; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              .break-inside-avoid { page-break-inside: avoid; }
              table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 4px; }
              ul { padding: 0; margin: 0; list-style: none; display: flex; flex-direction: column; }
              li { margin-bottom: 18px; page-break-inside: avoid; display: flex; align-items: flex-start; gap: 12px; }
              .num-bubble { min-width: 28px; height: 28px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; }
            </style>
          </head>
          <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">${content}</body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleExportWord = () => {
    const rpm = currentRpm;
    if (!rpm) return;
    const count = rpm.jumlahPertemuan || 1;
    const datumDate = getRPMDate(rpm);
    const awalParts = splitByMeeting(rpm.kegiatanAwal, count);
    const intiParts = splitByMeeting(rpm.kegiatanInti, count);
    const penutupParts = splitByMeeting(rpm.kegiatanPenutup, count);

    const renderListForWord = (text: string) => {
      const parts = text.split(/\s+(?=\d+[\.\)])|\n+/).map(l => l.replace(/^(\d+[\.\)]|\-|\*|•)\s*/, '').trim()).filter(l => l.length > 0 && !/^(I\.|II\.|III\.|I\s|II\s|III\s)?\s*(MEMAHAMI|MENGAPLIKASI|MEREFLEKSI|Sintaks|SINTAKS)\s*(\(.*\))?:?\s*$/i.test(l));
      return parts.map((p, i) => `<div style="margin-bottom: 10px; text-align: justify;">${i+1}. ${processFilosofiTags(p, false)}</div>`).join('');
    };

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>RPM</title><style>body { font-family: 'Arial', sans-serif; font-size: 10pt; } table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 6px; vertical-align: top; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .bg-gray { background-color: #f3f4f6; } .title { text-align: center; font-weight: bold; font-size: 14pt; text-transform: uppercase; } .subtitle { text-align: center; font-weight: bold; font-size: 11pt; margin-bottom: 20px; } .tp-box { border: 2px solid #2563eb; background-color: #eff6ff; padding: 10px; border-radius: 10px; font-weight: bold; text-align: center; }</style></head><body>`;
    const footer = "</body></html>";
    
    let contentHtml = `
      <div class="title">RENCANA PEMBELAJARAN MENDALAM (RPM)</div>
      <div class="subtitle">${settings.schoolName}</div>
      <table><tr class="bg-gray"><td colspan="2"><b>IDENTITAS</b></td></tr><tr><td width="150">Penyusun / Satuan</td><td><b>${user.name} / ${settings.schoolName}</b></td></tr><tr><td>Tahun / Semester</td><td>${activeYear} / ${rpm.semester}</td></tr><tr><td>Mata Pelajaran</td><td><b>${rpm.mataPelajaran}</b></td></tr><tr><td>Kelas / Fase</td><td>${rpm.kelas} / ${rpm.fase}</td></tr><tr><td>Bab / Topik</td><td><b>${rpm.materi}</b></td></tr><tr><td>Alokasi Waktu</td><td>${rpm.alokasiWaktu} (${count} Pertemuan)</td></tr></table>
      <table><tr><td width="50" class="bg-gray" align="center">ID</td><td><p><b>Asesmen Awal:</b></p><div>${rpm.asesmenAwal || '-'}</div><p><b>Profil Lulusan:</b></p><ul>${DIMENSI_PROFIL.map(d => rpm.dimensiProfil.includes(d) ? `<li><b>[X] ${d}</b></li>` : `<li>[ ] ${d}</li>`).join('')}</ul></td></tr></table>
      <table><tr><td width="50" class="bg-gray" align="center">DE</td><td><div class="tp-box">${rpm.tujuanPembelajaran}</div><p><b>Model:</b> ${rpm.praktikPedagogis}</p><p><b>Kemitraan:</b> ${rpm.kemitraan || '-'}</p></td></tr></table>
      <table><tr><td width="50" class="bg-gray" align="center">3M</td><td>${Array.from({ length: count }).map((_, mIdx) => `<div style="margin-bottom: 15px;"><b>PERTEMUAN ${mIdx + 1}</b><p><b>I. MEMAHAMI</b></p>${renderListForWord(awalParts[mIdx] || '-')}<p><b>II. MENGAPLIKASI</b></p>${renderListForWord(intiParts[mIdx] || '-')}<p><b>III. MEREFLEKSI</b></p>${renderListForWord(penutupParts[mIdx] || '-')}</div>`).join('')}</td></tr></table>
      <br/><br/><table style="border:none;"><tr style="border:none;"><td style="border:none; text-align: center;">Mengetahui,<br/>Kepala Sekolah<br/><br/><br/><br/><b>${settings.principalName}</b></td><td style="border:none; text-align: center;">Bilato, ${datumDate}<br/>Guru Kelas/Mapel<br/><br/><br/><br/><b>${user.name}</b></td></tr></table>`;

    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPM_${rpm.materi.replace(/ /g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderAsesmenTable = (data: AsesmenRow[], isPrint: boolean = false) => {
    const grouped = {
      'ASESMEN AWAL': data.filter(d => (d.kategori || '').toUpperCase().includes('AWAL')),
      'ASESMEN PROSES': data.filter(d => (d.kategori || '').toUpperCase().includes('PROSES')),
      'ASESMEN AKHIR': data.filter(d => (d.kategori || '').toUpperCase().includes('AKHIR')),
      'LAINNYA': data.filter(d => !['AWAL', 'PROSES', 'AKHIR'].some(k => (d.kategori || '').toUpperCase().includes(k)))
    };

    return (
      <div className="space-y-12">
        {Object.entries(grouped).map(([categoryName, rows]) => {
          if (rows.length === 0) return null;
          return (
            <div key={categoryName} className="space-y-6">
              <div className="flex items-center gap-3 border-b-4 border-slate-900 pb-2">
                <div className={`p-2 rounded-xl text-white ${
                  categoryName.includes('AWAL') ? 'bg-amber-600' :
                  categoryName.includes('PROSES') ? 'bg-indigo-600' :
                  categoryName.includes('AKHIR') ? 'bg-rose-600' : 'bg-slate-700'
                }`}>
                  {categoryName.includes('AWAL') ? <Target size={18}/> : 
                   categoryName.includes('PROSES') ? <Activity size={18}/> : <CheckCircle2 size={18}/>}
                </div>
                <h4 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em]">{categoryName}</h4>
              </div>
              
              <div className="space-y-8">
                {rows.map((row, idx) => (
                  <div key={idx} className="break-inside-avoid">
                    <div className="flex items-center gap-2 mb-3">
                       <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{row.teknik}</span>
                       <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{row.bentuk}</span>
                    </div>
                    <div className="mb-6 space-y-4">
                      {row.instruksi && <p className={`italic text-slate-600 ${isPrint ? 'text-[9.5px]' : 'text-[10.5pt]'}`}><b>Instruksi:</b> {row.instruksi}</p>}
                      {row.soalAtauTugas && (
                        <div className="p-5 border-[1.5px] border-slate-300 rounded-3xl bg-slate-50/50 shadow-inner">
                          <p className="font-black text-[9px] uppercase text-indigo-600 mb-3 tracking-widest flex items-center gap-2"><Sparkles size={12}/> Butir Soal / Instrumen Tugas:</p>
                          <div className={`whitespace-pre-wrap leading-relaxed text-slate-800 ${isPrint ? 'text-[9.5px]' : 'text-[11.5px]'} font-medium`}>
                            {row.soalAtauTugas}
                          </div>
                        </div>
                      )}
                    </div>
                    <table className={`w-full border-collapse border-2 border-black ${isPrint ? 'text-[8.5px]' : 'text-[10.5px]'}`}>
                      <thead>
                        <tr className="bg-slate-100 uppercase font-black text-center">
                          <th className="border-2 border-black p-1 w-1/4">ASPEK PENILAIAN</th>
                          <th className="border-2 border-black p-1">SANGAT BAIK (4)</th>
                          <th className="border-2 border-black p-1">BAIK (3)</th>
                          <th className="border-2 border-black p-1">CUKUP (2)</th>
                          <th className="border-2 border-black p-1">PERLU (1)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.rubrikDetail?.map((detail, dIdx) => (
                          <tr key={dIdx}>
                            <td className="border-2 border-black p-2 font-bold uppercase bg-slate-50/30">{detail.aspek}</td>
                            <td className="border-2 border-black p-2 leading-tight">{detail.level4}</td>
                            <td className="border-2 border-black p-2 leading-tight">{detail.level3}</td>
                            <td className="border-2 border-black p-2 leading-tight">{detail.level2}</td>
                            <td className="border-2 border-black p-2 leading-tight">{detail.level1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleAddRPM = async () => {
    try {
      await addDoc(collection(db, "rpm"), {
        atpId: '', fase: filterFase, kelas: filterKelas, semester: filterSemester, mataPelajaran: filterMapel,
        tujuanPembelajaran: '', materi: '', subMateri: '', alokasiWaktu: '', jumlahPertemuan: 1,
        asesmenAwal: '', dimensiProfil: [], praktikPedagogis: '', kemitraan: '',
        lingkunganBelajar: '', pemanfaatanDigital: '', kegiatanAwal: '', kegiatanInti: '', kegiatanPenutup: '', asesmenTeknik: '', materiAjar: '',
        school: user.school
      });
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
      setTimeout(() => setMessage(null), 3000);
    } catch (e) { console.error(e); }
  };

  const handleGenerateAI = async (id: string) => {
    if (!user.apiKey) {
      setMessage({ text: '⚠️ API Key diperlukan di profil!', type: 'warning' });
      return;
    }
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) return;
    setIsLoadingAI(true);
    try {
      const result = await generateRPMContent(
        rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, rpm.praktikPedagogis || "Aktif", rpm.alokasiWaktu, rpm.jumlahPertemuan || 1, user.apiKey
      );
      if (result) { 
        await updateDoc(doc(db, "rpm", id), { ...result }); 
        setMessage({ text: 'AI Berhasil menyusun RPM Naratif!', type: 'success' }); 
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { 
      setMessage({ text: 'AI Gagal: Kuota Limit 429 atau Server Sibuk.', type: 'error' }); 
    } finally { setIsLoadingAI(false); }
  };

  const handleGenerateAsesmenAI = async (id: string) => {
    if (!user.apiKey) {
      setMessage({ text: '⚠️ API Key diperlukan!', type: 'warning' });
      return;
    }
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.tujuanPembelajaran) return;
    
    const context = `
      Langkah Memahami: ${rpm.kegiatanAwal}
      Langkah Mengaplikasi: ${rpm.kegiatanInti}
      Langkah Merefleksi: ${rpm.kegiatanPenutup}
    `.trim();

    setIsLoadingAsesmenAI(true);
    try {
      const result = await generateAssessmentDetails(rpm.tujuanPembelajaran, rpm.materi, rpm.kelas, context, user.apiKey);
      if (result) { 
        await updateDoc(doc(db, "rpm", id), { asesmenTeknik: result }); 
        setMessage({ text: 'Asesmen Sinkron Langkah AI Berhasil!', type: 'success' }); 
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) { 
      setMessage({ text: 'Gagal Menyusun Asesmen AI.', type: 'error' }); 
    } finally { setIsLoadingAsesmenAI(false); }
  };

  const handleRecommendPedagogy = async (id: string) => {
    if (!user.apiKey) return;
    const rpm = rpmList.find(r => r.id === id);
    if (!rpm || !rpm.atpId) return;
    setIsLoadingPedagogyAI(true);
    try {
      const result = await recommendPedagogy(rpm.tujuanPembelajaran, "", rpm.materi, rpm.kelas, user.apiKey);
      if (result) { 
        await updateDoc(doc(db, "rpm", id), { praktikPedagogis: result.modelName }); 
        setMessage({ text: `Rekomendasi: ${result.modelName}`, type: 'info' }); 
      }
    } catch (err) { console.error(err); } finally { setIsLoadingPedagogyAI(false); }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { await deleteDoc(doc(db, "rpm", deleteConfirmId)); setDeleteConfirmId(null); } catch (e) { console.error(e); }
  };

  const getRPMDate = (rpm: RPMItem) => {
    const matchingPromes = promesData.find(p => p.tujuanPembelajaran === rpm.tujuanPembelajaran && p.kelas === rpm.kelas);
    if (!matchingPromes || !matchingPromes.bulanPelaksanaan) return new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'});
    const parts = matchingPromes.bulanPelaksanaan.split(',')[0].split('|');
    return `${parts[2] || '..'} ${parts[0] || '..'} ${activeYear.split('/')[matchingPromes.semester === '1' ? 0 : 1]}`;
  };

  const parseAsesmen = (json: any): AsesmenRow[] | null => { 
    if (!json) return null;
    if (Array.isArray(json)) return json;
    if (typeof json === 'string') {
      const trimmed = json.trim();
      if (trimmed === '') return null;
      try { 
        const parsed = JSON.parse(trimmed); 
        return Array.isArray(parsed) ? parsed : null; 
      } catch (e) { return null; }
    }
    return null;
  };

  if (isPrintMode && isEditing && currentRpm) {
    const rpm = currentRpm;
    const count = rpm.jumlahPertemuan || 1;
    const asesmenData = parseAsesmen(rpm.asesmenTeknik);
    const datumDate = getRPMDate(rpm);
    const awalParts = splitByMeeting(rpm.kegiatanAwal, count);
    const intiParts = splitByMeeting(rpm.kegiatanInti, count);
    const penutupParts = splitByMeeting(rpm.kegiatanPenutup, count);
    
    const SidebarSection = ({ title }: { title: string }) => (
      <div className="w-12 uppercase font-black text-[9px] text-black border-r-2 border-black shrink-0 text-center flex flex-col items-center justify-center bg-slate-50/50">
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{title}</span>
      </div>
    );

    return (
      <div className="bg-white min-h-screen text-slate-900 p-8 font-sans print:p-0">
        <div className="no-print mb-8 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-xl sticky top-4 z-[100]">
           {/* Fix: Added missing ArrowLeft icon reference for the Back button (line 537) */}
           <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-8 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all"><ArrowLeft size={16}/> KEMBALI</button>
           <div className="flex gap-2">
             <button onClick={handleExportWord} className="bg-blue-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><FileDown size={16}/> WORD</button>
             <button onClick={handlePrint} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><Printer size={16}/> CETAK</button>
           </div>
        </div>

        <div ref={printRef} className="max-w-[21cm] mx-auto bg-white p-4">
          <div className="text-center mb-6 pb-2 border-b-2 border-black">
            <h1 className="text-xl font-black uppercase tracking-[0.2em] text-black">RENCANA PEMBELAJARAN MENDALAM</h1>
            <h2 className="text-sm font-bold uppercase text-slate-600">{settings.schoolName}</h2>
          </div>

          <div className="mb-6 border-2 border-black">
            <div className="bg-slate-100 border-b-2 border-black px-3 py-1 font-black text-[10px] uppercase tracking-widest">IDENTITAS</div>
            <table className="w-full text-[10.5px] border-collapse">
              <tbody>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Penyusun / Satuan</td><td className="p-1.5 font-bold uppercase">{user.name} / {settings.schoolName}</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Tahun / Semester</td><td className="p-1.5">{activeYear} / {rpm.semester}</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Mata Pelajaran</td><td className="p-1.5 font-bold uppercase">{rpm.mataPelajaran}</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Kelas / Fase</td><td className="p-1.5 font-bold">{rpm.kelas} / {rpm.fase.replace('Fase ', '')}</td></tr>
                <tr className="border-b border-black"><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Bab / Topik</td><td className="p-1.5 font-bold uppercase">{rpm.materi}</td></tr>
                <tr><td className="p-1.5 w-48 font-bold bg-slate-50 border-r-2 border-black uppercase text-[9px]">Alokasi Waktu</td><td className="p-1.5 font-bold">{rpm.alokasiWaktu} JP (${count} Pertemuan)</td></tr>
              </tbody>
            </table>
          </div>

          <div className="flex border-2 border-black mb-6 break-inside-avoid">
            <SidebarSection title="IDENTIFIKASI" />
            <div className="flex-1 p-4 space-y-4">
              <div><p className="font-bold text-[9px] uppercase text-slate-500 mb-1">Asesmen Awal:</p><div className="p-3 bg-slate-50 border-2 border-dotted border-slate-300 italic text-[10.5px] leading-tight rounded-xl">{rpm.asesmenAwal || '-'}</div></div>
              <div><p className="font-bold text-[9px] uppercase text-slate-500 mb-2">Dimensi Profil Lulusan (DPL):</p><div className="grid grid-cols-2 gap-x-4 gap-y-2">{DIMENSI_PROFIL.map((d, i) => (<div key={i} className="flex items-start gap-2">{rpm.dimensiProfil.includes(d) ? <CheckSquare size={12} className="text-blue-600 mt-0.5" /> : <Square size={12} className="text-slate-300 mt-0.5" />}<span className={`text-[9.5px] font-bold leading-tight ${rpm.dimensiProfil.includes(d) ? 'text-slate-900' : 'text-slate-400'}`}>{d}</span></div>))}</div></div>
            </div>
          </div>

          <div className="flex border-2 border-black mb-6 break-inside-avoid">
            <SidebarSection title="DESAIN" />
            <div className="flex-1 p-4 space-y-5">
              <div><p className="font-black text-[9px] uppercase text-slate-500 mb-1">Tujuan Pembelajaran (TP):</p><div className="p-4 border-2 border-blue-600 bg-blue-50/20 rounded-[1.5rem] text-blue-900 font-black text-[12px] text-center shadow-sm">{rpm.tujuanPembelajaran}</div></div>
              <div><p className="font-black text-[9px] uppercase text-slate-500 mb-1">Strategi Pedagogis:</p><p className="text-[10.5px] leading-tight text-justify italic font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">{rpm.praktikPedagogis}</p></div>
              <div className="grid grid-cols-3 gap-6 pt-2 border-t border-slate-100">
                <div className="space-y-1"><p className="font-black text-[9px] uppercase text-black">Kemitraan:</p><p className="text-[10.5px] leading-tight">{rpm.kemitraan || '-'}</p></div>
                <div className="space-y-1"><p className="font-black text-[9px] uppercase text-black">Lingkungan:</p><p className="text-[10.5px] leading-tight">{rpm.lingkunganBelajar || '-'}</p></div>
                <div className="space-y-1"><p className="font-black text-[9px] uppercase text-black">Digital:</p><p className="text-[10.5px] leading-tight">{rpm.pemanfaatanDigital || '-'}</p></div>
              </div>
            </div>
          </div>

          <div className="flex border-2 border-black break-inside-avoid mb-6">
            <SidebarSection title="PENGALAMAN (3M)" />
            <div className="flex-1">
               {Array.from({ length: count }).map((_, mIdx) => (
                  <div key={mIdx} className="p-5 space-y-6 border-b-2 last:border-b-0 border-black break-inside-avoid">
                    <div className="flex items-center gap-4"><div className="bg-slate-900 text-white border-2 border-black px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">SESI {mIdx + 1}</div><div className="flex-1 h-0.5 bg-slate-200"></div></div>
                    <div className="space-y-8">
                       <div className="relative pl-6 border-l-[8px] border-blue-600 rounded-sm"><p className="font-black text-blue-900 text-[12px] mb-3 uppercase tracking-[0.2em] border-b-2 border-blue-100 inline-block">I. MEMAHAMI</p><div className="text-[12px] text-slate-800">{renderListContent(awalParts[mIdx] || '-', true)}</div></div>
                       <div className="relative pl-6 border-l-[8px] border-emerald-600 rounded-sm"><p className="font-black text-emerald-900 text-[12px] mb-3 uppercase tracking-[0.2em] border-b-2 border-emerald-100 inline-block">II. MENGAPLIKASI</p><div className="text-[12px] text-slate-800">{renderListContent(intiParts[mIdx] || '-', true)}</div></div>
                       <div className="relative pl-6 border-l-[8px] border-rose-600 rounded-sm"><p className="font-black text-rose-900 text-[12px] mb-3 uppercase tracking-[0.2em] border-b-2 border-rose-100 inline-block">III. MEREFLEKSI</p><div className="text-[12px] text-slate-800">{renderListContent(penutupParts[mIdx] || '-', true)}</div></div>
                    </div>
                  </div>
               ))}
            </div>
          </div>

          {asesmenData && (
            <div className="mt-6 border-2 border-black break-inside-avoid">
               <div className="bg-slate-900 text-white p-3 text-center font-black uppercase text-xs tracking-widest">STRATEGI ASESMEN (AWAL, PROSES, AKHIR)</div>
               <div className="p-8 space-y-12">{renderAsesmenTable(asesmenData, true)}</div>
            </div>
          )}

          <div className="mt-12 grid grid-cols-2 text-center text-[10.5px] font-black uppercase tracking-tight break-inside-avoid px-8">
            <div><p>MENGETAHUI,</p><p>KEPALA SEKOLAH</p><div className="h-20"></div><p className="border-b-2 border-black inline-block min-w-[180px]">{settings.principalName}</p><p className="mt-0.5 font-normal tracking-tighter">NIP. {settings.principalNip}</p></div>
            <div><p>BILATO, {datumDate}</p><p>GURU KELAS/MAPEL</p><div className="h-20"></div><p className="border-b-2 border-black inline-block min-w-[180px]">{user.name}</p><p className="mt-0.5 font-normal tracking-tighter">NIP. {user.nip || '...................'}</p></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative theme-dpl">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${
        message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
        message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
        'bg-red-50 border-red-200 text-red-800'
      }`}><CheckCircle2 size={20}/><span className="text-sm font-black uppercase tracking-tight">{message.text}</span></div>)}
      
      {!user.apiKey && (
        <div className="bg-rose-50 border-2 border-rose-200 p-6 rounded-[2rem] flex items-start gap-4 animate-pulse">
          <AlertCircle className="text-rose-600 shrink-0" size={24}/>
          <div>
            <h3 className="text-sm font-black text-rose-800 uppercase tracking-tight">Konfigurasi AI Diperlukan</h3>
            <p className="text-xs text-rose-700 font-medium mt-1">Anda belum memasukkan Gemini API Key di profil. Fitur "Uraikan dengan AI" tidak akan berfungsi. Silakan lengkapi di menu <button onClick={() => onNavigate('USER')} className="underline font-black">Manajemen User</button>.</p>
          </div>
        </div>
      )}

      {deleteConfirmId && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4"><div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95"><div className="p-8 text-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus RPM</h3><p className="text-slate-500 font-medium text-sm leading-relaxed">Hapus baris RPM ini?</p></div><div className="p-4 bg-slate-50 flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">BATAL</button><button onClick={executeDelete} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg">HAPUS</button></div></div></div>)}

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3"><div className="p-2 bg-cyan-500 rounded-xl shadow-lg"><Rocket size={20}/></div><div><h3 className="font-black uppercase text-sm tracking-widest leading-none">Editor RPM Mendalam</h3><p className="text-[10px] text-slate-400 font-bold tracking-tighter mt-1 uppercase">Struktur 3M Vertikal & Narasi Terurai</p></div></div>
               <div className="flex gap-2"><button onClick={() => setIsPrintMode(true)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all"><Printer size={14}/> PRATINJAU</button><button onClick={() => setIsEditing(null)} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-[10px] font-black transition-all">TUTUP</button></div>
            </div>
            <div className="p-8 overflow-y-auto space-y-10 no-scrollbar bg-slate-50/50">
              {isLoadingAI && (<div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-6 animate-in fade-in"><div className="relative"><div className="w-24 h-24 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin"></div><Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-600 animate-pulse" size={32} /></div><div className="text-center"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">AI Berjalan (Naratif Mode)</h3><p className="text-slate-500 font-medium max-w-xs leading-relaxed italic text-sm uppercase">Menjabarkan rincian aktivitas guru & siswa yang panjang and sinkron per pertemuan...</p></div></div>)}
              {currentRpm ? (
                <>
                  <div className="space-y-6 bg-white p-8 rounded-[3rem] border border-slate-200">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><div className="w-1.5 h-6 bg-blue-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">1. Identitas & Sesi</h4></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Fase / Kelas</label><div className="flex gap-2"><div className="flex-1 bg-slate-50 p-4 rounded-2xl text-xs font-black text-slate-600 border border-slate-200">{filterFase}</div><div className="flex-1 bg-slate-50 p-4 rounded-2xl text-xs font-black text-slate-600 border border-slate-200">Kelas {filterKelas}</div></div></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Pertemuan (Manual)</label><div className="relative"><Split size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" /><input type="number" min="1" className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl py-4 pl-10 pr-4 text-xs font-black text-indigo-700 outline-none" value={currentRpm?.jumlahPertemuan || 1} onChange={e => updateRPM(isEditing!, 'jumlahPertemuan', parseInt(e.target.value) || 1)} /></div></div>
                        </div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Tujuan Pembelajaran</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-800 outline-none" value={currentRpm?.atpId} onChange={e => syncWithATP(isEditing!, e.target.value)}><option value="">-- PILIH TP DARI ATP --</option>{sortedAtpOptions.map(a => (<option key={a.id} value={a.id}>{a.tujuanPembelajaran}</option>))}</select>
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex justify-between items-center"><span className="flex items-center gap-1"><PencilLine size={10}/> Sintaks Model</span><button onClick={() => handleRecommendPedagogy(isEditing!)} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all"><Wand2 size={10}/><span className="text-[8px] font-black uppercase">REKOMENDASI</span></button></label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-700 outline-none" value={currentRpm?.praktikPedagogis || ''} onChange={e => updateRPM(isEditing!, 'praktikPedagogis', e.target.value)} /></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Alokasi Waktu</label><div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-1"><span className="text-xs font-black text-slate-800">{currentRpm?.alokasiWaktu || '0'} JP Total</span><span className="text-[10px] font-bold text-blue-600">Terdistribusi ke {currentRpm?.jumlahPertemuan || 1} sesi</span></div></div>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-8 rounded-[3rem] border border-slate-200 shadow-inner"><label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest ml-1">Dimensi Profil (DPL)</label><div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">{DIMENSI_PROFIL.map((dimensi, idx) => {const currentDimensi = currentRpm?.dimensiProfil || []; const isChecked = currentDimensi.includes(dimensi); return (<label key={dimensi} className="flex items-start gap-2 cursor-pointer group"><input type="checkbox" className="hidden" checked={isChecked} onChange={() => {const newDimensi = isChecked ? currentDimensi.filter(d => d !== dimensi) : [...currentDimensi, dimensi]; updateRPM(isEditing!, 'dimensiProfil', newDimensi);}} /><div className={`mt-0.5 transition-all p-0.5 rounded border ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>{isChecked ? <CheckSquare size={14} className="text-white" /> : <div className="w-3.5 h-3.5" />}</div><div className="flex flex-col"><span className={`text-[8px] font-black uppercase ${isChecked ? 'text-blue-600' : 'text-slate-300'}`}>DPL {idx + 1}</span><span className={`text-[10px] font-bold leading-tight ${isChecked ? 'text-slate-900' : 'text-slate-400'}`}>{dimensi}</span></div></label>);})}</div></div>
                    </div>
                  </div>

                  <div className="space-y-8 bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-cyan-600 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">2. Alur Deep Learning (Sequence Vertikal)</h4></div><button onClick={() => handleGenerateAI(isEditing!)} disabled={isLoadingAI} className="flex items-center gap-3 bg-cyan-600 text-white px-10 py-4 rounded-[2rem] text-xs font-black shadow-xl hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50">{isLoadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} URAIKAN NARASI DENGAN AI</button></div>
                    
                    <div className="space-y-12">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 text-blue-900 mb-6 bg-blue-50/50 p-4 rounded-2xl border-l-[10px] border-blue-600">
                           <Brain size={28}/>
                           <div><h5 className="font-black uppercase text-sm tracking-[0.3em]">I. MEMAHAMI (APPERSEPSI & RITUAL)</h5><p className="text-[10px] font-bold opacity-60">Wajib diawali dengan label "Pertemuan 1:", "Pertemuan 2:" dst agar terpisah.</p></div>
                        </div>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-[13px] min-h-[180px] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium leading-relaxed" value={currentRpm?.kegiatanAwal || ''} placeholder="Contoh: Pertemuan 1: 1. Doa bersama... Pertemuan 2: 1. Doa bersama..." onChange={e => updateRPM(isEditing!, 'kegiatanAwal', e.target.value)} />
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-4 text-emerald-900 mb-6 bg-emerald-50/50 p-4 rounded-2xl border-l-[10px] border-emerald-600">
                           <Zap size={28}/>
                           <div><h5 className="font-black uppercase text-sm tracking-[0.3em]">II. MENGAPLIKASI (INTI / SINTAKS MODEL)</h5><p className="text-[10px] font-bold opacity-60">Narasi terperinci fase-fase model {currentRpm?.praktikPedagogis} per pertemuan.</p></div>
                        </div>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-[13px] min-h-[350px] focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium leading-relaxed" value={currentRpm?.kegiatanInti || ''} placeholder="Uraikan rincian aktivitas per pertemuan dengan label pemisah..." onChange={e => updateRPM(isEditing!, 'kegiatanInti', e.target.value)} />
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-4 text-rose-900 mb-6 bg-rose-50/50 p-4 rounded-2xl border-l-[10px] border-rose-600">
                           <RefreshCw size={28}/>
                           <div><h5 className="font-black uppercase text-sm tracking-[0.3em]">III. MEREFLEKSI (KESIMPULAN & SELEBRASI)</h5><p className="text-[10px] font-bold opacity-60">Langkah refleksi untuk menemukan makna belajar yang mendalam.</p></div>
                        </div>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-[13px] min-h-[180px] focus:ring-4 focus:ring-rose-500/10 outline-none transition-all font-medium leading-relaxed" value={currentRpm?.kegiatanPenutup || ''} placeholder="Refleksi naratif panjang per pertemuan..." onChange={e => updateRPM(isEditing!, 'kegiatanPenutup', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-slate-800 rounded-full"></div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">3. Strategi Asesmen (Deep Learning)</h4></div>
                       <button onClick={() => handleGenerateAsesmenAI(isEditing!)} disabled={isLoadingAsesmenAI} className="flex items-center gap-3 bg-indigo-600 text-white px-10 py-4 rounded-[2rem] text-xs font-black shadow-xl hover:bg-indigo-700">
                         {isLoadingAsesmenAI ? <Loader2 size={16} className="animate-spin" /> : <LayoutList size={16}/>} SUSUN ASESMEN SINKRON (AI)
                       </button>
                    </div>
                    <div className="min-h-[200px]">
                      {parseAsesmen(currentRpm?.asesmenTeknik || "") ? (
                        <div className="space-y-8">
                           {renderAsesmenTable(parseAsesmen(currentRpm?.asesmenTeknik || "")!)}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4 text-center">
                           <FileText size={48} className="opacity-20"/>
                           <p className="text-xs font-black uppercase tracking-widest italic opacity-50">AI akan menyusun asesmen yang selaras dengan narasi langkah di atas</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (<div className="p-20 text-center"><Loader2 className="animate-spin inline-block" /></div>)}
            </div>
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end shrink-0"><button onClick={() => setIsEditing(null)} className="bg-slate-900 text-white px-16 py-4 rounded-[2rem] text-xs font-black shadow-lg hover:bg-black transition-all">SIMPAN PERANGKAT</button></div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 items-end">
         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Fase</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black" value={filterFase} onChange={e => setFilterFase(e.target.value as Fase)}>{Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Mapel</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Semester</label><select className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-black" value={filterSemester} onChange={e => setFilterSemester(e.target.value as '1' | '2')}><option value="1">1 (Ganjil)</option><option value="2">2 (Genap)</option></select></div>
           <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Kelas {isClassLocked && <Lock size={10} className="text-amber-500 inline ml-1" />}</label><div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">{['1', '2', '3', '4', '5', '6'].map(k => (<button key={k} disabled={isClassLocked && user.kelas !== k} onClick={() => handleKelasChange(k as Kelas)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${filterKelas === k ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-not-allowed' }`}>{k}</button>))}</div></div>
         </div>
         <button onClick={handleAddRPM} className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all"><Plus size={18} className="inline mr-2"/> BUAT RPM BARU</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (<div className="col-span-full py-40 flex flex-col items-center justify-center gap-4 text-slate-400 italic"><Loader2 size={48} className="animate-spin text-blue-600"/><p className="text-xs font-black uppercase tracking-widest">Sinkronisasi Cloud...</p></div>) : sortedRPM.length === 0 ? (<div className="col-span-full py-40 text-center text-slate-400 font-black uppercase text-sm tracking-widest bg-white border-2 border-dashed border-slate-200 rounded-[48px]">Belum Ada RPM Tersimpan</div>) : sortedRPM.map(rpm => (
          <div key={rpm.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex gap-6 items-start mb-8">
              <div className="p-5 bg-cyan-100 text-cyan-700 rounded-[2rem] group-hover:bg-cyan-600 group-hover:text-white transition-all shadow-inner"><Rocket size={32}/></div>
              <div className="flex-1">
                <h4 className="text-base font-black text-slate-900 leading-tight uppercase line-clamp-2 mb-3">{rpm.tujuanPembelajaran || 'TANPA JUDUL'}</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><span className="text-indigo-600 px-3 py-1 bg-indigo-50 rounded-full">SEM {rpm.semester}</span><span className="text-blue-600 px-3 py-1 bg-blue-50 rounded-full">{rpm.praktikPedagogis}</span><span className="px-3 py-1 bg-slate-50 rounded-full border border-slate-100">{rpm.jumlahPertemuan || 1} Sesi Belajar</span></div>
              </div>
            </div>
            <div className="flex gap-3 pt-6 border-t border-slate-50"><button onClick={() => setIsEditing(rpm.id)} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black hover:bg-black transition-all uppercase tracking-widest shadow-lg">EDIT RPM & ASESMEN</button><button onClick={() => setDeleteConfirmId(rpm.id)} className="p-4 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20}/></button></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RPMManager;
