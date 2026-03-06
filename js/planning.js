/* ============================================================
   PLANNING.JS — Planning / Calendrier
   ============================================================ */

// State
let planningCurrentDate = new Date();
let planningView = 'week';

const HOURS_START = 0;
const HOURS_END = 24;
const SLOT_HEIGHT = 48; // px per hour

function setPlanningView(view) {
    planningView = view;
    document.getElementById('viewWeekBtn').classList.toggle('active', view === 'week');
    document.getElementById('viewDayBtn').classList.toggle('active', view === 'day');
    document.getElementById('viewMonthBtn').classList.toggle('active', view === 'month');
    renderPlanning(true);
}

function planningNav(dir) {
    if (planningView === 'week') {
        planningCurrentDate = addDays(planningCurrentDate, dir * 7);
    } else if (planningView === 'month') {
        planningCurrentDate = new Date(planningCurrentDate.getFullYear(), planningCurrentDate.getMonth() + dir, 1);
    } else {
        planningCurrentDate = addDays(planningCurrentDate, dir);
    }
    renderPlanning();
}

function planningGoToday() {
    planningCurrentDate = new Date();
    renderPlanning(true);
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

// ===== RENDER =====
function renderPlanning(forceScroll = false) {
    const container = document.getElementById('planningContainer');
    if (!container) return;

    // Sauvegarder le scroll actuel si on ne force pas le scroll à l'heure actuelle
    let currentScroll = 0;
    const oldGrid = container.querySelector('.week-grid, .day-grid');
    if (oldGrid && !forceScroll) {
        currentScroll = oldGrid.scrollTop;
    }

    if (planningView === 'week') renderWeek(container);
    else if (planningView === 'month') renderMonth(container);
    else renderDay(container);

    // Restaurer ou forcer le scroll
    if (planningView !== 'month') {
        const newGrid = container.querySelector('.week-grid, .day-grid');
        if (newGrid) {
            if (forceScroll) {
                setTimeout(() => scrollToCurrentTime(), 50);
            } else if (currentScroll > 0) {
                newGrid.scrollTop = currentScroll;
            }
        }
    }
}

function scrollToCurrentTime() {
    const grid = document.querySelector('.week-grid, .day-grid');
    if (!grid) return;
    const now = new Date();
    const minutesFromStart = (now.getHours() - HOURS_START) * 60 + now.getMinutes();
    const scrollTarget = (minutesFromStart / 60) * SLOT_HEIGHT - 80;
    grid.scrollTop = Math.max(0, scrollTarget);
}

// ===== WEEK VIEW =====
function renderWeek(container) {
    const monday = getMonday(planningCurrentDate);
    const today = getTodayStr();

    // Label période
    const sunday = addDays(monday, 6);
    const moisFr = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    document.getElementById('planningPeriod').textContent =
        `${monday.getDate()} ${moisFr[monday.getMonth()]} — ${sunday.getDate()} ${moisFr[sunday.getMonth()]} ${sunday.getFullYear()}`;

    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(monday, i));
    const joursFr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    const totalHours = HOURS_END - HOURS_START;
    const gridH = totalHours * SLOT_HEIGHT;
    const maxH = `min(calc(100vh - 220px), ${gridH + 52}px)`;

    // CSS Grid : 8 colonnes (heures + 7 jours), 2 lignes (header + body)
    let html = `<div class="week-grid" style="
        display: grid;
        grid-template-columns: 56px repeat(7, 1fr);
        grid-template-rows: auto 1fr;
        height: ${maxH};
        overflow-y: auto;
        position: relative;
        border-top: 1px solid var(--border);
    ">`;

    // ── Cellule coin (haut-gauche) ──
    html += `<div style="
        position: sticky; top: 0; z-index: 25;
        background: var(--bg-card2);
        border-right: 1px solid var(--border);
        border-bottom: 2px solid var(--border);
        grid-column: 1; grid-row: 1;
    "></div>`;

    const holidays = getFrenchPublicHolidays(planningCurrentDate.getFullYear());

    // ── En-têtes des jours (sticky au top) ──
    days.forEach((d, i) => {
        const dateStr = toDateStr(d);
        const isToday = dateStr === today;
        const isSunday = d.getDay() === 0;
        const isHoliday = holidays.includes(dateStr);
        const isOff = isSunday || isHoliday;

        html += `<div class="week-day-header ${isToday ? 'today' : ''} ${isOff ? 'off-day' : ''}" style="
            position: sticky; top: 0; z-index: 24;
            grid-column: ${i + 2}; grid-row: 1;
        ">
            <div class="week-day-name">${joursFr[i]}</div>
            <div class="week-day-number">${d.getDate()}</div>
        </div>`;
    });

    // ── Colonne des heures ──
    html += `<div style="
        grid-column: 1; grid-row: 2;
        border-right: 1px solid var(--border);
        height: ${gridH}px;
        position: relative;
    ">`;
    for (let h = HOURS_START; h < HOURS_END; h++) {
        html += `<div class="time-slot-label">${pad(h)}h</div>`;
    }
    html += `</div>`;

    // ── Colonnes des jours ──
    days.forEach((d, di) => {
        const dateStr = toDateStr(d);
        const isToday = dateStr === today;
        const isSunday = d.getDay() === 0;
        const isHoliday = holidays.includes(dateStr);
        const isOff = isSunday || isHoliday;

        html += `<div class="planning-column ${isOff ? 'off-day' : ''}" 
            ondragover="onPlanningDragOver(event)" 
            ondragleave="onPlanningDragLeave(event)"
            ondrop="onPlanningDrop(event, '${dateStr}')"
            style="
            grid-column: ${di + 2}; grid-row: 2;
            position: relative;
            height: ${gridH}px;
            border-right: 1px solid rgba(255,255,255,0.04);
            ${isToday ? 'background: rgba(79,114,196,0.03);' : ''}
            ${isOff ? 'background: var(--bg-card2);' : ''}
        ">
            <div class="planning-drag-preview"></div>`;

        // Slots cliquables
        for (let h = HOURS_START; h < HOURS_END; h++) {
            const hStr = pad(h) + ':00';
            html += `<div class="week-slot" style="height:${SLOT_HEIGHT}px;"
                onclick="openSeanceModal(null, null, '${dateStr}'); document.getElementById('seanceHeure').value='${hStr}';">
            </div>`;
        }

        // Événements
        const seancesDay = DB.getSeances().filter(s => s.date === dateStr && s.statut !== 'annulee');
        seancesDay.forEach(s => {
            const [hh, mm] = (s.heure || '08:00').split(':').map(Number);
            const topPx = ((hh - HOURS_START) + mm / 60) * SLOT_HEIGHT;
            const height = Math.max(((s.duree || 45) / 60) * SLOT_HEIGHT, 28);
            const cls = `event-${s.statut}`;
            html += `<div class="planning-event ${cls}"
                draggable="true" ondragstart="onEventDragStart(event, '${s.id}')" ondragend="onEventDragEnd(event)"
                style="top:${topPx}px; height:${height}px;"
                onclick="event.stopPropagation(); openSeanceModal('${s.id}')"
                title="${getPatientName(s.patientId)} — ${s.type || 'Séance'} — ${s.heure}">
                <div class="event-time">${s.heure}</div>
                <div class="event-name">${getPatientName(s.patientId)}</div>
            </div>`;
        });

        html += `</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// ===== DAY VIEW =====
function renderDay(container) {
    const today = getTodayStr();
    const dateStr = toDateStr(planningCurrentDate);
    const moisFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const joursFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    document.getElementById('planningPeriod').textContent =
        `${joursFr[planningCurrentDate.getDay()]} ${planningCurrentDate.getDate()} ${moisFr[planningCurrentDate.getMonth()]} ${planningCurrentDate.getFullYear()}`;

    const gridH = (HOURS_END - HOURS_START) * SLOT_HEIGHT + 44;
    let html = `<div class="day-grid" style="display:flex; height:min(calc(100vh - 220px), ${gridH}px); overflow-y:auto;">`;

    // Colonne des heures
    html += `<div style="width:56px; flex-shrink:0; border-right:1px solid var(--border);">
    <div style="height:44px; border-bottom:1px solid var(--border);"></div>`;
    for (let h = HOURS_START; h < HOURS_END; h++) {
        html += `<div class="time-slot-label">${pad(h)}h</div>`;
    }
    html += `</div>`;

    // Colonne du jour
    const isToday = dateStr === today;
    const isSunday = planningCurrentDate.getDay() === 0;
    const holidays = getFrenchPublicHolidays(planningCurrentDate.getFullYear());
    const isHoliday = holidays.includes(dateStr);
    const isOff = isSunday || isHoliday;

    html += `<div ondragover="onPlanningDragOver(event)" 
        ondragleave="onPlanningDragLeave(event)"
        ondrop="onPlanningDrop(event, '${dateStr}')" 
        style="flex:1; position:relative; ${isOff ? 'background: var(--bg-card2);' : ''}">
    <div class="planning-drag-preview"></div>
    <div class="week-day-header ${isToday ? 'today' : ''} ${isOff ? 'off-day' : ''}" style="position:sticky;top:0;z-index:20;background:var(--bg-card);border-bottom:1px solid var(--border);">
      <div class="week-day-name">${joursFr[planningCurrentDate.getDay()]}</div>
      <div class="week-day-number">${planningCurrentDate.getDate()}</div>
    </div>`;

    // Slots
    for (let h = HOURS_START; h < HOURS_END; h++) {
        const hStr = pad(h) + ':00';
        html += `<div class="week-slot" style="height:${SLOT_HEIGHT}px;"
      onclick="openSeanceModal(null, null, '${dateStr}'); document.getElementById('seanceHeure').value='${hStr}';">
    </div>`;
    }

    // Événements
    const seancesDay = DB.getSeances().filter(s => s.date === dateStr && s.statut !== 'annulee');
    seancesDay.forEach(s => {
        const [hh, mm] = (s.heure || '08:00').split(':').map(Number);
        const topPx = ((hh - HOURS_START) + mm / 60) * SLOT_HEIGHT + 44;
        const height = Math.max(((s.duree || 45) / 60) * SLOT_HEIGHT, 36);
        const cls = `event-${s.statut}`;
        html += `<div class="planning-event ${cls}"
      draggable="true" ondragstart="onEventDragStart(event, '${s.id}')" ondragend="onEventDragEnd(event)"
      style="top:${topPx}px; height:${height}px;"
      onclick="event.stopPropagation(); openSeanceModal('${s.id}')">
      <div class="event-time">${s.heure}</div>
      <div class="event-name">${getPatientName(s.patientId)}</div>
      <div class="event-time">${s.type || 'Séance'} · ${s.duree || 45} min</div>
    </div>`;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ===== UTILS =====
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=dim, 1=lun...
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    return d;
}

function toDateStr(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ===== MONTH VIEW =====
function renderMonth(container) {
    const firstDayOfMonth = new Date(planningCurrentDate.getFullYear(), planningCurrentDate.getMonth(), 1);

    const moisFrLong = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    document.getElementById('planningPeriod').textContent = `${moisFrLong[planningCurrentDate.getMonth()]} ${planningCurrentDate.getFullYear()}`;

    // On commence au lundi de la semaine contenant le 1er du mois
    const startDate = new Date(firstDayOfMonth);
    const dayOfWeek = startDate.getDay(); // 0=dim, 1=lun...
    const diff = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    startDate.setDate(startDate.getDate() + diff);

    const today = getTodayStr();
    const holidays = getFrenchPublicHolidays(planningCurrentDate.getFullYear());

    let html = `<div class="month-grid" style="
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        grid-template-rows: auto repeat(6, 1fr);
        min-height: min(calc(100vh - 220px), 800px);
        border-top: 1px solid var(--border);
    ">`;

    // Headers
    const joursFrCourt = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    joursFrCourt.forEach(j => {
        html += `<div style="padding: 10px; text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); background: var(--bg-card2);">
            ${j}
        </div>`;
    });

    let current = new Date(startDate);
    const seances = DB.getSeances().filter(s => s.statut !== 'annulee');

    // On affiche 6 semaines fixes pour garder un layout constant
    for (let i = 0; i < 42; i++) {
        const dateStr = toDateStr(current);
        const isToday = dateStr === today;
        const isCurrentMonth = current.getMonth() === planningCurrentDate.getMonth();
        const isSunday = current.getDay() === 0;
        const isHoliday = holidays.includes(dateStr);
        const isOff = isSunday || isHoliday;

        let cellStyle = `
            padding: 8px;
            border-bottom: 1px solid var(--border);
            border-right: 1px solid var(--border);
            min-height: 100px;
            position: relative;
            cursor: pointer;
            transition: background 0.1s;
            ${!isCurrentMonth ? 'opacity: 0.35;' : ''}
            ${isToday ? 'background: rgba(79,114,196,0.06);' : ''}
            ${isOff ? 'background: var(--bg-card2);' : ''}
        `;

        html += `<div style="${cellStyle}" 
            onclick="openSeanceModal(null, null, '${dateStr}')" 
            ondragover="event.preventDefault()"
            ondrop="onPlanningDrop(event, '${dateStr}')"
            class="month-day-cell">
            <div style="font-weight: ${isToday ? '800' : '600'}; color: ${isToday ? 'var(--primary-light)' : 'var(--text-muted)'}; font-size: 13px; margin-bottom: 6px; display:flex; justify-content: space-between; align-items: center;">
                <span>${current.getDate()}</span>
                ${isHoliday ? '<span style="font-size:9px; font-weight:400; font-style:italic;">Férié</span>' : ''}
            </div>`;

        // Séances du jour
        const daySeances = seances.filter(s => s.date === dateStr);
        daySeances.sort((a, b) => a.heure.localeCompare(b.heure));

        daySeances.forEach(s => {
            const cls = `event-${s.statut}`;
            html += `<div class="month-pill ${cls}" 
                draggable="true" ondragstart="onEventDragStart(event, '${s.id}')" ondragend="onEventDragEnd(event)"
                onclick="event.stopPropagation(); openSeanceModal('${s.id}')"
                style="font-size: 10px; padding: 2px 5px; margin-bottom: 2px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"
                title="${s.heure} - ${getPatientName(s.patientId)}">
                <strong>${s.heure}</strong> ${getPatientName(s.patientId)}
            </div>`;
        });

        html += `</div>`;
        current.setDate(current.getDate() + 1);
    }

    html += `</div>`;
    container.innerHTML = html;
}

function getFrenchPublicHolidays(year) {
    const holidays = [
        `${year}-01-01`, // Jour de l'an
        `${year}-05-01`, // Fête du travail
        `${year}-05-08`, // Victoire 1945
        `${year}-07-14`, // Fête nationale
        `${year}-08-15`, // Assomption
        `${year}-11-01`, // Toussaint
        `${year}-11-11`, // Armistice 1918
        `${year}-12-25`  // Noël
    ];

    // Calcul de Pâques (Algorithme de Meeus/Jones/Butcher)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    const easter = new Date(year, month - 1, day);

    const toStr = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const addDaysLocal = (date, n) => {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    };

    holidays.push(toStr(addDaysLocal(easter, 1)));  // Lundi de Pâques
    holidays.push(toStr(addDaysLocal(easter, 39))); // Ascension
    holidays.push(toStr(addDaysLocal(easter, 50))); // Lundi de Pentecôte

    return holidays;
}

// ===== DRAG & DROP HANDLERS =====

function onEventDragStart(e, seanceId) {
    e.dataTransfer.setData('seanceId', seanceId);
    e.dataTransfer.effectAllowed = 'move';

    // On masque l'image fantôme native du navigateur (le gros bloc bleu)
    // pour ne laisser que notre ligne orange magnétique bien visible.
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);

    const el = document.querySelector(`.planning-event[onclick*="${seanceId}"], .month-pill[onclick*="${seanceId}"]`);
    if (el) el.classList.add('dragging');
}

function onEventDragEnd(e) {
    document.querySelectorAll('.planning-event.dragging').forEach(el => el.classList.remove('dragging'));
}

function onPlanningDragOver(e) {
    e.preventDefault();
    const preview = e.currentTarget.querySelector('.planning-drag-preview');
    if (!preview) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let y = e.clientY - rect.top;
    if (planningView === 'day') y -= 44;

    const hoursFromStart = y / SLOT_HEIGHT;
    const totalMinutes = Math.round(hoursFromStart * 60);

    // Accroche : 15 minutes
    const SNAP = 15;
    const roundedMinutes = Math.round(totalMinutes / SNAP) * SNAP;

    const topPx = (roundedMinutes / 60) * SLOT_HEIGHT + (planningView === 'day' ? 44 : 0);

    let h = Math.floor(roundedMinutes / 60) + HOURS_START;
    let m = roundedMinutes % 60;
    if (m >= 60) { h += 1; m = 0; }
    h = Math.min(HOURS_END - 1, Math.max(HOURS_START, h));
    const timeStr = pad(h) + ':' + pad(m);

    preview.style.display = 'block';
    // Style de la ligne et du badge encore plus marqué
    preview.style.background = '#ff9800';
    preview.style.boxShadow = '0 0 15px #ff9800, 0 0 20px rgba(255,152,0,0.4)';
    preview.innerHTML = `<span style="position:absolute; top:-14px; left:50%; transform:translateX(-50%); background:#ff9800; color:white; padding:4px 12px; border-radius:30px; font-size:13px; font-weight:900; box-shadow:0 4px 12px rgba(0,0,0,0.5); white-space:nowrap; border:2.5px solid white; z-index:10000; text-shadow: 0 1px 2px rgba(0,0,0,0.3); pointer-events:none;">${timeStr}</span>`;

    preview.style.top = topPx + 'px';
}

function onPlanningDragLeave(e) {
    const preview = e.currentTarget.querySelector('.planning-drag-preview');
    if (preview) preview.style.display = 'none';
}

function onPlanningDrop(e, dateStr) {
    e.preventDefault();
    const seanceId = e.dataTransfer.getData('seanceId');
    if (!seanceId) return;

    const seance = DB.getSeanceById(seanceId);
    if (!seance) return;

    let newTime = seance.heure;

    // Masquer le preview
    const preview = e.currentTarget.querySelector('.planning-drag-preview');
    if (preview) preview.style.display = 'none';

    if (planningView !== 'month') {
        const rect = e.currentTarget.getBoundingClientRect();
        let y = e.clientY - rect.top;
        if (planningView === 'day') y -= 44;

        const hoursFromStart = y / SLOT_HEIGHT;
        const totalMinutes = Math.round(hoursFromStart * 60);

        // Accroche identique au visuel (15 min)
        const SNAP = 15;
        const roundedMinutes = Math.round(totalMinutes / SNAP) * SNAP;

        let h = Math.floor(roundedMinutes / 60) + HOURS_START;
        let m = roundedMinutes % 60;

        if (m >= 60) { h += 1; m = 0; }
        h = Math.max(HOURS_START, Math.min(HOURS_END - 1, h));
        newTime = pad(h) + ':' + pad(m);
    }

    if (seance.date === dateStr && seance.heure === newTime) {
        renderPlanning(); // Reset opacity
        return;
    }

    seance.date = dateStr;
    seance.heure = newTime;
    DB.updateSeance(seance);

    renderPlanning();
    renderDashboard();
    showToast('Séance déplacée.', 'success');
}
