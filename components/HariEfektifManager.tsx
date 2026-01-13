
// @google/genai is not used directly here, but it's part of the global project context.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HariEfektif, SchoolSettings, AcademicYear, MATA_PELAJARAN, SEMUA_AKTIVITAS, EventKalender, JadwalItem, Kelas, User } from '../types';
import { 
  CalendarDays, Save, Printer, Eye, EyeOff, Info, Calculator, FileText, 
  ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, 
  Tag, Clock, Layout, GraduationCap, Loader2, Cloud, RefreshCw, 
  AlertTriangle, X, CheckCircle2, Lock, Wand2 
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from '../services/firebase';

const BULAN_SEM_1 = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SEM_2 = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const JAM_MAKS = 12;

const MONTH_MAP: Record<string, number> = {
  'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
  'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
};

interface HariEfektifManagerProps {
  user: User;
}

const HariEfektifManager: React.FC<HariEfektifManagerProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'RINCIAN' | 'KALENDER' | 'JADWAL'>('RINCIAN');
  const [semester, setSemester] = useState<1 | 2>(1);
  const [jpPerMinggu, setJpPerMinggu] = useState<number>(0);
  
  const [mapel, setMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [selectedKelas, setSelectedKelas] = useState<Kelas>('1');
  
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventKalender[]>([]);
  const [newEvent, setNewEvent] = useState<Partial<EventKalender>>({ type: 'libur', title: '', date: '' });
  const [jadwal, setJadwal] = useState<JadwalItem[]>([]);
  const [data, setData] = useState<HariEfektif[]>([]);
  const [activeYear, setActiveYear] = useState('..../....');

  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: 'SD NEGERI 5 BILATO',
    address: 'Kecamatan Bilato, Kabupaten Gorontalo',
    principalName: 'Nama Kepala Sekolah',
    principalNip: '-'
  });

  const isClassLocked = user.role === 'guru' && (user.teacherType === 'kelas' || (!user.teacherType && user.kelas !== '-' && user.kelas !== 'Multikelas'));

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.kelas !== '-' && user.kelas !== 'Multikelas') {
        setSelectedKelas(user.kelas as Kelas);
      }
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        if (!user.mapelDiampu.includes(mapel)) {
          setMapel(user.mapelDiampu[0]);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "settings", "school_info"), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });
    const unsubYears = onSnapshot(collection(db, "academic_years"), (snap) => {
      const active = snap.docs.find((d: any) => d.data().isActive);
      if (active) setActiveYear(active.data().year);
    });
    
    const unsubEfektif = onSnapshot(collection(db, "hari_efektif"), (snapshot) => {
      setData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as HariEfektif[]);
    });

    const unsubEvents = onSnapshot(collection(db, "kalender_events"), (snapshot) => {
      setEvents(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as EventKalender[]);
    });

    const unsubJadwal = onSnapshot(collection(db, "jadwal_pelajaran"), (snapshot) => {
      setJadwal(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as JadwalItem[]);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubYears(); unsubEfektif(); unsubEvents(); unsubJadwal(); };
  }, []);

  useEffect(() => {
    const count = jadwal.filter(j => j.kelas === selectedKelas && j.mapel === mapel).length;
    setJpPerMinggu(count);
  }, [jadwal, selectedKelas, mapel]);

  const filteredData = useMemo(() => {
    const bulanList = semester === 1 ? BULAN_SEM_1 : BULAN_SEM_2;
    return bulanList.map(bulan => {
      const found = data.find(d => d.kelas === selectedKelas && d.semester === semester && d.bulan === bulan);
      // Fix: Added missing 'id' property and matched property name 'mingguTidakEfektif' after typo fix in types.ts
      return found || { id: '', kelas: selectedKelas, semester, bulan, jumlahMinggu: 4, mingguTidakEfektif: 0, keterangan: '' } as HariEfektif;
    });
  }, [data, selectedKelas, semester]);

  const totalMinggu = filteredData.reduce((acc, curr) => acc + (curr.jumlahMinggu || 0), 0);
  const totalTidakEfektif = filteredData.reduce((acc, curr) => acc + (curr.mingguTidakEfektif || 0), 0);
  const totalEfektif = totalMinggu - totalTidakEfektif;
  const totalJP = totalEfektif * jpPerMinggu;

  const handleUpdateRincian = async (bulan: string, field: keyof HariEfektif, value: any) => {
    const existing = data.find(d => d.kelas === selectedKelas && d.semester === semester && d.bulan === bulan);
    try {
      if (existing) {
        await updateDoc(doc(db, "hari_efektif", existing.id), { [field]: value });
      } else {
        await addDoc(collection(db, "hari_efektif"), {
          kelas: selectedKelas, semester, bulan, 
          jumlahMinggu: field === 'jumlahMinggu' ? value : 4,
          // Fix: Property name comparison now valid after typo fix in types.ts
          mingguTidakEfektif: field === 'mingguTidakEfektif' ? value : 0,
          keterangan: field === 'keterangan' ? value : ''
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleSyncFromCalendar = async () => {
    setIsSyncing(true);
    const yearParts = activeYear.split('/');
    const yearStart = parseInt(yearParts[0]);
    const yearEnd = parseInt(yearParts[1]) || yearStart + 1;
    const bulanList = semester === 1 ? BULAN_SEM_1 : BULAN_SEM_2;

    try {
      for (const bulan of bulanList) {
        const monthIndex = MONTH_MAP[bulan];
        const year = monthIndex >= 6 ? yearStart : yearEnd;
        
        let mondayCount = 0;
        const d = new Date(year, monthIndex, 1);
        while (d.getMonth() === monthIndex) {
          if (d.getDay() === 1) mondayCount++;
          d.setDate(d.getDate() + 1);
        }

        let nonEffectiveWeeks = 0;
        let keteranganLibur = [];
        const startOfMonth = new Date(year, monthIndex, 1);
        const weekHolidays = new Set<number>();
        const monthEvents = events.filter(e => {
          const eDate = new Date(e.date);
          return eDate.getMonth() === monthIndex && eDate.getFullYear() === year && e.type === 'libur';
        });

        monthEvents.forEach(e => {
          const eDate = new Date(e.date);
          const weekNum = Math.ceil((eDate.getDate() + startOfMonth.getDay()) / 7);
          weekHolidays.add(weekNum);
          keteranganLibur.push(e.title);
        });

        nonEffectiveWeeks = weekHolidays.size;
        const uniqueKeterangan = Array.from(new Set(keteranganLibur)).join(', ');

        const existing = data.find(d => d.kelas === selectedKelas && d.semester === semester && d.bulan === bulan);
        const payload = {
          kelas: selectedKelas, semester, bulan,
          jumlahMinggu: mondayCount || 4,
          mingguTidakEfektif: nonEffectiveWeeks,
          keterangan: uniqueKeterangan || ''
        };

        if (existing) {
          await updateDoc(doc(db, "hari_efektif", existing.id), payload);
        } else {
          await addDoc(collection(db, "hari_efektif"), payload);
        }
      }
      setNotification({ text: 'Rincian disinkronkan dengan Kalender Pendidikan', type: 'success' });
    } catch (e) {
      setNotification({ text: 'Gagal sinkronisasi data', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date) return;
    try {
      await addDoc(collection(db, "kalender_events"), newEvent);
      setNewEvent({ type: 'libur', title: '', date: '' });
      setNotification({ text: 'Event berhasil ditambahkan', type: 'success' });
    } catch (e) { console.error(e); }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, "kalender_events", id));
      setNotification({ text: 'Event dihapus', type: 'info' });
    } catch (e) { console.error(e); }
  };

  const handleUpdateJadwal = async (hari: string, jamKe: number, newMapel: string) => {
    const existing = jadwal.find(j => j.kelas === selectedKelas && j.hari === hari && j.jamKe === jamKe);
    try {
      if (newMapel === '') {
        if (existing) await deleteDoc(doc(db, "jadwal_pelajaran", existing.id));
      } else {
        if (existing) {
          await updateDoc(doc(db, "jadwal_pelajaran", existing.id), { mapel: newMapel });
        } else {
          await addDoc(collection(db, "jadwal_pelajaran"), {
            kelas: selectedKelas, hari, jamKe, mapel: newMapel
          });
        }
      }
    } catch (e) { console.error(e); }
  };

  const handlePrintAction = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Perangkat - SDN 5 Bilato</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 40px; font-size: 10pt; color: black; }
              @media print { .no-print { display: none !important; } body { padding: 0; } }
              table { border-collapse: collapse; width: 100% !important; border: 1.5px solid black; }
              th, td { border: 1px solid black; padding: 6px; }
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

  const renderPrintHeader = (title: string) => (
    <div className="text-center mb-8">
      <h1 className="text-2xl font-black uppercase border-b-4 border-black pb-2 inline-block tracking-tighter">{title}</h1>
      <h2 className="text-xl font-bold mt-3 uppercase">{settings.schoolName}</h2>
      <div className="grid grid-cols-2 gap-4 mt-6 text-left text-[10px] font-bold font-sans uppercase">
         <div className="space-y-2">
           <div className="flex"><span>Wilayah</span><span className="ml-4 mr-2">:</span><span>Kec. Bilato, Kab. Gorontalo</span></div>
           <div className="flex"><span>Fase / Kelas</span><span className="ml-8 mr-2">:</span><span>{selectedKelas}</span></div>
         </div>
         <div className="space-y-2">
           <div className="flex"><span>Tahun Pelajaran</span><span className="ml-4 mr-2">:</span><span>{activeYear}</span></div>
           <div className="flex"><span>Semester</span><span className="ml-14 mr-2">:</span><span>{semester === 1 ? '1 (GANJIL)' : '2 (GENAP)'}</span></div>
         </div>
      </div>
    </div>
  );

  const renderSignature = () => (
    <div className="mt-16 grid grid-cols-2 text-center text-[10px] font-black uppercase font-sans break-inside-avoid">
       <div>
          <p>Mengetahui,</p>
          <p>Kepala Sekolah</p>
          <div className="h-20"></div>
          <p className="border-b border-black inline-block min-w-[180px]">{settings.principalName}</p>
          <p className="mt-1 font-normal uppercase tracking-tight">NIP. {settings.principalNip}</p>
       </div>
       <div>
          <p>Bilato, ........................</p>
          <p>Guru Kelas / Mata Pelajaran</p>
          <div className="h-20"></div>
          <p className="border-b border-black inline-block min-w-[180px]">{user.name}</p>
          <p className="mt-1 font-normal uppercase tracking-tight">NIP. {user.nip}</p>
       </div>
    </div>
  );

  const renderCalendar = (isPrint = false) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    
    for (let i = 0; i < (firstDay === 0 ? 0 : firstDay); i++) days.push(<div key={`p-${i}`} className={`border border-slate-100 ${isPrint ? 'h-20 bg-slate-50' : 'h-24 bg-slate-50/30'}`}></div>);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      days.push(
        <div key={d} className={`p-2 border border-slate-100 relative ${isPrint ? 'h-20 text-[8px]' : 'h-24 hover:bg-slate-50 group'} ${isWeekend ? 'bg-red-50/30' : 'bg-white'}`}>
          <span className={`font-black ${isWeekend ? 'text-red-500' : 'text-slate-400'}`}>{d}</span>
          <div className="mt-1 space-y-0.5 overflow-hidden">
            {isWeekend && <div className="p-0.5 rounded font-black uppercase bg-red-100 text-red-700/60 text-center text-[6px]">Libur Pekan</div>}
            {dayEvents.map(e => (
              <div key={e.id} className={`p-0.5 rounded font-black uppercase truncate flex items-center justify-between border ${
                e.type === 'libur' ? 'bg-red-600 text-white border-red-700' : 
                e.type === 'ujian' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                e.type === 'kegiatan' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                'bg-blue-100 text-blue-700 border-blue-200'
              }`}>
                <span>{e.title}</span>
                {!isPrint && <button onClick={() => handleDeleteEvent(e.id)} className="opacity-0 group-hover:opacity-100"><X size={8}/></button>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={`bg-white rounded-[32px] overflow-hidden ${isPrint ? 'border-2 border-black' : 'shadow-xl border border-slate-200'}`}>
        {!isPrint && (
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronLeft size={20}/></button>
              <h3 className="text-sm font-black uppercase tracking-widest">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(currentDate)}</h3>
              <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronRight size={20}/></button>
            </div>
            <div className="flex gap-2">
              <input type="date" className="bg-slate-800 text-white text-[10px] rounded-xl border-none w-32" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
              <input type="text" placeholder="Agenda..." className="bg-slate-800 text-white text-[10px] px-4 py-2 rounded-xl border-none w-48" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
              <select className="bg-slate-800 text-white text-[10px] rounded-xl border-none" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}>
                <option value="libur">Libur</option><option value="ujian">Ujian</option><option value="kegiatan">Kegiatan</option><option value="penting">Penting</option>
              </select>
              <button onClick={handleAddEvent} className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black shadow-lg">TAMBAH</button>
            </div>
          </div>
        )}
        {isPrint && <div className="bg-slate-900 text-white p-4 text-center font-black uppercase text-sm tracking-widest">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(currentDate)}</div>}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-black">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((n, i) => (
            <div key={n} className={`py-3 text-center text-[9px] font-black uppercase tracking-widest ${i === 0 || i === 6 ? 'text-red-500' : 'text-slate-500'}`}>{n}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">{days}</div>
        <div className={`p-4 flex items-center gap-6 ${isPrint ? 'bg-white text-[8px]' : 'bg-slate-50 border-t'}`}>
           <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-600 rounded-sm"></div><span className="font-black text-slate-500 uppercase">Libur</span></div>
           <div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-100 border border-amber-200 rounded-sm"></div><span className="font-black text-slate-500 uppercase">Ujian</span></div>
           <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-100 border border-emerald-200 rounded-sm"></div><span className="font-black text-slate-500 uppercase">Kegiatan</span></div>
        </div>
      </div>
    );
  };

  const renderJadwal = (isPrint = false) => {
    return (
      <div className="space-y-6">
        {!isPrint && (
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Clock size={24}/></div>
              <div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Jadwal Mingguan</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kelas {selectedKelas}</p></div>
            </div>
            <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200">
              {['1','2','3','4','5','6'].map(k => (
                <button key={k} disabled={isClassLocked && user.kelas !== k} onClick={() => setSelectedKelas(k as Kelas)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${selectedKelas === k ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-not-allowed'}`}>KELAS {k}</button>
              ))}
            </div>
          </div>
        )}

        <div className={`bg-white rounded-[40px] overflow-hidden ${isPrint ? 'border-2 border-black' : 'shadow-xl border border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black h-12 uppercase tracking-widest">
                  <th className="px-6 py-2 w-20 text-center border-r border-white/5">Jam</th>
                  {HARI.map(h => <th key={h} className="px-6 py-2 text-center border-r border-white/5">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: JAM_MAKS }).map((_, i) => {
                  const jamKe = i + 1;
                  return (
                    <tr key={jamKe} className={isPrint ? '' : 'hover:bg-slate-50 transition-colors'}>
                      <td className="px-6 py-3 text-center font-black text-slate-400 border-r border-slate-100 text-[10px]">{jamKe}</td>
                      {HARI.map(hari => {
                        const cellJadwal = jadwal.find(j => j.kelas === selectedKelas && j.hari === hari && j.jamKe === jamKe);
                        return (
                          <td key={hari} className="px-3 py-2 border-r border-slate-100">
                            {isPrint ? (
                              <div className={`text-center font-black text-[9px] uppercase leading-tight ${cellJadwal ? 'text-indigo-900' : 'text-slate-300'}`}>{cellJadwal?.mapel || '-'}</div>
                            ) : (
                              <select className={`w-full p-2.5 rounded-xl text-[10px] font-black border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${cellJadwal ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'bg-slate-50 text-slate-400'}`} value={cellJadwal?.mapel || ''} onChange={(e) => handleUpdateJadwal(hari, jamKe, e.target.value)}>
                                <option value="">- Kosong -</option>
                                {SEMUA_AKTIVITAS.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {notification && (
        <div className={`fixed top-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20}/> : <Cloud size={20}/>}
          <span className="text-sm font-black uppercase tracking-tight">{notification.text}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setActiveTab('RINCIAN')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'RINCIAN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>RINCIAN HARI EFEKTIF</button>
          <button onClick={() => setActiveTab('KALENDER')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'KALENDER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>KALENDER PENDIDIKAN</button>
          <button onClick={() => setActiveTab('JADWAL')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'JADWAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>JADWAL MINGGUAN</button>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => setIsPrintMode(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black shadow-lg"><Printer size={16}/> PRATINJAU & CETAK</button>
        </div>
      </div>

      {activeTab === 'RINCIAN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"><div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><GraduationCap size={24}/></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</p><p className="text-lg font-black text-slate-800">Kelas {selectedKelas}</p></div></div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"><div className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><CalendarDays size={24}/></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efektif</p><p className="text-lg font-black text-slate-800">{totalEfektif} Minggu</p></div></div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Clock size={24}/></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">JP/Minggu</p><p className="text-lg font-black text-slate-800">{jpPerMinggu} Jam</p></div></div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"><div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><Calculator size={24}/></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total JP</p><p className="text-lg font-black text-slate-800">{totalJP} Jam</p></div></div>
          </div>

          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button onClick={() => setSemester(1)} className={`px-8 py-2 rounded-xl text-[10px] font-black transition-all ${semester === 1 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>SEMESTER 1</button>
                  <button onClick={() => setSemester(2)} className={`px-8 py-2 rounded-xl text-[10px] font-black transition-all ${semester === 2 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>SEMESTER 2</button>
                </div>
                <button onClick={handleSyncFromCalendar} disabled={isSyncing} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-xl disabled:opacity-50">{isSyncing ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>} SINKRONISASI OTOMATIS</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Pilih Kelas {isClassLocked && <Lock size={8} className="inline text-amber-500" />}</label>
                  <select disabled={isClassLocked} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black outline-none disabled:bg-slate-100" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value as Kelas)}>
                    {['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-slate-200 shadow-inner">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black h-12 uppercase tracking-widest">
                    <th className="px-6 py-2 w-48 border-r border-white/5">Bulan</th>
                    <th className="px-6 py-2 w-32 text-center border-r border-white/5">Jml Minggu</th>
                    <th className="px-6 py-2 w-32 text-center border-r border-white/5">Tidak Efektif</th>
                    <th className="px-6 py-2 border-r border-white/5">Minggu Efektif</th>
                    <th className="px-6 py-2">Keterangan Agenda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map(item => (
                    <tr key={item.bulan} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-800 border-r border-slate-100">{item.bulan}</td>
                      <td className="px-6 py-4 border-r border-slate-100"><input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-xs font-black" value={item.jumlahMinggu} onChange={e => handleUpdateRincian(item.bulan, 'jumlahMinggu', parseInt(e.target.value))} /></td>
                      <td className="px-6 py-4 border-r border-slate-100"><input type="number" className="w-full bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-2 text-center text-xs font-black" value={item.mingguTidakEfektif} onChange={e => handleUpdateRincian(item.bulan, 'mingguTidakEfektif', parseInt(e.target.value))} /></td>
                      <td className="px-6 py-4 border-r border-slate-100 text-center"><span className="inline-block bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm border border-emerald-100">{(item.jumlahMinggu || 0) - (item.mingguTidakEfektif || 0)}</span></td>
                      <td className="px-6 py-4"><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium h-10 focus:h-20 transition-all outline-none" value={item.keterangan} onChange={e => handleUpdateRincian(item.bulan, 'keterangan', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'KALENDER' && renderCalendar()}
      {activeTab === 'JADWAL' && renderJadwal()}

      {isPrintMode && (
        <div className="fixed inset-0 bg-white z-[300] overflow-y-auto p-12 font-serif text-black">
          <div className="no-print mb-10 flex justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200 font-sans">
             <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-black">KEMBALI KE EDITOR</button>
             <button onClick={handlePrintAction} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-lg">CETAK PDF SEKARANG</button>
          </div>
          <div ref={printRef}>
            {activeTab === 'RINCIAN' && (
              <>
                {renderPrintHeader("Rincian Hari Efektif & Alokasi Waktu")}
                <table className="w-full text-[11px] mb-10">
                  <thead>
                    <tr className="bg-slate-100 uppercase font-black text-center">
                      <th className="w-10">No</th><th>Bulan</th><th className="w-24">Jumlah Minggu</th><th className="w-24">Minggu Tidak Efektif</th><th className="w-24">Minggu Efektif</th><th className="text-left px-4">Keterangan Agenda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, idx) => (
                      <tr key={item.bulan} className="h-10 text-center">
                        <td>{idx + 1}</td><td className="text-left px-4 font-bold">{item.bulan}</td><td>{item.jumlahMinggu}</td><td>{item.mingguTidakEfektif}</td><td className="font-black">{(item.jumlahMinggu || 0) - (item.mingguTidakEfektif || 0)}</td><td className="text-left px-4 text-[10px]">{item.keterangan || '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black">
                      <td colSpan={2} className="px-4 text-right uppercase">Jumlah Total Per Semester</td>
                      <td>{totalMinggu}</td><td>{totalTidakEfektif}</td><td className="text-lg">{totalEfektif}</td><td>Minggu Efektif Terhitung</td>
                    </tr>
                  </tbody>
                </table>
                <div className="bg-slate-50 border-2 border-black p-6 rounded-lg mb-10">
                   <h3 className="font-black uppercase mb-4 text-xs underline">ANALISIS ALOKASI WAKTU</h3>
                   <div className="space-y-2 text-[10px] font-bold font-sans uppercase">
                      <div className="flex"><span>1. Jumlah Minggu Efektif (A)</span><span className="ml-16 mr-4">:</span><span>{totalEfektif} Minggu</span></div>
                      <div className="flex"><span>2. Jam Pelajaran (B)</span><span className="ml-24 mr-4">:</span><span>{jpPerMinggu} JP / Minggu</span></div>
                      <div className="flex items-center text-xs font-black border-t border-black pt-3 mt-3"><span>3. Total Alokasi Waktu (A x B)</span><span className="ml-12 mr-4">:</span><span className="bg-black text-white px-4 py-1">{totalJP} JAM PELAJARAN (JP)</span></div>
                   </div>
                </div>
              </>
            )}
            {activeTab === 'KALENDER' && (
              <>
                {renderPrintHeader("Kalender Pendidikan Bulanan")}
                {renderCalendar(true)}
              </>
            )}
            {activeTab === 'JADWAL' && (
              <>
                {renderPrintHeader("Jadwal Pelajaran Mingguan")}
                {renderJadwal(true)}
              </>
            )}
            {renderSignature()}
          </div>
        </div>
      )}
    </div>
  );
};

export default HariEfektifManager;
