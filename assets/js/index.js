gsap.registerPlugin(ScrollTrigger);

// 1. CONFIGURATION LENIS (OPTIMISÉE POUR MOBILE)
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false, // <--- MUHIM BZAF: Désactiver smooth JS f mobile bash ybqa scroll naturel
    touchMultiplier: 2,
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// --- LENIS SCROLL FOR ANCHOR LINKS ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        lenis.scrollTo(targetId, {
            duration: 1.5,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        });
    });
});

// 2. LOADER
window.addEventListener("load", () => {
    const tl = gsap.timeline();
    tl.to(".reveal-load span", { y: 0, duration: 1, ease: "power4.out" })
        .to("#loader", { yPercent: -100, duration: 1.2, ease: "power4.inOut", delay: 0.5 })
        .add(() => {
            document.querySelectorAll('.reveal-up').forEach(el => gsap.fromTo(el, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }));
            document.getElementById('hero-img').classList.add('visible');
        }, "-=0.8");
});

// 3. NAVBAR SCROLL (Disabled)
// const navbar = document.getElementById('navbar');
// window.addEventListener('scroll', () => {
//     if (window.scrollY > 50) navbar.classList.add('scrolled');
//     else navbar.classList.remove('scrolled');
// });

// 4. MOBILE MENU
function toggleMenu() {
    document.getElementById('mobile-menu').classList.toggle('open');
    document.querySelector('.hamburger').classList.toggle('active');
}
function closeMenuAndScroll(id) {
    toggleMenu();
    setTimeout(() => {
        lenis.scrollTo(id, { duration: 1.5 });
    }, 800);
}
function scrollToContact() {
    lenis.scrollTo('#contact', { duration: 1.5 });
}

// 5. STICKY IMAGE SWAP (Desktop Only - Performance)
if (window.innerWidth >= 1024) {
    function initServicesScrollTrigger() {
        const serviceBlocks = gsap.utils.toArray('.service-text-block');
        const mediaGroups = gsap.utils.toArray('.service-media-group');

        // Initial State: Hide all groups except the first one
        gsap.set(mediaGroups, { autoAlpha: 0 });
        if (mediaGroups[0]) gsap.set(mediaGroups[0], { autoAlpha: 1 });

        let activeMediaIndex = -1;

        function switchMediaGroup(index) {
            if (index === activeMediaIndex) return;

            if (activeMediaIndex > -1) {
                gsap.to(mediaGroups[activeMediaIndex], { autoAlpha: 0, duration: 0.8, ease: "power2.inOut" });
            }

            if (mediaGroups[index]) {
                gsap.to(mediaGroups[index], { autoAlpha: 1, duration: 0.8, ease: "power2.inOut" });
            }

            activeMediaIndex = index;
        }

        serviceBlocks.forEach((block, index) => {
            const currentGroup = mediaGroups[index];
            if (!currentGroup) return;

            const images = currentGroup.querySelectorAll('.service-img');

            // TRIGGER A: GROUP SWITCHING
            ScrollTrigger.create({
                trigger: block,
                start: "top center",
                end: "bottom center",
                onEnter: () => switchMediaGroup(index),
                onEnterBack: () => switchMediaGroup(index),
            });

            // TRIGGER B: PINNING & SCRUBBING MULTI-IMAGES
            if (images.length > 1) {
                gsap.set(images[0], { autoAlpha: 1, yPercent: 0 });
                for (let i = 1; i < images.length; i++) {
                    gsap.set(images[i], { autoAlpha: 0, yPercent: 10 });
                }

                const pinTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: block,
                        start: "center center",
                        end: () => `+=${window.innerHeight * (images.length - 1)}`,
                        pin: true,
                        scrub: 1,
                        invalidateOnRefresh: true
                    }
                });

                images.forEach((img, i) => {
                    if (i === 0) return;
                    pinTl.to(img, {
                        autoAlpha: 1,
                        yPercent: 0,
                        ease: "none"
                    });
                });
            }
        });
        switchMediaGroup(0);
    }
    setTimeout(() => {
        initServicesScrollTrigger();
        ScrollTrigger.refresh();
    }, 100);
}

// 6. ANIMATIONS
const masks = document.querySelectorAll('.img-mask:not(#hero-img)');
masks.forEach(mask => {
    ScrollTrigger.create({ trigger: mask, start: "top 80%", onEnter: () => mask.classList.add('visible') });
});

// 7. CURSOR (Desktop Only Check)
if (window.matchMedia("(pointer: fine)").matches) {
    const dot = document.getElementById("cursor-dot");
    const circle = document.getElementById("cursor-circle");
    window.addEventListener("mousemove", (e) => {
        gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0.1 });
        gsap.to(circle, { x: e.clientX, y: e.clientY, duration: 0.25 });
    });
    document.querySelectorAll("a, button, input, textarea").forEach(el => {
        el.addEventListener("mouseenter", () => document.body.classList.add("hovering"));
        el.addEventListener("mouseleave", () => document.body.classList.remove("hovering"));
    });
}

