/* ============================================================
   TEMPLATE-EDITOR.JS — Éditeur visuel de template de facture
   ============================================================ */

// ── État global de l'éditeur ──────────────────────────────────
const TE = {
  // Template courant (champs positionnés)
  template: null,
  // Champ sélectionné
  selectedId: null,
  // Mode drag
  drag: { active: false, fieldId: null, startX: 0, startY: 0, origX: 0, origY: 0 },
  // Zoom
  zoom: 1.0,
  // Données de prévisualisation (exemple)
  sampleData: null,
};

function saveTemplateAndNotify() {
  saveTemplateToSettings();
  showToast('Template sauvegardé !', 'success');
}


// ── Champs disponibles ────────────────────────────────────────
const AVAILABLE_FIELDS = [
  // Entête cabinet
  { key: 'logo', label: '🖼 Logo', section: 'cabinet', type: 'image', defaultW: 180, defaultH: 70, defaultX: 20, defaultY: 20 },
  { key: 'cabinetName', label: '🏥 Nom cabinet', section: 'cabinet', type: 'text', defaultW: 280, defaultH: 28, defaultX: 20, defaultY: 100 },
  { key: 'osteoName', label: '👨‍⚕️ Praticien', section: 'cabinet', type: 'text', defaultW: 280, defaultH: 22, defaultX: 20, defaultY: 130 },
  { key: 'adeli', label: '🔢 N° ADELI', section: 'cabinet', type: 'text', defaultW: 200, defaultH: 20, defaultX: 20, defaultY: 155 },
  { key: 'siret', label: '🏢 N° SIRET', section: 'cabinet', type: 'text', defaultW: 200, defaultH: 20, defaultX: 20, defaultY: 178 },
  { key: 'cabinetAddress', label: '📍 Adresse cabinet', section: 'cabinet', type: 'text', defaultW: 220, defaultH: 60, defaultX: 20, defaultY: 178 },
  { key: 'cabinetPhone', label: '📞 Téléphone cabinet', section: 'cabinet', type: 'text', defaultW: 180, defaultH: 20, defaultX: 20, defaultY: 242 },
  { key: 'cabinetEmail', label: '✉️ Email cabinet', section: 'cabinet', type: 'text', defaultW: 220, defaultH: 20, defaultX: 20, defaultY: 265 },
  { key: 'cabinetWebsite', label: '🌐 Site web', section: 'cabinet', type: 'text', defaultW: 200, defaultH: 20, defaultX: 20, defaultY: 288 },
  // Titre facture
  { key: 'titleFacture', label: '📋 Titre FACTURE', section: 'facture', type: 'text', defaultW: 200, defaultH: 40, defaultX: 430, defaultY: 20 },
  { key: 'factureNumero', label: '🔖 N° de facture', section: 'facture', type: 'text', defaultW: 220, defaultH: 22, defaultX: 430, defaultY: 70 },
  { key: 'factureDate', label: '📅 Date facture', section: 'facture', type: 'text', defaultW: 220, defaultH: 22, defaultX: 430, defaultY: 96 },
  { key: 'statutFacture', label: '✅ Statut facture', section: 'facture', type: 'text', defaultW: 180, defaultH: 26, defaultX: 430, defaultY: 122 },
  // Patient
  { key: 'patientNom', label: '👤 Nom complet patient', section: 'patient', type: 'text', defaultW: 240, defaultH: 22, defaultX: 350, defaultY: 150 },
  { key: 'patientDateNaissance', label: '🎂 Date de naissance', section: 'patient', type: 'text', defaultW: 200, defaultH: 20, defaultX: 350, defaultY: 175 },
  { key: 'patientNss', label: '💳 N° Sécurité Sociale', section: 'patient', type: 'text', defaultW: 220, defaultH: 20, defaultX: 350, defaultY: 198 },
  { key: 'patientAdresse', label: '📍 Adresse patient', section: 'patient', type: 'text', defaultW: 240, defaultH: 40, defaultX: 350, defaultY: 222 },
  { key: 'patientVille', label: '🏙 CP + Ville patient', section: 'patient', type: 'text', defaultW: 240, defaultH: 20, defaultX: 350, defaultY: 265 },
  { key: 'patientPhone', label: '📞 Tél. patient', section: 'patient', type: 'text', defaultW: 200, defaultH: 20, defaultX: 350, defaultY: 286 },
  { key: 'patientEmail', label: '✉️ Email patient', section: 'patient', type: 'text', defaultW: 220, defaultH: 20, defaultX: 350, defaultY: 310 },
  // Tableau lignes
  { key: 'tableSeances', label: '📊 Tableau prestations', section: 'table', type: 'table', defaultW: 595, defaultH: 120, defaultX: 20, defaultY: 310 },
  // Totaux
  { key: 'totalHT', label: '💰 Total HT', section: 'totaux', type: 'text', defaultW: 200, defaultH: 22, defaultX: 415, defaultY: 450 },
  { key: 'tva', label: '🏷 TVA', section: 'totaux', type: 'text', defaultW: 200, defaultH: 22, defaultX: 415, defaultY: 476 },
  { key: 'totalTTC', label: '✅ Total TTC', section: 'totaux', type: 'text', defaultW: 200, defaultH: 30, defaultX: 415, defaultY: 506 },
  // Paiement & notes
  { key: 'paiement', label: '💳 Mode paiement', section: 'footer', type: 'text', defaultW: 400, defaultH: 30, defaultX: 20, defaultY: 560 },
  { key: 'notes', label: '📝 Notes facture', section: 'footer', type: 'text', defaultW: 400, defaultH: 50, defaultX: 20, defaultY: 600 },
  { key: 'signature', label: '✍️ Signature', section: 'footer', type: 'image', defaultW: 120, defaultH: 60, defaultX: 490, defaultY: 600 },
  { key: 'mentionLegale', label: '⚖️ Mention légale', section: 'footer', type: 'text', defaultW: 595, defaultH: 30, defaultX: 20, defaultY: 680 },
  // Déco
  { key: 'separatorLine', label: '── Ligne séparatrice', section: 'deco', type: 'divider', defaultW: 595, defaultH: 2, defaultX: 20, defaultY: 300 },
  { key: 'customText', label: '✏️ Texte libre', section: 'deco', type: 'custom', defaultW: 250, defaultH: 30, defaultX: 20, defaultY: 400 },
];

