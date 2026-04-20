const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const rtlToggle = document.getElementById("rtlToggle");

const STORAGE_KEY = "loreal-selected-products";
const RTL_KEY = "loreal-rtl-mode";

/*
  Replace this with your deployed Cloudflare Worker URL.
  Example:
  const WORKER_URL = "https://your-worker-name.your-subdomain.workers.dev";
*/
const WORKER_URL = "https://loreal-routine-worker.akapil1.workers.dev";

let allProducts = [];
let selectedProducts = [];
let conversationHistory = [];
let currentRoutine = "";

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (match) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[match];
  });
}

function saveSelections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProducts));
}

function loadSelections() {
  const saved = localStorage.getItem(STORAGE_KEY);
  selectedProducts = saved ? JSON.parse(saved) : [];
}

function saveRTLMode(enabled) {
  localStorage.setItem(RTL_KEY, JSON.stringify(enabled));
}

function loadRTLMode() {
  const saved = localStorage.getItem(RTL_KEY);
  const enabled = saved ? JSON.parse(saved) : false;
  rtlToggle.checked = enabled;
  document.body.classList.toggle("rtl", enabled);
  document.documentElement.setAttribute("dir", enabled ? "rtl" : "ltr");
}

async function loadProducts() {
  try {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products;
    renderProducts();
    renderSelectedProducts();
    showWelcomeMessage();
  } catch (error) {
    console.error("Error loading products:", error);
    productsContainer.innerHTML = `
      <div class="empty-state">
        Sorry, products could not be loaded.
      </div>
    `;
  }
}

function isSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

function toggleProductSelection(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  if (isSelected(productId)) {
    selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  } else {
    selectedProducts.push(product);
  }

  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

function removeSelectedProduct(productId) {
  selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

function clearSelections() {
  selectedProducts = [];
  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

function filterProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  return allProducts.filter((product) => {
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;

    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm) ||
      product.brand.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const filteredProducts = filterProducts();

  if (!filteredProducts.length) {
    productsContainer.innerHTML = `
      <div class="empty-state">
        No products match your current filter.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = filteredProducts
    .map((product) => {
      const selected = isSelected(product.id);

      return `
        <article class="product-card ${selected ? "selected" : ""}" data-id="${product.id}">
          ${selected ? '<span class="product-badge">Selected</span>' : ""}
          <img src="${product.image}" alt="${escapeHTML(product.name)}" />
          <div class="product-info">
            <h3>${escapeHTML(product.name)}</h3>
            <p class="product-brand">${escapeHTML(product.brand)}</p>
            <p class="product-category">${escapeHTML(product.category)}</p>
          </div>

          <div class="card-actions">
            <button class="card-btn select-btn" data-action="select" data-id="${product.id}">
              ${selected ? "Unselect" : "Select"}
            </button>
            <button class="card-btn details-btn" data-action="details" data-id="${product.id}">
              Details
            </button>
          </div>

          <div class="product-description" id="desc-${product.id}">
            ${escapeHTML(product.description)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSelectedProducts() {
  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `
      <p class="empty-state">No products selected yet.</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-pill">
          <span>${escapeHTML(product.name)}</span>
          <button
            class="remove-pill-btn"
            data-remove-id="${product.id}"
            aria-label="Remove ${escapeHTML(product.name)}"
            type="button"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `
    )
    .join("");
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `chat-message ${role}`;
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showWelcomeMessage() {
  if (chatWindow.children.length > 0) return;

  addMessage(
    "assistant",
    "Hi! Explore products, select the ones you like, then click “Generate Routine.” After that, you can ask follow-up questions about your routine, skincare, haircare, makeup, fragrance, and related beauty topics."
  );
}

async function callWorker(payload) {
  if (!WORKER_URL || WORKER_URL.includes("PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE")) {
    throw new Error("Please add your Cloudflare Worker URL in script.js");
  }

  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Worker request failed with status ${response.status}`);
  }

  return response.json();
}

async function generateRoutine() {
  if (!selectedProducts.length) {
    addMessage("assistant", "Please select at least one product before generating a routine.");
    return;
  }

  addMessage("assistant", "Generating your personalized routine...");

  try {
    const payload = {
      mode: "routine",
      selectedProducts,
      conversationHistory
    };

    const data = await callWorker(payload);

    currentRoutine = data.reply || "No routine was returned.";
    addMessage("assistant", currentRoutine);

    conversationHistory.push({
      role: "assistant",
      content: currentRoutine
    });
  } catch (error) {
    console.error(error);
    addMessage(
      "assistant",
      "Sorry — I couldn’t generate the routine right now. Check your Worker URL and deployment."
    );
  }
}

async function handleUserChat(messageText) {
  addMessage("user", messageText);
  conversationHistory.push({
    role: "user",
    content: messageText
  });

  try {
    const data = await callWorker({
      mode: "chat",
      selectedProducts,
      routine: currentRoutine,
      conversationHistory
    });

    const reply = data.reply || "I couldn't generate a response.";
    addMessage("assistant", reply);

    conversationHistory.push({
      role: "assistant",
      content: reply
    });
  } catch (error) {
    console.error(error);
    addMessage(
      "assistant",
      "Sorry — I couldn't respond right now. Make sure your Worker is set up correctly."
    );
  }
}

productsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const productId = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === "select") {
    toggleProductSelection(productId);
  }

  if (action === "details") {
    const description = document.getElementById(`desc-${productId}`);
    if (description) {
      description.classList.toggle("show");
    }
  }
});

selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-id]");
  if (!removeButton) return;

  const productId = Number(removeButton.dataset.removeId);
  removeSelectedProduct(productId);
});

categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);

clearSelectionsBtn.addEventListener("click", () => {
  clearSelections();
  addMessage("assistant", "Your selected products have been cleared.");
});

generateRoutineBtn.addEventListener("click", async () => {
  conversationHistory = [
    {
      role: "system",
      content:
        "You are a helpful L'Oréal beauty advisor. Build routines only from the selected products. Be clear, safe, and organized. You may answer follow-up questions only about the routine, skincare, haircare, makeup, fragrance, and related beauty topics."
    }
  ];

  await generateRoutine();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const messageText = userInput.value.trim();
  if (!messageText) return;

  userInput.value = "";

  if (!currentRoutine) {
    addMessage(
      "assistant",
      "Generate a routine first, then ask follow-up questions about it."
    );
    return;
  }

  await handleUserChat(messageText);
});

rtlToggle.addEventListener("change", () => {
  const enabled = rtlToggle.checked;
  document.body.classList.toggle("rtl", enabled);
  document.documentElement.setAttribute("dir", enabled ? "rtl" : "ltr");
  saveRTLMode(enabled);
});

loadSelections();
loadRTLMode();
loadProducts();