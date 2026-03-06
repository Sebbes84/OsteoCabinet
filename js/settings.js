/* ============================================================
   SETTINGS.JS — Paramètres du cabinet
   ============================================================ */

// ===== LOAD =====
function loadSettings() {
    const s = DB.getSettings();

    document.getElementById('settingCabinetName').value = s.cabinetName || '';
    document.getElementById('settingOsteoName').value = s.osteoName || '';
    document.getElementById('settingAdeli').value = s.adeli || '';
    document.getElementById('settingSiret').value = s.siret || '';
    document.getElementById('settingAddress').value = s.address || '';
    document.getElementById('settingPhone').value = s.phone || '';
    document.getElementById('settingEmail').value = s.email || '';
    document.getElementById('settingWebsite').value = s.website || '';
    document.getElementById('settingFactureFormat').value = s.factureFormat || s.facturePrefix || 'FACT-YYYY-######';
    document.getElementById('settingMentionLegale').value = s.mentionLegale || 'Exonéré de TVA — Article 261-4-1° du CGI';
    document.getElementById('settingLabelEmise').value = s.labelEmise || 'Émise';
    document.getElementById('settingLabelPayee').value = s.labelPayee || 'Acquittée';
    document.getElementById('settingEmailSubject').value = s.emailSubject || '';
    document.getElementById('settingEmailBody').value = s.emailBody || '';
    document.getElementById('settingBackupFrequency').value = s.backupFrequency || 'none';
    document.getElementById('settingBackupPath').value = s.backupPath || '';

    // Load version
    fetch('http://localhost:5180/api/version')
        .then(res => res.json())
        .then(data => {
            document.getElementById('currentVersionDisplay').textContent = data.version || '1.1.0';
        });

    const lastBackup = s.lastBackupDate ? formatDateLong(s.lastBackupDate) : 'Jamais';
    document.getElementById('lastBackupDisplay').textContent = lastBackup;

    // Logo
    if (s.logo) {
        const img = document.getElementById('logoPreview');
        // Ajouter cache-buster si c'est un chemin fichier (pas base64)
        img.src = s.logo.startsWith('data:') ? s.logo : s.logo + '?t=' + Date.now();
        img.style.display = 'block';
        document.getElementById('logoPlaceholder').style.display = 'none';
        document.getElementById('removeLogoBtn').style.display = 'inline-flex';
    } else {
        document.getElementById('logoPreview').style.display = 'none';
        document.getElementById('logoPlaceholder').style.display = '';
        document.getElementById('removeLogoBtn').style.display = 'none';
    }

    // Signature
    if (s.signature) {
        const img = document.getElementById('signaturePreview');
        // Ajouter cache-buster si c'est un chemin fichier (pas base64)
        img.src = s.signature.startsWith('data:') ? s.signature : s.signature + '?t=' + Date.now();
        img.style.display = 'block';
        document.getElementById('signaturePlaceholder').style.display = 'none';
        document.getElementById('removeSignatureBtn').style.display = 'inline-flex';
    } else {
        document.getElementById('signaturePreview').style.display = 'none';
        document.getElementById('signaturePlaceholder').style.display = '';
        document.getElementById('removeSignatureBtn').style.display = 'none';
    }

    // Paiements
    const paiements = s.paiements || [];
    document.getElementById('payEspeces').checked = paiements.includes('Espèces');
    document.getElementById('payCheque').checked = paiements.includes('Chèque');
    document.getElementById('payVirement').checked = paiements.includes('Virement bancaire');
    document.getElementById('payCarte').checked = paiements.includes('Carte bancaire');
    document.getElementById('payPaypal').checked = paiements.includes('PayPal');
    document.getElementById('payVitalaire').checked = paiements.includes('Vitalaire');

    // Types de séances
    renderTypeSeances(s.typesSeances || []);
}

