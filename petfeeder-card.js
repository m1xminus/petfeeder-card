class PetfeederCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._shadow = this.attachShadow({ mode: 'open' });
    this._selectedMenu = null;
  }

  setConfig(config) {
    this._config = Object.assign({
      title: 'Petfeeder',
      compact: false,
      image: '',
      status: [null, null, null, null],
      menu: [
        { name: 'Info', content: 'Info content' },
        { name: 'Logs', content: 'Logs content' },
        { name: 'Feed Now', content: 'Feed Now' },
        { name: 'Settings', content: 'Settings' }
      ],
      last_feed_entity: null,
      schedules: []
    }, config || {});
    this._selectedMenu = (this._config.menu && this._config.menu[0]) ? this._config.menu[0].name : null;
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
      menu: [
        { name: 'Info', content: 'Pet info' },
        { name: 'Logs', content: 'Feeding logs' }
      ],
      last_feed_entity: 'sensor.last_feeding',
      schedules: []
    };
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  _renderStatuses() {
    const container = document.createElement('div');
    container.className = 'status-row';
    (this._config.status || []).forEach((s, idx) => {
      if (!s || (!s.entity && !s.icon && !s.name)) {
        return; // Skip empty slots
      }
      const item = document.createElement('div');
      item.className = 'status-item';
      
      let color = s.color || '#888';
      if (s.entity && this._hass) {
        const st = this._hass.states[s.entity];
        if (st) {
          if (s.color_map) {
            try {
              const map = typeof s.color_map === 'string' ? JSON.parse(s.color_map) : s.color_map;
              if (map[st.state]) color = map[st.state];
            } catch (e) {}
          } else if (st.state === 'on' || st.state === 'home' || st.state === 'connected') {
            color = '#4caf50';
          } else if (st.state === 'off' || st.state === 'unavailable' || st.state === 'disconnected') {
            color = '#f44336';
          }
        }
      }

      // Display colored circle (and icon name as fallback text)
      const dot = document.createElement('div');
      dot.style.cssText = `width:20px;height:20px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:bold;flex-shrink:0;`;
      if (s.icon) {
        // Extract last part of icon name (e.g., "food-apple" from "mdi:food-apple")
        const iconName = s.icon.split(':').pop().substring(0, 2).toUpperCase();
        dot.textContent = iconName;
      }
      item.appendChild(dot);

      // Display name/label if available
      if (s.name) {
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-size:13px;color:#666;margin-left:8px;font-weight:500;';
        nameDiv.textContent = s.name;
        item.appendChild(nameDiv);
      }

      container.appendChild(item);
    });
    return container;
  }

  _renderHeader() {
    const header = document.createElement('div');
    header.className = 'header';

    const left = document.createElement('div');
    left.className = 'left';
    const statusTitle = document.createElement('div');
    statusTitle.className = 'status-title';
    statusTitle.textContent = 'status:';
    left.appendChild(statusTitle);
    left.appendChild(this._renderStatuses());

    const center = document.createElement('div');
    center.className = 'center';
    const img = document.createElement('img');
    img.className = 'pet-img';
    img.src = this._config.image || '';
    img.alt = 'Pet picture';
    center.appendChild(img);

    const right = document.createElement('div');
    right.className = 'right';
    const menuWrap = document.createElement('div');
    menuWrap.className = 'menu-wrap';
    const select = document.createElement('select');
    select.className = 'menu-select';
    (this._config.menu || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
    select.value = this._selectedMenu || (this._config.menu[0] && this._config.menu[0].name);
    select.addEventListener('change', e => {
      this._selectedMenu = e.target.value;
      this.render();
    });
    menuWrap.appendChild(select);
    right.appendChild(menuWrap);

    header.appendChild(left);
    header.appendChild(center);
    header.appendChild(right);
    return header;
  }

  _formatDateTime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    if (isNaN(d)) return dt;
    return d.toLocaleString();
  }

  _computeNextSchedule() {
    const now = new Date();
    const candidates = [];
    (this._config.schedules || []).forEach(s => {
      if (!s) return;
      if (typeof s === 'string' && s.indexOf('.') > 0 && this._hass) {
        const st = this._hass.states[s];
        if (st) {
          const val = st.state;
          const d = new Date(val);
          if (!isNaN(d)) candidates.push(d);
        }
      } else {
        const d = new Date(s);
        if (!isNaN(d)) candidates.push(d);
      }
    });
    candidates.sort((a, b) => a - b);
    for (const d of candidates) {
      if (d > now) return d;
    }
    return candidates.length ? candidates[0] : null;
  }

  _renderContent() {
    const content = document.createElement('div');
    content.className = 'content';

    const lastFeedRow = document.createElement('div');
    lastFeedRow.className = 'row';
    const lfLabel = document.createElement('div');
    lfLabel.className = 'label';
    lfLabel.textContent = 'Last feed:';
    const lfValue = document.createElement('div');
    lfValue.className = 'value';
    if (this._config.last_feed_entity && this._hass) {
      const st = this._hass.states[this._config.last_feed_entity];
      if (st) lfValue.textContent = this._formatDateTime(st.state);
      else lfValue.textContent = '—';
    } else if (this._config.last_feed) {
      lfValue.textContent = this._formatDateTime(this._config.last_feed);
    } else {
      lfValue.textContent = '—';
    }
    lastFeedRow.appendChild(lfLabel);
    lastFeedRow.appendChild(lfValue);

    const nextRow = document.createElement('div');
    nextRow.className = 'row';
    const nsLabel = document.createElement('div');
    nsLabel.className = 'label';
    nsLabel.textContent = 'Next Schedule:';
    const nsValue = document.createElement('div');
    nsValue.className = 'value';
    const next = this._computeNextSchedule();
    nsValue.textContent = next ? this._formatDateTime(next) : '—';
    nextRow.appendChild(nsLabel);
    nextRow.appendChild(nsValue);

    content.appendChild(lastFeedRow);
    content.appendChild(nextRow);

    const menuContent = document.createElement('div');
    menuContent.className = 'menu-content';
    const sel = this._selectedMenu;
    const menu = (this._config.menu || []).find(m => m.name === sel) || (this._config.menu && this._config.menu[0]);
    menuContent.textContent = menu ? menu.content : '';

    content.appendChild(menuContent);
    return content;
  }

  render() {
    if (!this._shadow) return;
    const style = `
      :host{display:block;box-sizing:border-box;padding:8px;max-width:420px;margin:8px auto;font-family:inherit}
      .card{border:1px solid #ddd;border-radius:6px;overflow:hidden;background:#fff}
      .header{display:flex;padding:12px;align-items:center;gap:12px}
      .left{flex:1}
      .center{width:120px;text-align:center}
      .right{width:120px;text-align:right}
      .pet-img{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #eee}
      .status-row{display:flex;flex-direction:column;gap:6px}
      .status-item{display:flex;align-items:center;gap:6px}
      .dot{width:14px;height:14px;border-radius:50%;background:#888}
      .dot.empty{background:transparent;border:2px dashed #ccc}
      .status-title{font-size:12px;color:#666;margin-bottom:6px}
      .menu-wrap{display:flex;justify-content:flex-end}
      .menu-select{padding:6px}
      .content{padding:12px;border-top:1px solid #eee}
      .row{display:flex;gap:8px;padding:6px 0}
      .label{width:120px;color:#444;font-weight:500}
      .value{flex:1;color:#222}
      .menu-content{margin-top:12px;padding:8px;background:#fafafa;border-radius:4px;min-height:60px}
      @media (max-width:420px){:host{padding:6px}.center{width:86px}.right{width:86px}}
    `;

    this._shadow.innerHTML = '';
    const st = document.createElement('style');
    st.textContent = style;
    this._shadow.appendChild(st);

    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.appendChild(this._renderHeader());
    wrap.appendChild(this._renderContent());

    this._shadow.appendChild(wrap);
  }
}

