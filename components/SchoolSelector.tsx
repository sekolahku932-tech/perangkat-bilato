
import React, { useState } from 'react';
import { LIST_SEKOLAH, School } from '../types';
import { School as SchoolIcon, ArrowRight, MapPin, Building2, ShieldCheck, Lock, Unlock, CheckCircle2, X } from 'lucide-react';

interface SchoolSelectorProps {
  onSelect: (school: School) => void;
}

const SchoolSelector: React.FC<SchoolSelectorProps> = ({ onSelect }) => {
  const [clickCount, setClickCount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(localStorage.getItem('advanced_mode') === 'true');

  const SECRET_PIN = "2025"; // PIN KHUSUS ANDA

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    if (newCount >= 5) {
      setShowPinModal(true);
      setClickCount(0);
    } else {
      setClickCount(newCount);
      // Reset count after 2 seconds of inactivity
      setTimeout(() => setClickCount(0), 2000);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === SECRET_PIN) {
      const newState = !isAdvanced;
      localStorage.setItem('advanced_mode', newState.toString());
      setIsAdvanced(newState);
      setShowPinModal(false);
      setPinInput('');
      setError(false);
      window.location.reload(); // Refresh to update App menu
    } else {
      setError(true);
      setPinInput('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Secret PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto transition-colors ${error ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {isAdvanced ? <Unlock size={32} /> : <Lock size={32} />}
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Akses Menu Khusus</h3>
              <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mb-6">
                {isAdvanced ? 'Matikan fitur tambahan?' : 'Masukkan PIN untuk Aktivasi'}
              </p>
              
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="****"
                  className={`w-full bg-slate-100 border-2 rounded-2xl p-4 text-center text-2xl font-black tracking-[0.5em] outline-none transition-all ${error ? 'border-red-500 animate-shake' : 'border-transparent focus:border-blue-500'}`}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPinModal(false)} className="flex-1 py-3 text-xs font-black text-slate-400 uppercase">Batal</button>
                  <button type="submit" className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase shadow-lg">Verifikasi</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl w-full relative z-10">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <button 
            onClick={handleLogoClick}
            className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-[2rem] text-white shadow-2xl mb-6 hover:scale-105 active:scale-95 transition-all relative group"
          >
            <SchoolIcon size={48} />
            {isAdvanced && (
              <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full border-4 border-slate-50 shadow-lg">
                <Unlock size={14} />
              </div>
            )}
          </button>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">SD NEGERI BILATO SERIES</h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-[0.3em] mt-3">Silakan Pilih Satuan Pendidikan Anda</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-px w-12 bg-slate-200"></div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100 flex items-center gap-1.5">
              <ShieldCheck size={12}/> CLOUD DATABASE PER SEKOLAH AKTIF
            </span>
            <div className="h-px w-12 bg-slate-200"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-1000">
          {LIST_SEKOLAH.map((school) => (
            <button
              key={school.id}
              onClick={() => onSelect(school)}
              className="group bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm hover:shadow-2xl hover:border-blue-500 transition-all duration-500 text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Building2 size={80} />
              </div>
              
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-all duration-500 ${
                school.id === 'sdn1' ? 'bg-blue-600' :
                school.id === 'sdn2' ? 'bg-indigo-600' :
                school.id === 'sdn3' ? 'bg-violet-600' :
                school.id === 'sdn4' ? 'bg-emerald-600' :
                school.id === 'sdn5' ? 'bg-rose-600' :
                school.id === 'sdn6' ? 'bg-amber-600' :
                school.id === 'sdn7' ? 'bg-cyan-600' : 'bg-slate-600'
              } text-white`}>
                <SchoolIcon size={24} />
              </div>

              <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 group-hover:text-blue-600 transition-colors uppercase">
                {school.name}
              </h3>
              
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                <MapPin size={10} /> KEC. BILATO
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-300 group-hover:text-blue-600 uppercase transition-colors">Masuk Sistem</span>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                  <ArrowRight size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-16 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Developed by Ariyanto Rahman &copy; 2025 • SDN BILATO Multi-Tenant Cloud
        </div>
      </div>
    </div>
  );
};

export default SchoolSelector;
