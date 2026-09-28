// ========== VARIABLES GLOBALES ==========
let allProducts = [];
let accumulatedProducts = [];
let currentCategory = 'all';
let currentProductsPage = 1;
let productsPagination = null;
let productNameSearch = '';
let productSort = { sortBy: 'id', sortOrder: 'asc' };

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
  sessionStorage.removeItem('montoConDescuento');

  const couponMessage = document.getElementById('coupon-message');
  if (couponMessage) {
    couponMessage.textContent = '';
    couponMessage.className = 'coupon-message';
  }
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
      <h2 id="purchase-title">Pedido creado</h2>
      <p class="purchase-modal-copy">El pedido quedó registrado como pendiente.</p>
      <div class="purchase-summary">
        <div><span>Orden</span><strong>${orderCode}</strong></div>
        <div><span>Productos</span><strong>${totalItems}</strong></div>
        <div><span>Total</span><strong>$${totalFinal.toLocaleString('es-AR')}</strong></div>
      </div>
      <div class="purchase-modal-actions">
        <button type="button" class="btn-empty" id="purchase-view-orders">Ver mis pedidos</button>
        <button type="button" class="btn-buy" id="purchase-home">Ir al inicio</button>
        <button type="button" class="btn-empty" id="purchase-continue">Seguir comprando</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
  document.body.classList.add('modal-open');

  document.getElementById('purchase-view-orders')?.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    document.getElementById('orders-container')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('purchase-home')?.addEventListener('click', () => {
    window.location.href = '/index.html';
  });

  document.getElementById('purchase-continue')?.addEventListener('click', () => {
    window.location.href = '/html/productos.html';
  });
}

