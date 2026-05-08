/**
 * DTC App — Main Application Logic
 * Requires db.js (DTCDB) to be loaded first
 */

// ─── State ───────────────────────────────────────────────────────
const state = {
  isAdmin: false,
  activeTab: 'All Terminals',
  scheduleRoute: 'R423',
  scheduleDay: 'weekdays',
  fleetFilter: '',
  editingRouteId: null,
  currentTicket: null,
  tickerInterval: null,
  depInterval: null,
};

// ─── DOM Ready ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavScroll();
  initCounters();
  initDriverPanel();
  initDepartures();
  initMap();
  initRoutes();
  initSchedule();
  initFleet();
  initAnalytics();
  initAlerts();
  initSearch();
  initTickets();
  initModals();
  initMobileMenu();
  startLiveUpdates();
  setCurrentTime();
});

// ─── Navbar Scroll ───────────────────────────────────────────────
function initNavScroll() {
  const nav = document.querySelector('.navbar');
  const links = document.querySelectorAll('.nav-links a');

  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 30
      ? 'rgba(8,13,26,0.98)' : 'rgba(8,13,26,0.92)';
  });

  // Active link on scroll
  const sections = ['hero','departures','ticket','routes','schedule','fleet','analytics','alerts-section'];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const target = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
        if (target) target.classList.add('active');
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// ─── Animated Counters ────────────────────────────────────────────
function initCounters() {
  const stats = db.getStats();
  const targets = {
    'count-buses':      stats.totalBuses,
    'count-routes':     stats.totalRoutes,
    'count-passengers': stats.dailyPassengers,
  };

  Object.entries(targets).forEach(([id, target]) => {
    const el = document.getElementById(id);
    if (!el) return;
    animateCount(el, 0, target, 2000);
  });
}

function animateCount(el, start, end, duration) {
  const startTime = performance.now();
  const fmt = n => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n.toLocaleString();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const val = Math.round(start + (end - start) * ease);
    el.textContent = fmt(val);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}



// ─── Driver Panel ─────────────────────────────────────────────
function initDriverPanel(){

  const panels = [
    {
      busSelect: document.getElementById('busSelect'),
      driverName: document.getElementById('assignedDriver'),
      editBtn: document.getElementById('editDriverBtn')
    },
    {
      busSelect: document.getElementById('mobileBusSelect'),
      driverName: document.getElementById('mobileAssignedDriver'),
      editBtn: document.getElementById('mobileEditDriverBtn')
    }
  ].filter(panel => panel.busSelect && panel.driverName && panel.editBtn);

  if(!panels.length) return;

  const buses = db.findAll('buses');
  const drivers = db.findAll('drivers');
  const busOptions = buses.map(bus => {
    return `
      <option value="${bus.id}">
        ${bus.regNo}
      </option>
    `;
  }).join('');

  panels.forEach(panel => {
    panel.busSelect.innerHTML = busOptions;
  });

  function updateDriverDisplay(panel){

    const bus = db.findById('buses', panel.busSelect.value);

    if(!bus || !bus.driverId){
      panel.driverName.textContent = 'Not Assigned';
      return;
    }

    const driver = db.findById('drivers', bus.driverId);

    panel.driverName.textContent = driver
      ? driver.name
      : 'Unknown Driver';
  }

  function updateAllDriverDisplays(){
    panels.forEach(updateDriverDisplay);
  }

  updateAllDriverDisplays();

  panels.forEach(panel => {
    panel.busSelect.addEventListener('change', () => updateDriverDisplay(panel));

    panel.editBtn.addEventListener('click', () => {

      if(!state.isAdmin){
        showToast('Admin access required','error');
        return;
      }

      const driverList = drivers
        .map(d => `${d.id} - ${d.name}`)
        .join('\n');

      const selectedDriver = prompt(
        `Assign Driver to Bus\n\n${driverList}\n\nEnter Driver ID:`
      );

      if(!selectedDriver) return;

      const driverId = selectedDriver.trim().split(/\s+/)[0].toUpperCase();
      const exists = drivers.find(
        d => d.id.toUpperCase() === driverId
      );

      if(!exists){
        showToast('Invalid Driver ID','error');
        return;
      }

      db.update('buses', panel.busSelect.value, {
        driverId: exists.id
      });

      updateAllDriverDisplays();

      showToast('Driver assigned successfully','success');
    });
  });

  db.on('buses', () => {
    updateAllDriverDisplays();
  });
}

// ─── Live Clock ────────────────────────────────────────────────────
function setCurrentTime() {
  const el = document.getElementById('liveTime');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTimeout(tick, 1000);
  };
  tick();
}

// ─── Departures Board ─────────────────────────────────────────────
function initDepartures() {
  renderDepartures(state.activeTab);

  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      renderDepartures(state.activeTab);
    });
  });
}

