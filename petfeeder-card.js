class PetfeederCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = Object.assign({
      title: 'Petfeeder',
      compact: false,
      image: '',
      status: [null, null, null, null],
      menu: [],
      last_feed_entity: null,
      today_grams_entity: null,
      today_doses_entity: null,
      schedules: [],
      status_label: 'status:',
      header_color: '#ffffff',
      header_opacity: 1,
      content_color: '#fafafa',
      content_opacity: 1,
      accent_color: '#4db6ac'
    }, config || {});
    this.render();
  }

  getCardSize() {
    return this._config.compact ? 3 : 6;
  }

  static getConfigElement() {
    return document.createElement('petfeeder-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'Petfeeder',
      image: '/local/pet.jpg',
      status: [null, null, null, null],
      status_label: 'status:',
      last_feed_entity: '',
      today_grams_entity: '',
      today_doses_entity: '',
      schedules: [],
      menu: []
    };
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  // --- Schedule data helpers ---

  _getScheduleData() {
    const schedules = [];
    (this._config.schedules || []).forEach((schedule, idx) => {
      if (!schedule || !this._hass) return;
      const hourState = schedule.hour_entity ? this._hass.states[schedule.hour_entity] : null;
      const minuteState = schedule.minute_entity ? this._hass.states[schedule.minute_entity] : null;
      const dosesState = schedule.doses_entity ? this._hass.states[schedule.doses_entity] : null;
      const enabledState = schedule.enabled_entity ? this._hass.states[schedule.enabled_entity] : null;
      const infoState = schedule.info_entity ? this._hass.states[schedule.info_entity] : null;

      const h = hourState ? parseInt(hourState.state, 10) : NaN;
      const m = minuteState ? parseInt(minuteState.state, 10) : NaN;
      const doses = dosesState ? parseInt(dosesState.state, 10) : 0;
      const enabled = enabledState ? enabledState.state === 'on' : true;
      const gramsPerDose = dosesState && dosesState.attributes && dosesState.attributes.unit_of_measurement
        ? parseInt(dosesState.attributes.unit_of_measurement) || 5 : 5;

      schedules.push({
        index: idx,
        hour: h,
        minute: m,
        doses: doses,
        grams: doses * gramsPerDose,
        enabled: enabled,
        info: infoState ? infoState.state : null,
        config: schedule
      });
    });
    return schedules;
  }

  _computeNextSchedule() {
    const now = new Date();
    const candidates = [];
    this._getScheduleData().forEach(s => {
      if (!s.enabled || isNaN(s.hour) || isNaN(s.minute)) return;
      let dt = new Date(now);
      dt.setHours(s.hour, s.minute, 0, 0);
      if (dt <= now) {
        dt = new Date(now);
        dt.setDate(dt.getDate() + 1);
        dt.setHours(s.hour, s.minute, 0, 0);
      }
      candidates.push({ datetime: dt, schedule: s });
    });
    candidates.sort((a, b) => a.datetime - b.datetime);
    return candidates.length > 0 ? candidates[0] : null;
  }

  _getTodayGrams() {
    if (!this._config.today_grams_entity || !this._hass) return 0;
    const st = this._hass.states[this._config.today_grams_entity];
    return st ? parseFloat(st.state) || 0 : 0;
  }

  _getTotalExpectedGrams() {
    let total = 0;
    this._getScheduleData().forEach(s => {
      if (s.enabled) total += s.grams;
    });
    return total || 1;
  }

  _getTodayDoses() {
    if (!this._config.today_doses_entity || !this._hass) return 0;
    const st = this._hass.states[this._config.today_doses_entity];
    return st ? parseInt(st.state) || 0 : 0;
  }

  // --- SVG Dial ---

  _renderDial() {
    const todayGrams = this._getTodayGrams();
    const schedules = this._getScheduleData().filter(s => s.enabled);
    const totalExpected = this._getTotalExpectedGrams();
    const accentColor = this._config.accent_color || '#4db6ac';

    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 80;
    const strokeWidth = 12;
    const circumference = 2 * Math.PI * radius;

    const container = document.createElement('div');
    container.className = 'dial-container';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '200');

    // Background track
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', cx);
    bgCircle.setAttribute('cy', cy);
    bgCircle.setAttribute('r', radius);
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'var(--divider-color, #e0e0e0)');
    bgCircle.setAttribute('stroke-width', '14');
    bgCircle.setAttribute('opacity', '0.25');
    svg.appendChild(bgCircle);

    if (schedules.length > 0) {
      const gap = 4;
      const totalGap = gap * schedules.length;
      const availableDeg = 360 - totalGap;
      let currentAngle = -90;
      let gramsRemaining = todayGrams;

      schedules.forEach((sched) => {
        const segmentDeg = (sched.grams / totalExpected) * availableDeg;
        const segmentRad = (segmentDeg / 360) * circumference;
        const offset = -((currentAngle + 90) / 360) * circumference;

        // Background segment
        const bgSeg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgSeg.setAttribute('cx', cx);
        bgSeg.setAttribute('cy', cy);
        bgSeg.setAttribute('r', radius);
        bgSeg.setAttribute('fill', 'none');
        bgSeg.setAttribute('stroke', 'var(--divider-color, #ddd)');
        bgSeg.setAttribute('stroke-width', strokeWidth);
        bgSeg.setAttribute('stroke-dasharray', `${segmentRad} ${circumference}`);
        bgSeg.setAttribute('stroke-dashoffset', `${offset}`);
        bgSeg.setAttribute('stroke-linecap', 'round');
        bgSeg.setAttribute('opacity', '0.15');
        svg.appendChild(bgSeg);

        // Filled portion
        const filled = Math.min(gramsRemaining, sched.grams);
        const filledRatio = sched.grams > 0 ? filled / sched.grams : 0;
        gramsRemaining -= filled;

        if (filledRatio > 0) {
          const filledRad = filledRatio * segmentRad;
          const fillSeg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          fillSeg.setAttribute('cx', cx);
          fillSeg.setAttribute('cy', cy);
          fillSeg.setAttribute('r', radius);
          fillSeg.setAttribute('fill', 'none');
          fillSeg.setAttribute('stroke', accentColor);
          fillSeg.setAttribute('stroke-width', strokeWidth);
          fillSeg.setAttribute('stroke-dasharray', `${filledRad} ${circumference}`);
          fillSeg.setAttribute('stroke-dashoffset', `${offset}`);
          fillSeg.setAttribute('stroke-linecap', 'round');
          svg.appendChild(fillSeg);
        }

        currentAngle += segmentDeg + gap;
      });
    } else {
      // No schedules: show simple progress ring
      const ratio = Math.min(todayGrams / 100, 1);
      const filledRad = ratio * circumference;
      const fillCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fillCircle.setAttribute('cx', cx);
      fillCircle.setAttribute('cy', cy);
      fillCircle.setAttribute('r', radius);
      fillCircle.setAttribute('fill', 'none');
      fillCircle.setAttribute('stroke', accentColor);
      fillCircle.setAttribute('stroke-width', strokeWidth);
      fillCircle.setAttribute('stroke-dasharray', `${filledRad} ${circumference}`);
      fillCircle.setAttribute('stroke-dashoffset', `${circumference * 0.25}`);
      fillCircle.setAttribute('stroke-linecap', 'round');
      svg.appendChild(fillCircle);
    }

    container.appendChild(svg);

    // Center text
    const centerText = document.createElement('div');
    centerText.className = 'dial-center';
    const dosesNum = document.createElement('div');
    dosesNum.className = 'dial-grams';
    const todayDoses = this._getTodayDoses();
    dosesNum.textContent = todayDoses;
    const dosesLabel = document.createElement('div');
    dosesLabel.className = 'dial-label';
    dosesLabel.textContent = `Portions (${Math.round(todayGrams)}g)`;
    centerText.appendChild(dosesNum);
    centerText.appendChild(dosesLabel);
    container.appendChild(centerText);

    return container;
  }

  // --- Schedule Timeline ---

  _renderScheduleTimeline() {
    const container = document.createElement('div');
    container.className = 'schedule-section';

    const schedules = this._getScheduleData();

    if (schedules.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;color:#999;font-size:13px;padding:16px';
      empty.textContent = 'No schedules configured';
      container.appendChild(empty);
      return container;
    }

    schedules.forEach((sched, idx) => {
      const item = document.createElement('div');
      item.className = 'schedule-item' + (sched.enabled ? '' : ' disabled');

      const timeline = document.createElement('div');
      timeline.className = 'timeline-marker';
      const dot = document.createElement('div');
      dot.className = 'timeline-dot';
      if (idx < schedules.length - 1) {
        const line = document.createElement('div');
        line.className = 'timeline-line';
        timeline.appendChild(line);
      }
      timeline.appendChild(dot);

      // Middle section: time + doses (clickable)
      const middle = document.createElement('div');
      middle.style.cssText = 'flex:1;cursor:pointer';
      middle.addEventListener('click', () => this._openSchedulePopup(sched));

      const timeDiv = document.createElement('div');
      timeDiv.className = 'schedule-time';
      if (!isNaN(sched.hour) && !isNaN(sched.minute)) {
        timeDiv.textContent = `${String(sched.hour).padStart(2, '0')}:${String(sched.minute).padStart(2, '0')}`;
      } else {
        timeDiv.textContent = '--:--';
      }

      const dosesDiv = document.createElement('div');
      dosesDiv.className = 'schedule-doses';
      if (sched.info) {
        dosesDiv.textContent = sched.info;
      } else {
        dosesDiv.textContent = `${sched.doses} Portions (Approx. ${sched.grams}g)`;
      }

      middle.appendChild(timeDiv);
      middle.appendChild(dosesDiv);

      // Right section: up/down buttons
      const controls = document.createElement('div');
      controls.style.cssText = 'display:flex;gap:4px;flex-shrink:0';

      if (idx > 0) {
        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.style.cssText = 'width:28px;height:28px;padding:0;border:1px solid var(--divider-color);border-radius:4px;background:var(--ha-card-background);cursor:pointer;font-size:16px';
        upBtn.addEventListener('click', e => {
          e.stopPropagation();
          this._moveSchedule(sched.index, -1);
        });
        controls.appendChild(upBtn);
      }

      if (idx < schedules.length - 1) {
        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.style.cssText = 'width:28px;height:28px;padding:0;border:1px solid var(--divider-color);border-radius:4px;background:var(--ha-card-background);cursor:pointer;font-size:16px';
        downBtn.addEventListener('click', e => {
          e.stopPropagation();
          this._moveSchedule(sched.index, 1);
        });
        controls.appendChild(downBtn);
      }

      item.appendChild(timeline);
      item.appendChild(middle);
      item.appendChild(controls);

      container.appendChild(item);
    });

    return container;
  }

  // --- Schedule reordering ---

  _moveSchedule(index, direction) {
    const schedules = this._config.schedules || [];
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= schedules.length) return;
    [schedules[index], schedules[newIdx]] = [schedules[newIdx], schedules[index]];
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: JSON.parse(JSON.stringify(this._config)) },
      bubbles: true,
      composed: true
    }));
  }

  // --- Edit Popup ---

  _openSchedulePopup(sched) {
    if (!this._hass) return;

    const existing = this._shadow.querySelector('.popup-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const popup = document.createElement('div');
    popup.className = 'popup';

    const popupTitle = document.createElement('div');
    popupTitle.className = 'popup-title';
    popupTitle.textContent = `Schedule ${sched.index + 1}`;
    popup.appendChild(popupTitle);

    // Hour
    popup.appendChild(this._popupRow('Hour', 'number', isNaN(sched.hour) ? '' : sched.hour, '0', '23'));

    // Minute
    popup.appendChild(this._popupRow('Minute', 'number', isNaN(sched.minute) ? '' : sched.minute, '0', '59'));

    // Doses
    popup.appendChild(this._popupRow('Doses', 'number', sched.doses || 1, '1', '50'));

    // Enabled toggle
    const enabledRow = document.createElement('div');
    enabledRow.className = 'popup-row';
    const enabledLabel = document.createElement('div');
    enabledLabel.className = 'popup-label';
    enabledLabel.textContent = 'Enabled';
    const toggle = document.createElement('div');
    toggle.className = 'toggle' + (sched.enabled ? ' on' : '');
    toggle.innerHTML = '<div class="toggle-thumb"></div>';
    let toggleState = sched.enabled;
    toggle.addEventListener('click', () => {
      toggleState = !toggleState;
      toggle.classList.toggle('on', toggleState);
    });
    enabledRow.appendChild(enabledLabel);
    enabledRow.appendChild(toggle);
    popup.appendChild(enabledRow);

    // Save
    const saveBtn = document.createElement('button');
    saveBtn.className = 'popup-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const cfg = sched.config;
      const inputs = popup.querySelectorAll('.popup-input');
      if (cfg.hour_entity) {
        this._hass.callService('number', 'set_value', {
          entity_id: cfg.hour_entity,
          value: parseInt(inputs[0].value, 10)
        });
      }
      if (cfg.minute_entity) {
        this._hass.callService('number', 'set_value', {
          entity_id: cfg.minute_entity,
          value: parseInt(inputs[1].value, 10)
        });
      }
      if (cfg.doses_entity) {
        this._hass.callService('number', 'set_value', {
          entity_id: cfg.doses_entity,
          value: parseInt(inputs[2].value, 10)
        });
      }
      if (cfg.enabled_entity) {
        this._hass.callService('switch', toggleState ? 'turn_on' : 'turn_off', {
          entity_id: cfg.enabled_entity
        });
      }
    });
    popup.appendChild(saveBtn);

    // Close
    const closeBtn = document.createElement('button');
    closeBtn.className = 'popup-close';
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;border:none;background:none;cursor:pointer;color:var(--secondary-text-color,#888);font-size:16px;padding:0';
    closeBtn.addEventListener('click', () => overlay.remove());
    popup.appendChild(closeBtn);

    overlay.appendChild(popup);
    this._shadow.appendChild(overlay);
  }

  _popupRow(label, type, value, min, max) {
    const row = document.createElement('div');
    row.className = 'popup-row';
    const lab = document.createElement('div');
    lab.className = 'popup-label';
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.className = 'popup-input';
    input.min = min;
    input.max = max;
    input.value = value;
    row.appendChild(lab);
    row.appendChild(input);
    return row;
  }

  // --- Status Row (bottom) ---

  _renderStatuses() {
    const container = document.createElement('div');
    container.className = 'status-row';
    (this._config.status || []).forEach((s) => {
      if (!s || (!s.icon && !s.name)) return;
      const item = document.createElement('div');
      item.className = 'status-item';

      let color = s.color || '#888';
      if (s.entity && this._hass) {
        const st = this._hass.states[s.entity];
        if (st) {
          if (s.color_map && Array.isArray(s.color_map)) {
            const mapping = s.color_map.find(m => m.state === st.state);
            if (mapping) color = mapping.color;
          } else {
            if (st.state === 'on' || st.state === 'home') color = '#4caf50';
            else if (st.state === 'off' || st.state === 'unavailable') color = '#f44336';
          }
        }
      }

      if (s.name) {
        const nameDiv = document.createElement('div');
        nameDiv.className = 'status-label';
        nameDiv.textContent = s.name;
        item.appendChild(nameDiv);
      }

      if (s.icon) {
        const dot = document.createElement('div');
        dot.className = 'status-dot';
        dot.style.borderColor = color;
        dot.style.color = color;
        const haIcon = document.createElement('ha-icon');
        haIcon.setAttribute('icon', s.icon);
        haIcon.style.width = '20px';
        haIcon.style.height = '20px';
        dot.appendChild(haIcon);
        item.appendChild(dot);
      }

      container.appendChild(item);
    });
    return container;
  }

  // --- Main Render ---

  render() {
    if (!this._shadow) return;

    const headerColor = this._config.header_color || '#fff';
    const headerOpacity = this._config.header_opacity !== undefined ? this._config.header_opacity : 1;
    const contentColor = this._config.content_color || '#fafafa';
    const contentOpacity = this._config.content_opacity !== undefined ? this._config.content_opacity : 1;
    const accentColor = this._config.accent_color || '#4db6ac';

    const headerBg = this._hexToRgba(headerColor, headerOpacity);
    const contentBg = this._hexToRgba(contentColor, contentOpacity);

    const style = `
      :host{display:block;box-sizing:border-box;padding:0;max-width:420px;margin:0 auto;font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif)}
      .card{border-radius:12px;overflow:hidden;background:var(--ha-card-background, #fff);box-shadow:var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,0.1))}
      .card-header{background:${headerBg};padding:20px 16px 16px;text-align:center;position:relative}
      .pet-name{font-size:16px;font-weight:500;color:var(--primary-text-color,#333);margin-bottom:4px;display:flex;align-items:center;justify-content:center;gap:8px}
      .pet-name img{width:28px;height:28px;border-radius:50%;object-fit:cover}
      .sub-label{font-size:12px;color:var(--secondary-text-color,#888);margin-bottom:16px}
      .dial-container{position:relative;width:200px;height:200px;margin:0 auto}
      .dial-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
      .dial-grams{font-size:48px;font-weight:300;color:var(--primary-text-color,#333);line-height:1}
      .dial-label{font-size:12px;color:var(--secondary-text-color,#888);margin-top:4px}
      .next-schedule-row{margin-top:12px;font-size:13px;color:var(--secondary-text-color,#888);text-align:center}
      .card-content{background:${contentBg};padding:16px}
      .schedule-section{padding:0}
      .schedule-item{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:8px;transition:background 0.15s}
      .schedule-item:hover{background:var(--secondary-background-color, rgba(0,0,0,.03))}
      .schedule-item.disabled{opacity:0.4}
      .timeline-marker{position:relative;width:16px;display:flex;flex-direction:column;align-items:center;flex-shrink:0;align-self:stretch}
      .timeline-dot{width:10px;height:10px;border-radius:50%;background:${accentColor};flex-shrink:0;z-index:1;position:relative;margin-top:6px}
      .timeline-line{position:absolute;top:16px;bottom:-10px;left:50%;width:2px;background:var(--divider-color, #ddd);transform:translateX(-50%)}
      .schedule-time{font-size:16px;font-weight:500;color:var(--primary-text-color,#333);min-width:54px}
      .schedule-doses{font-size:13px;color:var(--secondary-text-color,#888);flex:1;text-align:right}
      .status-bar{display:flex;justify-content:space-around;padding:12px 8px;border-top:1px solid var(--divider-color,#eee);background:var(--ha-card-background,#fff)}
      .status-row{display:flex;justify-content:space-around;width:100%}
      .status-item{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:60px}
      .status-label{font-size:11px;color:var(--secondary-text-color,#888);text-transform:uppercase;letter-spacing:0.3px}
      .status-dot{width:36px;height:36px;border-radius:50%;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;background:transparent}
      .popup-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100;border-radius:12px}
      .popup{background:var(--ha-card-background, #fff);border-radius:12px;padding:24px;min-width:260px;max-width:320px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
      .popup-title{font-size:18px;font-weight:500;color:var(--primary-text-color,#333);margin-bottom:20px;text-align:center}
      .popup-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
      .popup-label{font-size:14px;color:var(--primary-text-color,#333)}
      .popup-input{width:80px;padding:8px 12px;border:1px solid var(--divider-color,#ddd);border-radius:8px;font-size:16px;text-align:center;background:var(--secondary-background-color,#f5f5f5);color:var(--primary-text-color,#333)}
      .popup-input:focus{outline:none;border-color:${accentColor}}
      .popup-save{width:100%;padding:12px;border:none;border-radius:8px;background:${accentColor};color:#fff;font-size:15px;font-weight:500;cursor:pointer;margin-top:8px}
      .popup-save:hover{opacity:0.85}
      .popup-close{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--secondary-text-color,#888);font-size:16px}
      .popup-close:hover{background:var(--secondary-background-color,#f5f5f5)}
      .toggle{width:48px;height:26px;border-radius:13px;background:#ccc;position:relative;cursor:pointer;transition:background 0.2s}
      .toggle.on{background:${accentColor}}
      .toggle-thumb{width:22px;height:22px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
      .toggle.on .toggle-thumb{transform:translateX(22px)}
    `;

    this._shadow.innerHTML = '';
    const st = document.createElement('style');
    st.textContent = style;
    this._shadow.appendChild(st);

    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.position = 'relative';

    // --- Header: pet name + dial ---
    const header = document.createElement('div');
    header.className = 'card-header';

    const petName = document.createElement('div');
    petName.className = 'pet-name';
    if (this._config.image) {
      const img = document.createElement('img');
      img.src = this._config.image;
      img.alt = '';
      petName.appendChild(img);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = this._config.title || 'Petfeeder';
    petName.appendChild(nameSpan);
    header.appendChild(petName);

    const subLabel = document.createElement('div');
    subLabel.className = 'sub-label';
    subLabel.textContent = 'Portions & Grams dispensed today';
    header.appendChild(subLabel);

    header.appendChild(this._renderDial());

    const nextRow = document.createElement('div');
    nextRow.className = 'next-schedule-row';
    const nextSchedule = this._computeNextSchedule();
    if (nextSchedule) {
      const s = nextSchedule.schedule;
      nextRow.textContent = `Next: ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} (${s.doses} portions)`;
    } else {
      nextRow.textContent = 'No upcoming schedules';
    }
    header.appendChild(nextRow);
    wrap.appendChild(header);

    // --- Content: schedule timeline ---
    const content = document.createElement('div');
    content.className = 'card-content';
    content.appendChild(this._renderScheduleTimeline());
    wrap.appendChild(content);

    // --- Status bar (bottom) ---
    const hasStatus = (this._config.status || []).some(s => s && (s.icon || s.name));
    if (hasStatus) {
      const statusBar = document.createElement('div');
      statusBar.className = 'status-bar';
      statusBar.appendChild(this._renderStatuses());
      wrap.appendChild(statusBar);
    }

    this._shadow.appendChild(wrap);
  }

  _hexToRgba(hex, alpha) {
    if (!hex) hex = '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

customElements.define('petfeeder-card', PetfeederCard);

// Editor uses light DOM so HA native components (ha-entity-picker, ha-icon-picker) work properly
class PetfeederCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._selectedMenuIdx = 0;
    this._selectedScheduleIdx = 0;
    this._expandedSections = {};
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Update hass on existing HA pickers without full re-render
    this.querySelectorAll('ha-entity-picker').forEach(el => { el.hass = hass; });
    this.querySelectorAll('ha-icon-picker').forEach(el => { el.hass = hass; });
    if (!this._rendered) this._render();
  }

  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: JSON.parse(JSON.stringify(this._config)) },
      bubbles: true,
      composed: true
    }));
  }

  _render() {
    this._rendered = true;
    this.innerHTML = '';

    // Use HA CSS variables so it matches native theme automatically
    const style = document.createElement('style');
    style.textContent = `
      .pf-editor{padding:0;font-family:var(--paper-font-body1_-_font-family,inherit)}
      .pf-section{background:var(--ha-card-background,var(--card-background-color,#fff));border-radius:8px;margin-bottom:12px;border:1px solid var(--divider-color,#e0e0e0);overflow:hidden}
      .pf-section-header{padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none}
      .pf-section-header:hover{background:var(--secondary-background-color,#f5f5f5)}
      .pf-section-title{font-size:16px;font-weight:500;color:var(--primary-text-color,#212121);display:flex;align-items:center;gap:8px}
      .pf-arrow{transition:transform 0.2s;display:inline-block;color:var(--secondary-text-color,#727272)}
      .pf-section-body{padding:0 16px 16px;display:none}
      .pf-section.open .pf-section-body{display:block}
      .pf-section.open .pf-arrow{transform:rotate(90deg)}
      .pf-field{margin-bottom:16px}
      .pf-field-label{display:block;font-size:12px;font-weight:500;color:var(--secondary-text-color,#727272);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px}
      .pf-text-input{width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e0e0e0);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);font-size:14px;box-sizing:border-box}
      .pf-text-input:focus{outline:none;border-color:var(--primary-color,#03a9f4)}
      .pf-status-card{border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;padding:16px;margin-bottom:12px;background:var(--secondary-background-color,#fafafa)}
      .pf-status-title{font-size:14px;font-weight:500;color:var(--primary-text-color,#212121);margin-bottom:12px}
      .pf-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
      .pf-row > ha-entity-picker,
      .pf-row > ha-icon-picker{flex:1}
      .pf-mapping-row{display:flex;gap:8px;align-items:center;padding:8px;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;margin-bottom:6px}
      .pf-mapping-state{flex:1;font-size:14px;color:var(--primary-text-color,#212121)}
      .pf-mapping-state input{width:100%;padding:6px 8px;border:1px solid var(--divider-color,#e0e0e0);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);font-size:13px;box-sizing:border-box}
      .pf-color-input{width:40px;height:32px;border:none;border-radius:4px;cursor:pointer;padding:0}
      .pf-btn{padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;transition:background 0.2s}
      .pf-btn-primary{background:var(--primary-color,#03a9f4);color:#fff}
      .pf-btn-primary:hover{opacity:0.85}
      .pf-btn-danger{background:var(--error-color,#db4437);color:#fff}
      .pf-btn-danger:hover{opacity:0.85}
      .pf-btn-sm{padding:4px 10px;font-size:12px}
      .pf-btn-icon{background:none;border:none;cursor:pointer;color:var(--secondary-text-color,#727272);padding:4px;font-size:18px;line-height:1}
      .pf-btn-icon:hover{color:var(--error-color,#db4437)}
      .pf-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px}
      .pf-tab{padding:8px 16px;border:1px solid var(--divider-color,#e0e0e0);border-radius:20px;cursor:pointer;font-size:13px;font-weight:500;color:var(--primary-text-color,#212121);background:var(--card-background-color,#fff);transition:all 0.2s}
      .pf-tab:hover{background:var(--secondary-background-color,#f5f5f5)}
      .pf-tab.active{background:var(--primary-color,#03a9f4);color:#fff;border-color:var(--primary-color,#03a9f4)}
      .pf-tab-content{border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;padding:16px;background:var(--secondary-background-color,#fafafa)}
      select.pf-select{width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e0e0e0);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);font-size:14px;box-sizing:border-box}
      textarea.pf-textarea{width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e0e0e0);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);font-size:14px;box-sizing:border-box;resize:vertical}
    `;
    this.appendChild(style);

    const editor = document.createElement('div');
    editor.className = 'pf-editor';

    // === MODE SECTION ===
    editor.appendChild(this._buildSection('Mode', false, (body) => {
      const field = document.createElement('div');
      field.className = 'pf-field';
      const label = document.createElement('label');
      label.className = 'pf-field-label';
      label.textContent = 'Display Mode';
      const sel = document.createElement('select');
      sel.className = 'pf-select';
      ['Normal', 'Compact'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m === 'Normal' ? 'false' : 'true';
        opt.textContent = m;
        sel.appendChild(opt);
      });
      sel.value = this._config.compact ? 'true' : 'false';
      sel.addEventListener('change', e => {
        this._config.compact = e.target.value === 'true';
        this._dispatch();
      });
      field.appendChild(label);
      field.appendChild(sel);
      body.appendChild(field);
    }));

    // === HEADER SECTION ===
    editor.appendChild(this._buildSection('Header', false, (body) => {
      // Pet Image
      body.appendChild(this._buildTextField('Pet Image Path', this._config.image || '', '', v => {
        this._config.image = v;
        this._dispatch();
      }));

      // Status Label
      body.appendChild(this._buildTextField('Status Label', this._config.status_label || 'status:', 'e.g., status:', v => {
        this._config.status_label = v || 'status:';
        this._dispatch();
      }));

      // Last Feed Entity
      body.appendChild(this._buildHaEntityPicker('Last Feed Entity', this._config.last_feed_entity || '', v => {
        this._config.last_feed_entity = v || null;
        this._dispatch();
      }));

      // Today Grams Entity
      body.appendChild(this._buildHaEntityPicker('Today Grams Entity', this._config.today_grams_entity || '', v => {
        this._config.today_grams_entity = v || null;
        this._dispatch();
      }));

      // Today Doses Entity
      body.appendChild(this._buildHaEntityPicker('Today Doses Entity', this._config.today_doses_entity || '', v => {
        this._config.today_doses_entity = v || null;
        this._dispatch();
      }));

      // Status Icons
      const statusTitle = document.createElement('div');
      statusTitle.style.cssText = 'font-size:14px;font-weight:500;color:var(--primary-text-color);margin:16px 0 8px';
      statusTitle.textContent = 'Status Icons';
      body.appendChild(statusTitle);

      for (let i = 0; i < 4; i++) {
        if (!this._config.status) this._config.status = [null, null, null, null];
        if (!this._config.status[i]) this._config.status[i] = {};
        const s = this._config.status[i];

        const card = document.createElement('div');
        card.className = 'pf-status-card';

        const title = document.createElement('div');
        title.className = 'pf-status-title';
        title.textContent = `Status Icon ${i + 1}`;
        card.appendChild(title);

        // Entity picker (native HA)
        card.appendChild(this._buildHaEntityPicker('Entity', s.entity || '', v => {
          this._config.status[i].entity = v || null;
          this._dispatch();
        }));

        // Name
        card.appendChild(this._buildTextField('Name', s.name || '', 'e.g., Feeding', v => {
          this._config.status[i].name = v || null;
          this._dispatch();
        }));

        // Icon picker (native HA)
        card.appendChild(this._buildHaIconPicker('Icon', s.icon || '', v => {
          this._config.status[i].icon = v || null;
          this._dispatch();
        }));

        // Color mapping
        card.appendChild(this._buildColorMapping(i));

        body.appendChild(card);
      }
    }));

    // === MENU SECTION ===
    editor.appendChild(this._buildSection('Menu', false, (body) => {
      const addBtn = document.createElement('button');
      addBtn.className = 'pf-btn pf-btn-primary pf-btn-sm';
      addBtn.textContent = '+ Add Menu Option';
      addBtn.style.marginBottom = '12px';
      addBtn.addEventListener('click', () => {
        this._config.menu = this._config.menu || [];
        this._config.menu.push({ name: `Option ${this._config.menu.length + 1}`, content: '' });
        this._selectedMenuIdx = this._config.menu.length - 1;
        this._dispatch();
        this._render();
      });
      body.appendChild(addBtn);

      if (this._config.menu && this._config.menu.length > 0) {
        const tabs = document.createElement('div');
        tabs.className = 'pf-tabs';
        this._config.menu.forEach((m, idx) => {
          const tab = document.createElement('div');
          tab.className = 'pf-tab' + (idx === this._selectedMenuIdx ? ' active' : '');
          tab.textContent = m.name || `Option ${idx + 1}`;
          tab.addEventListener('click', () => {
            this._selectedMenuIdx = idx;
            this._render();
          });
          tabs.appendChild(tab);
        });
        body.appendChild(tabs);

        const m = this._config.menu[this._selectedMenuIdx];
        if (m) {
          const tabContent = document.createElement('div');
          tabContent.className = 'pf-tab-content';

          tabContent.appendChild(this._buildTextField('Option Name', m.name || '', '', v => {
            this._config.menu[this._selectedMenuIdx].name = v;
            this._dispatch();
          }));

          const contentField = document.createElement('div');
          contentField.className = 'pf-field';
          const contentLabel = document.createElement('label');
          contentLabel.className = 'pf-field-label';
          contentLabel.textContent = 'Content';
          const ta = document.createElement('textarea');
          ta.className = 'pf-textarea';
          ta.rows = 4;
          ta.value = m.content || '';
          ta.addEventListener('change', e => {
            this._config.menu[this._selectedMenuIdx].content = e.target.value;
            this._dispatch();
          });
          contentField.appendChild(contentLabel);
          contentField.appendChild(ta);
          tabContent.appendChild(contentField);

          const removeBtn = document.createElement('button');
          removeBtn.className = 'pf-btn pf-btn-danger pf-btn-sm';
          removeBtn.textContent = 'Remove This Option';
          removeBtn.style.marginTop = '8px';
          removeBtn.addEventListener('click', () => {
            this._config.menu.splice(this._selectedMenuIdx, 1);
            this._selectedMenuIdx = Math.max(0, this._selectedMenuIdx - 1);
            this._dispatch();
            this._render();
          });
          tabContent.appendChild(removeBtn);

          body.appendChild(tabContent);
        }
      }
    }));

    // === SCHEDULES SECTION ===
    editor.appendChild(this._buildSection('Schedules', false, (body) => {
      const addScheduleBtn = document.createElement('button');
      addScheduleBtn.className = 'pf-btn pf-btn-primary pf-btn-sm';
      addScheduleBtn.textContent = '+ Add Schedule';
      addScheduleBtn.style.marginBottom = '12px';
      addScheduleBtn.addEventListener('click', () => {
        if (!this._config.schedules) this._config.schedules = [];
        this._config.schedules.push({
          hour_entity: '',
          minute_entity: '',
          doses_entity: '',
          enabled_entity: '',
          info_entity: ''
        });
        this._dispatch();
        this._render();
      });
      body.appendChild(addScheduleBtn);

      if (this._config.schedules && this._config.schedules.length > 0) {
        const tabs = document.createElement('div');
        tabs.className = 'pf-tabs';
        this._config.schedules.forEach((schedule, idx) => {
          const tab = document.createElement('div');
          tab.className = 'pf-tab' + (idx === this._selectedScheduleIdx ? ' active' : '');
          tab.textContent = `Schedule ${idx + 1}`;
          tab.addEventListener('click', () => {
            this._selectedScheduleIdx = idx;
            this._render();
          });
          tabs.appendChild(tab);
        });
        body.appendChild(tabs);

        const schedule = this._config.schedules[this._selectedScheduleIdx];
        if (schedule) {
          const tabContent = document.createElement('div');
          tabContent.className = 'pf-tab-content';

          // Hour entity
          tabContent.appendChild(this._buildHaEntityPicker('Hour Entity', schedule.hour_entity || '', v => {
            this._config.schedules[this._selectedScheduleIdx].hour_entity = v || null;
            this._dispatch();
          }));

          // Minute entity
          tabContent.appendChild(this._buildHaEntityPicker('Minute Entity', schedule.minute_entity || '', v => {
            this._config.schedules[this._selectedScheduleIdx].minute_entity = v || null;
            this._dispatch();
          }));

          // Doses entity
          tabContent.appendChild(this._buildHaEntityPicker('Doses Entity', schedule.doses_entity || '', v => {
            this._config.schedules[this._selectedScheduleIdx].doses_entity = v || null;
            this._dispatch();
          }));

          // Enabled entity
          tabContent.appendChild(this._buildHaEntityPicker('Enabled Entity', schedule.enabled_entity || '', v => {
            this._config.schedules[this._selectedScheduleIdx].enabled_entity = v || null;
            this._dispatch();
          }));

          // Info entity
          tabContent.appendChild(this._buildHaEntityPicker('Info Entity', schedule.info_entity || '', v => {
            this._config.schedules[this._selectedScheduleIdx].info_entity = v || null;
            this._dispatch();
          }));

          const removeBtn = document.createElement('button');
          removeBtn.className = 'pf-btn pf-btn-danger pf-btn-sm';
          removeBtn.textContent = 'Remove This Schedule';
          removeBtn.style.marginTop = '8px';
          removeBtn.addEventListener('click', () => {
            this._config.schedules.splice(this._selectedScheduleIdx, 1);
            this._selectedScheduleIdx = Math.max(0, this._selectedScheduleIdx - 1);
            this._dispatch();
            this._render();
          });
          tabContent.appendChild(removeBtn);

          body.appendChild(tabContent);
        }
      }
    }));

    // === VISUALS SECTION ===
    editor.appendChild(this._buildSection('Visuals', false, (body) => {
      // Header Color
      body.appendChild(this._buildColorInput('Header Background Color', this._config.header_color || '#ffffff', v => {
        this._config.header_color = v;
        this._dispatch();
      }));

      // Header Opacity
      body.appendChild(this._buildSlider('Header Transparency', (this._config.header_opacity !== undefined ? this._config.header_opacity : 1), v => {
        this._config.header_opacity = parseFloat(v);
        this._dispatch();
      }));

      // Content Color
      body.appendChild(this._buildColorInput('Content Background Color', this._config.content_color || '#fafafa', v => {
        this._config.content_color = v;
        this._dispatch();
      }));

      // Content Opacity
      body.appendChild(this._buildSlider('Content Transparency', (this._config.content_opacity !== undefined ? this._config.content_opacity : 1), v => {
        this._config.content_opacity = parseFloat(v);
        this._dispatch();
      }));

      // Accent Color
      body.appendChild(this._buildColorInput('Accent Color', this._config.accent_color || '#4db6ac', v => {
        this._config.accent_color = v;
        this._dispatch();
      }));
    }));

    this.appendChild(editor);
  }

  // --- Builder helpers ---

  _buildSection(title, openByDefault, buildContent) {
    const isOpen = this._expandedSections[title] !== undefined ? this._expandedSections[title] : openByDefault;
    const section = document.createElement('div');
    section.className = 'pf-section' + (isOpen ? ' open' : '');

    const header = document.createElement('div');
    header.className = 'pf-section-header';
    const titleEl = document.createElement('div');
    titleEl.className = 'pf-section-title';
    const arrow = document.createElement('span');
    arrow.className = 'pf-arrow';
    arrow.textContent = '▶';
    titleEl.appendChild(arrow);
    const text = document.createElement('span');
    text.textContent = title;
    titleEl.appendChild(text);
    header.appendChild(titleEl);
    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pf-section-body';
    buildContent(body);
    section.appendChild(body);

    header.addEventListener('click', () => {
      const willOpen = !section.classList.contains('open');
      this._expandedSections[title] = willOpen;
      section.classList.toggle('open', willOpen);
    });

    return section;
  }

  _buildTextField(label, value, placeholder, onChange) {
    const field = document.createElement('div');
    field.className = 'pf-field';
    const lab = document.createElement('label');
    lab.className = 'pf-field-label';
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pf-text-input';
    input.value = value;
    input.placeholder = placeholder || '';
    // Use 'change' (on blur) only - avoids re-render issues
    input.addEventListener('change', e => onChange(e.target.value));
    field.appendChild(lab);
    field.appendChild(input);
    return field;
  }

  _buildHaEntityPicker(label, value, onChange) {
    const field = document.createElement('div');
    field.className = 'pf-field';
    const lab = document.createElement('label');
    lab.className = 'pf-field-label';
    lab.textContent = label;
    field.appendChild(lab);

    const picker = document.createElement('ha-entity-picker');
    picker.hass = this._hass;
    picker.value = value || '';
    picker.style.display = 'block';
    picker.addEventListener('value-changed', e => {
      e.stopPropagation();
      onChange(e.detail.value);
    });
    field.appendChild(picker);
    return field;
  }

  _buildHaIconPicker(label, value, onChange) {
    const field = document.createElement('div');
    field.className = 'pf-field';
    const lab = document.createElement('label');
    lab.className = 'pf-field-label';
    lab.textContent = label;
    field.appendChild(lab);

    const picker = document.createElement('ha-icon-picker');
    picker.hass = this._hass;
    picker.value = value || '';
    picker.style.display = 'block';
    picker.addEventListener('value-changed', e => {
      e.stopPropagation();
      onChange(e.detail.value);
    });
    field.appendChild(picker);
    return field;
  }

  _buildColorMapping(statusIdx) {
    const s = this._config.status[statusIdx];
    if (!s.color_map || !Array.isArray(s.color_map)) s.color_map = [];

    const container = document.createElement('div');
    container.className = 'pf-field';

    const label = document.createElement('label');
    label.className = 'pf-field-label';
    label.textContent = 'Color Mapping (state → color)';
    container.appendChild(label);

    // Existing mappings
    s.color_map.forEach((mapping, idx) => {
      const row = document.createElement('div');
      row.className = 'pf-mapping-row';

      const stateDiv = document.createElement('div');
      stateDiv.className = 'pf-mapping-state';
      const stateInput = document.createElement('input');
      stateInput.type = 'text';
      stateInput.value = mapping.state || '';
      stateInput.placeholder = 'State (e.g. on, off, home)';
      stateInput.addEventListener('change', e => {
        this._config.status[statusIdx].color_map[idx].state = e.target.value;
        this._dispatch();
      });
      stateDiv.appendChild(stateInput);

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'pf-color-input';
      colorInput.value = mapping.color || '#888888';
      colorInput.addEventListener('input', e => {
        this._config.status[statusIdx].color_map[idx].color = e.target.value;
        this._dispatch();
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'pf-btn-icon';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove mapping';
      removeBtn.addEventListener('click', () => {
        this._config.status[statusIdx].color_map.splice(idx, 1);
        this._dispatch();
        this._render();
      });

      row.appendChild(stateDiv);
      row.appendChild(colorInput);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'pf-btn pf-btn-primary pf-btn-sm';
    addBtn.textContent = '+ Add State';
    addBtn.style.marginTop = '4px';
    addBtn.addEventListener('click', () => {
      this._config.status[statusIdx].color_map.push({ state: '', color: '#4caf50' });
      this._dispatch();
      this._render();
    });
    container.appendChild(addBtn);

    return container;
  }

  _buildColorInput(label, value, onChange) {
    const field = document.createElement('div');
    field.className = 'pf-field';
    const lab = document.createElement('label');
    lab.className = 'pf-field-label';
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'pf-text-input';
    input.style.height = '40px';
    input.style.cursor = 'pointer';
    input.value = value || '#ffffff';
    input.addEventListener('change', e => onChange(e.target.value));
    field.appendChild(lab);
    field.appendChild(input);
    return field;
  }

  _buildSlider(label, value, onChange) {
    const field = document.createElement('div');
    field.className = 'pf-field';
    const lab = document.createElement('label');
    lab.className = 'pf-field-label';
    lab.textContent = label;
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.1';
    slider.value = value || '1';
    slider.style.flex = '1';
    slider.style.height = '6px';
    slider.style.cursor = 'pointer';
    
    const valueDisplay = document.createElement('div');
    valueDisplay.style.minWidth = '40px';
    valueDisplay.style.textAlign = 'right';
    valueDisplay.style.fontWeight = '500';
    valueDisplay.style.fontSize = '12px';
    valueDisplay.style.color = 'var(--primary-text-color)';
    valueDisplay.textContent = `${Math.round(value * 100)}%`;
    
    slider.addEventListener('input', e => {
      valueDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
      onChange(e.target.value);
    });
    
    container.appendChild(slider);
    container.appendChild(valueDisplay);
    
    field.appendChild(lab);
    field.appendChild(container);
    return field;
  }
}

customElements.define('petfeeder-card-editor', PetfeederCardEditor);