function saveCart(cart, options = {}) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();

  if (options.clearCoupon !== false) {
    clearAppliedCoupon();
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
function addToCart(producto) {
  const stock = Number(producto.stock) || 0;

  if (stock <= 0) {
    showNotification(`✕ ${producto.name} no tiene stock`, 'error');
    return;
  }

  let cart = getCart();
  const existingProduct = cart.find((item) => item.id === producto.id);

  if (existingProduct) {
    existingProduct.stock = stock;
    if (existingProduct.quantity > stock) existingProduct.quantity = stock;
    if (existingProduct.quantity >= stock) {
      saveCart(cart);
      showNotification(`✕ No hay más stock de ${producto.name}`, 'error');
      return;
    }
    existingProduct.quantity += 1;
  } else {
    cart.push({
      id: producto.id,
      name: producto.name,
      price: producto.price,
      image: producto.image || '/img/placeholder.png',
      stock: stock,
      quantity: 1,
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
  };

  if (producto.id && producto.name) {
    addToCart(producto);
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
      <h3>${nombreSeguro}</h3>
      <p class="price">$${precio.toLocaleString('es-AR')}</p>
      <div class="stock-info">
        ${sinStock ? '<span class="sin-stock">Sin stock</span>' : `<span class="con-stock">Stock: ${stock}</span>`}
      </div>
      <button class="btn-add" data-id="${escapeHtml(product.id)}" data-name="${nombreSeguro}"
              data-price="${precio}" data-image="${imagenSegura}" data-stock="${stock}" ${sinStock ? 'disabled' : ''}>
        <i class="fa-solid fa-cart-plus"></i> ${sinStock ? 'Agotado' : 'Añadir'}
      </button>
      <button type="button" class="btn-product-detail" data-product-id="${escapeHtml(product.id)}">Ver detalle</button>
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
          <button type="button" class="btn-add" data-id="${escapeHtml(product.id)}" data-name="${name}" data-price="${price}" data-image="${image}" data-stock="${stock}" ${stock <= 0 ? 'disabled' : ''}>Agregar al carrito</button>
        </div>
      </section>`;
    modal.classList.add('active');
    modal.querySelector('.product-detail-close').addEventListener('click', () => modal.classList.remove('active'));
    modal.onclick = (event) => {
      if (event.target === modal) modal.classList.remove('active');
    };
    modal.querySelector('.btn-add').addEventListener('click', (event) => {
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

  // Prevenir cargas simultáneas
  if (isLoadingProducts) return;
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
    params.set('sortBy', productSort.sortBy);
    params.set('sortOrder', productSort.sortOrder);

    // Solo mostrar "Cargando" en la primera página
    if (currentProductsPage === 1) {
      productsList.innerHTML = '<p>Cargando productos...</p>';
    }
    
    const response = await fetch(`/api/productos?${params.toString()}`);

    if (!response.ok) throw new Error('Error al cargar productos');

    const payload = await response.json();
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
    console.error('Error:', error);
    if (currentProductsPage === 1) {
      productsList.innerHTML = `<p class="error">Error: ${escapeHtml(error.message)}</p>`;
    }
    renderProductsPagination(null);
  } finally {
    isLoadingProducts = false;
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
        <h3>${nombreSeguro}</h3>
        <p class="price">$${precio.toLocaleString('es-AR')}</p>
        <button class="btn-add" data-id="${escapeHtml(product.id)}" data-name="${nombreSeguro}"
                data-price="${precio}" data-image="${imagenSegura}" data-stock="${stock}" ${stock <= 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-cart-plus"></i> ${stock <= 0 ? 'Agotado' : 'Comprar'}
        </button>
      `;
      container.appendChild(card);
    });
    bindAddToCartButtons();
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
    document.getElementById('cart-total').textContent = '$0';
    return;
  }

  let total = 0;
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
    total += subtotal;

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
  document.getElementById('cart-total').textContent =
    `$${total.toLocaleString('es-AR')}`;

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

async function applyCoupon() {
  const couponInput = document.getElementById('coupon-code');
  const couponMessage = document.getElementById('coupon-message');
  
  if (!couponInput || !couponMessage) return;

  const code = couponInput.value.trim().toUpperCase();
  if (!code) {
    clearAppliedCoupon();
    couponMessage.textContent = 'Por favor ingresa un código de cupón';
    couponMessage.className = 'coupon-message error';
    return;
  }

  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (total === 0) {
    clearAppliedCoupon();
    couponMessage.textContent = 'Tu carrito está vacío';
    couponMessage.className = 'coupon-message error';
    return;
  }

  try {
    const response = await fetch(`/api/cupones/aplicar/${code}?monto=${total}`);
    const data = await response.json();

    if (!response.ok) {
      clearAppliedCoupon();
      couponMessage.textContent = data.mensaje || 'Cupón inválido';
      couponMessage.className = 'coupon-message error';
      return;
    }

    const descuento = data.ahorro || 0;
    const montoFinal = data.monto_final || total;

    couponMessage.textContent = `✓ Cupón aplicado: ${data.codigo} | Descuento: -$${descuento.toLocaleString('es-AR')}`;
    couponMessage.className = 'coupon-message success';

    // CORRECCIÓN: Precio anterior tachado/atenuado y precio nuevo resaltado en verde
    const cartTotalEl = document.getElementById('cart-total');
    if (cartTotalEl) {
      cartTotalEl.innerHTML = `
        <span style="text-decoration: line-through; color: #a0a0a0; font-size: 0.9em; margin-right: 10px;">$${total.toLocaleString('es-AR')}</span>
        <span style="color: #27ae60; font-weight: bold; font-size: 1.2em;">$${montoFinal.toLocaleString('es-AR')}</span>
      `;
    }

    // Guardar el cupón aplicado en sessionStorage para el checkout
    sessionStorage.setItem('cuponAplicado', code);
    sessionStorage.setItem('montoConDescuento', montoFinal);
  } catch (error) {
    clearAppliedCoupon();
    couponMessage.textContent = 'Error al validar cupón: ' + error.message;
    couponMessage.className = 'coupon-message error';
  }
}

async function loadUserOrders() {
  const container = document.getElementById('orders-container');
  if (!container) return;
  const token = localStorage.getItem('token');
  if (!token) {
    container.innerHTML = '<p>Iniciá sesión para consultar tus pedidos.</p>';
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
      const items = (order.detalles || []).map((detail) =>
        `<li>${escapeHtml(detail.nombreProducto)} x ${Number(detail.cantidad)}</li>`).join('');
      const pending = String(order.estado).toLowerCase() === 'pendiente';
      return `<article class="order-item">
        <div><h3>Pedido #${Number(order.id)}</h3><p>${escapeHtml(order.fecha)} · ${escapeHtml(order.estado)}</p></div>
        <ul>${items}</ul><strong>$${Number(order.total).toLocaleString('es-AR')}</strong>
        ${pending ? `<button type="button" class="btn-cancel-order" data-order-id="${Number(order.id)}">Cancelar pedido</button>` : ''}
      </article>`;
    }).join('');
    container.querySelectorAll('.btn-cancel-order').forEach((button) => {
      button.addEventListener('click', () => cancelOrder(button.dataset.orderId));
    });
  } catch (error) {
    container.innerHTML = `<p class="error-message">${escapeHtml(error.message)}</p>`;
  }
}