function renderDepartures(terminal) {
  const tbody = document.getElementById('depTableBody');
  if (!tbody) return;

  let deps = db.findAll('departures');
  if (terminal !== 'All Terminals') deps = deps.filter(d => d.terminal === terminal);
  deps.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  deps = deps.slice(0, 15);

  tbody.innerHTML = deps.map(dep => {
    const time = new Date(dep.scheduledTime);
    const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    const diffMin = Math.max(0, Math.round((time - now) / 60000));
    const occ = dep.occupancy;
    const occClass = occ < 50 ? 'occ-low' : occ < 80 ? 'occ-mid' : 'occ-high';

    const statusInfo = {
      'on-time':     ['pill-on-time',   '● On Time'],
      'delayed':     ['pill-delayed',   '▲ Delayed'],
      'slight-delay':['pill-slight',    '◌ Slight Delay'],
      'cancelled':   ['pill-cancelled', '✕ Cancelled'],
    };
    const [cls, label] = statusInfo[dep.status] || statusInfo['on-time'];

    const typeIcon = { 'Electric EV': '⚡', 'Low Floor AC': '❄️', 'Standard CNG': '🚌', 'Express': '🚀' };
    const icon = typeIcon[dep.busType] || '🚌';

    return `<tr>
      <td><span class="route-badge">${dep.routeNo}</span></td>
      <td>
        <div style="font-weight:600">${dep.destination}</div>
        <div style="font-size:12px;color:var(--text3)">${dep.terminal}</div>
      </td>
      <td>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--text2)">P${dep.platform}</span>
      </td>
      <td>
        <div class="time-display">${timeStr}</div>
        ${dep.delayMin > 0 ? `<div class="time-delay">+${dep.delayMin} min delay</div>` : ''}
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${diffMin <= 0 ? 'Departing now' : `In ${diffMin} min`}</div>
      </td>
      <td><span class="status-pill ${cls}">${label}</span></td>
      <td>
        <div class="occ-label">${occ}%</div>
        <div class="occ-bar"><div class="occ-fill ${occClass}" style="width:${occ}%"></div></div>
      </td>
      <td style="font-size:13px">${icon} ${dep.busType}</td>
    </tr>`;
  }).join('');
}

// ─── Live Map ──────────────────────────────────────────────────────
// Tickets
function initTickets() {
  renderTicketRoutes();
  renderFareEditor();
  updateTicketSummary();

  document.getElementById('ticketRoute')?.addEventListener('change', updateTicketSummary);
  document.getElementById('ticketPassengers')?.addEventListener('input', updateTicketSummary);
  document.getElementById('btnPayUpi')?.addEventListener('click', payTicketWithUpi);
  document.getElementById('btnDownloadTicket')?.addEventListener('click', generateTicket);
  document.getElementById('btnSaveFares')?.addEventListener('click', saveAllRouteFares);
}

function renderTicketRoutes() {
  const select = document.getElementById('ticketRoute');
  if (!select) return;

  const routes = db.findAll('routes');
  select.innerHTML = routes.map(route =>
    `<option value="${route.id}">Route ${route.number} - ${route.name}</option>`
  ).join('');
}

function getTicketSelection() {
  const routeId = document.getElementById('ticketRoute')?.value;
  const route = db.findById('routes', routeId);
  const passengerInput = document.getElementById('ticketPassengers');
  const passengers = Math.max(1, Math.min(10, Number(passengerInput?.value) || 1));

  if (passengerInput && String(passengers) !== passengerInput.value) {
    passengerInput.value = passengers;
  }

  const fare = Number(route?.fare) || 0;
  return { route, passengers, fare, total: fare * passengers };
}

function updateTicketSummary() {
  const { fare, total } = getTicketSelection();
  const fareEl = document.getElementById('ticketFare');
  const totalEl = document.getElementById('ticketTotal');
  if (fareEl) fareEl.textContent = `Rs ${fare}`;
  if (totalEl) totalEl.textContent = `Rs ${total}`;
}

function selectTicketRoute(routeId) {
  const select = document.getElementById('ticketRoute');
  if (select) {
    select.value = routeId;
    updateTicketSummary();
  }
  document.getElementById('ticket')?.scrollIntoView({ behavior: 'smooth' });
}

function payTicketWithUpi() {
  const { route, passengers, total } = getTicketSelection();
  const name = document.getElementById('ticketName')?.value.trim();
  const phone = document.getElementById('ticketPhone')?.value.trim();

  if (!route) { showToast('Please select a route','error'); return; }
  if (!name) { showToast('Passenger name is required','error'); return; }
  if (!/^\d{10}$/.test(phone || '')) { showToast('Enter a valid 10 digit mobile number','error'); return; }
  if (total <= 0) { showToast('Ticket amount must be greater than zero','error'); return; }

  const ticketId = `DTC${Date.now().toString().slice(-8)}`;
  state.currentTicket = {
    id: ticketId,
    routeId: route.id,
    routeNumber: route.number,
    routeName: route.name,
    passengerName: name,
    phone,
    passengers,
    amount: total,
    createdAt: new Date().toISOString()
  };

  const params = new URLSearchParams({
    pa: '9302179360@fam',
    pn: 'Delhi Transport Corporation',
    am: total.toFixed(2),
    cu: 'INR',
    tn: `DTC Ticket ${ticketId} Route ${route.number}`
  });
  const upiUrl = `upi://pay?${params.toString()}`;
  const status = document.getElementById('ticketStatus');
  if (status) {
    status.innerHTML = `Ticket ${ticketId} ready. Complete payment in your UPI app, then generate the ticket receipt.`;
  }

  window.location.href = upiUrl;
  showToast('Opening UPI payment app','info');
}

function generateTicket() {
  const ticket = state.currentTicket;
  if (!ticket) {
    showToast('Please pay with UPI first','error');
    return;
  }

  const status = document.getElementById('ticketStatus');
  if (status) {
    status.innerHTML = `
      <div class="ticket-receipt">
        <div><strong>Ticket ID:</strong> ${ticket.id}</div>
        <div><strong>Passenger:</strong> ${ticket.passengerName}</div>
        <div><strong>Route:</strong> ${ticket.routeNumber} - ${ticket.routeName}</div>
        <div><strong>Passengers:</strong> ${ticket.passengers}</div>
        <div><strong>Amount:</strong> Rs ${ticket.amount}</div>
      </div>
    `;
  }
  showToast('Ticket generated','success');
}

