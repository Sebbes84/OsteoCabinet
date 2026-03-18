/* ============================================================
   BILLING.JS — Gestion de la facturation
   ============================================================ */
console.log("Loading billing.js...");

// ID de la facture actuellement affichée dans le modal aperçu
let _currentPreviewFactureId = null;

// ===== RENDER TABLE =====
function renderFactures(filtered) {
  const factures = filtered !== undefined ? filtered : DB.getFactures();
  const tbody = document.getElementById('facturesTableBody');
  if (!tbody) return;

  const sorted = [...factures].sort((a, b) => b.createdAt > a.createdAt ? 1 : -1);

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Aucune facture trouvée</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(f => `<tr>
    <td><strong>${f.numero}</strong></td>
    <td>${formatDate(f.date)}</td>
    <td>${getPatientName(f.patientId)}</td>
    <td>${(f.seanceIds || []).length} séance(s)</td>
    <td><strong style="color:var(--success)">${formatMontant(f.montant)}</strong></td>
    <td>${f.paiement || '—'}</td>
    <td>
      <span class="badge badge-${f.statut}">${getFactureStatusLabel(f.statut)}</span>
      ${f.sentAt ? `<div style="font-size:10px; color:var(--text-muted); margin-top:4px;">📧 Envoyée le ${formatDate(f.sentAt)}</div>` : ''}
    </td>
    <td>
      <div class="actions">
        <button class="btn btn-sm btn-outline" onclick="previewFacture('${f.id}')" title="Aperçu / Imprimer">🖨</button>
        <button class="btn btn-sm btn-outline" onclick="openFactureModal('${f.id}')" title="Modifier">✏️</button>
        <button class="btn btn-sm btn-success" onclick="markFacturePayee('${f.id}')" title="Marquer acquittée" ${f.statut === 'payee' ? 'disabled' : ''}>💳</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFacture('${f.id}')" title="Supprimer">🗑</button>
      </div>
    </td>
  </tr>`).join('');
}

// ===== FILTER =====
const filterFactures = debounce(() => {
  const q = (document.getElementById('searchFacture')?.value || '').toLowerCase();
  const status = document.getElementById('filterFactureStatus')?.value || '';

  let factures = DB.getFactures();
  if (status) factures = factures.filter(f => f.statut === status);
  if (q) {
    factures = factures.filter(f => {
      const name = getPatientName(f.patientId).toLowerCase();
      return name.includes(q) || (f.numero || '').toLowerCase().includes(q);
    });
  }
  renderFactures(factures);
}, 200);

// ===== OPEN MODAL =====
function openFactureModal(id, prePatientId, preSeanceIds) {
  document.getElementById('factureId').value = '';
  const today = getTodayStr();
  document.getElementById('factureDate').value = today;
  document.getElementById('factureNumero').value = DB.getNextFactureNum(today);
  document.getElementById('factureMontant').value = '';
  // setFactureStatus sera appelé plus bas après population du select
  document.getElementById('factureNotes').value = '';
  document.getElementById('factureSeancesSelect').innerHTML = '<div class="empty-state-sm">Sélectionnez un patient d\'abord</div>';
  document.getElementById('modalFactureTitle').textContent = 'Nouvelle facture';

  // Populate paiement options from settings
  const settings = DB.getSettings();
  let paiements = (settings.paiements && settings.paiements.length > 0)
    ? [...settings.paiements]
    : ['Carte bancaire', 'Espèces', 'Chèque', 'Virement bancaire'];

  // Toujours mettre "Carte bancaire" en premier si présent
  const cbIdx = paiements.indexOf('Carte bancaire');
  if (cbIdx > 0) {
    paiements.splice(cbIdx, 1);
    paiements.unshift('Carte bancaire');
  }

  const sel = document.getElementById('facturePaiement');
  sel.innerHTML = paiements.map(p => `<option value="${p}">${p}</option>`).join('');

  // Init autocomplete patient (1ère fois seulement), avec callback pour charger les séances
  initPatientAutocomplete('acFacturePatient', 'facturePatient', () => loadPatientSeancesForFacture([]));

  if (id) {
    const f = DB.getFactureById(id);
    if (!f) return;
    document.getElementById('modalFactureTitle').textContent = `Facture ${f.numero}`;
    document.getElementById('factureId').value = f.id;
    document.getElementById('factureNumero').value = f.numero;
    document.getElementById('factureDate').value = f.date;
    setAcValue('acFacturePatient', f.patientId);
    document.getElementById('factureMontant').value = f.montant ? formatMontant(f.montant) : '';
    setFactureStatus(f.statut || 'emise');
    document.getElementById('factureNotes').value = f.notes || '';
    sel.value = f.paiement || '';
    loadPatientSeancesForFacture(f.seanceIds || []);
  } else if (prePatientId) {
    setAcValue('acFacturePatient', prePatientId);
    setFactureStatus('emise');
    loadPatientSeancesForFacture(preSeanceIds || []);
  } else {
    setAcValue('acFacturePatient', '');
    setFactureStatus('emise');
  }

  openModal('modalFacture');
  updateFactureModalButtons();
  initFactureSecretMode();
}

