/* ============================================================
   SESSIONS.JS — Gestion des séances
   ============================================================ */

let currentSeancesList = [];
let renderedSeancesCount = 0;
const SESSION_CHUNK_SIZE = 100;

// On initialise l'écouteur de scroll une seule fois
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('seancesListContainer');
    if (container) {
        container.addEventListener('scroll', handleSeancesScroll);
    }
});

function handleSeancesScroll() {
    const container = document.getElementById('seancesListContainer');
    if (!container) return;

    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 400) {
        renderMoreSeances();
    }
}

// ===== RENDER =====
function renderSeances(filtered) {
    const seances = filtered !== undefined ? filtered : DB.getSeances();
    const tbody = document.getElementById('seancesTableBody');
    if (!tbody) return;

    // Populate filters
    populatePatientSelects();

    currentSeancesList = [...seances].sort((a, b) => {
        const da = (a.date || '') + (a.heure || '');
        const db2 = (b.date || '') + (b.heure || '');
        return db2.localeCompare(da);
    });

    tbody.innerHTML = '';
    renderedSeancesCount = 0;

    if (currentSeancesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Aucune séance trouvée</td></tr>';
        return;
    }

    renderMoreSeances();
}

function renderMoreSeances() {
    const tbody = document.getElementById('seancesTableBody');
    if (!tbody || renderedSeancesCount >= currentSeancesList.length) return;

    const nextChunk = currentSeancesList.slice(renderedSeancesCount, renderedSeancesCount + SESSION_CHUNK_SIZE);

    const rows = nextChunk.map(s => `<tr>
    <td>${formatDate(s.date)}</td>
    <td>${s.heure || '—'}</td>
    <td><strong>${getPatientName(s.patientId)}</strong></td>
    <td>${s.type || '—'}</td>
    <td>${s.duree || 0} min</td>
    <td><span class="badge badge-${s.statut}">${getSeanceStatusLabel(s.statut)}</span></td>
    <td>${formatMontant(s.montant)}</td>
    <td>
      <div class="actions">
        <button class="btn btn-sm btn-outline" onclick="openSeanceModal('${s.id}')" title="Modifier">✏️</button>
        <button class="btn btn-sm btn-success" onclick="markSeanceRealisee('${s.id}')" title="Marquer réalisée" ${s.statut === 'realisee' ? 'disabled' : ''}>✅</button>
        <button class="btn btn-sm btn-warning" onclick="openFactureFromSeance('${s.id}')" title="Facturer">🧾</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSeance('${s.id}')" title="Supprimer">🗑</button>
      </div>
    </td>
  </tr>`).join('');

    const template = document.createElement('template');
    template.innerHTML = rows;
    tbody.appendChild(template.content);

    renderedSeancesCount += nextChunk.length;
}

// ===== FILTER =====
// On debouncera la recherche pour la fluidité
const filterSeances = debounce(() => {
    const q = (document.getElementById('searchSeance')?.value || '').toLowerCase();
    const status = document.getElementById('filterSeanceStatus')?.value || '';
    const patient = document.getElementById('filterSeancePatient')?.value || '';

    let seances = DB.getSeances();
    if (status) seances = seances.filter(s => s.statut === status);
    if (patient) seances = seances.filter(s => s.patientId === patient);
    if (q) {
        seances = seances.filter(s => {
            const name = getPatientName(s.patientId).toLowerCase();
            return name.includes(q) || (s.type || '').toLowerCase().includes(q) || (s.date || '').includes(q);
        });
    }
    renderSeances(seances);
}, 200);