function renderFareEditor() {
  const editor = document.getElementById('fareEditor');
  if (!editor) return;

  const routes = db.findAll('routes');
  editor.innerHTML = routes.map(route => `
    <div class="fare-row">
      <div>
        <strong>Route ${route.number}</strong>
        <span>${route.name}</span>
      </div>
      <input class="fare-input" data-route-id="${route.id}" type="number" min="0" step="1" value="${Number(route.fare) || 0}" ${state.isAdmin ? '' : 'disabled'}>
    </div>
  `).join('');

  const saveBtn = document.getElementById('btnSaveFares');
  if (saveBtn) saveBtn.disabled = !state.isAdmin;
}

function saveAllRouteFares() {
  if (!state.isAdmin) { showToast('Admin access required to edit fares','error'); return; }

  const inputs = document.querySelectorAll('.fare-input');
  for (const input of inputs) {
    const fare = Number(input.value);
    if (!Number.isFinite(fare) || fare < 0) {
      showToast('Fares must be zero or greater','error');
      return;
    }
  }

  inputs.forEach(input => {
    db.update('routes', input.dataset.routeId, { fare: Number(input.value) });
  });

  renderTicketRoutes();
  renderFareEditor();
  updateTicketSummary();
  refreshEditableViews();
  showToast('Route fares updated','success');
}

