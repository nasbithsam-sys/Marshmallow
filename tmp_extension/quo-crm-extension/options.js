const settingsForm = document.getElementById("settings-form");
const settingsFeedback = document.getElementById("settings-feedback");
const themeToggleBtn = document.getElementById("theme-toggle-btn");

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute("aria-checked", isDark ? "true" : "false");
    themeToggleBtn.setAttribute("title", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
  }
}

async function initTheme() {
  try {
    const data = await chrome.storage.local.get({ theme: "light" });
    applyTheme(data.theme || "light");
  } catch (e) {
    applyTheme("light");
  }
}

async function handleThemeToggle() {
  const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  try {
    await chrome.storage.local.set({ theme: newTheme });
  } catch (e) {
    console.debug("Failed to persist theme:", e);
  }
}

// Immediately apply theme
initTheme();

initialize();

async function initialize() {
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", handleThemeToggle);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.theme?.newValue) {
      applyTheme(changes.theme.newValue);
    }
  });

  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  const settings = response.settings || {};
  settingsForm.apiBaseUrl.value = settings.apiBaseUrl || "";

  settingsForm.addEventListener("submit", handleSaveSettings);
}

async function handleSaveSettings(event) {
  event.preventDefault();
  hideSettingsFeedback();

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      payload: {
        apiBaseUrl: settingsForm.apiBaseUrl.value,
        apiToken: ""
      }
    });

    if (!response?.success) {
      throw new Error(response?.error || "Failed to save settings.");
    }

    if (response.settings) {
      settingsForm.apiBaseUrl.value = response.settings.apiBaseUrl || "";
    }

    showSettingsFeedback("Settings saved successfully.", "success");
  } catch (error) {
    showSettingsFeedback(error.message || "Failed to save settings.", "error");
  }
}

function showSettingsFeedback(message, type) {
  settingsFeedback.hidden = false;
  settingsFeedback.className = `feedback feedback--${type}`;
  
  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg class="feedback__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else {
    iconSvg = `<svg class="feedback__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }

  const contentSpan = document.createElement("span");
  contentSpan.className = "feedback__content";
  contentSpan.textContent = message;

  settingsFeedback.innerHTML = "";
  settingsFeedback.appendChild(createSvgElement(iconSvg));
  settingsFeedback.appendChild(contentSpan);
  
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "feedback__close";
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.addEventListener("click", hideSettingsFeedback);
  settingsFeedback.appendChild(closeBtn);
}

function createSvgElement(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  return doc.documentElement;
}

function hideSettingsFeedback() {
  settingsFeedback.hidden = true;
  settingsFeedback.textContent = "";
  settingsFeedback.className = "feedback";
}
