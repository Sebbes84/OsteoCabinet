/* ============================================================
   APP.JS — Application core : navigation, utils, init
   ============================================================ */

const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
};

/**
 * Autocomplétion générique basée sur une liste de valeurs
 * @param {string} inputId - ID de l'élément input
 * @param {Function} getValuesFn - Fonction retournant le tableau de strings
 */
function initGlobalAutocomplete(inputId, getValuesFn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Supprimer l'ancien dropdown s'il existe
    let dropdown = input.parentNode.querySelector('.ac-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'ac-dropdown';
        dropdown.style.display = 'none';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
    }

    input.addEventListener('input', () => {
        const raw = input.value.trim();
        if (raw.length < 1) {
            dropdown.style.display = 'none';
            return;
        }

        const q = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const allValues = getValuesFn() || [];

        const suggestions = allValues
            .filter(v => {
                if (!v) return false;
                const vNorm = String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return vNorm.includes(q);
            });

        // Uniques, triées et limitées à 7
        const uniqueValues = [...new Set(suggestions)].sort().slice(0, 7);

        if (uniqueValues.length > 0) {
            dropdown.innerHTML = uniqueValues.map(v => {
                const escaped = v.replace(/'/g, "\\'").replace(/\n/g, "\\n");
                return `<div class="ac-item" onclick="const el=document.getElementById('${inputId}'); el.value = '${escaped}'; el.dispatchEvent(new Event('input')); this.parentNode.style.display='none';">
            <span class="ac-name">${v}</span>
          </div>`;
            }).join('');
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    });

    // Fermer si clic ailleurs
    document.addEventListener('mousedown', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// ===== THEME (MODE SOMBRE / CLAIR) =====
function applyTheme(mode) {
    const body = document.body;
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    if (mode === 'light') {
        body.classList.add('light-mode');
        if (icon) icon.textContent = '☀️';
        if (label) label.textContent = 'Mode clair';
    } else {
        body.classList.remove('light-mode');
        if (icon) icon.textContent = '🌙';
        if (label) label.textContent = 'Mode sombre';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-mode');
    const newMode = isLight ? 'dark' : 'light';
    localStorage.setItem('osteo_theme', newMode);
    applyTheme(newMode);
}

// Appliquer le thème sauvegardé dès que possible
(function () {
    const saved = localStorage.getItem('osteo_theme') || 'dark';
    applyTheme(saved);
})();

// ===== NAVIGATION =====
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');

    const navItem = document.querySelector(`.nav-item[data-page="${name}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = {
        dashboard: 'Tableau de bord',
        patients: 'Patients',
        planning: 'Planning',
        seances: 'Séances',
        facturation: 'Facturation',
        parametres: 'Paramètres',
        template: 'Éditeur de Template Facture'
    };
    document.getElementById('pageTitle').textContent = titles[name] || name;

    // Refresh data on page switch
    if (name === 'dashboard') renderDashboard();
    if (name === 'patients') renderPatients();
    if (name === 'seances') renderSeances();
    if (name === 'planning') renderPlanning(true);
    if (name === 'facturation') renderFactures();
    if (name === 'parametres') loadSettings();
}

// ===== MODALS =====
let _modalZBase = 1000;
let _modalZStep = 10;
let _modalStack = []; // pile des modales ouvertes

function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    // Attribuer un z-index supérieur à toutes les modales déjà ouvertes
    const z = _modalZBase + (_modalStack.length + 1) * _modalZStep;
    m.style.zIndex = z;
    m.classList.add('open');
    if (!_modalStack.includes(id)) _modalStack.push(id);
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    m.style.zIndex = '';
    _modalStack = _modalStack.filter(mid => mid !== id);

    // --- REFRESH LOGIC ---
    // Si on ferme la facture et que la séance est toujours ouverte dessous, on rafraîchit la séance
    if (id === 'modalFacture' && _modalStack.includes('modalSeance')) {
        const sId = document.getElementById('seanceId')?.value;
        const statusStr = document.getElementById('seanceStatut')?.value;
        if (sId && typeof setSeanceStatus === 'function') {
            setSeanceStatus(statusStr || 'planifiee');
        }
    }
}

// Désactivé à la demande de l'utilisateur : on ne ferme plus au clic extérieur
// document.querySelectorAll('.modal-overlay').forEach(overlay => {
//     overlay.addEventListener('click', e => {
//         if (e.target === overlay) {
//             closeModal(overlay.id);
//         }
//     });
// });

// ===== TABS =====
function switchTab(tabId, btn) {
    const parent = btn.closest('.modal') || btn.closest('.page');
    if (!parent) return;
    parent.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
    btn.classList.add('active');
}

// ===== TOAST =====
function showToast(msg, type = 'success', duration = 3500) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== DATE / DATETIME =====
function updateClock() {
    const now = new Date();
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const str = `${jours[now.getDay()]} ${now.getDate()} ${mois[now.getMonth()]} ${now.getFullYear()} — ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const el = document.getElementById('currentDatetime');
    if (el) el.textContent = str;
}
setInterval(updateClock, 1000);
updateClock();

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateLong(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatNombre(v) {
    if (v === undefined || v === null || v === '') return '0';
    return new Intl.NumberFormat('fr-FR').format(v);
}

function formatMontant(v) {
    if (v === undefined || v === null || v === '') return '—';
    const val = parseFloat(v);
    if (isNaN(val)) return '—';
    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val) + ' €';
}

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ===== PATIENT NAME FORMATTING =====
function formatNom(nom) {
    if (!nom) return '';
    return nom.trim().toUpperCase();
}

function formatPrenom(prenom) {
    if (!prenom) return '';
    const clean = prenom.trim().toLowerCase();
    // Gère les noms composés avec espace ou tiret (ex: jean-marie -> Jean-Marie)
    return clean.split(/([\s-])/).map(part => {
        if (part === ' ' || part === '-') return part;
        return part.charAt(0).toUpperCase() + part.substring(1);
    }).join('');
}

/**
 * Retourne le libellé personnalisé d'un statut de facture (défini dans les paramètres)
 * @param {string} status 
 * @returns {string}
 */
function getFactureStatusLabel(status) {
    const s = DB.getSettings();
    if (status === 'payee') return s.labelPayee || 'Acquittée';
    if (status === 'emise') return s.labelEmise || 'Émise';
    return status || '';
}

/**
 * Retourne le libellé lisible d'un statut de séance
 * @param {string} status 
 * @returns {string}
 */
function getSeanceStatusLabel(status) {
    const labels = {
        'planifiee': 'Planifiée',
        'realisee': 'Réalisée',
        'annulee': 'Annulée'
    };
    return labels[status] || status;
}

// ===== PATIENT NAME HELPER =====
function getPatientName(patientId) {
    const p = DB.getPatientById(patientId);
    if (!p) return '(patient supprimé)';
    return `${formatNom(p.nom)} ${formatPrenom(p.prenom)}`;
}

// ===== DASHBOARD =====
function renderDashboard() {
    const patients = DB.getPatients();
    const seances = DB.getSeances();
    const factures = DB.getFactures();
    const today = getTodayStr();
    const now = new Date();
    const mois = now.getMonth();
    const annee = now.getFullYear();

    // Stats
    document.getElementById('statPatients').textContent = formatNombre(patients.length);

    const seancesToday = seances.filter(s => s.date === today && s.statut !== 'annulee');
    document.getElementById('statSeancesAujourdhui').textContent = formatNombre(seancesToday.length);

    const dateStart = document.getElementById('dashDateStart')?.value || today.slice(0, 7) + '-01';
    const dateEnd = document.getElementById('dashDateEnd')?.value || today;

    const seancesPeriod = seances.filter(s => {
        if (!s.date) return false;
        return s.date >= dateStart && s.date <= dateEnd && s.statut !== 'annulee';
    });
    document.getElementById('statSeancesMois').textContent = formatNombre(seancesPeriod.length);

    const caPeriod = seancesPeriod
        .filter(s => s.statut === 'realisee')
        .reduce((sum, s) => sum + (parseFloat(s.montant) || 0), 0);
    document.getElementById('statCAMois').textContent = formatMontant(caPeriod);

    // Prochaines séances / Derniers patients
    const toggleDash = document.getElementById('dashSeancesToggle');
    const seancesViewMode = toggleDash ? toggleDash.value : 'last20';
    const upEl = document.getElementById('dashSeancesProchaines');
    const actionBtn = document.getElementById('dashActionBtn');

    if (seancesViewMode === 'next') {
        if (actionBtn) {
            actionBtn.innerHTML = 'Voir planning →';
            actionBtn.setAttribute('onclick', "showPage('planning')");
        }
        const upcoming = seances
            .filter(s => s.date && s.date >= today && s.statut === 'planifiee')
            .sort((a, b) => (a.date + (a.heure || '')) > (b.date + (b.heure || '')) ? 1 : -1);

        if (upcoming.length === 0) {
            upEl.innerHTML = '<div class="empty-state">Aucune séance à venir</div>';
        } else {
            // Calcul des seuils de dates
            const todayDate = new Date(today + 'T00:00:00');
            const tomorrow = new Date(todayDate); tomorrow.setDate(todayDate.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().slice(0, 10);

            // Début et fin de la semaine courante (lundi → dimanche)
            const dayOfWeek = (todayDate.getDay() + 6) % 7; // 0=lundi
            const weekStart = new Date(todayDate); weekStart.setDate(todayDate.getDate() - dayOfWeek);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            const weekEndStr = weekEnd.toISOString().slice(0, 10);

            // Semaine prochaine
            const nextWeekStart = new Date(weekEnd); nextWeekStart.setDate(weekEnd.getDate() + 1);
            const nextWeekEnd = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
            const nextWeekStartStr = nextWeekStart.toISOString().slice(0, 10);
            const nextWeekEndStr = nextWeekEnd.toISOString().slice(0, 10);

            // Fin du mois courant
            const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
            const monthEndStr = monthEnd.toISOString().slice(0, 10);

            function getGroup(dateStr) {
                if (dateStr === today) return 'Aujourd\'hui';
                if (dateStr === tomorrowStr) return 'Demain';
                if (dateStr <= weekEndStr) return 'Cette semaine';
                if (dateStr <= nextWeekEndStr) return 'La semaine prochaine';
                if (dateStr <= monthEndStr) return 'Ce mois-ci';
                return 'Plus tard';
            }

            const groupOrder = ["Aujourd'hui", 'Demain', 'Cette semaine', 'La semaine prochaine', 'Ce mois-ci', 'Plus tard'];

            // Grouper les séances
            const groups = {};
            upcoming.forEach(s => {
                const g = getGroup(s.date);
                if (!groups[g]) groups[g] = [];
                groups[g].push(s);
            });

            let html = '<div class="upcoming-list">';
            groupOrder.forEach(label => {
                if (!groups[label]) return;
                html += `<div class="upcoming-separator">${label}</div>`;
                groups[label].forEach(s => {
                    const d = new Date(s.date + 'T00:00:00');
                    const p = DB.getPatientById(s.patientId);
                    // On vérifie si calcAge et relativeDuration existent (par sécurité) avant de les utiliser
                    const age = (p && p.dateNaissance && typeof calcAge === 'function') ? calcAge(p.dateNaissance) : null;
                    const seancesRealisees = p ? DB.getSeancesByPatient(p.id).filter(x => x.statut === 'realisee') : [];
                    const derniereRealisee = seancesRealisees.sort((a, b) => b.date > a.date ? 1 : -1)[0];
                    const chips = [];
                    if (age !== null) chips.push(`<span class="psb-chip psb-chip-sm">🎂 ${age} ans</span>`);
                    chips.push(`<span class="psb-chip psb-chip-sm">🩺 ${seancesRealisees.length} séance${seancesRealisees.length > 1 ? 's' : ''}</span>`);
                    if (derniereRealisee && typeof relativeDuration === 'function') chips.push(`<span class="psb-chip psb-chip-sm psb-last">📅 ${relativeDuration(derniereRealisee.date)}</span>`);

                    html += `<div class="upcoming-item upcoming-item-flat" style="cursor:pointer" onclick="openPatientModal('${s.patientId}')">
                      <span class="uif-datetime">${pad(d.getDate())}/${pad(d.getMonth() + 1)} <strong>${s.heure || '?'}</strong></span>
                      <span class="uif-sep">·</span>
                      <span class="uif-patient">${getPatientName(s.patientId)}</span>
                      <span class="uif-chips">${chips.join('')}</span>
                    </div>`;
                });
            });
            html += '</div>';
            upEl.innerHTML = html;
        }
    } else {
        if (actionBtn) {
            actionBtn.innerHTML = 'Voir patients →';
            actionBtn.setAttribute('onclick', "showPage('patients')");
        }
        // Mode 'last20'
        const realises = seances
            .filter(s => s.date <= today && s.statut === 'realisee')
            .sort((a, b) => (b.date + (b.heure || '')) > (a.date + (a.heure || '')) ? 1 : -1);

        const lastPatients = [];
        const seenPids = new Set();
        for (const s of realises) {
            if (!seenPids.has(s.patientId)) {
                seenPids.add(s.patientId);
                lastPatients.push(s);
                // On limite à 100 pour garder de bonnes performances, tout en permettant le scroll
                if (lastPatients.length >= 100) break;
            }
        }

        if (lastPatients.length === 0) {
            upEl.innerHTML = '<div class="empty-state">Aucun patient consulté récemment</div>';
        } else {
            let html = '<div class="upcoming-list">';
            lastPatients.forEach(s => {
                const d = new Date(s.date + 'T00:00:00');
                const p = DB.getPatientById(s.patientId);
                const age = (p && p.dateNaissance && typeof calcAge === 'function') ? calcAge(p.dateNaissance) : null;
                const seancesRealisees = p ? DB.getSeancesByPatient(p.id).filter(x => x.statut === 'realisee') : [];

                const chips = [];
                if (age !== null) chips.push(`<span class="psb-chip psb-chip-sm">🎂 ${age} ans</span>`);
                chips.push(`<span class="psb-chip psb-chip-sm">🩺 ${seancesRealisees.length} séance${seancesRealisees.length > 1 ? 's' : ''}</span>`);
                if (typeof relativeDuration === 'function') chips.push(`<span class="psb-chip psb-chip-sm psb-last">📅 ${relativeDuration(s.date)}</span>`);

                html += `<div class="upcoming-item upcoming-item-flat" style="cursor:pointer" onclick="openPatientModal('${s.patientId}')">
                  <span class="uif-datetime">${pad(d.getDate())}/${pad(d.getMonth() + 1)}</span>
                  <span class="uif-sep">·</span>
                  <span class="uif-patient">${getPatientName(s.patientId)}</span>
                  <span class="uif-chips">${chips.join('')}</span>
                </div>`;
            });
            html += '</div>';
            upEl.innerHTML = html;
        }
    }

    // Factures récentes
    const recentFactures = [...factures].sort((a, b) => b.createdAt > a.createdAt ? 1 : -1).slice(0, 100);
    const facEl = document.getElementById('dashFacturesRecentes');
    if (recentFactures.length === 0) {
        facEl.innerHTML = '<div class="empty-state">Aucune facture récente</div>';
    } else {
        facEl.innerHTML = '<div class="invoice-list">' + recentFactures.map(f => `
      <div class="invoice-item upcoming-item-flat" style="cursor:pointer" onclick="previewFacture('${f.id}')">
        <span class="uif-datetime">${formatDate(f.date)}</span>
        <span class="uif-sep">·</span>
        <span class="uif-patient">${getPatientName(f.patientId)}</span>
        <span class="invoice-num" style="margin-left: 8px;">(${f.numero})</span>
        <div class="uif-chips">
          <span class="invoice-amount" style="margin-right: 8px;">${formatMontant(f.montant)}</span>
          <span class="badge badge-${f.statut}" style="font-size: 10px; padding: 2px 6px;">${getFactureStatusLabel(f.statut)}</span>
        </div>
      </div>`).join('') + '</div>';
    }
}

/**
 * Définit la période du tableau de bord via les presets
 * @param {string} type - 'week', 'month', 'quarter', 'year'
 */
function setDashboardPeriod(type) {
    const now = new Date();
    let start, end;

    if (type === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
    } else if (type === 'semester') {
        const semester = Math.floor(now.getMonth() / 6);
        start = new Date(now.getFullYear(), semester * 6, 1);
        end = new Date(now.getFullYear(), (semester + 1) * 6, 0);
    } else if (type === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
    }

    if (start && end) {
        const formatDateISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        document.getElementById('dashDateStart').value = formatDateISO(start);
        document.getElementById('dashDateEnd').value = formatDateISO(end);

        // Update select value
        const sel = document.getElementById('dashPeriodPreset');
        if (sel) sel.value = type;
    }

    renderDashboard();
}

/**
 * Gère le changement manuel des dates
 */
function onDashboardDateManualChange() {
    const sel = document.getElementById('dashPeriodPreset');
    if (sel) sel.value = 'custom';

    const start = document.getElementById('dashDateStart')?.value;
    const end = document.getElementById('dashDateEnd')?.value;

    // On n'actualise que si les deux dates sont saisies pour éviter les calculs inutiles (latence)
    if (start && end) {
        renderDashboard();
    }
}

/**
 * Met à jour les libellés des boutons de période de manière dynamique
 */
function updateDashboardPresetLabels() {
    const now = new Date();
    const year = now.getFullYear();

    // Mois
    const optMonth = document.getElementById('optPeriodMonth');
    if (optMonth) {
        const monthName = now.toLocaleDateString('fr-FR', { month: 'long' });
        optMonth.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + year;
    }

    // Trimestre
    const optQuarter = document.getElementById('optPeriodQuarter');
    if (optQuarter) {
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        optQuarter.textContent = 'Trimestre ' + quarter + ' (' + year + ')';
    }

    // Semestre
    const optSemester = document.getElementById('optPeriodSemester');
    if (optSemester) {
        const semester = Math.floor(now.getMonth() / 6) + 1;
        optSemester.textContent = 'Semestre ' + semester + ' (' + year + ')';
    }

    // Année
    const optYear = document.getElementById('optPeriodYear');
    if (optYear) {
        optYear.textContent = 'Année ' + year;
    }
}

// ===== INIT =====
async function init() {
    // Chargement des données depuis le serveur
    try {
        await loadAllData();
    } catch (e) {
        document.body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:20px;background:#0f1623;color:#e8ecf4;font-family:Inter,sans-serif;padding:40px;text-align:center;">
            <div style="font-size:56px">⚠️</div>
            <h1 style="font-size:22px;font-weight:700;">Serveur non démarré</h1>
            <p style="color:#7a8ba8;max-width:480px;line-height:1.8;font-size:15px;">
              Le serveur local n'est pas en cours d'exécution.<br><br>
              Double-cliquez sur <strong style="color:#6b8dd6; background:rgba(79,114,196,0.15); padding:2px 8px; border-radius:5px;">Lancer OstéoCabinet.bat</strong><br>
              dans le dossier du logiciel, puis rechargez cette page.
            </p>
            <button onclick="location.reload()" style="margin-top:8px;padding:12px 28px;background:linear-gradient(135deg,#4f72c4,#3a58a0);color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer;font-family:Inter,sans-serif;font-weight:600;">
              🔄 Réessayer
            </button>
          </div>`;
        return;
    }

    // Mise à jour de la sidebar avec le nom du cabinet
    const settings = DB.getSettings();
    const el = document.getElementById('sidebarCabinetName');
    if (el && settings.cabinetName) el.textContent = settings.cabinetName;

    // Initialisation de la période du dashboard
    updateDashboardPresetLabels();
    setDashboardPeriod('month');

    showPage('dashboard');
    if (typeof initAddressAutocomplete === 'function') initAddressAutocomplete();

    // Sentry - Identifier les cabinets pour le comptage des versions / remontée d'erreurs
    if (typeof Sentry !== 'undefined' && Sentry.onLoad) {
        Sentry.onLoad(function () {
            // En utilisant les 5 derniers chiffres du SIRET ou de l'ADELI du cabinet
            // On évite d'envoyer la donnée personnelle, tout en créant un ID unique pour grouper vos logs
            const idCabinet = settings.adeli ? settings.adeli.slice(-5) : (settings.siret ? settings.siret.slice(-5) : 'inconnu');
            Sentry.setTag("instance_id", idCabinet);

            // On masque le nom (Ex: Cabinet Paris -> Cab***)
            if (settings.cabinetName) {
                Sentry.setTag("cabinet_nom_masque", settings.cabinetName.substring(0, 3) + "***");
            }
        });
    }

    // Initialisation des autocomplétions globales
    const pData = () => DB.getPatients();
    const sData = () => DB.getSeances();

    initGlobalAutocomplete('patientProfession', () => pData().map(p => p.profession));
    initGlobalAutocomplete('patientMedecin', () => pData().map(p => p.medecin));
    initGlobalAutocomplete('patientMotif', () => pData().map(p => p.motif));
    initGlobalAutocomplete('patientAntecedentsMedicaux', () => pData().map(p => p.antecedentsMedicaux));
    initGlobalAutocomplete('patientAntecedentsTrauma', () => pData().map(p => p.antecedentsTrauma));
    initGlobalAutocomplete('patientAllergies', () => pData().map(p => p.allergies));
    initGlobalAutocomplete('patientTraitements', () => pData().map(p => p.traitements));
    initGlobalAutocomplete('patientContraIndications', () => pData().map(p => p.contraIndications));

    // Séances
    const getAllMotifs = () => {
        const motifs = [];
        sData().forEach(s => {
            if (s.anamnese) {
                const parts = s.anamnese.split('|||');
                if (parts[0]) motifs.push(parts[0].trim());
                if (parts[1]) motifs.push(parts[1].trim());
            }
        });
        return motifs;
    };
    initGlobalAutocomplete('seanceAnamnese', getAllMotifs);
    initGlobalAutocomplete('seanceMotif2', getAllMotifs);
    initGlobalAutocomplete('seanceBilan', () => sData().map(s => s.bilan));
    initGlobalAutocomplete('seanceConseils', () => sData().map(s => s.conseils));

    // Rappel de sauvegarde
    if (typeof checkBackupReminder === 'function') {
        setTimeout(checkBackupReminder, 2000);
    }

    // Afficher la version dans la sidebar
    fetch('http://localhost:5180/api/version')
        .then(res => res.json())
        .then(data => {
            const el = document.getElementById('sidebarVersion');
            const v = data.version || '1.1.0';
            if (el) el.textContent = 'v' + v;
        })
        .catch(err => console.error("Erreur version sidebar:", err));

    // Vérifier les mises à jour au démarrage
    if (typeof checkUpdateReminder === 'function') {
        setTimeout(checkUpdateReminder, 1000);
    }
}

document.addEventListener('DOMContentLoaded', init);
