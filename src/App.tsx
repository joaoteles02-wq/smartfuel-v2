import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Trash2, RefreshCw } from 'lucide-react';

const URL = "https://script.google.com/macros/s/AKfycbzI0sRm9dOJWtqD390cJi8hjFoJuo3ZNgjDKMPbkSb8K5vxnxL3sZbzH5Iwkz4gqhF1Qg/exec";

const parseBrNumber = (val: any) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  
  if (str.includes(',') && str.includes('.')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  
  if (str.includes(',') && !str.includes('.')) {
    return parseFloat(str.replace(',', '.')) || 0;
  }
  
  if (str.includes('.') && !str.includes(',')) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(str)) {
      return parseFloat(str.replace(/\./g, '')) || 0;
    }
    return parseFloat(str) || 0;
  }
  
  return parseFloat(str) || 0;
};

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
  const [lastSpentFuel, setLastSpentFuel] = useState(0);
  const [lastTankType, setLastTankType] = useState("Full Tank - refresh");
  const [lastKmL, setLastKmL] = useState(8.0);
  const [prevKmL, setPrevKmL] = useState(8.0);
  const [oilTarget, setOilTarget] = useState(0);

  // Current inputs
  const [currentOdo, setCurrentOdo] = useState(0);

  // Modal inputs
  const [modalDate, setModalDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalOdo, setModalOdo] = useState('');
  const [modalLit, setModalLit] = useState('');
  const [modalSt, setModalSt] = useState('');
  const [modalTank, setModalTank] = useState('');
  const [modalTot, setModalTot] = useState('');

  // Settings inputs
  const [settingsOil, setSettingsOil] = useState('');
  const [settingsTank, setSettingsTank] = useState('');
  const [settingsMeta, setSettingsMeta] = useState('');
  const [settingsFuel, setSettingsFuel] = useState('Gas.');
  const [newCarName, setNewCarName] = useState('');
  const [addedCars, setAddedCars] = useState<string[]>(() => {
    const saved = localStorage.getItem('smartfuel_added_cars');
    return saved ? JSON.parse(saved) : [];
  });
  const [hiddenCars, setHiddenCars] = useState<string[]>(() => {
    const saved = localStorage.getItem('smartfuel_hidden_cars');
    return saved ? JSON.parse(saved) : [];
  });
  const [carToDelete, setCarToDelete] = useState<string | null>(null);
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
      const deletedArr = deletedStr ? JSON.parse(deletedStr).map(String) : [];

      // Filter out rows without a valid date, and filter out locally deleted logs
      const logs = (d.logs || d).filter((l: any) => {
        if (l[1] == null || String(l[1]).trim() === "") return false;
        const id = l[0] ? String(l[0]) : String(l[1]);
        return !deletedArr.includes(id);
      });
      setAllLogs(logs);

      let currentCar = carOverride || activeCar;
      const localCar = localStorage.getItem('smartfuel_active_car');
      
      if (carOverride) {
        currentCar = carOverride;
      } else if (localCar) {
        currentCar = localCar;
      } else if (d.config && d.config.active_car) {
        currentCar = d.config.active_car;
      }

      let localMeta = localStorage.getItem(`smartfuel_meta_${currentCar}`);
      if (!localMeta) localMeta = localStorage.getItem('smartfuel_meta');
      
      let localTank = localStorage.getItem(`smartfuel_tank_${currentCar}`);
      if (!localTank) localTank = localStorage.getItem('smartfuel_tank');

      const localFuel = localStorage.getItem(`smartfuel_fuel_${currentCar}`) || localStorage.getItem('smartfuel_fuel');
      const localOil = localStorage.getItem(`smartfuel_oil_${currentCar}`) || localStorage.getItem('smartfuel_oil');

      let currentMeta = localMeta ? parseFloat(localMeta) : (d.config ? parseFloat(d.config.meta) : 8.0);
      let currentTank = localTank ? parseFloat(localTank) : (d.config ? parseFloat(d.config.tank_capacity) : 53);
      let currentFuel = localFuel ? localFuel : 'Gas.';
      if (currentFuel === 'Gasolina') currentFuel = 'Gas.';

      setActiveCar(currentCar);
      setMetaVal(currentMeta);
      setTankCap(currentTank);
      setSettingsTank(currentTank.toString());
      setSettingsMeta(currentMeta.toString());
      setSettingsFuel(currentFuel);
      setSettingsOil(localOil || '');

      const carLogs = logs.filter((l: any) => l[2] === currentCar).sort((a: any, b: any) => parseBrNumber(a[3]) - parseBrNumber(b[3]));
      // Fallback array matches the new column structure:
      // 0:ID, 1:Date, 2:CarType, 3:Odo, 4:Dist, 5:City/Road, 6:SpentFuel, 7:CurrentTank, 
      // 8:FuelSupplied, 9:GasStation, 10:Total, 11:UnitValue, 12:Consumption, 13:TankLevel, 
      // 14:Period, 15:Photo, 16:Oil
      const last = carLogs[carLogs.length - 1] || [0, new Date().toISOString(), currentCar, 0, 0, '', 0, 0, 0, 'Posto', 0, 0, currentMeta, 'Full Tank - refresh', 0, '', 0];
      const prev = carLogs[carLogs.length - 2] || last;

      const newLastOdo = parseBrNumber(last[3]) || 0;
      const prevTrip = newLastOdo - (parseBrNumber(prev[3]) || 0);
      const prevSpentCalc = prevTrip / (parseBrNumber(prev[12]) || currentMeta);
      
      setLastOdoVal(newLastOdo);
      setCurrentOdo(newLastOdo);
      setLastLitros(parseBrNumber(last[8]) || 0);
      setLastSpentFuel(parseBrNumber(last[6]) || prevSpentCalc || 0);
      setLastTankType(last[13] || "Full Tank - refresh");
      setLastKmL(parseBrNumber(last[12]) || currentMeta);
      setPrevKmL(parseBrNumber(prev[12]) || currentMeta);
      setOilTarget(parseBrNumber(last[16]) || 0); // Atualizado para coluna Q (índice 16)

    } catch (e: any) {
      console.error(e);
      setFetchError(e.message || "Erro ao carregar os dados.");
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    sync();
    
    // Prevent number inputs from changing value on scroll
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).type === 'number') {
        (document.activeElement as HTMLElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  const isElectric = settingsFuel === 'Elétrico';

  const carLogs = useMemo(() => {
    return allLogs.filter(l => {
      const logCar = String(l[2] || '').trim().toLowerCase();
      const actCar = String(activeCar || '').trim().toLowerCase();
      return logCar === actCar;
    });
  }, [allLogs, activeCar]);

  const avgKmL = useMemo(() => {
    const validKmLs = carLogs.map(l => parseBrNumber(l[12])).filter(v => !isNaN(v) && v > 0);
    if (validKmLs.length === 0) return 0;
    return validKmLs.reduce((a, b) => a + b, 0) / validKmLs.length;
  }, [carLogs]);

  const avgConsOffset = 188.5 - (188.5 * Math.min(avgKmL / 20, 1));

  // Derived calculations
  const trip = Math.max(0, parseBrNumber(currentOdo) - lastOdoVal);
  
  // Define qual média de consumo usar com base no último abastecimento
  const displayKmL = lastTankType.includes("Full") ? lastKmL : avgKmL;

  // Calcula o gasto com base na distância percorrida e na média de consumo
  const spent = displayKmL > 0 ? (trip / displayKmL) : 0;
  
  let baseTank = tankCap;
  if (!lastTankType.includes("Full")) {
    baseTank = Math.min(tankCap, tankCap - lastSpentFuel + lastLitros);
  }
  const remaining = Math.max(0, baseTank - spent);
  
  const safeOilTarget = parseBrNumber(oilTarget);
  const safeCurrentOdo = parseBrNumber(currentOdo);
  const distanceToOil = safeOilTarget - safeCurrentOdo;
  // Show alert if we are within 100km of the target, or if we have passed it (but not by more than 10000km to avoid bugs)
  const showOilAlert = safeOilTarget > 0 && safeCurrentOdo > 0 && distanceToOil <= 100 && distanceToOil >= -10000;

  const consOffset = 188.5 - (188.5 * Math.min(displayKmL / 20, 1));
  const tankOffset = 188.5 - (188.5 * (remaining / tankCap));
  const spentOffset = 188.5 - (188.5 * (spent / tankCap));

  const modalPrice = (parseBrNumber(modalTot) && parseBrNumber(modalLit))
    ? (parseBrNumber(modalTot) / parseBrNumber(modalLit)).toFixed(2)
    : '0.00';

  const chartData = useMemo(() => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return carLogs.slice(-8).map(l => {
      let dateLabel = '';
      if (typeof l[1] === 'string' && l[1].includes('T')) {
        const d = new Date(l[1]);
        dateLabel = monthNames[d.getUTCMonth()];
      } else {
        dateLabel = String(l[1]).substring(0, 5);
      }
      return {
        date: dateLabel,
        kmL: parseBrNumber(l[12]),
        unitPrice: parseBrNumber(l[11])
      };
    });
  }, [carLogs]);

  // Unique cars for select
  const availableCars = useMemo(() => {
    const cars = new Set(allLogs.map(l => l[2]));
    cars.add(activeCar);
    addedCars.forEach(c => cars.add(c));
    hiddenCars.forEach(c => cars.delete(c));
    if (cars.size === 0) cars.add("Meu Carro");
    return Array.from(cars).filter(Boolean);
  }, [allLogs, activeCar, addedCars, hiddenCars]);

  const saveData = async () => {
    const odoVal = parseBrNumber(modalOdo);
    
    // Calculate distance reliably from the last log
    const carLogs = allLogs.filter((l: any) => l[2] === activeCar).sort((a: any, b: any) => parseBrNumber(a[3]) - parseBrNumber(b[3]));
    const lastLog = carLogs[carLogs.length - 1];
    const lastOdometer = lastLog ? parseBrNumber(lastLog[3]) : 0;
    const trip = Math.max(0, odoVal - lastOdometer);
    const litersNum = parseBrNumber(modalLit);
    const kmL = litersNum > 0 ? trip / litersNum : 0;

    const p = {
      carType: activeCar,
      odo: odoVal,
      trip: trip,
      kmL: kmL,
      liters: litersNum,
      total: parseBrNumber(modalTot),
      station: modalSt,
      tankLevel: modalTank,
      date: modalDate,
      oil: parseBrNumber(settingsOil)
    };
    setIsModalOpen(false);
    setBooting(true);
    try {
      await fetch(URL, { 
        method: 'POST', 
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(p) 
      });
      console.log("Save request sent (no-cors)");
    } catch (e) {
      console.error("Save error:", e);
    }
    
    // Give Google Sheets a moment to append the row before syncing
    setTimeout(() => {
      sync();
    }, 3000);
  };

  const saveNewCar = () => {
    const car = newCarName.trim();
    if (car) {
      const newAdded = [...addedCars, car];
      setAddedCars(newAdded);
      localStorage.setItem('smartfuel_added_cars', JSON.stringify(newAdded));
      setActiveCar(car);
      localStorage.setItem('smartfuel_active_car', car);
      setNewCarName('');
    }
  };

  const confirmDelete = async (id: any) => {
    setLogToDelete(null);
    
    const deletedStr = localStorage.getItem('smartfuel_deleted_logs');
    const deletedArr = deletedStr ? JSON.parse(deletedStr).map(String) : [];
    if (!deletedArr.includes(String(id))) {
      deletedArr.push(String(id));
      localStorage.setItem('smartfuel_deleted_logs', JSON.stringify(deletedArr));
    }
    
    setAllLogs(prev => prev.filter(l => String(l[0]) !== String(id)));
  };

  return (
    <div className="flex justify-center p-4 h-screen overflow-y-auto w-full pb-32">
      {booting && (
        <div className="fixed inset-0 bg-black z-[9000] flex flex-col items-center justify-center text-center">
          <div className="digital-glow text-2xl animate-pulse uppercase">Smart Fuel V44</div>
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
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setBooting(true);
                  sync();
                }}
                className="panel-sport w-10 h-10 flex items-center justify-center rounded-full text-cyan-400 hover:text-cyan-300 transition-colors"
                title="Sincronizar Planilha"
              >
                <RefreshCw size={18} />
              </button>
              <button 
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
                className="panel-sport w-10 h-10 flex items-center justify-center rounded-full text-xl"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
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
          <h2 className="text-xl font-black uppercase italic text-center mb-2 main-title text-cyan-400">Simulator</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="panel-sport p-4 text-center">
              <p className="text-[10px] font-black opacity-40 uppercase mb-3 main-title">{isElectric ? 'Energia (kWh)' : 'Gasto (L)'}</p>
              <svg className="w-full h-20" viewBox="0 0 140 80">
                <path fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="12" d="M 20 70 A 50 50 0 1 1 120 70" />
                <path className="gauge-fill" strokeDashoffset={spentOffset} d="M 20 70 A 50 50 0 1 1 120 70" />
              </svg>
              <div className="mt-[-40px] font-black italic text-2xl">{spent.toFixed(2)}</div>
            </div>
            <div className="panel-sport p-4 text-center">
              <p className="text-[10px] font-black opacity-40 uppercase mb-3 main-title">{isElectric ? 'Bateria (%)' : 'Tanque (L)'}</p>
              <svg className="w-full h-20" viewBox="0 0 140 80">
                <path fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="12" d="M 20 70 A 50 50 0 1 1 120 70" />
                <path className="gauge-fill" strokeDashoffset={tankOffset} d="M 20 70 A 50 50 0 1 1 120 70" />
              </svg>
              <div className="mt-[-40px] font-black italic text-2xl">{isElectric ? Math.max(0, ((tankCap - spent) / tankCap) * 100).toFixed(0) + '%' : remaining.toFixed(1)}</div>
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
                  onChange={(e) => setCurrentOdo(e.target.value as any)} 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="panel-sport p-4 text-center flex flex-col justify-center">
              <p className="text-[10px] font-black opacity-40 uppercase mb-1 main-title">Km Percorrido</p>
              <span className="text-4xl font-black italic tracking-tighter main-title">{trip.toFixed(0)}</span>
            </div>
            <div className="panel-sport p-4 text-center">
              <p className="text-[10px] font-black opacity-40 uppercase mb-3 main-title">{isElectric ? 'Consumo médio (Km/kWh)' : 'Consumo médio (Km/L)'}</p>
              <svg className="w-full h-16" viewBox="0 0 140 80">
                <path fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="10" d="M 20 70 A 50 50 0 1 1 120 70" />
                <path className="gauge-fill" strokeDashoffset={avgConsOffset} d="M 20 70 A 50 50 0 1 1 120 70" />
              </svg>
              <div className="mt-[-35px] font-black italic text-2xl flex flex-col items-center">
                <span className={avgKmL < metaVal ? 'text-danger' : 'text-cyan-400'}>{avgKmL > 0 ? avgKmL.toFixed(2) : "--"}</span>
                <span className="text-[9px] text-gray-400 font-normal mt-1">Média Geral</span>
              </div>
            </div>
          </div>
        </div>

        {/* TABS AUXILIARES */}
        <div className={`tab-content ${activeTab === 'history' ? 'active' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black uppercase italic main-title">Histórico</h2>
          </div>
          <div className="space-y-3 pb-20">
            {carLogs.slice().reverse().map((l, i) => {
              const kmLNum = parseBrNumber(l[12]);
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
                          {isElectric ? ' Km/kWh' : ' Km/L'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black opacity-60 uppercase main-title mt-2 border-t border-white/10 pt-2">
                    <span>{l[11] ? `R$ ${String(l[11]).replace('.', ',')}` : '---'}</span>
                    <span>{settingsFuel}</span>
                    <span>+{l[4]} KM</span>
                    <span>{l[3]} KM</span>
                    <span>{l[8]} {isElectric ? 'kWh' : 'L'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`tab-content w-full space-y-4 ${activeTab === 'charts' ? 'block' : 'hidden'}`}>
          <div className="panel-sport w-full p-2 h-64 flex flex-col justify-center shadow-2xl overflow-hidden box-border relative">
            <p className="text-[10px] font-black uppercase opacity-40 main-title absolute top-2 left-4">Consumo</p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
                <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} label={{ value: isElectric ? 'Km/kWh' : 'Km/L', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10, offset: 15 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#06b6d4' }} />
                <Line type="monotone" dataKey="kmL" stroke="#1e40af" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#1e40af' }} style={{ filter: 'drop-shadow(0px 4px 5px rgba(0,0,0,0.5))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-sport w-full p-2 h-64 flex flex-col justify-center shadow-2xl overflow-hidden box-border relative">
            <p className="text-[10px] font-black uppercase opacity-40 main-title absolute top-2 left-4">Preço Unitário</p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
                <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} label={{ value: 'Unit (R$)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10, offset: 15 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#10b981' }} />
                <Line type="monotone" dataKey="unitPrice" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981' }} style={{ filter: 'drop-shadow(0px 4px 5px rgba(0,0,0,0.5))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`tab-content pt-2 space-y-4 ${activeTab === 'settings' ? 'active' : 'hidden'}`}>
          <div className="panel-sport p-5 space-y-4">
            <h3 className="text-md font-black uppercase text-cyan-500 border-b border-white/5 pb-2 main-title">Configurações</h3>
            <label>Selecionar Carro</label>
            <div className="flex gap-2 items-center">
              <select 
                className="big-input flex-1" 
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
              {availableCars.length > 1 && (
                <button 
                  onClick={() => setCarToDelete(activeCar)} 
                  className="p-4 panel-sport text-danger rounded-xl flex items-center justify-center"
                >
                  <Trash2 size={24} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>{isElectric ? 'Bateria (kWh)' : 'Tanque (L)'}</label>
                <input type="number" inputMode="decimal" className="big-input" value={settingsTank} onChange={e => {
                  setSettingsTank(e.target.value);
                  const val = parseBrNumber(e.target.value);
                  if (!isNaN(val)) { 
                    setTankCap(val); 
                    localStorage.setItem(`smartfuel_tank_${activeCar}`, val.toString()); 
                    localStorage.setItem('smartfuel_tank', val.toString()); // Keep global as fallback
                  }
                }} />
              </div>
              <div>
                <label>{isElectric ? 'Meta Km/kWh' : 'Meta Km/L'}</label>
                <input type="number" inputMode="decimal" className="big-input" value={settingsMeta} onChange={e => {
                  setSettingsMeta(e.target.value);
                  const val = parseBrNumber(e.target.value);
                  if (!isNaN(val)) { 
                    setMetaVal(val); 
                    localStorage.setItem(`smartfuel_meta_${activeCar}`, val.toString()); 
                    localStorage.setItem('smartfuel_meta', val.toString()); // Keep global as fallback
                  }
                }} />
              </div>
            </div>
            <div>
              <label>Troca Óleo (Km)</label>
              <input type="number" inputMode="decimal" className="big-input" value={settingsOil} onChange={e => {
                setSettingsOil(e.target.value);
                localStorage.setItem(`smartfuel_oil_${activeCar}`, e.target.value);
                localStorage.setItem('smartfuel_oil', e.target.value);
              }} />
            </div>
            <div>
              <label>Combustível</label>
              <select 
                className="big-input" 
                value={settingsFuel} 
                onChange={e => {
                  setSettingsFuel(e.target.value);
                  localStorage.setItem(`smartfuel_fuel_${activeCar}`, e.target.value);
                  localStorage.setItem('smartfuel_fuel', e.target.value);
                }}
              >
                <option value="Gas.">Gas.</option>
                <option value="Etanol">Etanol</option>
                <option value="GNV">GNV</option>
                <option value="Diesel">Diesel</option>
                <option value="Flex">Flex</option>
                <option value="Elétrico">Elétrico</option>
              </select>
            </div>
            <p className="text-sm text-center opacity-70 italic uppercase font-bold text-cyan-500 mt-2">Salvo automaticamente</p>
            
            <div className="pt-4 mt-4 border-t border-white/10">
              <label>Adicionar Novo Veículo</label>
              <input type="text" className="big-input mb-3" placeholder="Modelo" value={newCarName} onChange={e => setNewCarName(e.target.value)} />
              <button onClick={saveNewCar} className="w-full panel-sport p-4 rounded-2xl font-black uppercase text-cyan-500 main-title">Adicionar Veículo</button>
            </div>

            <div className="mt-8 p-4 bg-black/20 rounded-xl border border-white/5">
              <button 
                onClick={() => {
                  if(window.confirm("Isso vai apagar toda a memória do aplicativo no seu celular (não apaga a planilha). Deseja continuar?")) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="w-full py-2 border border-red-500/30 text-red-500 rounded-lg uppercase font-bold text-xs"
              >
                Resetar Aplicativo (Limpar Cache)
              </button>
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
              setModalLit('');
              setModalTot('');
              setModalSt('');
              setModalTank('');
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
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label>Odômetro</label>
                <input type="number" inputMode="decimal" className="big-input" value={modalOdo} onChange={e => setModalOdo(e.target.value)} />
                <div className="text-right text-xs text-cyan-400 mt-1 font-bold">
                  Km Percorrido: {Math.max(0, parseBrNumber(modalOdo) - lastOdoVal).toFixed(0)} km
                </div>
              </div>
            </div>
            <div>
              <label>{isElectric ? 'Energia (kWh)' : 'Litros'}</label>
              <input type="number" inputMode="decimal" step="0.01" className="big-input" value={modalLit} onChange={e => setModalLit(e.target.value)} />
            </div>
            <div>
              <label>{isElectric ? 'Local de Recarga' : 'Posto'}</label>
              <input type="text" list="postos-list" className="big-input" placeholder={isElectric ? 'Local...' : 'Posto...'} value={modalSt} onChange={e => setModalSt(e.target.value)} />
              <datalist id="postos-list">
                {Array.from(new Set(allLogs.map(l => l[9]).filter(Boolean))).map(posto => (
                  <option key={posto as string} value={posto as string} />
                ))}
              </datalist>
            </div>
            <div>
              <label>{isElectric ? 'Nível da Bateria' : 'Nível do Tanque'}</label>
              <div className="flex">
                <button 
                  onClick={() => setModalTank('Full Tank - refresh')} 
                  className={`segmented-btn btn-left main-title ${modalTank.includes('Full') ? '!bg-green-500/20 !text-green-400 !border-green-500/50' : ''}`}
                >
                  Cheio
                </button>
                <button 
                  onClick={() => setModalTank('Parcial')} 
                  className={`segmented-btn btn-right main-title ${modalTank === 'Parcial' ? '!bg-green-500/20 !text-green-400 !border-green-500/50' : ''}`}
                >
                  Parcial
                </button>
              </div>
            </div>
            <div>
              <label>Total R$</label>
              <div className="relative">
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.01" 
                  className={`big-input ${!modalTank ? 'opacity-50 cursor-not-allowed' : ''}`} 
                  value={modalTot} 
                  onChange={e => setModalTot(e.target.value)} 
                  disabled={!modalTank}
                />
                {!modalTank && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-red-400 bg-black/80 px-2 py-1 rounded font-bold">Selecione o nível do tanque</span>
                  </div>
                )}
              </div>
            </div>
            <div className="lcd-display p-4 text-center">
              <label className="text-[var(--text)] font-black uppercase">Preço Unitário</label>
              <div className="text-3xl font-black text-[var(--text)]">R$ {modalPrice}</div>
            </div>
            <div className="flex gap-4 pt-4 pb-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 panel-sport p-4 rounded-2xl font-black uppercase text-xl main-title !bg-amber-500/20 !border-amber-500/30 text-amber-500">Sair</button>
              <button onClick={saveData} disabled={!modalTank} className={`flex-1 panel-sport p-4 rounded-2xl font-black uppercase text-xl main-title !bg-blue-500/20 !border-blue-500/30 text-blue-400 ${!modalTank ? 'opacity-50 cursor-not-allowed' : ''}`}>Salvar</button>
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
                onClick={() => {
                  const id = logToDelete[0] ? String(logToDelete[0]) : String(logToDelete[1]);
                  const deletedStr = localStorage.getItem('smartfuel_deleted_logs');
                  const deletedArr = deletedStr ? JSON.parse(deletedStr).map(String) : [];
                  if (!deletedArr.includes(id)) {
                    deletedArr.push(id);
                    localStorage.setItem('smartfuel_deleted_logs', JSON.stringify(deletedArr));
                  }
                  setLogToDelete(null);
                  sync();
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {carToDelete && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm">
            <h3 className="text-xl font-black text-red-500 mb-4 uppercase">Remover Veículo?</h3>
            <p className="text-sm opacity-80 mb-6">
              Tem certeza que deseja remover o veículo <strong>{carToDelete}</strong> da lista?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setCarToDelete(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const newAdded = addedCars.filter(c => c !== carToDelete);
                  setAddedCars(newAdded);
                  localStorage.setItem('smartfuel_added_cars', JSON.stringify(newAdded));
                  
                  const newHidden = [...hiddenCars, carToDelete];
                  setHiddenCars(newHidden);
                  localStorage.setItem('smartfuel_hidden_cars', JSON.stringify(newHidden));
                  
                  setCarToDelete(null);
                  
                  const remaining = availableCars.filter(c => c !== carToDelete);
                  const nextCar = remaining.length > 0 ? remaining[0] : "Meu Carro";
                  setActiveCar(nextCar);
                  localStorage.setItem('smartfuel_active_car', nextCar);
                  sync(nextCar);
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 font-bold text-white"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
