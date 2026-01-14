
import { Fase, Kelas, Siswa, AsesmenNilai, AsesmenInstrumen, ATPItem, MATA_PELAJARAN, SchoolSettings, User, KisiKisiItem } from '../types';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Loader2, Cloud, Printer, CheckCircle2, AlertTriangle, 
  PenTool, BarChart3, Wand2, ChevronRight, FileDown, Sparkles, Lock, Eye, EyeOff, AlertCircle, X, BookText, Square, CheckSquare, Circle, Image as ImageIcon, Download, ArrowLeft
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from '../services/firebase';
import { generateIndikatorSoal, generateButirSoal, generateAiImage } from '../services/geminiService';

interface AsesmenManagerProps {
  type: 'formatif' | 'sumatif';
  user: User;
}

const AsesmenManager: React.FC<AsesmenManagerProps> = ({ type, user }) => {
  const [activeTab, setActiveTab] = useState<'KISI_KISI' | 'SOAL'>('KISI_KISI');
  const [fase, setFase] = useState<Fase>(Fase.A);
  const [kelas, setKelas] = useState<Kelas>('1');
  const [semester, setSemester] = useState<'1' | '2'>('1');
  const [mapel, setMapel] = useState<string>(MATA_PELAJARAN[1]);
  const [namaAsesmen, setNamaAsesmen] = useState<string>('SUMATIF AKHIR SEMESTER');
  const [isPrintMode, setIsPrintMode] = useState(false);
  
  const [hariTanggal, setHariTanggal] = useState('');
  const [waktuPengerjaan, setWaktuPengerjaan] = useState('90 Menit');
  
  const [tps, setTps] = useState<ATPItem[]>([]);
  const [kisikisi, setKisikisi] = useState<KisiKisiItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [aiLoadingMap, setAiLoadingMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAddAsesmenModal, setShowAddAsesmenModal] = useState(false);
  const [modalInputValue, setModalInputValue] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: user.school,
    address: 'Jl. Trans Sulawesi Desa Bumlea Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });
  
  const [activeYear, setActiveYear] = useState('2025/2026');

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setKelas(user.kelas as Kelas);
        updateFaseByKelas(user.kelas as Kelas);
      }
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        if (!user.mapelDiampu.includes(mapel)) {
          setMapel(user.mapelDiampu[0]);
        }
      }
    }
  }, [user]);

  const updateFaseByKelas = (kls: Kelas) => {
    if (['1', '2'].includes(kls)) setFase(Fase.A);
    else if (['3', '4'].includes(kls)) setFase(Fase.B);
    else if (['5', '6'].includes(kls)) setFase(Fase.C);
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "school_settings", user.school), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });
    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find(d => d.data().isActive);
      if (active) setActiveYear(active.data().year);
    });
    return () => { unsubSettings(); unsubYears(); };
  }, [user.school]);

  useEffect(() => {
    setLoading(true);
    const qAtp = query(collection(db, "atp"), where("school", "==", user.school));
    const unsubAtp = onSnapshot(qAtp, (snapshot) => {
      setTps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ATPItem[]);
    });

    const qKisi = query(collection(db, "kisikisi"), where("school", "==", user.school));
    const unsubKisi = onSnapshot(qKisi, (snapshot) => {
      setKisikisi(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KisiKisiItem[]);
      setLoading(false);
    });
    return () => { unsubAtp(); unsubKisi(); };
  }, [user.school]);

  const filteredKisikisi = useMemo(() => {
    return kisikisi.filter(k => 
      k.fase === fase && k.kelas === kelas && k.semester === semester && k.mataPelajaran === mapel &&
      (namaAsesmen === '' || k.namaAsesmen === namaAsesmen)
    ).sort((a, b) => (a.nomorSoal || 0) - (b.nomorSoal || 0));
  }, [kisikisi, fase, kelas, semester, mapel, namaAsesmen]);

  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : (user.mapelDiampu || []);
  const isClassLocked = user.role === 'guru' && user.teacherType === 'kelas';

  const availableAsesmenNames = useMemo(() => {
    const names = kisikisi
      .filter(k => k.fase === fase && k.kelas === kelas && k.semester === semester && k.mataPelajaran === mapel)
      .map(k => k.namaAsesmen);
    return Array.from(new Set(names)).sort();
  }, [kisikisi, fase, kelas, semester, mapel]);

  const handleAddKisikisiRow = async (customName?: string) => {
    const nameToUse = customName || namaAsesmen;
    if (!nameToUse) { setShowAddAsesmenModal(true); return; }
    try {
      const nextNo = filteredKisikisi.length > 0 ? Math.max(...filteredKisikisi.map(k => k.nomorSoal)) + 1 : 1;
      await addDoc(collection(db, "kisikisi"), {
        fase, kelas, semester, mataPelajaran: mapel, namaAsesmen: nameToUse,
        elemen: '', cp: '', kompetensi: 'Pengetahuan dan Pemahaman', tpId: '', tujuanPembelajaran: '',
        indikatorSoal: '', jenis: 'Tes', bentukSoal: 'Pilihan Ganda', subBentukSoal: 'Multiple Answer', stimulus: '', soal: '', kunciJawaban: '', nomorSoal: nextNo,
        school: user.school
      });
      if (customName) setNamaAsesmen(nameToUse);
    } catch (e) { console.error(e); }
  };

  const handleCreateNewAsesmen = async () => {
    if (!modalInputValue.trim()) return;
    const newName = modalInputValue.trim().toUpperCase();
    await handleAddKisikisiRow(newName);
    setModalInputValue('');
    setShowAddAsesmenModal(false);
  };

  const updateKisiKisi = async (id: string, field: keyof KisiKisiItem, value: any) => {
    try {
      const updateData: any = { [field]: value };
      if (field === 'tpId') {
        const atp = tps.find(t => t.id === value);
        if (atp) {
          updateData.tujuanPembelajaran = atp.tujuanPembelajaran;
          updateData.elemen = atp.elemen;
          updateData.cp = atp.capaianPembelajaran;
        }
      }
      await updateDoc(doc(db, "kisikisi", id), updateData);
    } catch (e) { console.error(e); }
  };

  const generateIndikatorAI = async (item: KisiKisiItem) => {
    if (!item.tujuanPembelajaran) {
        setMessage({ text: "Pilih TP terlebih dahulu!", type: "warning" });
        return;
    }
    setAiLoadingMap(prev => ({ ...prev, [`ind-${item.id}`]: true }));
    try {
      const indikator = await generateIndikatorSoal(item, user.apiKey);
      if (indikator) {
          await updateKisiKisi(item.id, 'indikatorSoal', indikator);
      }
    } catch (e: any) {
      setMessage({ text: "Gagal: " + (e.message || "Cek kuota API"), type: "error" });
    } finally { 
      setAiLoadingMap(prev => ({ ...prev, [`ind-${item.id}`]: false })); 
    }
  };

  const generateSoalAI = async (item: KisiKisiItem) => {
    if (!item.indikatorSoal) {
        setMessage({ text: "Buat Indikator Soal terlebih dahulu!", type: "warning" });
        return;
    }
    setAiLoadingMap(prev => ({ ...prev, [`soal-${item.id}`]: true }));
    try {
      const result = await generateButirSoal(item, user.apiKey);
      if (result) {
        await updateDoc(doc(db, "kisikisi", item.id), { 
          stimulus: result.stimulus || "",
          soal: result.soal || "", 
          kunciJawaban: result.kunci || "" 
        });
      }
    } catch (e: any) {
      setMessage({ text: "Gagal: " + (e.message || "Cek kuota API"), type: "error" });
    } finally { 
      setAiLoadingMap(prev => ({ ...prev, [`soal-${item.id}`]: false })); 
    }
  };

  const triggerImageAI = async (item: KisiKisiItem) => {
     if (!item.indikatorSoal) { 
        setMessage({ text: "Buat Indikator Soal dulu!", type: "warning" }); 
        return; 
     }
     setAiLoadingMap(prev => ({ ...prev, [`img-${item.id}`]: true }));
     try {
        const context = item.stimulus || item.indikatorSoal;
        const base64 = await generateAiImage(context, kelas, item.kunciJawaban, user.apiKey);
        if (base64) {
           await updateDoc(doc(db, "kisikisi", item.id), { stimulusImage: base64 });
           setMessage({ text: "Gambar AI berhasil disimpan!", type: "success" });
           setTimeout(() => setMessage(null), 3000);
        } else {
           throw new Error("AI tidak mengembalikan gambar.");
        }
     } catch (e: any) {
        console.error(e);
        setMessage({ text: "Gagal membuat gambar: " + e.message, type: "error" });
     } finally {
        setAiLoadingMap(prev => ({ ...prev, [`img-${item.id}`]: false }));
     }
  };

  const renderSoalContent = (content: string, item: KisiKisiItem, isPrint = false, isStimulus = false) => {
    if (!content) return null;
    let preprocessedContent = content
      .replace(/\s+([B-E][\.\)])/g, '\n$1')
      .replace(/([?\.])\s+(A[\.\)])/g, '$1\n$2')
      .replace(/\[\s?\]/g, 'CHECKBOX_PLACEHOLDER');

    if (item.bentukSoal === 'Isian' && !isStimulus && !preprocessedContent.includes('....')) {
       preprocessedContent = preprocessedContent.trim().replace(/\.*$/, '') + ' ....................................';
    }

    const lines = preprocessedContent.split('\n');
    const renderedParts: React.ReactNode[] = [];
    let currentTableRows: string[][] = [];
    let currentParagraphLines: string[] = [];

    const flushParagraph = (key: string) => {
      if (currentParagraphLines.length > 0) {
        const isMultipleAnswer = item.bentukSoal === 'Pilihan Ganda Kompleks' && item.subBentukSoal === 'Multiple Answer';
        
        renderedParts.push(
          <div key={key} className={`whitespace-pre-wrap text-justify leading-relaxed ${item.bentukSoal === 'Isian' ? (isPrint ? 'mb-8' : 'mb-6') : 'mb-4'}`}>
            {currentParagraphLines.map((line, li) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return null;

              const hasCheckbox = line.includes('CHECKBOX_PLACEHOLDER') || line.startsWith('[]');
              const optionMatch = trimmedLine.match(/^([A-E])[\.\)]\s+(.*)/);

              if (optionMatch && item.bentukSoal === 'Pilihan Ganda') {
                const [_, label, text] = optionMatch;
                return (
                  <div key={li} className="flex items-start gap-3 mb-2 pl-2">
                    <span className={`font-black w-7 shrink-0 text-left ${isPrint ? 'text-[11px]' : 'text-[13px]'}`}>{label}.</span>
                    <span className={`flex-1 ${isPrint ? 'text-[11px]' : 'text-[13px]'}`}>{text}</span>
                  </div>
                );
              }

              if (isMultipleAnswer && (hasCheckbox || trimmedLine.length > 0)) {
                return (
                  <div key={li} className="flex items-start gap-4 mb-4 pl-1 group/opt">
                    <div className={`shrink-0 border-[1.5px] border-black rounded-sm ${isPrint ? 'w-4 h-4' : 'w-5 h-5'} bg-white flex items-center justify-center shadow-sm`}>
                    </div>
                    <span className={`${isPrint ? 'text-[11px]' : 'text-[13px]'} leading-tight font-bold flex-1 pt-0.5`}>
                       {line.replace(/CHECKBOX_PLACEHOLDER|\[\]/g, '').trim()}
                    </span>
                  </div>
                );
              }

              return (
                <div key={li} className="flex items-start gap-2 mb-1.5">
                  <span className={`${isPrint ? 'text-[11px]' : 'text-[14px]'} leading-relaxed`}>{line}</span>
                </div>
              );
            })}
          </div>
        );
        currentParagraphLines = [];
      }
    };

    const flushTable = (key: string) => {
      if (currentTableRows.length > 0) {
        let rows = currentTableRows.map(r => r.filter(c => c !== undefined).map(c => c.trim()));
        rows = rows.filter(r => r.join('').length > 0);
        if (rows.length === 0) { currentTableRows = []; return; }
        
        const header = rows[0];
        const isMatching = header.length === 3 && item.bentukSoal === 'Menjodohkan';
        const isGrid = item.bentukSoal === 'Pilihan Ganda Kompleks' && item.subBentukSoal === 'Grid';
        
        renderedParts.push(
          <div key={key} className={`my-6 overflow-x-auto ${isMatching ? '' : 'rounded-[1rem] border-2 border-black shadow-sm'}`}>
            <table className={`border-collapse w-full ${isPrint ? 'text-[10px]' : 'text-[12px]'} table-fixed`}>
              <colgroup>
                {isGrid && header.length >= 2 ? (
                  <>
                    <col style={{ width: '70%' }} />
                    {header.slice(1).map((_, i) => (
                      <col key={i} style={{ width: isPrint ? '15%' : '15%' }} />
                    ))}
                  </>
                ) : isMatching ? (
                  <>
                    <col style={{ width: '45%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '45%' }} />
                  </>
                ) : null}
              </colgroup>
              {!isMatching && (
                <thead>
                  <tr className="bg-slate-100">
                    {header.map((cell, i) => (
                      <th key={i} className="border-2 border-black p-3 font-black text-center uppercase tracking-tight text-[11px] whitespace-normal leading-tight">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {rows.slice(isMatching ? 0 : 1).map((row, ri) => (
                  <tr key={ri} className={`${isMatching ? 'border-none' : 'hover:bg-slate-50/50 transition-colors'}`}>
                    {row.map((cell, ci) => {
                      const isMiddleCol = isMatching && ci === 1;
                      const isGridCell = isGrid && ci > 0;
                      
                      if (isMatching) {
                        if (ci === 1) return <td key={ci} className="border-none"></td>;
                        const side = ci === 0 ? 'left' : 'right';
                        return (
                          <td key={ci} className="border-none py-3 relative px-1">
                             <div className={`relative border-[1.5px] border-rose-600 rounded-xl px-4 py-3 font-bold text-slate-800 text-center shadow-sm min-h-[4rem] flex items-center justify-center bg-white`}>
                                {cell}
                                <div className={`absolute top-1/2 ${side === 'left' ? '-right-1.5' : '-left-1.5'} -translate-y-1/2 w-4 h-4 bg-rose-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center`}>
                                   <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                </div>
                             </div>
                          </td>
                        );
                      }

                      return (
                        <td key={ci} className={`border-2 border-black p-3 ${isMiddleCol ? 'text-center' : (isGridCell ? 'text-center' : 'text-justify')} align-middle whitespace-normal leading-relaxed`}>
                          {isGridCell ? (
                             <div className="flex justify-center items-center py-1">
                               <div className={`${isPrint ? 'w-4 h-4' : 'w-5 h-5'} border-[1.5px] border-black rounded-sm bg-white shadow-sm flex-shrink-0`}></div>
                             </div>
                          ) : (
                            <div className="min-h-[1.5em]">{cell}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        currentTableRows = [];
      }
    };

    lines.forEach((line, index) => {
      if (line.trim().includes('|')) {
        if (currentParagraphLines.length > 0) flushParagraph(`p-${index}`);
        currentTableRows.push(line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|'));
      } else {
        if (currentTableRows.length > 0) flushTable(`t-${index}`);
        if (line.trim().length > 0) currentParagraphLines.push(line);
        else if (currentParagraphLines.length > 0) flushParagraph(`p-${index}`);
      }
    });
    flushParagraph('p-final'); flushTable('t-final');
    return <div className="soal-content-container" style={{ width: '100%', lineHeight: '1.6' }}>{renderedParts}</div>;
  };

  const handleExportWord = () => {
    const isKisiKisi = activeTab === 'KISI_KISI';
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${isKisiKisi ? 'Kisi-kisi' : 'Naskah Soal'}</title><style>body { font-family: 'Arial', sans-serif; font-size: 10pt; } table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } th, td { border: 1px solid black; padding: 5px; vertical-align: top; } .kop { text-align: center; border-bottom: 4px double black; padding-bottom: 10px; margin-bottom: 20px; }</style></head><body>`;
    const footer = "</body></html>";
    let contentHtml = isKisiKisi ? `
      <div class="kop"><h2>PEMERINTAH KABUPATEN GORONTALO</h2><h2>${settings.schoolName}</h2><p><i>${settings.address}</i></p></div>
      <div style="text-align:center"><h1>KISI-KISI ASESMEN</h1><p>TAHUN PELAJARAN ${activeYear}</p></div>
      <table border="1">
        <tr style="background:#f3f4f6">
          <th>ELEMEN / CP</th>
          <th>LEVEL</th>
          <th>INDIKATOR</th>
          <th>BENTUK</th>
          <th>TEKS BACAAN & BUTIR SOAL</th>
          <th>KUNCI</th>
          <th>NO</th>
        </tr>
        ${filteredKisikisi.map((item) => `
          <tr>
            <td><b>${item.elemen}</b><br/><i>${item.cp}</i></td>
            <td align="center">${item.kompetensi === 'Pengetahuan dan Pemahaman' ? 'L1' : item.kompetensi === 'Aplikasi' ? 'L2' : 'L3'}</td>
            <td>${item.indikatorSoal}</td>
            <td align="center">${item.bentukSoal}</td>
            <td>${item.stimulus ? '<i>' + item.stimulus + '</i><br/><br/>' : ''}${item.soal}</td>
            <td align="center"><b>${item.kunciJawaban}</b></td>
            <td align="center">${item.nomorSoal}</td>
          </tr>
        `).join('')}
      </table>
    ` : `
      <div class="kop"><h2>PEMERINTAH KABUPATEN GORONTALO</h2><h2>${settings.schoolName}</h2><p><i>${settings.address}</i></p></div>
      <div style="text-align:center"><h1>${namaAsesmen}</h1><p>TAHUN PELAJARAN ${activeYear}</p></div>
      <table style="border:1px solid black; width:100%; padding: 10px;"><tr><td>MAPEL: ${mapel}<br/>KELAS: ${kelas}</td><td>NAMA: ...................<br/>HARI: ...................</td></tr></table>
      ${filteredKisikisi.map(item => `<div style="margin-top:15px"><b>${item.nomorSoal}.</b> ${item.soal}</div>`).join('')}
    `;
    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isKisiKisi ? 'Kisi_Kisi' : 'Naskah_Soal'}_${mapel.replace(/ /g, '_')}.doc`;
    link.click();
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    const isKisiKisi = activeTab === 'KISI_KISI';
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { font-family: 'Arial', sans-serif; background: white; padding: 20px; color: black; line-height: 1.6; }
              @media print { 
                .no-print { display: none !important; } 
                body { padding: 0; }
                ${isKisiKisi ? '@page { size: landscape; margin: 1cm; }' : ''}
              }
              .break-inside-avoid { page-break-inside: avoid; }
              table { border-collapse: collapse; width: 100% !important; border: 1.5px solid black; table-layout: fixed !important; }
              th, td { border: 1.5px solid black; padding: 6px; overflow-wrap: break-word; }
              .soal-content-container { width: 100%; }
              td div { line-height: 1.5; }
              .Menjodohkan-box { border: 2px solid #e11d48; border-radius: 0.75rem; padding: 0.75rem; }
            </style>
          </head>
          <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">${content}</body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (isPrintMode) {
    const isKisiKisi = activeTab === 'KISI_KISI';
    return (
      <div className="bg-white min-h-screen text-slate-900 p-8 font-sans print:p-0">
        <div className="no-print mb-8 flex justify-between bg-slate-100 p-4 rounded-[2rem] border border-slate-200 shadow-xl sticky top-4 z-[100]">
           <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-8 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all"><ArrowLeft size={16}/> KEMBALI</button>
           <div className="flex gap-2">
             <button onClick={handleExportWord} className="bg-blue-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><FileDown size={16}/> WORD</button>
             <button onClick={handlePrint} className="bg-rose-600 text-white px-8 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><Printer size={16}/> CETAK SEKARANG</button>
           </div>
        </div>
        
        <div ref={printRef} className={`${isKisiKisi ? 'max-w-[29.7cm]' : 'max-w-[21cm]'} mx-auto bg-white p-4`}>
           <div className="text-center mb-2">
              <p className="text-sm font-bold uppercase tracking-widest leading-none">PEMERINTAH KABUPATEN GORONTALO</p>
              <h2 className="text-2xl font-black uppercase leading-tight mt-1">{settings.schoolName}</h2>
              <p className="text-[10px] font-medium italic mt-1 leading-none">{settings.address}</p>
           </div>
           
           <div className="border-b-[4px] border-double border-black mb-6 mt-3"></div>

           <div className="text-center mb-8">
              <h1 className="text-xl font-black uppercase tracking-tight">{isKisiKisi ? 'KISI-KISI ASESMEN' : namaAsesmen}</h1>
              <p className="text-xl font-black uppercase mt-1">TAHUN PELAJARAN {activeYear}</p>
           </div>
           
           {!isKisiKisi && (
             <div className="border-[1.5px] border-black rounded-[2.5rem] p-8 mb-8">
                <div className="grid grid-cols-2 gap-x-12">
                   <div className="space-y-2 text-[10.5pt]">
                      <div className="flex items-center"><span className="w-32 font-bold">Mata Pelajaran</span><span className="mr-3">:</span><span className="font-black uppercase">{mapel}</span></div>
                      <div className="flex items-center"><span className="w-32 font-bold">Fase / Kelas</span><span className="mr-3">:</span><span className="font-black uppercase">{fase} / {kelas}</span></div>
                      <div className="flex items-center"><span className="w-32 font-bold">Semester</span><span className="mr-3">:</span><span className="font-black uppercase">{semester === '1' ? 'Ganjil' : 'Genap'}</span></div>
                   </div>
                   <div className="space-y-2 text-[10.5pt]">
                      <div className="flex items-center"><span className="w-32 font-bold">Hari / Tanggal</span><span className="mr-3">:</span><div className="flex-1 border-b border-dotted border-black h-4"></div></div>
                      <div className="flex items-center"><span className="w-32 font-bold">Waktu</span><span className="mr-3">:</span><span className="font-black uppercase">{waktuPengerjaan}</span></div>
                      <div className="flex items-center"><span className="w-32 font-bold">Nama Siswa</span><span className="mr-3">:</span><div className="flex-1 border-b border-dotted border-black h-4"></div></div>
                   </div>
                </div>
             </div>
           )}

           {isKisiKisi ? (
              <table className="w-full border-collapse border-2 border-black text-[9pt]">
                <thead>
                  <tr className="bg-slate-100 font-black text-center uppercase h-12">
                    <th className="w-48">ELEMEN / CP</th>
                    <th className="w-16">LEVEL</th>
                    <th className="w-64">INDIKATOR</th>
                    <th className="w-24">BENTUK</th>
                    <th>TEKS BACAAN & BUTIR SOAL</th>
                    <th className="w-20">KUNCI</th>
                    <th className="w-12">NO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKisikisi.map((item) => (
                    <tr key={item.id} className="break-inside-avoid align-top">
                      <td className="p-3 border border-black">
                         <p className="font-black uppercase mb-1 leading-tight">{item.elemen}</p>
                         <p className="text-[8pt] italic text-slate-600 leading-tight">{item.cp}</p>
                      </td>
                      <td className="p-3 border border-black text-center font-bold">
                         {item.kompetensi === 'Pengetahuan dan Pemahaman' ? 'L1' : item.kompetensi === 'Aplikasi' ? 'L2' : 'L3'}
                      </td>
                      <td className="p-3 border border-black text-justify leading-tight">{item.indikatorSoal}</td>
                      <td className="p-3 border border-black text-center uppercase text-[8pt] font-bold">{item.bentukSoal} {item.bentukSoal === 'Pilihan Ganda Kompleks' ? `(${item.subBentukSoal})` : ''}</td>
                      <td className="p-3 border border-black">
                         {item.stimulus && (
                            <div className="mb-4 p-2 bg-slate-50 border border-slate-200 text-[8.5pt] italic">
                               {renderSoalContent(item.stimulus, item, true, true)}
                            </div>
                         )}
                         <div className="leading-relaxed">
                            {renderSoalContent(item.soal, item, true, false)}
                         </div>
                      </td>
                      <td className="p-3 border border-black text-center font-black">{item.kunciJawaban}</td>
                      <td className="p-3 border border-black text-center font-black">{item.nomorSoal}</td>
                    </tr>
                  ))}
                  {filteredKisikisi.length === 0 && <tr><td colSpan={7} className="text-center py-10 italic">Data kosong.</td></tr>}
                </tbody>
              </table>
           ) : (
              <div className="space-y-10 mt-8">
                {filteredKisikisi.map((item) => (
                  <div key={item.id} className="break-inside-avoid">
                    <div className="flex gap-4 items-start">
                      <span className="font-black text-lg min-w-[2rem]">{item.nomorSoal}.</span>
                      <div className="flex-1 space-y-5">
                         {item.stimulusImage && (<div className="flex justify-center my-6"><img src={item.stimulusImage} className="max-w-[300px] border-4 border-white shadow-xl rounded-xl p-1" /></div>)}
                         {item.stimulus && (<div className="p-6 bg-slate-50 border-2 border-black rounded-[1.5rem] text-[10.5pt] italic leading-relaxed text-justify shadow-inner">{renderSoalContent(item.stimulus, item, true, true)}</div>)}
                         <div className="text-[11pt] leading-relaxed text-slate-900">{renderSoalContent(item.soal, item, true, false)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
           )}

           <div className="mt-16 grid grid-cols-2 text-center text-[10pt] font-black uppercase break-inside-avoid">
              <div><p>Mengetahui,</p><p>{isKisiKisi ? 'Kepala Sekolah' : 'Orang Tua / Wali'}</p><div className="h-20"></div><p className={isKisiKisi ? 'border-b border-black inline-block min-w-[150px]' : ''}>{isKisiKisi ? settings.principalName : '( .................................... )'}</p></div>
              <div><p>Bilato, ........................</p><p>Guru Mata Pelajaran</p><div className="h-20"></div><p className="border-b border-black inline-block min-w-[150px]">{user.name}</p></div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {message && (<div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all ${
        message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
        message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
        'bg-red-50 border-red-200 text-red-800'
      }`}><CheckCircle2 size={20}/><span>{message.text}</span></div>)}
      
      {showAddAsesmenModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-md p-8 animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black uppercase">Buat Asesmen Baru</h3><button onClick={() => setShowAddAsesmenModal(false)}><X size={24}/></button></div>
             <input className="w-full bg-slate-50 border rounded-2xl p-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-rose-600" value={modalInputValue} onChange={e => setModalInputValue(e.target.value)} placeholder="NAMA ASESMEN" autoFocus />
             <button onClick={handleCreateNewAsesmen} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl mt-4 uppercase">BUAT SEKARANG</button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><BarChart3 size={24} /></div>
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button onClick={() => setActiveTab('KISI_KISI')} className={`px-5 py-2 rounded-xl text-[10px] font-black ${activeTab === 'KISI_KISI' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>KISI-KISI</button>
              <button onClick={() => setActiveTab('SOAL')} className={`px-5 py-2 rounded-xl text-[10px] font-black ${activeTab === 'SOAL' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>NASKAH SOAL</button>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAddAsesmenModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg hover:bg-indigo-700"><Plus size={16}/> BUAT BARU</button>
            <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg hover:bg-black"><Printer size={16}/> PRATINJAU</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6 p-5 bg-slate-50 rounded-2xl">
          <div><label className="text-[10px] font-black text-slate-400 block mb-1 flex items-center gap-1">FASE {isClassLocked && <Lock size={8} className="text-amber-500" />}</label><select disabled={isClassLocked} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold disabled:bg-slate-100 disabled:text-slate-400" value={fase} onChange={e => {setFase(e.target.value as Fase); updateFaseByKelas(kelas);}}>{Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}</select></div>
          <div><label className="text-[10px] font-black text-slate-400 block mb-1 flex items-center gap-1">KELAS {isClassLocked && <Lock size={8} className="text-amber-500" />}</label><select disabled={isClassLocked} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold disabled:bg-slate-100 disabled:text-slate-400" value={kelas} onChange={e => setKelas(e.target.value as Kelas)}>{fase === Fase.A && <><option value="1">1</option><option value="2">2</option></>}{fase === Fase.B && <><option value="3">3</option><option value="4">4</option></>} {fase === Fase.C && <><option value="5">5</option><option value="6">6</option></>}</select></div>
          <div><label className="text-[10px] font-black text-slate-400 block mb-1">MAPEL</label><select className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold" value={mapel} onChange={e => setMapel(e.target.value)}>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 block mb-1">ASESMEN</label><select className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold" value={namaAsesmen} onChange={e => setNamaAsesmen(e.target.value)}><option value="">Pilih Asesmen</option>{availableAsesmenNames.map(n => <option key={n}>{n}</option>)}</select></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4"><Loader2 size={48} className="animate-spin text-rose-600" /><p className="font-black text-xs uppercase tracking-widest">Sinkronisasi Cloud...</p></div>
        ) : activeTab === 'KISI_KISI' ? (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1800px] table-fixed">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black h-12 uppercase tracking-widest">
                  <th className="px-6 py-2 w-16 text-center border-r border-white/5">Idx</th>
                  <th className="px-6 py-2 w-48">Elemen & TP</th>
                  <th className="px-6 py-2 w-40 text-center">Level Kognitif</th>
                  <th className="px-6 py-2 w-48 text-center">Bentuk Soal</th>
                  <th className="px-6 py-2 w-72">Indikator Soal (AI)</th>
                  <th className="px-6 py-2 w-[700px]">Konten Soal (Teks, Pertanyaan, Kunci)</th>
                  <th className="px-6 py-2 w-24 text-center border-l border-white/5">No Soal</th>
                  <th className="px-6 py-2 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKisikisi.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 align-top transition-colors">
                    <td className="px-6 py-4 text-center font-black text-slate-300">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold mb-1" value={item.tpId} onChange={e => updateKisiKisi(item.id, 'tpId', e.target.value)}>
                        <option value="">Pilih TP</option>
                        {tps.filter(t => t.kelas === kelas && t.mataPelajaran === mapel).map(t => <option key={t.id} value={t.id}>{t.tujuanPembelajaran}</option>)}
                      </select>
                      <div className="text-[9px] text-slate-505 italic leading-tight">{item.tujuanPembelajaran}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select className="w-full bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 text-[10px] font-black text-indigo-700 outline-none" value={item.kompetensi} onChange={e => updateKisiKisi(item.id, 'kompetensi', e.target.value as any)}>
                        <option value="Pengetahuan dan Pemahaman">Pengetahuan dan Pemahaman</option>
                        <option value="Aplikasi">Aplikasi</option>
                        <option value="Penalaran">Penalaran</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 space-y-2">
                      <select className="w-full text-[10px] font-bold p-1.5 border rounded-xl bg-slate-50 outline-none" value={item.bentukSoal} onChange={e => updateKisiKisi(item.id, 'bentukSoal', e.target.value as any)}>
                        <option>Pilihan Ganda</option>
                        <option>Pilihan Ganda Kompleks</option>
                        <option>Menjodohkan</option>
                        <option>Isian</option>
                        <option>Uraian</option>
                      </select>
                      {item.bentukSoal === 'Pilihan Ganda Kompleks' && (
                        <div className="p-2 bg-rose-50 rounded-lg border border-rose-100 space-y-1">
                          <label className="text-[8px] font-black uppercase text-rose-600 block leading-tight">Tipe Kompleks:</label>
                          <select className="w-full text-[9px] font-black p-1 rounded-md border-rose-200 outline-none bg-white" value={item.subBentukSoal || 'Multiple Answer'} onChange={e => updateKisiKisi(item.id, 'subBentukSoal', e.target.value)}>
                             <option value="Multiple Answer">Multiple Choice Multiple Answer</option>
                             <option value="Grid">Asosiasi/Grid (B-S)</option>
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 relative group">
                      <textarea className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[10px] font-bold italic leading-relaxed min-h-[100px]" value={item.indikatorSoal} onChange={e => updateKisiKisi(item.id, 'indikatorSoal', e.target.value)} />
                      <button onClick={() => generateIndikatorAI(item)} disabled={aiLoadingMap[`ind-${item.id}`]} className="absolute bottom-6 right-8 text-indigo-600 bg-white p-1 rounded shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                        {aiLoadingMap[`ind-${item.id}`] ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14}/>}
                      </button>
                    </td>
                    <td className="px-6 py-4 bg-slate-50/30 relative group">
                       <div className="grid grid-cols-2 gap-4 h-full">
                          <div className="flex flex-col h-full">
                             <div className="flex items-center justify-between text-[9px] font-black text-indigo-600 uppercase mb-2">
                                <div className="flex items-center gap-1.5"><BookText size={12}/> Stimulus</div>
                                <button onClick={() => triggerImageAI(item)} disabled={aiLoadingMap[`img-${item.id}`]} className="p-1 hover:bg-white rounded transition-all text-indigo-400 hover:text-indigo-600">
                                   {aiLoadingMap[`img-${item.id}`] ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12}/>}
                                </button>
                             </div>
                             <div className="relative">
                                <textarea className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[10px] font-medium italic leading-relaxed min-h-[160px]" value={item.stimulus} placeholder="Tuliskan teks bacaan atau buat tabel di sini..." onChange={e => updateKisiKisi(item.id, 'stimulus', e.target.value)} />
                                {item.stimulusImage && <img src={item.stimulusImage} className="w-20 h-20 object-cover mt-2 rounded-lg border border-white shadow-md absolute bottom-2 right-2" alt="Preview"/>}
                             </div>
                             <div className="mt-2 overflow-hidden max-h-40 overflow-y-auto border border-slate-100 p-1 bg-white rounded-lg shadow-inner">{renderSoalContent(item.stimulus, item)}</div>
                          </div>
                          <div className="space-y-3 flex flex-col">
                             <div><span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Pertanyaan & Opsi:</span><textarea className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[11px] font-bold min-h-[120px]" value={item.soal} onChange={e => updateKisiKisi(item.id, 'soal', e.target.value)} placeholder="Tulis butir soal..." /></div>
                             <div className="overflow-hidden max-h-40 overflow-y-auto border border-slate-100 p-1 bg-white rounded-lg shadow-inner mb-2">{renderSoalContent(item.soal, item)}</div>
                             <div className="flex items-center gap-2 mt-auto"><span className="text-[9px] font-black uppercase text-slate-400">Kunci:</span><input className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] font-black text-indigo-600" value={item.kunciJawaban} onChange={e => updateKisiKisi(item.id, 'kunciJawaban', e.target.value)} placeholder="Jawaban benar..." /></div>
                          </div>
                       </div>
                       <button onClick={() => generateSoalAI(item)} disabled={aiLoadingMap[`soal-${item.id}`]} className="absolute bottom-6 right-4 bg-rose-600 text-white p-2.5 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all z-10">
                         {aiLoadingMap[`soal-${item.id}`] ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18}/>}
                       </button>
                    </td>
                    <td className="px-6 py-4 text-center border-l border-slate-50 bg-slate-50/30"><input type="number" className="w-16 text-[12px] text-center font-black p-2 border rounded-xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-indigo-600" value={item.nomorSoal} onChange={e => updateKisiKisi(item.id, 'nomorSoal', parseInt(e.target.value) || 0)} /></td>
                    <td className="px-6 py-4 text-center"><button onClick={() => deleteDoc(doc(db, "kisikisi", item.id))} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={8} className="p-6">
                    <button 
                      onClick={() => handleAddKisikisiRow()}
                      className="w-full py-8 border-2 border-dashed border-slate-200 rounded-[2rem] text-xs font-black text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                      <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                        <Plus size={24} className="text-indigo-600" />
                      </div>
                      <span className="uppercase tracking-[0.2em]">Tambah Baris Butir Soal Baru</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 bg-slate-50 min-h-[600px]">
             <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-2 gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-12">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Hari / Tanggal Pelaksanaan</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={hariTanggal} onChange={e => setHariTanggal(e.target.value)} placeholder="Contoh: Senin, 12 Juni 2024" /></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Alokasi Waktu</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={waktuPengerjaan} onChange={e => setWaktuPengerjaan(e.target.value)} placeholder="Contoh: 90 Menit" /></div>
                </div>
                <div className="space-y-1 bg-white p-1 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                   <table className="w-full border-collapse">
                      <thead><tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest h-10"><th className="w-16 px-4 text-center">No</th><th className="px-6 text-left">Naskah Soal & Bacaan</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredKisikisi.map((item) => (
                           <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors align-top">
                              <td className="py-8 px-4 align-top text-center"><span className="inline-flex items-center justify-center w-10 h-10 bg-slate-100 text-slate-900 rounded-xl font-black text-lg shadow-sm border border-slate-200 group-hover:bg-rose-600 group-hover:text-white transition-all">{item.nomorSoal}</span></td>
                              <td className="py-8 px-6 align-top break-words">
                                 <div className="space-y-6">
                                    {(item.stimulus || item.stimulusImage) && (
                                      <div>
                                         <p className="font-bold text-[11px] italic text-slate-600 mb-2">Cermatilah teks atau gambar berikut untuk menjawab soal nomor {item.nomorSoal}:</p>
                                         <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-indigo-100 shadow-sm relative overflow-hidden mb-6">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-600"><BookText size={64}/></div>
                                            {item.stimulusImage && (
                                               <div className="flex justify-center mb-8">
                                                  <img src={item.stimulusImage} className="max-w-[400px] rounded-2xl border-4 border-white shadow-2xl" alt="Stimulus" />
                                               </div>
                                            )}
                                            <div className="text-[10.5pt] leading-relaxed text-slate-800 italic">{renderSoalContent(item.stimulus, item, true, true)}</div>
                                         </div>
                                      </div>
                                    )}
                                    <div className="text-slate-900 text-[11pt] leading-relaxed pr-10">{renderSoalContent(item.soal, item, true, false)}</div>
                                 </div>
                              </td>
                           </tr>
                        ))}
                      </tbody>
                   </table>
                   {filteredKisikisi.length === 0 && <div className="py-40 text-center text-slate-400 italic uppercase font-black text-xs tracking-widest">Belum ada butir soal.</div>}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AsesmenManager;