function initMap() {
  const canvas = document.getElementById('dtcMap');
  if (!canvas) return;

  // Draw SVG Delhi map
  canvas.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 700 420" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">
      <!-- Background -->
      <rect width="700" height="420" fill="#080d1a"/>
      <!-- Grid -->
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="700" height="420" fill="url(#grid)"/>

      <!-- Yamuna River -->
      <path d="M 420 20 Q 440 100 430 180 Q 415 260 440 350 Q 455 400 470 420"
            fill="none" stroke="rgba(59,130,246,0.3)" stroke-width="8" stroke-linecap="round"/>
      <text x="445" y="200" fill="rgba(59,130,246,0.5)" font-size="11" font-family="IBM Plex Mono">Yamuna</text>

      <!-- Ring Road -->
      <ellipse cx="350" cy="210" rx="180" ry="150" fill="none" stroke="rgba(255,107,0,0.12)" stroke-width="10" stroke-dasharray="6 4"/>

      <!-- Routes -->
      <!-- Route 423: Kashmere Gate → AIIMS (S1→S3) -->
      <path d="M 380 80 L 340 140 L 310 160 L 290 200 L 280 270 L 270 310"
            fill="none" stroke="rgba(0,200,150,0.5)" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Route 544: Anand Vihar → Dwarka -->
      <path d="M 480 130 L 380 80 L 310 160 L 280 270 L 160 290 L 100 310"
            fill="none" stroke="rgba(139,92,246,0.5)" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Route 76: Rohini → Nehru Place -->
      <path d="M 220 60 L 260 110 L 310 160 L 340 250 L 380 290"
            fill="none" stroke="rgba(245,158,11,0.5)" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Stop markers -->
      <circle cx="380" cy="80"  r="7" fill="#0d1426" stroke="#FF6B00" stroke-width="2"/>
      <text x="390" y="75"  fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">KMGT</text>
      <circle cx="310" cy="160" r="7" fill="#0d1426" stroke="#FF6B00" stroke-width="2"/>
      <text x="320" y="155" fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">CP</text>
      <circle cx="270" cy="310" r="7" fill="#0d1426" stroke="#00C896" stroke-width="2"/>
      <text x="280" y="305" fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">AIIMS</text>
      <circle cx="480" cy="130" r="7" fill="#0d1426" stroke="#8B5CF6" stroke-width="2"/>
      <text x="490" y="125" fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">ANVR</text>
      <circle cx="100" cy="310" r="7" fill="#0d1426" stroke="#8B5CF6" stroke-width="2"/>
      <text x="110" y="305" fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">DWKA</text>
      <circle cx="220" cy="60"  r="7" fill="#0d1426" stroke="#F59E0B" stroke-width="2"/>
      <text x="230" y="55"  fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">RHNI</text>
      <circle cx="380" cy="290" r="7" fill="#0d1426" stroke="#F59E0B" stroke-width="2"/>
      <text x="390" y="285" fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">NHP</text>
      <circle cx="350" cy="380" r="7" fill="#0d1426" stroke="#3B82F6" stroke-width="2"/>
      <text x="360" y="375" fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">SAKT</text>
      <circle cx="560" cy="300" r="7" fill="#0d1426" stroke="#3B82F6" stroke-width="2"/>
      <text x="570" y="295" fill="#E8EDF5" font-size="10" font-family="IBM Plex Mono" font-weight="600">NIDA</text>
    </svg>

    <!-- Animated bus markers -->
    <div id="busMarkers" style="position:absolute;inset:0;pointer-events:none"></div>
  `;

  // Animate buses
  animateBuses();

  // Map tab controls
  document.querySelectorAll('.map-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-btn[data-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function animateBuses() {
  const markerWrap = document.getElementById('busMarkers');
  if (!markerWrap) return;

  const buses = [
    { type: '🚌', color: '#FF6B00', path: [[380,80],[340,140],[310,160],[280,270],[270,310]], label: '423' },
    { type: '❄️', color: '#8B5CF6', path: [[480,130],[380,80],[310,160],[160,290],[100,310]], label: '544' },
    { type: '⚡', color: '#00C896', path: [[220,60],[260,110],[310,160],[340,250],[380,290]], label: '76'  },
  ];

  const markers = buses.map((bus, i) => {
    const el = document.createElement('div');
    el.className = 'bus-marker';
    el.innerHTML = bus.type;
    el.style.cssText = `
      background: ${bus.color}22;
      border: 2px solid ${bus.color};
      box-shadow: 0 0 12px ${bus.color}55;
      left: 0; top: 0;
    `;
    el.title = `Route ${bus.label}`;
    markerWrap.appendChild(el);
    return { el, bus, t: (i * 0.33) % 1, pathIdx: 0 };
  });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function animStep() {
    markers.forEach(m => {
      m.t += 0.002;
      if (m.t >= 1) m.t = 0;

      const path = m.bus.path;
      const totalSeg = path.length - 1;
      const rawPos = m.t * totalSeg;
      const seg = Math.min(Math.floor(rawPos), totalSeg - 1);
      const segT = rawPos - seg;

      const x = lerp(path[seg][0], path[seg + 1][0], segT);
      const y = lerp(path[seg][1], path[seg + 1][1], segT);

      m.el.style.left = (x - 14) + 'px';
      m.el.style.top  = (y - 14) + 'px';
    });
    requestAnimationFrame(animStep);
  }
  requestAnimationFrame(animStep);
}

// ─── Routes ────────────────────────────────────────────────────────
function initRoutes() {
  renderRoutes();
  document.getElementById('btnAddRoute')?.addEventListener('click', () => openRouteModal());
}

function renderRoutes() {
  const grid = document.getElementById('routesGrid');
  if (!grid) return;

  const routes = db.findAll('routes');
  const stops = db.findAll('stops');
  const stopMap = Object.fromEntries(stops.map(s => [s.id, s.name]));

  grid.innerHTML = routes.map(r => {
    const typeIcon = { 'Electric EV': '⚡', 'Low Floor AC': '❄️', 'Standard CNG': '🚌', 'Express': '🚀' };
    const icon = typeIcon[r.type] || '🚌';
    const sCls = { active: 'rs-active', delayed: 'rs-delayed', suspended: 'rs-suspended' };
    const fromName = stopMap[r.from] || r.from;
    const toName   = stopMap[r.to]   || r.to;

    return `<div class="route-card">
      <div class="route-card-header">
        <div class="route-number">Route ${r.number}</div>
        <span class="route-status-pill ${sCls[r.status] || 'rs-active'}">${r.status}</span>
      </div>
      <div class="route-name">${icon} ${r.name}</div>
      <div class="route-path">
        <span style="font-size:12px;color:var(--text3)">From</span>
        <span>${fromName}</span>
        <span class="route-arrow">→</span>
        <span>${toName}</span>
      </div>
      <div class="route-meta">
        <div class="route-meta-item">
          <div class="route-meta-val">${r.frequency}</div>
          <div class="route-meta-key">min freq</div>
        </div>
        <div class="route-meta-item">
          <div class="route-meta-val">${r.distance}</div>
          <div class="route-meta-key">km</div>
        </div>
        <div class="route-meta-item">
          <div class="route-meta-val">₹${r.fare}</div>
          <div class="route-meta-key">fare</div>
        </div>
      </div>
      <div class="route-actions">
        ${state.isAdmin ? `
          <button class="btn-outline" onclick="openRouteModal('${r.id}')">✏️ Edit</button>
          <button class="btn-outline danger" onclick="deleteRoute('${r.id}')">🗑 Delete</button>
        ` : `
          <button class="btn-outline" onclick="showToast('Route ${r.number}: ${r.stops.length} stops · ${r.duration} min journey','info')">📍 View Stops</button>
          <button class="btn-outline" onclick="window.location.href='#schedule'">🕐 Schedule</button>
        `}
      </div>
    </div>`;
  }).join('');
}

function openRouteModal(id = null) {
  if (!state.isAdmin) { showToast('Please login as admin to manage routes','error'); return; }
  state.editingRouteId = id;
  const routeForm = document.getElementById('routeForm');
  const routeTitle = document.getElementById('routeModalTitle');
  if (!routeForm || !routeTitle) return;

  const stops = db.findAll('stops');

  let route = { number:'', name:'', type:'Standard CNG', frequency:10, distance:'', duration:'', fare:'', status:'active', from:'', to:'' };
  if (id) route = { ...route, ...db.findById('routes', id) };

  routeTitle.textContent = id ? 'Edit Route' : 'Add New Route';
  routeForm.innerHTML = `
    <div class="form-2col">
      <div class="form-row">
        <label>Route Number</label>
        <input id="rf-number" value="${route.number}" placeholder="e.g. 423">
      </div>
      <div class="form-row">
        <label>Bus Type</label>
        <select id="rf-type" class="form-input">
          ${['Standard CNG','Low Floor AC','Electric EV','Express'].map(t =>
            `<option value="${t}" ${route.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Route Name</label>
      <input id="rf-name" value="${route.name}" placeholder="From → To">
    </div>
    <div class="form-2col">
      <div class="form-row">
        <label>From Stop</label>
        <select id="rf-from" class="form-input">
          ${stops.map(s => `<option value="${s.id}" ${route.from===s.id?'selected':''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>To Stop</label>
        <select id="rf-to" class="form-input">
          ${stops.map(s => `<option value="${s.id}" ${route.to===s.id?'selected':''}>${s.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-2col">
      <div class="form-row">
        <label>Frequency (min)</label>
        <input id="rf-freq" type="number" value="${route.frequency}">
      </div>
      <div class="form-row">
        <label>Distance (km)</label>
        <input id="rf-dist" type="number" value="${route.distance}" step="0.1">
      </div>
    </div>
    <div class="form-2col">
      <div class="form-row">
        <label>Duration (min)</label>
        <input id="rf-dur" type="number" value="${route.duration}">
      </div>
      <div class="form-row">
        <label>Fare (₹)</label>
        <input id="rf-fare" type="number" value="${route.fare}">
      </div>
    </div>
    <div class="form-row">
      <label>Status</label>
      <select id="rf-status" class="form-input">
        ${['active','delayed','suspended'].map(s => `<option value="${s}" ${route.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <button class="btn-login" onclick="saveRoute()">💾 Save Route</button>
  `;
  openModal('routeModal');
}

function saveRoute() {
  if (!state.isAdmin) { showToast('Please login as admin to manage routes','error'); return; }

  const from = document.getElementById('rf-from')?.value;
  const to = document.getElementById('rf-to')?.value;
  const data = {
    number:   document.getElementById('rf-number')?.value.trim(),
    name:     document.getElementById('rf-name')?.value.trim(),
    type:     document.getElementById('rf-type')?.value,
    from,
    to,
    frequency:+document.getElementById('rf-freq')?.value,
    distance: +document.getElementById('rf-dist')?.value,
    duration: +document.getElementById('rf-dur')?.value,
    fare:     +document.getElementById('rf-fare')?.value,
    status:   document.getElementById('rf-status')?.value,
    stops:    [from, to].filter(Boolean),
  };

  if (!data.number || !data.name) { showToast('Route number and name are required','error'); return; }
  if (!data.from || !data.to) { showToast('Please select both stops','error'); return; }
  if (data.from === data.to) { showToast('From and To stops must be different','error'); return; }

  const routeId = 'R' + data.number;
  const duplicateRoute = db.findAll('routes').find(r =>
    r.number === data.number && r.id !== state.editingRouteId
  );
  if (duplicateRoute || (!state.editingRouteId && db.findById('routes', routeId))) {
    showToast('Route number already exists','error');
    return;
  }

  if (state.editingRouteId) {
    db.update('routes', state.editingRouteId, data);
    showToast('Route updated successfully ✓','success');
  } else {
    db.insert('routes', { id: routeId, ...data });
    showToast('Route added successfully ✓','success');
  }

  closeModal('routeModal');
  refreshEditableViews();
}

function deleteRoute(id) {
  if (!state.isAdmin) { showToast('Please login as admin to manage routes','error'); return; }
  if (!confirm('Delete this route? This cannot be undone.')) return;
  db.delete('routes', id);
  if (state.scheduleRoute === id) {
    state.scheduleRoute = db.findAll('routes')[0]?.id || null;
  }
  showToast('Route deleted','info');
  refreshEditableViews();
}

// ─── Schedule ──────────────────────────────────────────────────────
function initSchedule() {
  renderScheduleList();
  renderSchedulePanel(state.scheduleRoute);

  document.querySelectorAll('.schedule-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.schedule-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.scheduleDay = tab.dataset.day;
      renderSchedulePanel(state.scheduleRoute);
    });
  });
}

function renderScheduleList() {
  const list = document.getElementById('scheduleRouteList');
  if (!list) return;
  const routes = db.findAll('routes');
  list.innerHTML = routes.map(r => `
    <div class="schedule-route-item ${r.id === state.scheduleRoute ? 'active' : ''}" onclick="selectScheduleRoute('${r.id}')">
      <div class="srn">${r.number}</div>
      <div>
        <div class="srname">${r.name}</div>
      </div>
    </div>
  `).join('');
}

function selectScheduleRoute(id) {
  state.scheduleRoute = id;
  renderScheduleList();
  renderSchedulePanel(id);
}

function renderSchedulePanel(routeId) {
  const route = db.findById('routes', routeId);
  if (!route) {
    const titleEl = document.getElementById('schedulePanelTitle');
    const subEl = document.getElementById('schedulePanelSub');
    const southbound = document.getElementById('schedSouthbound');
    const northbound = document.getElementById('schedNorthbound');
    if (titleEl) titleEl.textContent = 'No route selected';
    if (subEl) subEl.textContent = 'Add a route to generate schedule slots.';
    if (southbound) southbound.innerHTML = '';
    if (northbound) northbound.innerHTML = '';
    return;
  }

  const titleEl = document.getElementById('schedulePanelTitle');
  const subEl   = document.getElementById('schedulePanelSub');
  if (titleEl) titleEl.textContent = `Route ${route.number} — ${route.name}`;
  if (subEl)   subEl.textContent   = `Frequency: Every ${route.frequency}–${route.frequency + 4} minutes during peak hours`;

  const typeClass = {
    'Standard CNG': 'type-cng', 'Low Floor AC': 'type-ac',
    'Electric EV': 'type-ev', 'Express': 'type-exp'
  };
  const tClass = typeClass[route.type] || 'type-cng';

  const southbound = document.getElementById('schedSouthbound');
  const northbound = document.getElementById('schedNorthbound');

  const slots = [];
  const startH = state.scheduleDay === 'weekends' ? 6 : 5;
  const endH   = state.scheduleDay === 'weekends' ? 22 : 23;
  const freq   = route.frequency;
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += freq) {
      const depH = h, depM = m;
      const arrTotal = depH * 60 + depM + route.duration;
      const arrH = Math.floor(arrTotal / 60) % 24;
      const arrM = arrTotal % 60;
      slots.push({
        dep: `${String(depH).padStart(2,'0')}:${String(depM).padStart(2,'0')}`,
        arr: `${String(arrH).padStart(2,'0')}:${String(arrM).padStart(2,'0')}`,
      });
    }
  }

  const renderSlots = (list) => list.map(s => `
    <div class="time-slot">
      <div class="time-slot-time">${s.dep}</div>
      <div class="time-slot-arr">→ ${s.arr}</div>
      <span class="time-slot-type ${tClass}">${route.type.split(' ')[0]}</span>
    </div>
  `).join('');

  const half = Math.ceil(slots.length / 2);
  if (southbound) southbound.innerHTML = renderSlots(slots.slice(0, half));
  if (northbound) northbound.innerHTML = renderSlots(slots.slice(half));
}

// ─── Fleet ──────────────────────────────────────────────────────────
function initFleet() {
  renderFleetSummary();
  renderBusTable('');

  document.getElementById('busSearch')?.addEventListener('input', e => {
    state.fleetFilter = e.target.value;
    renderBusTable(state.fleetFilter);
  });
}

function renderFleetSummary() {
  const breakdown = db.getFleetBreakdown();
  const buses = db.findAll('buses');
  const total = buses.length;

  const cards = [
    { type: 'Electric EV',  icon: '⚡', cls: 'fp-green',  label: 'Zero-emission modern fleet' },
    { type: 'Low Floor AC', icon: '❄️', cls: 'fp-blue',   label: 'Premium air-conditioned buses' },
    { type: 'Standard CNG', icon: '🚌', cls: 'fp-orange', label: 'Primary commuter fleet' },
    { type: 'Express',      icon: '🚀', cls: 'fp-purple', label: 'Limited stop premium service' },
  ];

  const wrap = document.getElementById('fleetSummary');
  if (!wrap) return;
  wrap.innerHTML = cards.map(c => {
    const count = breakdown[c.type] || 0;
    const operational = db.find('buses', b => b.type === c.type && b.status === 'operational').length;
    const pct = count ? Math.round(operational / count * 100) : 0;
    return `<div class="fleet-card">
      <div class="fleet-icon">${c.icon}</div>
      <div class="fleet-type">${c.type}</div>
      <div class="fleet-count">${count.toLocaleString()}</div>
      <div class="fleet-desc">${c.label}</div>
      <div class="fleet-progress"><div class="fleet-progress-fill ${c.cls}" style="width:${pct}%"></div></div>
      <div class="fleet-pct">${pct}% operational today</div>
    </div>`;
  }).join('');
}

function renderBusTable(filter) {
  const tbody = document.getElementById('busTableBody');
  if (!tbody) return;

  let buses = db.findAll('buses');
  if (filter) {
    const f = filter.toLowerCase();
    buses = buses.filter(b =>
      b.regNo.toLowerCase().includes(f) ||
      b.type.toLowerCase().includes(f) ||
      b.depot.toLowerCase().includes(f) ||
      b.model.toLowerCase().includes(f)
    );
  }
  buses = buses.slice(0, 20);

  const typeClass = { 'Electric EV':'type-ev','Low Floor AC':'type-ac','Standard CNG':'type-cng','Express':'type-exp' };
  tbody.innerHTML = buses.map(b => {
    const opColor = b.status === 'operational' ? '#00C896' : '#F59E0B';
    const fuelCls = b.fuelLevel > 50 ? 'occ-low' : b.fuelLevel > 20 ? 'occ-mid' : 'occ-high';
    return `<tr>
      <td><span class="bus-reg">${b.regNo}</span></td>
      <td>
        <span class="time-slot-type ${typeClass[b.type] || 'type-cng'}">${b.type}</span>
      </td>
      <td style="font-size:13px;color:var(--text2)">${b.model}</td>
      <td style="font-size:13px;color:var(--text2)">${b.depot}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:6px">
          <span class="bus-status-dot" style="background:${opColor};box-shadow:0 0 6px ${opColor}"></span>
          <span style="font-size:13px">${b.status}</span>
        </span>
      </td>
      <td>
        <div style="font-size:12px;color:var(--text2);margin-bottom:3px">${b.fuelLevel}%</div>
        <div class="occ-bar" style="width:50px"><div class="occ-fill ${fuelCls}" style="width:${b.fuelLevel}%"></div></div>
      </td>
      <td style="font-size:13px;color:var(--text2)">${b.lastService}</td>
      ${state.isAdmin ? `<td>
        <button class="btn-outline" style="font-size:11px;padding:4px 8px" onclick="toggleBusStatus('${b.id}')">Toggle</button>
      </td>` : '<td></td>'}
    </tr>`;
  }).join('');
}

function toggleBusStatus(id) {
  if (!state.isAdmin) { showToast('Admin access required','error'); return; }
  const bus = db.findById('buses', id);
  if (!bus) return;
  const newStatus = bus.status === 'operational' ? 'maintenance' : 'operational';
  db.update('buses', id, { status: newStatus });
  renderBusTable(state.fleetFilter);
  renderFleetSummary();
  showToast(`Bus ${bus.regNo} → ${newStatus}`, 'info');
}

// ─── Analytics ────────────────────────────────────────────────────
function initAnalytics() {
  renderBarChart();
  renderDonut();
}

function renderBarChart() {
  const canvas = document.getElementById('ridershipChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = db.getWeeklyRidership();
  const W = canvas.offsetWidth || 580, H = 220;
  canvas.width = W; canvas.height = H;

  const max = Math.max(...data.map(d => d.passengers));
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = chartW / data.length * 0.6;
  const gap  = chartW / data.length;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(t => {
    const y = pad.top + chartH * (1 - t);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = 'rgba(155,168,188,0.7)';
    ctx.font = '10px IBM Plex Mono';
    ctx.textAlign = 'right';
    ctx.fillText((max * t / 100000).toFixed(0) + 'L', pad.left - 6, y + 4);
  });

  // Bars
  data.forEach((d, i) => {
    const barH = (d.passengers / max) * chartH;
    const x = pad.left + i * gap + (gap - barW) / 2;
    const y = pad.top + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#FF6B00');
    grad.addColorStop(1, 'rgba(255,107,0,0.3)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle = 'rgba(155,168,188,0.8)';
    ctx.font = '11px IBM Plex Sans';
    ctx.textAlign = 'center';
    ctx.fillText(d.day, x + barW / 2, H - pad.bottom + 16);
  });
}

function renderDonut() {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const breakdown = db.getFleetBreakdown();

  const data = [
    { label: 'Standard CNG', val: breakdown['Standard CNG'] || 0, color: '#FF6B00' },
    { label: 'Low Floor AC',  val: breakdown['Low Floor AC']  || 0, color: '#8B5CF6' },
    { label: 'Electric EV',   val: breakdown['Electric EV']   || 0, color: '#00C896' },
    { label: 'Express',       val: breakdown['Express']       || 0, color: '#F59E0B' },
  ];

  const total = data.reduce((s, d) => s + d.val, 0);
  const size = 140;
  canvas.width = size; canvas.height = size;
  const cx = size / 2, cy = size / 2, r = 55, ir = 35;

  let angle = -Math.PI / 2;
  data.forEach(d => {
    const slice = (d.val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    angle += slice;
  });

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, ir, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1929';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#E8EDF5';
  ctx.font = 'bold 16px IBM Plex Mono';
  ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 4);
  ctx.font = '9px IBM Plex Sans';
  ctx.fillStyle = 'rgba(155,168,188,0.7)';
  ctx.fillText('TOTAL', cx, cy + 16);

  // Legend
  const legend = document.getElementById('donutLegend');
  if (legend) {
    legend.innerHTML = data.map(d => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${d.color}"></span>
        <span class="legend-label">${d.label}</span>
        <span class="legend-val" style="color:${d.color}">${d.val}</span>
      </div>
    `).join('');
  }
}

// ─── Alerts ───────────────────────────────────────────────────────
function initAlerts() {
  renderAlerts();
  document.getElementById('btnNewAlert')?.addEventListener('click', () => {
    if (!state.isAdmin) { showToast('Admin access required','error'); return; }
    openAlertModal();
  });
}

function renderAlerts() {
  const list = document.getElementById('alertsList');
  if (!list) return;
  const alerts = db.find('alerts', a => a.active);

  const typeMap = {
    warning: 'at-warning', danger: 'at-danger', info: 'at-info', success: 'at-success'
  };

  list.innerHTML = alerts.map(a => `
    <div class="alert-card" id="alert-${a.id}">
      <div class="alert-icon">${a.icon}</div>
      <div class="alert-content">
        <div class="alert-title">${a.title}</div>
        <div class="alert-msg">${a.message}</div>
        <div class="alert-meta">
          <span class="alert-tag ${typeMap[a.type] || 'at-info'}">${a.severity?.toUpperCase() || 'INFO'}</span>
          <span style="font-size:11px;color:var(--text3)">${new Date(a.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
          ${a.routeId ? `<span style="font-size:11px;color:var(--primary);font-family:var(--font-mono)">${a.routeId}</span>` : ''}
        </div>
      </div>
      ${state.isAdmin ? `<button class="alert-dismiss" onclick="dismissAlert('${a.id}')">Dismiss</button>` : ''}
    </div>
  `).join('') || '<div style="color:var(--text3);padding:20px;text-align:center">No active alerts</div>';
}

function dismissAlert(id) {
  if (!state.isAdmin) { showToast('Admin access required','error'); return; }
  db.update('alerts', id, { active: false });
  const el = document.getElementById(`alert-${id}`);
  if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 300); }
  showToast('Alert dismissed','info');
}

function openAlertModal() {
  if (!state.isAdmin) { showToast('Admin access required','error'); return; }
  const alertForm = document.getElementById('alertForm');
  if (!alertForm) return;

  alertForm.innerHTML = `
    <div class="form-row">
      <label>Alert Type</label>
      <select id="al-type" class="form-input">
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="danger">Danger</option>
        <option value="success">Success</option>
      </select>
    </div>
    <div class="form-row">
      <label>Title</label>
      <input id="al-title" placeholder="Alert title">
    </div>
    <div class="form-row">
      <label>Message</label>
      <input id="al-msg" placeholder="Alert details">
    </div>
    <div class="form-2col">
      <div class="form-row">
        <label>Severity</label>
        <select id="al-sev" class="form-input">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div class="form-row">
        <label>Icon</label>
        <input id="al-icon" value="⚠️" style="font-size:20px">
      </div>
    </div>
    <button class="btn-login" onclick="saveAlert()">📢 Post Alert</button>
  `;
  openModal('alertModal');
}

function saveAlert() {
  if (!state.isAdmin) { showToast('Admin access required','error'); return; }

  const type = document.getElementById('al-type')?.value;
  const title = document.getElementById('al-title')?.value.trim();
  const message = document.getElementById('al-msg')?.value.trim();
  if (!title || !message) { showToast('Alert title and message are required','error'); return; }
  const icons = { info: 'ℹ️', warning: '⚠️', danger: '🚨', success: '✅' };
  db.insert('alerts', {
    type,
    icon: document.getElementById('al-icon')?.value || icons[type],
    title,
    message,
    severity: document.getElementById('al-sev')?.value,
    active: true,
    routeId: null,
  });
  closeModal('alertModal');
  renderAlerts();
  showToast('Alert posted successfully ✓','success');
}

// ─── Search ───────────────────────────────────────────────────────
function initSearch() {
  document.getElementById('btnSearch')?.addEventListener('click', doSearch);
  document.getElementById('searchFrom')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

function doSearch() {
  const from = document.getElementById('searchFrom')?.value.toLowerCase();
  const to   = document.getElementById('searchTo')?.value.toLowerCase();
  const type = document.getElementById('searchType')?.value;

  const stops = db.findAll('stops');
  const routes = db.findAll('routes');

  let results = routes.filter(r => {
    if (type && type !== 'All Types' && r.type !== type) return false;
    if (!from && !to) return true;

    const fromStop = stops.find(s => s.name.toLowerCase().includes(from));
    const toStop   = stops.find(s => s.name.toLowerCase().includes(to));

    if (fromStop && r.stops.includes(fromStop.id)) return true;
    if (toStop && r.stops.includes(toStop.id)) return true;
    if (!from && !to) return true;
    return r.name.toLowerCase().includes(from) || r.name.toLowerCase().includes(to);
  });

  const wrap = document.getElementById('searchResults');
  if (!wrap) return;
  wrap.style.display = 'block';

  if (results.length === 0) {
    wrap.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px">No routes found. Try different stops.</div>';
    return;
  }

  wrap.innerHTML = results.slice(0, 4).map(r => {
    const cls = r.status === 'active' ? 'status-on-time' : 'status-delayed';
    return `<div class="search-result-item">
      <div>
        <div class="search-result-route">Route ${r.number}</div>
        <div class="search-result-info">${r.name} · Every ${r.frequency} min · ₹${r.fare}</div>
      </div>
      <span class="search-result-status ${cls}">${r.status}</span>
    </div>`;
  }).join('');
}

// ─── Modals ────────────────────────────────────────────────────────
function initModals() {
  // Admin login
  document.querySelector('.btn-admin')?.addEventListener('click', () => {
    if (state.isAdmin) { logoutAdmin(); return; }
    openModal('adminModal');
  });
  document.getElementById('btnAdminLogin')?.addEventListener('click', handleAdminLogin);
  document.getElementById('adminUser')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdminLogin(); });
  document.getElementById('adminPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdminLogin(); });

  // Close buttons
  document.querySelectorAll('.modal-close[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Click outside to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id.replace(/Overlay$/, ''));
    });
  });
}

