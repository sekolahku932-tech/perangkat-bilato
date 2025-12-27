
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fase, CapaianPembelajaran, MATA_PELAJARAN, SchoolSettings, User, LIST_SEKOLAH } from '../types';
import { Plus, Edit2, Trash2, Save, X, Loader2, Cloud, AlertTriangle, Eye, EyeOff, Printer, FileDown, AlertCircle, Lock } from 'lucide-react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from '../services/firebase';

interface CPManagerProps {
  user: User;
}

const CPManager: React.FC<CPManagerProps> = ({ user }) => {
  const [cps, setCps] = useState<CapaianPembelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFase, setFilterFase] = useState<Fase>(Fase.A);
  const [filterMapel, setFilterMapel] = useState<string>(MATA_PELAJARAN[0]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [formData, setFormData] = useState<Partial<CapaianPembelajaran>>({
    fase: Fase.A,
    mataPelajaran: MATA_PELAJARAN[0],
    kode: '',
    elemen: '',
    deskripsi: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const isClassLocked = user.role === 'guru' && (user.teacherType === 'kelas' || (!user.teacherType && user.kelas !== '-' && user.kelas !== 'Multikelas'));

  useEffect(() => {
    if (user.role === 'guru') {
      if (user.mapelDiampu && user.mapelDiampu.length > 0) {
        setFilterMapel(user.mapelDiampu[0]);
      }
      if (['1', '2'].includes(user.kelas)) setFilterFase(Fase.A);
      else if (['3', '4'].includes(user.kelas)) setFilterFase(Fase.B);
      else if (['5', '6'].includes(user.kelas)) setFilterFase(Fase.C);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubSettings = onSnapshot(doc(db, "settings", "school_info"), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SchoolSettings);
    });

    const cpsCollection = collection(db, "cps");
    const unsubscribe = onSnapshot(cpsCollection, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CapaianPembelajaran[];
      setCps(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      setLoading(false);
    });

    return () => { unsubSettings(); unsubscribe(); };
  }, []);

  const handleExportWord = () => {
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Export Word</title>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid black; padding: 8px; font-family: 'Arial'; font-size: 11px; }
        .text-center { text-align: center; }
      </style>
      </head><body>
    `;
    const footer = "</body></html>";
    
    let tableHtml = `
      <div style="text-align:center">
        <h2 style="margin:0">CAPAIAN PEMBELAJARAN (CP)</h2>
        <h3 style="margin:5px 0">${settings.schoolName}</h3>
        <p style="font-size:10px">MAPEL: ${filterMapel} | FASE: ${filterFase}</p>
      </div>
      <br/>
      <table>
        <thead>
          <tr style="background-color: #f3f4f6">
            <th style="width:30px">NO</th>
            <th style="width:80px">KODE</th>
            <th style="width:150px">ELEMEN</th>
            <th>DESKRIPSI CAPAIAN PEMBELAJARAN</th>
          </tr>
        </thead>
        <tbody>
          ${filteredCps.map((cp, idx) => `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td class="text-center">${cp.kode}</td>
              <td><b>${cp.elemen}</b></td>
              <td>${cp.deskripsi}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const blob = new Blob(['\ufeff', header + tableHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CP_${filterMapel}_${filterFase}.doc`;
    link.click();
  };

  const handleAddOrUpdate = async () => {
    if (!formData.kode || !formData.elemen || !formData.deskripsi) return;

    try {
      if (isEditing) {
        const cpRef = doc(db, "cps", isEditing);
        await updateDoc(cpRef, {
          ...formData,
          fase: filterFase,
          mataPelajaran: filterMapel
        });
        setIsEditing(null);
      } else {
        await addDoc(collection(db, "cps"), {
          fase: filterFase,
          mataPelajaran: filterMapel,
          kode: formData.kode,
          elemen: formData.elemen,
          deskripsi: formData.deskripsi
        });
      }
      setFormData({ ...formData, kode: '', elemen: '', deskripsi: '' });
    } catch (error) {
      console.error("Error saving to Firestore:", error);
    }
  };

  const startEdit = (cp: CapaianPembelajaran) => {
    setIsEditing(cp.id);
    setFormData(cp);
  };

  const deleteCp = async () => {
    if (!deleteConfirm) return;
    try {
      const cpRef = doc(db, "cps", deleteConfirm);
      await deleteDoc(cpRef);
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting from Firestore:", error);
    }
  };

  const filteredCps = cps.filter(cp => cp.fase === filterFase && cp.mataPelajaran === filterMapel);
  const availableMapel = user.role === 'admin' ? MATA_PELAJARAN : user.mapelDiampu;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak CP - ${settings.schoolName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', sans-serif; background: white; padding: 40px; }
              @media print { 
                .no-print { display: none !important; }
                body { padding: 0; }
              }
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

  if (isPrintMode) {
    return (
      <div className="bg-white p-12 min-h-screen text-slate-900 font-serif">
        <div className="no-print mb-8 space-y-4">
          <div className="flex justify-between bg-slate-100 p-4 rounded-xl border border-slate-200 font-sans">
            <div className="flex gap-2">
              <button onClick={() => setIsPrintMode(false)} className="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-black transition-all">
                <EyeOff size={14} /> KEMBALI
              </button>
              <button onClick={handleExportWord} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-blue-700">
                <FileDown size={14} /> UNDUH WORD
              </button>
            </div>
            <button onClick={handlePrint} className="bg-rose-600 text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg">
              <Printer size={14} /> CETAK PDF
            </button>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-[11px] font-bold text-amber-800 font-sans">
            <AlertCircle size={18} className="shrink-0" />
            <p>Jika dialog cetak tidak terbuka, pastikan pop-up di browser Anda tidak terblokir.</p>
          </div>
        </div>

        <div ref={printRef}>
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black uppercase border-b-4 border-black pb-2 inline-block tracking-tight text-slate-900">Capaian Pembelajaran (CP)</h1>
            <h2 className="text-xl font-bold mt-3 uppercase text-slate-800">{settings.schoolName}</h2>
            <div className="flex justify-center gap-10 mt-6 text-xs font-black uppercase tracking-widest text-slate-600 font-sans">
              <span>FASE: {filterFase}</span>
              <span>MATA PELAJARAN: {filterMapel}</span>
            </div>
          </div>

          <table className="w-full border-collapse border-2 border-black text-xs">
            <thead>
              <tr className="bg-slate-100 h-12">
                <th className="border-2 border-black px-4 py-2 w-12 text-center uppercase">NO</th>
                <th className="border-2 border-black px-4 py-2 w-24 text-center uppercase">KODE</th>
                <th className="border-2 border-black px-4 py-2 w-48 text-left uppercase">ELEMEN</th>
                <th className="border-2 border-black px-4 py-2 text-left uppercase">DESKRIPSI CAPAIAN PEMBELAJARAN</th>
              </tr>
            </thead>
            <tbody>
              {filteredCps.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border-2 border-black px-4 py-10 text-center italic text-slate-400">Tidak ada data untuk filter yang dipilih.</td>
                </tr>
              ) : (
                filteredCps.map((cp, idx) => (
                  <tr key={cp.id}>
                    <td className="border-2 border-black px-4 py-3 text-center font-bold">{idx + 1}</td>
                    <td className="border-2 border-black px-4 py-3 text-center font-black">{cp.kode}</td>
                    <td className="border-2 border-black px-4 py-3 font-bold uppercase">{cp.elemen}</td>
                    <td className="border-2 border-black px-4 py-3 leading-relaxed text-justify">{cp.deskripsi}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-16 flex justify-between items-start text-xs px-12 font-sans uppercase font-black tracking-tight break-inside-avoid">
             <div className="text-center w-72">
                <p>Mengetahui,</p> <p>Kepala Sekolah</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[200px]">{settings.principalName}</p> <p className="no-underline mt-1 font-normal">NIP. {settings.principalNip}</p>
             </div>
             <div className="text-center w-72">
                <p>Bilato, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p> <p>Guru Mata Pelajaran</p> <div className="h-24"></div> <p className="border-b border-black inline-block min-w-[200px]">{user?.name || '[Nama Guru]'}</p> <p className="no-underline mt-1 font-normal">NIP. {user?.nip || '...................'}</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Hapus CP</h3>
              <p className="text-slate-500 font-medium text-sm">Data ini akan dihapus permanen dari cloud. Lanjutkan?</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-slate-500 bg-white border border-slate-200">BATAL</button>
              <button onClick={deleteCp} className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-white bg-red-600">HAPUS</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Database Capaian Pembelajaran</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase">
              <Cloud size={12}/> Terhubung ke Cloud
            </div>
          </div>
          <button 
            onClick={() => setIsPrintMode(true)}
            className="w-full md:w-auto bg-slate-800 hover:bg-black text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            <Eye size={18} /> PRATINJAU CETAK
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-1">Pilih Fase {isClassLocked && <Lock size={10} className="text-amber-500" />}</label>
            <select 
              disabled={isClassLocked}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400" 
              value={filterFase} 
              onChange={(e) => setFilterFase(e.target.value as Fase)}
            >
              {Object.values(Fase).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Mata Pelajaran</label>
            <select className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500" value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>
              {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Editor Data CP</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest h-12">
                <th className="px-6 py-2 w-24">Kode</th>
                <th className="px-6 py-2 w-48">Elemen</th>
                <th className="px-6 py-2">Deskripsi CP</th>
                <th className="px-6 py-2 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin inline-block text-blue-600" size={32} />
                    <p className="mt-2 text-xs font-bold text-slate-400">Mengunduh data dari cloud...</p>
                  </td>
                </tr>
              ) : filteredCps.length === 0 && !isEditing ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic font-bold">Belum ada data di fase dan mapel ini.</td>
                </tr>
              ) : (
                filteredCps.map(cp => (
                  <tr key={cp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-900 text-sm">{cp.kode}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">{cp.elemen}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 leading-relaxed italic">{cp.deskripsi}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => startEdit(cp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setDeleteConfirm(cp.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {user.role === 'admin' && (
                <tr className="bg-blue-50/30">
                  <td className="px-6 py-4">
                    <input type="text" placeholder="Kode" className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={formData.kode || ''} onChange={e => setFormData({...formData, kode: e.target.value})} />
                  </td>
                  <td className="px-6 py-4">
                    <input type="text" placeholder="Elemen" className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={formData.elemen || ''} onChange={e => setFormData({...formData, elemen: e.target.value})} />
                  </td>
                  <td className="px-6 py-4">
                    <textarea placeholder="Deskripsi Capaian Pembelajaran..." className="w-full border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none min-h-[60px]" value={formData.deskripsi || ''} onChange={e => setFormData({...formData, deskripsi: e.target.value})} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-center">
                      <button onClick={handleAddOrUpdate} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 flex items-center gap-1 text-[10px] font-black uppercase">
                        <Save size={14} /> {isEditing ? 'Update' : 'Tambah'}
                      </button>
                      {isEditing && (
                        <button onClick={() => { setIsEditing(null); setFormData({kode:'',elemen:'',deskripsi:''}); }} className="bg-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-300 transition-all">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CPManager;
