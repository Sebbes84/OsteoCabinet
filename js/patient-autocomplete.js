/* ============================================================
   PATIENT-AUTOCOMPLETE.JS — Sélecteur patient avec recherche
   ============================================================ */

/**
 * Initialise un champ d'autocomplétion patient sur un conteneur.
 *
 * @param {string} containerId  - ID du div conteneur (.patient-ac-wrapper)
 * @param {string} hiddenInputId - ID du <input type="hidden"> qui stocke le patientId
 * @param {function?} onChange  - Callback appelé avec le patientId sélectionné
 */
function initPatientAutocomplete(containerId, hiddenInputId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Eviter la double initialisation
    if (container._acInit) return;
    container._acInit = true;

    const hidden = document.getElementById(hiddenInputId);
    let dropdown = null;
    let highlightIndex = -1;
    let currentItems = [];

    // ---- Build DOM ----
    const wrapper = document.createElement('div');
    wrapper.className = 'ac-wrapper';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'ac-icon';
    searchIcon.textContent = '🔍';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ac-input';
    input.placeholder = 'Rechercher un patient…';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ac-clear';
    clearBtn.type = 'button';
    clearBtn.textContent = '✕';
    clearBtn.style.display = 'none';
    clearBtn.title = 'Effacer';

    wrapper.appendChild(searchIcon);
    wrapper.appendChild(input);
    wrapper.appendChild(clearBtn);
    container.appendChild(wrapper);

    // ---- Helpers ----
    function getPatients() {
        return [...DB.getPatients()].sort((a, b) => a.nom.localeCompare(b.nom));
    }

    function highlight(str, query) {
        if (!query) return str;
        const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return str.replace(re, '<mark>$1</mark>');
    }

    function openDropdown(items) {
        closeDropdown();
        highlightIndex = -1;
        currentItems = items;

        dropdown = document.createElement('div');
        dropdown.className = 'ac-dropdown';

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ac-item ac-empty';
            empty.textContent = 'Aucun patient trouvé';
            dropdown.appendChild(empty);
        } else {
            items.forEach((p, i) => {
                const item = document.createElement('div');
                item.className = 'ac-item';
                item.dataset.index = i;

                const q = input.value.trim().toLowerCase();
                const label = `${formatNom(p.nom)} ${formatPrenom(p.prenom)}`;
                const sub = [p.telephone, p.dateNaissance ? new Date(p.dateNaissance + 'T00:00:00').toLocaleDateString('fr-FR') : null].filter(Boolean).join(' · ');

                item.innerHTML = `<span class="ac-name">${highlight(label, q)}</span>${sub ? `<span class="ac-sub">${sub}</span>` : ''}`;

                item.addEventListener('mousedown', e => {
                    e.preventDefault();
                    selectPatient(p);
                });
                item.addEventListener('mousemove', () => {
                    setHighlight(i);
                });
                dropdown.appendChild(item);
            });
        }

        // Position below wrapper
        wrapper.style.position = 'relative';
        wrapper.appendChild(dropdown);
    }

    function closeDropdown() {
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        highlightIndex = -1;
        currentItems = [];
    }

    function setHighlight(index) {
        if (!dropdown) return;
        const items = dropdown.querySelectorAll('.ac-item:not(.ac-empty)');
        items.forEach((el, i) => el.classList.toggle('ac-highlighted', i === index));
        highlightIndex = index;
    }

    function selectPatient(p) {
        hidden.value = p.id;
        input.value = `${formatNom(p.nom)} ${formatPrenom(p.prenom)}`;
        clearBtn.style.display = 'flex';
        wrapper.classList.add('ac-has-value');
        closeDropdown();
        if (onChange) onChange(p.id);
    }

    function clearSelection() {
        hidden.value = '';
        input.value = '';
        clearBtn.style.display = 'none';
        wrapper.classList.remove('ac-has-value');
        input.focus();
        if (onChange) onChange('');
    }

    function search(q) {
        const patients = getPatients();
        if (!q) return patients;
        const lower = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return patients.filter(p => {
            const full = (`${p.nom} ${p.prenom} ${p.telephone || ''} ${p.email || ''}`).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return full.includes(lower);
        });
    }

    // ---- Events ----
    input.addEventListener('input', () => {
        const q = input.value.trim();
        hidden.value = ''; // Désélectionner si on tape
        clearBtn.style.display = q ? 'flex' : 'none';
        wrapper.classList.remove('ac-has-value');
        openDropdown(search(q));
    });

    input.addEventListener('focus', () => {
        const q = input.value.trim();
        openDropdown(search(q));
    });

    input.addEventListener('blur', () => {
        // Délai pour laisser mousedown agir
        setTimeout(() => {
            closeDropdown();
            // Si rien de sélectionné et texte partiel, effacer
            if (!hidden.value && input.value) {
                input.value = '';
                clearBtn.style.display = 'none';
            }
        }, 150);
    });

    input.addEventListener('keydown', e => {
        if (!dropdown) return;
        const items = dropdown.querySelectorAll('.ac-item:not(.ac-empty)');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(highlightIndex + 1, items.length - 1);
            setHighlight(next);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(highlightIndex - 1, 0);
            setHighlight(prev);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIndex >= 0 && currentItems[highlightIndex]) {
                selectPatient(currentItems[highlightIndex]);
            }
        } else if (e.key === 'Escape') {
            closeDropdown();
            input.blur();
        }
    });

    clearBtn.addEventListener('click', clearSelection);

    // Click outside
    document.addEventListener('click', e => {
        if (!container.contains(e.target)) closeDropdown();
    });

    // ---- Public API (exposée sur le conteneur) ----
    container._ac = {
        setValue(patientId) {
            if (!patientId) {
                clearSelection();
                return;
            }
            const p = DB.getPatientById(patientId);
            if (p) selectPatient(p);
        },
        getValue() {
            return hidden.value;
        },
        clear: clearSelection,
        refresh() {
            if (!hidden.value) return;
            const p = DB.getPatientById(hidden.value);
            if (p) input.value = `${formatNom(p.nom)} ${formatPrenom(p.prenom)}`;
        }
    };
}

/**
 * Helper pour lire la valeur d'un autocomplete patient.
 * Fallback sur le select caché si besoin.
 */
function getAcValue(containerId) {
    const c = document.getElementById(containerId);
    return c && c._ac ? c._ac.getValue() : '';
}

/**
 * Helper pour définir la valeur d'un autocomplete patient.
 */
function setAcValue(containerId, patientId) {
    const c = document.getElementById(containerId);
    if (c && c._ac) c._ac.setValue(patientId);
}
