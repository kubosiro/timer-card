from homeassistant import config_entries
from homeassistant.helpers import selector
import voluptuous as vol
from . import DOMAIN

class SmartTimerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Smart Timer."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        if user_input is not None:
            # Check if this entity already has a timer
            for entry in self._async_current_entries():
                if entry.data.get("entity_id") == user_input["entity_id"]:
                    return self.async_abort(reason="already_configured")

            return self.async_create_entry(
                title=user_input["name"], 
                data=user_input
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("name", default="Thiết bị mới"): str,
                vol.Required("entity_id"): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain=["switch", "light", "fan", "automation", "script", "input_boolean"])
                ),
            })
        )
