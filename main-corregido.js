// ========== CARRITO DE COMPRAS ==========

function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const cartCountElements = document.querySelectorAll("#cart-count");
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCountElements.forEach((el) => {
    if (el) el.textContent = totalItems;
  });
}

function showNotification(message, tipo = 'success') {
  let notification = document.getElementById("notification");

  if (!notification) {
    notification = document.createElement("div");
    notification.id = "notification";
    document.body.appendChild(notification);
  }

  notification.className = "notification"; 

  if (tipo === 'error') {
    notification.classList.add("notif-error");
  } else {
    notification.classList.add("notif-success"); 
  }

  notification.textContent = message;
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 2000);
}

function addToCart(producto) {
  const stock = Number(producto.stock) || 0;

  if (stock <= 0) {
    showNotification(`✕ ${producto.name || producto.nombre} no tiene stock disponible`, 'error');
    return;
  }

  let cart = getCart();
  const existingProduct = cart.find((item) => item.id === producto.id);

  if (existingProduct) {
    if (existingProduct.quantity >= stock) {
      showNotification(`✕ No hay más stock disponible de ${producto.name || producto.nombre}`, 'error');
      return;
    }
    existingProduct.quantity += 1;
  } else {
    cart.push({
      id: producto.id,
      name: producto.name || producto.nombre,
      price: producto.price || producto.precio,
      image: producto.image || `/img/${(producto.name || producto.nombre).replace(/\s/g, "")}.png`,
      stock: stock,
      quantity: 1,
    });
  }

  saveCart(cart);
  showNotification(`✓ ${producto.name || producto.nombre} añadido al carrito`, 'success');

  if (typeof renderCart === "function" && document.getElementById("cart-items")) {
    renderCart();
  }
}

function handleAddToCart(event) {
  let button = event.target;
  if (!button.classList.contains("btn-add")) {
    button = button.closest(".btn-add");
  }
  if (!button) return;

  if (button.disabled || button.classList.contains("disabled")) {
    showNotification("✕ Producto sin stock disponible", "error");
    return;
  }

  const id = parseInt(button.getAttribute("data-id"));
  const name = button.getAttribute("data-name");
  const price = parseFloat(button.getAttribute("data-price"));
  const image = button.getAttribute("data-image");
  const stock = parseInt(button.getAttribute("data-stock"));

  if (id && name && !isNaN(price)) {
    addToCart({ id, name, price, image, stock });
  }
}

function bindAddToCartButtons() {
  const allButtons = document.querySelectorAll(".btn-add");
  allButtons.forEach((btn) => {
    btn.removeEventListener("click", handleAddToCart);
    btn.addEventListener("click", handleAddToCart);
  });
}

// ========== FILTRADO DE PRODUCTOS ==========
let allProducts = []; 
let currentCategory = "all"; 

function filterProductsByCategory(products, category) {
  if (category === "all") return products;
  return products.filter((product) => {
    const productCategory = product.categoria || product.category;
    return productCategory === category;
  });
}