async function cancelOrder(orderId) {
  if (!confirm(`¿Cancelar el pedido #${orderId}?`)) return;
  const token = localStorage.getItem('token');
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
  }
}

async function checkout() {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Iniciá sesión para crear un pedido', 'error');
    window.location.href = '/html/login.html';
    return;
  }

  const cart = getCart();
  if (!cart.length) {
    showNotification('El carrito está vacío', 'error');
    return;
  }

  const checkoutButton = document.getElementById('btn-checkout');
  if (checkoutButton) {
    checkoutButton.disabled = true;
    checkoutButton.textContent = 'Creando pedido...';
  }

  try {
    const response = await fetch('/api/pedidos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productos: cart.map((item) => ({ productoId: Number(item.id), cantidad: Number(item.quantity) })),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo crear el pedido');

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

  if (view === 'login') {
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
}

// Inicializar formularios de login/registro
function initAuthForms() {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const phoneInput = document.getElementById('reg-telefono');

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '');
    });
  }

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

        showNotification('¡Bienvenido!');

        setTimeout(() => {
          if (data.user.role === 'admin') {
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
      const name = document.getElementById('reg-name')?.value;
      const email = document.getElementById('reg-email')?.value;
      const telefono = document.getElementById('reg-telefono')?.value;
      const password = document.getElementById('reg-password')?.value;
      const terms = document.getElementById('reg-terms')?.checked;

      if (!name || !email || !telefono || !password) {
        showNotification('Completa todos los campos', 'error');
        return;
      }

      if (!/^[0-9]+$/.test(telefono)) {
        showNotification('El teléfono debe contener solo números', 'error');
        return;
      }

      if (!terms) {
        showNotification('Acepta los términos', 'error');
        return;
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, telefono, password }),
        });

        const data = await response.json();

        if (!response.ok)
          throw new Error(
            data.message || data.mensaje || 'Error al registrarse',
          );

        showNotification('Registro exitoso. Ahora inicia sesión.');
        switchAuth('login');
        registerForm.reset();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  }
}

// Actualizar navbar según login
  const token = localStorage.getItem('token');
  const btnLogin = document.getElementById('btn-nav-login');
  const btnLogout = document.getElementById('btn-nav-logout');

  if (token && btnLogin && btnLogout) {
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'block';

    // NUEVO: Mostrar nombre de bienvenida al lado del botón salir
    const userName = localStorage.getItem('userName');
    if (userName) {
      let greetingEl = document.getElementById('nav-user-greeting');
      if (!greetingEl) {
        greetingEl = document.createElement('span');
        greetingEl.id = 'nav-user-greeting';
        greetingEl.style.color = 'white';
        greetingEl.style.marginRight = '10px';
        greetingEl.style.fontSize = '0.9rem';
        greetingEl.style.alignSelf = 'center';
        // Inserta el texto justo antes del botón "Salir"
        btnLogout.parentNode.insertBefore(greetingEl, btnLogout);
      }
      greetingEl.textContent = `Bienvenido, ${userName} | `;
    }
  }

