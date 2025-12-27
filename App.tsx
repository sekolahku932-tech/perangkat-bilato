
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, GraduationCap, School as SchoolIcon, ClipboardList, ListTree, LogOut, 
  User as UserIcon, Shield, Settings, Users, CalendarDays, FileText, 
  CalendarRange, Rocket, Menu, X, ChevronRight, Loader2, AlertTriangle,
  BarChart3, LayoutDashboard, Code, BookText, PenTool, ClipboardCheck,
  FileSearch, ArrowLeft
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import CPManager from './components/CPManager';
import AnalisisManager from './components/AnalisisManager';
import ATPManager from './components/ATPManager';
import SettingsManager from './components/SettingsManager';
import UserManager from './components/UserManager';
import HariEfektifManager from './components/HariEfektifManager';
import ProtaManager from './components/ProtaManager';
import PromesManager from './components/PromesManager';
import RPMManager from './components/RPMManager';
import AsesmenManager from './components/AsesmenManager';
import JurnalManager from './components/JurnalManager';
import LKPDManager from './components/LKPDManager';
import EvaluasiManager from './components/EvaluasiManager';
import DocumentManager from './components/DocumentManager';
import AIAssistant from './components/AIAssistant';
import LoginPage from './components/LoginPage';
import SchoolSelector from './components/SchoolSelector';
import { User, School, LIST_SEKOLAH } from './types';
import { auth, db, onAuthStateChanged, signOut, doc, onSnapshot } from './services/firebase';

