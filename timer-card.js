/**
 * Smart Timer Card v6.0.0 — Standalone with Persistence
 * ======================================================
 * 1 file duy nhất. Không backend Python. Không config flow.
 * Copy vào www/ → thêm resource 1 lần → dùng ngay.
 *
 * PERSISTENCE: Dùng input_text.smart_timer_data (tạo 1 lần thủ công)
 *   - Lưu toàn bộ timer dạng JSON → bền vững qua restart HA
 *   - Mỗi card tự động đọc/ghi entry của mình
 *   - Nếu chưa tạo helper → vẫn hoạt động bình thường (RAM only)
 *
 * FEATURES:
 *   - Tất cả nút +/- hoạt động đúng
 *   - Countdown hiển thị giây: "1h 5m 30s"
 *   - Preset 1h/2h/4h/6h/8h
 *   - Bật/tắt thiết bị qua icon
 *   - Tự động tắt khi hết giờ
 *   - KHÔNG rác khi xóa card
 */
console.log("%c ⏱️ SMART TIMER v6.0.0 ", "background:#2196f3;color:white;font-weight:bold;padding:4px;border-radius:4px;");

const VERSION = '6.0.0';

// === Đăng ký card vào picker ===
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === 'smart-timer-card')) {
    window.customCards.push({
        type: 'smart-timer-card',
        name: 'Smart Timer v6',
        description: 'Hẹn giờ thông minh. Bền vững qua restart HA. Countdown giây.',
        preview: true,
        documentationURL: 'https://github.com/kubosiro/timer-card',
    });
}

// ==================== PERSISTENCE LAYER ====================
// Shared across all card instances — reads/writes input_text.smart_timer_data
// Per-card persistence: each card can specify its own input_text helper via config.helper
// If not set → RAM-only mode. Multiple cards can share one helper or use separate ones.
const CardStore = {
    _instances: {},  // helperId → { hass, timers, savePending }

    /** Get or create a store for a given helper ID */
    get(helperId, hass) {
        if (!this._instances[helperId]) {
            this._instances[helperId] = { hass, timers: null, savePending: false };
        }
        return {
            hass: this._instances[helperId].hass,

            async load() {
                const inst = CardStore._instances[helperId];
                if (inst.timers) return inst.timers;
                try {
                    const s = hass.states[helperId];
                    if (s && s.state !== 'unknown' && s.state !== 'unavailable') {
                        const raw = (s.state || '').trim();
                        if (!raw) {
                            // Empty state → auto-init with empty JSON
                            inst.timers = {};
                            await this.save();
                            return inst.timers;
                        }
                        const data = JSON.parse(raw);
                        inst.timers = data.t || {};
                        const now = Date.now();
                        for (const [eid, info] of Object.entries(inst.timers)) {
                            if (new Date(info.e).getTime() <= now) delete inst.timers[eid];
                        }
                        return inst.timers;
                    }
                } catch (e) {
                    // Corrupted JSON → auto-reset
                    console.debug("[SmartTimer] Helper data corrupted, resetting", e);
                    inst.timers = {};
                    await this.save();
                }
                inst.timers = {};
                return inst.timers;
            },

            async save() {
                const inst = CardStore._instances[helperId];
                if (inst.savePending) return;
                inst.savePending = true;
                setTimeout(async () => {
                    inst.savePending = false;
                    try {
                        await hass.callService('input_text', 'set_value', {
                            entity_id: helperId,
                            value: JSON.stringify({ t: { ...inst.timers } }),
                        });
                    } catch (e) { /* RAM fallback */ }
                }, 200);
            },

            async set(entityId, timerInfo) {
                const inst = CardStore._instances[helperId];
                if (!inst.timers) await this.load();
                if (timerInfo === null) delete inst.timers[entityId];
                else inst.timers[entityId] = timerInfo;
                await this.save();
            },

            exists() {
                const s = hass.states[helperId];
                return !!(s && s.state !== 'unknown' && s.state !== 'unavailable');
            }
        };
    }
};

// ==================== CARD CLASS ====================

class SmartTimerCard extends HTMLElement {
    static getStubConfig() {
        return { entity: "", name: "Smart Timer", icon: "mdi:timer-outline" };
    }

    static getConfigElement() {
        return document.createElement("smart-timer-card-editor");
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._endTime = null;    // timestamp (ms)
        this._store = null;      // CardStore instance for persistence
    }

