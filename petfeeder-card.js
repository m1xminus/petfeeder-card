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
      const item = document.createElement('div');
      item.className = 'status-item';
      if (!s) {
        item.innerHTML = '<div class="dot empty"></div>';
      } else {
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
        item.innerHTML = `<div class="dot" style="background:${color}"></div>`;
        if (s.label) {
          const lab = document.createElement('div');
          lab.className = 'status-label';
          lab.textContent = s.label;
          item.appendChild(lab);
        }
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

  _render() {
    this._shadow.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = `:host{display:block;padding:6px;font-family:inherit}.row{margin:6px 0}.label{font-weight:600;margin-bottom:4px}.input,textarea,select{width:100%;padding:6px;border:1px solid #ccc;border-radius:4px}`;
    this._shadow.appendChild(style);

    const container = document.createElement('div');

    // Title
    container.appendChild(this._makeInput('title','Title',this._config.title||'Petfeeder'));
    container.appendChild(this._makeInput('image','Image path',this._config.image||''));
    container.appendChild(this._makeCheckbox('compact','Compact mode',!!this._config.compact));

    // Status slots
    for (let i=0;i<4;i++){
      container.appendChild(this._makeInput(`status.${i}.entity`,`Status ${i+1} entity`,(this._config.status && this._config.status[i] && this._config.status[i].entity)||''));
      container.appendChild(this._makeInput(`status.${i}.icon`,`Status ${i+1} icon`,(this._config.status && this._config.status[i] && this._config.status[i].icon)||''));
      container.appendChild(this._makeInput(`status.${i}.color_map`,`Status ${i+1} color_map (JSON)`,(this._config.status && this._config.status[i] && this._config.status[i].color_map)||''));
    }

    // Menu - simple textarea as JSON for now
    const menuRow = document.createElement('div');
    menuRow.className='row';
    const lab = document.createElement('div'); lab.className='label'; lab.textContent='Menu (JSON array of {name,content})';
    const ta = document.createElement('textarea'); ta.className='input'; ta.rows=4;
    ta.value = JSON.stringify(this._config.menu||[], null, 2);
    ta.addEventListener('change', e=>{
      try{this._config.menu = JSON.parse(e.target.value);}catch(err){}
      this._dispatch();
    });
    menuRow.appendChild(lab); menuRow.appendChild(ta);
    container.appendChild(menuRow);

    container.appendChild(this._makeInput('last_feed_entity','Last feed entity',this._config.last_feed_entity||''));

    // Schedules - JSON list
    const schedRow = document.createElement('div');
    schedRow.className='row';
    const lab2 = document.createElement('div'); lab2.className='label'; lab2.textContent='Schedules (JSON array of ISO times or entity ids)';
    const ta2 = document.createElement('textarea'); ta2.className='input'; ta2.rows=3;
    ta2.value = JSON.stringify(this._config.schedules||[], null, 2);
    ta2.addEventListener('change', e=>{
      try{this._config.schedules = JSON.parse(e.target.value);}catch(err){}
      this._dispatch();
    });
    schedRow.appendChild(lab2); schedRow.appendChild(ta2);
    container.appendChild(schedRow);

    this._shadow.appendChild(container);
  }

  _makeInput(path,label, value){
    const row = document.createElement('div'); row.className='row';
    const lab = document.createElement('div'); lab.className='label'; lab.textContent=label;
    const input = document.createElement('input'); input.className='input'; input.value = value||'';
    const err = document.createElement('div'); err.className='err'; err.style.display='none';
    const runValidation = (val)=>{
      if (path.endsWith('color_map')){
        if (!val || val.trim()==='') { err.style.display='none'; return true; }
        try{ const p = typeof val==='string'?JSON.parse(val):val; if (p && typeof p==='object') { err.style.display='none'; return true; } }
        catch(e){ err.textContent = 'Invalid JSON for color_map'; err.style.display='block'; return false; }
        err.style.display='none'; return true;
      }
      err.style.display='none'; return true;
    };
    input.addEventListener('change', e=>{
      const ok = runValidation(e.target.value);
      if (ok) this._setByPath(path, e.target.value);
      this._dispatch();
    });
    runValidation(input.value);
    row.appendChild(lab); row.appendChild(input);
    row.appendChild(err);
    return row;
  }

  _makeCheckbox(path,label, checked){
    const row = document.createElement('div'); row.className='row';
    const lab = document.createElement('div'); lab.className='label'; lab.textContent=label;
    const input = document.createElement('input'); input.type='checkbox'; input.checked = checked;
    input.addEventListener('change', e=>{
      this._setByPath(path, e.target.checked);
      this._dispatch();
    });
    row.appendChild(lab); row.appendChild(input);
    return row;
  }

  _setByPath(path, value){
    const parts = path.split('.');
    let cur = this._config;
    for (let i=0;i<parts.length;i++){
      const p = parts[i];
      if (i === parts.length-1) {
        if (p.match(/\d+/) && Array.isArray(cur)) cur[parseInt(p,10)] = value;
        else cur[p] = value;
      } else {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
    }
  }
}

customElements.define('petfeeder-card-editor', PetfeederCardEditor);