function openModal(id) {
  const overlay = document.getElementById(id + 'Overlay') || document.getElementById(id);
  if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const overlay = document.getElementById(id + 'Overlay') || document.getElementById(id);
  if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
}

function refreshEditableViews() {
  renderRoutes();
  renderTicketRoutes();
  renderFareEditor();
  updateTicketSummary();
  renderScheduleList();
  renderSchedulePanel(state.scheduleRoute);
  renderFleetSummary();
  renderBusTable(state.fleetFilter || '');
  renderAlerts();
}

function handleAdminLogin() {
  const user = document.getElementById('adminUser')?.value;
  const pass = document.getElementById('adminPass')?.value;

  if (user === 'admin' && pass === 'dtc2024') {
    state.isAdmin = true;
    closeModal('adminModal');
    document.querySelector('.btn-admin').textContent = '🔓 Admin';
    document.getElementById('adminBar').classList.add('visible');
    showToast('Welcome, Administrator ✓','success');
    refreshEditableViews();
  } else {
    showToast('Invalid credentials. Use admin / dtc2024','error');
    const input = document.getElementById('adminPass');
    if (input) { input.style.borderColor = 'var(--red)'; setTimeout(() => input.style.borderColor = '', 1500); }
  }
}

function logoutAdmin() {
  state.isAdmin = false;
  document.querySelector('.btn-admin').textContent = '🔐 Admin Login';
  document.getElementById('adminBar').classList.remove('visible');
  showToast('Logged out','info');
  refreshEditableViews();
}

