import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Trash2 } from 'lucide-react';

const URL = "https://script.google.com/macros/s/AKfycbx6gJ_4a1Dq9c9nzF2a8pOoqANdYyg2a8jYZdB1_O3BwslsRP4AmGjdBgwsfNxpYTkHtg/exec";

const formatDate = (dateStr: any) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'number') {
    const d = new Date((dateStr - 25569) * 86400 * 1000);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('pt-BR');
  }
  if (typeof dateStr === 'string') {
    if (dateStr.includes('T')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (dateStr.includes('/')) {
      return dateStr;
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('pt-BR');
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('home');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Data
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [activeCar, setActiveCar] = useState("Hyundai I-30");
  const [metaVal, setMetaVal] = useState(() => parseFloat(localStorage.getItem('smartfuel_meta') || '8.0'));
  const [tankCap, setTankCap] = useState(() => parseFloat(localStorage.getItem('smartfuel_tank') || '53'));

  // Last log values
  const [lastOdoVal, setLastOdoVal] = useState(0);
  const [lastLitros, setLastLitros] = useState(0);
  const [lastTankType, setLastTankType] = useState("Full Tank - refresh");
  const [lastKmL, setLastKmL] = useState(8.0);
  const [prevKmL, setPrevKmL] = useState(8.0);
  const [oilTarget, setOilTarget] = useState(0);

  // Current inputs
  const [currentOdo, setCurrentOdo] = useState(0);

  // Modal inputs
  const [modalDate, setModalDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalOdo, setModalOdo] = useState('');
  const [modalOil, setModalOil] = useState('');
  const [modalLit, setModalLit] = useState('');
  const [modalSt, setModalSt] = useState('');
  const [modalTank, setModalTank] = useState('Full Tank - refresh');
  const [modalTot, setModalTot] = useState('');

  // Settings inputs
  const [settingsTank, setSettingsTank] = useState('');
  const [settingsMeta, setSettingsMeta] = useState('');
  const [settingsFuel, setSettingsFuel] = useState('Gasolina');
  const [newCarName, setNewCarName] = useState('');
  const [logToDelete, setLogToDelete] = useState<any>(null);

  const sync = async (carOverride?: string) => {
    try {
      setFetchError(null);
      // Add a timestamp to the URL to prevent browser caching
      const noCacheUrl = `${URL}?t=${new Date().getTime()}`;
      const r = await fetch(noCacheUrl);
      
      // Check if the response is HTML (which means an Apps Script error)
      const contentType = r.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        const text = await r.text();
        if (text.includes("Script function not found: doGet")) {
          throw new Error("Erro no Google Apps Script: A função 'doGet' não foi encontrada. Verifique o código no seu Google Script.");
        }
        throw new Error("Erro no Google Apps Script: Retornou HTML em vez de JSON.");
      }

      const d = await r.json();
      
      const deletedStr = localStorage.getItem('smartfuel_deleted_logs');
      const deletedArr = deletedStr ? JSON.parse(deletedStr) : [];

      // Filter out rows without a valid date and odometer reading, and filter out locally deleted logs
      const logs = (d.logs || d).filter((l: any) => 
        l[1] != null && l[1] !== "" && 
        l[3] != null && l[3] !== "" && 
        !deletedArr.includes(l[0])
      );
      setAllLogs(logs);

      let currentCar = carOverride || activeCar;
      const localCar = localStorage.getItem('smartfuel_active_car');
      const localMeta = localStorage.getItem('smartfuel_meta');
      const localTank = localStorage.getItem('smartfuel_tank');
      const localFuel = localStorage.getItem('smartfuel_fuel');
      
      if (carOverride) {
        currentCar = carOverride;
      } else if (localCar) {
        currentCar = localCar;
      } else if (d.config && d.config.active_car) {
        currentCar = d.config.active_car;
      }

      let currentMeta = localMeta ? parseFloat(localMeta) : (d.config ? parseFloat(d.config.meta) : 8.0);
      let currentTank = localTank ? parseFloat(localTank) : (d.config ? parseFloat(d.config.tank_capacity) : 53);
      let currentFuel = localFuel ? localFuel : 'Gasolina';

      setActiveCar(currentCar);
      setMetaVal(currentMeta);
      setTankCap(currentTank);
      setSettingsTank(currentTank.toString());
      setSettingsMeta(currentMeta.toString());
      setSettingsFuel(currentFuel);

      const carLogs = logs.filter((l: any) => l[2] === currentCar);
      // Fallback array matches the new column structure:
      // 0:ID, 1:Date, 2:CarType, 3:Odo, 4:Dist, 5:City/Road, 6:SpentFuel, 7:CurrentTank, 
      // 8:FuelSupplied, 9:GasStation, 10:Total, 11:UnitValue, 12:Consumption, 13:TankLevel, 
      // 14:Period, 15:Photo, 16:Oil
      const last = carLogs[carLogs.length - 1] || [0, new Date().toISOString(), currentCar, 0, 0, '', 0, 0, 0, 'Posto', 0, 0, currentMeta, 'Full Tank - refresh', 0, '', 0];
      const prev = carLogs[carLogs.length - 2] || last;

      const newLastOdo = parseFloat(last[3]) || 0;
      setLastOdoVal(newLastOdo);
      setCurrentOdo(newLastOdo);
      setLastLitros(parseFloat(last[8]) || 0);
      setLastTankType(last[13] || "Full Tank - refresh");
      setLastKmL(parseFloat(last[12]) || currentMeta);
      setPrevKmL(parseFloat(prev[12]) || currentMeta);
      setOilTarget(parseFloat(last[16]) || 0); // Atualizado para coluna Q (índice 16)

    } catch (e: any) {
      console.error(e);
      setFetchError(e.message || "Erro ao carregar os dados.");
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    sync();
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  // Derived calculations
  const trip = Math.max(0, currentOdo - lastOdoVal);
  
  // Define qual média de consumo usar com base no último abastecimento
  const displayKmL = lastTankType.includes("Full") ? lastKmL : prevKmL;

  // Calcula o gasto com base na distância percorrida e na média de consumo
  const spent = displayKmL > 0 ? (trip / displayKmL) : 0;
  
  const remaining = Math.max(0, tankCap - spent);
  const showOilAlert = oilTarget > 0 && currentOdo >= (oilTarget - 100);

  const consOffset = 188.5 - (188.5 * Math.min(displayKmL / 20, 1));
  const tankOffset = 188.5 - (188.5 * (remaining / tankCap));
  const spentOffset = 188.5 - (188.5 * (spent / tankCap));

  const modalPrice = (parseFloat(modalTot) && parseFloat(modalLit))
    ? (parseFloat(modalTot) / parseFloat(modalLit)).toFixed(2)
    : '0.00';

  const carLogs = useMemo(() => allLogs.filter(l => l[2] === activeCar), [allLogs, activeCar]);
  const chartData = useMemo(() => {
    return carLogs.slice(-8).map(l => {
      let dateLabel = '';
      if (typeof l[1] === 'string' && l[1].includes('T')) {
        const parts = l[1].split('T')[0].split('-');
        if (parts.length === 3) dateLabel = `${parts[2]}/${parts[1]}`;
      } else {
        dateLabel = String(l[1]).substring(0, 5);
      }
      return {
        date: dateLabel,
        kmL: parseFloat(String(l[12]).replace(',', '.')) || 0
      };
    });
  }, [carLogs]);

  // Unique cars for select
  const availableCars = useMemo(() => {
    const cars = new Set(allLogs.map(l => l[2]));
    cars.add(activeCar);
    return Array.from(cars);
  }, [allLogs, activeCar]);

  const saveData = async () => {
    const p = {
      carType: activeCar,
      odo: modalOdo,
      dist: modalOil,
      liters: modalLit,
      total: modalTot,
      station: modalSt,
      tankLevel: modalTank,
      date: modalDate
    };
    setIsModalOpen(false);
    setBooting(true);
    try {
      await fetch(URL, { method: 'POST', body: JSON.stringify(p) });
    } catch (e) {
      console.error(e);
    }
    sync();
  };

  const saveNewCar = () => {
    alert("Função de novo veículo sincronizada com planilha.");
    sync();
  };

  const confirmDelete = async (id: any) => {
    setLogToDelete(null);
    
    const deletedStr = localStorage.getItem('smartfuel_deleted_logs');
    const deletedArr = deletedStr ? JSON.parse(deletedStr) : [];
    if (!deletedArr.includes(id)) {
      deletedArr.push(id);
      localStorage.setItem('smartfuel_deleted_logs', JSON.stringify(deletedArr));
    }
    
    setAllLogs(prev => prev.filter(l => l[0] !== id));
  };

  return (
    <div className="flex justify-center p-4 h-screen overflow-y-auto w-full pb-32">
      {booting && (
        <div className="fixed inset-0 bg-black z-[9000] flex flex-col items-center justify-center text-center">
          <div className="digital-glow text-2xl animate-pulse uppercase">Smart Fuel V38</div>
          <p className="text-gray-600 mt-4 text-[10px] uppercase font-bold tracking-widest">Sincronizando Sistemas...</p>
        </div>
      )}

      {fetchError && (
        <div className="fixed top-4 left-4 right-4 bg-red-500/20 border border-red-500 p-4 rounded-xl z-[8000] text-red-500 text-sm font-bold text-center">
          {fetchError}
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col pt-2">
        <header className="mb-4 px-2">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase main-title">Smart Fuel</h1>
            <button 
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
              className="panel-sport px-5 py-2 text-[12px] font-black uppercase rounded-full main-title"
            >
              🌓 MODO
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-cyan-500 uppercase tracking-widest">{activeCar || '---'}</span>
            {showOilAlert && (
              <div className="alert-oil uppercase italic">⚠️ troca de óleo prevista</div>
            )}
          </div>
        </header>

        {/* DASHBOARD (HOME) */}
        <div className={`tab-content space-y-4 ${activeTab === 'home' ? 'active' : 'hidden'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="panel-sport p-4 text-center">
              <p className="text-[10px] font-black uppercase mb-3 opacity-60 text-cyan-500">Gasto (L)</p>
              <svg className="w-full h-20" viewBox="0 0 140 80">
                <path fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="12" d="M 20 70 A 50 50 0 1 1 120 70" />
                <path className="gauge-fill" strokeDashoffset={spentOffset} d="M 20 70 A 50 50 0 1 1 120 70" />
              </svg>
              <div className="mt-[-40px] font-black italic text-2xl">{spent.toFixed(2)}</div>
            </div>
            <div className="panel-sport p-4 text-center">
              <p className="text-[10px] font-black uppercase mb-3 opacity-60 text-cyan-500">Tanque (L)</p>
              <svg className="w-full h-20" viewBox="0 0 140 80">
                <path fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="12" d="M 20 70 A 50 50 0 1 1 120 70" />
                <path className="gauge-fill" strokeDashoffset={tankOffset} d="M 20 70 A 50 50 0 1 1 120 70" />
              </svg>
              <div className="mt-[-40px] font-black italic text-2xl">{remaining.toFixed(1)}</div>
            </div>
          </div>

          <div className="panel-sport p-4 text-center">
            <p className="text-[11px] font-black opacity-40 uppercase mb-1 main-title">Odômetro Atual (Simular)</p>
            <div className="odo-bezel mt-2">
              <div className="lcd-display py-2">
                <input 
                  type="number" 
                  inputMode="decimal"
                  className="odo-input" 
                  style={{ textShadow: theme === 'dark' ? '0 0 10px var(--neon), 0 0 20px var(--neon)' : 'none', letterSpacing: '2px' }}
                  value={currentOdo} 
                  onChange={(e) => setCurrentOdo(parseFloat(e.target.value) || 0)} 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="panel-sport p-4 text-center flex flex-col justify-center">
              <p className="text-[10px] font-black uppercase mb-1 opacity-60 text-cyan-400">Km Percorrido</p>
              <span className="text-4xl font-black italic tracking-tighter main-title">{trip.toFixed(0)}</span>
            </div>
            <div className="panel-sport p-4 text-center">
              <p className="text-[10px] font-black uppercase mb-3 opacity-60 text-cyan-500">Consumo (Km/L)</p>
              <svg className="w-full h-16" viewBox="0 0 140 80">
                <path fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="10" d="M 20 70 A 50 50 0 1 1 120 70" />
                <path className="gauge-fill" strokeDashoffset={consOffset} d="M 20 70 A 50 50 0 1 1 120 70" />
              </svg>
              <div className="mt-[-35px] font-black italic text-2xl">
                <span className={displayKmL < metaVal ? 'text-danger' : 'text-cyan-400'}>{displayKmL > 0 ? displayKmL.toFixed(2) : "--"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TABS AUXILIARES */}
        <div className={`tab-content ${activeTab === 'history' ? 'active' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black uppercase italic main-title">Histórico</h2>
            <button 
              onClick={() => {
                localStorage.removeItem('smartfuel_deleted_logs');
                setBooting(true);
                sync();
              }}
              className="panel-sport px-4 py-2 text-xs font-bold uppercase text-cyan-400 hover:bg-cyan-900/30 transition-colors"
            >
              Sincronizar Planilha
            </button>
          </div>
          <div className="space-y-3 pb-20">
            {carLogs.slice().reverse().map((l, i) => {
              const kmLNum = parseFloat(String(l[12]).replace(',', '.'));
              const isDanger = !isNaN(kmLNum) && kmLNum < metaVal;
              const kmLDisplay = !isNaN(kmLNum) ? kmLNum.toFixed(2).replace('.', ',') : String(l[12] || '---');

              return (
                <div key={i} className="panel-sport p-4 flex flex-col mb-3 border-none bg-zinc-900/10">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-lg font-black uppercase italic main-title">{l[9] || 'Posto'}</p>
                      <p className="text-sm opacity-60 main-title">{formatDate(l[1])}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <button onClick={() => setLogToDelete(l)} className="mb-1 text-[var(--text)] opacity-60 hover:opacity-100 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                      <p className="text-lg font-bold leading-none">
                        <span className={isDanger ? 'text-danger' : 'text-[var(--text)]'}>
                          {kmLDisplay}
                        </span>
                        <span className={isDanger ? 'text-danger' : 'text-[var(--text)]'}>
                          {' '}Km/L
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black opacity-60 uppercase main-title mt-2 border-t border-white/10 pt-2">
                    <span>{l[11] ? `R$ ${String(l[11]).replace('.', ',')}` : '---'}</span>
                    <span>{settingsFuel}</span>
                    <span>{l[3]} KM</span>
                    <span>{l[8]} L</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`tab-content w-full ${activeTab === 'charts' ? 'block' : 'hidden'}`}>
          <div className="panel-sport w-full p-2 h-80 flex flex-col justify-center shadow-2xl overflow-hidden box-border">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888' }} />
                <YAxis stroke="#888" tick={{ fill: '#888' }} />
                <Line type="monotone" dataKey="kmL" stroke="#1e40af" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#1e40af' }} style={{ filter: 'drop-shadow(0px 4px 5px rgba(0,0,0,0.5))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`tab-content pt-2 space-y-4 ${activeTab === 'settings' ? 'active' : 'hidden'}`}>
          <div className="panel-sport p-5 space-y-4">
            <h3 className="text-md font-black uppercase text-cyan-500 border-b border-white/5 pb-2 main-title">Configurações</h3>
            <label>Selecionar Carro</label>
            <select 
              className="big-input" 
              value={activeCar} 
              onChange={(e) => { 
                const newCar = e.target.value;
                setActiveCar(newCar); 
                localStorage.setItem('smartfuel_active_car', newCar);
                setBooting(true); 
                sync(newCar); 
              }}
            >
              {availableCars.map(car => <option key={car} value={car}>{car}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Tanque (L)</label>
                <input type="number" inputMode="decimal" className="big-input" value={settingsTank} onChange={e => {
                  setSettingsTank(e.target.value);
                  const val = parseFloat(e.target.value.replace(',', '.'));
                  if (!isNaN(val)) { setTankCap(val); localStorage.setItem('smartfuel_tank', val.toString()); }
                }} />
              </div>
              <div>
                <label>Meta Km/L</label>
                <input type="number" inputMode="decimal" className="big-input" value={settingsMeta} onChange={e => {
                  setSettingsMeta(e.target.value);
                  const val = parseFloat(e.target.value.replace(',', '.'));
                  if (!isNaN(val)) { setMetaVal(val); localStorage.setItem('smartfuel_meta', val.toString()); }
                }} />
              </div>
            </div>
            <div>
              <label>Combustível</label>
              <select 
                className="big-input" 
                value={settingsFuel} 
                onChange={e => {
                  setSettingsFuel(e.target.value);
                  localStorage.setItem('smartfuel_fuel', e.target.value);
                }}
              >
                <option value="Gasolina">Gasolina</option>
                <option value="Etanol">Etanol</option>
                <option value="GLP">GLP</option>
                <option value="Flex">Flex</option>
                <option value="Elétrico">Elétrico</option>
              </select>
            </div>
            <p className="text-sm text-center opacity-70 italic uppercase font-bold text-cyan-500 mt-2">Salvo automaticamente</p>
            
            <div className="pt-4 mt-4 border-t border-white/10">
              <label>Adicionar Novo Veículo</label>
              <input type="text" className="big-input mb-3" placeholder="Modelo" value={newCarName} onChange={e => setNewCarName(e.target.value)} />
              <button onClick={saveNewCar} className="w-full panel-sport p-4 rounded-2xl font-black uppercase text-cyan-500 main-title">Sincronizar Novo Veículo</button>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="nav-glass">
          <button onClick={() => setActiveTab('home')} className={`nav-btn ${activeTab === 'home' ? 'active-nav' : ''}`}>HOME</button>
          <button onClick={() => setActiveTab('history')} className={`nav-btn ${activeTab === 'history' ? 'active-nav' : ''}`}>HIST</button>
          <div 
            onClick={() => { 
              setIsModalOpen(true); 
              setModalOdo(currentOdo.toString()); 
            }} 
            className="bg-cyan-500 w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg nav-btn-plus cursor-pointer"
          >
            +
          </div>
          <button onClick={() => setActiveTab('charts')} className={`nav-btn ${activeTab === 'charts' ? 'active-nav' : ''}`}>CHRT</button>
          <button onClick={() => setActiveTab('settings')} className={`nav-btn ${activeTab === 'settings' ? 'active-nav' : ''}`}>SET</button>
        </nav>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div id="modal" className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md box-border">
          <div className="panel-sport w-full max-w-[90vw] sm:max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto box-border">
            <h3 className="text-2xl font-black uppercase italic text-cyan-400 text-center main-title">Novo Abastecimento</h3>
            <div>
              <label>Data</label>
              <input type="date" className="big-input" value={modalDate} onChange={e => setModalDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label>Odômetro</label>
                <input type="number" inputMode="decimal" className="big-input" value={modalOdo} onChange={e => setModalOdo(e.target.value)} />
              </div>
              <div>
                <label>Troca Óleo (Km)</label>
                <input type="number" inputMode="decimal" className="big-input" value={modalOil} onChange={e => setModalOil(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Litros</label>
              <input type="number" inputMode="decimal" step="0.01" className="big-input" value={modalLit} onChange={e => setModalLit(e.target.value)} />
            </div>
            <div>
              <label>Posto</label>
              <input type="text" list="postos-list" className="big-input" placeholder="Posto..." value={modalSt} onChange={e => setModalSt(e.target.value)} />
              <datalist id="postos-list">
                {Array.from(new Set(allLogs.map(l => l[9]).filter(Boolean))).map(posto => (
                  <option key={posto as string} value={posto as string} />
                ))}
              </datalist>
            </div>
            <div>
              <label>Nível do Tanque</label>
              <div className="flex">
                <button 
                  onClick={() => setModalTank('Full Tank - refresh')} 
                  className={`segmented-btn btn-left main-title ${modalTank.includes('Full') ? 'btn-active' : ''}`}
                >
                  Cheio
                </button>
                <button 
                  onClick={() => setModalTank('Parcial')} 
                  className={`segmented-btn btn-right main-title ${!modalTank.includes('Full') ? 'btn-active' : ''}`}
                >
                  Parcial
                </button>
              </div>
            </div>
            <div>
              <label>Total R$</label>
              <input type="number" inputMode="decimal" step="0.01" className="big-input" value={modalTot} onChange={e => setModalTot(e.target.value)} />
            </div>
            <div className="lcd-display p-4 text-center bg-cyan-400">
              <label className="text-black font-black uppercase">Preço Unitário</label>
              <div className="text-3xl font-black text-black">R$ {modalPrice}</div>
            </div>
            <div className="flex gap-4 pt-4 pb-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 font-black opacity-60 uppercase text-lg main-title">Sair</button>
              <button onClick={saveData} className="flex-1 panel-sport p-4 rounded-2xl font-black uppercase text-xl main-title btn-save-text">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {logToDelete && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm">
            <h3 className="text-xl font-black text-red-500 mb-4 uppercase">Excluir Registro?</h3>
            <p className="text-sm opacity-80 mb-6">
              Tem certeza que deseja excluir o abastecimento do dia {formatDate(logToDelete[1])} no valor de R$ {String(logToDelete[11]).replace('.', ',')}?
            </p>
            <div className="flex gap-4">
              <button 
                className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold"
                onClick={() => setLogToDelete(null)}
              >
                Cancelar
              </button>
              <button 
                className="flex-1 py-3 rounded-xl bg-red-600 font-bold text-white"
                onClick={() => confirmDelete(logToDelete[0])}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
