class PetfeederCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._popupOpen = false;
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = Object.assign({
      main_title: 'My Feeder',
      show_title: true,
      compact: false,
      image: '',
      last_feed_entity: null,
      today_grams_entity: null,
      today_doses_entity: null,
      food_delivery_error_entity: null,
      schedules: [],
      header_color: '#ffffff',
      header_opacity: 1,
      content_color: '#fafafa',
      content_opacity: 1,
      accent_color: '#4db6ac',
      left_status: [],
      tabs_config: {
        show_tabs: true,
        active_tab: 'schedules',
        schedules_label: 'Schedules',
        manual_feed_label: 'Manual Feed',
        stats_label: 'Stats',
        settings_label: 'Settings',
        manual_feed: {
          quick_feeds: [
            { label: '1 Dose', entity: '' },
            { label: '3 Doses', entity: '' },
            { label: '6 Doses', entity: '' }
          ],
          custom_doses_entity: '',
          feed_button_entity: ''
        },
        stats: [],
        settings: []
      }
    }, config || {});
    this._activeTab = this._config.tabs_config?.active_tab || 'schedules';
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
      main_title: 'My Feeder',
      show_title: true,
      image: '/local/pet.jpg',
      last_feed_entity: '',
      today_grams_entity: '',
      today_doses_entity: '',
      food_delivery_error_entity: '',
      schedules: [],
      left_status: [],
      tabs_config: {
        show_tabs: true,
        active_tab: 'schedules',
        schedules_label: 'Schedules',
        manual_feed_label: 'Manual Feed',
        stats_label: 'Stats',
        settings_label: 'Settings',
        manual_feed: {
          quick_feeds: [],
          custom_doses_entity: '',
          feed_button_entity: ''
        },
        stats: [],
        settings: []
      }
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._popupOpen) this.render();
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
    const accentColor = this._config.accent_color || '#4db6ac';
    const errorColor = '#ff6b6b';

    // Get current time from Home Assistant
    const now = new Date();
    if (this._hass && this._hass.states['sensor.time']) {
      // Use HA time if available
      const timeStr = this._hass.states['sensor.time']?.state;
      if (timeStr && typeof timeStr === 'string') {
        const [h, m] = timeStr.split(':').map(Number);
        now.setHours(h, m, 0, 0);
      }
    }

    // Get error sensor state
    const errorSensor = this._config.food_delivery_error_entity;
    const hasError = errorSensor && this._hass?.states[errorSensor]?.state === 'on';

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
      const segmentDeg = availableDeg / schedules.length;
      const segmentRad = (segmentDeg / 360) * circumference;
      let currentAngle = -90;

      schedules.forEach((sched) => {
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

        // Determine schedule status
        const scheduleTime = new Date(now);
        scheduleTime.setHours(sched.hour, sched.minute, 0, 0);
        const isSchedulePassed = now >= scheduleTime;

        // Only fill if schedule has passed
        if (isSchedulePassed) {
          const fillSeg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          fillSeg.setAttribute('cx', cx);
          fillSeg.setAttribute('cy', cy);
          fillSeg.setAttribute('r', radius);
          fillSeg.setAttribute('fill', 'none');
          // Red if error, green if success
          fillSeg.setAttribute('stroke', hasError ? errorColor : accentColor);
          fillSeg.setAttribute('stroke-width', strokeWidth);
          fillSeg.setAttribute('stroke-dasharray', `${segmentRad} ${circumference}`);
          fillSeg.setAttribute('stroke-dashoffset', `${offset}`);
          fillSeg.setAttribute('stroke-linecap', 'round');
          svg.appendChild(fillSeg);
        }

        currentAngle += segmentDeg + gap;
      });
    } else {
      // No schedules: show simple progress ring
      const todayGrams = this._getTodayGrams();
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

    const schedules = this._getScheduleData();

    if (schedules.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;color:#999;font-size:13px;padding:16px';
      empty.textContent = 'No schedules configured';
      container.appendChild(empty);
      return container;
    }

    // Get current time
    const now = new Date();
    if (this._hass && this._hass.states['sensor.time']) {
      const timeStr = this._hass.states['sensor.time']?.state;
      if (timeStr && typeof timeStr === 'string') {
        const [h, m] = timeStr.split(':').map(Number);
        now.setHours(h, m, 0, 0);
      }
    }

    // Get error sensor state
    const errorSensor = this._config.food_delivery_error_entity;
    const hasError = errorSensor && this._hass?.states[errorSensor]?.state === 'on';

    schedules.forEach((sched, idx) => {
      const item = document.createElement('div');
      item.className = 'schedule-item' + (sched.enabled ? '' : ' disabled');
      item.style.cursor = 'pointer';

      const timeline = document.createElement('div');
      timeline.className = 'timeline-marker';
      const dot = document.createElement('div');
      dot.className = 'timeline-dot';
      
      // Determine dot color based on schedule status
      const scheduleTime = new Date(now);
      scheduleTime.setHours(sched.hour, sched.minute, 0, 0);
      const isSchedulePassed = now >= scheduleTime;

      if (isSchedulePassed) {
        dot.style.backgroundColor = hasError ? '#ff6b6b' : '#4db6ac';
      } else {
        dot.style.backgroundColor = '#ccc';
      }
      
      if (idx < schedules.length - 1) {
        const line = document.createElement('div');
        line.className = 'timeline-line';
        timeline.appendChild(line);
      }
      timeline.appendChild(dot);

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

      item.appendChild(timeline);
      item.appendChild(timeDiv);
      item.appendChild(dosesDiv);

      item.addEventListener('click', () => this._openSchedulePopup(sched));

      container.appendChild(item);
    });

    return container;
  }

  // --- Edit Popup ---

  _openSchedulePopup(sched) {
    if (!this._hass) return;

    const existing = this._shadow.querySelector('.popup-overlay');
    if (existing) existing.remove();

    this._popupOpen = true;

    const closePopup = () => {
      overlay.remove();
      this._popupOpen = false;
      this.render();
    };

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closePopup();
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
        const domain = cfg.enabled_entity.split('.')[0];
        if (domain === 'switch') {
          this._hass.callService('switch', toggleState ? 'turn_on' : 'turn_off', {
            entity_id: cfg.enabled_entity
          });
        } else if (domain === 'number') {
          this._hass.callService('number', 'set_value', {
            entity_id: cfg.enabled_entity,
            value: toggleState ? 1 : 0
          });
        } else if (domain === 'input_boolean') {
          this._hass.callService('input_boolean', toggleState ? 'turn_on' : 'turn_off', {
            entity_id: cfg.enabled_entity
          });
        }
      }
      closePopup();
    });
    popup.appendChild(saveBtn);

    // Close
    const closeBtn = document.createElement('button');
    closeBtn.className = 'popup-close';
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;border:none;background:none;cursor:pointer;color:var(--secondary-text-color,#888);font-size:16px;padding:0';
    closeBtn.addEventListener('click', () => closePopup());
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

  // --- Left Status Panel ---

  _renderLeftStatus() {
    const container = document.createElement('div');
    container.className = 'left-status-panel';

    if (!this._config.left_status || this._config.left_status.length === 0) {
      return container;
    }

    this._config.left_status.forEach(item => {
      if (!item || (!item.entity && !item.name)) return;

      const itemEl = document.createElement('div');
      itemEl.className = 'left-status-item';

      let color = '#888';
      let state = '';

      if (item.entity && this._hass) {
        const st = this._hass.states[item.entity];
        if (st) {
          state = st.state;
          if (item.color_map && Array.isArray(item.color_map)) {
            const mapping = item.color_map.find(m => m.state === st.state);
            if (mapping) color = mapping.color;
          } else {
            color = st.state === 'on' || st.state === 'home' ? '#4caf50' : '#f44336';
          }
        }
      }

      if (item.show_icon !== false && item.icon) {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'left-status-icon';
        iconDiv.style.color = color;
        const haIcon = document.createElement('ha-icon');
        haIcon.setAttribute('icon', item.icon);
        iconDiv.appendChild(haIcon);
        itemEl.appendChild(iconDiv);
      }

      if (item.show_name !== false && item.name) {
        const nameDiv = document.createElement('div');
        nameDiv.className = 'left-status-name';
        nameDiv.textContent = item.name;
        itemEl.appendChild(nameDiv);
      }

      if (item.show_state !== false && item.entity && this._hass) {
        const stateDiv = document.createElement('div');
        stateDiv.className = 'left-status-state';
        const st = this._hass.states[item.entity];
        if (st) {
          stateDiv.textContent = st.state;
        }
        itemEl.appendChild(stateDiv);
      }

      container.appendChild(itemEl);
    });

    return container;
  }

  // --- Manual Feed Tab ---

  _renderManualFeedTab() {
    const container = document.createElement('div');

    // Quick feed buttons from config
    const cfg = this._config.tabs_config?.manual_feed || {};
    const quickFeeds = cfg.quick_feeds || [];

    const quickSection = document.createElement('div');
    quickSection.style.marginBottom = '16px';

    const quickTitle = document.createElement('div');
    quickTitle.className = 'tab-section-title';
    quickTitle.textContent = 'Quick Feed';
    quickSection.appendChild(quickTitle);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'quick-feed-buttons';

    quickFeeds.forEach(feed => {
      if (!feed.entity) return; // Skip if entity not configured
      const btn = document.createElement('button');
      btn.className = 'quick-feed-btn';
      btn.innerHTML = `<div class="feed-btn-label">${feed.label || 'Feed'}</div>`;
      btn.addEventListener('click', () => this._pressFeedButton(feed.entity));
      buttonsContainer.appendChild(btn);
    });

    if (buttonsContainer.children.length > 0) {
      quickSection.appendChild(buttonsContainer);
      container.appendChild(quickSection);
    }

    // Custom feed
    const customSection = document.createElement('div');
    const customTitle = document.createElement('div');
    customTitle.className = 'tab-section-title';
    customTitle.textContent = 'Custom Feed';
    customSection.appendChild(customTitle);

    const customRow = document.createElement('div');
    customRow.className = 'custom-feed-row';

    const dosenInput = document.createElement('input');
    dosenInput.type = 'number';
    dosenInput.className = 'custom-doses-input';
    dosenInput.min = '1';
    dosenInput.max = '10';
    dosenInput.value = '1';
    dosenInput.placeholder = 'Doses';

    const customBtn = document.createElement('button');
    customBtn.className = 'custom-feed-btn';
    customBtn.textContent = 'Feed';
    customBtn.addEventListener('click', () => {
      const doses = parseInt(dosenInput.value, 10) || 1;
      this._feedNow(doses);
    });

    customRow.appendChild(dosenInput);
    customRow.appendChild(customBtn);
    customSection.appendChild(customRow);
    container.appendChild(customSection);

    return container;
  }

  _pressFeedButton(entity) {
    if (!this._hass) return;
    // Call button.press service on the button entity
    this._hass.callService('button', 'press', { entity_id: entity });
  }

  _feedNow(doses) {
    if (!this._hass) return;
    const feedButtonEntity = this._config.tabs_config?.manual_feed?.feed_button_entity;
    if (!feedButtonEntity) {
      console.warn('Feed button entity not configured');
      return;
    }
    // Call button.press service on the configured button entity
    this._hass.callService('button', 'press', { entity_id: feedButtonEntity });
  }

  // --- Stats Tab ---

  _renderStatsTab() {
    const container = document.createElement('div');

    const stats = this._config.tabs_config?.stats || [];

    if (stats.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;color:#999;font-size:13px;padding:16px';
      empty.textContent = 'No stats configured';
      container.appendChild(empty);
      return container;
    }

    stats.forEach(stat => {
      if (!stat || !stat.entity) return;

      const item = document.createElement('div');
      item.className = 'stats-item';

      if (stat.label) {
        const label = document.createElement('div');
        label.className = 'stats-label';
        label.textContent = stat.label;
        item.appendChild(label);
      }

      const value = document.createElement('div');
      value.className = 'stats-value';

      if (this._hass && this._hass.states[stat.entity]) {
        const st = this._hass.states[stat.entity];
        value.textContent = st.state + (stat.unit ? ' ' + stat.unit : '');
      } else {
        value.textContent = 'N/A';
      }

      item.appendChild(value);
      container.appendChild(item);
    });

    return container;
  }

  // --- Settings Tab ---

  _renderSettingsTab() {
    const container = document.createElement('div');

    const settings = this._config.tabs_config?.settings || [];

    if (settings.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;color:#999;font-size:13px;padding:16px';
      empty.textContent = 'No settings configured';
      container.appendChild(empty);
      return container;
    }

    settings.forEach(setting => {
      if (!setting) return;

      const item = document.createElement('div');
      item.className = 'settings-item';

      const label = document.createElement('div');
      label.className = 'settings-label';
      label.textContent = setting.name || 'Setting';
      item.appendChild(label);

      if (setting.type === 'switch' && setting.entity) {
        const toggle = document.createElement('div');
        toggle.className = 'toggle';

        if (this._hass && this._hass.states[setting.entity]) {
          const st = this._hass.states[setting.entity];
          if (st.state === 'on') toggle.classList.add('on');
        }

        toggle.innerHTML = '<div class="toggle-thumb"></div>';
        toggle.addEventListener('click', () => {
          if (!this._hass) return;
          const st = this._hass.states[setting.entity];
          const newState = !st || st.state !== 'on' ? 'on' : 'off';
          this._hass.callService('switch', newState === 'on' ? 'turn_on' : 'turn_off', {
            entity_id: setting.entity
          });
        });

        item.appendChild(toggle);
      } else if (setting.type === 'button' && setting.service) {
        const btn = document.createElement('button');
        btn.className = 'settings-btn';
        btn.textContent = setting.name || 'Button';
        btn.addEventListener('click', () => {
          if (!this._hass) return;
          const [domain, service] = setting.service.split('.');
          this._hass.callService(domain, service, setting.service_data || {});
        });
        item.appendChild(btn);
      } else if (setting.type === 'sensor' && setting.entity) {
        const value = document.createElement('div');
        value.className = 'settings-value';

        if (this._hass && this._hass.states[setting.entity]) {
          const st = this._hass.states[setting.entity];
          value.textContent = st.state;
        } else {
          value.textContent = 'N/A';
        }

        item.appendChild(value);
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
      :host{display:block;box-sizing:border-box;padding:0;max-width:800px;margin:0 auto;font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif)}
      .card{border-radius:12px;overflow:hidden;background:var(--ha-card-background, #fff);box-shadow:var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,0.1));display:flex;flex-direction:column}
      .card-header{background:${headerBg};padding:20px 16px 0;text-align:center;position:relative}
      .pet-name{font-size:16px;font-weight:500;color:var(--primary-text-color,#333);display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px}
      .pet-name img{width:28px;height:28px;border-radius:50%;object-fit:cover}
      .sub-label{font-size:12px;color:var(--secondary-text-color,#888);margin-bottom:16px}
      .header-main{display:flex;align-items:center;justify-content:center;gap:0;padding:0 8px}
      .header-left{flex:0 0 100px;display:flex;flex-direction:column;gap:8px;align-items:center;padding:8px 4px}
      .header-center{flex:1;display:flex;flex-direction:column;align-items:center;padding:0 12px}
      .header-right{flex:0 0 120px;display:flex;flex-direction:column;gap:4px;align-items:stretch;padding:8px 4px}
      .left-status-panel{display:flex;flex-direction:column;gap:8px;width:100%}
      .left-status-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 8px;background:transparent;border-radius:6px;border:none}
      .left-status-icon{font-size:28px;color:#888;display:flex;align-items:center;justify-content:center}
      .left-status-name{font-size:11px;color:var(--secondary-text-color,#888);text-align:center;word-break:break-word;max-width:80px;font-weight:500}
      .left-status-state{font-size:10px;color:var(--secondary-text-color,#888);text-align:center}
      .dial-container{position:relative;width:200px;height:200px;margin:0 auto}
      .dial-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
      .dial-grams{font-size:48px;font-weight:300;color:var(--primary-text-color,#333);line-height:1}
      .dial-label{font-size:12px;color:var(--secondary-text-color,#888);margin-top:4px}
      .next-schedule-row{margin-top:8px;margin-bottom:12px;font-size:13px;color:var(--secondary-text-color,#888);text-align:center}
      .tab-btn{width:100%;padding:10px 8px;border:none;background:var(--secondary-background-color,#f5f5f5);color:var(--secondary-text-color,#888);font-size:11px;font-weight:500;cursor:pointer;transition:all 0.2s;border-radius:6px;text-align:center;white-space:nowrap;border:1px solid var(--divider-color,#e0e0e0)}
      .tab-btn:hover{background:var(--ha-card-background,#fff);border-color:${accentColor}}
      .tab-btn.active{color:${accentColor};background:var(--ha-card-background,#fff);border-color:${accentColor};font-weight:600}
      .tab-content-area{background:${contentBg};padding:16px;border-top:1px solid var(--divider-color,#e0e0e0);min-height:60px;animation:slideDown 0.4s ease-out;position:relative;visibility:hidden;opacity:0;transition:visibility 0s 0.4s,opacity 0.4s ease-out}
      .tab-content-area.active{visibility:visible;opacity:1;transition:visibility 0s,opacity 0.4s ease-out}
      @keyframes slideDown{from{transform:translateY(-20px)}to{transform:translateY(0)}}
      @keyframes slideUp{from{transform:translateY(20px)}to{transform:translateY(0)}}
      .tab-content-close-btn{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:32px;height:32px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--secondary-text-color,#888);border-radius:6px;transition:all 0.2s}
      .tab-content-close-btn:hover{background:var(--divider-color,#e0e0e0);color:var(--primary-text-color,#333)}
      .tab-content-close-btn ha-icon{font-size:20px}
      .schedule-section{display:none}
      .schedule-section.active{display:block}
      .schedule-item{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:8px;transition:background 0.15s}
      .schedule-item:hover{background:var(--secondary-background-color, rgba(0,0,0,.03))}
      .schedule-item.disabled{opacity:0.4}
      .timeline-marker{position:relative;width:16px;display:flex;flex-direction:column;align-items:center;flex-shrink:0;align-self:stretch}
      .timeline-dot{width:10px;height:10px;border-radius:50%;background:${accentColor};flex-shrink:0;z-index:1;position:relative;margin-top:6px}
      .timeline-line{position:absolute;top:16px;bottom:-10px;left:50%;width:2px;background:var(--divider-color, #ddd);transform:translateX(-50%)}
      .schedule-time{font-size:16px;font-weight:500;color:var(--primary-text-color,#333);min-width:54px}
      .schedule-doses{font-size:13px;color:var(--secondary-text-color,#888);flex:1;text-align:right}
      .tab-content-manual-feed,.tab-content-stats,.tab-content-settings{display:none}
      .tab-content-manual-feed.active,.tab-content-stats.active,.tab-content-settings.active{display:block}
      .tab-section-title{font-size:12px;font-weight:600;color:var(--primary-text-color,#333);text-transform:uppercase;margin-bottom:8px;letter-spacing:0.5px}
      .quick-feed-buttons{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
      .quick-feed-btn{padding:10px;border:1px solid var(--divider-color,#e0e0e0);background:var(--ha-card-background,#fff);border-radius:6px;cursor:pointer;transition:all 0.2s;font-size:12px;text-align:center}
      .quick-feed-btn:hover{background:var(--secondary-background-color,#f5f5f5);border-color:${accentColor}}
      .feed-btn-label{font-weight:500;color:var(--primary-text-color,#333)}
      .feed-btn-doses{font-size:10px;color:var(--secondary-text-color,#888)}
      .custom-feed-row{display:flex;gap:6px;margin-bottom:12px}
      .custom-doses-input{flex:1;padding:8px 6px;border:1px solid var(--divider-color,#e0e0e0);border-radius:4px;font-size:12px;text-align:center;background:var(--ha-card-background,#fff)}
      .custom-feed-btn{flex:1;padding:8px 6px;border:none;background:${accentColor};color:#fff;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;transition:opacity 0.2s}
      .custom-feed-btn:hover{opacity:0.85}
      .stats-item{padding:8px;background:var(--ha-card-background,#fff);border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;margin-bottom:6px}
      .stats-label{font-size:10px;color:var(--secondary-text-color,#888);margin-bottom:2px}
      .stats-value{font-size:14px;font-weight:500;color:var(--primary-text-color,#333)}
      .settings-item{padding:10px;background:var(--ha-card-background,#fff);border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
      .settings-label{font-size:12px;color:var(--primary-text-color,#333);font-weight:500;flex:1}
      .settings-value{font-size:12px;color:var(--secondary-text-color,#888)}
      .settings-btn{padding:6px 10px;border:1px solid var(--divider-color,#e0e0e0);background:var(--ha-card-background,#fff);color:var(--primary-text-color,#333);border-radius:4px;font-size:11px;cursor:pointer;transition:all 0.2s}
      .settings-btn:hover{background:var(--secondary-background-color,#f5f5f5);border-color:${accentColor}}
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

    // --- Header Section ---
    const header = document.createElement('div');
    header.className = 'card-header';

    // Title
    const petName = document.createElement('div');
    petName.className = 'pet-name';
    if (this._config.image) {
      const img = document.createElement('img');
      img.src = this._config.image;
      img.alt = '';
      petName.appendChild(img);
    }
    if (this._config.show_title !== false) {
      const nameSpan = document.createElement('span');
      nameSpan.textContent = this._config.main_title || 'My Feeder';
      petName.appendChild(nameSpan);
    }
    header.appendChild(petName);

    // Subtitle
    const subLabel = document.createElement('div');
    subLabel.className = 'sub-label';
    subLabel.textContent = 'Portions & Grams dispensed today';
    header.appendChild(subLabel);

    // Main row: [Status] | [Dial + Next] | [Tab Buttons]
    const headerMain = document.createElement('div');
    headerMain.className = 'header-main';

    // Left: Status icons
    const headerLeft = document.createElement('div');
    headerLeft.className = 'header-left';
    headerLeft.appendChild(this._renderLeftStatus());
    headerMain.appendChild(headerLeft);

    // Center: Dial + Next schedule
    const headerCenter = document.createElement('div');
    headerCenter.className = 'header-center';
    headerCenter.appendChild(this._renderDial());

    const nextRow = document.createElement('div');
    nextRow.className = 'next-schedule-row';
    const nextSchedule = this._computeNextSchedule();
    if (nextSchedule) {
      const s = nextSchedule.schedule;
      nextRow.textContent = `Next: ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} (${s.doses} portions)`;
    } else {
      nextRow.textContent = 'No upcoming schedules';
    }
    headerCenter.appendChild(nextRow);
    headerMain.appendChild(headerCenter);

    // Right: Tab buttons (vertical stack)
    const headerRight = document.createElement('div');
    headerRight.className = 'header-right';

    const tabs = [
      { key: 'schedules', label: this._config.tabs_config.schedules_label || 'Schedules' },
      { key: 'manual_feed', label: this._config.tabs_config.manual_feed_label || 'Manual Feed' },
      { key: 'stats', label: this._config.tabs_config.stats_label || 'Stats' },
      { key: 'settings', label: this._config.tabs_config.settings_label || 'Settings' }
    ];

    tabs.forEach(tab => {
      const tabBtn = document.createElement('button');
      tabBtn.className = 'tab-btn' + (this._activeTab === tab.key ? ' active' : '');
      tabBtn.textContent = tab.label;
      tabBtn.addEventListener('click', () => {
        this._activeTab = tab.key;
        this.render();
      });
      headerRight.appendChild(tabBtn);
    });

    headerMain.appendChild(headerRight);
    header.appendChild(headerMain);
    wrap.appendChild(header);

    // --- Tab Content Area (below header) ---
    const tabContentArea = document.createElement('div');
    tabContentArea.className = 'tab-content-area' + (this._activeTab ? ' active' : '');

    // Close button (will be added at the end, after content)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-content-close-btn';
    closeBtn.innerHTML = '<ha-icon icon="mdi:chevron-up"></ha-icon>';
    closeBtn.addEventListener('click', () => {
      tabContentArea.style.animation = 'slideUp 0.4s ease-out forwards';
      tabContentArea.style.opacity = '0';
      setTimeout(() => {
        this._activeTab = null;
        this.render();
      }, 400);
    });

    // Schedules tab content
    const schedTab = document.createElement('div');
    schedTab.className = 'schedule-section' + (this._activeTab === 'schedules' ? ' active' : '');
    schedTab.appendChild(this._renderScheduleTimeline());
    tabContentArea.appendChild(schedTab);

    // Manual Feed tab
    const manualFeedTab = document.createElement('div');
    manualFeedTab.className = 'tab-content-manual-feed' + (this._activeTab === 'manual_feed' ? ' active' : '');
    manualFeedTab.appendChild(this._renderManualFeedTab());
    tabContentArea.appendChild(manualFeedTab);

    // Stats tab
    const statsTab = document.createElement('div');
    statsTab.className = 'tab-content-stats' + (this._activeTab === 'stats' ? ' active' : '');
    statsTab.appendChild(this._renderStatsTab());
    tabContentArea.appendChild(statsTab);

    // Settings tab
    const settingsTab = document.createElement('div');
    settingsTab.className = 'tab-content-settings' + (this._activeTab === 'settings' ? ' active' : '');
    settingsTab.appendChild(this._renderSettingsTab());
    tabContentArea.appendChild(settingsTab);

    // Add close button at the end
    tabContentArea.appendChild(closeBtn);

    wrap.appendChild(tabContentArea);

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

      // Main Title
      body.appendChild(this._buildTextField('Main Title', this._config.main_title || 'My Feeder', 'e.g., My Feeder', v => {
        this._config.main_title = v || 'My Feeder';
        this._dispatch();
      }));

      // Show Title Toggle
      const showTitleRow = document.createElement('div');
      showTitleRow.className = 'popup-row';
      showTitleRow.style.cssText = 'margin-bottom:16px;display:flex;justify-content:space-between;align-items:center';
      const showTitleLabel = document.createElement('label');
      showTitleLabel.className = 'pf-field-label';
      showTitleLabel.textContent = 'Show Title';
      showTitleLabel.style.cssText = 'margin:0';
      const showTitleToggle = document.createElement('div');
      showTitleToggle.className = 'toggle' + (this._config.show_title !== false ? ' on' : '');
      showTitleToggle.innerHTML = '<div class="toggle-thumb"></div>';
      showTitleToggle.addEventListener('click', () => {
        this._config.show_title = !this._config.show_title;
        showTitleToggle.classList.toggle('on');
        this._dispatch();
      });
      showTitleRow.appendChild(showTitleLabel);
      showTitleRow.appendChild(showTitleToggle);
      body.appendChild(showTitleRow);

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

      // Food Delivery Error Entity
      body.appendChild(this._buildHaEntityPicker('Food Delivery Error Sensor', this._config.food_delivery_error_entity || '', v => {
        this._config.food_delivery_error_entity = v || null;
        this._dispatch();
      }));
    }));

    // === SCHEDULES SECTION ===
    editor.appendChild(this._buildSection('Schedules', true, (body) => {
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

          // Reorder buttons
          const reorderRow = document.createElement('div');
          reorderRow.style.cssText = 'display:flex;gap:8px;margin-top:8px';

          if (this._selectedScheduleIdx > 0) {
            const upBtn = document.createElement('button');
            upBtn.className = 'pf-btn pf-btn-sm';
            upBtn.style.cssText = 'flex:1;background:var(--secondary-background-color,#f5f5f5);color:var(--primary-text-color,#333);border:1px solid var(--divider-color,#e0e0e0)';
            upBtn.textContent = '↑ Move Up';
            upBtn.addEventListener('click', () => {
              const i = this._selectedScheduleIdx;
              [this._config.schedules[i], this._config.schedules[i - 1]] = [this._config.schedules[i - 1], this._config.schedules[i]];
              this._selectedScheduleIdx = i - 1;
              this._dispatch();
              this._render();
            });
            reorderRow.appendChild(upBtn);
          }

          if (this._selectedScheduleIdx < this._config.schedules.length - 1) {
            const downBtn = document.createElement('button');
            downBtn.className = 'pf-btn pf-btn-sm';
            downBtn.style.cssText = 'flex:1;background:var(--secondary-background-color,#f5f5f5);color:var(--primary-text-color,#333);border:1px solid var(--divider-color,#e0e0e0)';
            downBtn.textContent = '↓ Move Down';
            downBtn.addEventListener('click', () => {
              const i = this._selectedScheduleIdx;
              [this._config.schedules[i], this._config.schedules[i + 1]] = [this._config.schedules[i + 1], this._config.schedules[i]];
              this._selectedScheduleIdx = i + 1;
              this._dispatch();
              this._render();
            });
            reorderRow.appendChild(downBtn);
          }

          if (reorderRow.children.length > 0) tabContent.appendChild(reorderRow);

          body.appendChild(tabContent);
        }
      }
    }));

    // === LEFT STATUS SECTION ===
    editor.appendChild(this._buildSection('Left Status Panel', false, (body) => {
      // Ensure left_status exists
      if (!this._config.left_status) this._config.left_status = [];
      
      const addLeftStatusBtn = document.createElement('button');
      addLeftStatusBtn.className = 'pf-btn pf-btn-primary pf-btn-sm';
      addLeftStatusBtn.textContent = '+ Add Status Item';
      addLeftStatusBtn.style.marginBottom = '12px';
      addLeftStatusBtn.addEventListener('click', () => {
        if (!this._config.left_status) this._config.left_status = [];
        this._config.left_status.push({
          entity: '',
          name: '',
          icon: '',
          show_name: true,
          show_icon: true,
          show_state: true,
          color_map: []
        });
        this._dispatch();
        this._render();
      });
      body.appendChild(addLeftStatusBtn);

      if (this._config.left_status && this._config.left_status.length > 0) {
        this._config.left_status.forEach((item, idx) => {
          if (!item) return;

          const card = document.createElement('div');
          card.className = 'pf-status-card';

          const title = document.createElement('div');
          title.className = 'pf-status-title';
          title.textContent = `Status Item ${idx + 1}`;
          card.appendChild(title);

          // Entity picker
          card.appendChild(this._buildHaEntityPicker('Entity', item.entity || '', v => {
            this._config.left_status[idx].entity = v || null;
            this._dispatch();
          }));

          // Name
          card.appendChild(this._buildTextField('Name', item.name || '', 'e.g., Lid', v => {
            this._config.left_status[idx].name = v || null;
            this._dispatch();
          }));

          // Icon picker
          card.appendChild(this._buildHaIconPicker('Icon', item.icon || '', v => {
            this._config.left_status[idx].icon = v || null;
            this._dispatch();
          }));

          // Show Name toggle
          const showNameRow = document.createElement('div');
          showNameRow.className = 'popup-row';
          showNameRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
          const showNameLabel = document.createElement('label');
          showNameLabel.className = 'pf-field-label';
          showNameLabel.textContent = 'Show Name';
          showNameLabel.style.cssText = 'margin:0';
          const showNameToggle = document.createElement('div');
          showNameToggle.className = 'toggle' + (item.show_name !== false ? ' on' : '');
          showNameToggle.innerHTML = '<div class="toggle-thumb"></div>';
          showNameToggle.addEventListener('click', () => {
            this._config.left_status[idx].show_name = !this._config.left_status[idx].show_name;
            showNameToggle.classList.toggle('on');
            this._dispatch();
          });
          showNameRow.appendChild(showNameLabel);
          showNameRow.appendChild(showNameToggle);
          card.appendChild(showNameRow);

          // Show Icon toggle
          const showIconRow = document.createElement('div');
          showIconRow.className = 'popup-row';
          showIconRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
          const showIconLabel = document.createElement('label');
          showIconLabel.className = 'pf-field-label';
          showIconLabel.textContent = 'Show Icon';
          showIconLabel.style.cssText = 'margin:0';
          const showIconToggle = document.createElement('div');
          showIconToggle.className = 'toggle' + (item.show_icon !== false ? ' on' : '');
          showIconToggle.innerHTML = '<div class="toggle-thumb"></div>';
          showIconToggle.addEventListener('click', () => {
            this._config.left_status[idx].show_icon = !this._config.left_status[idx].show_icon;
            showIconToggle.classList.toggle('on');
            this._dispatch();
          });
          showIconRow.appendChild(showIconLabel);
          showIconRow.appendChild(showIconToggle);
          card.appendChild(showIconRow);

          // Show State toggle
          const showStateRow = document.createElement('div');
          showStateRow.className = 'popup-row';
          showStateRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
          const showStateLabel = document.createElement('label');
          showStateLabel.className = 'pf-field-label';
          showStateLabel.textContent = 'Show State';
          showStateLabel.style.cssText = 'margin:0';
          const showStateToggle = document.createElement('div');
          showStateToggle.className = 'toggle' + (item.show_state !== false ? ' on' : '');
          showStateToggle.innerHTML = '<div class="toggle-thumb"></div>';
          showStateToggle.addEventListener('click', () => {
            this._config.left_status[idx].show_state = !this._config.left_status[idx].show_state;
            showStateToggle.classList.toggle('on');
            this._dispatch();
          });
          showStateRow.appendChild(showStateLabel);
          showStateRow.appendChild(showStateToggle);
          card.appendChild(showStateRow);

          // Color mapping
          card.appendChild(this._buildColorMapping(idx, true));

          // Remove button
          const removeBtn = document.createElement('button');
          removeBtn.className = 'pf-btn pf-btn-danger pf-btn-sm';
          removeBtn.textContent = 'Remove This Item';
          removeBtn.style.marginTop = '8px';
          removeBtn.addEventListener('click', () => {
            this._config.left_status.splice(idx, 1);
            this._dispatch();
            this._render();
          });
          card.appendChild(removeBtn);

          body.appendChild(card);
        });
      }
    }));

    // === TABS CONFIGURATION SECTION ===
    editor.appendChild(this._buildSection('Tabs', true, (body) => {
      // Show tabs toggle
      const showTabsRow = document.createElement('div');
      showTabsRow.className = 'popup-row';
      showTabsRow.style.cssText = 'margin-bottom:16px';
      const showTabsLabel = document.createElement('label');
      showTabsLabel.className = 'pf-field-label';
      showTabsLabel.textContent = 'Show Tabs';
      showTabsLabel.style.cssText = 'margin:0';
      
      // Ensure tabs_config exists
      if (!this._config.tabs_config) this._config.tabs_config = {};
      if (!this._config.tabs_config.manual_feed) this._config.tabs_config.manual_feed = {};
      if (!this._config.tabs_config.stats) this._config.tabs_config.stats = [];
      if (!this._config.tabs_config.settings) this._config.tabs_config.settings = [];
      
      const showTabsToggle = document.createElement('div');
      showTabsToggle.className = 'toggle' + (this._config.tabs_config?.show_tabs ? ' on' : '');
      showTabsToggle.innerHTML = '<div class="toggle-thumb"></div>';
      showTabsToggle.addEventListener('click', () => {
        this._config.tabs_config.show_tabs = !this._config.tabs_config.show_tabs;
        showTabsToggle.classList.toggle('on');
        this._dispatch();
      });
      showTabsRow.appendChild(showTabsLabel);
      showTabsRow.appendChild(showTabsToggle);
      body.appendChild(showTabsRow);

      const cfg = this._config.tabs_config || {};

      // Tab labels
      body.appendChild(this._buildTextField('Schedules Label', cfg.schedules_label || 'Schedules', '', v => {
        this._config.tabs_config.schedules_label = v;
        this._dispatch();
      }));

      body.appendChild(this._buildTextField('Manual Feed Label', cfg.manual_feed_label || 'Manual Feed', '', v => {
        this._config.tabs_config.manual_feed_label = v;
        this._dispatch();
      }));

      body.appendChild(this._buildTextField('Stats Label', cfg.stats_label || 'Stats', '', v => {
        this._config.tabs_config.stats_label = v;
        this._dispatch();
      }));

      body.appendChild(this._buildTextField('Settings Label', cfg.settings_label || 'Settings', '', v => {
        this._config.tabs_config.settings_label = v;
        this._dispatch();
      }));

      // Subsections for each tab configuration
      body.appendChild(this._buildTabSubsection('Manual Feed', 'manual_feed'));
      body.appendChild(this._buildTabSubsection('Stats', 'stats'));
      body.appendChild(this._buildTabSubsection('Settings', 'settings'));
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

  _buildHaEntityPickerRaw(value, onChange) {
    const picker = document.createElement('ha-entity-picker');
    picker.hass = this._hass;
    picker.value = value || '';
    picker.style.display = 'block';
    picker.style.width = '100%';
    picker.addEventListener('value-changed', e => {
      e.stopPropagation();
      onChange(e.detail.value);
    });
    return picker;
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

  _buildColorMapping(statusIdx, isLeftStatus = false) {
    const arr = isLeftStatus ? this._config.left_status : this._config.status;
    const s = arr[statusIdx];
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
        arr[statusIdx].color_map[idx].state = e.target.value;
        this._dispatch();
      });
      stateDiv.appendChild(stateInput);

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'pf-color-input';
      colorInput.value = mapping.color || '#888888';
      colorInput.addEventListener('input', e => {
        arr[statusIdx].color_map[idx].color = e.target.value;
        this._dispatch();
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'pf-btn-icon';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove mapping';
      removeBtn.addEventListener('click', () => {
        arr[statusIdx].color_map.splice(idx, 1);
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
      arr[statusIdx].color_map.push({ state: '', color: '#4caf50' });
      this._dispatch();
      this._render();
    });
    container.appendChild(addBtn);

    return container;
  }

  _buildTabSubsection(name, tabKey) {
    const section = document.createElement('div');
    section.style.cssText = 'border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;padding:12px;margin-top:12px;background:var(--secondary-background-color,#f5f5f5)';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:13px;font-weight:500;color:var(--primary-text-color,#333);margin-bottom:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center';
    header.textContent = name;
    const arrow = document.createElement('span');
    arrow.textContent = '▼';
    arrow.style.cssText = 'transition:transform 0.2s';
    header.appendChild(arrow);

    const content = document.createElement('div');
    content.style.cssText = 'display:block';
    // Default to open (display:block), user can collapse if needed
    const isOpen = true;
    arrow.style.transform = isOpen ? 'rotate(180deg)' : '';

    header.addEventListener('click', () => {
      const willOpen = content.style.display === 'none';
      content.style.display = willOpen ? 'block' : 'none';
      arrow.style.transform = willOpen ? 'rotate(180deg)' : '';
    });

    if (tabKey === 'manual_feed') {
      // Ensure manual_feed structure exists
      if (!this._config.tabs_config.manual_feed) this._config.tabs_config.manual_feed = {};
      if (!this._config.tabs_config.manual_feed.quick_feeds) this._config.tabs_config.manual_feed.quick_feeds = [];
      
      const cfg = this._config.tabs_config?.manual_feed || {};
      const quickFeeds = cfg.quick_feeds || [];

      // Quick feed buttons section
      const quickTitle = document.createElement('div');
      quickTitle.style.cssText = 'font-size:12px;font-weight:600;color:var(--primary-text-color,#333);margin-bottom:8px;text-transform:uppercase';
      quickTitle.textContent = 'Quick Feed Buttons';
      content.appendChild(quickTitle);

      const addQuickBtn = document.createElement('button');
      addQuickBtn.className = 'pf-btn pf-btn-primary pf-btn-sm';
      addQuickBtn.textContent = '+ Add Quick Feed';
      addQuickBtn.style.marginBottom = '8px';
      addQuickBtn.addEventListener('click', () => {
        if (!this._config.tabs_config.manual_feed) this._config.tabs_config.manual_feed = {};
        if (!this._config.tabs_config.manual_feed.quick_feeds) this._config.tabs_config.manual_feed.quick_feeds = [];
        this._config.tabs_config.manual_feed.quick_feeds.push({ label: 'New Feed', entity: '' });
        this._dispatch();
        this._render();
      });
      content.appendChild(addQuickBtn);

      quickFeeds.forEach((feed, idx) => {
        const feedCard = document.createElement('div');
        feedCard.style.cssText = 'border:1px solid var(--divider-color,#e0e0e0);border-radius:4px;padding:8px;margin-bottom:8px;background:var(--ha-card-background,#fff)';

        const labelField = document.createElement('div');
        labelField.style.cssText = 'margin-bottom:6px';
        const labelLabel = document.createElement('label');
        labelLabel.className = 'pf-field-label';
        labelLabel.textContent = 'Label';
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'pf-text-input';
        labelInput.value = feed.label || '';
        labelInput.placeholder = 'e.g., 1 Dose';
        labelInput.style.width = '100%';
        labelInput.addEventListener('change', e => {
          this._config.tabs_config.manual_feed.quick_feeds[idx].label = e.target.value || 'Feed';
          this._dispatch();
        });
        labelField.appendChild(labelLabel);
        labelField.appendChild(labelInput);
        feedCard.appendChild(labelField);

        const entityRow = document.createElement('div');
        entityRow.style.cssText = 'margin-bottom:6px';
        const entityLabel = document.createElement('label');
        entityLabel.className = 'pf-field-label';
        entityLabel.textContent = 'Button Entity';
        entityRow.appendChild(entityLabel);
        
        const entityPicker = this._buildHaEntityPickerRaw(feed.entity || '', v => {
          this._config.tabs_config.manual_feed.quick_feeds[idx].entity = v || null;
          this._dispatch();
        });
        entityPicker.style.marginBottom = '6px';
        entityRow.appendChild(entityPicker);
        feedCard.appendChild(entityRow);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'pf-btn pf-btn-danger pf-btn-sm';
        removeBtn.textContent = 'Remove';
        removeBtn.style.width = '100%';
        removeBtn.addEventListener('click', () => {
          this._config.tabs_config.manual_feed.quick_feeds.splice(idx, 1);
          this._dispatch();
          this._render();
        });
        feedCard.appendChild(removeBtn);

        content.appendChild(feedCard);
      });

      // Custom feed config
      const customTitle = document.createElement('div');
      customTitle.style.cssText = 'font-size:12px;font-weight:600;color:var(--primary-text-color,#333);margin:12px 0 8px;text-transform:uppercase';
      customTitle.textContent = 'Custom Feed Settings';
      content.appendChild(customTitle);

      content.appendChild(this._buildHaEntityPicker('Custom Doses Input Entity', cfg.custom_doses_entity || '', v => {
        this._config.tabs_config.manual_feed.custom_doses_entity = v || null;
        this._dispatch();
      }));

      content.appendChild(this._buildHaEntityPicker('Feed Button Entity', cfg.feed_button_entity || '', v => {
        this._config.tabs_config.manual_feed.feed_button_entity = v || null;
        this._dispatch();
      }));
    } else if (tabKey === 'stats') {
      const stats = this._config.tabs_config?.stats || [];

      const addStatBtn = document.createElement('button');
      addStatBtn.className = 'pf-btn pf-btn-primary pf-btn-sm';
      addStatBtn.textContent = '+ Add Stat';
      addStatBtn.style.marginBottom = '8px';
      addStatBtn.addEventListener('click', () => {
        if (!this._config.tabs_config.stats) this._config.tabs_config.stats = [];
        this._config.tabs_config.stats.push({ entity: '', label: '', unit: '' });
        this._dispatch();
        this._render();
      });
      content.appendChild(addStatBtn);

      stats.forEach((stat, idx) => {
        const card = document.createElement('div');
        card.className = 'pf-status-card';

        content.appendChild(this._buildHaEntityPicker('Entity', stat.entity || '', v => {
          this._config.tabs_config.stats[idx].entity = v || null;
          this._dispatch();
        }));

        content.appendChild(this._buildTextField('Label', stat.label || '', 'Stat name', v => {
          this._config.tabs_config.stats[idx].label = v || null;
          this._dispatch();
        }));

        content.appendChild(this._buildTextField('Unit', stat.unit || '', 'e.g., g, %', v => {
          this._config.tabs_config.stats[idx].unit = v || null;
          this._dispatch();
        }));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'pf-btn pf-btn-danger pf-btn-sm';
        removeBtn.textContent = 'Remove';
        removeBtn.style.marginTop = '8px';
        removeBtn.addEventListener('click', () => {
          this._config.tabs_config.stats.splice(idx, 1);
          this._dispatch();
          this._render();
        });
        content.appendChild(removeBtn);
      });
    } else if (tabKey === 'settings') {
      const settings = this._config.tabs_config?.settings || [];

      const addSettingBtn = document.createElement('button');
      addSettingBtn.className = 'pf-btn pf-btn-primary pf-btn-sm';
      addSettingBtn.textContent = '+ Add Setting';
      addSettingBtn.style.marginBottom = '8px';
      addSettingBtn.addEventListener('click', () => {
        if (!this._config.tabs_config.settings) this._config.tabs_config.settings = [];
        this._config.tabs_config.settings.push({ name: '', type: 'sensor', entity: '', service: '', service_data: {} });
        this._dispatch();
        this._render();
      });
      content.appendChild(addSettingBtn);

      settings.forEach((setting, idx) => {
        const card = document.createElement('div');
        card.className = 'pf-status-card';

        content.appendChild(this._buildTextField('Name', setting.name || '', 'Setting name', v => {
          this._config.tabs_config.settings[idx].name = v || null;
          this._dispatch();
        }));

        const typeField = document.createElement('div');
        typeField.className = 'pf-field';
        const typeLabel = document.createElement('label');
        typeLabel.className = 'pf-field-label';
        typeLabel.textContent = 'Type';
        const typeSel = document.createElement('select');
        typeSel.className = 'pf-select';
        ['sensor', 'switch', 'button'].forEach(t => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
          typeSel.appendChild(opt);
        });
        typeSel.value = setting.type || 'sensor';
        typeSel.addEventListener('change', e => {
          this._config.tabs_config.settings[idx].type = e.target.value;
          this._dispatch();
          this._render();
        });
        typeField.appendChild(typeLabel);
        typeField.appendChild(typeSel);
        content.appendChild(typeField);

        if (setting.type === 'button') {
          content.appendChild(this._buildTextField('Service', setting.service || '', 'e.g., switch.turn_on', v => {
            this._config.tabs_config.settings[idx].service = v || null;
            this._dispatch();
          }));
        } else {
          content.appendChild(this._buildHaEntityPicker('Entity', setting.entity || '', v => {
            this._config.tabs_config.settings[idx].entity = v || null;
            this._dispatch();
          }));
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'pf-btn pf-btn-danger pf-btn-sm';
        removeBtn.textContent = 'Remove';
        removeBtn.style.marginTop = '8px';
        removeBtn.addEventListener('click', () => {
          this._config.tabs_config.settings.splice(idx, 1);
          this._dispatch();
          this._render();
        });
        content.appendChild(removeBtn);
      });
    }

    section.appendChild(header);
    section.appendChild(content);

    return section;
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