// ===== SAVE =====
function saveSettings() {
    const current = DB.getSettings();

    const paiements = [];
    if (document.getElementById('payEspeces').checked) paiements.push('Espèces');
    if (document.getElementById('payCheque').checked) paiements.push('Chèque');
    if (document.getElementById('payVirement').checked) paiements.push('Virement bancaire');
    if (document.getElementById('payCarte').checked) paiements.push('Carte bancaire');
    if (document.getElementById('payPaypal').checked) paiements.push('PayPal');
    if (document.getElementById('payVitalaire').checked) paiements.push('Vitalaire');

    const settings = {
        ...current,
        cabinetName: document.getElementById('settingCabinetName').value.trim(),
        osteoName: document.getElementById('settingOsteoName').value.trim(),
        adeli: document.getElementById('settingAdeli').value.trim(),
        siret: document.getElementById('settingSiret').value.trim(),
        address: document.getElementById('settingAddress').value.trim(),
        phone: document.getElementById('settingPhone').value.trim(),
        email: document.getElementById('settingEmail').value.trim(),
        website: document.getElementById('settingWebsite').value.trim(),
        factureFormat: document.getElementById('settingFactureFormat').value.trim() || 'FACT-YYYY-######',
        mentionLegale: document.getElementById('settingMentionLegale').value.trim(),
        labelEmise: document.getElementById('settingLabelEmise').value.trim() || 'Émise',
        labelPayee: document.getElementById('settingLabelPayee').value.trim() || 'Acquittée',
        emailSubject: document.getElementById('settingEmailSubject').value.trim(),
        emailBody: document.getElementById('settingEmailBody').value.trim(),
        backupFrequency: document.getElementById('settingBackupFrequency').value,
        backupPath: document.getElementById('settingBackupPath').value.trim(),
        paiements,
    };

    DB.saveSettings(settings);

    // Update sidebar
    const el = document.getElementById('sidebarCabinetName');
    if (el) el.textContent = settings.cabinetName || 'Cabinet Ostéopathique';

    showToast('Paramètres enregistrés !', 'success');
}

// ===== LOGO =====
async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Renommer le fichier en logo.png sur le serveur
    const formData = new FormData();
    formData.append('file', file, 'logo.png');

    try {
        const res = await fetch('http://localhost:5180/api/upload-image', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Erreur upload');
        const json = await res.json();
        const path = json.path; // 'images/logo.png'

        const img = document.getElementById('logoPreview');
        img.src = path + '?t=' + Date.now(); // cache-buster
        img.style.display = 'block';
        document.getElementById('logoPlaceholder').style.display = 'none';
        document.getElementById('removeLogoBtn').style.display = 'inline-flex';

        const settings = DB.getSettings();
        settings.logo = path;
        DB.saveSettings(settings);
        showToast('Logo enregistré.', 'success');
    } catch (e) {
        showToast('Erreur lors de l\'enregistrement du logo.', 'error');
    }
}

function removeLogo() {
    document.getElementById('logoPreview').style.display = 'none';
    document.getElementById('logoPreview').src = '';
    document.getElementById('logoPlaceholder').style.display = '';
    document.getElementById('removeLogoBtn').style.display = 'none';
    const settings = DB.getSettings();
    delete settings.logo;
    DB.saveSettings(settings);
    showToast('Logo supprimé.', 'info');
}

// ===== SIGNATURE =====
async function handleSignatureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Renommer le fichier en signature.png sur le serveur
    const formData = new FormData();
    formData.append('file', file, 'signature.png');

    try {
        const res = await fetch('http://localhost:5180/api/upload-image', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Erreur upload');
        const json = await res.json();
        const path = json.path; // 'images/signature.png'

        const img = document.getElementById('signaturePreview');
        img.src = path + '?t=' + Date.now(); // cache-buster
        img.style.display = 'block';
        document.getElementById('signaturePlaceholder').style.display = 'none';
        document.getElementById('removeSignatureBtn').style.display = 'inline-flex';

        const settings = DB.getSettings();
        settings.signature = path;
        DB.saveSettings(settings);
        showToast('Signature enregistrée.', 'success');
    } catch (e) {
        showToast('Erreur lors de l\'enregistrement de la signature.', 'error');
    }
}

