/* ============================================================
   PATIENTS.JS — Gestion patients
   ============================================================ */

// ===== HIGHLIGHT HELPER =====
function highlightText(str, query) {
  if (!str || !query) return str || '—';
  const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return String(str).replace(re, '<mark class="search-mark">$1</mark>');
}

/**
 * Formate une date ISO en DD/MM/YYYY puis surligne la requête dans la chaîne affichée.
 * Fonctionne pour les formats : YYYY, DD/MM, DD/MM/YYYY.
 */
function highlightDate(isoDate, query) {
  if (!isoDate) return '—';
  const formatted = formatDate(isoDate); // ex: "25/02/1990"
  if (!query) return formatted || '—';
  return highlightText(formatted, query) || formatted || '—';
}

// ===== PATIENTS LIST RENDERING OPTIONS =====
let currentPatientsList = [];
let renderedCount = 0;
const CHUNK_SIZE = 100;

function initAlphabetIndex() {
  const container = document.getElementById('alphabetIndex');
  if (!container) return;

  const letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  container.innerHTML = letters.map(l => `<div class="alphabet-letter" onclick="jumpToLetter('${l}')">${l}</div>`).join('');
}

function jumpToLetter(letter) {
  let index = -1;

  if (letter === "#") {
    index = 0;
  } else {
    index = currentPatientsList.findIndex(p => (p.nom || '').toUpperCase().startsWith(letter));
  }

  if (index !== -1) {
    // Si l'index est au-delà de ce qui est rendu, on force le rendu jusqu'ici + un peu plus
    if (index >= renderedCount) {
      renderMorePatients(index + CHUNK_SIZE);
    }

    // On attend un peu que le DOM soit prêt
    setTimeout(() => {
      const tbody = document.getElementById('patientsTableBody');
      const targetRow = tbody.children[index];
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Petit effet de highlight temporaire
        targetRow.style.backgroundColor = 'var(--primary-glow)';
        setTimeout(() => targetRow.style.backgroundColor = '', 2000);
      }
    }, 50);
  } else {
    showToast(`Aucun patient commençant par ${letter}`, 'info');
  }
}

function handlePatientsScroll(e) {
  const container = e.target;
  if (container.scrollHeight - container.scrollTop <= container.clientHeight + 400) {
    if (renderedCount < currentPatientsList.length) {
      renderMorePatients();
    }
  }
}

// ===== RENDER TABLE =====
function renderPatients(filtered, query) {
  const patients = filtered !== undefined ? filtered : DB.getPatients();
  currentPatientsList = [...patients].sort((a, b) => a.nom.localeCompare(b.nom));

  const tbody = document.getElementById('patientsTableBody');
  if (!tbody) return;

  // Init scroll listener once
  const container = document.getElementById('patientsListContainer');
  if (container && !container.dataset.scrollInit) {
    container.addEventListener('scroll', handlePatientsScroll);
    container.dataset.scrollInit = "true";
  }

  // Compteur de résultats
  const countEl = document.getElementById('patientSearchCount');
  if (countEl) {
    const total = DB.getPatients().length;
    if (query && patients.length !== total) {
      countEl.textContent = `${formatNombre(patients.length)} résultat${patients.length > 1 ? 's' : ''} sur ${formatNombre(total)}`;
      countEl.style.display = 'inline';
    } else {
      countEl.textContent = `${formatNombre(total)} patient${total > 1 ? 's' : ''}`;
      countEl.style.display = 'inline';
    }
  }

  if (currentPatientsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Aucun patient trouvé</td></tr>';
    renderedCount = 0;
    return;
  }

  renderedCount = 0;
  tbody.innerHTML = ''; // Reset table
  renderMorePatients(CHUNK_SIZE, query);

  // Init alphabet
  initAlphabetIndex();
}

