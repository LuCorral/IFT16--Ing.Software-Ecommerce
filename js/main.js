// ========== VARIABLES GLOBALES ==========
let allProducts = [];
let accumulatedProducts = [];
let currentCategory = 'all';
let currentProductsPage = 1;
let productsPagination = null;
let productNameSearch = '';
let productRequestId = 0;
let productSort = '';
let cartPricesReady = false;

let isLoadingProducts = false;
const PRODUCTS_PAGE_LIMIT = 10;

// ========== FUNCIONES DE UTILIDAD ==========
function showNotification(message, tipo = 'success') {
  let notification = document.getElementById('notification');

  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    document.body.appendChild(notification);
  }

  notification.className = 'notification';
  notification.classList.add(
    tipo === 'error' ? 'notif-error' : 'notif-success',
  );
  notification.textContent = message;
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 2500);
}

function getCart() {
  return JSON.parse(localStorage.getItem('cart')) || [];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function clearAppliedCoupon() {
  sessionStorage.removeItem('cuponAplicado');
  sessionStorage.removeItem('cuponDescuento');

  const couponMessage = document.getElementById('coupon-message');
  if (couponMessage) {
    couponMessage.textContent = '';
    couponMessage.className = 'coupon-message';
  }
  updateCartSummary();
}

function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function formatOrderCurrency(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function updateCartSummary() {
  const subtotalElement = document.getElementById('cart-subtotal');
  const discountElement = document.getElementById('cart-discount');
  const totalElement = document.getElementById('cart-total');
  if (!cartPricesReady) {
    if (subtotalElement) subtotalElement.textContent = '—';
    if (discountElement) discountElement.textContent = '—';
    if (totalElement) totalElement.textContent = '—';
    return;
  }

  const subtotal = roundMoney(getCart().reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0,
  ));
  const discountPercent = Number(sessionStorage.getItem('cuponDescuento')) || 0;
  const discount = roundMoney(subtotal * discountPercent / 100);

  if (subtotalElement) subtotalElement.textContent = `$${subtotal.toLocaleString('es-AR')}`;
  if (discountElement) discountElement.textContent = `-$${discount.toLocaleString('es-AR')}`;
  if (totalElement) totalElement.textContent = `$${roundMoney(subtotal - discount).toLocaleString('es-AR')}`;
}

async function synchronizeCartPrices() {
  const cart = getCart();
  let changed = false;
  const updatedCart = await Promise.all(cart.map(async (item) => {
    const response = await fetch(`/api/productos/${encodeURIComponent(item.id)}`);
    const product = await response.json();
    if (!response.ok) {
      throw new Error(product.error || `No se pudo validar ${item.name || 'un producto'} en el catálogo`);
    }

    const price = Number(product.price ?? product.precio);
    const stock = Number(product.stock);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      throw new Error(`El producto ${product.name || product.nombre || item.name} tiene datos de precio o stock inválidos`);
    }

    if (price !== Number(item.price) || stock !== Number(item.stock)) changed = true;
    return {
      ...item,
      id: product.id,
      name: product.name || product.nombre,
      price,
      stock,
      image: product.image || item.image,
    };
  }));

  localStorage.setItem('cart', JSON.stringify(updatedCart));
  return changed;
}

async function refreshCartSummary() {
  const couponCode = sessionStorage.getItem('cuponAplicado');
  const previousDiscount = sessionStorage.getItem('cuponDescuento');
  sessionStorage.removeItem('cuponDescuento');

  const pricesChanged = await synchronizeCartPrices();
  cartPricesReady = true;
  renderCart();

  if (!getCart().length) {
    clearAppliedCoupon();
    return { changed: pricesChanged };
  }

  if (couponCode) {
    const couponInput = document.getElementById('coupon-code');
    if (couponInput) couponInput.value = couponCode;
    const couponApplied = await applyCoupon(couponCode);
    const currentDiscount = sessionStorage.getItem('cuponDescuento');
    return {
      changed: pricesChanged || !couponApplied || currentDiscount !== previousDiscount,
    };
  }

  updateCartSummary();
  return { changed: pricesChanged };
}

