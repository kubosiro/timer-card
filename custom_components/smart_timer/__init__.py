import logging
import voluptuous as vol
from datetime import timedelta
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.util import dt as dt_util
from homeassistant.helpers.discovery import async_load_platform
from homeassistant.components.http import StaticPathConfig
from homeassistant.components import websocket_api

_LOGGER = logging.getLogger(__name__)
DOMAIN = "smart_timer"
STORAGE_KEY = "smart_timer.active_timers"
STORAGE_VERSION = 1

@websocket_api.websocket_command({
    vol.Required("type"): "smart_timer/version",
})
@callback
def websocket_get_version(hass, connection, msg):
    """Return the version of the integration."""
    import json
    import os
    manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
    version = "2.4.9"
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            version = manifest.get("version", version)
    except:
        pass
    connection.send_result(msg["id"], {"version": version})

SERVICE_SET_SCHEMA = vol.Schema({
    vol.Required("entity_id"): cv.entity_id,
    vol.Required("duration"): vol.Coerce(float),
})

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the timer component."""
    return True

async def async_setup_entry(hass: HomeAssistant, entry):
    """Set up Smart Timer from a config entry."""
    websocket_api.async_register_command(hass, websocket_get_version)
    
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {
            "active_timers": {},
            "store": Store(hass, STORAGE_VERSION, STORAGE_KEY),
            "listeners": {},
            "initialized": False
        }
    
    data = hass.data[DOMAIN]
    store = data["store"]
    active_timers = data["active_timers"]

    async def _save_timers():
        await store.async_save(active_timers)

    async def _turn_off_entity(entity_id):
        _LOGGER.info("Timer expired for %s. Turning off.", entity_id)
        domain = entity_id.split(".")[0]
        if entity_id in active_timers:
            del active_timers[entity_id]
            if entity_id in data["listeners"]:
                data["listeners"].pop(entity_id)
            await _save_timers()
        
        try:
            await hass.services.async_call(domain, "turn_off", {"entity_id": entity_id})
        except Exception as e:
            _LOGGER.error("Failed to turn off %s: %s", entity_id, e)
            
        hass.bus.async_fire("smart_timer_updated", {"entity_id": entity_id, "state": "idle"})

    async def set_timer(call: ServiceCall):
        entity_id = call.data.get("entity_id")
        duration_minutes = call.data.get("duration", 0)

        if entity_id in data["listeners"]:
            data["listeners"].pop(entity_id)()

        if duration_minutes <= 0:
            if entity_id in active_timers:
                del active_timers[entity_id]
                await _save_timers()
            hass.bus.async_fire("smart_timer_updated", {"entity_id": entity_id, "state": "idle"})
            return

        end_time = dt_util.now() + timedelta(minutes=duration_minutes)
        active_timers[entity_id] = {
            "end_time": end_time.isoformat(),
            "duration": duration_minutes
        }
        await _save_timers()

        domain = entity_id.split(".")[0]
        try:
            await hass.services.async_call(domain, "turn_on", {"entity_id": entity_id})
        except Exception as e:
            _LOGGER.error("Failed to turn on %s: %s", entity_id, e)

        data["listeners"][entity_id] = async_track_point_in_time(
            hass, 
            lambda _: hass.async_create_task(_turn_off_entity(entity_id)), 
            end_time
        )
        
        hass.bus.async_fire("smart_timer_updated", {
            "entity_id": entity_id, 
            "state": "active",
            "end_time": active_timers[entity_id]["end_time"],
            "duration": duration_minutes
        })

    # One-time global setup
    if not data["initialized"]:
        hass.services.async_register(DOMAIN, "set", set_timer, schema=SERVICE_SET_SCHEMA)

        # Load persisted timers
        stored_data = await store.async_load()
        if stored_data:
            now = dt_util.now()
            for entity_id, info in stored_data.items():
                end_time = dt_util.parse_datetime(info["end_time"])
                if end_time and end_time > now:
                    active_timers[entity_id] = info
                    data["listeners"][entity_id] = async_track_point_in_time(
                        hass, 
                        lambda _: hass.async_create_task(_turn_off_entity(entity_id)), 
                        end_time
                    )
                else:
                    # Clear expired timer
                    pass

        async def _state_changed_listener(event):
            entity_id = event.data.get("entity_id")
            new_state = event.data.get("new_state")
            if not new_state or new_state.state != "on":
                if entity_id in active_timers:
                    if entity_id in data["listeners"]:
                        data["listeners"].pop(entity_id)()
                    del active_timers[entity_id]
                    await _save_timers()
                    hass.bus.async_fire("smart_timer_updated", {"entity_id": entity_id, "state": "idle"})

        hass.bus.async_listen("state_changed", _state_changed_listener)
        
        # Register a UNIQUE static path to avoid conflicts
        await hass.http.async_register_static_paths([
            StaticPathConfig("/smart_timer/static", hass.config.path("custom_components/smart_timer/www"), True)
        ])

        # Auto-register Lovelace resource
        await _async_register_resource(hass)
        
        data["initialized"] = True

    # Register platforms
    await hass.config_entries.async_forward_entry_setups(entry, ["sensor"])

    return True

async def async_unload_entry(hass: HomeAssistant, entry):
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, ["sensor"])
    return unload_ok

async def _async_register_resource(hass: HomeAssistant):
    """Register the Lovelace resource automatically with maximum robustness."""
    from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
    
    # URL và Version
    import json
    import os
    manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
    version = "2.4.9"
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            version = manifest.get("version", version)
    except:
        pass
        
    url = f"/smart_timer/static/timer-card.js?v={version}"
    base_url = "/smart_timer/static/timer-card.js"

    async def _do_register(event=None):
        _LOGGER.debug("Starting robust Lovelace resource registration...")
        try:
            lovelace = hass.data.get("lovelace")
            if not lovelace:
                _LOGGER.debug("Lovelace not in hass.data. Skipping.")
                return

            resources = getattr(lovelace, "resources", None)
            if not resources or not hasattr(resources, "async_items"):
                _LOGGER.debug("Lovelace resources not manageable via API.")
                return

            items = await resources.async_items()
            existing = next((res for res in items if res.get("url", "").startswith(base_url)), None)

            if existing:
                if existing.get("url") != url:
                    _LOGGER.info("Updating existing Lovelace resource to version %s", version)
                    await resources.async_update_item(existing["id"], {"url": url})
            else:
                _LOGGER.info("Creating new Lovelace resource for Smart Timer Card.")
                await resources.async_create_item({
                    "res_type": "module",
                    "url": url
                })
        except Exception as e:
            _LOGGER.error("Failed to auto-register Lovelace resource: %s", e)

    # Nếu HA đã start rồi thì chạy luôn, nếu chưa thì đợi event
    if hass.is_running:
        await _do_register()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _do_register)