function updateFactureModalButtons(isDirty = false) {
  const fId = document.getElementById('factureId').value;
  const btnApercu = document.getElementById('btnPreviewFactureModal');
  const btnSave = document.getElementById('btnSaveFacture');

  if (fId && !isDirty) {
    btnApercu.style.display = 'block';
    btnSave.classList.remove('btn-primary');
    btnSave.classList.add('btn-outline');
    btnSave.textContent = 'Enregistrer';
  } else {
    btnApercu.style.display = 'none';
    btnSave.classList.remove('btn-outline');
    btnSave.classList.add('btn-primary');
    btnSave.textContent = isDirty ? 'Enregistrer les modifications' : 'Enregistrer';
  }
}

function onFactureFormChange() {
  updateFactureModalButtons(true);
}

// ===== REFRESH NUMERO DE FACTURE =====
function refreshFactureNum() {
  const fId = document.getElementById('factureId').value;
  // On ne change le numéro que pour une nouvelle facture
  if (fId) return;

  const dateStr = document.getElementById('factureDate').value;
  if (!dateStr) return;

  const nextNum = DB.getNextFactureNum(dateStr);
  document.getElementById('factureNumero').value = nextNum;
  console.log("Facture number refreshed for date:", dateStr, "->", nextNum);
  
  // Si on est en mode secret, on rafraîchit aussi les suggestions
  if (document.getElementById('factureNumero').classList.contains('secret-mode-active')) {
    showFactureSuggestions();
  }
}

// ===== SECRET MODE & SUGGESTIONS =====
function initFactureSecretMode() {
  const input = document.getElementById('factureNumero');
  if (!input) return;

  // Reset state
  input.readOnly = true;
  input.classList.remove('secret-mode-active');
  const existingSuggestions = document.querySelector('.facture-suggestions');
  if (existingSuggestions) existingSuggestions.remove();

  // Triple-clic detection
  let clickCount = 0;
  let clickTimer = null;

  input.onclick = (e) => {
    clickCount++;
    if (clickCount === 1) {
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 500);
    } else if (clickCount === 3) {
      clearTimeout(clickTimer);
      clickCount = 0;
      enableFactureSecretMode();
    }
  };
}

function enableFactureSecretMode() {
  const input = document.getElementById('factureNumero');
  if (!input) return;

  if (input.classList.contains('secret-mode-active')) return;

  input.readOnly = false;
  input.classList.add('secret-mode-active');
  showToast('Mode modification de facture activé (Secret).', 'warning');
  
  input.focus();
  input.select();

  showFactureSuggestions();

  // Close suggestions on click outside
  const onOutsideClick = (e) => {
    if (!input.contains(e.target) && !e.target.closest('.facture-suggestions')) {
      const suggestions = document.querySelector('.facture-suggestions');
      if (suggestions) suggestions.remove();
      document.removeEventListener('click', onOutsideClick);
    }
  };
  // Timeout for avoid immediate closing
  setTimeout(() => document.addEventListener('click', onOutsideClick), 100);
}

function showFactureSuggestions() {
  const input = document.getElementById('factureNumero');
  const wrapper = input.closest('.facture-numero-wrapper');
  if (!input || !wrapper) return;

  // Remove existing
  const existing = wrapper.querySelector('.facture-suggestions');
  if (existing) existing.remove();

  const dateStr = document.getElementById('factureDate').value;
  const suggestions = getAvailableFactureNums(dateStr);

  if (suggestions.length === 0) return;

  const div = document.createElement('div');
  div.className = 'facture-suggestions';
  
  div.innerHTML = suggestions.map(s => `
    <div class="suggestion-item" onclick="selectFactureSuggestion('${s.value}')">
      <span class="suggestion-label">${s.value}</span>
      <span class="suggestion-type">${s.type}</span>
    </div>
  `).join('');

  wrapper.appendChild(div);
}

