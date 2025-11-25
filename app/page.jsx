"use client";
import { useState, useEffect, useMemo } from 'react';
import { Wallet, PieChart, Trash2, PlusCircle, RefreshCw, Moon, Sun, Zap, TrendingUp, Calendar } from 'lucide-react';

export default function Home() {
  // --- ESTADO Y CONFIGURACIÓN ---
  const [darkMode, setDarkMode] = useState(true); // Por defecto oscuro
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Comida');
  const [quincena, setQuincena] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [allExpenses, setAllExpenses] = useState([]);

  const PRESPUESTO_LIMITE = 1600000; 
  const API_URL = process.env.NEXT_PUBLIC_SHEET_API;
  
  const CATEGORIES = ['Comida', 'Transporte', 'Servicios', 'Ocio', 'Arriendo', 'Varios', 'Deuda'];

  // Gastos por Defecto (Puedes editarlos aquí)
  const GASTOS_FIJOS = [
    { desc: 'Arriendo', cat: 'Arriendo', amount: 450000 },
    { desc: 'Comida Mensual', cat: 'Comida', amount: 240000 },
    { desc: 'Servicios', cat: 'Servicios', amount: 55000 },
    { desc: 'Internet', cat: 'Servicios', amount: 27500 },
    { desc: 'Pasajes', cat: 'Transporte', amount: 70000 }
  ];

  // --- 1. GENERAR FECHAS ---
  const quincenaOptions = useMemo(() => {
    const options = [];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentYear = new Date().getFullYear();
    [currentYear, currentYear + 1].forEach(year => {
      months.forEach(month => {
        options.push(`${month} ${year} - Q1`);
        options.push(`${month} ${year} - Q2`);
      });
    });
    return options;
  }, []);

  // --- 2. CARGA DE DATOS ---
  const fetchExpenses = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setAllExpenses(data.reverse());
    } catch (error) {
      console.error("Error cargando:", error);
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    // Auto-detectar quincena
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString('es-CO', { month: 'long' });
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    const currentQ = `${capitalizedMonth} ${today.getFullYear()} - Q${day <= 15 ? '1' : '2'}`;
    setQuincena(currentQ);

    if (API_URL) fetchExpenses();
  }, [API_URL]);

  // --- 3. LÓGICA DE DATOS Y CÁLCULOS ---
  
  // Filtrar gastos de la quincena actual
  const currentExpenses = allExpenses.filter(item => item.quincena === quincena);
  const totalSpent = currentExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  // Agrupar por Categoría
  const categoryStats = currentExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    return acc;
  }, {});
  
  // Desglose Semanal (Semana 1 vs Semana 2)
  const isQ1 = quincena.includes("Q1");
  // Si es Q1, el corte es el día 8. Si es Q2, el corte es el día 23.
  const splitDay = isQ1 ? 8 : 23; 
  
  const week1Expenses = currentExpenses.filter(item => {
    const d = new Date(item.date).getDate();
    return isQ1 ? d <= splitDay : d <= splitDay;
  });
  const week2Expenses = currentExpenses.filter(item => {
    const d = new Date(item.date).getDate();
    return isQ1 ? d > splitDay : d > splitDay;
  });

  const w1Total = week1Expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const w2Total = week2Expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

  // --- 4. ACCIONES ---

  // Guardar un solo gasto
  const saveExpenseToCloud = async (newExpense) => {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(newExpense)
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
    
    // Optimistic UI
    setAllExpenses([newExpense, ...allExpenses]);
    setAmount('');
    setDescription('');
    
    try {
      await saveExpenseToCloud(newExpense);
    } catch (e) { alert("Error guardando"); }
    setLoading(false);
  };

  // Cargar Gastos Por Defecto (Loop)
  const handleLoadDefaults = async () => {
    if(!confirm(`¿Cargar ${GASTOS_FIJOS.length} gastos fijos a ${quincena}?`)) return;
    setLoading(true);
    
    const newItems = [];
    
    // Creamos los objetos y los mandamos uno por uno
    for (const gasto of GASTOS_FIJOS) {
      const item = {
        id: Date.now().toString() + Math.random(), // ID único
        amount: gasto.amount,
        description: gasto.desc,
        category: gasto.cat,
        quincena: quincena,
        date: new Date().toISOString(),
        action: 'add'
      };
      newItems.push(item);
      // Enviamos a la nube (sin await para que sea rápido en UI, pero la nube procesará)
      saveExpenseToCloud(item); 
    }

    setAllExpenses([...newItems, ...allExpenses]);
    setLoading(false);
    alert("Gastos fijos cargados!");
  };

  const handleDelete = async (idToDelete) => {
    if(!confirm("¿Borrar?")) return;
    const backup = [...allExpenses];
    setAllExpenses(allExpenses.filter(item => item.id !== idToDelete));
    try {
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete', id: idToDelete })
      });
    } catch (error) { setAllExpenses(backup); }
  };

  // --- 5. UI PRINCIPAL ---
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

          <select 
            value={quincena} 
            onChange={(e) => setQuincena(e.target.value)}
            className="w-full bg-black/20 text-sm py-2 px-4 rounded-xl border border-white/10 outline-none mb-4 appearance-none text-center font-bold backdrop-blur-sm"
          >
            {quincenaOptions.map(opt => <option key={opt} value={opt} className="text-black">{opt}</option>)}
          </select>

          <div className="text-center">
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Total Gastado</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">${totalSpent.toLocaleString()}</p>
          </div>

          <div className="mt-4 w-full bg-black/30 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${totalSpent > PRESPUESTO_LIMITE ? 'bg-red-500' : 'bg-green-400'}`}
              style={{ width: `${Math.min((totalSpent / PRESPUESTO_LIMITE) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className={`flex-1 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          
          {/* FORMULARIO */}
          <div className={`p-5 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} rounded-b-3xl shadow-sm mb-4 border-b`}>
            <div className="flex gap-2 mb-3">
              <input 
                type="number" 
                placeholder="$0" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`w-1/3 p-3 rounded-xl font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
              />
              <input 
                type="text" 
                placeholder="Descripción..." 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={`w-2/3 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    category === cat 
                      ? (darkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') 
                      : (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleLoadDefaults}
                disabled={loading}
                className={`w-12 flex items-center justify-center rounded-xl transition-all ${darkMode ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600'}`}
              >
                <Zap size={20} fill="currentColor" />
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-500/30"
              >
                {loading ? '...' : <><PlusCircle size={18} /> Agregar</>}
              </button>
            </div>
          </div>

          <div className="px-4 space-y-4 pb-20">
            
            {/* 1. DESGLOSE SEMANAL */}
            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-blue-50'}`}>
              <h3 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${darkMode ? 'text-gray-400' : 'text-blue-500'}`}>
                <Calendar size={14} /> Desglose Semanal
              </h3>
              <div className="space-y-3">
                {/* Semana 1 */}
                <div className="flex justify-between items-center text-sm">
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                    Semana 1 <span className="text-xs opacity-50">({isQ1 ? '1-8' : '16-23'})</span>
                  </span>
                  <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${w1Total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200/20 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-400 h-full" style={{ width: `${totalSpent ? (w1Total/totalSpent)*100 : 0}%` }}></div>
                </div>

                {/* Semana 2 */}
                <div className="flex justify-between items-center text-sm">
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                    Semana 2 <span className="text-xs opacity-50">({isQ1 ? '9-15' : '24-30'})</span>
                  </span>
                  <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${w2Total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200/20 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-400 h-full" style={{ width: `${totalSpent ? (w2Total/totalSpent)*100 : 0}%` }}></div>
                </div>
                
                {/* Alerta de gasto mayor */}
                {totalSpent > 0 && (
                  <div className={`text-xs mt-2 flex items-center gap-1 ${w1Total > w2Total ? 'text-blue-400' : 'text-purple-400'}`}>
                    <TrendingUp size={12} />
                    {Math.abs(w1Total - w2Total) === 0 ? "Gasto igualado" : `Semana ${w1Total > w2Total ? '1' : '2'} con más gasto`}
                  </div>
                )}
              </div>
            </div>

            {/* 2. RESUMEN POR CATEGORÍA (BARRAS) */}
            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <h3 className={`text-xs font-bold uppercase mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <PieChart size={14} /> Por Categoría
              </h3>
              <div className="space-y-4">
                {Object.entries(categoryStats).sort(([,a], [,b]) => b - a).map(([cat, val]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{cat}</span>
                      <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${val.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200/10 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-full rounded-full" 
                        style={{ width: `${(val / totalSpent) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-right">{((val/totalSpent)*100).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. HISTORIAL */}
            <div className="space-y-2">
              <h3 className={`text-xs font-bold uppercase mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Historial</h3>
              {currentExpenses.map((item) => (
                <div key={item.id} className={`group flex justify-between items-center p-3 rounded-xl border transition-colors ${darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-8 rounded-full ${item.category === 'Comida' ? 'bg-orange-400' : item.category === 'Transporte' ? 'bg-blue-400' : 'bg-gray-400'}`}></div>
                    <div>
                      <p className={`font-bold text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{item.description}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">
                        {item.category}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>${Number(item.amount).toLocaleString()}</span>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-500 hover:text-red-500 p-2 opacity-50 hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
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