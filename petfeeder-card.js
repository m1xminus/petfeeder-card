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
      // Only render if there's name OR icon configured
      if (!s || (!s.icon && !s.name)) {
        return;
      }
      const item = document.createElement('div');
      item.className = 'status-item';
      
      let color = s.color || '#888';
      if (s.entity && this._hass) {
        const st = this._hass.states[s.entity];
        if (st) {
          // Check color_map array for matching state
          if (s.color_map && Array.isArray(s.color_map)) {
            const mapping = s.color_map.find(m => m.state === st.state);
            if (mapping) {
              color = mapping.color;
            }
          } else if (typeof s.color_map === 'string') {
            // Fallback for legacy JSON format
            try {
              const map = JSON.parse(s.color_map);
              if (map[st.state]) color = map[st.state];
            } catch (e) {}
          } else {
            // Default color logic if no mapping
            if (st.state === 'on' || st.state === 'home' || st.state === 'connected') {
              color = '#4caf50';
            } else if (st.state === 'off' || st.state === 'unavailable' || st.state === 'disconnected') {
              color = '#f44336';
            }
          }
        }
      }

      // Only display circle icon if icon is configured
      if (s.icon) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.background = color;
        dot.style.display = 'flex';
        dot.style.alignItems = 'center';
        dot.style.justifyContent = 'center';
        
        // Use ha-icon component which supports MDI
        const haIcon = document.createElement('ha-icon');
        haIcon.setAttribute('icon', s.icon);
        haIcon.style.color = '#fff';
        haIcon.style.fontSize = '16px';
        haIcon.style.width = '16px';
        haIcon.style.height = '16px';
        dot.appendChild(haIcon);
        item.appendChild(dot);
      }

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
    statusTitle.textContent = this._config.status_label || 'status:';
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
    
    const headerColor = this._config.header_color || '#fff';
    const headerOpacity = (this._config.header_opacity !== undefined ? this._config.header_opacity : 1);
    const contentColor = this._config.content_color || '#fafafa';
    const contentOpacity = (this._config.content_opacity !== undefined ? this._config.content_opacity : 1);
    
    const headerBg = this._hexToRgba(headerColor, headerOpacity);
    const contentBg = this._hexToRgba(contentColor, contentOpacity);
    
    const style = `
      :host{display:block;box-sizing:border-box;padding:8px;max-width:420px;margin:8px auto;font-family:inherit}
      .card{border:1px solid #ddd;border-radius:6px;overflow:hidden;background:#fff}
      .header{display:flex;padding:12px;align-items:center;gap:12px;background:${headerBg}}
      .left{flex:1}
      .center{width:120px;text-align:center}
      .right{width:120px;text-align:right}
      .pet-img{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #eee}
      .status-row{display:flex;flex-direction:column;gap:6px}
      .status-item{display:flex;align-items:center;gap:6px}
      .dot{width:24px;height:24px;border-radius:50%;flex-shrink:0}
      .status-title{font-size:12px;color:#666;margin-bottom:6px}
      .menu-wrap{display:flex;justify-content:flex-end}
      .menu-select{padding:6px}
      .content{padding:12px;border-top:1px solid #eee;background:${contentBg}}
      .row{display:flex;gap:8px;padding:6px 0}
      .label{width:120px;color:#444;font-weight:500}
      .value{flex:1;color:#222}
      .menu-content{margin-top:12px;padding:8px;background:rgba(0,0,0,0.03);border-radius:4px;min-height:60px}
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