function selectFactureSuggestion(val) {
  const input = document.getElementById('factureNumero');
  if (input) {
    input.value = val;
    onFactureFormChange();
    const suggestions = document.querySelector('.facture-suggestions');
    if (suggestions) suggestions.remove();
  }
}

function getAvailableFactureNums(dateStr) {
  const settings = DB.getSettings();
  let format = settings.factureFormat || settings.facturePrefix || 'FACT-YYYY-######';

  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const yearFull = dateObj.getFullYear();
  const yearShort = String(yearFull).substring(2);

  format = format.replace('YYYY', yearFull).replace('YY', yearShort);

  const hashMatch = format.match(/#+/);
  if (!hashMatch) return [];

  const hashes = hashMatch[0];
  const padding = hashes.length;
  const prefixPart = format.substring(0, hashMatch.index);
  const suffixPart = format.substring(hashMatch.index + padding);

  const escapeRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('^' + escapeRegex(prefixPart) + '(\\d+)' + escapeRegex(suffixPart) + '$');

  const factures = DB.getFactures();
  const occupied = new Set();
  let maxNum = 0;

  factures.forEach(f => {
    const match = (f.numero || '').match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        occupied.add(num);
        if (num > maxNum) maxNum = num;
      }
    }
  });

  const suggestions = [];

  // 1. Prochain numéro
  const nextNum = maxNum + 1;
  const nextPadded = String(nextNum).padStart(padding, '0');
  suggestions.push({ value: prefixPart + nextPadded + suffixPart, type: 'Suivant' });

  // 2. Trous (gaps)
  // On cherche les trous de 1 à maxNum
  const gaps = [];
  for (let i = 1; i <= maxNum; i++) {
    if (!occupied.has(i)) {
      const padded = String(i).padStart(padding, '0');
      gaps.push({ value: prefixPart + padded + suffixPart, type: 'Trou' });
      if (gaps.length >= 5) break; // Limiter à 5 trous pour pas encombrer
    }
  }
  
  // Fusionner (trous d'abord car souvent plus pertinents pour corriger une erreur)
  return [...gaps, ...suggestions.filter(s => !gaps.find(g => g.value === s.value))];
}

// ===== SET FACTURE STATUS (via buttons) =====
function setFactureStatus(status) {
  const input = document.getElementById('factureStatut');
  if (input) input.value = status;

  // Update active class on buttons
  const container = document.getElementById('factureStatusBtnGroup');
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

  // Gestion du moyen de paiement selon le statut
  const paySel = document.getElementById('facturePaiement');
  if (paySel) {
    if (status === 'emise') {
      paySel.value = '';
    } else if (status === 'payee' && !paySel.value) {
      // Si on passe en acquittée et que rien n'est sélectionné, on met CB par défaut
      paySel.value = 'Carte bancaire';
    }
  }
  onFactureFormChange();
}

// ===== LOAD PATIENT SEANCES FOR FACTURE SELECTION =====
function loadPatientSeancesForFacture(preSelected) {
  const patientId = document.getElementById('facturePatient')?.value;
  const container = document.getElementById('factureSeancesSelect');
  if (!container) return;

  if (!patientId) {
    container.innerHTML = '<div class="empty-state-sm">Sélectionnez un patient d\'abord</div>';
    return;
  }

  const allFactures = DB.getFactures();
  const currentFactureId = document.getElementById('factureId').value;

  // Rassembler tous les IDs de séances déjà facturées (sauf celles de la facture actuelle si modif)
  const invoicedSeanceIds = new Set();
  allFactures.forEach(f => {
    if (f.id !== currentFactureId) {
      if (f.seanceIds) f.seanceIds.forEach(sid => invoicedSeanceIds.add(sid));
    }
  });

  const seances = DB.getSeancesByPatient(patientId)
    .filter(s => s.statut !== 'annulee' && !invoicedSeanceIds.has(s.id))
    .sort((a, b) => b.date > a.date ? 1 : -1);

  if (seances.length === 0) {
    container.innerHTML = '<div class="empty-state-sm">Aucune séance (non facturée) pour ce patient</div>';
    return;
  }

  container.innerHTML = seances.map(s => {
    const isChecked = preSelected && preSelected.includes(s.id);
    return `<div class="seance-checkbox-item">
      <input type="checkbox" id="cs_${s.id}" value="${s.id}" ${isChecked ? 'checked' : ''} onchange="updateFactureMontant(); onFactureFormChange()">
      <label for="cs_${s.id}">${formatDate(s.date)} ${s.heure || ''} — ${s.type || 'Standard'} — ${formatMontant(s.montant)}</label>
    </div>`;
  }).join('');

  // On ne recalcule automatiquement que pour une NOUVELLE facture
  const isNew = !document.getElementById('factureId').value;
  if (isNew) {
    updateFactureMontant();
  }
}