// Palette de sections
const SECTIONS_META = {
  cabinet: { label: '🏥 Cabinet', color: '#4e8cff' },
  facture: { label: '📋 Facture', color: '#8b5cf6' },
  patient: { label: '👤 Patient', color: '#f59e0b' },
  table: { label: '📊 Tableau', color: '#10b981' },
  totaux: { label: '💰 Totaux', color: '#ef4444' },
  footer: { label: '📄 Bas page', color: '#6b7280' },
  deco: { label: '🎨 Déco', color: '#ec4899' },
};

// ── Templates prédéfinis ──────────────────────────────────────
const DEFAULT_TEMPLATES = {
  classique: {
    name: 'Classique',
    accentColor: '#2c4a8c',
    fontFamily: 'Inter, sans-serif',
    borderStyle: 'none',
    background: '#ffffff',
    fields: []  // généré dynamiquement avec les defaults
  }
};

// ── INIT ──────────────────────────────────────────────────────
function initTemplateEditor() {
  TE.sampleData = buildSampleData();
  loadTemplateFromSettings();
  renderPalette();
  renderCanvas();
  bindCanvasEvents();
  updateZoomDisplay();
}

function buildSampleData() {
  const s = DB.getSettings();
  return {
    logo: s.logo || null,
    cabinetName: s.cabinetName || 'Cabinet d\'Ostéopathie',
    osteoName: s.osteoName || 'Dr Jean DUPONT D.O.',
    adeli: s.adeli || '12 34 56 789',
    siret: s.siret || '000 000 000 00000',
    cabinetAddress: (s.address || '12 rue de la Santé\n75001 Paris').replace(/\n/g, '<br>'),
    cabinetPhone: s.phone || '06 00 00 00 00',
    cabinetEmail: s.email || 'contact@cabinet.fr',
    cabinetWebsite: s.website || 'www.cabinet-osteo.fr',
    titleFacture: 'FACTURE',
    factureNumero: 'N° FACT-2024-001',
    factureDate: 'Le 25 février 2024',
    statutFacture: 'Acquittée',
    patientNom: 'MANGEARD Sébastien',
    patientDateNaissance: '26/03/1984',
    patientNss: '1 84 03 10 387 203 93',
    patientAdresse: '8 Rue Georges Wauters',
    patientVille: '10000 TROYES',
    patientPhone: '06 00 00 00 00',
    patientEmail: 'sebastien.mangeard@gmail.com',
    totalHT: 'Sous-total HT : 63,00 €',
    tva: 'TVA : Exonérée',
    totalTTC: 'TOTAL TTC : 63,00 €',
    paiement: 'Règlement : Chèque',
    notes: 'Merci pour votre confiance.',
    mentionLegale: s.mentionLegale || 'Exonéré de TVA — Article 261-4-1° du CGI',
    signature: s.signature || null,
    separatorLine: '',
    customText: 'Texte personnalisé',
    tableSeances: `<table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#f0f5fc;">
        <th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4a6a9c;">Date</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4a6a9c;">Prestation</th>
        <th style="padding:6px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4a6a9c;">Montant</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:8px 10px;border-bottom:1px solid #eef2f8">25/02/2024</td><td style="padding:8px 10px;border-bottom:1px solid #eef2f8">Consultation ostéopathique</td><td style="padding:8px 10px;text-align:right;font-weight:600;border-bottom:1px solid #eef2f8">63,00 €</td></tr>
      </tbody>
    </table>`,
  };
}

// ── TEMPLATE LOAD / SAVE ──────────────────────────────────────
function loadTemplateFromSettings() {
  const s = DB.getSettings();
  if (s.invoiceTemplate && s.invoiceTemplate.fields) {
    TE.template = JSON.parse(JSON.stringify(s.invoiceTemplate));
  } else {
    TE.template = buildDefaultTemplate();
    saveTemplateToSettings();
  }
}

