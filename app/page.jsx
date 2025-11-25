"use client";
import { useState, useEffect, useMemo } from 'react';
import { Wallet, PieChart, Trash2, PlusCircle, RefreshCw, Moon, Sun, Zap, Calendar, CheckSquare, Square, CloudLightning } from 'lucide-react';

export default function Home() {
  // --- ESTADO ---
  const [darkMode, setDarkMode] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Comida');
  const [quincena, setQuincena] = useState('');
  
  // Selección Múltiple
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [allExpenses, setAllExpenses] = useState([]);

  const PRESPUESTO_LIMITE = 1600000; 
  const API_URL = process.env.NEXT_PUBLIC_SHEET_API;
  const CATEGORIES = ['Comida', 'Transporte', 'Servicios', 'Ocio', 'Arriendo', 'Varios', 'Deuda', 'Fijo'];

  // --- 1. LÓGICA DE FECHAS ---
  const getMonthName = (date) => date.toLocaleString('es-CO', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());

  const quincenaOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    let startYear = today.getFullYear(); 
    [startYear, startYear + 1].forEach(year => {
      ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].forEach(month => {
        options.push(`${month} ${year} - Q1 (Día 15)`);
        options.push(`${month} ${year} - Q2 (Día 30)`);
      });
    });
    options.unshift(`Diciembre ${startYear - 1} - Q2 (Día 30)`);
    return options;
  }, []);

  // --- 2. CARGA INICIAL ---
  useEffect(() => {
    if (API_URL) fetchExpenses();
    
    // Auto-detectar fecha
    const today = new Date();
    const day = today.getDate();
    let detectedQ = "";
    
    // Si estamos a fin de mes (30+), es Q2. Si es 15+, es Q1. Si es <15, es Q2 del mes anterior.
    if (day >= 30) {
      detectedQ = `${getMonthName(today)} ${today.getFullYear()} - Q2 (Día 30)`;
    } else if (day >= 15) {
      detectedQ = `${getMonthName(today)} ${today.getFullYear()} - Q1 (Día 15)`;
    } else {
      const prevDate = new Date(today);
      prevDate.setMonth(today.getMonth() - 1);
      detectedQ = `${getMonthName(prevDate)} ${prevDate.getFullYear()} - Q2 (Día 30)`;
    }
    setQuincena(detectedQ);
  }, [API_URL]);

  const fetchExpenses = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setAllExpenses(data.reverse());
    } catch (error) { console.error(error); }
    setIsSyncing(false);
  };

  // --- 3. CÁLCULOS ---
  const currentExpenses = allExpenses.filter(item => item.quincena === quincena);
  const totalSpent = currentExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const categoryStats = currentExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    return acc;
  }, {});

  const isQ1 = quincena.includes("Q1");
  const week1Expenses = currentExpenses.filter(item => {
    const d = new Date(item.date).getDate();
    return isQ1 ? (d >= 15 && d <= 22) : (d >= 30 || d <= 7);
  });
  const week2Expenses = currentExpenses.filter(item => {
    const d = new Date(item.date).getDate();
    return isQ1 ? (d > 22) : (d > 7 && d < 15);
  });
  const w1Total = week1Expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const w2Total = week2Expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

  // --- 4. ACCIONES ---
  
  // Función genérica para enviar datos
  const postToCloud = async (payload) => {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  };

  const handleSave = async () => {
    if (!amount) return;
    setLoading(true);
    const newExpense = {
      id: Date.now().toString(),
      amount: Number(amount),
      description: description || 'Gasto Rápido',
      category: category,
      quincena: quincena,
      date: new Date().toISOString(),
      action: 'add'
    };
    
    setAllExpenses([newExpense, ...allExpenses]);
    setAmount(''); setDescription('');
    
    try { await postToCloud(newExpense); } catch (e) {}
    setLoading(false);
  };

  // --- NUEVA LÓGICA DEL RAYO ⚡ (IMPORTAR DESDE TABLA VISUAL) ---
  const handleImportFromSheet = async () => {
    // Parseamos la quincena actual (Ej: "Noviembre 2025 - Q1 (Día 15)")
    const parts = quincena.split(' '); // ["Noviembre", "2025", "-", "Q1", ...]
    const month = parts[0];
    const year = parts[1];
    const qLabel = parts.find(p => p.startsWith("Q")); // "Q1" o "Q2"

    if(!confirm(`¿Importar gastos de ${month} ${qLabel} desde la hoja maestra?`)) return;
    
    setLoading(true);
    
    try {
      // 1. Enviamos orden al Script
      // Nota: No podemos hacer update optimista instantáneo porque no sabemos qué hay en el Excel
      // así que mostramos "Cargando..."
      
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'importar_fijos',
          month: month,     // Noviembre
          year: year,       // 2025
          quincena: qLabel, // Q1
          fullQuincenaName: quincena
        })
      });

      // 2. Esperamos un poco y recargamos todo para ver los nuevos datos
      setTimeout(() => {
        fetchExpenses();
        setLoading(false);
        alert("¡Gastos importados desde tu tabla!");
      }, 2500);

    } catch (e) {
      alert("Error conectando con la hoja");
      setLoading(false);
    }
  };

  // Borrar
  const handleDeleteOne = async (id) => {
    const backup = [...allExpenses];
    setAllExpenses(allExpenses.filter(i => i.id !== id));
    try { await postToCloud({ action: 'delete', id: id }); } catch (e) { setAllExpenses(backup); }
  };

  const handleBulkDelete = async () => {
    const backup = [...allExpenses];
    setAllExpenses(allExpenses.filter(i => !selectedIds.includes(i.id)));
    const idsToDelete = [...selectedIds];
    setIsSelectMode(false); setSelectedIds([]);
    try {
      for (const id of idsToDelete) await postToCloud({ action: 'delete', id: id });
    } catch (e) { setAllExpenses(backup); }
  };

  const toggleSelection = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  // --- UI ---
  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} flex justify-center py-4 px-2`}>
      <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]`}>
        
        {/* HEADER */}
        <div className={`${darkMode ? 'bg-slate-950' : 'bg-blue-600'} text-white p-6 pb-8 transition-colors duration-300`}>
          <div className="flex justify-between items-center mb-4">
            <h1 className="font-bold flex items-center gap-2 text-lg">
              <Wallet size={20} className="text-yellow-400" /> BudgetApp
            </h1>
            <div className="flex gap-2">
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button onClick={fetchExpenses} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
                <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <select value={quincena} onChange={(e) => setQuincena(e.target.value)}
            className="w-full bg-black/20 text-sm py-2 px-4 rounded-xl border border-white/10 outline-none mb-4 appearance-none text-center font-bold backdrop-blur-sm">
            {quincenaOptions.map(opt => <option key={opt} value={opt} className="text-black">{opt}</option>)}
          </select>

          <div className="text-center">
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Total Gastado</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">${totalSpent.toLocaleString()}</p>
          </div>
          <div className="mt-4 w-full bg-black/30 rounded-full h-2 overflow-hidden">
            <div className={`h-full transition-all duration-500 ${totalSpent > PRESPUESTO_LIMITE ? 'bg-red-500' : 'bg-green-400'}`} style={{ width: `${Math.min((totalSpent / PRESPUESTO_LIMITE) * 100, 100)}%` }}></div>
          </div>
        </div>

        {/* CONTENIDO */}
        <div className={`flex-1 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {!isSelectMode && (
            <div className={`p-5 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} rounded-b-3xl shadow-sm mb-4 border-b`}>
              <div className="flex gap-2 mb-3">
                <input type="number" placeholder="$0" value={amount} onChange={e => setAmount(e.target.value)}
                  className={`w-1/3 p-3 rounded-xl font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`} />
                <input type="text" placeholder="Descripción..." value={description} onChange={e => setDescription(e.target.value)}
                  className={`w-2/3 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`} />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${category === cat ? (darkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {/* BOTÓN DE IMPORTAR INTELIGENTE */}
                <button onClick={handleImportFromSheet} disabled={loading}
                  className={`w-12 flex items-center justify-center rounded-xl transition-all shadow-lg ${darkMode ? 'bg-yellow-600 text-white shadow-yellow-900/20' : 'bg-yellow-400 text-yellow-900 shadow-yellow-200'}`}>
                  {loading ? <RefreshCw size={20} className="animate-spin" /> : <CloudLightning size={20} fill="currentColor" />}
                </button>
                <button onClick={handleSave} disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-500/30">
                  <PlusCircle size={18} /> Agregar
                </button>
              </div>
            </div>
          )}

          {isSelectMode && (
            <div className={`sticky top-0 z-10 p-4 shadow-md flex justify-between items-center ${darkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
              <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedIds.length} seleccionados</span>
              <div className="flex gap-2">
                <button onClick={() => { setIsSelectMode(false); setSelectedIds([]); }}
                  className={`px-4 py-2 rounded-lg font-bold text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>Cancelar</button>
                {selectedIds.length > 0 && (
                  <button onClick={handleBulkDelete}
                    className="px-4 py-2 rounded-lg font-bold text-sm bg-red-500 text-white shadow-lg shadow-red-500/30 active:scale-95 transition-transform">Borrar</button>
                )}
              </div>
            </div>
          )}

          <div className="px-4 space-y-4 pb-20 mt-4">
            {!isSelectMode && (
              <>
                 <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-blue-50'}`}>
                  <h3 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-400' : 'text-blue-500'}`}>
                    <Calendar size={14} /> Ciclo {isQ1 ? '15-30' : '30-14'}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Primera Mitad</span>
                      <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${w1Total.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200/20 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-400 h-full" style={{ width: `${totalSpent ? (w1Total/totalSpent)*100 : 0}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Segunda Mitad</span>
                      <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${w2Total.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200/20 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-400 h-full" style={{ width: `${totalSpent ? (w2Total/totalSpent)*100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  <h3 className={`text-xs font-bold uppercase mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <PieChart size={14} /> Categorías
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(categoryStats).sort(([,a], [,b]) => b - a).map(([cat, val]) => (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{cat}</span>
                          <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${val.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-200/10 rounded-full h-1.5">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(val / totalSpent) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className={`text-xs font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Historial</h3>
                {!isSelectMode && currentExpenses.length > 0 && (
                  <button onClick={() => setIsSelectMode(true)}
                    className={`text-xs font-bold px-3 py-1 rounded-full ${darkMode ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>Seleccionar</button>
                )}
              </div>
              {currentExpenses.length === 0 && <p className="text-center text-gray-500 text-sm py-4">Sin gastos</p>}
              {currentExpenses.map((item) => (
                <div key={item.id} onClick={() => isSelectMode && toggleSelection(item.id)}
                  className={`group flex justify-between items-center p-3 rounded-xl border transition-colors cursor-pointer ${isSelectMode ? (selectedIds.includes(item.id) ? (darkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-500') : (darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100')) : (darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100')}`}>
                  <div className="flex items-center gap-3">
                    {isSelectMode ? (selectedIds.includes(item.id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-gray-500" />) : (<div className={`w-1.5 h-8 rounded-full ${item.category === 'Comida' ? 'bg-orange-400' : item.category === 'Fijo' ? 'bg-yellow-400' : 'bg-blue-400'}`}></div>)}
                    <div>
                      <p className={`font-bold text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{item.description}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">{item.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${Number(item.amount).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}