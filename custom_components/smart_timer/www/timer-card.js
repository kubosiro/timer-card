/**
 * Smart Timer Card
 * A premium timer card for Home Assistant
 */

console.log("%c ⏱️ SMART TIMER CARD: v2.4.5 LOADED ", "background: #2196f3; color: white; font-weight: bold; padding: 4px; border-radius: 4px;");

window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === 'smart-timer-card')) {
  window.customCards.push({
    type: 'smart-timer-card',
    name: 'Smart Timer Card (Pro)',
    description: 'Hẹn giờ thông minh cho mọi thiết bị, giao diện hiện đại.',
    preview: true,
    documentationURL: 'https://github.com/kubosiro/timer-card',
  });
}

class SmartTimerCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity");
    }
    this._config = config;
  }

  static getStubConfig() {
    return {
      entity: "",
      name: "Smart Timer",
      icon: "mdi:timer-outline"
    };
  }

  static getConfigElement() {
    return document.createElement("smart-timer-card-editor");
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            --timer-primary: var(--primary-color, #2196f3);
            --timer-bg: var(--ha-card-background, #1c1c1e);
            --timer-text: var(--primary-text-color, #ffffff);
            --timer-sec: var(--secondary-text-color, #a1a1a1);
          }
          ha-card {
            background: var(--timer-bg);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: var(--ha-card-box-shadow, 0 8px 16px rgba(0,0,0,0.2));
            font-family: var(--primary-font-family, 'Outfit', 'Roboto', sans-serif);
            position: relative;
            border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
          }
          .glass-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; height: 60px;
            background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
            pointer-events: none;
          }
          .main-info {
            display: flex;
            align-items: center;
            padding: 16px 20px;
            cursor: pointer;
            transition: background 0.3s;
            position: relative;
          }
          .main-info:hover {
            background: rgba(255,255,255,0.03);
          }
          .icon-container {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 16px;
            background: rgba(158,158,158,0.1);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
          }
          .icon-container.active {
            background: linear-gradient(135deg, var(--timer-primary), rgba(33,150,243,0.6));
            color: white;
            box-shadow: 0 4px 12px rgba(33,150,243,0.3);
            transform: scale(1.05);
          }
          .icon-container ha-icon {
            --mdc-icon-size: 26px;
          }
          .text-container {
            flex: 1;
          }
          .primary-text {
            font-size: 15px;
            font-weight: 800;
            color: var(--timer-text);
            letter-spacing: 0.3px;
          }
          .secondary-text {
            font-size: 12px;
            color: var(--timer-sec);
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .controls {
            display: flex;
            justify-content: space-between;
            padding: 0 12px 12px;
            gap: 6px;
          }
          .btn {
            flex: 1;
            height: 48px;
            border-radius: 12px;
            background: rgba(255,255,255,0.04);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255,255,255,0.05);
          }
          .btn:hover {
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.1);
            transform: translateY(-1px);
          }
          .btn:active {
            transform: scale(0.94);
            background: rgba(255,255,255,0.12);
          }
          .btn ha-icon {
            --mdc-icon-size: 20px;
          }
          .btn-val {
            font-size: 10px;
            font-weight: 900;
            margin-top: 2px;
            opacity: 0.8;
          }
          
          .btn.minus-30 { color: #ff5252; }
          .btn.plus-30 { color: #448aff; }
          
          .btn.center { 
            min-width: 56px;
            border-radius: 50%;
            background: rgba(158,158,158,0.08);
            border: 1px solid rgba(158,158,158,0.15);
            margin: 0 4px;
          }
          .btn.center.active {
            background: linear-gradient(135deg, rgba(33,150,243,0.15), rgba(100,181,246,0.05));
            border: 2px solid rgba(33,150,243,0.4);
            color: var(--timer-primary);
            box-shadow: 0 0 15px rgba(33,150,243,0.2);
          }
          
          .presets {
            display: flex;
            padding: 0 12px 16px;
            gap: 8px;
          }
          .preset {
            flex: 1;
            height: 38px;
            border-radius: 10px;
            background: rgba(255,255,255,0.04);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid rgba(255,255,255,0.05);
            color: var(--timer-sec);
          }
          .preset:hover {
            background: rgba(255,255,255,0.08);
            color: var(--timer-text);
          }
          .preset.active {
            background: linear-gradient(135deg, rgba(33,150,243,0.2), rgba(33,150,243,0.1));
            border: 2px solid var(--timer-primary);
            color: var(--timer-text);
            box-shadow: 0 2px 8px rgba(33,150,243,0.15);
          }
          .preset:active {
            transform: scale(0.96);
            background: rgba(255,255,255,0.12);
          }
          .icon-container:active {
            transform: scale(0.92);
          }
    
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spinning {
            animation: spin 4s linear infinite;
          }
          
          .pulse-active {
            animation: pulse-shadow 2s infinite;
          }
          @keyframes pulse-shadow {
            0% { box-shadow: 0 0 0 0 rgba(33,150,243,0.4); }
            70% { box-shadow: 0 0 0 10px rgba(33,150,243,0); }
            100% { box-shadow: 0 0 0 0 rgba(33,150,243,0); }
          }
        </style>
        <ha-card>
          <div class="glass-overlay"></div>
          <div class="card-content"></div>
        </ha-card>
      `;
      this.content = this.shadowRoot.querySelector('.card-content');
    }
    this._update();
  }

  connectedCallback() {
    // Tự động cập nhật mỗi 10 giây để đếm ngược chạy mượt
    this._timer = setInterval(() => this._update(), 10000);
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define an entity');
    }
    this.config = config;
  }

  _update() {
    if (!this._hass || !this.config) return;

    const entityId = this.config.entity;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) {
      this.content.innerHTML = `<div style="padding: 16px; color: red;">Entity not found: ${entityId}</div>`;
      return;
    }

    const masterSensor = this._hass.states['sensor.smart_timer_master'];
    const timers = (masterSensor && masterSensor.attributes.timers) || {};
    const timerInfo = timers[entityId];

    const isOn = stateObj.state === 'on';
    const name = this.config.name || stateObj.attributes.friendly_name || entityId;
    const icon = this.config.icon || stateObj.attributes.icon || 'mdi:power';

    let secondaryText = isOn ? '✅ Đang bật' : '⛔ Đang tắt';
    let remainingMinutes = 0;

    if (isOn && timerInfo) {
      const endTime = new Date(timerInfo.end_time);
      const now = new Date();
      const diff = endTime - now;
      remainingMinutes = Math.max(0, diff / 60000);
      
      if (remainingMinutes > 0) {
        const h = Math.floor(remainingMinutes / 60);
        const m = Math.ceil(remainingMinutes % 60);
        const timeStr = h > 0 ? `${h}h ${m}p` : `${m}p`;
        const offTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        secondaryText = `⏱️ Còn ${timeStr} · Tắt lúc ${offTime}`;
      } else {
        secondaryText = '⏱️ Sắp tắt...';
      }
    } else if (isOn) {
      secondaryText = '✅ Đang bật · Không hẹn giờ';
    }

    this.content.innerHTML = `
      <div class="main-info" id="toggle">
        <div class="icon-container ${isOn ? 'active' : ''} ${timerInfo ? 'pulse-active' : ''}">
          <ha-icon icon="${icon}" class="${isOn && (icon.includes('fan') || icon.includes('ventilator')) ? 'spinning' : ''}"></ha-icon>
        </div>
        <div class="text-container">
          <div class="primary-text">${name}</div>
          <div class="secondary-text">${secondaryText}</div>
        </div>
      </div>
      
      <div class="controls">
        <div class="btn minus-30" data-val="-30">
          <ha-icon icon="mdi:rewind-30"></ha-icon>
          <span class="btn-val">-30</span>
        </div>
        <div class="btn minus-5" data-val="-5">
          <ha-icon icon="mdi:minus-circle-outline"></ha-icon>
          <span class="btn-val">-5</span>
        </div>
        <div class="btn minus-1" data-val="-1">
          <ha-icon icon="mdi:minus"></ha-icon>
          <span class="btn-val">-1</span>
        </div>
        <div class="btn center ${timerInfo ? 'active' : ''}" id="clear">
          <ha-icon icon="mdi:timer-off-outline"></ha-icon>
        </div>
        <div class="btn plus-1" data-val="1">
          <ha-icon icon="mdi:plus"></ha-icon>
          <span class="btn-val">+1</span>
        </div>
        <div class="btn plus-5" data-val="5">
          <ha-icon icon="mdi:plus-circle-outline"></ha-icon>
          <span class="btn-val">+5</span>
        </div>
        <div class="btn plus-30" data-val="30">
          <ha-icon icon="mdi:fast-forward-30"></ha-icon>
          <span class="btn-val">+30</span>
        </div>
      </div>

      <div class="presets">
        <div class="preset ${this._isClose(remainingMinutes, 60) ? 'active' : ''}" data-preset="60">1h</div>
        <div class="preset ${this._isClose(remainingMinutes, 120) ? 'active' : ''}" data-preset="120">2h</div>
        <div class="preset ${this._isClose(remainingMinutes, 240) ? 'active' : ''}" data-preset="240">4h</div>
        <div class="preset ${this._isClose(remainingMinutes, 360) ? 'active' : ''}" data-preset="360">6h</div>
        <div class="preset ${this._isClose(remainingMinutes, 480) ? 'active' : ''}" data-preset="480">8h</div>
      </div>
    `;

    this._bindEvents(entityId, remainingMinutes);
  }

  _isClose(a, b) {
    return Math.abs(a - b) < 1;
  }

  _bindEvents(entityId, currentRemaining) {
    const root = this.shadowRoot;
    
    // Nút Icon/Text chính
    const toggleEl = root.querySelector('#toggle');
    if (toggleEl) {
      toggleEl.onclick = () => {
        this._hass.callService('homeassistant', 'toggle', { entity_id: entityId });
      };
    }

    // Nút tròn ở giữa: Clear Countdown
    const clearEl = root.querySelector('#clear');
    if (clearEl) {
      clearEl.onclick = (e) => {
        e.stopPropagation();
        console.log("Smart Timer: Clear clicked for " + entityId);
        this._callTimerSet(entityId, 0);
      };
    }

    // Các nút +/-
    root.querySelectorAll('.btn[data-val]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const val = parseInt(btn.dataset.val);
        const newDuration = Math.max(0, currentRemaining + val);
        this._callTimerSet(entityId, newDuration);
      };
    });

    // Các nút Preset
    root.querySelectorAll('.preset').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const val = parseInt(btn.dataset.preset);
        this._callTimerSet(entityId, val);
      };
    });
  }

  _callTimerSet(entity_id, duration) {
    this._hass.callService('smart_timer', 'set', {
      entity_id: entity_id,
      duration: duration
    });
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('smart-timer-card', SmartTimerCard);

class SmartTimerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        .card-config { padding: 10px; font-family: sans-serif; }
        .option { margin-bottom: 20px; }
        label { font-weight: bold; display: block; margin-bottom: 10px; font-size: 14px; color: var(--primary-text-color, #fff); }
        .help { font-size: 12px; color: var(--secondary-text-color, #aaa); margin-top: 5px; }
        
        /* Input chuẩn, tương phản cao để chắc chắn nhìn thấy */
        input#name-input {
          width: 100%;
          padding: 12px;
          background: #333;
          color: white;
          border: 1px solid #666;
          border-radius: 4px;
          box-sizing: border-box;
          font-size: 14px;
        }
        input#name-input:focus {
          border-color: #03a9f4;
          outline: none;
        }
        ha-entity-picker, ha-icon-picker { width: 100%; display: block; }
      </style>
      <div class="card-config">
        <div class="option">
          <label>1. Chọn thực thể điều khiển</label>
          <ha-entity-picker id="entity-picker" allow-custom-entity></ha-entity-picker>
          <div class="help">Chọn thiết bị anh muốn hẹn giờ (Switch/Light/Fan).</div>
        </div>
        
        <div class="option">
          <label>2. Tên hiển thị trên Card</label>
          <input type="text" id="name-input" placeholder="Ví dụ: Đèn phòng khách">
          <div class="help">Đặt tên để dễ phân biệt trên giao diện.</div>
        </div>

        <div class="option">
          <label>3. Biểu tượng (Icon)</label>
          <ha-icon-picker id="icon-picker"></ha-icon-picker>
        </div>
      </div>
    `;

    const entityPicker = this.shadowRoot.querySelector('#entity-picker');
    if (entityPicker) {
      entityPicker.hass = this._hass;
      entityPicker.value = this._config.entity;
      entityPicker.includeDomains = ['switch', 'light', 'fan', 'input_boolean'];
      entityPicker.addEventListener('value-changed', (ev) => this._fieldChanged(ev, 'entity'));
    }

    const nameInput = this.shadowRoot.querySelector('#name-input');
    if (nameInput) {
      nameInput.value = this._config.name || '';
      nameInput.addEventListener('input', (ev) => this._fieldChanged(ev, 'name'));
    }

    const iconPicker = this.shadowRoot.querySelector('#icon-picker');
    if (iconPicker) {
      iconPicker.hass = this._hass;
      iconPicker.value = this._config.icon;
      iconPicker.addEventListener('value-changed', (ev) => this._fieldChanged(ev, 'icon'));
    }
  }

  _fieldChanged(ev, field) {
    if (!this._config) return;
    const value = ev.detail ? ev.detail.value : ev.target.value;
    if (this._config[field] === value) return;

    const newConfig = { ...this._config, [field]: value };
    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

customElements.define('smart-timer-card-editor', SmartTimerCardEditor);

console.log("%c ⏱️ SMART TIMER CARD LOADED ", "background: #2196f3; color: white; font-weight: bold; padding: 4px; border-radius: 4px;");