customElements.define('petfeeder-card', PetfeederCard);

// Minimal editor registration for Lovelace visual editor to find
class PetfeederCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._shadow = this.attachShadow({ mode: 'open' });
    this._selectedMenuIdx = 0;
    this._expandedSections = {}; // Track which sections are expanded
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  get _value() {
    return this._config;
  }

  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
  }

  _isDarkMode() {
    // Detect if Home Assistant is in dark mode
    return document.documentElement.style.colorScheme === 'dark' || 
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  _render() {
    this._shadow.innerHTML = '';
    const isDark = this._isDarkMode();
    const bgColor = isDark ? '#1a1a1a' : '#f5f5f5';
    const cardBg = isDark ? '#2a2a2a' : '#fff';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const borderColor = isDark ? '#444' : '#ddd';
    const accentColor = '#2979f0';
    const dangerColor = '#f44336';

    const style = document.createElement('style');
    style.textContent = `
      :host{display:block;padding:10px;font-family:inherit;background:${bgColor}}
      .section{background:${cardBg};border-radius:6px;margin-bottom:12px;border:1px solid ${borderColor};overflow:hidden}
      .section-header{padding:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:${cardBg};border-bottom:1px solid ${borderColor};transition:all 0.2s}
      .section-header:hover{background:${isDark ? '#333' : '#f9f9f9'}}
      .section-title{font-size:14px;font-weight:700;color:${textColor};display:flex;align-items:center;gap:8px}
      .section-title-icon{display:inline-block;transition:transform 0.2s}
      .section-content{padding:12px;display:none;max-height:0;overflow:hidden;transition:all 0.3s}
      .section.expanded .section-content{display:block;max-height:2000px}
      .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
      .row-full{display:block;margin-bottom:10px}
      .label{font-weight:600;min-width:140px;color:${textColor}}
      .label-small{font-weight:600;font-size:12px;color:${textColor}}
      .input,select,textarea{padding:6px;border:1px solid ${borderColor};border-radius:4px;font-family:inherit;background:${isDark ? '#3a3a3a' : '#fff'};color:${textColor};transition:border 0.2s}
      .input:focus,select:focus,textarea:focus{outline:none;border-color:${accentColor}}
      .input{flex:1;min-width:150px}
      .checkbox{width:18px;height:18px;cursor:pointer;accent-color:${accentColor}}
      .btn{padding:6px 12px;border:1px solid ${accentColor};border-radius:4px;background:${accentColor};color:#fff;cursor:pointer;font-weight:600;transition:all 0.2s}
      .btn:hover{background:${isDark ? '#1e5db8' : '#1565c0'};box-shadow:0 2px 4px rgba(41,121,240,0.3)}
      .btn-danger{border-color:${dangerColor};background:${dangerColor}}
      .btn-danger:hover{background:${isDark ? '#d32f2f' : '#c62828'};box-shadow:0 2px 4px rgba(244,67,54,0.3)}
      .btn-sm{padding:4px 8px;font-size:12px}
      .status-item{border:1px solid ${borderColor};padding:10px;border-radius:4px;background:${isDark ? '#3a3a3a' : '#fafafa'};margin-bottom:8px}
      .status-header{display:flex;gap:8px;align-items:center;margin-bottom:8px}
      .status-number{font-weight:600;color:${textColor}}
      .icon-preview{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;background:${isDark ? '#2a2a2a' : '#f0f0f0'};flex-shrink:0}
      .menu-tabs{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;border-bottom:2px solid ${borderColor};padding-bottom:6px;overflow-x:auto}
      .menu-tab{padding:6px 12px;border:1px solid ${borderColor};border-radius:4px 4px 0 0;background:${isDark ? '#3a3a3a' : '#fafafa'};cursor:pointer;font-weight:600;color:${textColor};transition:all 0.2s}
      .menu-tab:hover{background:${isDark ? '#444' : '#f0f0f0'}}
      .menu-tab.active{background:${accentColor};color:#fff;border-color:${accentColor}}
      .menu-content-area{border:1px solid ${borderColor};border-radius:4px;padding:10px;background:${isDark ? '#3a3a3a' : '#f9f9f9'}}
      .error{color:${dangerColor};font-size:12px;margin-top:4px}
      .hidden{display:none}
    `;
    this._shadow.appendChild(style);

    const container = document.createElement('div');

    // === MODE SECTION ===
    const modeSection = this._makeCollapsibleSection('Mode', false);
    const modeRow = document.createElement('div');
    modeRow.className = 'row';
    const modeLabel = document.createElement('div');
    modeLabel.className = 'label';
    modeLabel.textContent = 'Display Mode:';
    const modeSelect = document.createElement('select');
    modeSelect.className = 'input';
    ['Normal', 'Compact'].forEach(m => {
      const opt = document.createElement('option');
      opt.value = m === 'Normal' ? 'false' : 'true';
      opt.textContent = m;
      modeSelect.appendChild(opt);
    });
    modeSelect.value = this._config.compact ? 'true' : 'false';
    modeSelect.addEventListener('change', e => {
      this._config.compact = e.target.value === 'true';
      this._dispatch();
    });
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(modeSelect);
    modeSection.content.appendChild(modeRow);
    container.appendChild(modeSection.element);

    // === HEADER SECTION ===
    const headerSection = this._makeCollapsibleSection('Header', false);

    // Pet Image
    headerSection.content.appendChild(this._makeInput('image', 'Pet Image Path', this._config.image || ''));

    // Status Icons
    const statusTitle = document.createElement('div');
    statusTitle.style.fontWeight = '600';
    statusTitle.style.marginTop = '10px';
    statusTitle.style.marginBottom = '8px';
    statusTitle.style.color = textColor;
    statusTitle.textContent = 'Status Icons (1-4)';
    headerSection.content.appendChild(statusTitle);

    for (let i = 0; i < 4; i++) {
      const s = (this._config.status && this._config.status[i]) || {};
      const item = document.createElement('div');
      item.className = 'status-item';
      const header = document.createElement('div');
      header.className = 'status-header';
      const numLabel = document.createElement('div');
      numLabel.className = 'status-number';
      numLabel.textContent = `Icon ${i + 1}`;
      header.appendChild(numLabel);
      
      // Icon preview
      const iconPreview = document.createElement('div');
      iconPreview.className = 'icon-preview';
      if (s.icon) {
        const iconName = s.icon.split(':').pop().substring(0, 2).toUpperCase();
        iconPreview.textContent = iconName;
        iconPreview.style.fontWeight = '600';
        iconPreview.style.color = '#2979f0';
      } else {
        iconPreview.style.color = '#999';
        iconPreview.textContent = '○';
      }
      header.appendChild(iconPreview);
      item.appendChild(header);

      // Name with checkbox
      const nameRow = document.createElement('div');
      nameRow.className = 'row';
      const nameCB = document.createElement('input');
      nameCB.type = 'checkbox';
      nameCB.className = 'checkbox';
      nameCB.checked = !!s.name;
      const nameLabel = document.createElement('div');
      nameLabel.className = 'label-small';
      nameLabel.textContent = 'Name:';
      const nameInput = document.createElement('input');
      nameInput.className = 'input';
      nameInput.value = s.name || '';
      nameInput.placeholder = 'e.g., Feeding';
      nameInput.disabled = !nameCB.checked;
      nameInput.addEventListener('change', e => {
        this._setByPath(`status.${i}.name`, e.target.value || null);
        this._dispatch();
      });
      nameCB.addEventListener('change', e => {
        if (e.target.checked) {
          this._setByPath(`status.${i}.name`, nameInput.value || `Status ${i + 1}`);
        } else {
          this._setByPath(`status.${i}.name`, null);
        }
        this._dispatch();
        this._render();
      });
      nameRow.appendChild(nameCB);
      nameRow.appendChild(nameLabel);
      nameRow.appendChild(nameInput);
      item.appendChild(nameRow);

      // Entity
      item.appendChild(this._makeInput(`status.${i}.entity`, 'Entity ID:', s.entity || ''));

      // Icon with checkbox
      const iconRow = document.createElement('div');
      iconRow.className = 'row';
      const iconCB = document.createElement('input');
      iconCB.type = 'checkbox';
      iconCB.className = 'checkbox';
      iconCB.checked = !!s.icon;
      const iconLabel = document.createElement('div');
      iconLabel.className = 'label-small';
      iconLabel.textContent = 'MDI Icon:';
      const iconInput = document.createElement('input');
      iconInput.className = 'input';
      iconInput.value = s.icon || '';
      iconInput.placeholder = 'e.g., mdi:food-apple';
      iconInput.disabled = !iconCB.checked;
      iconInput.addEventListener('change', e => {
        this._setByPath(`status.${i}.icon`, e.target.value || null);
        this._dispatch();
      });
      iconCB.addEventListener('change', e => {
        if (e.target.checked) {
          this._setByPath(`status.${i}.icon`, iconInput.value || 'mdi:circle');
        } else {
          this._setByPath(`status.${i}.icon`, null);
        }
        this._dispatch();
        this._render();
      });
      iconRow.appendChild(iconCB);
      iconRow.appendChild(iconLabel);
      iconRow.appendChild(iconInput);
      item.appendChild(iconRow);

      // Color map (condition)
      item.appendChild(this._makeInput(`status.${i}.color_map`, 'Color Map (JSON):', s.color_map || '', `{"on":"#4caf50","off":"#f44336"}`));

      headerSection.content.appendChild(item);
    }

    container.appendChild(headerSection.element);

    // === MENU SECTION ===
    const menuSection = this._makeCollapsibleSection('Menu', false);

    // Menu management
    const menuBtnRow = document.createElement('div');
    menuBtnRow.className = 'row';
    const addMenuBtn = document.createElement('button');
    addMenuBtn.className = 'btn btn-sm';
    addMenuBtn.textContent = '+ Add Menu Option';
    addMenuBtn.addEventListener('click', () => {
      this._config.menu = this._config.menu || [];
      this._config.menu.push({ name: `Option ${this._config.menu.length + 1}`, content: '' });
      this._selectedMenuIdx = this._config.menu.length - 1;
      this._render();
      this._dispatch();
    });
    menuBtnRow.appendChild(addMenuBtn);
    menuSection.content.appendChild(menuBtnRow);

    // Menu tabs and content
    if (this._config.menu && this._config.menu.length > 0) {
      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'menu-tabs';
      this._config.menu.forEach((m, idx) => {
        const tab = document.createElement('div');
        tab.className = 'menu-tab' + (idx === this._selectedMenuIdx ? ' active' : '');
        tab.textContent = m.name || `Option ${idx + 1}`;
        tab.addEventListener('click', () => {
          this._selectedMenuIdx = idx;
          this._render();
        });
        tabsContainer.appendChild(tab);
      });
      menuSection.content.appendChild(tabsContainer);

      // Content area for selected menu
      const contentArea = document.createElement('div');
      contentArea.className = 'menu-content-area';
      const m = this._config.menu[this._selectedMenuIdx];
      if (m) {
        const nameInp = document.createElement('input');
        nameInp.className = 'input';
        nameInp.placeholder = 'Menu option name';
        nameInp.value = m.name || '';
        nameInp.addEventListener('change', e => {
          this._config.menu[this._selectedMenuIdx].name = e.target.value;
          this._render();
          this._dispatch();
        });
        const nameLabel = document.createElement('div');
        nameLabel.className = 'label';
        nameLabel.textContent = 'Option Name:';
        contentArea.appendChild(nameLabel);
        contentArea.appendChild(nameInp);

        const contentLabel = document.createElement('div');
        contentLabel.className = 'label';
        contentLabel.style.marginTop = '10px';
        contentLabel.textContent = 'Content:';
        contentArea.appendChild(contentLabel);
        const contentTA = document.createElement('textarea');
        contentTA.className = 'input';
        contentTA.rows = 5;
        contentTA.placeholder = 'Enter HTML or text content for this menu option';
        contentTA.value = m.content || '';
        contentTA.addEventListener('change', e => {
          this._config.menu[this._selectedMenuIdx].content = e.target.value;
          this._dispatch();
        });
        contentArea.appendChild(contentTA);

        const removeRow = document.createElement('div');
        removeRow.className = 'row';
        removeRow.style.marginTop = '10px';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger btn-sm';
        removeBtn.textContent = '✕ Remove This Option';
        removeBtn.addEventListener('click', () => {
          this._config.menu.splice(this._selectedMenuIdx, 1);
          this._selectedMenuIdx = Math.max(0, this._selectedMenuIdx - 1);
          this._render();
          this._dispatch();
        });
        removeRow.appendChild(removeBtn);
        contentArea.appendChild(removeRow);
      }
      menuSection.content.appendChild(contentArea);
    }

    container.appendChild(menuSection.element);

    this._shadow.appendChild(container);
  }

  _makeCollapsibleSection(title, expandedByDefault = false) {
    const isExpanded = this._expandedSections[title] !== undefined ? this._expandedSections[title] : expandedByDefault;
    
    const element = document.createElement('div');
    element.className = 'section' + (isExpanded ? ' expanded' : '');
    
    const header = document.createElement('div');
    header.className = 'section-header';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'section-title';
    const icon = document.createElement('span');
    icon.className = 'section-title-icon';
    icon.textContent = isExpanded ? '▼' : '▶';
    titleDiv.appendChild(icon);
    const text = document.createElement('span');
    text.textContent = title;
    titleDiv.appendChild(text);
    
    header.appendChild(titleDiv);
    element.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'section-content';
    element.appendChild(content);
    
    header.addEventListener('click', () => {
      const shouldExpand = !element.classList.contains('expanded');
      this._expandedSections[title] = shouldExpand;
      element.classList.toggle('expanded', shouldExpand);
      icon.textContent = shouldExpand ? '▼' : '▶';
    });
    
    return { element, content };
  }

  _makeInput(path, label, value, placeholder) {
    const row = document.createElement('div');
    row.className = 'row-full';
    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = label;
    const input = document.createElement('input');
    input.className = 'input';
    input.value = value || '';
    input.placeholder = placeholder || '';
    const err = document.createElement('div');
    err.className = 'error';
    err.style.display = 'none';

    const runValidation = (val) => {
      if (path.endsWith('color_map')) {
        if (!val || val.trim() === '') {
          err.style.display = 'none';
          return true;
        }
        try {
          const p = typeof val === 'string' ? JSON.parse(val) : val;
          if (p && typeof p === 'object') {
            err.style.display = 'none';
            return true;
          }
        } catch (e) {
          err.textContent = 'Invalid JSON';
          err.style.display = 'block';
          return false;
        }
      }
      err.style.display = 'none';
      return true;
    };

    input.addEventListener('change', (e) => {
      const ok = runValidation(e.target.value);
      if (ok) this._setByPath(path, e.target.value);
      this._dispatch();
    });

    runValidation(input.value);
    row.appendChild(lab);
    row.appendChild(input);
    row.appendChild(err);
    return row;
  }

  _setByPath(path, value) {
    const parts = path.split('.');
    let cur = this._config;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        if (p.match(/\d+/) && Array.isArray(cur)) cur[parseInt(p, 10)] = value;
        else cur[p] = value;
      } else {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
    }
  }
}

customElements.define('petfeeder-card-editor', PetfeederCardEditor);
