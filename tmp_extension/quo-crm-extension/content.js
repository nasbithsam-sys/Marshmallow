const FIELD_ACTIONS = [
  {
    label: "Customer Name",
    field: "customerName",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
  },
  {
    label: "Customer Number",
    field: "customerNumber",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
  },
  {
    label: "Address",
    field: "customerAddress",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
  },
  {
    label: "Number Name",
    field: "numberName",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`
  },
  {
    label: "Service Name / Keyword",
    field: "serviceName",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  },
  {
    label: "Schedule Req.",
    field: "scheduleRequirement",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
  }
];

const MENU_ID = "quo-crm-floating-menu";
const RELOAD_BANNER_ID = "quo-crm-reload-banner";
const MENU_MARGIN = 12;
let menuElement = null;
let reloadBannerElement = null;
let hideMenuTimeout = null;
let latestSelectionText = "";
let latestSelectionRect = null;
let latestPointerPosition = null;
let suppressMenuUntilSelectionChanges = false;
let contextInvalidated = false;
let heartbeatInterval = null;

initialize();

function initialize() {
  notifyPageReady();
  document.addEventListener("selectionchange", cacheSelectionState);
  document.addEventListener("mouseup", handleSelectionEvent);
  document.addEventListener("keyup", handleSelectionEvent);
  document.addEventListener("mousemove", trackPointerPosition, true);
  document.addEventListener("mousedown", handleDocumentMouseDown, true);
  window.addEventListener("scroll", handleViewportChange, true);
  window.addEventListener("resize", handleViewportChange);
  window.addEventListener("blur", hideMenu);

  // Poll for context invalidation (extension reloaded/updated while this
  // tab stayed open) so we can surface a clear recovery prompt instead of
  // letting every subsequent action fail with a raw thrown error.
  heartbeatInterval = window.setInterval(checkExtensionContext, 4000);

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.theme?.newValue) {
        if (menuElement) {
          menuElement.setAttribute("data-theme", changes.theme.newValue);
        }
      }
    });
  } catch (e) {
    // Ignore context issues
  }
}

/**
 * Returns true only when the extension's background connection is alive.
 * chrome.runtime can still exist as an object after invalidation, but
 * chrome.runtime.id becomes undefined — that's the reliable signal.
 */
function isExtensionContextValid() {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;
  } catch (error) {
    return false;
  }
}

function checkExtensionContext() {
  if (contextInvalidated) return;
  if (!isExtensionContextValid()) {
    handleContextInvalidated();
  }
}

/**
 * Called the first time we detect the extension was reloaded/updated
 * underneath this tab. Stops further background calls, hides the
 * field-assign menu, and shows a small persistent banner with a
 * one-click reload instead of failing silently or with alert() popups.
 */
function handleContextInvalidated() {
  if (contextInvalidated) return;
  contextInvalidated = true;

  if (heartbeatInterval) {
    window.clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  hideMenu();
  showReloadBanner();
}

function showReloadBanner() {
  if (reloadBannerElement) return;

  const banner = document.createElement("div");
  banner.id = RELOAD_BANNER_ID;
  banner.innerHTML = `
    <span class="quo-reload-banner__dot"></span>
    <span class="quo-reload-banner__text">Quo CRM extension was updated. Refresh this tab to keep capturing leads.</span>
    <button type="button" class="quo-reload-banner__btn">Refresh Tab</button>
    <button type="button" class="quo-reload-banner__close" aria-label="Dismiss">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  banner.querySelector(".quo-reload-banner__btn").addEventListener("click", () => {
    window.location.reload();
  });
  banner.querySelector(".quo-reload-banner__close").addEventListener("click", () => {
    banner.remove();
    reloadBannerElement = null;
  });

  document.body.appendChild(banner);
  reloadBannerElement = banner;
}

function handleSelectionEvent(event) {
  if (event) {
    updatePointerPositionFromEvent(event);
  }

  cacheSelectionState();
  window.clearTimeout(hideMenuTimeout);
  hideMenuTimeout = window.setTimeout(showMenuForSelection, 10);
}

function trackPointerPosition(event) {
  updatePointerPositionFromEvent(event);
}

function updatePointerPositionFromEvent(event) {
  if (
    !event ||
    typeof event.clientX !== "number" ||
    typeof event.clientY !== "number"
  ) {
    return;
  }

  latestPointerPosition = {
    clientX: event.clientX,
    clientY: event.clientY
  };
}

function handleDocumentMouseDown(event) {
  updatePointerPositionFromEvent(event);

  if (menuElement && menuElement.contains(event.target)) {
    return;
  }

  hideMenu();
}

function showMenuForSelection() {
  if (suppressMenuUntilSelectionChanges || !latestSelectionText) {
    hideMenu();
    return;
  }

  if (!menuElement) {
    menuElement = buildMenu();
    document.body.appendChild(menuElement);
  }

  refreshSelectionAnchor();
  const anchor = getMenuAnchor();
  if (!anchor) {
    hideMenu();
    return;
  }

  menuElement.dataset.selectedText = latestSelectionText;
  menuElement.classList.remove("quo-hidden");
  positionMenu(anchor);
}

function buildMenu() {
  const container = document.createElement("div");
  container.id = MENU_ID;
  container.classList.add("quo-hidden");
  container.addEventListener("mousedown", handleMenuMouseDown);
  container.addEventListener("click", handleMenuClick);

  // Sync theme with extension storage
  try {
    chrome.storage.local.get({ theme: "light" }, (data) => {
      if (container && chrome.runtime?.id) {
        container.setAttribute("data-theme", data?.theme || "light");
      }
    });
  } catch (e) {
    container.setAttribute("data-theme", "light");
  }

  const header = document.createElement("div");
  header.className = "quo-menu-header";

  const title = document.createElement("div");
  title.className = "quo-title";
  title.textContent = "Assign Field";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quo-close-btn";
  closeButton.dataset.action = "close";
  closeButton.setAttribute("aria-label", "Close assignment menu");
  closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  header.append(title, closeButton);
  container.appendChild(header);

  const actionGrid = document.createElement("div");
  actionGrid.className = "quo-action-grid";

  FIELD_ACTIONS.forEach(({ label, field, icon }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quo-field-btn";
    button.dataset.field = field;
    button.innerHTML = `${icon}<span>${label}</span>`;
    actionGrid.appendChild(button);
  });

  container.appendChild(actionGrid);
  return container;
}

function positionMenu(anchor) {
  if (!menuElement || !anchor) {
    return;
  }

  const menuRect = measureMenu();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const preferredLeft = anchor.centerX - menuRect.width / 2;
  const maxLeft = Math.max(MENU_MARGIN, viewportWidth - menuRect.width - MENU_MARGIN);
  const left = clamp(preferredLeft, MENU_MARGIN, maxLeft);

  const spaceBelow = viewportHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  const openAbove = spaceBelow < menuRect.height + MENU_MARGIN && spaceAbove >= menuRect.height + MENU_MARGIN;

  let top = openAbove
    ? anchor.top - menuRect.height - MENU_MARGIN
    : anchor.bottom + MENU_MARGIN;

  const maxTop = Math.max(MENU_MARGIN, viewportHeight - menuRect.height - MENU_MARGIN);
  top = clamp(top, MENU_MARGIN, maxTop);

  menuElement.style.left = `${Math.round(left)}px`;
  menuElement.style.top = `${Math.round(top)}px`;
}

function measureMenu() {
  const wasHidden = menuElement.classList.contains("quo-hidden");
  const previousVisibility = menuElement.style.visibility;

  if (wasHidden) {
    menuElement.classList.remove("quo-hidden");
    menuElement.style.visibility = "hidden";
  }

  const rect = menuElement.getBoundingClientRect();

  if (wasHidden) {
    menuElement.classList.add("quo-hidden");
    menuElement.style.visibility = previousVisibility;
  }

  return {
    width: rect.width || 190,
    height: rect.height || 272
  };
}

async function assignSelection(field) {
  const selectedText = menuElement?.dataset.selectedText || latestSelectionText || "";

  if (!isExtensionContextValid()) {
    handleContextInvalidated();
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "ASSIGN_SELECTION_TO_FIELD",
      field,
      selectedText
    });

    if (!response?.success) {
      throw new Error(response?.error || "Failed to capture selected text.");
    }

    suppressMenuUntilSelectionChanges = true;
    clearActiveSelection();
    hideMenu();
  } catch (error) {
    console.error("Quo CRM Lead Capture:", error);

    if (String(error?.message || "").includes("Extension context invalidated")) {
      handleContextInvalidated();
      return;
    }

    alert(error.message || "Failed to assign selected text.");
  }
}

function handleDismissMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  suppressMenuUntilSelectionChanges = true;
  clearActiveSelection();
  hideMenu();
}

function handleMenuMouseDown(event) {
  if (!event.target.closest("button")) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}

async function handleMenuClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (button.dataset.action === "close") {
    handleDismissMenu(event);
    return;
  }

  if (button.dataset.field) {
    await assignSelection(button.dataset.field);
  }
}

function hideMenu() {
  if (menuElement) {
    menuElement.classList.add("quo-hidden");
  }
}

function cacheSelectionState() {
  const inputSelection = getInputSelection();
  if (inputSelection) {
    suppressMenuUntilSelectionChanges = false;
    latestSelectionText = inputSelection.text;
    latestSelectionRect = inputSelection.rect;
    return;
  }

  const selectionDetails = getSelectionDetails();
  const selectedText = selectionDetails?.text || "";

  if (!selectionDetails || !selectedText) {
    latestSelectionText = "";
    latestSelectionRect = null;
    suppressMenuUntilSelectionChanges = false;
    return;
  }

  latestSelectionText = selectedText;
  latestSelectionRect = selectionDetails.rect;
  suppressMenuUntilSelectionChanges = false;
}

function getInputSelection() {
  const activeElement = getDeepActiveElement(document);
  if (!activeElement) {
    return null;
  }

  const isTextInput =
    activeElement instanceof HTMLTextAreaElement ||
    (activeElement instanceof HTMLInputElement &&
      ["text", "search", "tel", "url", "email"].includes(activeElement.type));

  if (!isTextInput) {
    return null;
  }

  const start = activeElement.selectionStart;
  const end = activeElement.selectionEnd;
  if (typeof start !== "number" || typeof end !== "number" || start === end) {
    return null;
  }

  const text = activeElement.value.slice(start, end).trim();
  if (!text) {
    return null;
  }

  const rect = getSelectionRectFromTextControl(activeElement, start, end);
  if (!isUsableRect(rect)) {
    return null;
  }

  return {
    text,
    rect
  };
}