// ─── Toast Notifications ──────────────────────────────────────────
function showToast(msg, type = 'info') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${msg}`;
  wrap.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

// ─── Mobile Menu ─────────────────────────────────────────────────
function initMobileMenu() {
  const ham = document.querySelector('.hamburger');
  const links = document.querySelector('.nav-links');
  ham?.addEventListener('click', () => {
    const isOpen = links?.classList.toggle('open');
    ham.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  links?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      ham?.setAttribute('aria-expanded', 'false');
    });
  });
}

// ─── Live Updates ─────────────────────────────────────────────────
function startLiveUpdates() {
  // Refresh departure board every 30s
  state.depInterval = setInterval(() => {
    // Randomly update occupancy and status
    const deps = db.findAll('departures');
    deps.forEach(d => {
      const occ = Math.max(0, Math.min(100, d.occupancy + (Math.random() * 10 - 5)));
      db.update('departures', d.id, { occupancy: Math.round(occ) });
    });
    renderDepartures(state.activeTab);
  }, 30000);
}

// ─── Expose globals for inline handlers ──────────────────────────
window.openRouteModal  = openRouteModal;
window.saveRoute       = saveRoute;
window.deleteRoute     = deleteRoute;
window.toggleBusStatus = toggleBusStatus;
window.dismissAlert    = dismissAlert;
window.saveAlert       = saveAlert;
window.selectScheduleRoute = selectScheduleRoute;
window.selectTicketRoute = selectTicketRoute;
window.logoutAdmin     = logoutAdmin;
