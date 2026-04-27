/**
 * ANATOMICAL-DIAGRAM.JS
 * Composant pour afficher et interagir avec un schéma corporel (Face/Dos).
 */

class AnatomicalDiagram {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.readOnly = options.readOnly || false;
        this.onChange = options.onChange || null;
        this.markers = options.markers || [];
        this.currentType = options.currentType || null; // { label, color }
        this.currentDate = options.currentDate || null;
        this.showGenderToggle = options.showGenderToggle !== undefined ? options.showGenderToggle : true;
        
        this.view = 'front'; // 'front' or 'back'
        this.gender = options.gender || 'male'; // 'male' or 'female'
        
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="anatomical-container">
                <div class="anatomical-views-wrapper">
                    <!-- Face -->
                    <div class="anatomical-view-group">
                        <div class="anatomical-view-label">Face</div>
                        <div class="anatomical-svg-container" data-view="front">
                             <svg viewBox="50 0 100 200" class="anatomical-svg" id="svg-male-front" style="display:none">
                                <image href="images/anatomy/male_front.png" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
                                <g class="markers-layer"></g>
                            </svg>
                            <svg viewBox="50 0 100 200" class="anatomical-svg" id="svg-female-front" style="display:none">
                                <image href="images/anatomy/female_front.png" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
                                <g class="markers-layer"></g>
                            </svg>
                        </div>
                    </div>
                    <!-- Dos -->
                    <div class="anatomical-view-group">
                        <div class="anatomical-view-label">Dos</div>
                        <div class="anatomical-svg-container" data-view="back">
                            <svg viewBox="50 0 100 200" class="anatomical-svg" id="svg-male-back" style="display:none">
                                <image href="images/anatomy/male_back.png" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
                                <g class="markers-layer"></g>
                            </svg>
                            <svg viewBox="50 0 100 200" class="anatomical-svg" id="svg-female-back" style="display:none">
                                <image href="images/anatomy/female_back.png" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
                                <g class="markers-layer"></g>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="anatomical-legend-info" style="display: flex; justify-content: space-between; align-items: center; padding: 10px;">
                    <small class="text-muted">${this.readOnly ? '' : 'Clic : Placer. Clic marqueur : Supprimer.'}</small>
                    <div class="anatomical-controls">
                        ${this.showGenderToggle ? `
                        <div class="btn-group">
                            <button class="btn btn-xs btn-outline ${this.gender === 'male' ? 'active' : ''}" data-gender="male">♂ H</button>
                            <button class="btn btn-xs btn-outline ${this.gender === 'female' ? 'active' : ''}" data-gender="female">♀ F</button>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;

        this.updateView();
    }

    updateView() {
        // Hide all SVGs
        this.container.querySelectorAll('.anatomical-svg').forEach(s => s.style.display = 'none');
        
        // Show current gender SVGs (both front and back)
        const frontSvg = this.container.querySelector(`#svg-${this.gender}-front`);
        const backSvg = this.container.querySelector(`#svg-${this.gender}-back`);
        
        if (frontSvg) frontSvg.style.display = 'block';
        if (backSvg) backSvg.style.display = 'block';

        this.bindEvents();
        this.renderMarkers();
    }

    bindEvents() {
        const controls = this.container.querySelector('.anatomical-controls');
        if (controls) {
            controls.onclick = (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                
                if (btn.dataset.gender) {
                    this.gender = btn.dataset.gender;
                    this.updateControls();
                    this.updateView();
                }
            };
        }

        // Add markers to BOTH active SVGs
        if (!this.readOnly) {
            const svgs = this.container.querySelectorAll('.anatomical-svg');
            svgs.forEach(svg => {
                if (svg.style.display === 'none') return;
                
                svg.onclick = (e) => {
                    if (e.target.tagName === 'circle' || e.target.closest('circle')) return;
                    
                    const rect = svg.getBoundingClientRect();
                    // Math with viewBox="50 0 100 200"
                    const x = ((e.clientX - rect.left) / rect.width) * 100 + 50;
                    const y = ((e.clientY - rect.top) / rect.height) * 200;
                    
                    const view = svg.closest('.anatomical-svg-container').dataset.view;
                    this.addMarker(x, y, view, this.gender);
                };
            });
        }
    }

    updateControls() {
        const btns = this.container.querySelectorAll('.btn');
        btns.forEach(btn => {
            if (btn.dataset.gender) {
                btn.classList.toggle('active', btn.dataset.gender === this.gender);
            }
        });
    }

    addMarker(x, y, view, gender) {
        if (!this.currentType) {
            showToast("Sélectionnez d'abord un type de marqueur.", "info");
            return;
        }

        const marker = {
            id: Date.now(),
            x: Math.round(x),
            y: Math.round(y),
            view: view,
            gender: gender,
            label: this.currentType.label,
            color: this.currentType.color,
            date: this.currentDate || new Date().toISOString()
        };

        this.markers.push(marker);
        this.renderMarkers();
        if (this.onChange) this.onChange(this.markers);
    }

    removeMarker(id) {
        this.markers = this.markers.filter(m => m.id !== id);
        this.renderMarkers();
        if (this.onChange) this.onChange(this.markers);
    }

    setMarkers(markers) {
        this.markers = markers || [];
        this.renderMarkers();
    }

    setCurrentType(type) {
        this.currentType = type;
    }

    setGender(gender) {
        this.gender = gender;
        this.updateView();
    }

    renderMarkers() {
        const svgs = this.container.querySelectorAll('.anatomical-svg');
        svgs.forEach(svg => {
            if (svg.style.display === 'none') return;

            const layer = svg.querySelector('.markers-layer');
            if (!layer) return;
            
            const [modelGender, modelView] = svg.id.replace('svg-', '').split('-');
            layer.innerHTML = '';

            // Filter markers for this specific model view & gender
            this.markers.filter(m => m.view === modelView && (m.gender === modelGender || (!m.gender && modelGender === 'male'))).forEach(m => {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", m.x);
                circle.setAttribute("cy", m.y);
                circle.setAttribute("r", 5); // Smaller radius for tighter view
                circle.setAttribute("fill", m.color);
                circle.style.cursor = this.readOnly ? "default" : "pointer";
                
                if (!this.readOnly) {
                    circle.onclick = (e) => {
                        e.stopPropagation();
                        this.removeMarker(m.id);
                    };
                }

                const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                // Formatage simple de la date YYYY-MM-DD pour éviter les décalages de fuseau horaire
                let displayDate = m.date;
                if (m.date && m.date.includes("-")) {
                    const parts = m.date.split("T")[0].split("-");
                    if (parts.length === 3) {
                        displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                }
                title.textContent = `${m.label} (${displayDate})`;
                circle.appendChild(title);

                layer.appendChild(circle);
            });
        });
    }
}

window.AnatomicalDiagram = AnatomicalDiagram;