function buildDefaultTemplate() {
  const s = DB.getSettings();
  const fields = AVAILABLE_FIELDS
    .filter(f => !['customText', 'separatorLine'].includes(f.key))
    .map(f => ({
      id: f.key + '_' + Date.now() + Math.random().toString(36).slice(2, 6),
      key: f.key,
      label: f.label,
      type: f.type,
      x: f.defaultX,
      y: f.defaultY,
      w: f.defaultW,
      h: f.defaultH,
      fontSize: f.type === 'text' ? (f.key === 'titleFacture' ? 28 : f.key === 'cabinetName' ? 16 : 12) : null,
      fontWeight: f.key === 'titleFacture' || f.key === 'cabinetName' || f.key === 'totalTTC' ? 'bold' : 'normal',
      color: f.key === 'titleFacture' ? (s.accentColor || '#2c4a8c') : (f.key === 'totalTTC' ? (s.accentColor || '#2c4a8c') : '#333333'),
      align: f.key === 'titleFacture' || f.key === 'factureNumero' || f.key === 'factureDate' ? 'right' : 'left',
      fontFamily: 'Inter, sans-serif',
      rotation: 0,
      visible: true,
      italic: false,
      underline: false,
      bgColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      padding: f.key === 'paiement' ? 12 : 0,
      customContent: f.key === 'customText' ? 'Texte libre' : null,
    }));

  return {
    name: 'Mon template',
    accentColor: s.accentColor || '#2c4a8c',
    fontFamily: 'Inter, sans-serif',
    background: '#ffffff',
    pageWidth: 635,   // A4 px équivalent (210mm @ 96dpi ≈ 794, scaled)
    pageHeight: 897,  // A4 px (297mm)
    fields,
  };
}

function saveTemplateToSettings() {
  const s = DB.getSettings();
  s.invoiceTemplate = JSON.parse(JSON.stringify(TE.template));
  DB.saveSettings(s);
}

