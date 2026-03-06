/* ============================================================
   DATA.JS — Couche données via API serveur (data.json)
   ============================================================ */

const API = "http://localhost:5180/api";

// Cache local et index pour des recherches ultra-rapides O(1)
let _cache = {
    patients: [],
    seances: [],
    factures: [],
    settings: {},
};

let _index = {
    patients: new Map(),
    seances: new Map(),
    seancesByPatient: new Map(), // O(1) pour l'historique
};

// ===== UTILS =====
async function apiFetch(path, method = "GET", body = null) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
    return res.json();
}

// Charge toute la base une seule fois au démarrage
async function loadAllData() {
    console.time("loadAllData");
    const all = await apiFetch("/");
    _cache.patients = all.patients || [];
    _cache.seances = all.seances || [];
    _cache.factures = all.factures || [];
    _cache.settings = all.settings || {};

    // Reconstruction des index
    _index.patients.clear();
    _cache.patients.forEach(p => _index.patients.set(p.id, p));

    _index.seances.clear();
    _index.seancesByPatient.clear();
    _cache.seances.forEach(s => {
        _index.seances.set(s.id, s);
        if (!_index.seancesByPatient.has(s.patientId)) {
            _index.seancesByPatient.set(s.patientId, []);
        }
        _index.seancesByPatient.get(s.patientId).push(s);
    });
    console.timeEnd("loadAllData");
}

const DB = {

    // ─── PATIENTS ───────────────────────────────────────────────
    getPatients() { return _cache.patients || []; },

    addPatient(p) {
        if (!p.id) p.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        p.createdAt = new Date().toISOString();
        _cache.patients.push(p);
        _index.patients.set(p.id, p);
        apiFetch("/patients", "POST", p).catch(console.error);
        return p;
    },

    updatePatient(updated) {
        updated.updatedAt = new Date().toISOString();
        const existing = _index.patients.get(updated.id);
        if (existing) {
            Object.assign(existing, updated);
        } else {
            const idx = _cache.patients.findIndex(p => p.id === updated.id);
            if (idx !== -1) _cache.patients[idx] = { ..._cache.patients[idx], ...updated };
            _index.patients.set(updated.id, updated);
        }
        apiFetch(`/patients/${updated.id}`, "PUT", updated).catch(console.error);
    },

    deletePatient(id) {
        _cache.patients = _cache.patients.filter(p => p.id !== id);
        _index.patients.delete(id);
        apiFetch(`/patients/${id}`, "DELETE").catch(console.error);
    },

    getPatientById(id) {
        return _index.patients.get(id) || null;
    },

    // ─── SÉANCES ────────────────────────────────────────────────
    getSeances() { return _cache.seances || []; },

    addSeance(s) {
        if (!s.id) s.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        s.createdAt = new Date().toISOString();
        _cache.seances.push(s);
        _index.seances.set(s.id, s);

        // Update index par patient
        if (!_index.seancesByPatient.has(s.patientId)) {
            _index.seancesByPatient.set(s.patientId, []);
        }
        _index.seancesByPatient.get(s.patientId).push(s);

        apiFetch("/seances", "POST", s).catch(console.error);
        return s;
    },

    updateSeance(updated) {
        updated.updatedAt = new Date().toISOString();
        const existing = _index.seances.get(updated.id);
        if (existing) {
            Object.assign(existing, updated);
        } else {
            const idx = _cache.seances.findIndex(s => s.id === updated.id);
            if (idx !== -1) _cache.seances[idx] = { ..._cache.seances[idx], ...updated };
            _index.seances.set(updated.id, updated);
        }
        apiFetch(`/sessions/${updated.id}`, "PUT", updated).catch(console.error);
    },

    deleteSeance(id) {
        _cache.seances = _cache.seances.filter(s => s.id !== id);
        _index.seances.delete(id);
        apiFetch(`/seances/${id}`, "DELETE").catch(console.error);
    },

    getSeanceById(id) {
        return _index.seances.get(id) || null;
    },

    getSeancesByPatient(patientId) {
        return _index.seancesByPatient.get(patientId) || [];
    },

    // ─── FACTURES ───────────────────────────────────────────────
    getFactures() { return _cache.factures || []; },

    addFacture(f) {
        f.id = Date.now().toString();
        f.createdAt = new Date().toISOString();
        _cache.factures.push(f);
        apiFetch("/factures", "POST", f).catch(console.error);
        return f;
    },

    updateFacture(updated) {
        updated.updatedAt = new Date().toISOString();
        const idx = _cache.factures.findIndex(f => f.id === updated.id);
        if (idx !== -1) _cache.factures[idx] = { ..._cache.factures[idx], ...updated };
        apiFetch(`/factures/${updated.id}`, "PUT", updated).catch(console.error);
    },

    deleteFacture(id) {
        _cache.factures = _cache.factures.filter(f => f.id !== id);
        apiFetch(`/factures/${id}`, "DELETE").catch(console.error);
    },

    getFactureById(id) {
        return (_cache.factures || []).find(f => f.id === id) || null;
    },

    // ─── PARAMÈTRES ─────────────────────────────────────────────
    getSettings() { return _cache.settings || {}; },

    saveSettings(s) {
        _cache.settings = s;
        apiFetch("/settings", "POST", s).catch(console.error);
    },

    // ─── NUMÉRO FACTURE ─────────────────────────────────────────
    getNextFactureNum(dateStr) {
        const settings = this.getSettings();
        let format = settings.factureFormat || settings.facturePrefix || 'FACT-YYYY-######';

        // Remplacer l'année basée sur la date fournie ou la date actuelle
        const dateObj = dateStr ? new Date(dateStr) : new Date();
        const yearFull = dateObj.getFullYear();
        const yearShort = String(yearFull).substring(2);

        format = format.replace('YYYY', yearFull);
        format = format.replace('YY', yearShort);

        // Identifier le bloc de # (le compteur)
        const hashMatch = format.match(/#+/);
        if (!hashMatch) {
            // Fallback si pas de # défini : on ajoute simplement un numéro
            const factures = this.getFactures();
            return format + (factures.length + 1);
        }

        const hashes = hashMatch[0];
        const padding = hashes.length;
        const prefixPart = format.substring(0, hashMatch.index);
        const suffixPart = format.substring(hashMatch.index + padding);

        // Regex pour extraire le numéro existant basé sur ce format
        const escapeRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp('^' + escapeRegex(prefixPart) + '(\\d+)' + escapeRegex(suffixPart) + '$');

        const factures = this.getFactures();
        let maxNum = 0;

        factures.forEach(f => {
            const match = (f.numero || '').match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });

        const nextNum = maxNum + 1;
        const paddedNum = String(nextNum).padStart(padding, '0');

        return prefixPart + paddedNum + suffixPart;
    }
};