function getSelectionDetails() {
  const selection = getDeepSelection();
  const selectedText = selection ? selection.toString().trim() : "";

  if (!selection || !selectedText || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = getSelectionRectFromRange(range);
  if (!isUsableRect(rect)) {
    return null;
  }

  return {
    text: selectedText,
    rect
  };
}

function getSelectionRectFromRange(range) {
  const primaryRect = range.getBoundingClientRect();
  if (isUsableRect(primaryRect)) {
    return primaryRect;
  }

  const clientRects = Array.from(range.getClientRects() || []);
  return clientRects.find(isUsableRect) || null;
}

function getSelectionRectFromTextControl(element, start, end) {
  if (typeof element.getBoundingClientRect !== "function") {
    return null;
  }

  const baseRect = element.getBoundingClientRect();
  if (!isUsableRect(baseRect)) {
    return null;
  }

  const mirror = document.createElement("div");
  const computed = window.getComputedStyle(element);
  const propertiesToCopy = [
    "boxSizing",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "textAlign",
    "textTransform",
    "textIndent",
    "whiteSpace",
    "wordBreak",
    "overflowWrap"
  ];

  mirror.style.position = "fixed";
  mirror.style.left = `${Math.round(baseRect.left)}px`;
  mirror.style.top = `${Math.round(baseRect.top)}px`;
  mirror.style.width = `${Math.round(baseRect.width)}px`;
  mirror.style.height = `${Math.round(baseRect.height)}px`;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = element instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  mirror.style.overflow = "hidden";

  propertiesToCopy.forEach((property) => {
    mirror.style[property] = computed[property];
  });

  const beforeText = document.createTextNode(element.value.slice(0, start));
  const selectionSpan = document.createElement("span");
  selectionSpan.textContent = element.value.slice(start, end) || " ";

  mirror.appendChild(beforeText);
  mirror.appendChild(selectionSpan);
  document.body.appendChild(mirror);

  const rect = selectionSpan.getBoundingClientRect();
  document.body.removeChild(mirror);

  return isUsableRect(rect) ? rect : baseRect;
}

function getDeepActiveElement(root) {
  let activeElement = root?.activeElement || null;
  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return activeElement;
}

function getDeepSelection() {
  const activeElement = getDeepActiveElement(document);
  if (activeElement?.shadowRoot?.getSelection) {
    const shadowSelection = activeElement.shadowRoot.getSelection();
    if (shadowSelection && shadowSelection.toString().trim()) {
      return shadowSelection;
    }
  }

  return window.getSelection();
}

function isUsableRect(rect) {
  return !!rect && Number.isFinite(rect.top) && Number.isFinite(rect.left) &&
    Number.isFinite(rect.bottom) && Number.isFinite(rect.right) &&
    (rect.width > 0 || rect.height > 0);
}

function getMenuAnchor() {
  if (isUsableRect(latestSelectionRect)) {
    return rectToAnchor(latestSelectionRect);
  }

  if (latestPointerPosition) {
    const { clientX, clientY } = latestPointerPosition;
    return {
      top: clientY,
      bottom: clientY,
      left: clientX,
      right: clientX,
      centerX: clientX
    };
  }

  return null;
}

function rectToAnchor(rect) {
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    centerX: rect.left + rect.width / 2
  };
}