function renderMorePatients(targetCount, query) {
  const tbody = document.getElementById('patientsTableBody');
  if (!tbody) return;

  const start = renderedCount;
  const end = Math.min(targetCount || (renderedCount + CHUNK_SIZE), currentPatientsList.length);
  const chunk = currentPatientsList.slice(start, end);
  const q = query || document.getElementById('searchPatient')?.value.trim() || '';

  const fragment = document.createDocumentFragment();

  chunk.forEach(p => {
    const tr = document.createElement('tr');
    const seances = DB.getSeancesByPatient(p.id).filter(s => s.statut !== 'annulee');
    const derniere = seances.sort((a, b) => b.date > a.date ? 1 : -1)[0];

    tr.innerHTML = `
      <td><strong>${highlightText(formatNom(p.nom), q)}</strong></td>
      <td>${highlightText(formatPrenom(p.prenom), q) || '—'}</td>
      <td>${highlightDate(p.dateNaissance, q)}</td>
      <td>${highlightText(p.telephone, q) || '—'}</td>
      <td>${highlightText(p.email, q) || '—'}</td>
      <td>${derniere ? highlightDate(derniere.date, q) : '<span style="color:var(--text-dim)">Jamais</span>'}</td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-outline" onclick="openPatientModal('${p.id}')" title="Modifier">✏️</button>
          <button class="btn btn-sm btn-outline" onclick="showPatientSeances('${p.id}')" title="Historique">🩺</button>
          <button class="btn btn-sm btn-danger" onclick="deletePatient('${p.id}')" title="Supprimer">🗑</button>
        </div>
      </td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  renderedCount = end;

  // Recurse if targetCount requested and not reached
  if (targetCount && renderedCount < targetCount && renderedCount < currentPatientsList.length) {
    renderMorePatients(targetCount, query);
  }
}

// ===== FILTER =====

/**
 * Convertit une date ISO (YYYY-MM-DD) en différentes représentations textuelles
 * pour permettre la recherche multi-format (DD/MM/YYYY, DD/MM, MM/YYYY, YYYY).
 */
function dateToSearchStrings(isoDate) {
  if (!isoDate) return [];
  const parts = isoDate.split('-'); // [YYYY, MM, DD]
  if (parts.length < 2) return [isoDate];
  const [yyyy, mm, dd] = parts;
  const results = [yyyy]; // ex: "1990"
  if (mm) results.push(`${mm}/${yyyy}`);         // ex: "02/1990"
  if (dd && mm) {
    results.push(`${dd}/${mm}`);                  // ex: "25/02"
    results.push(`${dd}/${mm}/${yyyy}`);          // ex: "25/02/1990"
  }
  return results;
}

const filterPatients = debounce(() => {
  const raw = document.getElementById('searchPatient')?.value || '';
  const q = raw.trim();
  const qNorm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!q) { renderPatients(undefined, ''); return; }

  const filtered = DB.getPatients().filter(p => {
    // Champs texte classiques
    const full = (`${p.nom} ${p.prenom} ${p.telephone || ''} ${p.email || ''}`)
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (full.includes(qNorm)) return true;

    // Date de naissance
    const dobStrings = dateToSearchStrings(p.dateNaissance);
    if (dobStrings.some(s => s.includes(q))) return true;

    // Date de dernière séance
    const seances = DB.getSeancesByPatient(p.id).filter(s => s.statut !== 'annulee');
    const derniere = seances.sort((a, b) => b.date > a.date ? 1 : -1)[0];
    if (derniere) {
      const lastStrings = dateToSearchStrings(derniere.date);
      if (lastStrings.some(s => s.includes(q))) return true;
    }

    return false;
  });
  renderPatients(filtered, q);
}, 200);

// ===== OPEN MODAL =====

// Calcule la durée relative depuis une date (ex: "3 semaines", "aujourd'hui")
function relativeDuration(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  if (diffDays < 14) return 'il y a 1 semaine';
  if (diffDays < 60) return `il y a ${Math.floor(diffDays / 7)} semaines`;
  if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`;
  const years = Math.floor(diffDays / 365);
  return `il y a ${years} an${years > 1 ? 's' : ''}`;
}

// Calcule l'âge à partir d'une date de naissance
function calcAge(dateNaissance) {
  if (!dateNaissance) return null;
  const dob = new Date(dateNaissance + 'T00:00:00');
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return isNaN(age) ? null : age;
}

function openPatientModal(id) {
  // Reset form
  document.getElementById('patientId').value = '';
  const fields = ['Nom', 'Prenom', 'DateNaissance', 'Sexe', 'Nss', 'Lateralite', 'Adresse', 'CodePostal', 'Ville', 'Telephone', 'Email', 'Medecin', 'Profession', 'SituationPro', 'Orientation', 'Notes', 'NoteImportante', 'Gyneco', 'AntecedentsMedicaux', 'Sport', 'Allergies', 'Chirurgie', 'Digestif'];
  fields.forEach(f => {
    const el = document.getElementById('patient' + f);
    if (el) {
      el.value = '';
      if (f === 'NoteImportante') el.classList.remove('note-importante-filled');
    }
  });

  document.getElementById('modalPatientTitle').textContent = 'Nouveau patient';
  document.getElementById('patientSummaryBar').innerHTML = '';
  document.getElementById('patientSeancesHistory').innerHTML = '<div class="empty-state">Enregistrez d\'abord le patient pour voir son historique.</div>';

  // Reset tabs
  const firstTab = document.querySelector('#modalPatient .tab-btn');
  if (firstTab) switchTab('tabInfos', firstTab);

  // Masquer le bouton de création de séance si on crée un nouveau patient
  const btnNouvSeance = document.getElementById('btnNouvelleSeancePatient');
  if (btnNouvSeance) btnNouvSeance.style.display = id ? 'inline-flex' : 'none';

  if (id) {
    const p = DB.getPatientById(id);
    if (!p) return;
    document.getElementById('modalPatientTitle').textContent = getPatientName(p.id);
    document.getElementById('patientId').value = p.id;
    document.getElementById('patientNom').value = p.nom || '';
    document.getElementById('patientPrenom').value = p.prenom || '';
    document.getElementById('patientDateNaissance').value = p.dateNaissance || '';
    document.getElementById('patientSexe').value = p.sexe || '';
    document.getElementById('patientNss').value = p.nss || '';
    document.getElementById('patientLateralite').value = p.lateralite || '';
    document.getElementById('patientAdresse').value = p.adresse || '';
    document.getElementById('patientCodePostal').value = p.codePostal || '';
    document.getElementById('patientVille').value = p.ville || '';
    document.getElementById('patientTelephone').value = p.telephone || '';
    document.getElementById('patientEmail').value = p.email || '';
    if (document.getElementById('patientMedecin')) document.getElementById('patientMedecin').value = p.medecin || '';
    if (document.getElementById('patientProfession')) document.getElementById('patientProfession').value = p.profession || '';
    if (document.getElementById('patientSituationPro')) document.getElementById('patientSituationPro').value = p.situationPro || p.mutuelle || '';
    if (document.getElementById('patientOrientation')) document.getElementById('patientOrientation').value = p.orientation || '';
    if (document.getElementById('patientNotes')) document.getElementById('patientNotes').value = p.notes || '';
    const noteImp = document.getElementById('patientNoteImportante');
    if (noteImp) {
      noteImp.value = p.noteImportante || '';
      toggleNoteImportanteStyle(noteImp);
    }
    if (document.getElementById('patientGyneco')) document.getElementById('patientGyneco').value = p.gyneco || p.motif || '';
    if (document.getElementById('patientAntecedentsMedicaux')) document.getElementById('patientAntecedentsMedicaux').value = p.antecedentsMedicaux || '';
    if (document.getElementById('patientSport')) document.getElementById('patientSport').value = p.sport || p.antecedentsTrauma || '';
    if (document.getElementById('patientAllergies')) document.getElementById('patientAllergies').value = p.allergies || '';
    if (document.getElementById('patientChirurgie')) document.getElementById('patientChirurgie').value = p.chirurgie || p.traitements || '';
    if (document.getElementById('patientDigestif')) document.getElementById('patientDigestif').value = p.digestif || p.contraIndications || '';

    // ── Barre de résumé ──
    const seances = DB.getSeancesByPatient(id).filter(s => s.statut === 'realisee');
    const derniere = seances.sort((a, b) => b.date > a.date ? 1 : -1)[0];
    const age = calcAge(p.dateNaissance);
    const parts = [];
    if (age !== null) parts.push(`<span class="psb-chip">🎂 ${age} ans</span>`);
    parts.push(`<span class="psb-chip">🩺 ${seances.length} séance${seances.length > 1 ? 's' : ''}</span>`);
    if (derniere) {
      const rel = relativeDuration(derniere.date);
      parts.push(`<span class="psb-chip psb-last">📅 Dernière séance ${rel}</span>`);
    } else {
      parts.push(`<span class="psb-chip psb-none">Aucune séance</span>`);
    }
    document.getElementById('patientSummaryBar').innerHTML = parts.join('');

    // History
    renderPatientSeancesHistory(id);
  }

  openModal('modalPatient');
}

// ===== REFRESH MODAL DATA (sans fermer) =====
function refreshPatientModal() {
  const patientId = document.getElementById('patientId')?.value;
  if (!patientId || !document.getElementById('modalPatient').classList.contains('open')) return;

  const p = DB.getPatientById(patientId);
  if (!p) return;

  // 1. Refresh Summary Bar
  const seances = DB.getSeancesByPatient(patientId).filter(s => s.statut === 'realisee');
  const derniere = seances.sort((a, b) => b.date.localeCompare(a.date))[0];
  const age = calcAge(p.dateNaissance);
  const parts = [];
  if (age !== null) parts.push(`<span class="psb-chip">🎂 ${age} ans</span>`);
  parts.push(`<span class="psb-chip">🩺 ${seances.length} séance${seances.length > 1 ? 's' : ''}</span>`);
  if (derniere) {
    const rel = relativeDuration(derniere.date);
    parts.push(`<span class="psb-chip psb-last">📅 Dernière séance ${rel}</span>`);
  } else {
    parts.push(`<span class="psb-chip psb-none">Aucune séance</span>`);
  }
  const summaryBar = document.getElementById('patientSummaryBar');
  if (summaryBar) summaryBar.innerHTML = parts.join('');

  // 2. Refresh History
  renderPatientSeancesHistory(patientId);
}

// ===== PATIENT SEANCES HISTORY in modal =====
function renderPatientSeancesHistory(patientId) {
  const seances = DB.getSeancesByPatient(patientId).sort((a, b) => b.date > a.date ? 1 : -1);
  const el = document.getElementById('patientSeancesHistory');
  if (!el) return;
  if (seances.length === 0) {
    el.innerHTML = '<div class="empty-state">Aucune séance enregistrée pour ce patient.</div>';
    return;
  }

  el.innerHTML = `
    <table class="history-compact-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Heure</th>
          <th>Type</th>
          <th>Durée</th>
          <th>Montant</th>
          <th>Statut séance</th>
          <th>Facture</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${seances.map(s => {
    // Chercher la facture liée à cette séance
    const facture = DB.getFactures().find(f => (f.seanceIds || []).includes(s.id));
    const factureStatutLabel = facture ? getFactureStatusLabel(facture.statut) : null;
    return `<tr class="history-compact-row">
              <td>${formatDate(s.date)}</td>
              <td>${s.heure || '—'}</td>
              <td>${s.type || 'Standard'}</td>
              <td>${s.duree || 45} min</td>
              <td><strong>${formatMontant(s.montant)}</strong></td>
              <td><span class="badge badge-${s.statut}">${s.statut}</span></td>
              <td>
                ${facture
        ? `<span class="badge badge-${facture.statut}" title="${facture.numero}">${factureStatutLabel}</span>`
        : `<span class="badge-facture-none">—</span>`
      }
              </td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-outline" title="Voir le détail" onclick="viewSeanceDetail('${s.id}')">👁️</button>
                  <button class="btn btn-sm btn-outline" title="Modifier la séance" onclick="openSeanceModal('${s.id}')">✏️</button>
                   ${facture
        ? `<button class="btn btn-sm btn-warning" title="Éditer la facture ${facture.numero}" onclick="openFactureModal('${facture.id}')">🧾</button>
                    <button class="btn btn-sm btn-outline" title="Aperçu / Imprimer la facture ${facture.numero}" onclick="previewFacture('${facture.id}')">🖨️</button>`
        : `<button class="btn btn-sm btn-outline" title="Créer une facture" onclick="openFactureFromSeance('${s.id}')">🧾+</button>`
      }
                </div>
              </td>
            </tr>`;
  }).join('')}
      </tbody>
    </table>`;
}

// ===== VIEW SEANCE DETAIL (popup lecture seule) =====
function viewSeanceDetail(seanceId) {
  const s = DB.getSeanceById(seanceId);
  if (!s) return;
  const facture = DB.getFactures().find(f => (f.seanceIds || []).includes(s.id));

  const rows = [
    ['Date', formatDate(s.date)],
    ['Heure', s.heure || '—'],
    ['Type', s.type || 'Standard'],
    ['Durée', (s.duree || 45) + ' min'],
    ['Montant', formatMontant(s.montant)],
    ['Statut', `<span class="badge badge-${s.statut}">${s.statut}</span>`],
    s.anamnese ? ['Motif 1', s.anamnese.split('|||')[0]] : null,
    (s.anamnese && s.anamnese.includes('|||') && s.anamnese.split('|||')[1]) ? ['Motif 2', s.anamnese.split('|||')[1]] : null,
    s.bilan ? ['Bilan', s.bilan] : null,
    s.conseils ? ['Conseils', s.conseils] : null,
    s.prochaine ? ['Prochaine séance', s.prochaine] : null,
    facture ? ['Facture', `${facture.numero} — ${formatMontant(facture.montant)} — <span class="badge badge-${facture.statut}">${getFactureStatusLabel(facture.statut)}</span>`] : null,
  ].filter(Boolean);

  const html = `
      <div style="padding:4px 0">
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
          ${rows.map(([label, val]) => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 10px 8px 0;color:var(--text-dim);font-weight:600;white-space:nowrap;width:40%">${label}</td>
              <td style="padding:8px 0;color:var(--text-primary)">${val}</td>
            </tr>`).join('')}
        </table>
      </div>`;

  document.getElementById('seanceDetailContent').innerHTML = html;
  openModal('modalSeanceDetail');
}

// ===== SAVE PATIENT =====
function savePatient() {
  const nom = document.getElementById('patientNom').value.trim();
  const prenom = document.getElementById('patientPrenom').value.trim();
  if (!nom) { showToast('Le nom est obligatoire.', 'error'); return; }

  const data = {
    id: document.getElementById('patientId')?.value || '',
    nom: formatNom(nom),
    prenom: formatPrenom(prenom),
    dateNaissance: document.getElementById('patientDateNaissance')?.value || '',
    sexe: document.getElementById('patientSexe')?.value || '',
    nss: document.getElementById('patientNss')?.value.trim() || '',
    lateralite: document.getElementById('patientLateralite')?.value || '',
    adresse: document.getElementById('patientAdresse')?.value.trim() || '',
    codePostal: document.getElementById('patientCodePostal')?.value.trim() || '',
    ville: document.getElementById('patientVille')?.value.trim() || '',
    telephone: document.getElementById('patientTelephone')?.value.trim() || '',
    email: document.getElementById('patientEmail')?.value.trim() || '',
    medecin: document.getElementById('patientMedecin')?.value.trim() || '',
    profession: document.getElementById('patientProfession')?.value.trim() || '',
    situationPro: document.getElementById('patientSituationPro')?.value.trim() || '',
    orientation: document.getElementById('patientOrientation')?.value.trim() || '',
    notes: document.getElementById('patientNotes')?.value.trim() || '',
    noteImportante: document.getElementById('patientNoteImportante')?.value.trim() || '',
    gyneco: document.getElementById('patientGyneco')?.value.trim() || '',
    antecedentsMedicaux: document.getElementById('patientAntecedentsMedicaux')?.value.trim() || '',
    sport: document.getElementById('patientSport')?.value.trim() || '',
    allergies: document.getElementById('patientAllergies')?.value.trim() || '',
    chirurgie: document.getElementById('patientChirurgie')?.value.trim() || '',
    digestif: document.getElementById('patientDigestif')?.value.trim() || '',
  };

  if (data.id) {
    DB.updatePatient(data);
    showToast('Patient mis à jour.', 'success');
  } else {
    const saved = DB.addPatient(data);
    document.getElementById('patientId').value = saved.id; // On stocke le nouvel ID pour pouvoir ajouter des séances

    // Le patient est maintenant enregistré, on affiche le bouton Nouvelle séance
    const btnNouvSeance = document.getElementById('btnNouvelleSeancePatient');
    if (btnNouvSeance) btnNouvSeance.style.display = 'inline-flex';

    // Update history after save
    renderPatientSeancesHistory(saved.id);
    showToast('Patient enregistré.', 'success');
  }

  // On ne ferme plus la modale après enregistrement (demande utilisateur)
  // closeModal('modalPatient');

  renderPatients();
  renderSeances();
  renderPlanning();
  renderDashboard();
  if (typeof refreshPatientModal === 'function') refreshPatientModal();

  // Refresh patient selects
  populatePatientSelects();
}

// ===== DELETE PATIENT =====
function deletePatient(id) {
    if (!confirm('Supprimer définitivement ce patient et toutes ses données (séances, factures) ?')) return;
    DB.deletePatient(id);
    showToast('Patient supprimé.', 'info');
    renderPatients();
    renderDashboard();
    // Re-peupler les selects de patients dans les autres pages
    if (typeof populatePatientSelects === 'function') populatePatientSelects();
}

// ===== SHOW PATIENT SEANCES =====
function showPatientSeances(patientId) {
  openPatientModal(patientId);
  setTimeout(() => {
    const btn = document.querySelector('#modalPatient .tab-btn:nth-child(3)');
    if (btn) switchTab('tabSeancesPatient', btn);
  }, 50);
}

// ===== POPULATE PATIENT SELECTS (shared) =====
function populatePatientSelects() {
  const patients = [...DB.getPatients()].sort((a, b) => a.nom.localeCompare(b.nom));
  const opts = '<option value="">Sélectionner un patient</option>' +
    patients.map(p => `<option value="${p.id}">${formatNom(p.nom)} ${formatPrenom(p.prenom)}</option>`).join('');

  ['seancePatient', 'facturePatient', 'filterSeancePatient'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const current = el.value;
      el.innerHTML = id === 'filterSeancePatient'
        ? '<option value="">Tous les patients</option>' + patients.map(p => `<option value="${p.id}">${formatNom(p.nom)} ${formatPrenom(p.prenom)}</option>`).join('')
        : opts;
      el.value = current;
    }
  });
}

// ===== AUTO-FILL NSS PREFIX =====
function updatePatientNssPrefix() {
  const sexe = document.getElementById('patientSexe').value;
  const dob = document.getElementById('patientDateNaissance').value;
  const nssInput = document.getElementById('patientNss');

  const currentVal = nssInput.value.replace(/\s/g, '');
  // On ne remplit automatiquement que si le champ est court (préfixe uniquement)
  if (currentVal.length > 5) return;

  let raw = "";

  // 1er chiffre : Sexe (1=H, 2=F)
  if (sexe === 'M') raw = "1";
  else if (sexe === 'F') raw = "2";
  else return;

  // 2 et 3 : Année (YY), 4 et 5 : Mois (MM)
  if (dob) {
    const [year, month] = dob.split('-');
    if (year && month) {
      raw += year.substring(2, 4) + month;
    }
  }

  nssInput.value = formatNss(raw);
}

function onNssInput(input) {
  const val = input.value;
  const formatted = formatNss(val);
  input.value = formatted;
}

function formatNss(val) {
  // Garder uniquement les chiffres
  let clean = val.replace(/[^0-9]/g, '');
  let res = "";

  if (clean.length > 0) res += clean.substring(0, 1);
  if (clean.length > 1) res += " " + clean.substring(1, 3);
  if (clean.length > 3) res += " " + clean.substring(3, 5);
  if (clean.length > 5) res += " " + clean.substring(5, 7);
  if (clean.length > 7) res += " " + clean.substring(7, 10);
  if (clean.length > 10) res += " " + clean.substring(10, 13);
  if (clean.length > 13) res += " " + clean.substring(13, 15);

  return res.trim();
}

// ===== ADDRESS & CP/CITY AUTOCOMPLETE (data.gouv.fr) =====

function initAddressAutocomplete() {
  const addrInput = document.getElementById('patientAdresse');
  const cpInput = document.getElementById('patientCodePostal');
  const villeInput = document.getElementById('patientVille');

  if (!addrInput || !cpInput || !villeInput) return;

  // Créer le dropdown pour l'adresse
  const dropdown = document.createElement('div');
  dropdown.className = 'ac-dropdown';
  dropdown.style.display = 'none';
  addrInput.parentNode.style.position = 'relative';
  addrInput.parentNode.appendChild(dropdown);

  // Créer le dropdown pour la ville
  const cityDropdown = document.createElement('div');
  cityDropdown.className = 'ac-dropdown';
  cityDropdown.style.display = 'none';
  villeInput.parentNode.style.position = 'relative';
  villeInput.parentNode.appendChild(cityDropdown);

  let debounceTimer, cityDebounceTimer;

  addrInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = addrInput.value.trim();
    if (q.length < 3) {
      dropdown.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`);
        const data = await res.json();

        if (data.features && data.features.length > 0) {
          dropdown.innerHTML = data.features.map(f => {
            const props = f.properties;
            return `<div class="ac-item" onclick="selectFullAddress('${props.name.replace(/'/g, "\\'")}', '${props.postcode}', '${props.city.replace(/'/g, "\\'")}')">
                            <span class="ac-name">${props.name}</span>
                            <span class="ac-sub">${props.postcode} ${props.city}</span>
                        </div>`;
          }).join('');
          dropdown.style.display = 'block';
        } else {
          dropdown.style.display = 'none';
        }
      } catch (err) {
        console.error("Erreur API Adresse:", err);
      }
    }, 300);
  });

  // Liaison Ville -> CP (Autocomplétion ville)
  villeInput.addEventListener('input', () => {
    clearTimeout(cityDebounceTimer);
    const q = villeInput.value.trim();
    if (q.length < 2) {
      cityDropdown.style.display = 'none';
      return;
    }

    cityDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,codesPostaux&limit=5`);
        const data = await res.json();

        if (data && data.length > 0) {
          cityDropdown.innerHTML = data.map(c => {
            const cp = c.codesPostaux[0]; // On prend le premier par défaut
            return `<div class="ac-item" onclick="selectCityOnly('${c.nom.replace(/'/g, "\\'")}', '${cp}')">
                            <span class="ac-name">${c.nom}</span>
                            <span class="ac-sub">${c.codesPostaux.join(', ')}</span>
                        </div>`;
          }).join('');
          cityDropdown.style.display = 'block';
        } else {
          cityDropdown.style.display = 'none';
        }
      } catch (err) {
        console.error("Erreur API Géo:", err);
      }
    }, 300);
  });

  // Liaison CP -> Ville
  cpInput.addEventListener('input', () => {
    const cp = cpInput.value.trim();
    if (cp.length === 5) {
      fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom&format=json`)
        .then(r => r.json())
        .then(data => {
          if (data && data.length > 0) {
            villeInput.value = data[0].nom;
          }
        });
    }
  });

  // Fermer les dropdowns si clic ailleurs
  document.addEventListener('click', (e) => {
    if (!addrInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
    if (!villeInput.contains(e.target) && !cityDropdown.contains(e.target)) {
      cityDropdown.style.display = 'none';
    }
  });

}