// ===== AUTO-CALCULATE MONTANT =====
function updateFactureMontant() {
  const checkboxes = document.querySelectorAll('#factureSeancesSelect input[type="checkbox"]:checked');
  let total = 0;
  checkboxes.forEach(cb => {
    const s = DB.getSeanceById(cb.value);
    if (s) total += parseFloat(s.montant) || 0;
  });
  document.getElementById('factureMontant').value = formatMontant(total);
}

// ===== SAVE FACTURE =====
function saveFacture() {
  const patientId = document.getElementById('facturePatient').value;
  const date = document.getElementById('factureDate').value;
  const numero = document.getElementById('factureNumero').value;
  const currentId = document.getElementById('factureId').value;

  // extraction du montant numérique depuis le format "xx,xx €"
  const montantRaw = document.getElementById('factureMontant').value || '0';
  const montant = parseFloat(montantRaw.replace(',', '.').replace(/[^-0-9.]/g, '')) || 0;

  if (!patientId) { showToast('Veuillez sélectionner un patient.', 'error'); return; }
  if (!date) { showToast('La date est obligatoire.', 'error'); return; }
  if (!numero) { showToast('Le numéro de facture est obligatoire.', 'error'); return; }
  if (isNaN(montant)) { showToast('Le montant est obligatoire.', 'error'); return; }

  // Vérification des doublons (si le numéro a été modifié)
  const isDuplicate = DB.getFactures().some(f => f.numero === numero && f.id !== currentId);
  if (isDuplicate) {
    showToast(`Le numéro de facture ${numero} est déjà utilisé.`, 'error');
    return;
  }

  // Collect selected seances
  const seanceIds = Array.from(document.querySelectorAll('#factureSeancesSelect input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  const data = {
    id: document.getElementById('factureId').value,
    numero: document.getElementById('factureNumero').value,
    date,
    patientId,
    seanceIds,
    montant,
    paiement: document.getElementById('facturePaiement').value,
    statut: document.getElementById('factureStatut').value,
    notes: document.getElementById('factureNotes').value.trim(),
  };

  if (data.id) {
    const result = DB.updateFacture(data);
    if (result && result.id) {
        document.getElementById('factureId').value = result.id;
    }
    showToast('Facture mise à jour.', 'success');
  } else {
    const result = DB.addFacture(data);
    if (result && result.id) {
        document.getElementById('factureId').value = result.id;
    }
    showToast('Facture enregistrée.', 'success');
  }

  updateFactureModalButtons(false);
  renderFactures();
  renderSeances();
  renderPatients();
  renderDashboard();
  if (typeof refreshPatientModal === 'function') refreshPatientModal();
}

// ===== MARK ACQUITTÉE =====
function markFacturePayee(id) {
  const f = DB.getFactureById(id);
  if (!f) return;
  f.statut = 'payee';
  DB.updateFacture(f);
  showToast('Facture marquée comme acquittée.', 'success');
  renderFactures();
  renderSeances();
  renderPatients();
  renderDashboard();
  if (typeof refreshPatientModal === 'function') refreshPatientModal();
}

// ===== DELETE =====
function deleteFacture(id) {
  if (!confirm('Supprimer cette facture ?')) return;
  DB.deleteFacture(id);
  showToast('Facture supprimée.', 'info');
  renderFactures();
  renderSeances();
  renderPatients();
  renderDashboard();
  if (typeof refreshPatientModal === 'function') refreshPatientModal();
}

// ===== PREVIEW FACTURE (dispatch vers template ou classique) =====
function previewFacture(id) {
  const settings = DB.getSettings();
  // Si un template a été configuré, utiliser le rendu template
  if (settings.invoiceTemplate && settings.invoiceTemplate.fields && settings.invoiceTemplate.fields.length > 0) {
    if (typeof previewFactureWithTemplate === 'function') {
      previewFactureWithTemplate(id);
      return;
    }
  }
  // Sinon rendu classique
  _previewFactureClassique(id);
}

// ===== PREVIEW CLASSIQUE (fallback) =====
function _previewFactureClassique(id) {
  const f = DB.getFactureById(id);
  if (!f) return;
  const patient = DB.getPatientById(f.patientId);
  const settings = DB.getSettings();
  const seances = (f.seanceIds || []).map(sid => DB.getSeanceById(sid)).filter(Boolean);

  const logoHtml = settings.logo
    ? `<img src="${settings.logo}" onerror="this.style.display='none'" alt="Logo">`
    : `<div class="no-logo">${settings.cabinetName || 'Cabinet Ostéopathique'}</div>`;

  const signatureHtml = settings.signature
    ? `<div class="invoice-signature">
        <div class="invoice-signature-block">
          <img src="${settings.signature}" onerror="this.style.display='none'" alt="Signature">
          <div class="sig-label">Signature</div>
          <div class="sig-name">${settings.osteoName || ''}</div>
        </div>
       </div>`
    : '';

  const paiements = (settings.paiements || []).filter(Boolean).join(', ') || 'Espèces, Chèque';

  const patientAddr = patient
    ? [
      `<strong>${formatNom(patient.nom)} ${formatPrenom(patient.prenom)}</strong>`,
      patient.adresse || '',
      [patient.codePostal, patient.ville].filter(Boolean).join(' '),
      patient.telephone || '',
      patient.email || '',
    ].filter(Boolean).join('<br>')
    : '<em>Patient inconnu</em>';

  const cabinetAddr = `
    <strong>${settings.osteoName || 'Ostéopathe D.O.'}</strong><br>
    ${settings.cabinetName ? settings.cabinetName + '<br>' : ''}
    ${(settings.address || '').replace(/\n/g, '<br>')}
    ${settings.phone ? '<br>' + settings.phone : ''}
    ${settings.email ? '<br>' + settings.email : ''}
    ${settings.adeli ? '<br>N° ADELI : ' + settings.adeli : ''}
    ${settings.siret ? '<br>SIRET : ' + settings.siret : ''}
  `;

  const lignes = seances.length > 0
    ? seances.map(s => `
      <tr>
        <td>${formatDateLong(s.date)}</td>
        <td>${s.type || 'Consultation ostéopathique'}</td>
        <td style="text-align:center">${s.duree || 45} min</td>
        <td>${formatMontant(s.montant)}</td>
      </tr>`).join('')
    : `<tr>
        <td colspan="3">Consultation ostéopathique</td>
        <td>${formatMontant(f.montant)}</td>
       </tr>`;

  const mentionLegale = settings.mentionLegale || 'Exonéré de TVA — Article 261-4-1° du CGI';

  const html = `
  <div class="invoice-preview" id="printableInvoice">
    <div class="invoice-header">
      <div class="invoice-logo">${logoHtml}</div>
      <div class="invoice-title-block">
        <div class="invoice-title">FACTURE</div>
        <div class="invoice-subtitle">${settings.cabinetName || 'Cabinet d\'Ostéopathie'}</div>
        <div class="invoice-num-block">
          <div><strong>N°</strong> ${f.numero}</div>
          <div><strong>Date :</strong> ${formatDateLong(f.date)}</div>
        </div>
      </div>
    </div>

    <div class="invoice-addresses">
      <div class="invoice-from">
        <h3>Émetteur</h3>
        <p>${cabinetAddr}</p>
      </div>
      <div class="invoice-to">
        <h3>Patient</h3>
        <p>${patientAddr}</p>
      </div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Prestation</th>
          <th style="text-align:center">Durée</th>
          <th style="text-align:right">Montant</th>
        </tr>
      </thead>
      <tbody>${lignes}</tbody>
    </table>

    <div class="invoice-total-block">
      <table class="invoice-total-table">
        <tr><td>Sous-total HT</td><td>${formatMontant(f.montant)}</td></tr>
        <tr><td>TVA</td><td>Exonérée</td></tr>
        <tr class="total-row"><td><strong>Total TTC</strong></td><td><strong>${formatMontant(f.montant)}</strong></td></tr>
      </table>
    </div>
    <div class="invoice-payment-info">
      <strong>Règlement :</strong> ${f.statut === 'emise' ? '—' : (f.paiement || '—')}
      ${f.notes ? `<p>${f.notes}</p>` : ''}
    </div>

    ${signatureHtml}

    <div class="invoice-footer">
      ${mentionLegale}
      ${settings.website ? ' · ' + settings.website : ''}
    </div>
  </div>
  `;

  document.getElementById('facturePreviewContent').innerHTML = html;
  
  // Mise à jour du titre de la modale avec info d'envoi
  const titleEl = document.querySelector('#modalFacturePreview h2');
  if (titleEl) {
    titleEl.innerHTML = `Aperçu de la facture ${f.sentAt ? `<span style="font-size:12px; font-weight:normal; color:#4f72c4; background:rgba(79,114,196,0.1); padding:2px 8px; border-radius:12px; margin-left:10px;">📧 Envoyée le ${formatDate(f.sentAt)}</span>` : ''}`;
  }

  _currentPreviewFactureId = id;
  openModal('modalFacturePreview');
}

// ===== EMAIL =====

function openEmailModal() {
  if (!_currentPreviewFactureId) return;
  const f = DB.getFactureById(_currentPreviewFactureId);
  if (!f) return;
  const patient = DB.getPatientById(f.patientId);
  const settings = DB.getSettings();

  // Pré-remplir le destinataire
  document.getElementById('emailTo').value = (patient && patient.email) ? patient.email : '';

  // Construire les variables de substitution
  const vars = {
    '{nom_patient}': patient ? formatNom(patient.nom) : '',
    '{prenom_patient}': patient ? formatPrenom(patient.prenom) : '',
    '{numero_facture}': f.numero || '',
    '{montant}': (f.montant || 0).toFixed(2),
    '{date_facture}': formatDateLong ? formatDateLong(f.date) : f.date,
    '{nom_cabinet}': settings.cabinetName || 'Cabinet Ostéopathique',
    '{nom_osteo}': settings.osteoName || '',
  };

  const applyVars = (tpl) => {
    let s = tpl || '';
    for (const [k, v] of Object.entries(vars)) s = s.split(k).join(v);
    return s;
  };

  // Objet par défaut
  const defaultSubject = settings.emailSubject ||
    `Votre facture n° ${f.numero} — ${settings.cabinetName || 'Cabinet Ostéopathique'}`;
  document.getElementById('emailSubject').value = applyVars(settings.emailSubject
    ? settings.emailSubject
    : `Votre facture n° {numero_facture} — {nom_cabinet}`);

  // Corps par défaut
  const defaultBody = settings.emailBody ||
    `Bonjour {prenom_patient} {nom_patient},

Veuillez trouver ci-joint la facture n° {numero_facture} d'un montant de {montant} € datée du {date_facture}.

N'hésitez pas à me contacter pour toute question.

Cordialement,
{nom_osteo}
{nom_cabinet}`;
  document.getElementById('emailBody').value = applyVars(defaultBody);

  // Toggle buttons based on SMTP config
  const smtpEmail = settings.smtpEmail;
  const smtpPass = settings.smtpPassword;
  const smtpEnabled = settings.smtpEnabled;

  if (smtpEnabled && smtpEmail && smtpPass) {
    document.getElementById('emailClientAddress').innerText = `(${smtpEmail})`;
    document.getElementById('emailAutoInfo').style.display = 'flex';
    document.getElementById('emailManualInfo').style.display = 'none';
    document.getElementById('btnSendEmailAuto').style.display = 'inline-flex';
    document.getElementById('btnSendGmailManual').classList.remove('btn-primary');
    document.getElementById('btnSendGmailManual').classList.add('btn-outline');
  } else {
    document.getElementById('emailAutoInfo').style.display = 'none';
    document.getElementById('emailManualInfo').style.display = 'flex';
    document.getElementById('btnSendEmailAuto').style.display = 'none';
    document.getElementById('btnSendGmailManual').classList.remove('btn-outline');
    document.getElementById('btnSendGmailManual').classList.add('btn-primary');
  }

  openModal('modalEmailFacture');
}

async function sendFactureAuto() {
  const to = document.getElementById('emailTo').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();

  if (!to) { showToast('Veuillez saisir l\'adresse email du destinataire.', 'error'); return; }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    showToast('Veuillez saisir une adresse email valide pour le destinataire.', 'error');
    document.getElementById('emailTo').focus();
    return;
  }

  const btn = document.getElementById('btnSendEmailAuto');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Envoi...';

  try {
    showToast("Génération du PDF et envoi...", "info");

    // 1. Generate PDF as base64
    const element = document.getElementById('printableInvoice');
    if (!element) throw new Error("Contenu de la facture introuvable.");

    element.classList.add('pdf-mode');
    const width = element.offsetWidth || 635;
    const height = element.offsetHeight || 897;

    const opt = {
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, width: width, height: height },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Obtenir le PDF en base64
    if (typeof html2pdf !== 'function') {
      throw new Error("La bibliothèque PDF n'est pas chargée (vérifiez votre connexion internet).");
    }
    const pdfBase64 = await html2pdf().set(opt).from(element).outputPdf('datauristring');
    element.classList.remove('pdf-mode');

    // 2. Send via backend
    const f = DB.getFactureById(_currentPreviewFactureId);
    const fileName = f ? `Facture_${f.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` : 'Facture.pdf';

    const response = await fetch('http://localhost:5180/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to,
        subject: subject,
        body: body,
        attachment: pdfBase64,
        filename: fileName
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Erreur lors de l'envoi");

    // Enregistrer la date d'envoi
    const f2 = DB.getFactureById(_currentPreviewFactureId);
    if (f2) {
      f2.sentAt = new Date().toISOString();
      DB.updateFacture(f2);
      renderFactures();
    }

    showToast("Email envoyé avec succès !", "success");
    closeModal('modalEmailFacture');
    // Rafraîchir l'aperçu pour montrer l'info d'envoi
    if (_currentPreviewFactureId) previewFacture(_currentPreviewFactureId);
  } catch (err) {
    console.error("Erreur envoi auto:", err);
    showToast(err.message || "Erreur lors de l'envoi automatique.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
    const element = document.getElementById('printableInvoice');
    if (element) element.classList.remove('pdf-mode');
  }
}

function sendFactureByGmail() {
  const to = document.getElementById('emailTo').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();

  if (!to) { showToast('Veuillez saisir l\'adresse email du destinataire.', 'error'); return; }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    showToast('Veuillez saisir une adresse email valide pour le destinataire.', 'error');
    document.getElementById('emailTo').focus();
    return;
  }

  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: to,
    su: subject,
    body: body,
  });

  const gmailUrl = 'https://mail.google.com/mail/?' + params.toString();
  window.open(gmailUrl, '_blank');

  // On considère qu'elle est envoyée si l'utilisateur a ouvert Gmail
  const f = DB.getFactureById(_currentPreviewFactureId);
  if (f) {
    f.sentAt = new Date().toISOString();
    DB.updateFacture(f);
    renderFactures();
  }

  closeModal('modalEmailFacture');
  showToast('Gmail ouvert. Facture marquée comme envoyée.', 'success');
  // Rafraîchir l'aperçu
  if (_currentPreviewFactureId) previewFacture(_currentPreviewFactureId);
}

