// ===== CORE STATE =====
let cart = JSON.parse(localStorage.getItem('enzaCart')) || [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    initScrollHeader();
    initHeroParticles();
    shuffleInstaCards();
    initInstaHover();
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', sendContact);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeLightbox();
        closeVideo();
    });
    lucide.createIcons();
});

// ===== INSTA HOVER PAUSE =====
function initInstaHover() {
    const track = document.getElementById('insta-track');
    if (!track) return;
    
    track.addEventListener('mouseenter', () => {
        track.style.animationPlayState = 'paused';
        const cards = track.querySelectorAll('.insta-card');
        cards.forEach(card => card.style.animationPlayState = 'paused');
    });
    
    track.addEventListener('mouseleave', () => {
        track.style.animationPlayState = 'running';
        const cards = track.querySelectorAll('.insta-card');
        cards.forEach(card => card.style.animationPlayState = 'running');
    });
}

// ===== SHUFFLE INSTA CARDS =====
function shuffleInstaCards() {
    const track = document.getElementById('insta-track');
    if (!track) return;
    const cards = Array.from(track.children);
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        track.appendChild(cards[j]);
    }
}

// ===== TIENDA CARRUSEL =====
function scrollProductCarousel(direction) {
    const el = document.getElementById('product-carousel');
    if (!el) return;
    const card = el.querySelector('.product-card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 0;
    const w = card.getBoundingClientRect().width + gap;
    el.scrollBy({ left: direction * w, behavior: 'smooth' });
}

// ===== HEADER SCROLL =====
function initScrollHeader() {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ===== CART LOGIC =====
function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) drawer.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

const DEFAULT_PRODUCT_IMG = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=200';

/**
 * addToCart(name, price, img) — tienda simple
 * addToCart(name, type, price, img) — firma extendida (compatibilidad)
 */
function addToCart(name, priceOrType, priceOrImg, img) {
    let type = 'product';
    let price;
    let itemImg;

    if (typeof priceOrType === 'number') {
        price = priceOrType;
        itemImg = typeof priceOrImg === 'string' ? priceOrImg : DEFAULT_PRODUCT_IMG;
    } else {
        type = priceOrType || 'product';
        price = priceOrImg;
        itemImg = img || DEFAULT_PRODUCT_IMG;
    }

    if (typeof price !== 'number' || Number.isNaN(price)) {
        console.warn('addToCart: precio inválido');
        return;
    }

    const existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ name, type, price, img: itemImg, quantity: 1 });
    }
    saveCart();
    updateCartUI();
    toggleCart();
}

function removeFromCart(name) {
    cart = cart.filter(item => item.name !== name);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('enzaCart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="cart-empty"><i data-lucide="shopping-bag" aria-hidden="true"></i><span>Tu carrito está vacío</span></p>';
        cartTotal.textContent = '$0.00';
        cartCount.textContent = '0';
        lucide.createIcons();
        return;
    }

    let total = 0;
    let count = 0;
    
    cartItems.innerHTML = cart.map(item => {
        total += item.price * item.quantity;
        count += item.quantity;
        return `
            <div class="cart-item">
                <img src="${item.img}" alt="${item.name}">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <span>$${item.price.toFixed(2)} x ${item.quantity}</span>
                </div>
                <button class="cart-remove" onclick="removeFromCart('${item.name}')"><i data-lucide="trash-2"></i></button>
            </div>
        `;
    }).join('');

    cartTotal.textContent = `$${total.toFixed(2)}`;
    cartCount.textContent = count;
    lucide.createIcons();
}

function checkout() {
    if (cart.length === 0) return;
    alert('¡Gracias por tu apoyo! Serás redirigido a la plataforma de pago.');
    cart = [];
    saveCart();
    updateCartUI();
    toggleCart();
}

// ===== GALLERY FILTER & LIGHTBOX =====
function filterGallery(category, btn) {
    const items = document.querySelectorAll('.gallery-item');
    const btns = document.querySelectorAll('.filter-btn');
    
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    items.forEach(item => {
        if (category === 'all' || item.dataset.cat === category) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function openLightbox(src, caption) {
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbCap = document.getElementById('lightbox-caption');
    if (!lb || !lbImg) return;
    lbImg.src = src;
    if (lbCap) lbCap.textContent = caption || '';
    lb.classList.add('open');
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('open');
}

// ===== VIDEO LOGIC =====
function openVideo(url) {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('video-iframe');
    if (!modal || !iframe) return;
    iframe.src = url;
    modal.classList.add('open');
    lucide.createIcons();
}

function closeVideo() {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('video-iframe');
    if (iframe) iframe.src = '';
    if (modal) modal.classList.remove('open');
}

// ===== NEWSLETTER & CONTACT =====
function subscribeNewsletter(e) {
    e.preventDefault();
    const success = document.getElementById('nl-success');
    if (success) {
        success.classList.remove('hidden');
        setTimeout(() => success.classList.add('hidden'), 4000);
    }
    e.target.reset();
}

function sendContact(e) {
    e.preventDefault();
    const success = document.getElementById('contact-success');
    if (success) {
        success.classList.remove('hidden');
        setTimeout(() => success.classList.add('hidden'), 3000);
    }
    e.target.reset();
    lucide.createIcons();
}

// ===== MOBILE NAV =====
function toggleNav() {
    const nav = document.getElementById('mobile-nav');
    if (nav) nav.classList.toggle('open');
}

// ===== PARTICLES BACKGROUND =====
function initHeroParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 5 + 's';
        container.appendChild(particle);
    }
}