// 8. FORM & EMAIL LOGIC

// --- CSRF token: fetch on page load ---
function fetchCsrfToken() {
    fetch('csrf-token.php')
        .then(res => res.json())
        .then(data => {
            if (data.csrf_token) {
                document.getElementById('csrf_token').value = data.csrf_token;
            }
        })
        .catch(() => { /* silent — CSRF will fail server-side if token missing */ });
}
fetchCsrfToken();

function triggerForm(serviceName) {
    document.getElementById('message').value = `Inquiry regarding: ${serviceName}. `;
    lenis.scrollTo('#contact');
    setTimeout(() => { document.getElementById('name').focus(); }, 1000);
}

// --- Overlay helpers ---
function showOverlay() {
    const overlay = document.getElementById('waiting-overlay');
    // Reset to loading state
    document.getElementById('overlay-loading').classList.remove('hidden');
    document.getElementById('overlay-success').classList.add('hidden');
    document.getElementById('overlay-error').classList.add('hidden');

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        overlay.querySelector('div').classList.remove('scale-95');
        overlay.querySelector('div').classList.add('scale-100');
    }, 10);
}

function closeOverlay() {
    const overlay = document.getElementById('waiting-overlay');
    overlay.classList.add('opacity-0');
    overlay.querySelector('div').classList.remove('scale-100');
    overlay.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.style.display = '';
    }, 300);
}

function handleFormSubmit(e) {
    e.preventDefault();

    const form = document.getElementById('whatsapp-form');
    const name    = document.getElementById('name').value.trim();
    const email   = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    showOverlay();

    const formData = new FormData();
    formData.append('name',    name);
    formData.append('email',   email);
    formData.append('message', message);
    formData.append('csrf_token', document.getElementById('csrf_token').value);
    formData.append('website',    document.getElementById('website').value); // honeypot

    fetch('send-email.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('overlay-loading').classList.add('hidden');
        if (data.success) {
            document.getElementById('overlay-success').classList.remove('hidden');
            form.reset();
            fetchCsrfToken(); // refresh token for next submission
        } else {
            const errEl = document.getElementById('overlay-error-msg');
            errEl.textContent = data.message || "We couldn't send your message. Please try again or contact us directly.";
            document.getElementById('overlay-error').classList.remove('hidden');
        }
    })
    .catch(() => {
        document.getElementById('overlay-loading').classList.add('hidden');
        document.getElementById('overlay-error-msg').textContent = "Network error. Please check your connection and try again.";
        document.getElementById('overlay-error').classList.remove('hidden');
    });
}

const inputs = document.querySelectorAll('input, textarea');
inputs.forEach(input => {
    input.addEventListener('focus', () => { if(input.nextElementSibling){ input.nextElementSibling.style.top = '-12px'; input.nextElementSibling.style.fontSize = '0.6rem'; input.nextElementSibling.style.color = '#BFA078'; }});
    input.addEventListener('blur', () => { if (input.value === "" && input.nextElementSibling) { input.nextElementSibling.style.top = '1rem'; input.nextElementSibling.style.fontSize = '0.75rem'; input.nextElementSibling.style.color = '#7A7A7A'; } });
});


// --- GSAP HORIZONTAL SCROLL GALLERY (OPTIMIZED) ---

// Configuration CRITIQUE pour Mobile
ScrollTrigger.config({
    ignoreMobileResize: true // Empêche le recalcul quand la barre d'adresse bouge
});

const gallerySection = document.getElementById("gallery-pin");
const galleryTrack = document.getElementById("gallery-track");

function getScrollAmount() {
    let galleryWidth = galleryTrack.scrollWidth;
    let viewportWidth = window.innerWidth;
    return -(galleryWidth - viewportWidth);
}

const tween = gsap.to(galleryTrack, {
    x: () => getScrollAmount(),
    ease: "none",
    scrollTrigger: {
        trigger: gallerySection,
        start: "top top",
        end: () => `+=${getScrollAmount() * -1}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        fastScrollEnd: true, // Prevents Y-axis scroll jumping & ensures layout catches up
        preventOverlaps: true,
        anticipatePin: 1
    }
});

// Parallax léger (Désactivé sur très petits écrans pour performance si besoin)
gsap.utils.toArray(".gallery-img").forEach(img => {
    gsap.to(img, {
        xPercent: 15,
        ease: "none",
        scrollTrigger: {
            trigger: gallerySection,
            start: "top top",
            end: () => `+=${getScrollAmount() * -1}`,
            scrub: 1
        }
    });
});
