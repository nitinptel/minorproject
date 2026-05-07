/**
 * DTC Database Manager
 * localStorage-based database with full CRUD, seeding, and event system
 */

class DTCDB {
  constructor() {
    this.prefix = 'dtc_';
    this.tables = ['routes', 'buses', 'stops', 'schedules', 'drivers', 'alerts', 'departures'];
    this.listeners = {};
    this._init();
  }

  // ─── Core Storage ────────────────────────────────────────────
  _key(table) { return this.prefix + table; }

  _get(table) {
    try { return JSON.parse(localStorage.getItem(this._key(table))) || []; }
    catch { return []; }
  }

  _set(table, data) {
    localStorage.setItem(this._key(table), JSON.stringify(data));
    this._emit(table);
  }

  // ─── CRUD Operations ─────────────────────────────────────────
  insert(table, record) {
    const data = this._get(table);
    const id = record.id || Date.now() + Math.random().toString(36).slice(2, 6);
    const newRecord = { ...record, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    data.push(newRecord);
    this._set(table, data);
    return newRecord;
  }

  findAll(table, filter = {}) {
    let data = this._get(table);
    Object.entries(filter).forEach(([k, v]) => {
      data = data.filter(r => r[k] === v);
    });
    return data;
  }

  findById(table, id) {
    return this._get(table).find(r => r.id == id) || null;
  }

  find(table, predicate) {
    return this._get(table).filter(predicate);
  }

  update(table, id, patch) {
    const data = this._get(table);
    const idx = data.findIndex(r => r.id == id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...patch, id: data[idx].id, updatedAt: new Date().toISOString() };
    this._set(table, data);
    return data[idx];
  }

  delete(table, id) {
    const data = this._get(table);
    const filtered = data.filter(r => r.id != id);
    const deleted = data.length !== filtered.length;
    if (deleted) this._set(table, filtered);
    return deleted;
  }

  count(table, filter = {}) {
    return this.findAll(table, filter).length;
  }

  clear(table) { this._set(table, []); }

  clearAll() { this.tables.forEach(t => this.clear(t)); }

  // ─── Event System ─────────────────────────────────────────────
  on(table, callback) {
    if (!this.listeners[table]) this.listeners[table] = [];
    this.listeners[table].push(callback);
  }

  _emit(table) {
    (this.listeners[table] || []).forEach(cb => cb(this._get(table)));
  }

  // ─── Init & Seeding ───────────────────────────────────────────
  _init() {
    const seeded = localStorage.getItem(this.prefix + 'seeded');
    if (!seeded) {
      this._seed();
      localStorage.setItem(this.prefix + 'seeded', '1');
    }
  }

  reset() {
    this.clearAll();
    localStorage.removeItem(this.prefix + 'seeded');
    this._seed();
    localStorage.setItem(this.prefix + 'seeded', '1');
  }

  _seed() {
    // ── Stops ──
    const stops = [
      { id: 'S1',  name: 'Kashmere Gate ISBT',    lat: 28.6672, lng: 77.2286, type: 'terminal'  },
      { id: 'S2',  name: 'Connaught Place',         lat: 28.6315, lng: 77.2167, type: 'major'     },
      { id: 'S3',  name: 'AIIMS',                   lat: 28.5665, lng: 77.2100, type: 'major'     },
      { id: 'S4',  name: 'Anand Vihar ISBT',        lat: 28.6464, lng: 77.3158, type: 'terminal'  },
      { id: 'S5',  name: 'Dwarka Sector 21',        lat: 28.5534, lng: 77.0588, type: 'terminal'  },
      { id: 'S6',  name: 'Saket',                   lat: 28.5244, lng: 77.2066, type: 'major'     },
      { id: 'S7',  name: 'Rohini Sector 3',         lat: 28.7120, lng: 77.1198, type: 'major'     },
      { id: 'S8',  name: 'Nehru Place',             lat: 28.5491, lng: 77.2518, type: 'major'     },
      { id: 'S9',  name: 'Sarai Kale Khan ISBT',    lat: 28.5909, lng: 77.2658, type: 'terminal'  },
      { id: 'S10', name: 'Hauz Khas',               lat: 28.5435, lng: 77.2088, type: 'major'     },
      { id: 'S11', name: 'Lajpat Nagar',            lat: 28.5677, lng: 77.2433, type: 'major'     },
      { id: 'S12', name: 'Delhi Gate',              lat: 28.6401, lng: 77.2416, type: 'major'     },
      { id: 'S13', name: 'Noida Sector 15',         lat: 28.5847, lng: 77.3366, type: 'terminal'  },
      { id: 'S14', name: 'Pitampura',               lat: 28.7016, lng: 77.1516, type: 'major'     },
      { id: 'S15', name: 'Badarpur Border',         lat: 28.5023, lng: 77.2990, type: 'terminal'  },
    ];
    stops.forEach(s => this.insert('stops', s));

    // ── Routes ──
    const routes = [
      { id: 'R423', number: '423', name: 'Kashmere Gate → AIIMS',        from: 'S1',  to: 'S3',  stops: ['S1','S12','S2','S11','S10','S3'], type: 'Standard CNG', frequency: 8,  distance: 18.4, duration: 55, status: 'active',   fare: 25  },
      { id: 'R544', number: '544', name: 'Anand Vihar → Dwarka Sec 21',  from: 'S4',  to: 'S5',  stops: ['S4','S2','S11','S6','S5'],        type: 'Low Floor AC', frequency: 12, distance: 34.7, duration: 90, status: 'active',   fare: 50  },
      { id: 'R76',  number: '76',  name: 'Rohini Sec 3 → Nehru Place',   from: 'S7',  to: 'S8',  stops: ['S7','S14','S2','S11','S8'],       type: 'Standard CNG', frequency: 10, distance: 21.3, duration: 65, status: 'active',   fare: 20  },
      { id: 'R881', number: '881', name: 'Delhi Gate → Saket',           from: 'S12', to: 'S6',  stops: ['S12','S9','S11','S6'],            type: 'Electric EV',  frequency: 15, distance: 14.2, duration: 40, status: 'active',   fare: 15  },
      { id: 'R101', number: '101', name: 'Lajpat Nagar → CP',           from: 'S11', to: 'S2',  stops: ['S11','S8','S2'],                  type: 'Express',      frequency: 20, distance: 9.8,  duration: 30, status: 'active',   fare: 40  },
      { id: 'R330', number: '330', name: 'Hauz Khas → ISBT Sarai Kale', from: 'S10', to: 'S9',  stops: ['S10','S6','S11','S8','S9'],       type: 'Standard CNG', frequency: 12, distance: 12.5, duration: 35, status: 'active',   fare: 15  },
      { id: 'R502', number: '502', name: 'Noida Sec 15 → Kashmere Gate',from: 'S13', to: 'S1',  stops: ['S13','S4','S2','S1'],             type: 'Low Floor AC', frequency: 18, distance: 28.6, duration: 75, status: 'active',   fare: 35  },
      { id: 'R214', number: '214', name: 'Badarpur → CP Express',       from: 'S15', to: 'S2',  stops: ['S15','S8','S11','S2'],            type: 'Express',      frequency: 25, distance: 24.1, duration: 55, status: 'delayed',  fare: 45  },
      { id: 'R667', number: '667', name: 'Pitampura → Saket',           from: 'S14', to: 'S6',  stops: ['S14','S7','S2','S10','S6'],       type: 'Electric EV',  frequency: 14, distance: 30.2, duration: 80, status: 'active',   fare: 30  },
      { id: 'R789', number: '789', name: 'Dwarka → Noida Ring',         from: 'S5',  to: 'S13', stops: ['S5','S2','S4','S13'],             type: 'Standard CNG', frequency: 20, distance: 45.8, duration: 110,status: 'suspended',fare: 30  },
    ];
    routes.forEach(r => this.insert('routes', r));

    // ── Buses ──
    const busTypes = ['Standard CNG','Low Floor AC','Electric EV','Express'];
    const depotList = ['Kashmere Gate','Anand Vihar','Dwarka','Rohini','Saket','IP Depot'];
    for (let i = 1; i <= 30; i++) {
      const type = busTypes[Math.floor(Math.random() * busTypes.length)];
      this.insert('buses', {
        id: `B${String(i).padStart(3,'0')}`,
        regNo: `DL-1P-${1000 + i}`,
        driverId: `D${String((i % 18) + 1).padStart(3,'0')}`,
        type,
        model: type === 'Electric EV' ? 'Olectra K7' : type === 'Low Floor AC' ? 'Tata Starbus AC' : type === 'Express' ? 'Volvo 9400' : 'Ashok Leyland Viking',
        capacity: type === 'Express' ? 45 : type === 'Low Floor AC' ? 55 : 65,
        depot: depotList[Math.floor(Math.random() * depotList.length)],
        status: Math.random() > 0.15 ? 'operational' : 'maintenance',
        routeId: Math.random() > 0.2 ? routes[Math.floor(Math.random() * routes.length)].id : null,
        kmRun: Math.floor(Math.random() * 200000) + 10000,
        lastService: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString().split('T')[0],
        fuelLevel: Math.floor(Math.random() * 100),
        occupancy: Math.floor(Math.random() * 100),
      });
    }

    // ── Drivers ──
    const driverNames = [
      'Ramesh Kumar','Sunil Sharma','Ajay Singh','Mohan Das','Vijay Rao','Prakash Gupta',
      'Dinesh Tiwari','Ravi Verma','Ashok Mehta','Sanjay Yadav','Manoj Patel','Suresh Nair',
      'Deepak Joshi','Rohit Chauhan','Ankit Dubey','Pradeep Mishra','Rajesh Bhat','Arun Pillai'
    ];
    driverNames.forEach((name, i) => {
      this.insert('drivers', {
        id: `D${String(i+1).padStart(3,'0')}`,
        name,
        badge: `DTC-${2000 + i}`,
        phone: `98${String(Math.floor(10000000 + Math.random() * 89999999))}`,
        depot: depotList[Math.floor(Math.random() * depotList.length)],
        license: `DL-${2010 + Math.floor(Math.random()*10)}-${Math.floor(Math.random()*9999999 + 1000000)}`,
        status: Math.random() > 0.2 ? 'on-duty' : 'off-duty',
        trips_today: Math.floor(Math.random() * 6),
        rating: (3.5 + Math.random() * 1.5).toFixed(1),
      });
    });

    // ── Schedules ──
    const scheduleSlots = [];
    // Route 423: 05:00 to 23:00 every 8 min during peak, 12 min off-peak
    for (let h = 5; h < 23; h++) {
      const freq = (h >= 7 && h <= 10) || (h >= 17 && h <= 20) ? 8 : 12;
      for (let m = 0; m < 60; m += freq) {
        const dep = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const arrH = Math.floor((h * 60 + m + 55) / 60);
        const arrM = (h * 60 + m + 55) % 60;
        const arr = `${String(arrH).padStart(2,'0')}:${String(arrM).padStart(2,'0')}`;
        scheduleSlots.push({ routeId: 'R423', direction: 'southbound', departure: dep, arrival: arr, busType: 'Standard CNG' });
      }
    }
    // Route 544
    for (let h = 6; h < 22; h += 0) {
      const dep = `${String(h).padStart(2,'0')}:00`;
      const arrH = Math.floor((h * 60 + 90) / 60);
      const arr = `${String(arrH % 24).padStart(2,'0')}:${String((h * 60 + 90) % 60).padStart(2,'0')}`;
      scheduleSlots.push({ routeId: 'R544', direction: 'westbound', departure: dep, arrival: arr, busType: 'Low Floor AC' });
      h += 12 / 60 * 1 > 0 ? 0.2 : 0;
      h = Math.round(h * 10) / 10 + (h % 1 > 0.15 ? 0 : 0);
      h += 0.2;
      if (h >= 22) break;
    }
    scheduleSlots.forEach(s => this.insert('schedules', s));

    // ── Alerts ──
    const alertsData = [
      { type: 'warning', icon: '⚠️', title: 'Route 544 — 8 Min Delay',       message: 'Traffic congestion at NH-24 near Ghazipur. Buses running behind schedule.',         routeId: 'R544', severity: 'medium', active: true  },
      { type: 'info',    icon: 'ℹ️', title: 'Route 101 — 5 Min Delay',       message: 'Minor signal disruption at Lajpat Nagar junction.',                                   routeId: 'R101', severity: 'low',    active: true  },
      { type: 'success', icon: '✅', title: 'Route 423 — Back On Time',       message: 'Traffic cleared at ITO. Route 423 now running to schedule.',                         routeId: 'R423', severity: 'low',    active: true  },
      { type: 'danger',  icon: '🚨', title: 'Route 789 — Suspended',         message: 'Route 789 temporarily suspended due to waterlogging at Dwarka underpass. Resume ETA 18:00.', routeId: 'R789', severity: 'high',   active: true  },
      { type: 'info',    icon: '🔧', title: 'Depot Maintenance — Rohini',    message: 'Scheduled maintenance at Rohini depot 10:00–14:00. 12 buses temporarily offline.',   routeId: null,   severity: 'medium', active: true  },
      { type: 'warning', icon: '🌧️', title: 'Weather Advisory',              message: 'Heavy rainfall expected 15:00–19:00. All drivers advised to maintain safe speeds.',  routeId: null,   severity: 'high',   active: false },
    ];
    alertsData.forEach(a => this.insert('alerts', a));

    // ── Departures (live board seed) ──
    const terminals = [
      { name: 'Kashmere Gate ISBT', short: 'KMGT' },
      { name: 'Anand Vihar ISBT',   short: 'ANVR' },
      { name: 'Sarai Kale Khan',    short: 'SKK'  },
    ];
    const destList = [
      'AIIMS','Dwarka Sec 21','Nehru Place','Saket','Connaught Place',
      'Rohini Sec 3','Lajpat Nagar','Hauz Khas','Noida Sec 15','Pitampura'
    ];
    const routeNos = ['423','544','76','881','101','330','502','214','667','302','415','567'];
    const now = new Date();
    for (let i = 0; i < 20; i++) {
      const dep = new Date(now.getTime() + (i * 3 + Math.random() * 5) * 60000);
      const terminal = terminals[Math.floor(Math.random() * terminals.length)];
      const delayMin = Math.random() > 0.7 ? Math.floor(Math.random() * 12) + 2 : 0;
      this.insert('departures', {
        routeNo: routeNos[Math.floor(Math.random() * routeNos.length)],
        destination: destList[Math.floor(Math.random() * destList.length)],
        terminal: terminal.name,
        terminalShort: terminal.short,
        platform: `P${Math.floor(Math.random() * 12) + 1}`,
        scheduledTime: dep.toISOString(),
        delayMin,
        status: delayMin > 5 ? 'delayed' : delayMin > 0 ? 'slight-delay' : Math.random() > 0.9 ? 'cancelled' : 'on-time',
        occupancy: Math.floor(Math.random() * 100),
        busType: busTypes[Math.floor(Math.random() * busTypes.length)],
      });
    }
  }

  // ─── Analytics Helpers ────────────────────────────────────────
  getStats() {
    const buses = this.findAll('buses');
    const routes = this.findAll('routes');
    const drivers = this.findAll('drivers');
    const operational = buses.filter(b => b.status === 'operational').length;
    return {
      totalBuses: buses.length,
      operationalBuses: operational,
      totalRoutes: routes.length,
      activeRoutes: routes.filter(r => r.status === 'active').length,
      totalDrivers: drivers.length,
      onDutyDrivers: drivers.filter(d => d.status === 'on-duty').length,
      onTimeRate: 87.4,
      dailyPassengers: 4500000,
    };
  }

  getFleetBreakdown() {
    const buses = this.findAll('buses');
    const types = {};
    buses.forEach(b => { types[b.type] = (types[b.type] || 0) + 1; });
    return types;
  }

  getWeeklyRidership() {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return days.map(day => ({
      day,
      passengers: Math.floor(35 + Math.random() * 20) * 100000,
      onTime: Math.floor(82 + Math.random() * 12),
    }));
  }
}

// Singleton
const db = new DTCDB();
window.db = db; // expose globally