// ===== OPEN MODAL =====
function openSeanceModal(id, prePatientId, preDate) {
    // Reset
    document.getElementById('seanceId').value = '';
    document.getElementById('seanceDate').value = preDate || getTodayStr();
    document.getElementById('seanceHeure').value = '';
    document.getElementById('seanceDuree').value = '';
    document.getElementById('seanceType').value = '';
    document.getElementById('seanceMontant').value = '';
    document.getElementById('seanceStatut').value = 'planifiee';
    document.getElementById('seanceAnamnese').value = '';
    document.getElementById('seanceBilan').value = '';
    document.getElementById('seanceConseils').value = '';
    document.getElementById('seanceProchaine').value = '';
    document.getElementById('modalSeanceTitle').textContent = 'Nouvelle séance';

    // Reset Note Importante
    updateSeanceNoteImportante('');

    // Boutons auxiliaires : masqués par défaut (mode création)
    const btnFiche = document.getElementById('btnFichePatientSeance');
    const btnDel = document.getElementById('btnDeleteSeanceModal');
    const btnFacture = document.getElementById('btnFactureSeanceModal');
    if (btnFiche) btnFiche.style.display = 'none';
    if (btnDel) btnDel.style.display = 'none';
    if (btnFacture) btnFacture.style.display = 'none';

    populateSeanceTypeSelect();

    // Init autocomplete patient (1ère fois seulement)
    initPatientAutocomplete('acSeancePatient', 'seancePatient', (pid) => {
        updateSeanceNoteImportante(pid);
    });

    // Reset sélection patient
    setAcValue('acSeancePatient', prePatientId || '');

    // Reset statut (via buttons)
    setSeanceStatus('planifiee');

    if (id) {
        const s = DB.getSeanceById(id);
        if (!s) return;
        document.getElementById('modalSeanceTitle').textContent = 'Modifier la séance';
        document.getElementById('seanceId').value = s.id;
        setAcValue('acSeancePatient', s.patientId || '');
        document.getElementById('seanceDate').value = s.date || '';
        document.getElementById('seanceHeure').value = s.heure || '';
        document.getElementById('seanceAnamnese').value = s.anamnese || '';
        document.getElementById('seanceBilan').value = s.bilan || '';
        document.getElementById('seanceConseils').value = s.conseils || '';
        document.getElementById('seanceProchaine').value = s.prochaine || '';

        // Afficher la note importante du patient
        updateSeanceNoteImportante(s.patientId);

        // Appliquer le statut enregistré
        setSeanceStatus(s.statut || 'planifiee');

        // Sélection du type de séance
        const sel = document.getElementById('seanceType');
        if (sel) {
            // Clé composite pour identifier le type exact (nom + durée + tarif)
            const compositeKey = `${s.type}|${s.duree}|${s.montant}`;

            // On cherche l'option qui correspond exactement
            let foundIndex = -1;
            Array.from(sel.options).forEach((opt, idx) => {
                if (opt.value === compositeKey) foundIndex = idx;
            });

            if (foundIndex !== -1) {
                sel.selectedIndex = foundIndex;
            } else {
                // Si pas de correspondance exacte (ex: les tarifs ont changé depuis), 
                // on essaie de trouver par le nom seul
                let nameOnlyIndex = -1;
                Array.from(sel.options).forEach((opt, idx) => {
                    if (opt.value.startsWith(s.type + '|')) nameOnlyIndex = idx;
                });
                sel.selectedIndex = nameOnlyIndex !== -1 ? nameOnlyIndex : 0;
            }
            updateSeanceMontant();
        }

        // Bouton fiche patient
        if (btnFiche && s.patientId) btnFiche.style.display = 'inline-flex';
    } else {
        // Nouvelle séance : on sélectionne le premier type par défaut si dispo
        const sel = document.getElementById('seanceType');
        if (sel && sel.options.length > 0) {
            sel.selectedIndex = 0;
            updateSeanceMontant();
        }
    }

    openModal('modalSeance');
}