    setConfig(config) {
        if (!config.entity) throw new Error("Please define an entity");
        // If helper changed → reset store so it re-initializes in set hass
        if (this.config && config.helper !== this.config.helper) {
            this._store = null;
        }
        this.config = config;
        this._entityId = config.entity;
    }

    set hass(hass) {
        this._hass = hass;
        if (!this._hass) return;

        if (!this._built) {
            this._buildDOM();
            this._built = true;
        }

        // Init/re-init persistence store if helper is configured
        if (this.config.helper) {
            if (!this._store) {
                this._store = CardStore.get(this.config.helper, hass);
                this._restoreTimer();
            }
        } else {
            this._store = null;
        }

        this._render();
    }

    connectedCallback() {
        this._ticker = setInterval(() => this._tick(), 1000);
    }

    disconnectedCallback() {
        if (this._ticker) clearInterval(this._ticker);
        if (this._timeout) clearTimeout(this._timeout);
    }

    // ==================== TIMER LOGIC ====================

    async _restoreTimer() {
        if (!this._store) return;
        const timers = await this._store.load();
        const info = timers[this._entityId];
        if (info) {
            const endTime = new Date(info.e).getTime();
            const now = Date.now();
            if (endTime > now) {
                this._endTime = endTime;
                this._scheduleOff(endTime - now);
                this._render();
            } else {
                await this._store.set(this._entityId, null);
            }
        }
    }

    _tick() {
        if (!this._entityId || !this._endTime) return;
        this._renderCountdown();
    }

    async _setTimer(durationMinutes) {
        const entityId = this._entityId;
        if (!entityId) return;

        if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }

        if (durationMinutes <= 0) {
            this._endTime = null;
            if (this._store) await this._store.set(entityId, null);
            this._render();
            return;
        }

        this._endTime = Date.now() + durationMinutes * 60000;

        this._hass.callService('homeassistant', 'turn_on', { entity_id: entityId })
            .catch(e => console.warn("[SmartTimer] turn_on:", e));

        if (this._store) await this._store.set(entityId, { e: new Date(this._endTime).toISOString() });