function displayFilteredProducts(products) {
  const productsList = document.getElementById("products-list");
  if (!productsList) return;

  const filteredProducts = filterProductsByCategory(products, currentCategory);

  if (filteredProducts.length === 0) {
    productsList.innerHTML = '<p class="empty-message" style="text-align: center; padding: 40px;">No hay productos en esta categoría</p>';
    return;
  }

  productsList.innerHTML = "";

  filteredProducts.forEach((product) => {
    const nombre = product.name || product.nombre || "Producto sin nombre";
    const precio = product.price || product.precio || 0;
    const imagen = product.image || product.imagen || "https://via.placeholder.com/300x200?text=Imagen+no+disponible";
    const rating = product.rating || 0;
    const reviews = product.reviews || 0;
    const stock = Number(product.stock) || 0;
    const sinStock = stock <= 0;

    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let starsHTML = "";

    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fa-solid fa-star"></i>';
    if (hasHalfStar) starsHTML += '<i class="fa-regular fa-star-half-stroke"></i>';
    for (let i = 0; i < 5 - Math.ceil(rating); i++) starsHTML += '<i class="fa-regular fa-star"></i>';

    const productCard = document.createElement("div");
    productCard.className = `product-card ${sinStock ? "product-card-out-stock" : ""}`;
    productCard.innerHTML = `
            <div class="product-image">
                <img src="${imagen}" alt="${nombre}" onerror="this.src='https://via.placeholder.com/300x200?text=Imagen+no+disponible'">
            </div>
            <h3>${nombre}</h3>
            <div class="rating">
                ${starsHTML}
                <span>(${reviews})</span>
            </div>
            <p class="price">$${precio.toLocaleString("es-AR")}</p>
            <div class="stock-info">
                ${sinStock ? '<span class="stock-badge sin-stock">Sin stock disponible</span>' : `<span class="stock-badge con-stock">Disponibles: ${stock}</span>`}
            </div>
            <button class="btn-add ${sinStock ? "disabled" : ""}" data-id="${product.id}" data-name="${nombre}" data-price="${precio}" data-image="${imagen}" data-stock="${stock}" ${sinStock ? "disabled" : ""}>
                <i class="fa-solid fa-cart-plus"></i> ${sinStock ? "Agotado" : "Añadir al carrito"}
            </button>
        `;
    productsList.appendChild(productCard);
  });

  bindAddToCartButtons();
}

function initFilters() {
  const filterButtons = document.querySelectorAll(".filter-btn");
  if (filterButtons.length === 0) return;
  filterButtons.forEach((btn) => {
    btn.removeEventListener("click", handleFilterClick);
    btn.addEventListener("click", handleFilterClick);
  });
}

function handleFilterClick(event) {
  const button = event.currentTarget;
  currentCategory = button.getAttribute("data-category");

  document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
  button.classList.add("active");

  displayFilteredProducts(allProducts);
}

// ========== CARGAR PRODUCTOS EN LA PÁGINA productos.html ==========
async function loadProductsPage() {
  const productsList = document.getElementById("products-list");
  if (!productsList) return;

  try {
    const response = await fetch("/api/productos");
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

    const products = await response.json();
    allProducts = products;

    if (products.length === 0) {
      productsList.innerHTML = '<p class="empty-message">No hay productos disponibles</p>';
      return;
    }

    initFilters();
    displayFilteredProducts(products);
  } catch (error) {
    console.error("❌ Error cargando productos:", error);
    productsList.innerHTML = `<p class="error-message" style="color:red; text-align:center;">Error: ${error.message}</p>`;
  }
}

