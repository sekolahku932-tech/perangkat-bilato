
import React, { useState, useRef } from 'react';
import { UploadedFile, ChatMessage, User } from '../types';
import { 
  FileUp, Trash2, Send, Bot, User as UserIcon, Loader2, 
  FileText, Image as ImageIcon, Sparkles, MessageSquare, 
  X, CheckCircle2, AlertCircle, Cloud, Key
} from 'lucide-react';
import { analyzeDocuments } from '../services/geminiService';

interface DocumentManagerProps {
  user: User;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ user }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newFile: UploadedFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: file.size,
          type: file.type,
          base64: base64,
        };
        setFiles((prev) => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isAnalyzing) return;
    
    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsAnalyzing(true);

    try {
      // Injeksi API Key User
      const response = await analyzeDocuments(files, currentInput, user.apiKey);
      const aiMsg: ChatMessage = { role: 'model', content: response, timestamp: new Date() };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error(error);
      let errMsg = "Maaf, terjadi kesalahan saat menganalisis.";
      if (error.message === 'QUOTA_EXCEEDED') errMsg = "Kuota AI Anda saat ini sudah habis.";
      if (error.message === 'INVALID_API_KEY') errMsg = "API Key Anda tidak valid. Hubungi Admin.";
      
      const errorMsg: ChatMessage = { role: 'model', content: errMsg, timestamp: new Date() };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><FileUp size={20}/></div>
             <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Unggah Bahan</h3>
          </div>
          
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
               <ImageIcon size={24} className="text-slate-400 group-hover:text-indigo-500"/>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Klik untuk Memilih</p>
            <p className="text-[8px] text-slate-400 mt-2">PDF, JPG, PNG (Max 5MB)</p>
            <input type="file" className="hidden" multiple ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" />
          </div>
          
          <div className="mt-8 space-y-3">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">File Terpilih ({files.length})</h4>
            {files.length === 0 ? (
              <div className="py-10 text-center opacity-30">
                 <FileText size={32} className="mx-auto mb-2"/>
                 <p className="text-[10px] italic">Belum ada file</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                {files.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group">
                    <div className="flex items-center gap-3 overflow-hidden">
                       <div className="p-2 bg-white rounded-lg text-indigo-500 shadow-sm">
                          {file.type.includes('image') ? <ImageIcon size={14}/> : <FileText size={14}/>}
                       </div>
                       <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-slate-700 truncate">{file.name}</p>
                          <p className="text-[8px] text-slate-400 uppercase font-black">{formatSize(file.size)}</p>
                       </div>
                    </div>
                    <button onClick={() => removeFile(file.id)} className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors"><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
           <Cloud className="absolute -bottom-4 -right-4 opacity-20" size={80}/>
           <div className="relative z-10">
              <h4 className="text-xs font-black uppercase mb-3 flex items-center gap-2"><Sparkles size={14}/> Info API</h4>
              <p className="text-[10px] leading-relaxed font-medium opacity-90">
                {user.apiKey ? "Analisis ini menggunakan API Key Kustom Anda." : "Analisis ini menggunakan API Key Utama Sekolah."}
              </p>
              <div className="mt-4 p-2 bg-white/10 rounded-xl border border-white/10 text-[8px] font-black uppercase tracking-tighter flex items-center gap-2">
                 <Key size={10}/> Security Mode: ON
              </div>
           </div>
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col h-[75vh] bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500 rounded-xl shadow-lg"><MessageSquare size={18}/></div>
              <div>
                 <h3 className="font-black text-xs uppercase tracking-widest leading-none">Diskusi Dokumen AI</h3>
                 <p className="text-[8px] text-indigo-300 font-bold uppercase mt-1 tracking-tighter">User: {user.name}</p>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50 no-scrollbar">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <div className="p-6 bg-white rounded-[40px] shadow-sm mb-6"><Bot size={64} className="text-slate-400"/></div>
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">Mulai Analisis</p>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                   <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'}`}>
                      {msg.role === 'user' ? <UserIcon size={20}/> : <Bot size={20}/>}
                   </div>
                   <div className={`p-5 rounded-[2.5rem] text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-white text-slate-800 border border-slate-100 rounded-tr-none' : 'bg-indigo-600 text-white rounded-tl-none'}`}>
                     <div className="whitespace-pre-wrap">{msg.content}</div>
                   </div>
                </div>
              </div>
            ))
          )}
          {isAnalyzing && (
            <div className="flex justify-start animate-pulse">
               <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-500 flex items-center justify-center"><Loader2 size={20} className="animate-spin"/></div>
                  <div className="bg-white border border-slate-200 p-5 rounded-[2.5rem] rounded-tl-none">
                     <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                     </div>
                  </div>
               </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-100">
          <div className="relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={files.length === 0 ? "Unggah file dulu..." : "Tanya AI..."} disabled={files.length === 0 || isAnalyzing} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl py-4 pl-6 pr-16 text-sm font-bold outline-none" />
            <button onClick={handleSendMessage} disabled={!input.trim() || isAnalyzing || files.length === 0} className="absolute right-2 p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"><Send size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