        this._scheduleOff(durationMinutes * 60000);
        this._render();
    }

    _scheduleOff(ms) {
        if (this._timeout) clearTimeout(this._timeout);
        this._timeout = setTimeout(async () => {
            const entityId = this._entityId;
            try {
                await this._hass.callService('homeassistant', 'turn_off', { entity_id: entityId });
            } catch (e) { console.warn("[SmartTimer] turn_off:", e); }
            this._endTime = null;
            this._timeout = null;
            if (this._store) await this._store.set(entityId, null);
            this._render();
        }, ms);
    }

    // ==================== BUILD DOM ====================

    _buildDOM() {
        const style = document.createElement('style');
        style.textContent = `
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
      .persist-badge {
        position: absolute;
        top: 8px; right: 10px;
        font-size: 9px;
        padding: 2px 8px;
        border-radius: 10px;
        background: rgba(76,175,80,0.15);
        color: #4caf50;
        font-weight: 700;
        z-index: 1;
        pointer-events: none;
      }
      .persist-badge.off {
        background: rgba(255,152,0,0.15);
        color: #ff9800;
      }
      .main-info {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        cursor: pointer;
        transition: background 0.3s;
        position: relative;
      }
      .main-info:hover { background: rgba(255,255,255,0.03); }
      .icon-container {
        width: 48px; height: 48px;
        border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
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
      .text-container { flex: 1; }
      .primary-text {
        font-size: 15px; font-weight: 800;
        color: var(--timer-text);
        letter-spacing: 0.3px;
      }
      .secondary-text {
        font-size: 12px;
        color: var(--timer-sec);
        margin-top: 3px;
        display: flex; align-items: center; gap: 4px;
      }
      .controls {
        display: flex;
        justify-content: space-between;
        padding: 0 12px 12px;
        gap: 6px;
      }
      .btn {
        flex: 1; height: 48px;
        border-radius: 12px;
        background: rgba(255,255,255,0.04);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: pointer; user-select: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255,255,255,0.05);
        color: var(--timer-text);
        -webkit-tap-highlight-color: transparent;
      }
      .btn:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.1);
        transform: translateY(-1px);
      }
      .btn:active { transform: scale(0.94); background: rgba(255,255,255,0.12); }
      .btn-val { font-size: 10px; font-weight: 900; margin-top: 2px; opacity: 0.8; }
      .btn.minus-30 { color: #ff5252; }
      .btn.plus-30 { color: #448aff; }
      .btn.center {
        min-width: 56px; border-radius: 50%;
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
        display: flex; padding: 0 12px 16px; gap: 8px;
      }
      .preset {
        flex: 1; height: 38px; border-radius: 10px;
        background: rgba(255,255,255,0.04);
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700;
        cursor: pointer; user-select: none;
        transition: all 0.2s;
        border: 1px solid rgba(255,255,255,0.05);
        color: var(--timer-sec);
        -webkit-tap-highlight-color: transparent;
      }
      .preset:hover { background: rgba(255,255,255,0.08); color: var(--timer-text); }
      .preset.active {
        background: linear-gradient(135deg, rgba(33,150,243,0.2), rgba(33,150,243,0.1));
        border: 2px solid var(--timer-primary);
        color: var(--timer-text);
        box-shadow: 0 2px 8px rgba(33,150,243,0.15);
      }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .spinning { animation: spin 4s linear infinite; }
      @keyframes pulse-shadow {
        0% { box-shadow: 0 0 0 0 rgba(33,150,243,0.4); }
        70% { box-shadow: 0 0 0 10px rgba(33,150,243,0); }
        100% { box-shadow: 0 0 0 0 rgba(33,150,243,0); }
      }
      .pulse-active { animation: pulse-shadow 2s infinite; }
    `;

        const card = document.createElement('ha-card');

        const glass = document.createElement('div');
        glass.className = 'glass-overlay';

        // Persistence badge
        this._persistBadge = document.createElement('div');
        this._persistBadge.className = 'persist-badge off';
        this._persistBadge.textContent = 'RAM';

        // Main info
        this._mainInfo = document.createElement('div');
        this._mainInfo.className = 'main-info';

        this._iconContainer = document.createElement('div');
        this._iconContainer.className = 'icon-container';
        this._iconEl = document.createElement('ha-icon');
        this._iconContainer.appendChild(this._iconEl);

        const tc = document.createElement('div');
        tc.className = 'text-container';
        this._primaryText = document.createElement('div');
        this._primaryText.className = 'primary-text';
        this._secondaryText = document.createElement('div');
        this._secondaryText.className = 'secondary-text';
        tc.appendChild(this._primaryText);
        tc.appendChild(this._secondaryText);

        this._mainInfo.appendChild(this._iconContainer);
        this._mainInfo.appendChild(tc);

        // Controls & Presets
        this._controlsRow = document.createElement('div');
        this._controlsRow.className = 'controls';
        this._presetsRow = document.createElement('div');
        this._presetsRow.className = 'presets';

        card.appendChild(glass);
        card.appendChild(this._persistBadge);
        card.appendChild(this._mainInfo);
        card.appendChild(this._controlsRow);
        card.appendChild(this._presetsRow);

        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(card);

        this._mainInfo.addEventListener('click', () => {
            if (!this._entityId) return;
            this._hass.callService('homeassistant', 'toggle', { entity_id: this._entityId });
        });

        this._buildButtons();
        this._buildPresets();
    }

    _buildButtons() {
        const defs = [
            { cls: 'minus-30', icon: 'mdi:rewind-30', label: '-30', adjust: -30 },
            { cls: 'minus-5', icon: 'mdi:minus-circle-outline', label: '-5', adjust: -5 },
            { cls: 'minus-1', icon: 'mdi:minus', label: '-1', adjust: -1 },
            { cls: 'center', icon: 'mdi:timer-off-outline', label: '', adjust: 0, id: 'clear-btn' },
            { cls: 'plus-1', icon: 'mdi:plus', label: '+1', adjust: 1 },
            { cls: 'plus-5', icon: 'mdi:plus-circle-outline', label: '+5', adjust: 5 },
            { cls: 'plus-30', icon: 'mdi:fast-forward-30', label: '+30', adjust: 30 },
        ];

        this._clearBtn = null;
        defs.forEach(({ cls, icon, label, adjust, id }) => {
            const btn = document.createElement('div');
            btn.className = `btn ${cls}`;
            const iconEl = document.createElement('ha-icon');
            iconEl.setAttribute('icon', icon);
            btn.appendChild(iconEl);
            if (label) {
                const span = document.createElement('span');
                span.className = 'btn-val';
                span.textContent = label;
                btn.appendChild(span);
            }
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (id === 'clear-btn') {
                    this._setTimer(0);
                } else {
                    const now = Date.now();
                    let cur = 0;
                    if (this._endTime && this._endTime > now) {
                        cur = Math.ceil((this._endTime - now) / 60000);
                    }
                    const next = Math.max(0, cur + adjust);
                    this._setTimer(next > 0 ? next : 0);
                }
            });
            if (id === 'clear-btn') this._clearBtn = btn;
            this._controlsRow.appendChild(btn);
        });
    }

    _buildPresets() {
        const presets = [60, 120, 240, 360, 480];
        const labels = ['1h', '2h', '4h', '6h', '8h'];
        this._presetEls = [];

        presets.forEach((val, i) => {
            const el = document.createElement('div');
            el.className = 'preset';
            el.textContent = labels[i];
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._setTimer(val);
            });
            this._presetsRow.appendChild(el);
            this._presetEls.push({ el, val });
        });
    }

    // ==================== RENDER ====================

    _render() {
        const entityId = this._entityId;
        const stateObj = this._hass?.states?.[entityId];

        if (!stateObj) {
            this._primaryText.textContent = entityId || '?';
            this._secondaryText.textContent = '⚠️ Entity not found';
            return;
        }

        const isOn = stateObj.state === 'on';
        const name = this.config.name || stateObj.attributes.friendly_name || entityId;
        const icon = this.config.icon || stateObj.attributes.icon || 'mdi:power';

        // Persistence badge
        const hasHelper = !!(this.config.helper && this._store && this._store.exists());
        this._persistBadge.textContent = hasHelper ? '💾' : (this.config.helper ? '⏳' : 'RAM');
        this._persistBadge.className = 'persist-badge' + (hasHelper ? '' : ' off');

        // Icon
        this._iconEl.setAttribute('icon', icon);
        this._iconContainer.className = 'icon-container'
            + (isOn ? ' active' : '')
            + (this._endTime && this._endTime > Date.now() ? ' pulse-active' : '');

        if (isOn && (icon.includes('fan') || icon.includes('ventilator'))) {
            this._iconEl.classList.add('spinning');
        } else {
            this._iconEl.classList.remove('spinning');
        }

        this._primaryText.textContent = name;
        this._renderCountdown();
    }

    _renderCountdown() {
        const entityId = this._entityId;
        const stateObj = this._hass?.states?.[entityId];
        if (!stateObj) return;

        const isOn = stateObj.state === 'on';
        const now = Date.now();
        const hasTimer = this._endTime && this._endTime > now;
        const remaining = hasTimer ? Math.max(0, (this._endTime - now) / 60000) : 0;

        let secText;
        if (!isOn) {
            secText = '⛔ OFF';
        } else if (hasTimer && remaining > 0) {
            const totalSec = Math.ceil((this._endTime - now) / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            let timeStr;
            if (h > 0) timeStr = `${h}h ${m}m ${s}s`;
            else if (m > 0) timeStr = `${m}m ${s}s`;
            else timeStr = `${s}s`;
            const off = new Date(this._endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            secText = `⏱️ ${timeStr} · Tắt lúc ${off}`;
        } else if (hasTimer) {
            secText = '⏱️ Đang tắt...';
        } else {
            secText = '✅ ON · Không hẹn giờ';
        }

        this._secondaryText.textContent = secText;

        if (this._clearBtn) {
            this._clearBtn.classList.toggle('active', hasTimer);
        }

        this._presetEls.forEach(({ el, val }) => {
            el.classList.toggle('active', Math.abs(remaining - val) < 1);
        });
    }

    getCardSize() { return 3; }
}

customElements.define('smart-timer-card', SmartTimerCard);

// ==================== EDITOR ====================

class SmartTimerCardEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    set hass(hass) { this._hass = hass; }
    setConfig(config) { this._config = config; this._render(); }

    _render() {
        if (!this.shadowRoot) return;
        this.shadowRoot.innerHTML = `
      <style>
        .card-config { padding: 10px; font-family: sans-serif; }
        .option { margin-bottom: 20px; }
        label { font-weight: bold; display: block; margin-bottom: 10px; font-size: 14px; color: var(--primary-text-color, #fff); }
        .help { font-size: 12px; color: var(--secondary-text-color, #aaa); margin-top: 5px; }
        input#name-input {
          width: 100%; padding: 12px; background: #333; color: white;
          border: 1px solid #666; border-radius: 4px; box-sizing: border-box; font-size: 14px;
        }
        input#name-input:focus { border-color: #03a9f4; outline: none; }
        .setup-box {
          background: rgba(255,152,0,0.1);
          border: 1px solid rgba(255,152,0,0.3);
          border-radius: 8px;
          padding: 12px;
          margin-top: 16px;
          font-size: 12px;
          color: #ffb74d;
        }
        .setup-box a { color: #ff9800; }
      </style>
      <div class="card-config">
        <div class="option">
          <label>1. Chọn thiết bị</label>
          <ha-entity-picker id="entity-picker" allow-custom-entity></ha-entity-picker>
          <div class="help">Switch / Light / Fan bạn muốn hẹn giờ.</div>
        </div>
        <div class="option">
          <label>2. Tên hiển thị</label>
          <input type="text" id="name-input" placeholder="Ví dụ: Đèn phòng khách">
          <div class="help">Để trống sẽ dùng tên gốc của entity.</div>
        </div>
        <div class="option">
          <label>3. Icon</label>
          <ha-icon-picker id="icon-picker"></ha-icon-picker>
        </div>
        <div class="option">
          <label>4. Lưu trữ bền vững (tuỳ chọn)</label>
          <ha-entity-picker id="helper-picker" allow-custom-entity></ha-entity-picker>
          <div class="help">Chọn <code>input_text</code> helper để lưu timer. Nhiều card dùng chung 1 helper → tạo 1 lần dùng cả đời. Để trống = RAM.</div>
        </div>
        <div class="setup-box" style="display:flex;align-items:center;gap:10px;">
          <span style="flex:1;">⚠️ <b>Chưa có helper?</b> Tạo <code>input_text.smart_timer_data</code> (max 2048):</span>
          <a href="#" id="helper-link" style="white-space:nowrap;background:#ff9800;color:#000;padding:6px 14px;border-radius:6px;font-weight:bold;text-decoration:none;font-size:13px;">➕ Tạo ngay</a>
        </div>
      </div>
    `;

        const entityPicker = this.shadowRoot.querySelector('#entity-picker');
        if (entityPicker) {
            entityPicker.includeDomains = ['switch', 'light', 'fan', 'input_boolean'];
            entityPicker.value = this._config.entity;
            entityPicker.hass = this._hass;
            entityPicker.addEventListener('value-changed', (ev) => this._changed(ev, 'entity'));
        }

        const helperPicker = this.shadowRoot.querySelector('#helper-picker');
        if (helperPicker) {
            helperPicker.includeDomains = ['input_text'];
            helperPicker.value = this._config.helper || '';
            helperPicker.hass = this._hass;
            helperPicker.addEventListener('value-changed', (ev) => this._changed(ev, 'helper'));
        }

        const nameInput = this.shadowRoot.querySelector('#name-input');
        if (nameInput) {
            nameInput.value = this._config.name || '';
            // Use 'change' (fires on blur) instead of 'input' to avoid re-render on every keystroke
            nameInput.addEventListener('change', (ev) => this._changed(ev, 'name'));
        }
        const iconPicker = this.shadowRoot.querySelector('#icon-picker');
        if (iconPicker) {
            iconPicker.hass = this._hass;
            iconPicker.value = this._config.icon;
            iconPicker.addEventListener('value-changed', (ev) => this._changed(ev, 'icon'));
        }
        const helperLink = this.shadowRoot.querySelector('#helper-link');
        if (helperLink) {
            helperLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Open helper creation with pre-filled name via HA URL
                const url = '/config/helpers/add?domain=input_text';
                window.open(url, '_blank');
            });
        }
    }

    _changed(ev, field) {
        if (!this._config) return;
        const value = (ev.detail ? ev.detail.value : ev.target.value) || '';
        if (this._config[field] === value) return;
        this.dispatchEvent(new CustomEvent("config-changed", {
            detail: { config: { ...this._config, [field]: value || undefined } },
            bubbles: true, composed: true,
        }));
    }
}

customElements.define('smart-timer-card-editor', SmartTimerCardEditor);

console.log("%c ⏱️ SMART TIMER v6.0.0 READY ", "background:#2196f3;color:white;font-weight:bold;padding:4px;border-radius:4px;");
