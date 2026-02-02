// --- 1. Mock Data (Simulated Database) ---
let routes = [
    { id: '534', source: 'Anand Vihar', dest: 'Nehru Place', dist: 18 },
    { id: 'RL-77', source: 'New Delhi Stn', dest: 'Dwarka Sec-21', dist: 24 },
    { id: '419', source: 'Kashmere Gate', dest: 'Lajpat Nagar', dist: 14 }
];

let buses = [
    { id: 'DL-1PC-4022', type: 'AC', status: 'Available' },
    { id: 'DL-1PC-9921', type: 'Non-AC', status: 'Available' },
    { id: 'DL-1PC-3301', type: 'AC', status: 'Maintenance' },
    { id: 'DL-1PC-5567', type: 'AC', status: 'Available' },
    { id: 'DL-1PC-1102', type: 'Electric', status: 'Available' }
];

// --- 2. Navigation Logic ---
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    // Show selected
    document.getElementById(sectionId).classList.remove('hidden');
    
    // Update active nav state
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-green-50', 'text-dtc-green', 'font-semibold');
        el.classList.add('text-gray-600');
    });
    // Highlight the clicked item (event must be passed or captured)
    // Note: We access the clicked element using 'event.currentTarget' inside the inline onclick in HTML
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('bg-green-50', 'text-dtc-green', 'font-semibold');
        event.currentTarget.classList.remove('text-gray-600');
    }
    
    closeSidebarOnMobile();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('absolute'); // For mobile overlay behavior
    sidebar.classList.toggle('h-full');
}

function closeSidebarOnMobile() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth < 768 && !sidebar.classList.contains('hidden')) {
        sidebar.classList.add('hidden');
    }
}

// --- 3. Dashboard Logic ---
function renderDashboard() {
    const tbody = document.getElementById('live-status-body');
    if (!tbody) return; // Guard clause
    
    tbody.innerHTML = '';
    
    // Show first 4 buses
    buses.slice(0, 4).forEach(bus => {
        const statusColor = bus.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
        const row = `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-4 font-mono font-bold">${bus.id}</td>
                <td class="p-4">${bus.status === 'Available' ? 'Depot (Waiting)' : 'In Transit'}</td>
                <td class="p-4 text-gray-500">Unassigned</td>
                <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusColor}">${bus.status}</span></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

    // Update Stats
    document.getElementById('total-routes').innerText = routes.length;
    document.getElementById('total-buses').innerText = buses.length;
}

// --- 4. Route Logic ---
function renderRoutes() {
    const tbody = document.getElementById('route-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    routes.forEach((r, index) => {
        const row = `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-4 font-bold text-dtc-green">${r.id}</td>
                <td class="p-4">${r.source} <i class="fas fa-arrow-right text-xs mx-2 text-gray-400"></i> ${r.dest}</td>
                <td class="p-4">${r.dist} km</td>
                <td class="p-4">
                    <button onclick="deleteRoute(${index})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function handleAddRoute(e) {
    e.preventDefault();
    const newRoute = {
        id: document.getElementById('route-id').value,
        source: document.getElementById('route-source').value,
        dest: document.getElementById('route-dest').value,
        dist: document.getElementById('route-dist').value
    };
    routes.push(newRoute);
    renderRoutes();
    renderDashboard(); // Update stats
    e.target.reset();
    alert('Route Added Successfully!');
}

function deleteRoute(index) {
    if(confirm('Delete this route config?')) {
        routes.splice(index, 1);
        renderRoutes();
        renderDashboard();
    }
}

// --- 5. Auto-Scheduler Logic ---
function runAutoScheduler() {
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';
    
    const availableBuses = buses.filter(b => b.status === 'Available');
    
    if (availableBuses.length === 0) {
        alert('No available buses to schedule!');
        return;
    }

    // Algorithm: Round-robin assignment
    let busIndex = 0;
    const times = ['08:00 AM', '08:30 AM', '09:00 AM', '09:15 AM'];

    routes.forEach((route, i) => {
        if (busIndex < availableBuses.length) {
            const bus = availableBuses[busIndex];
            const time = times[i % times.length]; // Cycle times
            
            const row = `
                <tr class="border-b hover:bg-gray-50 animate-pulse-once">
                    <td class="p-4 font-mono">${time}</td>
                    <td class="p-4 font-bold">${bus.id} <span class="text-xs text-gray-400 ml-2">(${bus.type})</span></td>
                    <td class="p-4 text-dtc-green font-semibold">Route ${route.id} (${route.source} to ${route.dest})</td>
                    <td class="p-4"><span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Scheduled</span></td>
                </tr>
            `;
            tbody.innerHTML += row;
            busIndex++;
        }
    });
    
    // Handle overflow if more routes than buses
    if (routes.length > availableBuses.length) {
        const pendingRow = `<tr><td colspan="4" class="p-4 text-center text-red-500 font-bold">Warning: ${routes.length - availableBuses.length} routes pending (Insufficient Fleet)</td></tr>`;
        tbody.innerHTML += pendingRow;
    }
}

// --- 6. Initialization ---
// Wait for DOM to load before rendering
document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
    renderRoutes();
});