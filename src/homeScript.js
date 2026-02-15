(() => {
    const root = document.documentElement;
    const body = document.body;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
        techLoopId: 0,
        techControllers: [],
        projectCache: [],
        projectFiltered: [],
        projectPinned: new Set(),
        projectPage: 1,
        projectsPerPage: 6,
    };

    const byId = (id) => document.getElementById(id);
    const qs = (selector, scope = document) => scope.querySelector(selector);
    const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const runWhenReady = (fn) => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn, { once: true });
        } else {
            fn();
        }
    };

    const apiBase = String(body?.dataset.apiBase || "").trim().replace(/\/+$/, "");
    const toApiUrl = (path) => {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        return apiBase ? `${apiBase}${normalizedPath}` : normalizedPath;
    };

    const isLight = () => root.dataset.theme === "light";
    const isMobileMenu = () => window.matchMedia("(max-width: 700px)").matches;
    const isModernPolish = () => body?.classList.contains("modern-polish");
    const canUseHoverEffects = () =>
        !prefersReducedMotion.matches && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const setThemeButtonLabel = (button) => {
        if (!button) return;
        const next = isLight() ? "dark" : "light";
        const message = `Switch to ${next} mode`;
        button.setAttribute("aria-label", message);
        button.setAttribute("title", message);
    };

    const applyTheme = (theme, persist = true) => {
        const normalized = theme === "light" ? "light" : "dark";
        root.dataset.theme = normalized;
        setThemeButtonLabel(byId("theme-toggle"));
        updateAboutAvatarTheme();
        updateLeetCodeTheme();
        if (persist) {
            try {
                localStorage.setItem("theme", normalized);
            } catch (_error) {
                // Ignore storage write failures.
            }
        }
    };

    const getInitialTheme = () => {
        if (root.dataset.theme === "light" || root.dataset.theme === "dark") return root.dataset.theme;
        try {
            const saved = localStorage.getItem("theme");
            if (saved === "light" || saved === "dark") return saved;
        } catch (_error) {
            // Ignore storage read failures.
        }
        return "dark";
    };

    const initTheme = () => {
        applyTheme(getInitialTheme(), false);
        const button = byId("theme-toggle");
        if (!button) return;

        button.addEventListener("click", () => {
            applyTheme(isLight() ? "dark" : "light", true);
        });
    };

    const initNavMenu = () => {
        const navbar = byId("navbar");
        const navToggle = byId("nav-toggle");
        const navBackdrop = byId("nav-backdrop");
        const navLinks = qsa("#navbar-right a");
        if (!navbar || !navToggle || !navBackdrop) return;

        const setMenuState = (open) => {
            navbar.dataset.menu = open ? "open" : "closed";
            navToggle.setAttribute("aria-expanded", open ? "true" : "false");
            navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
            navToggle.setAttribute("title", open ? "Close menu" : "Open menu");
            navBackdrop.hidden = !open;
            body.classList.toggle("nav-locked", open);
        };

        const closeMenu = () => setMenuState(false);
        const openMenu = () => setMenuState(true);

        navToggle.addEventListener("click", () => {
            if (navbar.dataset.menu === "open") {
                closeMenu();
            } else {
                openMenu();
            }
        });

        navBackdrop.addEventListener("click", closeMenu);
        navLinks.forEach((link) => link.addEventListener("click", closeMenu));

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && navbar.dataset.menu === "open") {
                closeMenu();
                navToggle.focus();
            }
        });

        window.addEventListener("resize", () => {
            if (!isMobileMenu() && navbar.dataset.menu === "open") {
                closeMenu();
            }
        });

        setMenuState(false);

        const sectionTargets = navLinks
            .map((link) => {
                const href = String(link.getAttribute("href") || "");
                if (!href.startsWith("#") || href.length < 2) return null;
                const id = href.slice(1);
                const section = byId(id);
                if (!section) return null;
                return { id, link, section };
            })
            .filter(Boolean);

        const setActiveLink = (activeId) => {
            sectionTargets.forEach(({ id, link }) => {
                if (id === activeId) {
                    link.setAttribute("aria-current", "page");
                } else {
                    link.removeAttribute("aria-current");
                }
            });
        };

        const updateNavState = () => {
            navbar.classList.toggle("is-scrolled", window.scrollY > 8);
            if (!sectionTargets.length) return;

            const navOffset = (navbar.offsetHeight || 0) + 28;
            const scrollY = window.scrollY + navOffset;
            let activeId = sectionTargets[0].id;

            for (const { id, section } of sectionTargets) {
                if (section.offsetTop <= scrollY) activeId = id;
            }

            const atPageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
            if (atPageBottom) activeId = sectionTargets[sectionTargets.length - 1].id;
            setActiveLink(activeId);
        };

        let navTicking = false;
        const scheduleNavState = () => {
            if (navTicking) return;
            navTicking = true;
            window.requestAnimationFrame(() => {
                updateNavState();
                navTicking = false;
            });
        };

        window.addEventListener("scroll", scheduleNavState, { passive: true });
        window.addEventListener("resize", scheduleNavState);
        sectionTargets.forEach(({ id, link }) => {
            link.addEventListener("click", () => setActiveLink(id));
        });

        updateNavState();
    };

    const initScrollProgress = () => {
        const navbar = byId("navbar");
        if (!navbar) return;

        const update = () => {
            const doc = document.documentElement;
            const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
            const progress = clamp(window.scrollY / scrollable, 0, 1);
            navbar.style.setProperty("--scroll-progress", progress.toFixed(4));
        };

        let ticking = false;
        const schedule = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                update();
                ticking = false;
            });
        };

        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        update();
    };

    const initScrollTransitions = () => {
        if (!isModernPolish()) return;

        const sections = [...qsa("main > section:not(#intro)"), byId("contact")].filter(Boolean);
        sections.forEach((section, index) => {
            section.classList.add("scroll-section");
            section.style.setProperty("--section-delay", `${Math.min(index * 42, 170)}ms`);
        });

        if (prefersReducedMotion.matches) {
            sections.forEach((section) => section.classList.add("section-in-view"));
        } else {
            const sectionObserver = new IntersectionObserver(
                (entries, observer) => {
                    entries.forEach((entry) => {
                        if (!entry.isIntersecting) return;
                        entry.target.classList.add("section-in-view");
                        observer.unobserve(entry.target);
                    });
                },
                { threshold: 0.16, rootMargin: "0px 0px -12% 0px" }
            );

            sections.forEach((section) => sectionObserver.observe(section));
        }

        const intro = byId("intro");
        if (!intro) return;

        const heroContent = qs("#intro #right-container");
        const heroShowcase = qs("#intro .hero-showcase");
        if (heroContent) heroContent.classList.add("scroll-parallax");
        if (heroShowcase) heroShowcase.classList.add("scroll-parallax");

        if (prefersReducedMotion.matches || (!heroContent && !heroShowcase)) return;

        const updateParallax = () => {
            const rect = intro.getBoundingClientRect();
            const traveled = clamp(-rect.top, 0, window.innerHeight * 1.4);
            const contentOffset = (traveled * -0.048).toFixed(2);
            const showcaseOffset = (traveled * 0.034).toFixed(2);
            const glowOffset = (traveled * 0.038).toFixed(2);

            intro.style.setProperty("--intro-glow-x", `${glowOffset}px`);
            if (heroContent) heroContent.style.setProperty("--scroll-parallax", `${contentOffset}px`);
            if (heroShowcase) heroShowcase.style.setProperty("--scroll-parallax", `${showcaseOffset}px`);
        };

        let ticking = false;
        const scheduleParallax = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                updateParallax();
                ticking = false;
            });
        };

        window.addEventListener("scroll", scheduleParallax, { passive: true });
        window.addEventListener("resize", scheduleParallax);
        updateParallax();
    };

    const initHeroCanvas = () => {
        const canvas = byId("hero-canvas");
        if (!canvas || prefersReducedMotion.matches || isModernPolish()) return;

        const context = canvas.getContext("2d", { alpha: true });
        if (!context) return;

        let width = 0;
        let height = 0;
        let pixels = 1;
        let rafId = 0;
        const particles = [];

        const createParticles = () => {
            particles.length = 0;
            const count = clamp(Math.floor((width * height) / 36000), 18, 56);
            for (let index = 0; index < count; index += 1) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.24,
                    vy: (Math.random() - 0.5) * 0.24,
                    r: 0.8 + Math.random() * 1.6,
                });
            }
        };

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            pixels = Math.min(window.devicePixelRatio || 1, 2);

            canvas.width = Math.max(1, Math.floor(width * pixels));
            canvas.height = Math.max(1, Math.floor(height * pixels));
            context.setTransform(pixels, 0, 0, pixels, 0, 0);
            createParticles();
        };

        const draw = () => {
            context.clearRect(0, 0, width, height);
            const pointColor = isLight() ? "rgba(11,96,255,0.45)" : "rgba(8,184,248,0.62)";
            const lineColor = isLight() ? "rgba(11,96,255,0.16)" : "rgba(8,184,248,0.16)";
            const maxDist = 132;

            for (let i = 0; i < particles.length; i += 1) {
                const particle = particles[i];
                particle.x += particle.vx;
                particle.y += particle.vy;

                if (particle.x < -10) particle.x = width + 10;
                if (particle.x > width + 10) particle.x = -10;
                if (particle.y < -10) particle.y = height + 10;
                if (particle.y > height + 10) particle.y = -10;
            }

            for (let i = 0; i < particles.length; i += 1) {
                const first = particles[i];
                for (let j = i + 1; j < particles.length; j += 1) {
                    const second = particles[j];
                    const dx = second.x - first.x;
                    const dy = second.y - first.y;
                    const distance = Math.hypot(dx, dy);
                    if (distance > maxDist) continue;
                    const alpha = 1 - distance / maxDist;
                    context.strokeStyle = lineColor.replace(/[\d.]+\)$/, `${(0.14 * alpha).toFixed(3)})`);
                    context.lineWidth = 1;
                    context.beginPath();
                    context.moveTo(first.x, first.y);
                    context.lineTo(second.x, second.y);
                    context.stroke();
                }
            }

            context.fillStyle = pointColor;
            for (const particle of particles) {
                context.beginPath();
                context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
                context.fill();
            }
        };

        const tick = () => {
            draw();
            rafId = window.requestAnimationFrame(tick);
        };

        resize();
        window.addEventListener("resize", resize);
        rafId = window.requestAnimationFrame(tick);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                window.cancelAnimationFrame(rafId);
            } else {
                rafId = window.requestAnimationFrame(tick);
            }
        });
    };

    const addRevealTargets = () => {
        const revealSelectors = [
            "#intro #right-container",
            "#intro .hero-showcase",
            "#about .section-head",
            "#about .about-card",
            "#projects .section-head",
            "#projects .projects-toolbar",
            "#projects .projects-count",
            "#projects .project-card",
            "#experience .section-head",
            "#experience .xp-card",
            "#contact .footer-left",
            "#contact .footer-form",
        ];

        const usePolishStagger = isModernPolish();
        revealSelectors.forEach((selector, groupIndex) => {
            qsa(selector).forEach((node, itemIndex) => {
                node.classList.add("reveal-on-scroll");
                if (usePolishStagger) {
                    const delay = Math.min(groupIndex * 24 + itemIndex * 20, 280);
                    node.style.setProperty("--reveal-delay", `${delay}ms`);
                } else {
                    node.style.removeProperty("--reveal-delay");
                }
            });
        });

        const revealNodes = qsa(".reveal-on-scroll");
        if (!revealNodes.length) return;

        if (prefersReducedMotion.matches) {
            revealNodes.forEach((node) => node.classList.add("is-visible"));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            },
            { threshold: 0.14, rootMargin: "0px 0px -10% 0px" }
        );

        revealNodes.forEach((node) => observer.observe(node));
    };

    const initTilt = () => {
        if (prefersReducedMotion.matches || !window.matchMedia("(hover: hover)").matches) return;

        const tiltTargets = [
            ".code-window",
            ".about-profile",
            ".about-bio",
            ".about-tech",
            ".about-github",
            ".about-leetcode",
            ".about-music",
            ".project-card",
            ".xp-card",
            ".footer-form",
        ];

        const elements = tiltTargets.flatMap((selector) => qsa(selector));
        elements.forEach((card) => {
            card.classList.add("tilt-card");
            card.addEventListener("pointermove", (event) => {
                const rect = card.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const x = (event.clientX - rect.left) / rect.width;
                const y = (event.clientY - rect.top) / rect.height;
                const rx = ((0.5 - y) * 10).toFixed(2);
                const ry = ((x - 0.5) * 12).toFixed(2);
                card.style.setProperty("--tilt-rx", `${rx}deg`);
                card.style.setProperty("--tilt-ry", `${ry}deg`);
                card.style.setProperty("--tilt-glow-x", `${(x * 100).toFixed(2)}%`);
                card.style.setProperty("--tilt-glow-y", `${(y * 100).toFixed(2)}%`);
            });

            const reset = () => {
                card.style.setProperty("--tilt-rx", "0deg");
                card.style.setProperty("--tilt-ry", "0deg");
                card.style.setProperty("--tilt-glow-x", "50%");
                card.style.setProperty("--tilt-glow-y", "50%");
            };

            card.addEventListener("pointerleave", reset);
            card.addEventListener("blur", reset, true);
        });
    };

    const bindMagnetic = (element, strength = 8) => {
        if (!element || element.dataset.magneticBound === "true") return;
        element.dataset.magneticBound = "true";
        element.classList.add("is-magnetic");

        const reset = () => {
            element.style.removeProperty("transform");
        };

        element.addEventListener("pointermove", (event) => {
            if (!canUseHoverEffects()) return;
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            const mx = (x * strength * 2).toFixed(2);
            const my = (y * strength * 2).toFixed(2);
            element.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
        });

        element.addEventListener("pointerleave", reset);
        element.addEventListener("blur", reset, true);
    };

    const initMagneticInteractions = () => {
        const targets = [
            ...qsa("#navbar-right a"),
            ...qsa(".theme-toggle, .nav-toggle"),
            ...qsa(".hero-social-btn"),
            ...qsa(".button"),
            ...qsa(".about-icon-link"),
            ...qsa(".projects-tab"),
        ];

        targets.forEach((element) => {
            let strength = 5;
            if (element.classList.contains("hero-social-btn")) strength = 7;
            if (element.classList.contains("button")) strength = 6;
            if (element.classList.contains("projects-tab")) strength = 4;
            bindMagnetic(element, strength);
        });
    };

    const bindSpotlightSurface = (element) => {
        if (!element || element.dataset.spotlightBound === "true") return;
        element.dataset.spotlightBound = "true";
        element.classList.add("interactive-surface");
        let glow = qs(".surface-glow", element);
        if (!glow) {
            glow = document.createElement("span");
            glow.className = "surface-glow";
            glow.setAttribute("aria-hidden", "true");
            element.appendChild(glow);
        }
        glow.style.setProperty("--spot-x", "50%");
        glow.style.setProperty("--spot-y", "50%");

        if (!canUseHoverEffects()) return;

        const update = (event) => {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            glow.style.setProperty("--spot-x", `${x.toFixed(2)}%`);
            glow.style.setProperty("--spot-y", `${y.toFixed(2)}%`);
        };

        const reset = () => {
            glow.style.setProperty("--spot-x", "50%");
            glow.style.setProperty("--spot-y", "50%");
        };

        element.addEventListener("pointermove", update);
        element.addEventListener("pointerleave", reset);
        element.addEventListener("blur", reset, true);
    };

    const initSpotlightSurfaces = () => {
        const selectors = [
            ".code-window",
            ".about-card",
            ".projects-toolbar",
            ".project-card",
            ".xp-card",
            ".footer-form",
        ];
        selectors.flatMap((selector) => qsa(selector)).forEach(bindSpotlightSurface);
    };

    const initTechIconFallbacks = () => {
        qsa(".about-tech-item").forEach((item) => {
            const logo = qs(".about-tech-logo", item);
            if (!logo) return;

            const markFallback = () => item.classList.add("is-fallback");
            logo.addEventListener("error", markFallback);
            if (logo.complete && logo.naturalWidth === 0) markFallback();
        });
    };

    const stopTechLoop = () => {
        if (state.techLoopId) {
            window.cancelAnimationFrame(state.techLoopId);
            state.techLoopId = 0;
        }
    };

    const runTechLoop = () => {
        stopTechLoop();
        if (prefersReducedMotion.matches || !state.techControllers.length) return;

        const frame = () => {
            state.techControllers.forEach((controller) => {
                const { line, speed, direction, loopWidth } = controller;
                if (controller.paused || !loopWidth) return;

                const maxScroll = Math.max(0, line.scrollWidth - line.clientWidth);
                if (maxScroll <= 0) return;

                const wrapPoint = Math.max(1, Math.min(loopWidth, maxScroll));
                line.scrollLeft += speed * direction;
                if (line.scrollLeft >= wrapPoint) {
                    line.scrollLeft -= wrapPoint;
                }
            });
            state.techLoopId = window.requestAnimationFrame(frame);
        };

        state.techLoopId = window.requestAnimationFrame(frame);
    };

    const setupTechController = (line) => {
        const row = qs(".about-tech-row", line);
        if (!row) return null;

        if (!line.dataset.loopBuilt) {
            const clone = row.cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            line.appendChild(clone);
            line.dataset.loopBuilt = "true";
        }

        const isReverseLane = line.classList.contains("about-tech-line--reverse");
        const direction = 1;
        const width = row.scrollWidth;
        if (!width) return null;
        const lineStyles = window.getComputedStyle(line);
        const gap = parseFloat(lineStyles.columnGap || lineStyles.gap || "0") || 0;
        const loopWidth = width + gap;
        const maxScroll = Math.max(0, line.scrollWidth - line.clientWidth);
        const initialOffset = Math.max(0, Math.min(loopWidth, maxScroll));

        line.scrollLeft = isReverseLane ? Math.floor(initialOffset * 0.45) : 0;

        const controller = {
            line,
            loopWidth,
            direction,
            speed: isReverseLane ? 0.52 : 0.6,
            paused: false,
        };

        const pause = () => {
            controller.paused = true;
        };
        const resume = () => {
            controller.paused = false;
        };

        line.addEventListener("focusin", pause);
        line.addEventListener("focusout", resume);
        if (canUseHoverEffects()) {
            qsa(".about-tech-item", line).forEach((item) => {
                item.addEventListener("pointerenter", pause);
                item.addEventListener("pointerleave", resume);
            });
        }

        return controller;
    };

    const initTechStackAutoScroll = () => {
        const lines = qsa(".about-tech-line");
        if (!lines.length) return;
        const rebuild = () => {
            state.techControllers = lines.map(setupTechController).filter(Boolean);
            runTechLoop();
        };

        rebuild();

        let resizeTimeout = 0;
        window.addEventListener("resize", () => {
            window.clearTimeout(resizeTimeout);
            resizeTimeout = window.setTimeout(() => {
                rebuild();
            }, 120);
        });

        window.addEventListener("load", rebuild, { once: true });
        window.setTimeout(rebuild, 450);
        window.setTimeout(rebuild, 1400);

        prefersReducedMotion.addEventListener("change", runTechLoop);
    };

    const updateLeetCodeTheme = () => {
        const card = byId("leetcode-stats");
        if (!card) return;
        const darkSrc = card.dataset.srcDark;
        const lightSrc = card.dataset.srcLight;
        const target = isLight() ? lightSrc : darkSrc;
        if (!target) return;
        if (card.src !== target) {
            card.src = target;
        }
    };

    const updateAboutAvatarTheme = () => {
        const avatar = qs(".about-avatar");
        if (!avatar) return;
        const darkSrc = avatar.dataset.srcDark;
        const lightSrc = avatar.dataset.srcLight;
        const target = isLight() ? lightSrc : darkSrc;
        if (!target) return;
        if (avatar.src !== target) {
            avatar.src = target;
        }
    };

    const buildHeatmapDays = (days) => {
        const output = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        for (let offset = days - 1; offset >= 0; offset -= 1) {
            const date = new Date(now);
            date.setDate(now.getDate() - offset);
            output.push(date);
        }
        return output;
    };

    const formatDateKey = (date) => date.toISOString().slice(0, 10);

    const normalizeGitHubEvents = (events, keys) => {
        const map = new Map(keys.map((key) => [key, 0]));
        events.forEach((event) => {
            if (!event || !event.created_at) return;
            const key = String(event.created_at).slice(0, 10);
            if (!map.has(key)) return;
            const current = map.get(key) || 0;
            map.set(key, current + 1);
        });
        return map;
    };

    const levelFromCount = (count, maxCount) => {
        if (count <= 0) return 0;
        if (maxCount <= 1) return 4;
        const ratio = count / maxCount;
        if (ratio < 0.25) return 1;
        if (ratio < 0.5) return 2;
        if (ratio < 0.75) return 3;
        return 4;
    };

    const renderGitHubHeatmap = async () => {
        const grid = byId("gh-grid");
        if (!grid) return;

        const username = (body?.dataset.githubUser || "SpencerVJones").trim();
        const days = buildHeatmapDays(84);
        const keys = days.map(formatDateKey);
        let dayMap = new Map(keys.map((key) => [key, 0]));

        try {
            const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, {
                headers: { Accept: "application/vnd.github+json" },
            });
            if (!response.ok) throw new Error(`GitHub status ${response.status}`);
            const events = await response.json();
            if (Array.isArray(events)) {
                dayMap = normalizeGitHubEvents(events, keys);
            }
        } catch (_error) {
            // Keep zero-filled fallback map.
        }

        const maxCount = Math.max(0, ...Array.from(dayMap.values()));
        const fragment = document.createDocumentFragment();
        days.forEach((date) => {
            const key = formatDateKey(date);
            const count = dayMap.get(key) || 0;
            const level = levelFromCount(count, maxCount);
            const cell = document.createElement("span");
            cell.className = `gh-day${level > 0 ? ` level-${level}` : ""}`;
            cell.title = `${date.toLocaleDateString()}: ${count} event${count === 1 ? "" : "s"}`;
            fragment.appendChild(cell);
        });

        grid.innerHTML = "";
        grid.appendChild(fragment);
    };

    const renderSpotifyTrack = async () => {
        const title = byId("am-title");
        const artist = byId("am-artist");
        const meta = byId("am-meta");
        const status = byId("am-status");
        const artwork = byId("am-art");
        const artworkWrap = byId("am-art-wrap");
        const artworkFallback = byId("am-art-fallback");
        const openLink = byId("am-open");
        if (!title || !artist || !meta) return;

        const setStatus = (message, tone = "info") => {
            if (!status) return;
            status.textContent = message;
            status.dataset.tone = tone;
        };

        setStatus("Loading recent track...", "info");

        try {
            const response = await fetch(toApiUrl("/api/spotify/recent"), { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Spotify status ${response.status}`);
            }
            const payload = await response.json();

            const nextTitle = String(payload?.title || "No recent tracks");
            const nextArtist = String(payload?.artist || "Spotify");
            const nextMeta = String(payload?.meta || "Most recently played.");
            const nextArtwork = String(payload?.artworkUrl || "");
            const nextUrl = String(payload?.url || "");

            title.textContent = nextTitle;
            artist.textContent = nextArtist;
            meta.textContent = nextMeta;

            if (artwork && artworkFallback) {
                if (nextArtwork) {
                    artwork.src = nextArtwork;
                    artwork.hidden = false;
                    artworkFallback.hidden = true;
                    artwork.alt = `${nextTitle} cover art`;
                    artwork.classList.remove("is-spinning");
                    if (artworkWrap) {
                        artworkWrap.classList.add("has-image", "is-spinning");
                    }
                } else {
                    artwork.hidden = true;
                    artworkFallback.hidden = false;
                    artwork.removeAttribute("src");
                    artwork.alt = "";
                    artwork.classList.remove("is-spinning");
                    if (artworkWrap) {
                        artworkWrap.classList.remove("has-image", "is-spinning");
                    }
                }
            }

            if (openLink) {
                if (nextUrl) {
                    openLink.href = nextUrl;
                    openLink.hidden = false;
                } else {
                    openLink.hidden = true;
                }
            }

            setStatus(`Updated at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, "info");
        } catch (_error) {
            title.textContent = "Spotify unavailable";
            artist.textContent = "Try again in a moment";
            meta.textContent = "Unable to reach your recent tracks endpoint.";
            if (artwork) {
                artwork.hidden = true;
                artwork.classList.remove("is-spinning");
            }
            if (artworkWrap) {
                artworkWrap.classList.remove("has-image", "is-spinning");
            }
            if (artworkFallback) artworkFallback.hidden = false;
            if (openLink) openLink.hidden = true;
            setStatus("Could not load track data.", "error");
        }
    };

    const escapeHtml = (value) =>
        String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");

    const titleCaseWords = (value) =>
        String(value || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");

    const formatTopic = (topic) => titleCaseWords(String(topic || "").replace(/[-_]+/g, " "));

    const findProjectElements = () => {
        const section = byId("projects");
        if (!section) return null;

        const grid = qs(".projects-grid", section);
        if (!grid) return null;

        const tabs = qs(".projects-tabs", section);
        const search = qs(".projects-search", section);
        const select = qs(".projects-select", section);
        const count = qs(".projects-count", section);
        const pageMeta = qs(".projects-page-meta", section);
        const prevButton = qs('[data-page="prev"], .projects-page-btn.prev', section);
        const nextButton = qs('[data-page="next"], .projects-page-btn.next', section);

        return {
            section,
            grid,
            tabs,
            search,
            select,
            count,
            pageMeta,
            prevButton,
            nextButton,
        };
    };

    const normalizeProjectLanguage = (language) => {
        const value = String(language || "Other").trim();
        if (!value) return "Other";
        const lower = value.toLowerCase();
        if (lower.includes("jupyter")) return "Python";
        if (lower === "html" || lower === "css" || lower === "web") return "JavaScript";
        return value;
    };

    const rankLanguages = (repos) => {
        const order = ["all", "javascript", "python", "java", "swift", "c#", "other"];
        const counts = new Map();
        repos.forEach((repo) => {
            const lang = normalizeProjectLanguage(repo.language);
            counts.set(lang, (counts.get(lang) || 0) + 1);
        });
        const names = Array.from(counts.keys());
        names.sort((a, b) => {
            const ai = order.indexOf(String(a).toLowerCase());
            const bi = order.indexOf(String(b).toLowerCase());
            if (ai !== -1 || bi !== -1) {
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
            }
            const byCount = (counts.get(b) || 0) - (counts.get(a) || 0);
            if (byCount !== 0) return byCount;
            return a.localeCompare(b);
        });
        return { names, counts };
    };

    const ensureProjectTabs = (tabsNode, languages) => {
        if (!tabsNode) return;
        if (tabsNode.children.length > 0) return;

        const fragment = document.createDocumentFragment();
        const allButton = document.createElement("button");
        allButton.type = "button";
        allButton.className = "projects-tab";
        allButton.dataset.lang = "all";
        allButton.setAttribute("aria-pressed", "true");
        allButton.textContent = "All";
        fragment.appendChild(allButton);

        languages.forEach((language) => {
            const langValue = String(language || "Other").trim();
            const button = document.createElement("button");
            button.type = "button";
            button.className = "projects-tab";
            button.dataset.lang = langValue.toLowerCase();
            button.setAttribute("aria-pressed", "false");
            button.textContent = langValue;
            fragment.appendChild(button);
        });
        tabsNode.appendChild(fragment);
    };

    const formatCompactNumber = (value) => {
        const num = Number(value || 0);
        if (!Number.isFinite(num)) return "0";
        if (Math.abs(num) >= 1000) {
            return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
        }
        return String(Math.max(0, Math.floor(num)));
    };

    const formatUpdatedAgo = (iso) => {
        const timestamp = new Date(iso).getTime();
        if (!Number.isFinite(timestamp)) return "recently";
        const diffMs = Math.max(0, Date.now() - timestamp);
        const day = Math.floor(diffMs / 86400000);
        if (day >= 365) {
            const years = Math.floor(day / 365);
            return `${years}y ago`;
        }
        if (day >= 30) {
            const months = Math.floor(day / 30);
            return `${months}mo ago`;
        }
        if (day >= 1) return `${day}d ago`;
        const hours = Math.floor(diffMs / 3600000);
        if (hours >= 1) return `${hours}h ago`;
        const minutes = Math.floor(diffMs / 60000);
        if (minutes >= 1) return `${minutes}m ago`;
        return "just now";
    };

    const fetchPinnedProjects = async (username) => {
        try {
            const response = await fetch(toApiUrl(`/api/github/pinned?user=${encodeURIComponent(username)}`), {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) return new Set();
            const payload = await response.json().catch(() => ({}));
            const pinned = Array.isArray(payload?.pinned) ? payload.pinned : [];
            return new Set(pinned.map((name) => String(name || "").trim().toLowerCase()).filter(Boolean));
        } catch (_error) {
            return new Set();
        }
    };

    const isPinnedProject = (repo) => state.projectPinned.has(String(repo?.name || "").trim().toLowerCase());

    const sortProjects = (projects, mode) => {
        const items = [...projects];
        items.sort((a, b) => {
            const pinnedDelta = Number(isPinnedProject(b)) - Number(isPinnedProject(a));
            if (pinnedDelta !== 0) return pinnedDelta;

            if (mode === "stars") {
                const starsDelta = (b.stargazers_count || 0) - (a.stargazers_count || 0);
                if (starsDelta !== 0) return starsDelta;
            }

            if (mode === "name") {
                return a.name.localeCompare(b.name);
            }

            const updatedDelta = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            if (updatedDelta !== 0) return updatedDelta;
            return a.name.localeCompare(b.name);
        });
        return items;
    };

    const renderProjectCard = (repo, index) => {
        const description = String(repo.description || "").trim() || "No description provided yet.";
        const language = normalizeProjectLanguage(repo.language);
        const owner = String(repo?.owner?.login || body?.dataset.githubUser || "SpencerVJones").trim();
        const branch = String(repo?.default_branch || "main").trim();
        const ownerAvatar = String(repo?.owner?.avatar_url || "").trim();
        const topicTags = Array.isArray(repo.topics) ? repo.topics.filter(Boolean).slice(0, 3).map(formatTopic) : [];
        const isFeatured = isPinnedProject(repo);
        const tags = [language];
        if (topicTags.length) tags.push(topicTags[0]);
        if (repo.archived) tags.push("Archived");
        if (repo.fork) tags.push("Fork");

        const tagMarkup = tags
            .map((tag, tagIndex) => {
                const normalized = tag.toLowerCase();
                let className = "project-tag";
                let attributes = "";
                if (tagIndex === 0) className += " lang";
                if (tagIndex === 0) attributes = ` data-lang="${escapeHtml(normalized)}"`;
                if (normalized === "archived" || normalized === "fork") className += " status";
                return `<li class="${className}"${attributes}>${escapeHtml(tag)}</li>`;
            })
            .join("");

        const homepage = repo.homepage ? String(repo.homepage).trim() : "";
        const hasDemo = homepage && /^https?:\/\//i.test(homepage);
        const demoHref = hasDemo ? homepage : repo.html_url;
        const mediaLabel = hasDemo ? "demo" : "repository";
        const encodedOwner = encodeURIComponent(owner);
        const encodedRepo = encodeURIComponent(String(repo.name || ""));
        const encodedBranch = encodeURIComponent(branch);
        const demoBasePrimary = `https://raw.githubusercontent.com/${encodedOwner}/${encodedRepo}/${encodedBranch}/Demo`;
        const demoBaseSecondary = `https://raw.githubusercontent.com/${encodedOwner}/${encodedRepo}/${encodedBranch}/demo`;
        const demoJpg = `${demoBasePrimary}/demo.jpg`;
        const demoGif = `${demoBasePrimary}/demo.gif`;
        const demoJpgSecondary = `${demoBaseSecondary}/demo.jpg`;
        const demoGifSecondary = `${demoBaseSecondary}/demo.gif`;
        const fallbackPreview = `https://opengraph.githubassets.com/1/${encodedOwner}/${encodedRepo}`;
        const updatedAgo = formatUpdatedAgo(repo.updated_at);
        const sourceLinkMarkup = hasDemo
            ? `<a class="project-source-link" href="${escapeHtml(
                  repo.html_url
              )}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(
                  repo.name
              )} source code on GitHub" title="View source on GitHub">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path fill="currentColor" d="M12 2C6.47 2 2 6.58 2 12.26c0 4.5 2.87 8.33 6.84 9.68.5.1.68-.22.68-.5 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.19-1.12-1.5-1.12-1.5-.92-.65.07-.64.07-.64 1.02.07 1.55 1.07 1.55 1.07.9 1.58 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.32.1-2.75 0 0 .84-.28 2.75 1.05A9.1 9.1 0 0 1 12 6.9c.83 0 1.67.11 2.45.33 1.9-1.33 2.74-1.05 2.74-1.05.56 1.43.21 2.49.1 2.75.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.82-4.57 5.07.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .28.18.6.69.5 3.97-1.35 6.84-5.18 6.84-9.68C22 6.58 17.53 2 12 2Z" />
                    </svg>
                </a>`
            : "";

        return `
            <article class="project-card reveal-on-scroll tilt-card" style="--card-seq:${index}">
                    <div class="project-media">
                        <a class="project-media-link" href="${escapeHtml(demoHref)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(
            repo.name
        )} ${mediaLabel}">
                        <img
                            class="project-preview-img"
                            src="${escapeHtml(demoJpg)}"
                            data-demo-jpg="${escapeHtml(demoJpg)}"
                            data-demo-gif="${escapeHtml(demoGif)}"
                            data-demo-jpg-secondary="${escapeHtml(demoJpgSecondary)}"
                            data-demo-gif-secondary="${escapeHtml(demoGifSecondary)}"
                            data-fallback-preview="${escapeHtml(fallbackPreview)}"
                            data-current="jpg"
                            alt="${escapeHtml(repo.name)} demo preview"
                            loading="lazy"
                            decoding="async"
                        >
                        </a>
                        ${isFeatured ? `<span class="project-media-badge">Featured</span>` : ``}
                        ${sourceLinkMarkup}
                    </div>
                <div class="project-body">
                    <p class="project-owner">
                        ${
                            ownerAvatar
                                ? `<img class="project-owner-avatar" src="${escapeHtml(ownerAvatar)}" alt="" loading="lazy" decoding="async">`
                                : ``
                        }
                        <span class="project-owner-name">${escapeHtml(owner)}</span>
                    </p>
                    <h3 class="project-title">${escapeHtml(repo.name)}</h3>
                    <p class="project-description">${escapeHtml(description)}</p>
                    <ul class="project-tags">${tagMarkup}</ul>
                    <p class="project-meta">
                        <span class="project-meta-item">★ ${escapeHtml(formatCompactNumber(repo.stargazers_count || 0))}</span>
                        <span class="project-meta-dot">•</span>
                        <span class="project-meta-item">${escapeHtml(formatCompactNumber(repo.forks_count || 0))} forks</span>
                        <span class="project-meta-dot">•</span>
                        <span class="project-meta-item">Updated ${escapeHtml(updatedAgo)}</span>
                    </p>
                </div>
            </article>
        `;
    };

    const initProjectMediaPreviews = () => {
        const previews = qsa(".project-preview-img");
        if (!previews.length) return;

        previews.forEach((image) => {
            if (image.dataset.previewBound === "true") return;
            image.dataset.previewBound = "true";

            const demoJpg = String(image.dataset.demoJpg || "");
            const demoGif = String(image.dataset.demoGif || "");
            const demoJpgSecondary = String(image.dataset.demoJpgSecondary || "");
            const demoGifSecondary = String(image.dataset.demoGifSecondary || "");
            const fallbackPreview = String(image.dataset.fallbackPreview || "");
            const card = image.closest(".project-card");
            const media = image.closest(".project-media");

            const unique = (values) => [...new Set(values.filter(Boolean))];
            const jpgCandidates = unique([demoJpg, demoJpgSecondary]);
            const gifCandidates = unique([demoGif, demoGifSecondary]);
            let jpgIndex = 0;
            let gifIndex = 0;
            let gifUnavailable = false;
            let usingFallback = false;

            const setPreviewSource = (nextSource, mode) => {
                if (!nextSource || usingFallback) return;
                if (image.dataset.current === mode && image.src === nextSource) return;
                image.dataset.current = mode;
                image.src = nextSource;
            };

            const showFallback = () => {
                if (!fallbackPreview || usingFallback) return;
                usingFallback = true;
                image.dataset.current = "fallback";
                image.src = fallbackPreview;
                if (media) media.classList.add("is-fallback-preview");
            };

            const showJpg = () => {
                if (usingFallback || !jpgCandidates.length) return;
                jpgIndex = 0;
                setPreviewSource(jpgCandidates[jpgIndex], "jpg");
            };

            const showGif = () => {
                if (usingFallback || gifUnavailable || !gifCandidates.length) return;
                gifIndex = 0;
                setPreviewSource(gifCandidates[gifIndex], "gif");
            };

            image.addEventListener("error", () => {
                const current = String(image.dataset.current || "");
                if (current === "jpg") {
                    jpgIndex += 1;
                    if (jpgIndex < jpgCandidates.length) {
                        setPreviewSource(jpgCandidates[jpgIndex], "jpg");
                        return;
                    }
                    showFallback();
                    return;
                }
                if (current === "gif") {
                    gifIndex += 1;
                    if (gifIndex < gifCandidates.length) {
                        setPreviewSource(gifCandidates[gifIndex], "gif");
                        return;
                    }
                    gifUnavailable = true;
                    if (jpgCandidates.length) {
                        showJpg();
                    } else {
                        showFallback();
                    }
                    return;
                }
                if (current === "fallback" && media) {
                    media.classList.add("is-missing-preview");
                }
            });

            image.addEventListener("load", () => {
                if (!media) return;
                if (image.dataset.current === "fallback") {
                    media.classList.add("is-fallback-preview");
                } else {
                    media.classList.remove("is-fallback-preview", "is-missing-preview");
                }
            });

            if (card) {
                card.addEventListener("focusin", showGif);
                card.addEventListener("focusout", (event) => {
                    const next = event.relatedTarget;
                    if (next && card.contains(next)) return;
                    showJpg();
                });
                if (canUseHoverEffects()) {
                    card.addEventListener("pointerenter", showGif);
                    card.addEventListener("pointerleave", showJpg);
                }
            }
        });
    };

    const attachProjectRevealObserver = () => {
        if (prefersReducedMotion.matches) {
            qsa(".project-card.reveal-on-scroll").forEach((node) => node.classList.add("is-visible"));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );

        qsa(".project-card.reveal-on-scroll").forEach((node) => observer.observe(node));
    };

    const renderProjects = (ui, username) => {
        const langFilter = state.projectLang || "all";
        const query = (state.projectQuery || "").toLowerCase();
        const sortMode = state.projectSort || "updated";

        const filtered = state.projectCache.filter((repo) => {
            const normalizedLanguage = normalizeProjectLanguage(repo.language);
            if (langFilter !== "all" && normalizedLanguage.toLowerCase() !== langFilter.toLowerCase()) {
                return false;
            }
            if (!query) return true;
            const haystack = [repo.name, repo.description, normalizedLanguage, ...(Array.isArray(repo.topics) ? repo.topics : [])]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(query);
        });

        state.projectFiltered = sortProjects(filtered, sortMode);
        const totalItems = state.projectFiltered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / state.projectsPerPage));
        state.projectPage = clamp(state.projectPage, 1, totalPages);
        const start = (state.projectPage - 1) * state.projectsPerPage;
        const pageItems = state.projectFiltered.slice(start, start + state.projectsPerPage);
        if (!totalItems) {
            if (ui.grid) {
                ui.grid.innerHTML = `
                    <article class="project-card">
                        <div class="project-body">
                            <h3 class="project-title">No projects found</h3>
                            <p class="project-description">Try adjusting your filters or search query.</p>
                        </div>
                    </article>
                `;
            }
            if (ui.count) ui.count.textContent = "No projects found";
            if (ui.pageMeta) ui.pageMeta.textContent = "Page 1 of 1";
            if (ui.prevButton) ui.prevButton.disabled = true;
            if (ui.nextButton) ui.nextButton.disabled = true;
            return;
        }

        if (ui.grid) {
            ui.grid.innerHTML = pageItems.map((repo, index) => renderProjectCard(repo, index)).join("");
        }
        initProjectMediaPreviews();
        attachProjectRevealObserver();
        initMagneticInteractions();
        initSpotlightSurfaces();

        if (ui.count) {
            const sortLabel = ui.select?.options?.[ui.select.selectedIndex]?.textContent?.trim() || "Recently updated";
            ui.count.textContent = totalItems ? `Sorted by ${sortLabel}` : "No projects found";
        }
        if (ui.pageMeta) {
            ui.pageMeta.textContent = `Page ${state.projectPage} of ${totalPages}`;
        }
        if (ui.prevButton) ui.prevButton.disabled = state.projectPage <= 1;
        if (ui.nextButton) ui.nextButton.disabled = state.projectPage >= totalPages;
    };

    const bindProjectControls = (ui, username) => {
        if (ui.tabs) {
            ui.tabs.addEventListener("click", (event) => {
                const button = event.target.closest(".projects-tab");
                if (!button) return;
                state.projectLang = button.dataset.lang || "all";
                state.projectPage = 1;
                qsa(".projects-tab", ui.tabs).forEach((tab) => {
                    tab.setAttribute("aria-pressed", tab === button ? "true" : "false");
                });
                renderProjects(ui, username);
            });
        }

        if (ui.search) {
            let timer = 0;
            ui.search.addEventListener("input", () => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => {
                    state.projectQuery = ui.search.value.trim();
                    state.projectPage = 1;
                    renderProjects(ui, username);
                }, 120);
            });
        }

        if (ui.select) {
            ui.select.addEventListener("change", () => {
                state.projectSort = ui.select.value || "updated";
                state.projectPage = 1;
                renderProjects(ui, username);
            });
        }

        if (ui.prevButton) {
            ui.prevButton.addEventListener("click", () => {
                state.projectPage -= 1;
                renderProjects(ui, username);
            });
        }

        if (ui.nextButton) {
            ui.nextButton.addEventListener("click", () => {
                state.projectPage += 1;
                renderProjects(ui, username);
            });
        }
    };

    const initProjects = async () => {
        const ui = findProjectElements();
        if (!ui) return;

        const username = (body?.dataset.githubUser || "SpencerVJones").trim();
        const skeletonMarkup = (count) =>
            Array.from({ length: count })
                .map(
                    () => `
                        <article class="project-card skeleton">
                            <div class="project-body">
                                <div class="project-title"></div>
                                <div class="project-desc"></div>
                                <div class="project-desc short"></div>
                            </div>
                        </article>
                    `
                )
                .join("");
        if (ui.grid) {
            ui.grid.innerHTML = skeletonMarkup(state.projectsPerPage);
        }

        try {
            const pinnedPromise = fetchPinnedProjects(username);
            const response = await fetch(
                `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
                { headers: { Accept: "application/vnd.github+json" } }
            );
            if (!response.ok) throw new Error(`GitHub repos status ${response.status}`);
            const repos = await response.json();
            if (!Array.isArray(repos)) throw new Error("Invalid repositories payload");

            state.projectCache = repos.filter((repo) => {
                if (!repo || !repo.name) return false;
                const normalizedName = String(repo.name).toLowerCase();
                const normalizedUser = username.toLowerCase();
                return normalizedName !== normalizedUser;
            });
            state.projectPinned = await pinnedPromise;

            const { names: languages } = rankLanguages(state.projectCache);
            ensureProjectTabs(ui.tabs, languages);

            if (ui.select && !ui.select.value) {
                ui.select.value = "updated";
            }

            state.projectLang = "all";
            state.projectSort = ui.select?.value || "updated";
            state.projectQuery = "";
            state.projectPage = 1;

            bindProjectControls(ui, username);
            renderProjects(ui, username);
            initMagneticInteractions();
            initSpotlightSurfaces();
        } catch (_error) {
            if (ui.grid) {
                ui.grid.innerHTML = `
                    <article class="project-card">
                        <div class="project-body">
                            <h3 class="project-title">Unable to load projects</h3>
                            <p class="project-description">The GitHub API request failed. Try again in a moment.</p>
                        </div>
                    </article>
                `;
            }
        }
    };

    const initContactForm = () => {
        const form = qs("form.footer-form") || byId("contact-form");
        if (!form) return;

        const status = qs(".footer-form-status", form) || qs(".footer-form-status");
        const submit = qs('button[type="submit"], .button.primary', form);

        const setStatus = (message, tone) => {
            if (!status) return;
            status.textContent = message;
            if (tone) status.dataset.tone = tone;
        };

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const honeypot = String(formData.get("company") || "").trim();
            if (honeypot) {
                setStatus("Message blocked.", "error");
                return;
            }

            const name = String(formData.get("name") || "").trim();
            const email = String(formData.get("email") || "").trim();
            const subject = String(formData.get("subject") || "").trim();
            const message = String(formData.get("message") || "").trim();

            if (!name || !email || !subject || !message) {
                setStatus("Please fill out all fields.", "error");
                return;
            }

            if (submit) submit.disabled = true;
            setStatus("Sending message...", "info");

            const endpoint = form.dataset.endpoint || "https://formsubmit.co/ajax/SpencerVJones@Outlook.com";
            const payload = new FormData(form);
            payload.set("name", name);
            payload.set("email", email);
            payload.set("subject", subject);
            payload.set("message", message);
            payload.set("company", "");

            fetch(endpoint, {
                method: "POST",
                headers: { Accept: "application/json" },
                body: payload,
            })
                .then(async (response) => {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload?.error || "Unable to send message right now.");
                    }
                    const messageText = String(payload?.message || "").toLowerCase();
                    if (messageText.includes("activate")) {
                        setStatus("Action required: open your email and activate FormSubmit first.", "info");
                        return;
                    }

                    setStatus("Message sent. I will get back to you soon.", "success");
                    form.reset();
                })
                .catch((error) => {
                    setStatus(error.message || "Send failed. Please try again.", "error");
                })
                .finally(() => {
                    if (submit) submit.disabled = false;
                });
        });
    };

    const init = () => {
        initTheme();
        initNavMenu();
        initScrollProgress();
        initScrollTransitions();
        initHeroCanvas();
        addRevealTargets();
        initTilt();
        initMagneticInteractions();
        initSpotlightSurfaces();
        initTechIconFallbacks();
        initTechStackAutoScroll();
        renderGitHubHeatmap();
        renderSpotifyTrack();
        initProjects();
        initContactForm();

        window.setInterval(renderSpotifyTrack, 120000);
        window.setInterval(renderGitHubHeatmap, 600000);
    };

    runWhenReady(init);
})();