const App: React.FC = () => {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(() => {
    const saved = localStorage.getItem('selectedSchoolId');
    if (saved) return LIST_SEKOLAH.find(s => s.id === saved) || null;
    return null;
  });

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'DASHBOARD' | 'CP' | 'ANALISIS' | 'ATP' | 'DOKUMEN' | 'SETTING' | 'USER' | 'EFEKTIF' | 'PROTA' | 'PROMES' | 'RPM' | 'LKPD' | 'ASESMEN_SUMATIF' | 'EVALUASI' | 'JURNAL'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isAdvancedMode] = useState(localStorage.getItem('advanced_mode') === 'true');

  useEffect(() => {
    if (!selectedSchool) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const unsubUser = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            const userData = { id: firebaseUser.uid, ...snap.data() } as User;
            setUser(userData);
          } else {
            setUser({ 
              id: firebaseUser.uid, 
              username: firebaseUser.email?.split('@')[0] || '', 
              role: 'guru', 
              teacherType: 'kelas',
              name: firebaseUser.displayName || 'Guru Baru', 
              nip: '-', 
              kelas: '-', 
              mapelDiampu: [] 
            });
          }
          setLoading(false);
        });
        return () => unsubUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [selectedSchool]);

  const handleSelectSchool = (school: School) => {
    localStorage.setItem('selectedSchoolId', school.id);
    setSelectedSchool(school);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowLogoutConfirm(false);
  };

  const handleChangeSchool = () => {
    localStorage.removeItem('selectedSchoolId');
    setSelectedSchool(null);
    setUser(null);
  };

  // Nav items list
  const rawNavItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard size={20} />, color: 'text-slate-900', bg: 'bg-slate-100' },
    { id: 'DOKUMEN', label: 'Analisis File (AI)', icon: <FileSearch size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'EFEKTIF', label: 'Hari Efektif', icon: <CalendarDays size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'CP', label: 'Capaian Pembelajaran', icon: <BookOpen size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'ANALISIS', label: 'Analisis CP-TP', icon: <ClipboardList size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'ATP', label: 'Alur Tujuan (ATP)', icon: <ListTree size={20} />, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'PROTA', label: 'Program Tahunan', icon: <FileText size={20} />, color: 'text-violet-600', bg: 'bg-violet-50' },
    { id: 'PROMES', label: 'Program Semester', icon: <CalendarRange size={20} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'RPM', label: 'RPM (Deep Learning)', icon: <Rocket size={20} />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { id: 'LKPD', label: 'Lembar Kerja (LKPD)', icon: <PenTool size={20} />, color: 'text-blue-600', bg: 'bg-blue-50', isAdvanced: true },
    { id: 'JURNAL', label: 'Jurnal Harian', icon: <BookText size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50', isAdvanced: true },
    { id: 'ASESMEN_SUMATIF', label: 'Asesmen Sumatif', icon: <BarChart3 size={20} />, color: 'text-rose-600', bg: 'bg-rose-50', isAdvanced: true },
    { id: 'EVALUASI', label: 'Evaluasi & Nilai', icon: <ClipboardCheck size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50', isAdvanced: true },
    { id: 'USER', label: 'Manajemen User', icon: <Users size={20} />, color: 'text-slate-600', bg: 'bg-slate-100', adminOnly: true },
    { id: 'SETTING', label: 'Pengaturan', icon: <Settings size={20} />, color: 'text-slate-700', bg: 'bg-slate-200', adminOnly: true },
  ];

  // Filter items based on advanced mode and role
  const navItems = rawNavItems.filter(item => {
    if (item.isAdvanced && !isAdvancedMode) return false;
    return true;
  });

  if (!selectedSchool) {
    return <SchoolSelector onSelect={handleSelectSchool} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Memvalidasi Akses {selectedSchool.name}...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <button 
          onClick={handleChangeSchool}
          className="fixed top-6 left-6 z-50 bg-white shadow-xl p-3 rounded-2xl text-slate-500 hover:text-blue-600 flex items-center gap-2 text-xs font-black transition-all"
        >
          <ArrowLeft size={16}/> GANTI SEKOLAH
        </button>
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <AIAssistant user={user} />

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Konfirmasi Keluar</h3>
              <p className="text-slate-500 font-medium text-sm">Apakah Anda yakin ingin keluar dari sistem database {selectedSchool.name}?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={handleLogout} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">YA, KELUAR</button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-50 transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl text-white shadow-lg ${
                selectedSchool.id === 'sdn1' ? 'bg-blue-600' :
                selectedSchool.id === 'sdn2' ? 'bg-indigo-600' :
                selectedSchool.id === 'sdn3' ? 'bg-violet-600' :
                selectedSchool.id === 'sdn4' ? 'bg-emerald-600' :
                selectedSchool.id === 'sdn5' ? 'bg-rose-600' :
                selectedSchool.id === 'sdn6' ? 'bg-amber-600' :
                selectedSchool.id === 'sdn7' ? 'bg-cyan-600' : 'bg-slate-600'
              }`}>
                <SchoolIcon size={24} />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-sm font-black text-slate-900 leading-none uppercase truncate">{selectedSchool.name}</h1>
                <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">Database Cloud Aktif</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {navItems.map((item) => {
              if (item.adminOnly && user.role !== 'admin') return null;
              return (
                <div key={item.id} className="space-y-1">
                  <button 
                    onClick={() => { setActiveMenu(item.id as any); setIsSidebarOpen(false); }} 
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all group ${activeMenu === item.id ? `${item.bg} ${item.color} shadow-sm border border-slate-100` : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${activeMenu === item.id ? item.color : 'text-slate-400'}`}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {activeMenu === item.id && <ChevronRight size={14} />}
                  </button>
                </div>
              );
            })}
          </nav>
          <div className="p-4 border-t border-slate-100 shrink-0">
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                <UserIcon size={20} />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
                <p className="text-[10px] text-blue-600 font-bold uppercase">{user.role}</p>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-black text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100">
                <LogOut size={18} /> KELUAR AKUN
              </button>
              <button onClick={handleChangeSchool} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-[9px] font-black text-slate-400 hover:text-slate-600 transition-all uppercase">
                <ArrowLeft size={14} /> GANTI SEKOLAH
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-1.5 opacity-30">
              <Code size={10} className="text-slate-400" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">By Ariyanto Rahman</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 shrink-0 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"><Menu size={24} /></button>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <GraduationCap size={16} className="text-blue-500" />
              <span>Menu</span>
              <ChevronRight size={12} />
              <span className="text-slate-900">
                {navItems.find(i => i.id === activeMenu)?.label}
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {activeMenu === 'DASHBOARD' && <Dashboard user={user} onNavigate={(id) => setActiveMenu(id)} />}
            {activeMenu === 'DOKUMEN' && <DocumentManager user={user} />}
            {activeMenu === 'CP' && <CPManager user={user} />}
            {activeMenu === 'ANALISIS' && <AnalisisManager user={user} />}
            {activeMenu === 'ATP' && <ATPManager user={user} />}
            {activeMenu === 'SETTING' && <SettingsManager user={user} />}
            {activeMenu === 'USER' && <UserManager user={user} />}
            {activeMenu === 'EFEKTIF' && <HariEfektifManager user={user} />}
            {activeMenu === 'PROTA' && <ProtaManager user={user} />}
            {activeMenu === 'PROMES' && <PromesManager user={user} />}
            {activeMenu === 'RPM' && <RPMManager user={user} />}
            {activeMenu === 'LKPD' && <LKPDManager user={user} />}
            {activeMenu === 'JURNAL' && <JurnalManager user={user} />}
            {activeMenu === 'ASESMEN_SUMATIF' && <AsesmenManager type="sumatif" user={user} />}
            {activeMenu === 'EVALUASI' && <EvaluasiManager user={user} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