function refreshSelectionAnchor() {
  const inputSelection = getInputSelection();
  if (inputSelection && inputSelection.text === latestSelectionText) {
    latestSelectionRect = inputSelection.rect;
    return;
  }

  const selectionDetails = getSelectionDetails();
  if (selectionDetails && selectionDetails.text === latestSelectionText) {
    latestSelectionRect = selectionDetails.rect;
    return;
  }

  latestSelectionRect = null;
}

function handleViewportChange() {
  if (!menuElement || menuElement.classList.contains("quo-hidden")) {
    return;
  }

  refreshSelectionAnchor();
  const anchor = getMenuAnchor();
  if (!anchor) {
    hideMenu();
    return;
  }

  positionMenu(anchor);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clearActiveSelection() {
  const activeElement = document.activeElement;
  if (
    activeElement &&
    (activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLInputElement)
  ) {
    const end = activeElement.selectionEnd;
    if (typeof end === "number") {
      activeElement.setSelectionRange(end, end);
    }
  }

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }

  latestSelectionText = "";
  latestSelectionRect = null;
}

async function notifyPageReady() {
  if (!isExtensionContextValid()) {
    handleContextInvalidated();
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: "PAGE_CONTEXT_READY",
      url: window.location.href
    });
  } catch (error) {
    console.warn("Quo CRM Lead Capture: could not initialize page context.", error);
    if (String(error?.message || "").includes("Extension context invalidated")) {
      handleContextInvalidated();
    }
  }
}

// Listen for messages from the sidepanel and background script
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SCRAPE_CUSTOMER_NUMBER") {
      const number = scrapeCustomerNumber();
      sendResponse({ success: !!number, number });
    } else if (message?.type === "SCRAPE_NUMBER_NAME") {
      const name = scrapeNumberName();
      sendResponse({ success: !!name, name });
    } else if (message?.type === "SCRAPE_CHAT_IMAGES") {
      const images = scrapeChatImages();
      sendResponse({ success: !!images, images });
    } else if (message?.type === "OPEN_ASSIGN_FIELD_MENU") {
      const response = openAssignFieldMenu(message.field);
      sendResponse(response);
    } else if (message?.type === "NAVIGATE_AND_SEND_MESSAGE") {
      handleNavigateAndSendMessage(message.chatUrl, message.message, message.scheduleTime).then(result => {
        sendResponse(result || { success: true });
      });
      return true; // Keep message channel open for async response
    }
    return true; // Keep message channel open for async response
  });
}

function openAssignFieldMenu(field) {
  cacheSelectionState();

  if (!latestSelectionText) {
    return {
      success: false,
      error: "Select text in the quo.com chat first, then use Auto-pick."
    };
  }

  showMenuForSelection();

  if (!menuElement || menuElement.classList.contains("quo-hidden")) {
    return {
      success: false,
      error: "Could not open the Assign Field menu for the current selection."
    };
  }

  if (field) {
    menuElement.dataset.preferredField = field;
  }

  return { success: true };
}

function scrapeNumberName() {
  const activeLink = document.querySelector('[aria-current="page"], [aria-current="true"]');
  if (!activeLink) {
    return null;
  }

  // Scan all children nodes to find the name text
  const elements = activeLink.querySelectorAll('span, div');
  let potentialNames = [];

  for (const el of elements) {
    if (el.children.length === 0) {
      const text = el.textContent.trim();
      if (!text) continue;

      // Skip line phone numbers
      if (isPhoneNumber(text)) {
        continue;
      }

      // Skip emoji flag/icons (usually length <= 2)
      if (text.length <= 2) {
        continue;
      }

      potentialNames.push(text);
    }
  }

  // The name is usually the longest text
  if (potentialNames.length > 0) {
    potentialNames.sort((a, b) => b.length - a.length);
    return potentialNames[0];
  }

  return null;
}