function selectFullAddress(addr, cp, ville) {
  document.getElementById('patientAdresse').value = addr;
  document.getElementById('patientCodePostal').value = cp;
  document.getElementById('patientVille').value = ville;
  document.querySelectorAll('.ac-dropdown').forEach(d => d.style.display = 'none');
}

function selectCityOnly(ville, cp) {
  document.getElementById('patientVille').value = ville;
  document.getElementById('patientCodePostal').value = cp;
  document.querySelectorAll('.ac-dropdown').forEach(d => d.style.display = 'none');
}

function toggleNoteImportanteStyle(el) {
  if (el.value.trim().length > 0) {
    el.classList.add('note-importante-filled');
  } else {
    el.classList.remove('note-importante-filled');
  }
}

// Fin du fichier - Export global explicite
window.renderPatients = renderPatients;
window.openPatientModal = openPatientModal;
window.savePatient = savePatient;
window.deletePatient = deletePatient;
window.refreshPatientModal = refreshPatientModal;
window.setAcValue = setAcValue;
window.calcAge = calcAge;
window.relativeDuration = relativeDuration;
window.jumpToLetter = jumpToLetter;
window.initAlphabetIndex = initAlphabetIndex;
window.initAddressAutocomplete = initAddressAutocomplete;
window.selectFullAddress = selectFullAddress;
window.selectCityOnly = selectCityOnly;
window.toggleNoteImportanteStyle = toggleNoteImportanteStyle;