// ===== SET SEANCE STATUS (via buttons) =====
function setSeanceStatus(status) {
    const input = document.getElementById('seanceStatut');
    if (input) input.value = status;

    // Update active class on buttons
    const container = document.querySelector('.status-btn-group');
    if (container) {
        const btns = container.querySelectorAll('.status-btn');
        btns.forEach(btn => {
            if (btn.getAttribute('data-status') === status) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Gestion de l'affichage dynamique des boutons Supprimer / Facturer
    const seanceId = document.getElementById('seanceId')?.value;
    const btnDel = document.getElementById('btnDeleteSeanceModal');
    const btnFacture = document.getElementById('btnFactureSeanceModal');

    if (btnDel && btnFacture) {
        if (seanceId) { // On est en mode modification
            if (status === 'realisee') {
                btnDel.style.display = 'none';
                btnFacture.style.display = 'inline-flex';

                // Vérifier si une facture existe déjà pour cette séance
                const factures = DB.getFactures();
                const existingFacture = factures.find(f => (f.seanceIds || []).includes(seanceId));

                if (existingFacture) {
                    btnFacture.innerHTML = `🧾 Éditer la facture (${existingFacture.numero})`;
                    btnFacture.setAttribute('data-id-facture', existingFacture.id);
                } else {
                    btnFacture.innerHTML = `🧾 Créer la facture`;
                    btnFacture.removeAttribute('data-id-facture');
                }
            } else {
                btnDel.style.display = 'inline-flex';
                btnFacture.style.display = 'none';
            }
        } else { // Mode création patient
            btnDel.style.display = 'none';
            btnFacture.style.display = 'none';
        }
    }
}

// ===== OUVRIR FICHE PATIENT DEPUIS MODAL SEANCE =====
function openPatientFromSeance() {
    const patientId = document.getElementById('seancePatient')?.value;
    if (!patientId) return;
    openPatientModal(patientId);
}

// ===== POPULATE TYPE SELECT =====
function populateSeanceTypeSelect() {
    try {
        const settings = DB.getSettings();
        const types = settings.typesSeances || [];
        const sel = document.getElementById('seanceType');
        if (!sel) return;

        console.log("Populating types:", types);
        sel.innerHTML = '';

        if (types.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "⚠️ Aucun type défini (voir Paramètres)";
            opt.selected = true;
            sel.appendChild(opt);
            return;
        }

        types.forEach(t => {
            const opt = document.createElement('option');
            // On utilise une clé composite pour différencier les types avec le même nom
            opt.value = `${t.nom}|${t.duree}|${t.tarif}`;
            opt.textContent = `${t.nom} - ${t.duree || '?'} min - ${t.tarif} €`;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.error("Error populating types:", e);
    }
}

// ===== UPDATE MONTANT & DUREE ON TYPE CHANGE =====
function updateSeanceMontant() {
    try {
        const select = document.getElementById('seanceType');
        if (!select) return;

        const compositeValue = select.value;
        if (!compositeValue) return;

        // On décompose la clé : "Nom|Durée|Tarif"
        const [nom, duree, tarif] = compositeValue.split('|');

        const montantEl = document.getElementById('seanceMontant');
        const dureeEl = document.getElementById('seanceDuree');

        if (montantEl) montantEl.value = tarif;
        if (dureeEl) dureeEl.value = duree;

        console.log("Applied type from composite key:", { nom, duree, tarif });
    } catch (e) {
        console.error("Error updating montant/duree:", e);
    }
}

// ===== SAVE SEANCE =====
function saveSeance() {
    try {
        const typeSelect = document.getElementById('seanceType');
        const compositeValue = typeSelect ? typeSelect.value : "";
        const [typeName, typeDuree, typeTarif] = compositeValue.split('|');

        const patientId = document.getElementById('seancePatient').value;
        const date = document.getElementById('seanceDate').value;
        const heure = document.getElementById('seanceHeure').value;

        if (!patientId) { showToast('Veuillez sélectionner un patient.', 'error'); return; }
        if (!date) { showToast('La date est obligatoire.', 'error'); return; }
        if (!typeName) { showToast('Veuillez sélectionner un type de séance.', 'error'); return; }

        const data = {
            id: document.getElementById('seanceId').value,
            patientId,
            date,
            heure,
            duree: parseInt(typeDuree) || 0,
            type: typeName,
            montant: parseFloat(typeTarif) || 0,
            statut: document.getElementById('seanceStatut').value || 'planifiee',
            anamnese: document.getElementById('seanceAnamnese').value.trim(),
            bilan: document.getElementById('seanceBilan').value.trim(),
            conseils: document.getElementById('seanceConseils').value.trim(),
            prochaine: document.getElementById('seanceProchaine').value.trim(),
        };

        if (data.id) {
            DB.updateSeance(data);
            showToast('Séance mise à jour.', 'success');
        } else {
            DB.addSeance(data);
            showToast('Séance enregistrée.', 'success');
        }

        closeModal('modalSeance');
        renderSeances();
        renderPlanning();
        renderPatients();
        renderDashboard();
        if (typeof refreshPatientModal === 'function') refreshPatientModal();
    } catch (e) {
        console.error("Save failure:", e);
        showToast("Erreur lors de l'enregistrement : " + e.message, "error");
    }
}

// ===== MARK RÉALISÉE =====
function markSeanceRealisee(id) {
    const s = DB.getSeanceById(id);
    if (!s) return;
    s.statut = 'realisee';
    DB.updateSeance(s);
    showToast('Séance marquée comme réalisée.', 'success');
    renderSeances();
    renderPlanning();
    renderPatients();
    renderDashboard();
    if (typeof refreshPatientModal === 'function') refreshPatientModal();
}

// ===== DELETE SEANCE =====
function deleteSeance(id) {
    if (!confirm('Supprimer cette séance ?')) return;
    DB.deleteSeance(id);
    showToast('Séance supprimée.', 'info');
    renderSeances();
    renderPlanning();
    renderPatients();
    renderDashboard();
    if (typeof refreshPatientModal === 'function') refreshPatientModal();
    return true;
}

// ===== OPEN FACTURE FROM SEANCE =====
function openFactureFromSeance(seanceId) {
    const s = DB.getSeanceById(seanceId);
    if (!s) return;
    openFactureModal(null, s.patientId, [seanceId]);
}
// ===== DELETE SEANCE DEPUIS MODAL =====
function deleteSeanceFromModal() {
    const id = document.getElementById('seanceId').value;
    if (!id) return;
    if (deleteSeance(id)) {
        closeModal('modalSeance');
    }
}

// ===== FACTURER DEPUIS MODAL =====
function facturerSeanceFromModal() {
    const sId = document.getElementById('seanceId').value;
    if (!sId) return;

    const btnFacture = document.getElementById('btnFactureSeanceModal');
    const existingFactureId = btnFacture?.getAttribute('data-id-facture');

    if (existingFactureId) {
        // Rediriger vers l'édition de la facture existante
        openFactureModal(existingFactureId);
    } else {
        // Créer une nouvelle facture pour cette séance
        openFactureFromSeance(sId);
    }
}

/**
 * Affiche la note importante du patient sur la fiche de séance
 * @param {string} patientId
 */
function updateSeanceNoteImportante(patientId) {
    const container = document.getElementById('seanceNoteImportanteContainer');
    const textEl = document.getElementById('seanceNoteImportanteText');
    if (!container || !textEl) return;

    if (!patientId) {
        container.style.display = 'none';
        return;
    }

    const p = DB.getPatientById(patientId);
    if (p && p.noteImportante && p.noteImportante.trim().length > 0) {
        textEl.textContent = "🚩 " + p.noteImportante;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}