function removeSignature() {
    document.getElementById('signaturePreview').style.display = 'none';
    document.getElementById('signaturePreview').src = '';
    document.getElementById('signaturePlaceholder').style.display = '';
    document.getElementById('removeSignatureBtn').style.display = 'none';
    const settings = DB.getSettings();
    delete settings.signature;
    DB.saveSettings(settings);
    showToast('Signature supprimée.', 'info');
}

// ===== TYPES DE SÉANCES =====
function renderTypeSeances(types) {
    const el = document.getElementById('typeSeancesList');
    if (!el) return;
    if (types.length === 0) {
        el.innerHTML = '<div class="empty-state-sm">Aucun type personnalisé.</div>';
        return;
    }
    el.innerHTML = types.map((t, i) => `
    <div class="type-seance-item">
      <div class="type-seance-main">
        <div class="type-seance-info">${t.nom}</div>
        <div class="type-seance-tarif">⏱ ${t.duree || '?'} min · 💶 ${t.tarif} €</div>
      </div>
      <div class="actions">
        <button class="btn btn-sm btn-outline" onclick="editTypeSeance(${i})" title="Modifier">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="removeTypeSeance(${i})" title="Supprimer">🗑</button>
      </div>
    </div>
  `).join('');
}

function addTypeSeance() {
    const nom = document.getElementById('newTypeNom').value.trim();
    const duree = parseInt(document.getElementById('newTypeDuree').value);
    const tarif = parseFloat(document.getElementById('newTypeTarif').value);
    const editIndex = parseInt(document.getElementById('editTypeIndex').value);

    if (!nom) { showToast('Saisissez un nom de type.', 'error'); return; }
    if (isNaN(duree)) { showToast('Saisissez une durée valide.', 'error'); return; }
    if (isNaN(tarif)) { showToast('Saisissez un tarif valide.', 'error'); return; }

    const settings = DB.getSettings();
    if (!settings.typesSeances) settings.typesSeances = [];

    if (editIndex >= 0) {
        settings.typesSeances[editIndex] = { nom, duree, tarif };
        showToast('Type de séance modifié.', 'success');
    } else {
        settings.typesSeances.push({ nom, duree, tarif });
        showToast('Type de séance ajouté.', 'success');
    }

    DB.saveSettings(settings);
    cancelTypeEdit();
    renderTypeSeances(settings.typesSeances);
}

function editTypeSeance(index) {
    const settings = DB.getSettings();
    const t = settings.typesSeances[index];
    if (!t) return;

    document.getElementById('newTypeNom').value = t.nom;
    document.getElementById('newTypeDuree').value = t.duree || '';
    document.getElementById('newTypeTarif').value = t.tarif;
    document.getElementById('editTypeIndex').value = index;

    document.getElementById('typeSeanceFormTitle').textContent = 'Modifier le type de séance';
    document.getElementById('btnSaveTypeText').textContent = 'Enregistrer';
    document.getElementById('btnSaveTypeSeance').querySelector('.btn-icon').textContent = '💾';
    document.getElementById('btnCancelTypeEdit').style.display = 'inline-block';
}

function cancelTypeEdit() {
    document.getElementById('newTypeNom').value = '';
    document.getElementById('newTypeDuree').value = '';
    document.getElementById('newTypeTarif').value = '';
    document.getElementById('editTypeIndex').value = '-1';

    document.getElementById('typeSeanceFormTitle').textContent = 'Ajouter un type de séance';
    document.getElementById('btnSaveTypeText').textContent = 'Ajouter';
    document.getElementById('btnSaveTypeSeance').querySelector('.btn-icon').textContent = '➕';
    document.getElementById('btnCancelTypeEdit').style.display = 'none';
}

function removeTypeSeance(index) {
    if (!confirm('Supprimer ce type de séance ?')) return;
    const settings = DB.getSettings();
    settings.typesSeances.splice(index, 1);
    DB.saveSettings(settings);
    renderTypeSeances(settings.typesSeances);
    showToast('Type de séance supprimé.', 'info');
}