// ===== PRINT =====
function printFacture() {
  const content = document.getElementById('printableInvoice');
  if (!content) return;

  const printWin = window.open('', '_blank', 'width=900,height=700');
  printWin.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 13px; background: white; color: #111; padding: 0; margin: 0; }
  .invoice-preview { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 20mm; box-shadow: none; border-radius: 0; }
  .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e0e8f0; }
  .invoice-logo img { max-height: 70px; max-width: 200px; }
  .no-logo { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #2c4a8c; }
  .invoice-title-block { text-align: right; }
  .invoice-title { font-size: 28px; font-weight: 700; color: #2c4a8c; }
  .invoice-subtitle { color: #666; font-size: 13px; margin-top: 2px; }
  .invoice-num-block { margin-top: 8px; font-size: 13px; }
  .invoice-num-block strong { color: #2c4a8c; }
  .invoice-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 28px; }
  .invoice-from h3, .invoice-to h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #a0a8b8; margin-bottom: 8px; }
  .invoice-from p, .invoice-to p { line-height: 1.8; color: #333; }
  .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .invoice-table th { background: #f0f5fc !important; -webkit-print-color-adjust: exact; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #4a6a9c; }
  .invoice-table th:last-child { text-align: right; }
  .invoice-table td { padding: 12px 14px; border-bottom: 1px solid #eef2f8; color: #333; }
  .invoice-table td:last-child { text-align: right; font-weight: 600; }
  .invoice-total-block { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .invoice-total-table { min-width: 260px; }
  .invoice-total-table td { padding: 5px 12px; color: #555; }
  .invoice-total-table td:last-child { text-align: right; font-weight: 600; }
  .invoice-total-table .total-row td { padding-top: 10px; font-size: 16px; font-weight: 700; color: #2c4a8c; border-top: 2px solid #2c4a8c; }
  .invoice-payment-info { background: #f8fbff !important; -webkit-print-color-adjust: exact; border: 1px solid #d8e8f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; font-size: 12.5px; }
  .invoice-payment-info strong { color: #2c4a8c; }
  .invoice-signature { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .invoice-signature-block { text-align: center; }
  .invoice-signature-block img { max-height: 70px; max-width: 160px; }
  .sig-label { font-size: 11px; color: #888; margin-top: 6px; }
  .sig-name { font-size: 13px; font-weight: 600; color: #333; }
  .invoice-footer { border-top: 1px solid #e0e8f0; padding-top: 16px; font-size: 11px; color: #888; text-align: center; line-height: 1.8; }
</style>
</head>
<body>
${content.outerHTML}
</body>
</html>`);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); printWin.close(); }, 600);
}

/**
 * Génère et télécharge la facture au format PDF
 */
function downloadFacturePDF() {
  const element = document.getElementById('printableInvoice');
  if (!element) {
    showToast("Erreur : contenu de la facture introuvable.", "error");
    return;
  }

  // Récupérer les infos pour le nom du fichier
  const f = DB.getFactureById(_currentPreviewFactureId);
  const fileName = f ? `Facture_${f.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` : 'Facture.pdf';

  showToast("Génération du PDF...", "info");

  // On passe en mode PDF (pas de marges, pleine page)
  element.classList.add('pdf-mode');
  const oldStyle = element.getAttribute('style');

  // On récupère les dimensions réelles de l'élément (template)
  // Si c'est un template custom, il a une largeur fixe (souvent 635px)
  const width = element.offsetWidth || 635;
  const height = element.offsetHeight || 897;

  if (oldStyle) {
    element.style.boxShadow = 'none';
    element.style.margin = '0';
  }

  const opt = {
    margin: 0,
    filename: fileName,
    image: { type: 'jpeg', quality: 1.0 },
    html2canvas: {
      scale: 3,
      useCORS: true,
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
      width: width,
      height: height
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: 'avoid-all' }
  };

  // Lancer la génération
  if (typeof html2pdf !== 'function') {
    showToast("La bibliothèque PDF n'est pas chargée (vérifiez votre connexion internet).", "error");
    element.classList.remove('pdf-mode');
    if (oldStyle) element.setAttribute('style', oldStyle);
    return;
  }
  html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
    element.classList.remove('pdf-mode');
    if (oldStyle) element.setAttribute('style', oldStyle);
  }).save()
    .then(() => {
      showToast("PDF téléchargé avec succès.", "success");
    })
    .catch(err => {
      console.error("Erreur PDF:", err);
      element.classList.remove('pdf-mode');
      if (oldStyle) element.setAttribute('style', oldStyle);
      showToast("Erreur lors de la génération du PDF.", "error");
    });
}

// Fin du fichier - Export global explicite
window.sendFactureAuto = sendFactureAuto;
window.sendFactureByGmail = sendFactureByGmail;
window.openFactureModal = openFactureModal;
window.previewFacture = previewFacture;
window.saveFacture = saveFacture;
window.markFacturePayee = markFacturePayee;
window.deleteFacture = deleteFacture;
window.downloadFacturePDF = downloadFacturePDF;
window.printFacture = printFacture;
window.openEmailModal = openEmailModal;
window.selectFactureSuggestion = selectFactureSuggestion;
window.initFactureSecretMode = initFactureSecretMode;
window.enableFactureSecretMode = enableFactureSecretMode;