function scrapeCustomerNumber() {
  // Scope search to the active chat header container
  let header = null;

  const quickActions = document.getElementById("message-quick-actions");
  if (quickActions) {
    header = quickActions.closest('div._160c0eh1') || quickActions.parentElement;
  }

  if (!header) {
    header = document.querySelector('div._160c0eh1.xw761z0.xw761z1') || 
             document.querySelector('div._10cjd4h0');
  }

  if (header) {
    // Strategy 1: Look for avatar label inside the header
    const avatarEl = header.querySelector('[aria-label*="\'s avatar"]');
    if (avatarEl) {
      const label = avatarEl.getAttribute('aria-label');
      const match = label.match(/^([+\d\s()\-]+)'s avatar/);
      if (match) {
        const potential = match[1].trim();
        if (isPhoneNumber(potential)) {
          return potential;
        }
      }
    }

    // Strategy 2: Scan elements inside the header for phone number pattern
    const phoneRegex = /^\+?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
    const allDivs = header.querySelectorAll('div, button, span');
    for (const el of allDivs) {
      if (el.children.length === 0 || (el.children.length === 1 && el.firstElementChild.tagName.toUpperCase() === 'SVG')) {
        const text = el.textContent.trim();
        if (phoneRegex.test(text)) {
          return text;
        }
      }
    }

    // Strategy 3: Broader search inside copy buttons inside header
    const copyButtons = header.querySelectorAll('button');
    for (const btn of copyButtons) {
      // Check the button's own text content first (handles direct text child nodes alongside SVG copy icons)
      const btnText = btn.textContent.trim();
      if (phoneRegex.test(btnText) || isPhoneNumber(btnText)) {
        return btnText;
      }
      const divs = btn.querySelectorAll('div');
      for (const div of divs) {
        const text = div.textContent.trim();
        if (phoneRegex.test(text)) {
          return text;
        }
      }
    }

    // Strategy 4: Fallback - broad scan of all potential text-containing elements inside the header
    const candidates = header.querySelectorAll('button, span, div, p, a');
    for (const candidate of candidates) {
      const text = candidate.textContent.trim();
      if (isPhoneNumber(text)) {
        return text;
      }
    }
  }

  return null;
}

function isPhoneNumber(str) {
  const cleaned = str.replace(/[()+\-\s]/g, '');
  return /^\d{7,15}$/.test(cleaned);
}

function scrapeChatImages() {
  const images = Array.from(document.querySelectorAll('img'));
  const chatImages = [];
  
  images.forEach(img => {
    // 1. Get raw image source from src or lazy-load attributes
    let imageUrl = img.src || "";
    const dataSrc = img.getAttribute('data-src') || 
                    img.getAttribute('data-original') || 
                    img.getAttribute('data-original-src') ||
                    img.getAttribute('data-url') ||
                    img.getAttribute('data-lazy') ||
                    img.getAttribute('srcset');
                    
    if (dataSrc) {
      const cleanSrc = dataSrc.trim().split(/[\s,]+/)[0];
      if (cleanSrc) imageUrl = cleanSrc;
    }
    
    if (!imageUrl) return;
    
    // Resolve relative URLs to absolute
    try {
      imageUrl = new URL(imageUrl, window.location.origin).href;
    } catch (e) {
      return;
    }

    // If the image is inside an <a> tag pointing to an image, check the href
    const parentLink = img.closest('a');
    if (parentLink && parentLink.href) {
      const href = parentLink.href.toLowerCase();
      if (
        href.endsWith('.jpg') || 
        href.endsWith('.jpeg') || 
        href.endsWith('.png') || 
        href.endsWith('.webp') || 
        href.endsWith('.gif') ||
        href.includes('/attachments/') ||
        href.includes('/media/') ||
        href.includes('/uploads/')
      ) {
        imageUrl = parentLink.href;
      }
    }

    // 2. Filter out explicit avatars/profile photos
    const classStr = (img.className || "").toLowerCase();
    const altStr = (img.alt || "").toLowerCase();
    const ariaLabel = (img.getAttribute('aria-label') || "").toLowerCase();
    const parentClass = img.parentElement ? (img.parentElement.className || "").toLowerCase() : "";
    
    if (
      classStr.includes('avatar') || 
      altStr.includes('avatar') || 
      ariaLabel.includes('avatar') ||
      parentClass.includes('avatar') ||
      classStr.includes('profile') ||
      altStr.includes('profile') ||
      parentClass.includes('profile')
    ) {
      return;
    }

    // 3. Filter out small icons/logos if they have explicitly measured small sizes
    const rect = img.getBoundingClientRect();
    const width = rect.width || img.clientWidth || img.naturalWidth || 0;
    const height = rect.height || img.clientHeight || img.naturalHeight || 0;
    
    // Skip if it's explicitly measured as very small (e.g. <= 32px)
    if ((width > 0 && width <= 32) || (height > 0 && height <= 32)) {
      return;
    }
    
    // Skip typical tracking pixels / spacer images (1x1)
    if (width === 1 && height === 1) {
      return;
    }

    // Skip SVG data URLs
    if (imageUrl.startsWith('data:image/svg+xml')) {
      return;
    }
    
    // Avoid duplicates
    if (!chatImages.includes(imageUrl)) {
      chatImages.push(imageUrl);
    }
  });
  
  return chatImages;
}

async function handleNavigateAndSendMessage(chatUrl, message, scheduleTime) {
  try {
    // 1. Navigate without full reload by injecting a link and clicking it.
    if (window.location.href !== chatUrl) {
      const a = document.createElement("a");
      a.href = chatUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // 2. Wait for the editor to appear
    const editor = await waitForElement('div[role="textbox"][aria-label="message input"]');
    if (!editor) {
      console.error("Quo CRM Extension: Could not find message input editor.");
      return { success: false, error: "Could not find message input editor on page." };
    }

    // 3. Paste the message
    editor.focus();
    
    // Create a new data transfer for the paste event to simulate real pasting
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', message);
    
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });
    
    editor.dispatchEvent(pasteEvent);

    // If paste event doesn't trigger Slate.js updates, we might also need to use execCommand
    if (!pasteEvent.defaultPrevented) {
      document.execCommand("insertText", false, message);
    }
    
    // Ensure React registers the input
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    if (scheduleTime) {
      console.log("Quo CRM: Attempting to schedule message...");
      // 5a. Wait and poll for the Schedule button to become enabled
      let scheduleBtn;
      for (let i = 0; i < 10; i++) {
        scheduleBtn = document.querySelector('button[aria-label="Schedule message"]:not([aria-disabled="true"])');
        if (scheduleBtn) break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (!scheduleBtn) {
        console.error("Quo CRM: Schedule button not found or is disabled.");
        return { success: false, error: "Schedule button never became enabled after pasting the message." };
      }
      scheduleBtn.click();
      console.log("Quo CRM: Clicked schedule button.");

      // Wait for the modal input
      const modalInput = await waitForElement('input[placeholder*="Try: 5pm"]', 5000);
      if (!modalInput) {
        console.error("Quo CRM: Schedule modal input not found.");
        return { success: false, error: "Schedule modal did not appear." };
      }
      console.log("Quo CRM: Found modal input.");

      // Type the schedule time using React native setter hack
      modalInput.focus();
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(modalInput, scheduleTime);
      modalInput.dispatchEvent(new Event('input', { bubbles: true }));
      console.log("Quo CRM: Typed schedule time: " + scheduleTime);
      
      // Wait for dropdown options to populate
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Find the first list option and click it
      const firstOption = document.querySelector('ul[aria-label="Suggested datetimes"] li[role="option"]');
      if (firstOption) {
        firstOption.click();
        console.log("Quo CRM: Clicked schedule option.");
        return { success: true };
      } else {
        console.error("Quo CRM: No scheduling option found in dropdown.");
        return { success: false, error: "Could not find a scheduling option in the dropdown." };
      }
    } else {
      // 5b. Wait and poll for the normal Send button to become enabled
      let sendButton;
      for (let i = 0; i < 10; i++) {
        sendButton = document.querySelector('button[aria-label="Send message"]:not([aria-disabled="true"])');
        if (sendButton) break;
        await new Promise(r => setTimeout(r, 500));
      }
      
      if (sendButton) {
        sendButton.click();
        return { success: true };
      } else {
        console.warn("Quo CRM Extension: Send button not found or is disabled.");
        return { success: false, error: "Send button never became enabled after pasting the message." };
      }
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Helper to wait for element
function waitForElement(selector, timeout = 10000) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(mutations => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