// ========== FUNCIONES PARA CART.HTML ==========
function renderCart() {
  const cartItemsContainer = document.getElementById("cart-items");
  const cartTotalSpan = document.getElementById("cart-total");
  if (!cartItemsContainer) return;

  const cart = getCart();

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart" style="text-align: center; padding: 40px;">Tu carrito está vacío</p>';
    if (cartTotalSpan) cartTotalSpan.textContent = "$0";
    return;
  }

  let total = 0;
  cartItemsContainer.innerHTML = "";

  cart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const itemElement = document.createElement("div");
    itemElement.className = "cart-item";
    itemElement.innerHTML = `
            <img src="..${item.image}" alt="${item.name}" onerror="this.src='../img/placeholder.png'">
            <div class="item-info">
                <h3>${item.name}</h3>
                <p class="item-unit-price">Precio unitario: $${item.price.toLocaleString("es-AR")}</p>
            </div>
            <div class="item-controls">
                <div class="quantity-controls">
                    <button class="btn-qty" data-index="${index}" data-change="-1">-</button>
                    <span class="item-quantity">${item.quantity}</span>
                    <button class="btn-qty" data-index="${index}" data-change="1">+</button>
                </div>
                <p class="item-subtotal">$${subtotal.toLocaleString("es-AR")}</p>
            </div>
            <button class="btn-remove" data-index="${index}">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
    cartItemsContainer.appendChild(itemElement);
  });

  if (cartTotalSpan) cartTotalSpan.textContent = `$${total.toLocaleString("es-AR")}`;

  document.querySelectorAll(".btn-qty").forEach(btn => btn.addEventListener("click", handleQuantityChange));
  document.querySelectorAll(".btn-remove").forEach(btn => btn.addEventListener("click", handleRemoveItem));
}

function handleQuantityChange(event) {
  const btn = event.currentTarget;
  updateQuantity(parseInt(btn.dataset.index), parseInt(btn.dataset.change));
}

function handleRemoveItem(event) {
  const btn = event.currentTarget;
  removeFromCart(parseInt(btn.dataset.index));
}

function updateQuantity(index, change) {
  let cart = getCart();
  if (cart[index]) {
    const newQuantity = cart[index].quantity + change;
    if (newQuantity <= 0) cart.splice(index, 1);
    else cart[index].quantity = newQuantity;
    saveCart(cart);
    renderCart();
  }
}

function removeFromCart(index) {
  let cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
}

function emptyCart() {
  if (confirm("¿Estás seguro de que quieres vaciar el carrito?")) {
    saveCart([]);
    renderCart();
    showNotification("Carrito vaciado");
  }
}

async function checkout(codigoCupon = null) {
  const cart = getCart();
  if (cart.length === 0) {
    showNotification("Tu carrito está vacío", "error");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html?reason=checkout&returnTo=%2Fhtml%2Fcart.html";
    return;
  }

  try {
    const response = await fetch("/api/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        productos: cart.map((item) => ({
          productoId: Number(item.id),
          cantidad: Number(item.quantity)
        })),
        ...(codigoCupon ? { cupon: codigoCupon } : {})
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.mensaje || `Error HTTP: ${response.status}`);
    const totalFinal = Number(result.total ?? result.pedido?.total);
    if (!Number.isFinite(totalFinal)) throw new Error("El servidor no devolvió el total del pedido");

    alert(`¡Gracias por tu compra! Total: $${totalFinal.toLocaleString("es-AR")}\n${result.mensaje || ""}`);
    saveCart([]);
    renderCart();
    window.location.href = "../index.html";
  } catch (error) {
    showNotification(error.message, "error");
  }
}

// ========== MENÚ HAMBURGUESA ==========
function initHamburgerMenu() {
  const hamburger = document.getElementById("hamburger-menu");
  const navMenu = document.getElementById("nav-menu");
  if (!hamburger || !navMenu) return;

  const overlay = document.createElement("div");
  overlay.className = "menu-overlay";
  document.body.appendChild(overlay);

  function openMenu() {
    hamburger.classList.add("active");
    navMenu.classList.add("active");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    hamburger.classList.remove("active");
    navMenu.classList.remove("active");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (navMenu.classList.contains("active")) closeMenu();
    else openMenu();
  });

  overlay.addEventListener("click", closeMenu);
  navMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && navMenu.classList.contains("active")) closeMenu();
  });
}

// ========== CARGAR PRODUCTOS DESTACADOS EN INDEX.HTML ==========
async function loadFeaturedProducts() {
  const featuredProducts = document.getElementById("featured-products");
  if (!featuredProducts) return;

  try {
    const response = await fetch("/api/productos");
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

    const products = await response.json();
    featuredProducts.innerHTML = "";

    products.slice(0, 4).forEach((product) => {
      const stock = Number(product.stock) || 0;
      const sinStock = stock === 0;
      const nombre = product.name || product.nombre;
      const precio = product.price || product.precio;
      const imagen = product.image || product.imagen;
      const rating = Number(product.rating) || 4;
      const reviews = product.reviews || 0;

      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 !== 0;
      let starsHTML = "";

      for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fa-solid fa-star"></i>';
      if (hasHalfStar) starsHTML += '<i class="fa-regular fa-star-half-stroke"></i>';
      for (let i = 0; i < 5 - Math.ceil(rating); i++) starsHTML += '<i class="fa-regular fa-star"></i>';

      const productCard = document.createElement("div");
      productCard.className = `product-card ${sinStock ? "opacity-75" : ""}`;
      productCard.innerHTML = `
                <div class="product-image">
                    <img src="${imagen}" alt="${nombre}" onerror="this.src='https://via.placeholder.com/300x200?text=Imagen+no+disponible'">
                </div>
                <h3>${nombre}</h3>
                <div class="rating">
                    ${starsHTML}
                    <span>(${reviews})</span>
                </div>
                <p class="price">$${Number(precio).toLocaleString("es-AR")}</p>
                <div class="stock-info">
                    ${sinStock ? '<span class="stock-badge sin-stock">Sin stock disponible</span>' : `<span class="stock-badge con-stock">Disponibles: ${stock}</span>`}
                </div>
                <button class="btn-add ${sinStock ? "disabled" : ""}" data-id="${product.id}" data-name="${nombre}" data-price="${precio}" data-image="${imagen}" data-stock="${stock}" ${sinStock ? "disabled" : ""}>
                    <i class="fa-solid fa-cart-plus"></i> ${sinStock ? "Agotado" : "Añadir al carrito"}
                </button>
            `;
      featuredProducts.appendChild(productCard);
    });

    bindAddToCartButtons();
  } catch (error) {
    featuredProducts.innerHTML = `<p class="error-message" style="color:red; text-align:center;">Error al conectar con la base de datos de productos.</p>`;
  }
}

// ========== INTERCAMBIO LOGIN / REGISTRO ==========
function switchAuth(view) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (!tabLogin || !tabRegister) return;

  if (view === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.add('active');
    formRegister.classList.remove('active');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.add('active');
    formLogin.classList.remove('active');
  }
}

// ========== INICIALIZACIÓN GENERAL ==========
document.addEventListener("DOMContentLoaded", () => {
  initHamburgerMenu();
  updateCartCount();
  loadProductsPage();
  loadFeaturedProducts();

  if (document.getElementById("cart-items")) {
    renderCart();
  }

  const btnEmpty = document.getElementById("btn-empty");
  if (btnEmpty) btnEmpty.addEventListener("click", emptyCart);

  const btnCheckout = document.getElementById("btn-checkout");
  if (btnCheckout) {
    btnCheckout.addEventListener("click", () => checkout(window.cuponAplicado || null));
  }

  const subscribeForm = document.getElementById("subscribe-form");
  if (subscribeForm) {
    subscribeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = subscribeForm.querySelector('input[type="email"]').value;
      if (email) {
        showNotification(`¡Gracias por suscribirte! Enviaremos ofertas a ${email}`);
        subscribeForm.reset();
      }
    });
  }

  const contactForm = document.querySelector(".contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("name")?.value || "";
      if (name) {
        showNotification(`¡Gracias ${name}! Tu mensaje ha sido enviado.`);
        contactForm.reset();
      }
    });
  }

  const btnApplyCoupon = document.getElementById("btn-apply-coupon");
  if (btnApplyCoupon) {
    btnApplyCoupon.addEventListener("click", async () => {
      const couponInput = document.getElementById("coupon-code");
      const codigo = couponInput.value.trim();
      if (!codigo) {
        showNotification("Ingresa un código de cupón", "error");
        return;
      }

      const totalActual = getCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (totalActual === 0) {
        showNotification("El carrito está vacío", "error");
        return;
      }

      const resultado = await aplicarCupon(codigo, totalActual);
      const messageEl = document.getElementById("coupon-message");
      if (messageEl) {
        if (resultado.monto_final !== undefined) {
          messageEl.style.color = "green";
          messageEl.textContent = `¡Cupón aplicado! Ahorraste $${resultado.ahorro.toLocaleString("es-AR")}`;
          document.getElementById("cart-total").textContent = `$${resultado.monto_final.toLocaleString("es-AR")}`;
          window.cuponAplicado = codigo;
        } else {
          messageEl.style.color = "red";
          messageEl.textContent = resultado.mensaje || "Cupón no válido";
        }
      }
    });
  }
});