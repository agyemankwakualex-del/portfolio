(function () {
  var root = document.documentElement;
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector("#site-nav");
  var navLabel = toggle ? toggle.querySelector(".nav-toggle-label") : null;
  var progress = document.querySelector(".progress span");
  var panels = Array.prototype.slice.call(document.querySelectorAll("[data-panel]"));
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var tilts = Array.prototype.slice.call(document.querySelectorAll("[data-tilt]"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#site-nav a[href^="#"]'));
  var sceneApi = null;
  var booting = false;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  function staticMode() {
    return root.classList.contains("is-static");
  }

  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (navLabel) navLabel.textContent = open ? "Close" : "Menu";
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });
  }

  var sectionWatch = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = "#" + entry.target.id;
        navLinks.forEach(function (link) {
          if (link.getAttribute("href") === id) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
  );
  document.querySelectorAll("main section[id]").forEach(function (section) {
    sectionWatch.observe(section);
  });

  function showReveals() {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  if (staticMode()) {
    showReveals();
  } else {
    var revealWatch = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealWatch.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    reveals.forEach(function (el) {
      revealWatch.observe(el);
    });
  }

  function resetTilt(node) {
    node.style.setProperty("--rx", "4deg");
    node.style.setProperty("--ry", "-6deg");
    node.style.setProperty("--gx", "50%");
    node.style.setProperty("--gy", "18%");
  }

  tilts.forEach(function (node) {
    resetTilt(node);
    node.addEventListener("pointermove", function (event) {
      if (staticMode() || !finePointer.matches) return;
      var rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var px = (event.clientX - rect.left) / rect.width - 0.5;
      var py = (event.clientY - rect.top) / rect.height - 0.5;
      node.style.setProperty("--ry", (px * 9).toFixed(2) + "deg");
      node.style.setProperty("--rx", (-py * 7).toFixed(2) + "deg");
      node.style.setProperty("--gx", ((px + 0.5) * 100).toFixed(1) + "%");
      node.style.setProperty("--gy", ((py + 0.5) * 100).toFixed(1) + "%");
    });
    node.addEventListener("pointerleave", function () {
      resetTilt(node);
    });
  });

  var scrollQueued = false;
  function updateScroll() {
    scrollQueued = false;
    var height = document.documentElement.scrollHeight - window.innerHeight;
    var progressValue = height > 0 ? window.scrollY / height : 0;
    if (progress) progress.style.transform = "scaleX(" + progressValue + ")";
    if (sceneApi) sceneApi.setScroll(progressValue);
    if (staticMode()) return;
    var vh = window.innerHeight || 1;
    var mobile = window.innerWidth < 800;
    var maxDeg = mobile ? 3.5 : 6.5;
    panels.forEach(function (panel) {
      var section = panel.parentElement;
      if (!section) return;
      var rect = section.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > vh + 80) {
        panel.style.transform = "none";
        return;
      }
      var delta = (rect.top - vh * 0.16) / vh;
      if (delta > 1) delta = 1;
      if (delta < -1) delta = -1;
      var deg = (delta * maxDeg).toFixed(2);
      var shift = (delta * (mobile ? 10 : 16)).toFixed(1);
      panel.style.transform =
        "perspective(1400px) rotateX(" + deg + "deg) translateY(" + shift + "px)";
    });
  }

  function requestScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateScroll);
  }

  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll);
  requestScroll();

  function enterStatic() {
    root.classList.remove("is-3d", "scene-ready");
    root.classList.add("is-static");
    if (sceneApi) {
      sceneApi.destroy();
      sceneApi = null;
    }
    panels.forEach(function (panel) {
      panel.style.transform = "none";
    });
    showReveals();
  }

  function bootScene() {
    if (booting || sceneApi || !root.classList.contains("is-3d")) return;
    var canvas = document.getElementById("scene");
    if (!canvas) return;
    booting = true;
    var scriptEl = document.querySelector("script[src*='main.js']");
    var sceneUrl = new URL("scene.bundle.js", scriptEl.src).href;
    import(sceneUrl)
      .then(function (mod) {
        booting = false;
        if (!root.classList.contains("is-3d")) return;
        sceneApi = mod.mountScene(canvas, {
          onReady: function () {
            root.classList.add("scene-ready");
          },
          onLost: function () {
            sceneApi = null;
            enterStatic();
          },
        });
        requestScroll();
      })
      .catch(function () {
        booting = false;
        enterStatic();
      });
  }

  function scheduleScene() {
    if (!root.classList.contains("is-3d")) return;
    var start = function () {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(bootScene, { timeout: 1500 });
      } else {
        setTimeout(bootScene, 250);
      }
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  }

  scheduleScene();

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.addEventListener) {
    reduce.addEventListener("change", function () {
      if (reduce.matches) enterStatic();
      else if (!sceneApi) {
        root.classList.remove("is-static");
        root.classList.add("is-3d");
        reveals.forEach(function (el) {
          el.classList.remove("is-in");
        });
        scheduleScene();
        requestScroll();
      }
    });
  }
})();