function showPurchaseConfirmation(data, cart) {
  let modal = document.getElementById('purchase-confirmation-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'purchase-confirmation-modal';
    modal.className = 'purchase-modal-overlay';
    document.body.appendChild(modal);
  }

  const pedido = data.pedido || {};
  const totalFinal = Number(data.total ?? pedido.total ?? 0);
  const totalItems = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const orderCode = pedido.id ? `PED-${pedido.id}` : `PED-${Date.now().toString().slice(-8)}`;

  modal.innerHTML = `
    <div class="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
      <div class="purchase-modal-icon"><i class="fa-solid fa-check"></i></div>
      <h2 id="purchase-title">Compra confirmada</h2>
      <p class="purchase-modal-copy">Tu pedido se creó correctamente.</p>
      <div class="purchase-summary">
        <div><span>Orden</span><strong>${orderCode}</strong></div>
        <div><span>Productos</span><strong>${totalItems}</strong></div>
        <div><span>Total</span><strong>$${totalFinal.toLocaleString('es-AR')}</strong></div>
      </div>
      <div class="purchase-modal-actions">
        <button type="button" class="btn-buy" id="purchase-home">Ir al inicio</button>
        <button type="button" class="btn-empty" id="purchase-continue">Seguir comprando</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
  document.body.classList.add('modal-open');

  document.getElementById('purchase-home')?.addEventListener('click', () => {
    window.location.href = '/index.html';
  });

  document.getElementById('purchase-continue')?.addEventListener('click', () => {
    window.location.href = '/html/productos.html';
  });
}

function saveCart(cart, options = {}) {
  const couponWasApplied = Boolean(sessionStorage.getItem('cuponAplicado'));
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();

  if (options.clearCoupon !== false) {
    clearAppliedCoupon();
    if (couponWasApplied) {
      const couponMessage = document.getElementById('coupon-message');
      if (couponMessage) {
        couponMessage.textContent = 'El carrito cambió. Aplicá nuevamente el cupón para actualizar el descuento.';
        couponMessage.className = 'coupon-message info';
      }
    }
  }
}

function updateCartCount() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('#cart-count').forEach((el) => {
    if (el) el.textContent = totalItems;
  });
}

// ========== FUNCIONES DEL CARRITO ==========
function addToCart(producto, cantidad = 1) {
  const stock = Number(producto.stock) || 0;
  const quantityToAdd = Number(cantidad);

  if (stock <= 0 || !Number.isInteger(quantityToAdd) || quantityToAdd <= 0 || quantityToAdd > stock) {
    showNotification(`✕ ${producto.name} no tiene stock`, 'error');
    return;
  }

  let cart = getCart();
  const existingProduct = cart.find((item) => item.id === producto.id);

  if (existingProduct) {
    existingProduct.stock = stock;
    if (existingProduct.quantity + quantityToAdd > stock) {
      showNotification(`✕ No hay más stock de ${producto.name}`, 'error');
      return;
    }
    existingProduct.quantity += quantityToAdd;
  } else {
    cart.push({
      id: producto.id,
      name: producto.name,
      price: producto.price,
      image: producto.image || '/img/placeholder.png',
      stock: stock,
      quantity: quantityToAdd,
    });
  }

  saveCart(cart);
  showNotification(`✓ ${producto.name} añadido al carrito`);

  if (document.getElementById('cart-items')) {
    renderCart();
  }
}

function handleAddToCart(event) {
  const button = event.target.closest('.btn-add');
  if (!button) return;

  if (button.disabled) {
    showNotification('Producto sin stock', 'error');
    return;
  }

  const producto = {
    id: parseInt(button.dataset.id),
    name: button.dataset.name,
    price: parseFloat(button.dataset.price),
    image: button.dataset.image,
    stock: parseInt(button.dataset.stock),
    quantity: parseInt(button.dataset.quantity) || 1,
  };

  if (producto.id && producto.name) {
    addToCart(producto, producto.quantity);
  }
}

function bindAddToCartButtons() {
  document.querySelectorAll('.btn-add').forEach((btn) => {
    btn.removeEventListener('click', handleAddToCart);
    btn.addEventListener('click', handleAddToCart);
  });
}

// ========== FUNCIONES DE PRODUCTOS ==========
function normalizeProductsResponse(payload) {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      metadata: {
        totalItems: payload.length,
        totalPages: 1,
        currentPage: 1,
        limit: payload.length,
        currentItems: payload.length,
        fromItem: payload.length ? 1 : 0,
        toItem: payload.length,
        hasPreviousPage: false,
        hasNextPage: false,
        previousPage: null,
        nextPage: null,
      },
    };
  }

  return {
    data: payload?.items || payload?.data || [],
    metadata: payload?.pagination || payload?.metadata || {},
  };
}

function displayFilteredProducts(products) {
  const productsList = document.getElementById('products-list');
  if (!productsList) return;

  const filtered =
    currentCategory === 'all'
      ? products
      : products.filter((p) => (p.categoria || p.category) === currentCategory);

  if (filtered.length === 0) {
    productsList.innerHTML =
      '<p class="empty-message">No hay productos en esta categoría</p>';
    return;
  }

  productsList.innerHTML = '';

  filtered.forEach((product) => {
    const nombre = product.name || product.nombre;
    const precio = Number(product.price || product.precio || 0);
    const imagen = product.image || product.imagen || '/img/placeholder.png';
    const stock = Number(product.stock) || 0;
    const sinStock = stock <= 0;
    const nombreSeguro = escapeHtml(nombre);
    const imagenSegura = escapeHtml(imagen);

    const card = document.createElement('div');
    card.className = `product-card ${sinStock ? 'out-of-stock' : ''}`;
    card.innerHTML = `
      <div class="product-image">
        <img src="${imagenSegura}" alt="${nombreSeguro}" onerror="this.src='/img/placeholder.png'">
      </div>
      <p class="product-category">${escapeHtml(product.categoria || product.category || 'Sin categoría')}</p>
      <h3>${nombreSeguro}</h3>
      <p class="price">$${precio.toLocaleString('es-AR')}</p>
      <div class="stock-info">
        ${sinStock ? '<span class="sin-stock">Sin stock</span>' : `<span class="con-stock">Stock: ${stock}</span>`}
      </div>
      <button type="button" class="btn-product-detail" data-product-id="${escapeHtml(product.id)}">Ver detalle</button>
      <button class="btn-add" data-id="${escapeHtml(product.id)}" data-name="${nombreSeguro}"
          data-price="${precio}" data-image="${imagenSegura}" data-stock="${stock}" ${sinStock ? 'disabled' : ''}>
        <i class="fa-solid fa-cart-plus"></i> ${sinStock ? 'Agotado' : 'Agregar al carrito'}
      </button>
    `;
    productsList.appendChild(card);
  });

  bindAddToCartButtons();
  document.querySelectorAll('.btn-product-detail').forEach((button) => {
    button.addEventListener('click', () => openProductDetail(button.dataset.productId));
  });
}

async function openProductDetail(productId) {
  try {
    const response = await fetch(`/api/productos/${encodeURIComponent(productId)}`);
    if (!response.ok) throw new Error('No se pudo cargar el producto');
    const product = await response.json();
    let modal = document.getElementById('product-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'product-detail-modal';
      modal.className = 'product-detail-overlay';
      document.body.appendChild(modal);
    }

    const name = escapeHtml(product.name || product.nombre);
    const image = escapeHtml(product.image || '/img/placeholder.png');
    const description = escapeHtml(product.descripcion || 'Sin descripción disponible.');
    const price = Number(product.price ?? product.precio ?? 0);
    const stock = Number(product.stock) || 0;
    modal.innerHTML = `
      <section class="product-detail" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
        <button type="button" class="product-detail-close" aria-label="Cerrar detalle">&times;</button>
        <img src="${image}" alt="${name}" onerror="this.src='/img/placeholder.png'">
        <div>
          <p class="detail-category">${escapeHtml(product.categoria || 'Sin categoría')}</p>
          <h2 id="product-detail-title">${name}</h2>
          <p>${description}</p>
          <p class="price">$${price.toLocaleString('es-AR')}</p>
          <p>Stock disponible: ${stock}</p>
          <label class="detail-quantity-label" for="detail-quantity">Cantidad</label>
          <div class="detail-quantity-control">
            <button type="button" class="detail-quantity-step" data-step="-1" aria-label="Restar una unidad" disabled>−</button>
            <input id="detail-quantity" type="number" min="1" max="${stock}" value="1" ${stock <= 0 ? 'disabled' : ''}>
            <button type="button" class="detail-quantity-step" data-step="1" aria-label="Sumar una unidad" ${stock <= 1 ? 'disabled' : ''}>+</button>
          </div>
          <button type="button" class="btn-add" data-id="${escapeHtml(product.id)}" data-name="${name}" data-price="${price}" data-image="${image}" data-stock="${stock}" ${stock <= 0 ? 'disabled' : ''}>Agregar al carrito</button>
        </div>
      </section>`;
    modal.classList.add('active');
    modal.querySelector('.product-detail-close').addEventListener('click', () => modal.classList.remove('active'));
    const quantityInput = modal.querySelector('#detail-quantity');
    modal.querySelectorAll('.detail-quantity-step').forEach((button) => {
      button.addEventListener('click', () => {
        const next = Number(quantityInput.value) + Number(button.dataset.step);
        quantityInput.value = Math.max(1, Math.min(stock, next));
        modal.querySelector('[data-step="-1"]').disabled = Number(quantityInput.value) <= 1;
        modal.querySelector('[data-step="1"]').disabled = Number(quantityInput.value) >= stock;
      });
    });
    modal.onclick = (event) => {
      if (event.target === modal) modal.classList.remove('active');
    };
    modal.querySelector('.btn-add').addEventListener('click', (event) => {
      event.currentTarget.dataset.quantity = String(Math.min(stock, Math.max(1, Number(quantityInput.value) || 1)));
      handleAddToCart(event);
      modal.classList.remove('active');
    });
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

function renderProductsPagination(metadata) {
  const productsList = document.getElementById('products-list');
  if (!productsList) return;

  let pagination = document.getElementById('products-pagination');
  if (!pagination) {
    pagination = document.createElement('div');
    pagination.id = 'products-pagination';
    pagination.className = 'pagination-container';
    productsList.insertAdjacentElement('afterend', pagination);
  }

  // Si no hay siguiente página, no mostrar botón
  if (!metadata || !metadata.hasNextPage) {
    pagination.innerHTML = '';
    return;
  }

  const currentPage = Number(metadata.page || metadata.currentPage) || 1;
  const limit = Number(metadata.limit) || PRODUCTS_PAGE_LIMIT;
  const totalItems = Number(metadata.totalItems) || 0;
  const fromItem = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const toItem = Math.min(currentPage * limit, totalItems);

  pagination.innerHTML = `
    <button class="pagination-btn btn-load-more" data-page="${currentPage + 1}">
      <i class="fa-solid fa-arrow-down"></i> Cargar más
    </button>
    <span class="pagination-info">
      Mostrando ${fromItem}-${toItem} de ${totalItems}
    </span>
  `;

  pagination.querySelectorAll('.btn-load-more').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = Number(btn.dataset.page);
      if (page > 0) loadProductsPage(page);
    });
  });
}

function createCategoryFilterButton(label, category) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `filter-btn ${currentCategory === category ? 'active' : ''}`;
  button.dataset.category = category;
  button.textContent = label;
  return button;
}

function bindCategoryFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll('.filter-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      loadProductsPage(1);
    };
  });
}

async function loadProductCategories() {
  const filtersContainer = document.getElementById('category-filters');
  if (!filtersContainer) return;

  try {
    const response = await fetch('/api/categorias');
    if (!response.ok) throw new Error('Error al cargar categorías');

    const categorias = await response.json();
    filtersContainer.innerHTML = '';
    filtersContainer.appendChild(createCategoryFilterButton('Todos', 'all'));

    categorias.forEach((categoria) => {
      filtersContainer.appendChild(
        createCategoryFilterButton(categoria, categoria),
      );
    });
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }

  bindCategoryFilterButtons();
}

async function loadProductsPage(page = 1) {
  const productsList = document.getElementById('products-list');
  if (!productsList) return;

  const requestId = ++productRequestId;
  isLoadingProducts = true;

  try {
    currentProductsPage = Math.max(Number(page) || 1, 1);
    
    // Si es la primera página, resetear datos acumulados
    if (currentProductsPage === 1) {
      accumulatedProducts = [];
    }
    
    const params = new URLSearchParams({
      page: currentProductsPage,
      limit: PRODUCTS_PAGE_LIMIT,
    });

    if (currentCategory !== 'all') {
      params.set('categoria', currentCategory);
    }
    if (productNameSearch) params.set('nombre', productNameSearch);
    if (productSort) {
      const [sortBy, sortOrder] = productSort.split(':');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
    }

    // Solo mostrar "Cargando" en la primera página
    if (currentProductsPage === 1) {
      productsList.innerHTML = '<p>Cargando productos...</p>';
    }
    
    const response = await fetch(`/api/productos?${params.toString()}`);

    if (!response.ok) throw new Error('Error al cargar productos');

    const payload = await response.json();
    if (requestId !== productRequestId) return;
    const paginated = normalizeProductsResponse(payload);
    allProducts = paginated.data;
    productsPagination = paginated.metadata;

    if (allProducts.length === 0) {
      if (currentProductsPage === 1) {
        productsList.innerHTML = '<p>No hay productos disponibles</p>';
      }
      renderProductsPagination(productsPagination);
      isLoadingProducts = false;
      return;
    }
    
    // Acumular productos
    accumulatedProducts = accumulatedProducts.concat(allProducts);
    
    bindCategoryFilterButtons();
    displayFilteredProducts(accumulatedProducts);
    renderProductsPagination(productsPagination);
  } catch (error) {
    if (requestId !== productRequestId) return;
    console.error('Error:', error);
    if (currentProductsPage === 1) {
      productsList.innerHTML = `<p class="error">Error: ${escapeHtml(error.message)}</p>`;
    }
    renderProductsPagination(null);
  } finally {
    if (requestId === productRequestId) isLoadingProducts = false;
  }
}

async function loadFeaturedProducts() {
  const container = document.getElementById('featured-products');
  if (!container) return;

  try {
    const response = await fetch('/api/productos?page=1&limit=4');
    const payload = await response.json();
    const products = normalizeProductsResponse(payload).data;
    const destacados = products.slice(0, 4);

    container.innerHTML = '';
    destacados.forEach((product) => {
      const nombre = product.name || product.nombre;
      const precio = Number(product.price || product.precio || 0);
      const imagen = product.image || product.imagen || 'img/placeholder.png';
      const stock = Number(product.stock) || 0;
      const nombreSeguro = escapeHtml(nombre);
      const imagenSegura = escapeHtml(imagen);

      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-image">
          <img src="${imagenSegura}" alt="${nombreSeguro}" onerror="this.src='img/placeholder.png'">
        </div>
        <p class="product-category">${escapeHtml(product.categoria || product.category || 'Sin categoría')}</p>
        <h3>${nombreSeguro}</h3>
        <p class="price">$${precio.toLocaleString('es-AR')}</p>
        <button type="button" class="btn-product-detail" data-product-id="${escapeHtml(product.id)}">Ver detalle</button>
        <button class="btn-add" data-id="${escapeHtml(product.id)}" data-name="${nombreSeguro}"
                data-price="${precio}" data-image="${imagenSegura}" data-stock="${stock}" ${stock <= 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-cart-plus"></i> ${stock <= 0 ? 'Agotado' : 'Agregar al carrito'}
        </button>
      `;
      container.appendChild(card);
    });
    bindAddToCartButtons();
    container.querySelectorAll('.btn-product-detail').forEach((button) => {
      button.addEventListener('click', () => openProductDetail(button.dataset.productId));
    });
  } catch (error) {
    console.error('Error cargando destacados:', error);
  }
}