// ===== BACKUP =====
async function triggerManualBackup() {
    try {
        showToast('Sauvegarde en cours...', 'info');
        const res = await fetch('http://localhost:5180/api/backup', {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Erreur backup');
        const json = await res.json();

        const settings = DB.getSettings();
        settings.lastBackupDate = new Date().toISOString();
        DB.saveSettings(settings);

        const lastBackupStr = formatDateLong(settings.lastBackupDate);
        const displayEl = document.getElementById('lastBackupDisplay');
        if (displayEl) displayEl.textContent = lastBackupStr;

        // Retirer l'alerte si elle est affichée
        const alert = document.querySelector('.global-alert');
        if (alert) alert.remove();

        showToast(`Sauvegarde effectuée avec succès.`, 'success');
    } catch (e) {
        console.error(e);
        showToast('Erreur lors de la sauvegarde.', 'error');
    }
}

/**
 * Vérifie si une sauvegarde est nécessaire selon la périodicité
 * Appelé au démarrage de l'app (app.js)
 */
function checkBackupReminder() {
    const s = DB.getSettings();
    const frequency = s.backupFrequency || 'none';
    if (frequency === 'none') return;

    const last = s.lastBackupDate ? new Date(s.lastBackupDate) : null;
    const now = new Date();

    let needsBackup = false;
    if (!last) {
        needsBackup = true;
    } else {
        const diffDays = (now - last) / (1000 * 60 * 60 * 24);
        if (frequency === 'daily' && diffDays >= 1) needsBackup = true;
        if (frequency === 'weekly' && diffDays >= 7) needsBackup = true;
        if (frequency === 'monthly' && diffDays >= 30) needsBackup = true;
    }

    if (needsBackup) {
        const area = document.getElementById('globalAlertArea');
        if (area) {
            area.innerHTML = `
                <div class="global-alert">
                    <div class="global-alert-content">
                        <span class="global-alert-icon">🛡️</span>
                        <span>La dernière sauvegarde de votre base de données est trop ancienne. Pensez à sécuriser vos données !</span>
                    </div>
                    <div class="global-alert-actions">
                        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2); color:white; border:1px solid rgba(255,255,255,0.4);" onclick="triggerManualBackup()">
                            Sauvegarder maintenant
                        </button>
                        <button class="btn btn-sm btn-outline" style="color:white; border-color:rgba(255,255,255,0.5);" onclick="this.closest('.global-alert').remove()">
                            Plus tard
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

/**
 * Importe un fichier de sauvegarde (.db)
 */
async function importBackup(input) {
    const file = input.files[0];
    if (!file) return;

    if (!confirm("⚠️ ATTENTION : L'importation d'une sauvegarde remplacera TOUTES les données actuelles. Cette action est irréversible.\n\nSouhaitez-vous continuer ?")) {
        input.value = '';
        return;
    }

    try {
        showToast('Importation en cours...', 'info');

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('http://localhost:5180/api/restore-backup', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erreur lors de l\'importation');
        }

        showToast('Données importées avec succès ! Redémarrage...', 'success');

        // On attend un peu pour que le toast soit visible puis on recharge
        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (e) {
        console.error(e);
        showToast(e.message || 'Erreur lors de l\'importation.', 'error');
        input.value = '';
    }
}

/**
 * Ouvre l'explorateur de fichiers pour choisir un dossier
 */
async function browseBackupFolder() {
    try {
        const res = await fetch('http://localhost:5180/api/browse-folder');
        const json = await res.json();
        if (json.path) {
            document.getElementById('settingBackupPath').value = json.path;
            showToast('Dossier sélectionné. N\'oubliez pas d\'enregistrer les paramètres.', 'info');
        }
    } catch (e) {
        showToast('Impossible d\'ouvrir l\'explorateur de dossiers.', 'error');
    }
}

/**
 * Réinitialise le dossier de sauvegarde par défaut
 */
function resetBackupFolder() {
    document.getElementById('settingBackupPath').value = '';
    showToast('Dossier par défaut rétabli (sous-dossier /backups).', 'info');
}

const GITHUB_REPO = 'Sebbes84/OsteoCabinet';
let _latestUpdateData = null;

async function checkUpdate() {
    try {
        const btn = document.getElementById('btnCheckUpdate');
        btn.disabled = true;
        btn.textContent = '⏳ Vérification...';

        const res = await fetch(`http://localhost:5180/api/check-update?repo=${GITHUB_REPO}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        const current = document.getElementById('currentVersionDisplay').textContent;
        if (data.tag !== current) {
            _latestUpdateData = data;
            document.getElementById('updateAvailableArea').style.display = 'block';
            document.getElementById('updateVersionInfo').innerHTML = `
                <strong>Version :</strong> ${data.tag}<br>
                <strong>Nom :</strong> ${data.name || data.tag}<br>
                <div style="margin-top:5px; font-size:11px; max-height:100px; overflow-y:auto; color:var(--text-muted)">
                    ${data.body || 'Aucune note de version.'}
                </div>
            `;
            showToast('Une mise à jour est disponible !', 'success');
        } else {
            showToast('Logiciel à jour.', 'success');
        }
    } catch (e) {
        console.error(e);
        showToast('Erreur lors de la vérification : ' + e.message, 'error');
    } finally {
        const btn = document.getElementById('btnCheckUpdate');
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🔄</span> Vérifier les mises à jour';
    }
}

async function applyUpdate() {
    if (!_latestUpdateData) return;
    if (!confirm('Souhaitez-vous installer la mise à jour ? Une sauvegarde sera effectuée avant.')) return;

    try {
        const btn = document.getElementById('btnApplyUpdate');
        btn.disabled = true;
        btn.textContent = '⏳ Installation en cours...';

        // 1. Backup first
        await triggerManualBackup();

        // 2. Apply update
        const res = await fetch('http://localhost:5180/api/apply-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                zip_url: _latestUpdateData.zip_url,
                tag: _latestUpdateData.tag
            })
        });

        if (!res.ok) throw new Error('Erreur lors de l\'application de la mise à jour');

        showToast('Mise à jour installée avec succès ! Redémarrage...', 'success');
        setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
        console.error(e);
        showToast('Erreur lors de l\'installation : ' + e.message, 'error');
        const btn = document.getElementById('btnApplyUpdate');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🚀 Installer la mise à jour';
        }
    }
}