// ── RENDU PALETTE ─────────────────────────────────────────────
function renderPalette() {
  const container = document.getElementById('tePalette');
  if (!container) return;

  // Grouper par section
  const bySection = {};
  AVAILABLE_FIELDS.forEach(f => {
    if (!bySection[f.section]) bySection[f.section] = [];
    bySection[f.section].push(f);
  });

  container.innerHTML = Object.entries(bySection).map(([sec, fields]) => {
    const meta = SECTIONS_META[sec] || { label: sec, color: '#666' };
    return `
    <div class="te-palette-section">
      <div class="te-palette-section-title" style="border-left-color:${meta.color}">
        ${meta.label}
      </div>
      <div class="te-palette-fields">
        ${fields.map(f => `
          <div class="te-palette-field" 
               draggable="true"
               data-field-key="${f.key}"
               title="Faire glisser sur la facture"
               ondragstart="onPaletteFieldDragStart(event, '${f.key}')">
            <span class="te-field-label">${f.label}</span>
            <button class="te-add-btn" onclick="addFieldToCanvas('${f.key}')" title="Ajouter">+</button>
          </div>
        `).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── RENDU CANVAS ──────────────────────────────────────────────
function renderCanvas() {
  const canvas = document.getElementById('teCanvas');
  if (!canvas || !TE.template) return;

  const t = TE.template;

  canvas.style.width = (t.pageWidth * TE.zoom) + 'px';
  canvas.style.height = (t.pageHeight * TE.zoom) + 'px';
  canvas.style.fontFamily = t.fontFamily || 'Inter, sans-serif';
  canvas.style.background = t.background || '#ffffff';
  canvas.style.transform = `scale(${TE.zoom})`;
  canvas.style.transformOrigin = 'top left';

  // Rendre chaque champ
  canvas.innerHTML = t.fields
    .filter(f => f.visible)
    .map(f => renderFieldElement(f, t))
    .join('');

  // Rebind resize handles et sélection
  canvas.querySelectorAll('.te-field').forEach(el => {
    const fid = el.dataset.fieldId;
    el.addEventListener('mousedown', (e) => onFieldMouseDown(e, fid));
  });

  highlightSelected();
}

function renderFieldElement(f, t) {
  const isSelected = TE.selectedId === f.id;
  const sampleVal = TE.sampleData[f.key] !== undefined ? TE.sampleData[f.key] : (f.customContent || '');

  let innerHtml = '';
  if (f.type === 'image') {
    const src = TE.sampleData[f.key];
    if (src) {
      innerHtml = `<img src="${src}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${f.key}"><div class="te-image-placeholder" style="display:none">${f.label} (Fichier manquant)</div>`;
    } else {
      innerHtml = `<div class="te-image-placeholder">${f.label}</div>`;
    }
  } else if (f.type === 'divider') {
    innerHtml = `<div style="width:100%;height:${Number(f.h) || 2}px;background:${f.color || '#d0d8e8'};"></div>`;
  } else if (f.type === 'table') {
    innerHtml = sampleVal;
  } else {
    // text / custom
    const fs = f.fontSize ? f.fontSize + 'px' : '12px';
    const fw = f.fontWeight || 'normal';
    const fc = f.color || '#333';
    const fi = f.italic ? 'italic' : 'normal';
    const td = f.underline ? 'underline' : 'none';
    const ta = f.align || 'left';
    const ff = f.fontFamily || t.fontFamily || 'Inter, sans-serif';
    const jc = ta === 'right' ? 'flex-end' : ta === 'center' ? 'center' : 'flex-start';
    // Le préfixe s'affiche avant la valeur du champ, avec son propre style si défini
    const prefixHtml = f.prefix
      ? `<span style="font-weight:${f.prefixBold ? 'bold' : fw};color:${f.prefixColor || fc};margin-right:3px;">${f.prefix}</span>`
      : '';
    innerHtml = `<div style="font-size:${fs};font-weight:${fw};color:${fc};font-style:${fi};text-decoration:${td};font-family:${ff};line-height:1.4;width:100%;height:100%;display:flex;align-items:center;justify-content:${jc};overflow:hidden;"><span style="text-align:${ta};width:100%;">${prefixHtml}${sampleVal}</span></div>`;
  }

  const bgStyle = f.bgColor && f.bgColor !== 'transparent' ? `background:${f.bgColor};` : '';
  // Forcer la conversion numérique pour éviter les comparaisons "0" > 0 (false) vs 0 > 0 (false OK)
  const bw = Number(f.borderWidth) || 0;
  const borderStyle = bw > 0 ? `border:${bw}px solid ${f.borderColor || '#cccccc'};` : '';
  const paddingStyle = f.padding ? `padding:${Number(f.padding) || 0}px;` : '';
  const shadow = isSelected ? 'box-shadow: 0 0 0 2px #4e8cff, 0 2px 8px rgba(78,140,255,0.25);' : '';

  return `
  <div class="te-field${isSelected ? ' te-field-selected' : ''}" 
       data-field-id="${f.id}"
       data-field-key="${f.key}"
       style="
         position:absolute;
         left:${f.x}px; top:${f.y}px;
         width:${f.w}px; height:${f.h}px;
         ${bgStyle}${borderStyle}${paddingStyle}${shadow}
         box-sizing:border-box;
         cursor:move;
         border-radius:${Number(f.borderRadius) || 0}px;
         overflow:hidden;
       ">
    ${innerHtml}
    ${isSelected ? '<div class="te-resize-handle te-resize-se" data-handle="se"></div>' : ''}
    ${isSelected ? '<div class="te-resize-handle te-resize-e" data-handle="e"></div>' : ''}
    ${isSelected ? '<div class="te-resize-handle te-resize-s" data-handle="s"></div>' : ''}
  </div>`;
}


// ── DRAG FROM PALETTE ─────────────────────────────────────────
let _paletteDragKey = null;

function onPaletteFieldDragStart(e, fieldKey) {
  _paletteDragKey = fieldKey;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', fieldKey);
}

function onCanvasDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

function onCanvasDrop(e) {
  e.preventDefault();
  if (!_paletteDragKey) return;
  const rect = document.getElementById('teCanvas').getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) / TE.zoom);
  const y = Math.round((e.clientY - rect.top) / TE.zoom);
  addFieldToCanvas(_paletteDragKey, x, y);
  _paletteDragKey = null;
}

// ── AJOUT CHAMP ───────────────────────────────────────────────
function addFieldToCanvas(fieldKey, x, y) {
  const meta = AVAILABLE_FIELDS.find(f => f.key === fieldKey);
  if (!meta) return;

  const existingCount = TE.template.fields.filter(f => f.key === fieldKey).length;
  // Pour les champs uniques (non deco), avertir mais autoriser
  const id = fieldKey + '_' + Date.now();

  const newField = {
    id,
    key: fieldKey,
    label: meta.label,
    type: meta.type,
    x: x !== undefined ? x : meta.defaultX,
    y: y !== undefined ? y : meta.defaultY,
    w: meta.defaultW,
    h: meta.defaultH,
    fontSize: meta.type === 'text' ? (fieldKey === 'titleFacture' ? 28 : fieldKey === 'cabinetName' ? 16 : 12) : null,
    fontWeight: fieldKey === 'titleFacture' || fieldKey === 'cabinetName' || fieldKey === 'totalTTC' ? 'bold' : 'normal',
    color: '#333333',
    align: 'left',
    fontFamily: TE.template.fontFamily || 'Inter, sans-serif',
    visible: true,
    italic: false,
    underline: false,
    bgColor: 'transparent',
    borderColor: '#cccccc',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    rotation: 0,
    customContent: fieldKey === 'customText' ? 'Mon texte personnalisé' : null,
  };

  TE.template.fields.push(newField);
  TE.selectedId = id;
  renderCanvas();
  renderPropertiesPanel();
  saveTemplateToSettings();
  showToast('Champ ajouté sur la facture.', 'success');
}

// ── EVENTS CANVAS ──────────────────────────────────────────────
function bindCanvasEvents() {
  const canvas = document.getElementById('teCanvas');
  if (!canvas) return;

  canvas.addEventListener('dragover', onCanvasDragOver);
  canvas.addEventListener('drop', onCanvasDrop);

  // Click sur zone vide déselectionne
  canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target.id === 'teCanvas') {
      TE.selectedId = null;
      renderCanvas();
      renderPropertiesPanel();
    }
  });

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

let _resizing = false;
let _resizeHandle = null;
let _resizeStart = {};

function onFieldMouseDown(e, fieldId) {
  e.stopPropagation();

  // Clic sur resize handle ?
  const handle = e.target.closest('.te-resize-handle');
  if (handle) {
    _resizing = true;
    _resizeHandle = handle.dataset.handle;
    const f = getField(fieldId);
    _resizeStart = { x: e.clientX, y: e.clientY, w: f.w, h: f.h };
    TE.selectedId = fieldId;
    return;
  }

  // Sélection + drag
  TE.selectedId = fieldId;
  renderCanvas();
  renderPropertiesPanel();

  const f = getField(fieldId);
  TE.drag = {
    active: true,
    fieldId,
    startX: e.clientX,
    startY: e.clientY,
    origX: f.x,
    origY: f.y,
  };
}

function onDragMove(e) {
  if (_resizing) {
    const f = getField(TE.selectedId);
    if (!f) return;
    const dx = (e.clientX - _resizeStart.x) / TE.zoom;
    const dy = (e.clientY - _resizeStart.y) / TE.zoom;
    if (_resizeHandle.includes('e')) f.w = Math.max(30, Math.round(_resizeStart.w + dx));
    if (_resizeHandle.includes('s')) f.h = Math.max(10, Math.round(_resizeStart.h + dy));
    renderCanvas();
    renderPropertiesPanel();
    return;
  }

  if (!TE.drag.active) return;
  const f = getField(TE.drag.fieldId);
  if (!f) return;
  const dx = (e.clientX - TE.drag.startX) / TE.zoom;
  const dy = (e.clientY - TE.drag.startY) / TE.zoom;
  f.x = Math.max(0, Math.round(TE.drag.origX + dx));
  f.y = Math.max(0, Math.round(TE.drag.origY + dy));

  // Mise à jour visuelle légère sans full re-render
  const el = document.querySelector(`[data-field-id="${TE.drag.fieldId}"]`);
  if (el) {
    el.style.left = f.x + 'px';
    el.style.top = f.y + 'px';
  }
  // Mettre à jour le panneau X/Y
  const px = document.getElementById('tePropX');
  const py = document.getElementById('tePropY');
  if (px) px.value = f.x;
  if (py) py.value = f.y;
}

function onDragEnd(e) {
  if (_resizing) {
    _resizing = false;
    _resizeHandle = null;
    saveTemplateToSettings();
    return;
  }
  if (!TE.drag.active) return;
  TE.drag.active = false;
  saveTemplateToSettings();
}

// ── PROPERTIES PANEL ──────────────────────────────────────────
function renderPropertiesPanel() {
  const panel = document.getElementById('tePropertiesPanel');
  if (!panel) return;

  if (!TE.selectedId) {
    panel.innerHTML = `
      <div class="te-props-empty">
        <div class="te-props-empty-icon">🖱</div>
        <p>Cliquez sur un champ pour<br>modifier ses propriétés</p>
      </div>`;
    return;
  }

  const f = getField(TE.selectedId);
  if (!f) { panel.innerHTML = ''; return; }

  const isText = ['text', 'custom'].includes(f.type);
  const isImage = f.type === 'image';
  const isDivider = f.type === 'divider';

  panel.innerHTML = `
    <div class="te-props-header">
      <span class="te-props-field-name">${f.label}</span>
      <button class="te-props-delete-btn" onclick="deleteSelectedField()" title="Supprimer ce champ">🗑</button>
    </div>

    <div class="te-props-section">
      <div class="te-props-section-title">📐 Position &amp; Taille</div>
      <div class="te-props-grid4">
        <div class="te-prop-group">
          <label>X (px)</label>
          <input type="number" id="tePropX" value="${f.x}" min="0" oninput="updateFieldProp('x', parseInt(this.value)||0)">
        </div>
        <div class="te-prop-group">
          <label>Y (px)</label>
          <input type="number" id="tePropY" value="${f.y}" min="0" oninput="updateFieldProp('y', parseInt(this.value)||0)">
        </div>
        <div class="te-prop-group">
          <label>Largeur</label>
          <input type="number" id="tePropW" value="${f.w}" min="10" oninput="updateFieldProp('w', parseInt(this.value)||50)">
        </div>
        <div class="te-prop-group">
          <label>Hauteur</label>
          <input type="number" id="tePropH" value="${f.h}" min="5" oninput="updateFieldProp('h', parseInt(this.value)||20)">
        </div>
      </div>
    </div>

    ${isText ? `
    <div class="te-props-section">
      <div class="te-props-section-title">🔤 Typographie</div>
      <div class="te-prop-group">
        <label>Police</label>
        <select oninput="updateFieldProp('fontFamily', this.value)">
          ${['Inter, sans-serif', 'Playfair Display, serif', 'Georgia, serif', 'Arial, sans-serif', 'Courier New, monospace'].map(ff =>
    `<option value="${ff}" ${f.fontFamily === ff ? 'selected' : ''}>${ff.split(',')[0]}</option>`
  ).join('')}
        </select>
      </div>
      <div class="te-props-grid4">
        <div class="te-prop-group">
          <label>Taille</label>
          <input type="number" value="${f.fontSize || 12}" min="6" max="72" oninput="updateFieldProp('fontSize', parseInt(this.value)||12)">
        </div>
        <div class="te-prop-group">
          <label>Couleur</label>
          <input type="color" value="${f.color || '#333333'}" oninput="updateFieldProp('color', this.value)">
        </div>
        <div class="te-prop-group">
          <label>Graisse</label>
          <select oninput="updateFieldProp('fontWeight', this.value)">
            <option value="normal" ${f.fontWeight !== 'bold' ? 'selected' : ''}>Normal</option>
            <option value="bold" ${f.fontWeight === 'bold' ? 'selected' : ''}>Gras</option>
          </select>
        </div>
        <div class="te-prop-group">
          <label>Alignement</label>
          <select oninput="updateFieldProp('align', this.value)">
            <option value="left" ${f.align === 'left' ? 'selected' : ''}>↤ Gauche</option>
            <option value="center" ${f.align === 'center' ? 'selected' : ''}>↔ Centre</option>
            <option value="right" ${f.align === 'right' ? 'selected' : ''}>↦ Droite</option>
          </select>
        </div>
      </div>
      <div class="te-props-toggles">
        <label class="te-toggle-label">
          <input type="checkbox" ${f.italic ? 'checked' : ''} onchange="updateFieldProp('italic', this.checked)"> Italique
        </label>
        <label class="te-toggle-label">
          <input type="checkbox" ${f.underline ? 'checked' : ''} onchange="updateFieldProp('underline', this.checked)"> Souligné
        </label>
      </div>
    </div>

    <div class="te-props-section">
      <div class="te-props-section-title">✍️ Préfixe du champ</div>
      <div class="te-prop-group">
        <label>Texte avant la valeur</label>
        <input type="text" value="${f.prefix || ''}" placeholder="ex: N° · Date : · Règl. :" oninput="updateFieldProp('prefix', this.value)">
      </div>
      <div class="te-props-grid4" style="margin-top:6px">
        <div class="te-prop-group">
          <label>Couleur préfixe</label>
          <input type="color" value="${f.prefixColor || f.color || '#333333'}" oninput="updateFieldProp('prefixColor', this.value)">
        </div>
        <div class="te-prop-group">
          <label>Gras</label>
          <input type="checkbox" ${f.prefixBold ? 'checked' : ''} onchange="updateFieldProp('prefixBold', this.checked)">
        </div>
      </div>
    </div>` : ''}

    ${f.type === 'custom' ? `
    <div class="te-props-section">
      <div class="te-props-section-title">✏️ Contenu</div>
      <div class="te-prop-group">
        <label>Texte libre</label>
        <textarea rows="3" oninput="updateFieldProp('customContent', this.value)">${f.customContent || ''}</textarea>
      </div>
    </div>` : ''}

    ${isDivider ? `
    <div class="te-props-section">
      <div class="te-props-section-title">🎨 Ligne</div>
      <div class="te-props-grid4">
        <div class="te-prop-group">
          <label>Couleur</label>
          <input type="color" value="${f.color || '#d0d8e8'}" oninput="updateFieldProp('color', this.value)">
        </div>
        <div class="te-prop-group">
          <label>Épaisseur</label>
          <input type="number" value="${f.h || 1}" min="1" max="8" oninput="updateFieldProp('h', parseInt(this.value)||1)">
        </div>
      </div>
    </div>` : ''}

    <div class="te-props-section">
      <div class="te-props-section-title">🎨 Fond &amp; Bordure</div>
      <div class="te-props-grid4">
        <div class="te-prop-group">
          <label>Fond</label>
          <input type="color" value="${f.bgColor && f.bgColor !== 'transparent' ? f.bgColor : '#ffffff'}" 
                 oninput="updateFieldProp('bgColor', this.value)">
        </div>
        <div class="te-prop-group">
          <label>Transparent</label>
          <input type="checkbox" ${!f.bgColor || f.bgColor === 'transparent' ? 'checked' : ''} 
                 onchange="updateFieldProp('bgColor', this.checked ? 'transparent' : '#ffffff')">
        </div>
        <div class="te-prop-group">
          <label>Couleur bord.</label>
          <input type="color" value="${f.borderColor || '#cccccc'}" oninput="updateFieldProp('borderColor', this.value)">
        </div>
        <div class="te-prop-group">
          <label>Ép. bord.</label>
          <input type="number" value="${f.borderWidth || 0}" min="0" max="8" oninput="updateFieldProp('borderWidth', parseInt(this.value)||0)">
        </div>
      </div>
      <div class="te-props-grid4">
        <div class="te-prop-group">
          <label>Rayon (px)</label>
          <input type="number" value="${f.borderRadius || 0}" min="0" max="40" oninput="updateFieldProp('borderRadius', parseInt(this.value)||0)">
        </div>
        <div class="te-prop-group">
          <label>Padding (px)</label>
          <input type="number" value="${f.padding || 0}" min="0" max="40" oninput="updateFieldProp('padding', parseInt(this.value)||0)">
        </div>
      </div>
    </div>

    <div class="te-props-section">
      <div class="te-props-section-title">👁 Visibilité</div>
      <label class="te-toggle-label">
        <input type="checkbox" ${f.visible ? 'checked' : ''} onchange="updateFieldProp('visible', this.checked)"> Champ visible
      </label>
    </div>

    <div class="te-props-actions">
      <button class="btn btn-sm btn-outline" onclick="duplicateSelectedField()">⧉ Dupliquer</button>
      <button class="btn btn-sm btn-outline" onclick="moveFieldLayer(-1)">▲ Monter</button>
      <button class="btn btn-sm btn-outline" onclick="moveFieldLayer(1)">▼ Descendre</button>
    </div>
  `;
}

// ── HELPERS ───────────────────────────────────────────────────
function getField(id) {
  if (!TE.template) return null;
  return TE.template.fields.find(f => f.id === id) || null;
}

function updateFieldProp(prop, value) {
  const f = getField(TE.selectedId);
  if (!f) return;
  f[prop] = value;
  if (prop === 'customContent') {
    TE.sampleData[f.key] = value;
  }
  renderCanvas();
  saveTemplateToSettings();
}

function deleteSelectedField() {
  if (!TE.selectedId) return;
  if (!confirm('Supprimer ce champ du template ?')) return;
  TE.template.fields = TE.template.fields.filter(f => f.id !== TE.selectedId);
  TE.selectedId = null;
  renderCanvas();
  renderPropertiesPanel();
  saveTemplateToSettings();
  showToast('Champ supprimé.', 'info');
}

function duplicateSelectedField() {
  const f = getField(TE.selectedId);
  if (!f) return;
  const clone = JSON.parse(JSON.stringify(f));
  clone.id = f.key + '_dup_' + Date.now();
  clone.x += 20; clone.y += 20;
  TE.template.fields.push(clone);
  TE.selectedId = clone.id;
  renderCanvas();
  renderPropertiesPanel();
  saveTemplateToSettings();
}

function moveFieldLayer(direction) {
  const idx = TE.template.fields.findIndex(f => f.id === TE.selectedId);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= TE.template.fields.length) return;
  const arr = TE.template.fields;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  renderCanvas();
  saveTemplateToSettings();
}

function highlightSelected() {
  // déjà géré dans renderCanvas via classes
}

// ── ZOOM ──────────────────────────────────────────────────────
function teZoomIn() {
  TE.zoom = Math.min(2.0, parseFloat((TE.zoom + 0.1).toFixed(1)));
  applyZoom();
}
function teZoomOut() {
  TE.zoom = Math.max(0.4, parseFloat((TE.zoom - 0.1).toFixed(1)));
  applyZoom();
}
function teZoomReset() {
  TE.zoom = 1.0;
  applyZoom();
}
function applyZoom() {
  updateZoomDisplay();
  const canvas = document.getElementById('teCanvas');
  if (!canvas) return;
  canvas.style.transform = `scale(${TE.zoom})`;
  canvas.style.transformOrigin = 'top left';
  // Adapter le wrapper
  const wrapper = document.getElementById('teCanvasWrapper');
  if (wrapper) {
    const t = TE.template;
    wrapper.style.minWidth = (t.pageWidth * TE.zoom) + 'px';
    wrapper.style.minHeight = (t.pageHeight * TE.zoom) + 'px';
  }
}
function updateZoomDisplay() {
  const el = document.getElementById('teZoomLabel');
  if (el) el.textContent = Math.round(TE.zoom * 100) + '%';
}

// ── GRILLE & SNAP ─────────────────────────────────────────────
let _snapEnabled = true;
const SNAP_SIZE = 5;
function toggleSnap() {
  _snapEnabled = !_snapEnabled;
  const btn = document.getElementById('teSnapBtn');
  if (btn) btn.classList.toggle('active', _snapEnabled);
  showToast(_snapEnabled ? 'Magnétisme activé' : 'Magnétisme désactivé', 'info');
}

// ── RESET TEMPLATE ────────────────────────────────────────────
function resetTemplateDefault() {
  if (!confirm('Réinitialiser le template aux valeurs par défaut ?')) return;
  TE.template = buildDefaultTemplate();
  TE.selectedId = null;
  saveTemplateToSettings();
  renderCanvas();
  renderPropertiesPanel();
  showToast('Template réinitialisé.', 'success');
}

// ── COULEUR ACCENT TEMPLATE ───────────────────────────────────
function updateTemplateAccentColor(color) {
  TE.template.accentColor = color;
  saveTemplateToSettings();
  renderCanvas();
}

function updateTemplateFontFamily(ff) {
  TE.template.fontFamily = ff;
  // Mettre à jour tous les champs texte
  TE.template.fields.forEach(f => { if (f.type === 'text' || f.type === 'custom') f.fontFamily = ff; });
  saveTemplateToSettings();
  renderCanvas();
}

function updateTemplateBg(color) {
  TE.template.background = color;
  saveTemplateToSettings();
  renderCanvas();
}

// ── EXPORT / IMPORT JSON ──────────────────────────────────────
function exportTemplateJSON() {
  const json = JSON.stringify(TE.template, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-facture.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Template exporté.', 'success');
}

function importTemplateJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.fields) throw new Error('Format invalide');
      TE.template = imported;
      TE.selectedId = null;
      saveTemplateToSettings();
      renderCanvas();
      renderPropertiesPanel();
      showToast('Template importé avec succès.', 'success');
    } catch (err) {
      showToast('Erreur : fichier JSON invalide.', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── APERÇU RÉEL depuis une facture ───────────────────────────
function previewFactureWithTemplate(id) {
  const f = DB.getFactureById(id);
  if (!f) return;
  const patient = DB.getPatientById(f.patientId);
  const settings = DB.getSettings();
  const seances = (f.seanceIds || []).map(sid => DB.getSeanceById(sid)).filter(Boolean);

  const template = settings.invoiceTemplate;
  if (!template || !template.fields) {
    previewFacture(id); // fallback
    return;
  }

  const lignes = seances.length > 0
    ? seances.map(s => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f8;">${formatDate(s.date)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f8;">${s.type || 'Consultation ostéopathique'}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:600;border-bottom:1px solid #eef2f8;">${formatMontant(s.montant)}</td>
      </tr>`).join('')
    : `<tr><td colspan="2" style="padding:8px 10px;">Consultation ostéopathique</td><td style="padding:8px 10px;text-align:right;font-weight:600;">${formatMontant(f.montant)}</td></tr>`;

  const realData = {
    logo: settings.logo || null,
    cabinetName: settings.cabinetName || '',
    osteoName: settings.osteoName || '',
    adeli: settings.adeli || '',
    siret: settings.siret || '',
    cabinetAddress: (settings.address || '').replace(/\n/g, '<br>'),
    cabinetPhone: settings.phone || '',
    cabinetEmail: settings.email || '',
    cabinetWebsite: settings.website || '',
    titleFacture: 'FACTURE',
    factureNumero: 'N° ' + (f.numero || ''),
    factureDate: 'Le ' + formatDateLong(f.date),
    statutFacture: f.statut === 'payee' ? (settings.labelPayee || 'Acquittée') : f.statut === 'emise' ? (settings.labelEmise || 'Émise') : (f.statut || ''),
    patientNom: patient ? `${formatNom(patient.nom)} ${formatPrenom(patient.prenom)}` : 'Patient inconnu',
    patientDateNaissance: patient && patient.dateNaissance ? formatDate(patient.dateNaissance) : '',
    patientNss: patient ? (patient.nss || '') : '',
    patientAdresse: patient ? (patient.adresse || '') : '',
    patientVille: patient ? [patient.codePostal, patient.ville].filter(Boolean).join(' ') : '',
    patientPhone: patient ? (patient.telephone || '') : '',
    patientEmail: patient ? (patient.email || '') : '',
    totalHT: 'Sous-total HT : ' + formatMontant(f.montant),
    tva: 'TVA : Exonérée',
    totalTTC: 'TOTAL TTC : ' + formatMontant(f.montant),
    paiement: 'Règlement : ' + (f.statut === 'emise' ? '—' : (f.paiement || '—')),
    notes: f.notes || '',
    mentionLegale: settings.mentionLegale || 'Exonéré de TVA — Article 261-4-1° du CGI',
    signature: settings.signature || null,
    separatorLine: '',
    customText: '',
    tableSeances: `<table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#f0f5fc;">
        <th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4a6a9c;">Date</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4a6a9c;">Prestation</th>
        <th style="padding:6px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4a6a9c;">Montant</th>
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table>`,
  };

  // Générer le HTML à partir du template
  const fieldsHtml = template.fields
    .filter(f2 => f2.visible)
    .map(f2 => renderFieldWithData(f2, realData))
    .join('');

  const html = `
  <div class="invoice-preview" id="printableInvoice" style="
    position:relative;
    width:${template.pageWidth || 635}px;
    height:${template.pageHeight || 897}px;
    background:${template.background || '#fff'};
    font-family:${template.fontFamily || 'Inter, sans-serif'};
    overflow:hidden;
    margin:0 auto;
    box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  ">
    ${fieldsHtml}
  </div>`;

  document.getElementById('facturePreviewContent').innerHTML = html;
  
  // Mise à jour du titre de la modale avec info d'envoi
  const titleEl = document.querySelector('#modalFacturePreview h2');
  if (titleEl) {
    titleEl.innerHTML = `Aperçu de la facture ${f.sentAt ? `<span style="font-size:12px; font-weight:normal; color:#4f72c4; background:rgba(79,114,196,0.1); padding:2px 8px; border-radius:12px; margin-left:10px;">📧 Envoyée le ${formatDate(f.sentAt)}</span>` : ''}`;
  }

  _currentPreviewFactureId = id;
  openModal('modalFacturePreview');
}

function renderFieldWithData(f, data) {
  const val = data[f.key] !== undefined ? data[f.key] : (f.customContent || '');

  let innerHtml = '';
  if (f.type === 'image') {
    const src = data[f.key];
    if (src) {
      innerHtml = `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${f.key}">`;
    }
  } else if (f.type === 'divider') {
    innerHtml = `<div style="width:100%;height:${Number(f.h) || 2}px;background:${f.color || '#d0d8e8'};"></div>`;
  } else if (f.type === 'table') {
    innerHtml = val;
  } else {
    const fs = f.fontSize ? f.fontSize + 'px' : '12px';
    const fw = f.fontWeight || 'normal';
    const fc = f.color || '#333';
    const fi = f.italic ? 'italic' : 'normal';
    const td = f.underline ? 'underline' : 'none';
    const ta = f.align || 'left';
    const ff = f.fontFamily || 'Inter, sans-serif';
    const jc = ta === 'right' ? 'flex-end' : ta === 'center' ? 'center' : 'flex-start';
    // Préfixe : s'affiche avant la valeur avec son propre style
    const prefixHtml = f.prefix
      ? `<span style="font-weight:${f.prefixBold ? 'bold' : fw};color:${f.prefixColor || fc};margin-right:3px;">${f.prefix}</span>`
      : '';
    innerHtml = `<div style="font-size:${fs};font-weight:${fw};color:${fc};font-style:${fi};text-decoration:${td};font-family:${ff};line-height:1.4;width:100%;height:100%;display:flex;align-items:center;justify-content:${jc};overflow:hidden;"><span style="text-align:${ta};width:100%;">${prefixHtml}${val}</span></div>`;
  }

  const bgStyle = f.bgColor && f.bgColor !== 'transparent' ? `background:${f.bgColor};` : '';
  const bw = Number(f.borderWidth) || 0;
  const borderStyle = bw > 0 ? `border:${bw}px solid ${f.borderColor || '#cccccc'};` : '';
  const paddingStyle = f.padding ? `padding:${Number(f.padding) || 0}px;` : '';

  return `<div style="position:absolute;left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px;${bgStyle}${borderStyle}${paddingStyle}box-sizing:border-box;border-radius:${Number(f.borderRadius) || 0}px;overflow:hidden;">${innerHtml}</div>`;
}

// ── PRINT depuis template ─────────────────────────────────────
function printFactureWithTemplate() {
  const content = document.getElementById('printableInvoice');
  if (!content) { printFacture(); return; }

  const settings = DB.getSettings();
  const template = settings.invoiceTemplate;

  const designWidth = template.pageWidth || 635;
  const scale = 794 / designWidth;

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
  body { background: white; margin: 0; padding: 0; overflow: hidden; }
  #printableInvoice { 
    box-shadow: none !important; 
    margin: 0 !important; 
    transform: scale(${scale});
    transform-origin: top left;
  }
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