// ========== FUNCIONES DEL CARRITO (render) ==========
function renderCart() {
  const container = document.getElementById('cart-items');
  if (!container) return;

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = '<p class="empty-cart">Tu carrito está vacío</p>';
    updateCartSummary();
    return;
  }

  container.innerHTML = '';

  cart.forEach((item, index) => {
    const itemName = escapeHtml(item.name);
    const itemImage = escapeHtml(item.image || '../img/placeholder.png');
    const itemPrice = Number(item.price) || 0;
    let itemQuantity = Number(item.quantity) || 1;
    const availableStock = Number(item.stock);
    if (Number.isInteger(availableStock) && availableStock > 0) {
      itemQuantity = Math.min(itemQuantity, availableStock);
      item.quantity = itemQuantity;
    }
    const subtotal = itemPrice * itemQuantity;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'cart-item';
    itemDiv.innerHTML = `
      <img src="${itemImage}" alt="${itemName}" onerror="this.src='../img/placeholder.png'">
      <div class="item-info">
        <h3>${itemName}</h3>
        <p>$${itemPrice.toLocaleString('es-AR')} c/u</p>
      </div>
      <div class="item-controls">
        <button class="btn-qty" data-index="${index}" data-change="-1">-</button>
        <span>${itemQuantity}</span>
        <button class="btn-qty" data-index="${index}" data-change="1" ${itemQuantity >= availableStock ? 'disabled' : ''}>+</button>
        <p class="item-subtotal">$${subtotal.toLocaleString('es-AR')}</p>
      </div>
      <button class="btn-remove" data-index="${index}"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(itemDiv);
  });

  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  updateCartSummary();

  // Eventos
  document.querySelectorAll('.btn-qty').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.dataset.index);
      const change = parseInt(btn.dataset.change);
      let cart = getCart();
      if (cart[idx]) {
        const newQty = cart[idx].quantity + change;
        if (change > 0 && newQty > Number(cart[idx].stock)) {
          showNotification('No hay más stock disponible', 'error');
          return;
        }
        if (newQty <= 0) cart.splice(idx, 1);
        else cart[idx].quantity = newQty;
        saveCart(cart);
        renderCart();
      }
    });
  });

  document.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      let cart = getCart();
      cart.splice(parseInt(btn.dataset.index), 1);
      saveCart(cart);
      renderCart();
    });
  });
}

function emptyCart() {
  if (confirm('¿Vaciar carrito?')) {
    saveCart([]);
    renderCart();
    showNotification('Carrito vaciado');
  }
}

async function applyCoupon(codeOverride = null) {
  const couponInput = document.getElementById('coupon-code');
  const couponMessage = document.getElementById('coupon-message');
  
  if (!couponInput || !couponMessage) return;

  const inputCode = typeof codeOverride === 'string'
    ? codeOverride
    : couponInput.value;
  const code = inputCode.trim().toUpperCase();
  if (typeof codeOverride === 'string') couponInput.value = code;
  if (!code) {
    clearAppliedCoupon();
    couponMessage.textContent = 'Por favor ingresa un código de cupón';
    couponMessage.className = 'coupon-message error';
    return false;
  }

  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  if (total === 0) {
    clearAppliedCoupon();
    couponMessage.textContent = 'Tu carrito está vacío';
    couponMessage.className = 'coupon-message error';
    return false;
  }

  try {
    const response = await fetch(`/api/cupones/aplicar/${encodeURIComponent(code)}?monto=${total}`);
    const data = await response.json();

    if (!response.ok) {
      clearAppliedCoupon();
      couponMessage.textContent = data.mensaje || 'Cupón inválido';
      couponMessage.className = 'coupon-message error';
      return false;
    }

    const discountPercent = Number(data.descuento);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      throw new Error('El servidor devolvió un descuento inválido');
    }
    sessionStorage.setItem('cuponAplicado', data.codigo);
    sessionStorage.setItem('cuponDescuento', String(discountPercent));
    const descuento = roundMoney(total * discountPercent / 100);
    couponMessage.textContent = `✓ Cupón aplicado: ${data.codigo} | Descuento: -$${descuento.toLocaleString('es-AR')}`;
    couponMessage.className = 'coupon-message success';
    updateCartSummary();
    return true;
  } catch (error) {
    clearAppliedCoupon();
    couponMessage.textContent = 'Error al validar cupón: ' + error.message;
    couponMessage.className = 'coupon-message error';
    updateCartSummary();
    return false;
  }
}

async function loadUserOrders() {
  const container = document.getElementById('orders-container');
  if (!container) return;
  const token = localStorage.getItem('token');
  if (!token) {
    container.innerHTML = '<p><a href="/login.html">Iniciá sesión</a> para consultar tus pedidos.</p>';
    return;
  }

  try {
    const response = await fetch('/api/pedidos', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || 'No se pudieron cargar los pedidos');
    if (!data.length) {
      container.innerHTML = '<p>Todavía no tenés pedidos.</p>';
      return;
    }

    container.innerHTML = data.map((order) => {
      const orderId = Number(order.id);
      const status = String(order.estado || '');
      const normalizedStatus = status.toLowerCase();
      const isPending = normalizedStatus === 'pendiente';
      const isClient = localStorage.getItem('userRole') === 'client';
      const items = (order.detalles || []).map((detail) => `
        <li>
          <span>${escapeHtml(detail.nombreProducto)} x ${Number(detail.cantidad)}</span>
          <span>${formatOrderCurrency(detail.subtotal)}</span>
        </li>
      `).join('');
      const statusClass = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'].includes(normalizedStatus)
        ? `is-${normalizedStatus}`
        : 'is-other';
      return `<article class="order-item">
        <div class="order-heading">
          <h3>Pedido #${orderId}</h3>
          <p>${escapeHtml(order.fecha)}</p>
          <span class="order-status ${statusClass}">${escapeHtml(status || 'Sin estado')}</span>
        </div>
        <ul>${items}</ul>
        <div class="order-summary">
          <strong>Total: ${formatOrderCurrency(order.total)}</strong>
          ${isPending && isClient ? `<div class="order-payment-actions">
            <p class="payment-demo-note">Pago simulado: no se realiza ningún cargo real.</p>
            <label>Método
              <select data-payment-method="${orderId}">
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </label>
            <label><input type="checkbox" data-payment-rejection="${orderId}"> Simular rechazo</label>
            <button type="button" class="btn-pay-order" data-pay-order="${orderId}">Pagar</button>
          </div>` : ''}
          ${['pagado', 'enviado', 'entregado'].includes(normalizedStatus) ? `<button type="button" class="btn-receipt" data-receipt-order="${orderId}">Ver comprobante</button>` : ''}
          ${isPending ? `<button type="button" class="btn-cancel-order" data-cancel-order="${orderId}">Cancelar pedido</button>` : ''}
        </div>
      </article>`;
    }).join('');
    container.querySelectorAll('[data-pay-order]').forEach((button) => {
      button.addEventListener('click', () => payOrder(button.dataset.payOrder, button));
    });
    container.querySelectorAll('[data-receipt-order]').forEach((button) => {
      button.addEventListener('click', () => viewReceipt(button.dataset.receiptOrder));
    });
    container.querySelectorAll('[data-cancel-order]').forEach((button) => {
      button.addEventListener('click', () => cancelOrder(button.dataset.cancelOrder, button));
    });
  } catch (error) {
    container.innerHTML = `<p class="error-message">${escapeHtml(error.message)}</p>`;
  }
}

async function payOrder(orderId, button) {
  const safeOrderId = Number(orderId);
  const method = document.querySelector(`[data-payment-method="${safeOrderId}"]`)?.value;
  const simulateRejection = document.querySelector(`[data-payment-rejection="${safeOrderId}"]`)?.checked;
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Iniciá sesión para pagar pedidos', 'error');
    return;
  }
  if (button) button.disabled = true;

  try {
    const response = await fetch(`/api/pedidos/${encodeURIComponent(orderId)}/pagar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        metodo: method,
        resultadoSimulado: simulateRejection ? 'rechazado' : 'aprobado',
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo procesar el pago');
    showNotification(data.mensaje, data.pago.estado === 'Rechazado' ? 'error' : 'success');
    await loadUserOrders();
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function viewReceipt(orderId) {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Iniciá sesión para consultar el comprobante', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/pedidos/${encodeURIComponent(orderId)}/comprobante`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const receipt = await response.json();
    if (!response.ok) throw new Error(receipt.mensaje || 'No se pudo cargar el comprobante');

    const rows = receipt.productos.map((item) => `
      <tr>
        <td>${escapeHtml(item.nombreProducto)}</td>
        <td>${Number(item.cantidad)}</td>
        <td>${formatOrderCurrency(item.precioUnitario)}</td>
        <td>${formatOrderCurrency(item.subtotal)}</td>
      </tr>
    `).join('');
    const modal = document.createElement('div');
    modal.className = 'receipt-modal-overlay';
    modal.innerHTML = `
      <section class="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <button type="button" class="receipt-close" aria-label="Cerrar">&times;</button>
        <h2 id="receipt-title">Comprobante ${escapeHtml(receipt.numero)}</h2>
        <p><strong>${escapeHtml(receipt.tipo || 'Comprobante no fiscal')} · Pago simulado</strong></p>
        <p>Pedido #${Number(receipt.pedidoId)} · ${escapeHtml(new Date(receipt.fecha).toLocaleDateString('es-AR'))}</p>
        <p>Cliente: ${escapeHtml(receipt.cliente)}</p>
        <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p>Subtotal: ${formatOrderCurrency(receipt.subtotal)}</p>
        <p>Descuento: -${formatOrderCurrency(receipt.descuento)}${receipt.cupon ? ` (${escapeHtml(receipt.cupon)})` : ''}</p>
        <p><strong>Total pagado: ${formatOrderCurrency(receipt.total)}</strong></p>
        <p>Método: ${escapeHtml(receipt.metodoPago)} · Pago: ${escapeHtml(receipt.estadoPago)}</p>
        <button type="button" class="btn-buy receipt-print">Imprimir comprobante</button>
      </section>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.receipt-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
    modal.querySelector('.receipt-print').addEventListener('click', () => window.print());
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function cancelOrder(orderId, button) {
  if (!confirm(`¿Cancelar el pedido #${orderId}?`)) return;
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Iniciá sesión para cancelar pedidos', 'error');
    return;
  }

  if (button) button.disabled = true;
  try {
    const response = await fetch(`/api/pedidos/${encodeURIComponent(orderId)}/cancelar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo cancelar el pedido');
    showNotification(data.mensaje);
    await loadUserOrders();
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function checkout() {
  if (!getCart().length) {
    showNotification('El carrito está vacío', 'error');
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html?reason=checkout&returnTo=%2Fhtml%2Fcart.html';
    return;
  }

  const checkoutButton = document.getElementById('btn-checkout');
  if (checkoutButton) {
    checkoutButton.disabled = true;
    checkoutButton.textContent = 'Creando pedido...';
  }

  try {
    const hadCurrentPrices = cartPricesReady;
    cartPricesReady = false;
    const summaryRefresh = await refreshCartSummary();
    if (summaryRefresh.changed && hadCurrentPrices) {
      showNotification('Se actualizaron precios, stock o descuento. Revisá el total y confirmá nuevamente.', 'error');
      return;
    }

    const cart = getCart();
    if (!cart.length) {
      showNotification('El carrito está vacío', 'error');
      return;
    }

    const response = await fetch('/api/pedidos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productos: cart.map((item) => ({ productoId: Number(item.id), cantidad: Number(item.quantity) })),
        ...(sessionStorage.getItem('cuponAplicado')
          ? { cupon: sessionStorage.getItem('cuponAplicado') }
          : {}),
      }),
    });
    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      clearUserSession();
      window.location.href = '/login.html?reason=checkout&returnTo=%2Fhtml%2Fcart.html';
      return;
    }
    if (!response.ok) {
      const errorMessage = data.mensaje || 'No se pudo crear el pedido';
      if (sessionStorage.getItem('cuponAplicado') && /cup[oó]n/i.test(errorMessage)) {
        clearAppliedCoupon();
        const couponMessage = document.getElementById('coupon-message');
        if (couponMessage) {
          couponMessage.textContent = errorMessage;
          couponMessage.className = 'coupon-message error';
        }
      }
      throw new Error(errorMessage);
    }

    saveCart([]);
    renderCart();
    await loadUserOrders();
    showPurchaseConfirmation(data, cart);
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    if (checkoutButton) {
      checkoutButton.disabled = false;
      checkoutButton.textContent = 'Crear pedido';
    }
  }
}

// ========== LOGIN Y REGISTRO ==========
function switchAuth(view) {
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const showRegister = view === 'register';

  if (!showRegister) {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  } else {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
  }

  loginForm.hidden = showRegister;
  registerForm.hidden = !showRegister;
}

// Inicializar formularios de login/registro
function initAuthForms() {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value;
      const password = document.getElementById('login-password')?.value;

      if (!email || !password) {
        showNotification('Completa todos los campos', 'error');
        return;
      }

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok)
          throw new Error(
            data.message || data.mensaje || 'Error al iniciar sesión',
          );

        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userSurname', data.user.apellido || '');

        showNotification('¡Bienvenido!');

        setTimeout(() => {
          const returnTo = new URLSearchParams(window.location.search).get('returnTo');
          if (returnTo === '/html/cart.html') {
            window.location.href = returnTo;
          } else if (data.user.role === 'admin') {
            window.location.href = '/admin.html';
          } else {
            window.location.href = '/index.html';
          }
        }, 1000);
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name')?.value.trim();
      const apellido = document.getElementById('reg-apellido')?.value.trim();
      const email = document.getElementById('reg-email')?.value.trim();
      const password = document.getElementById('reg-password')?.value;

      if (!name || !apellido || !email || !password) {
        showNotification('Completá nombre, apellido, email y contraseña', 'error');
        return;
      }

      if (password.length < 8) {
        showNotification('La contraseña debe tener al menos 8 caracteres', 'error');
        return;
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, apellido, email, password }),
        });

        const data = await response.json();

        if (!response.ok)
          throw new Error(
            data.message || data.mensaje || 'Error al registrarse',
          );

        showNotification('Registro exitoso. Ahora inicia sesión.');
        document.getElementById('login-email').value = email;
        switchAuth('login');
        registerForm.reset();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  }
}

function updateAuthNavigation() {
  const adminItem = document.getElementById('auth-admin-item');
  const loginItem = document.getElementById('auth-login-item');
  const sessionItem = document.getElementById('auth-session-item');
  const profileItem = document.getElementById('auth-profile-item');
  const greeting = document.getElementById('nav-user-greeting');
  const logoutButton = document.getElementById('btn-nav-logout');
  if (!loginItem || !sessionItem || !greeting || !logoutButton) return;

  const isAuthenticated = Boolean(localStorage.getItem('token'));
  if (profileItem) profileItem.hidden = !isAuthenticated;
  if (adminItem) {
    adminItem.hidden = !isAuthenticated || localStorage.getItem('userRole') !== 'admin';
  }
  loginItem.hidden = isAuthenticated;
  sessionItem.hidden = !isAuthenticated;

  const name = [localStorage.getItem('userName'), localStorage.getItem('userSurname')]
    .filter(Boolean)
    .join(' ')
    .trim();
  greeting.textContent = name ? `Hola, ${name}` : 'Sesión iniciada';
}

async function loadUserProfile() {
  const container = document.getElementById('profile-content');
  if (!container) return;

  const token = localStorage.getItem('token');
  if (!token) {
    container.innerHTML = '<p><a href="/login.html">Iniciá sesión</a> para ver tu perfil.</p>';
    return;
  }

  try {
    const response = await fetch('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      clearUserSession();
      container.innerHTML = '<p>Tu sesión venció. <a href="/login.html">Iniciá sesión</a> para ver tu perfil.</p>';
      return;
    }
    if (!response.ok) throw new Error(data.message || 'No se pudo cargar el perfil');

    container.innerHTML = `
      <dl class="profile-details">
        <div><dt>Nombre</dt><dd>${escapeHtml(data.user.name)}</dd></div>
        <div><dt>Apellido</dt><dd>${escapeHtml(data.user.apellido)}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(data.user.email)}</dd></div>
      </dl>
    `;
  } catch (error) {
    container.innerHTML = `<p class="error-message">${escapeHtml(error.message)}</p>`;
  }
}

function clearUserSession() {
  ['token', 'userRole', 'userName', 'userSurname'].forEach((key) => {
    localStorage.removeItem(key);
  });
  updateAuthNavigation();
}

window.clearUserSession = clearUserSession;

// ========== LOGOUT ==========
function logoutUsuario() {
  const token = localStorage.getItem('token');
  const cart = getCart();

  if (token && cart.length > 0) {
    try {
      fetch('/api/clientes/carrito', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ carrito: cart }),
        keepalive: true,
      }).catch((error) => {
        console.error('Error guardando carrito antes de cerrar sesión:', error);
      });
    } catch (error) {
      console.error('Error guardando carrito:', error);
    }
  }

  clearUserSession();
  showNotification('Sesión cerrada');
  window.location.replace('/index.html');
}

window.logoutCurrentUser = logoutUsuario;

// ========== MANEJO DEL FORMULARIO DE CONTACTO (PRESENTACIÓN) ==========
document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.querySelector('.contact-form');
  
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      // 1. Evitamos que la página se recargue por defecto
      e.preventDefault(); 
      
      // 2. Capturamos el nombre para personalizar la respuesta
      const nombreUsuario = document.getElementById('name')?.value || 'Gracias';

      // 3. Mostramos un mensaje estético usando tu función de notificaciones
      if (typeof showNotification === 'function') {
        showNotification(`¡Gracias, ${nombreUsuario}! Tu mensaje ha sido enviado. Te responderemos a la brevedad.`, 'success');
      } else {
        // Respaldo por si la función de notificación no se llega a cargar
        alert(`¡Gracias, ${nombreUsuario}! Tu mensaje ha sido enviado con éxito. Nos comunicaremos a la brevedad.`);
      }

      // 4. Limpiamos los campos del formulario para que quede listo de nuevo
      contactForm.reset();
    });
  }
});

// ========== ADMIN PANEL ==========
async function loadAdminProducts() {
  const container = document.querySelector('#admin-products .admin-card');
  if (!container) return;

  try {
    const response = await fetch('/api/productos?page=1&limit=100');
    const payload = await response.json();
    const products = normalizeProductsResponse(payload).data;

    if (!products.length) {
      container.innerHTML = '<p>No hay productos</p>';
      return;
    }

    let html =
      '<div class="admin-table-container"><table class="admin-table"><thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th></tr></thead><tbody>';

    products.forEach((p) => {
      const nombre = p.name || p.nombre;
      const precio = Number(p.price || p.precio || 0);
      html += `
        <tr>
          <td>${escapeHtml(p.id)}</td>
          <td>${escapeHtml(nombre)}</td>
          <td>$${precio}</td>
          <td>${escapeHtml(p.stock)}</td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<p>Error: ${escapeHtml(error.message)}</p>`;
  }
}

function openAdminModal(type) {
  const modal = document.getElementById('admin-modal');
  const container = document.getElementById('modal-form-content');
  if (!modal || !container) return;

  container.innerHTML = `
    <h2>${type === 'product' ? 'Nuevo Producto' : 'Nuevo Cliente'}</h2>
    <form id="admin-form">
      <input type="text" id="name" placeholder="Nombre" required>
      <input type="number" id="price" placeholder="Precio" required>
      <input type="number" id="stock" placeholder="Stock" required>
      <input type="text" id="category" placeholder="Categoría">
      <button type="submit">Guardar</button>
    </form>
  `;

  const form = document.getElementById('admin-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      nombre: document.getElementById('name').value,
      precio: parseFloat(document.getElementById('price').value),
      stock: parseInt(document.getElementById('stock').value),
      categoria: document.getElementById('category').value,
    };

    try {
      const response = await fetch('/api/productos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token')
            ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
            : {}),
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        showNotification('Producto creado');
        closeAdminModal();
        loadAdminProducts();
      }
    } catch (error) {
      showNotification('Error', 'error');
    }
  });

  modal.classList.add('active');
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.remove('active');
}

window.deleteProduct = async (id) => {
  if (!confirm('¿Eliminar producto?')) return;
  try {
    await fetch(`/api/productos/${id}`, {
      method: 'DELETE',
      headers: localStorage.getItem('token')
        ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
        : {},
    });
    showNotification('Producto eliminado');
    loadAdminProducts();
  } catch (error) {
    showNotification('Error', 'error');
  }
};

function switchAdminView(view) {
  const productsSec = document.getElementById('admin-products');
  const customersSec = document.getElementById('admin-customers');
  const prodBtn = document.getElementById('nav-prod');
  const custBtn = document.getElementById('nav-cust');

  if (view === 'products') {
    productsSec.classList.add('active');
    customersSec.classList.remove('active');
    prodBtn.classList.add('active');
    custBtn.classList.remove('active');
    loadAdminProducts();
  } else {
    customersSec.classList.add('active');
    productsSec.classList.remove('active');
    custBtn.classList.add('active');
    prodBtn.classList.remove('active');
  }
}

// ========== MENÚ HAMBURGUESA ==========
function initHamburgerMenu() {
  const hamburger = document.getElementById('hamburger-menu');
  const navMenu = document.getElementById('nav-menu');

  if (!hamburger || !navMenu) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar menú
  initHamburgerMenu();
  updateAuthNavigation();
  document.getElementById('btn-nav-logout')?.addEventListener('click', logoutUsuario);
  window.addEventListener('pageshow', updateAuthNavigation);

  // Actualizar contador del carrito
  updateCartCount();

  // Cargar productos según la página
  if (document.getElementById('products-list')) {
    const productControls = document.getElementById('product-controls');
    productControls?.addEventListener('submit', (event) => {
      event.preventDefault();
      productNameSearch = document.getElementById('product-search')?.value.trim() || '';
      loadProductsPage(1);
    });
    document.getElementById('product-sort')?.addEventListener('change', (event) => {
      productSort = event.currentTarget.value;
      loadProductsPage(1);
    });
    loadProductCategories().finally(() => loadProductsPage());
  }

  if (document.getElementById('featured-products')) {
    loadFeaturedProducts();
  }

  if (document.getElementById('cart-items')) {
    const cartContainer = document.getElementById('cart-items');
    const checkoutButton = document.getElementById('btn-checkout');
    if (cartContainer) cartContainer.innerHTML = '<p>Validando precios actuales...</p>';
    if (checkoutButton) checkoutButton.disabled = true;
    refreshCartSummary()
      .catch((error) => {
        showNotification(error.message, 'error');
        updateCartSummary();
      })
      .finally(() => {
        if (checkoutButton) checkoutButton.disabled = false;
      });
  }

  if (document.getElementById('profile-content')) {
    loadUserProfile();
  }

  if (document.getElementById('orders-container')) {
    if (localStorage.getItem('userRole') === 'admin') {
      const ordersTitle = document.getElementById('orders-title');
      if (ordersTitle) ordersTitle.textContent = 'Gestión de pedidos';
    }
    loadUserOrders();
  }

  if (
    document.getElementById('admin-products') &&
    !document.querySelector('.admin-body')
  ) {
    loadAdminProducts();
  }

  // Inicializar formularios de auth
  initAuthForms();
  if (new URLSearchParams(window.location.search).get('reason') === 'checkout') {
    showNotification('Iniciá sesión para confirmar tu pedido. Tu carrito se conservó.');
  }

  // Botones del carrito
  const btnEmpty = document.getElementById('btn-empty');
  if (btnEmpty) btnEmpty.addEventListener('click', emptyCart);

  const btnCheckout = document.getElementById('btn-checkout');
  if (btnCheckout) btnCheckout.addEventListener('click', checkout);

  const btnApplyCoupon = document.getElementById('btn-apply-coupon');
  if (btnApplyCoupon) btnApplyCoupon.addEventListener('click', () => applyCoupon());

});
