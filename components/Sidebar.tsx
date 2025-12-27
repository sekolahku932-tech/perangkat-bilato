
import React from 'react';
import { AppView } from '../types';

interface SidebarProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: '📊' },
    { id: AppView.ANALYSIS, label: 'Analisis Dokumen', icon: '📄' },
    { id: AppView.GENERATOR, label: 'Generator Perangkat', icon: '✨' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
          <span>🎓</span> EduGenie
        </h1>
        <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">Smart Teacher Assistant</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === item.id
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="bg-indigo-600 rounded-2xl p-4 text-white">
          <p className="text-sm font-medium opacity-90">Butuh Bantuan?</p>
          <p className="text-xs mt-1 opacity-75">Tanyakan apapun pada asisten AI kami.</p>
          <button className="mt-3 w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg text-xs font-semibold transition-colors">
            Panduan Penggunaan
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
