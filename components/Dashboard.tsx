
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, ClipboardList, ListTree, FileText, 
  CalendarRange, Rocket, Users, GraduationCap, 
  LayoutDashboard, Cloud, CheckCircle2, ArrowRight,
  BarChart3, Code
} from 'lucide-react';
import { db, collection, onSnapshot } from '../services/firebase';
import { User } from '../types';

interface DashboardProps {
  user: User;
  onNavigate: (menu: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const [stats, setStats] = useState({
    cp: 0,
    analisis: 0,
    atp: 0,
    prota: 0,
    promes: 0,
    rpm: 0,
    siswa: 0,
    users: 0,
    kisikisi: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collections = [
      { key: 'cp', name: 'cps' },
      { key: 'analisis', name: 'analisis' },
      { key: 'atp', name: 'atp' },
      { key: 'prota', name: 'prota' },
      { key: 'promes', name: 'promes' },
      { key: 'rpm', name: 'rpm' },
      { key: 'siswa', name: 'siswa' },
      { key: 'users', name: 'users' },
      { key: 'kisikisi', name: 'kisikisi' }
    ];

    const unsubscribes = collections.map(coll => 
      onSnapshot(collection(db, coll.name), (snap) => {
        let count = 0;
        if (user.role === 'admin') {
          count = snap.size;
        } else {
          // Filter data di client side untuk statistik dashboard guru
          count = snap.docs.filter(doc => {
            const data = doc.data();
            const matchKelas = data.kelas === user.kelas;
            const matchMapel = user.mapelDiampu.includes(data.mataPelajaran || data.mapel);
            
            // CP tidak punya field kelas, filter berdasarkan mapel saja
            if (coll.key === 'cp') return user.mapelDiampu.includes(data.mataPelajaran);
            
            return matchKelas || matchMapel;
          }).length;
        }
        setStats(prev => ({ ...prev, [coll.key]: count }));
      })
    );

    setLoading(false);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user]);

  const statCards = [
    { id: 'CP', label: 'Capaian Pembelajaran', count: stats.cp, icon: <BookOpen />, color: 'blue' },
    { id: 'ANALISIS', label: 'Analisis CP-TP', count: stats.analisis, icon: <ClipboardList />, color: 'emerald' },
    { id: 'ATP', label: 'Alur Tujuan (ATP)', count: stats.atp, icon: <ListTree />, color: 'amber' },
    { id: 'PROTA', label: 'Program Tahunan', count: stats.prota, icon: <FileText />, color: 'violet' },
    { id: 'PROMES', label: 'Program Semester', count: stats.promes, icon: <CalendarRange />, color: 'rose' },
    { id: 'RPM', label: 'RPM Mendalam', count: stats.rpm, icon: <Rocket />, color: 'cyan' },
    { id: 'ASESMEN_SUMATIF', label: 'Asesmen Sumatif', count: stats.kisikisi, icon: <BarChart3 />, color: 'indigo' },
    { id: 'USER', label: 'Akses Pengguna', count: stats.users, icon: <GraduationCap />, color: 'slate', adminOnly: true },
  ].filter(card => !card.adminOnly || user.role === 'admin');

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 ring-blue-500',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 ring-amber-500',
    violet: 'bg-violet-50 text-violet-600 border-violet-100 ring-violet-500',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 ring-rose-500',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100 ring-cyan-500',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 ring-indigo-500',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 ring-slate-500',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Welcome Section */}
      <div className="bg-slate-900 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 scale-150 rotate-12">
          <LayoutDashboard size={200} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="px-4 py-1.5 bg-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Cloud size={12} /> Cloud Aktif
            </div>
            <div className="px-4 py-1.5 bg-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 size={12} /> {user.role === 'admin' ? 'Administrator' : `Guru Kelas ${user.kelas}`}
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
            Selamat Datang, <span className="text-blue-400">{user.name}</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed mb-8">
            {user.role === 'admin' 
              ? 'Kelola seluruh infrastruktur kurikulum dan pengguna SD Negeri 5 Bilato.'
              : `Kelola perangkat pembelajaran digital untuk Kelas ${user.kelas}. Data Anda tersinkronisasi secara aman di Cloud.`}
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => onNavigate('CP')}
              className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-xs font-black hover:bg-blue-50 transition-all flex items-center gap-2 shadow-xl"
            >
              MULAI MENYUSUN <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className={`p-6 rounded-[32px] border transition-all hover:scale-[1.02] active:scale-95 group text-left shadow-sm hover:shadow-xl ${colorMap[card.color]}`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl bg-white shadow-sm group-hover:shadow-md transition-all ${card.color === 'slate' ? 'text-slate-600' : ''}`}>
                {React.cloneElement(card.icon as React.ReactElement<any>, { size: 24 })}
              </div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" size={18} />
            </div>
            <div>
              <p className="text-3xl font-black mb-1 tracking-tight">{card.count}</p>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{card.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-600 group-hover:scale-110 transition-transform">
            <LayoutDashboard size={80} />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Informasi Akun</h3>
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Akses Mapel</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                  {user.mapelDiampu.map(m => (
                    <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold">{m}</span>
                  ))}
                </div>
             </div>
             <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">NIP</span>
                <span className="text-xs font-bold text-slate-800">{user.nip || '-'}</span>
             </div>
             <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Wilayah Kerja</span>
                <span className="text-xs font-black text-emerald-600 uppercase">Kelas {user.kelas}</span>
             </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-500 group-hover:scale-110 transition-transform">
            <Code size={80} />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Pengembang Sistem</h3>
          <div className="flex flex-col items-center justify-center py-4">
            <p className="text-xl font-black text-slate-800 tracking-tighter uppercase mb-1">Ariyanto Rahman</p>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Lead Developer</p>
            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">v1.0 stable</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