// ========== LOGOUT ==========
async function logoutUsuario() {
  const token = localStorage.getItem('token');
  const cart = getCart();

  if (token && cart.length > 0) {
    try {
      await fetch('/api/clientes/carrito', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ carrito: cart }),
      });
    } catch (error) {
      console.error('Error guardando carrito:', error);
    }
  }

  localStorage.clear();
  showNotification('Sesión cerrada');
  setTimeout(() => (window.location.href = '/index.html'), 1000);
}

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
      '<div class="admin-table-container"><table class="admin-table"><thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr></thead><tbody>';

    products.forEach((p) => {
      const nombre = p.name || p.nombre;
      const precio = Number(p.price || p.precio || 0);
      html += `
        <tr>
          <td>${escapeHtml(p.id)}</td>
          <td>${escapeHtml(nombre)}</td>
          <td>$${precio}</td>
          <td>${escapeHtml(p.stock)}</td>
          <td>
            <button onclick="editProduct(${p.id})">Editar</button>
            <button onclick="deleteProduct(${p.id})">Eliminar</button>
          </td>
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

window.editProduct = async (id) => {
  showNotification('Función en desarrollo');
};

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

function mostrarBotonAdminSiCorresponde() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('userRole');

  if (!token || role !== 'admin') return;
  if (document.getElementById('btn-nav-admin')) return;

  const btnLogout = document.getElementById('btn-nav-logout');
  if (!btnLogout) return;

  const logoutLi = btnLogout.closest('li');
  const navList = logoutLi?.parentElement;

  if (!logoutLi || !navList) return;

  const adminLi = document.createElement('li');
  adminLi.innerHTML = `
    <a href="/html/admin.html" id="btn-nav-admin" style="
      display: inline-block;
      color: white;
      font-weight: 700;
      text-decoration: none;
      padding: 8px 14px;
      border: 1px solid #ff7a21;
      border-radius: 20px;
    ">
      AdminPanel
    </a>
  `;

  navList.insertBefore(adminLi, logoutLi);
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar menú
  initHamburgerMenu();

  // Actualizar contador del carrito
  updateCartCount();

  // Cargar productos según la página
  if (document.getElementById('products-list')) {
    const productControls = document.getElementById('product-controls');
    productControls?.addEventListener('submit', (event) => {
      event.preventDefault();
      productNameSearch = document.getElementById('product-search')?.value.trim() || '';
      const [sortBy, sortOrder] = (document.getElementById('product-sort')?.value || 'id-asc').split('-');
      productSort = { sortBy, sortOrder };
      loadProductsPage(1);
    });
    loadProductCategories().finally(() => loadProductsPage());
  }

  if (document.getElementById('featured-products')) {
    loadFeaturedProducts();
  }

  if (document.getElementById('cart-items')) {
    renderCart();
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

  // Botones del carrito
  const btnEmpty = document.getElementById('btn-empty');
  if (btnEmpty) btnEmpty.addEventListener('click', emptyCart);

  const btnCheckout = document.getElementById('btn-checkout');
  if (btnCheckout) btnCheckout.addEventListener('click', checkout);

  const btnApplyCoupon = document.getElementById('btn-apply-coupon');
  if (btnApplyCoupon) btnApplyCoupon.addEventListener('click', applyCoupon);

  // Actualizar navbar según login
  const token = localStorage.getItem('token');
  const btnLogin = document.getElementById('btn-nav-login');
  const btnLogout = document.getElementById('btn-nav-logout');

  if (token && btnLogin && btnLogout) {
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'block';
  }

  mostrarBotonAdminSiCorresponde();

  // Verificar admin en admin.html
  if (document.querySelector('.admin-body')) {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
      alert('Acceso denegado');
      window.location.href = '/index.html';
    }
  }
});