/**
 * Vérifie silencieusement au démarrage et périodiquement si une mise à jour est disponible
 */
async function checkUpdateReminder() {
    try {
        const currentVersionRes = await fetch('http://localhost:5180/api/version');
        const currentVersionData = await currentVersionRes.json();
        const currentVersion = currentVersionData.version || '1.1.0';

        const res = await fetch(`http://localhost:5180/api/check-update?repo=${GITHUB_REPO}`);
        const data = await res.json();

        if (data.tag && data.tag !== currentVersion) {
            _latestUpdateData = data;
            const area = document.getElementById('globalAlertArea');
            if (area) {
                const existing = area.querySelector('.update-alert');
                if (existing) existing.remove();

                const div = document.createElement('div');
                div.className = 'global-alert update-alert';
                div.style.background = 'linear-gradient(135deg, #6b8dd6, #8b5cf6)';
                div.style.border = '1px solid rgba(255,255,255,0.2)';
                div.style.marginTop = '10px';
                div.innerHTML = `
                    <div class="global-alert-content">
                        <span class="global-alert-icon">🚀</span>
                        <span>Dernière version <strong>${data.tag}</strong> disponible !</span>
                    </div>
                    <div class="global-alert-actions" style="margin-left: auto;">
                        <button class="btn btn-primary btn-sm" style="background:white; color:#4f72c4; font-weight:700;" onclick="applyUpdate()">
                            Installer maintenant
                        </button>
                    </div>
                `;
                area.appendChild(div);
            }

            // POPUP Modal
            const modalTag = document.getElementById('modalUpdateTag');
            const modalTitle = document.getElementById('modalUpdateTitle');
            const modalBody = document.getElementById('modalUpdateBody');

            if (modalTag) modalTag.textContent = 'Version ' + data.tag;
            if (modalTitle && data.name) modalTitle.textContent = data.name;
            if (modalBody && data.body) modalBody.innerHTML = data.body.replace(/\n/g, '<br>');

            openModal('modalUpdateNotice');
        }
    } catch (e) {
        console.warn('Erreur checkUpdateReminder:', e);
    }
}
