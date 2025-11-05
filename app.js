/* Flipbook sin librerías externas + zoom, miniaturas y gestos. */
const PDF_FILE = "magazine.pdf";

/* PDF.js */
const PDFJS_VERSION = "3.11.174";
const workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/* UI */
const loaderEl = document.getElementById("loader");
const errorEl = document.getElementById("error");
const viewportEl = document.getElementById("viewport");
const bookEl = document.getElementById("book");
const singleEl = document.getElementById("single");
const pageIndicatorEl = document.getElementById("pageIndicator");
const thumbsEl = document.getElementById("thumbs");

const btnPrev = document.getElementById("prev");
const btnNext = document.getElementById("next");
const edgePrev = document.getElementById("edge-prev");
const edgeNext = document.getElementById("edge-next");
const btnZoomIn = document.getElementById("zoomIn");
const btnZoomOut = document.getElementById("zoomOut");
const downloadEl = document.getElementById("download");

/* Cache-buster para evitar caché cuando reemplaces el PDF */
const CACHE_BUSTER = Date.now();
const PDF_URL = `${PDF_FILE}?v=${CACHE_BUSTER}`;
downloadEl.href = PDF_URL;

/* Estado del documento */
let images = [];       // dataURLs por página
let totalPages = 0;
let totalSheets = 0;
let sheets = [];       // nodos .sheet (para modo doble)
let currentSheet = 0;  // cuántas hojas están volteadas (0..totalSheets)
let lastSelectedPage = 1; // página con “foco” (para modo una página y miniaturas)

/* Zoom */
let scale = 1;
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.5;
const STEP = 0.2;

/* Helpers de modo */
const isSingleMode = () => window.matchMedia("(max-width: 768px)").matches;

function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

/* Páginas visibles según currentSheet */
function getVisiblePages() {
  if (currentSheet === 0) return { left: null, right: 1 };
  if (currentSheet >= totalSheets) return { left: totalPages, right: null };
  return { left: currentSheet * 2, right: currentSheet * 2 + 1 };
}

/* Renderiza una página PDF a imagen (DataURL) */
async function renderPageToImage(page, targetWidth = 1200) {
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(targetWidth / initialViewport.width, 2.5);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/webp", 0.92);

  canvas.width = 0;
  canvas.height = 0;

  return { dataUrl, width: viewport.width, height: viewport.height };
}

/* Construye el flipbook de doble página */
function buildFlipbook() {
  bookEl.innerHTML = "";
  sheets = [];

  // pares [impar, par]
  const pairs = [];
  for (let i = 0; i < images.length; i += 2) {
    pairs.push([images[i], images[i + 1] || null]);
  }
  totalSheets = pairs.length;

  for (let i = 0; i < totalSheets; i++) {
    const [rightImg, leftImg] = pairs[i];
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.style.zIndex = String(1000 - i);

    const front = document.createElement("div");
    front.className = "face front";
    const imgR = document.createElement("img");
    imgR.alt = `Página ${i * 2 + 1}`;
    imgR.src = rightImg;
    front.appendChild(imgR);

    const back = document.createElement("div");
    back.className = "face back";
    if (leftImg) {
      const imgL = document.createElement("img");
      imgL.alt = `Página ${i * 2 + 2}`;
      imgL.src = leftImg;
      back.appendChild(imgL);
    } else {
      back.style.background = "#f3f4f6";
    }

    sheet.appendChild(front);
    sheet.appendChild(back);
    bookEl.appendChild(sheet);
    sheets.push(sheet);
  }
}

/* Miniaturas */
function buildThumbnails() {
  thumbsEl.innerHTML = "";
  images.forEach((src, idx) => {
    const t = document.createElement("button");
    t.className = "thumb";
    t.title = `Ir a página ${idx + 1}`;
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Miniatura página ${idx + 1}`;
    t.appendChild(img);
    t.addEventListener("click", () => {
      goToPage(idx + 1);
    });
    thumbsEl.appendChild(t);
  });
  highlightThumb(getFocusPage());
}

function highlightThumb(page) {
  const children = Array.from(thumbsEl.children);
  children.forEach((c, i) => c.classList.toggle("active", i + 1 === page));
}

/* Actualiza indicador y botones */
function updateIndicator() {
  const vis = getVisiblePages();
  if (isSingleMode()) {
    const p = getFocusPage();
    pageIndicatorEl.textContent = `Página ${p}/${totalPages}`;
    highlightThumb(p);
  } else {
    const left = vis.left ? `${vis.left}` : "—";
    const right = vis.right ? `${vis.right}` : "—";
    pageIndicatorEl.textContent = `Página ${left}–${right}/${totalPages}`;
    // resalta la página izquierda si existe; si no, la derecha
    highlightThumb(vis.left || vis.right || 1);
  }
  btnPrev.disabled = isSingleMode() ? getFocusPage() <= 1 : currentSheet === 0;
  btnNext.disabled = isSingleMode() ? getFocusPage() >= totalPages : currentSheet === totalSheets;
}

/* Zoom aplicado al contenedor activo */
function applyScale(targetEl, origin) {
  const s = clamp(scale, MIN_SCALE, MAX_SCALE);
  targetEl.style.transformOrigin = origin || "50% 50%";
  targetEl.style.transform = `scale(${s})`;
}

function zoomIn() {
  scale = clamp(scale + STEP, MIN_SCALE, MAX_SCALE);
  if (isSingleMode()) {
    const img = singleEl.querySelector("img");
    if (img) applyScale(img);
  } else {
    applyScale(bookEl);
  }
}

function zoomOut() {
  scale = clamp(scale - STEP, MIN_SCALE, MAX_SCALE);
  if (isSingleMode()) {
    const img = singleEl.querySelector("img");
    if (img) applyScale(img);
  } else {
    applyScale(bookEl);
  }
}

function toggleZoomAtPoint(clientX, clientY) {
  const target = isSingleMode() ? singleEl.querySelector("img") : bookEl;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const ox = ((clientX - rect.left) / rect.width) * 100;
  const oy = ((clientY - rect.top) / rect.height) * 100;
  const origin = `${ox}% ${oy}%`;

  // Alterna entre 1 y 2 (o el último)
  scale = scale <= 1 ? 2 : 1;
  applyScale(target, origin);

  // centra scroll si hay viewport
  if (!isSingleMode()) {
    setTimeout(() => {
      // intenta centrar hacia el punto
      const vp = viewportEl;
      const cX = (clientX - vp.getBoundingClientRect().left) + vp.scrollLeft;
      const cY = (clientY - vp.getBoundingClientRect().top) + vp.scrollTop;
      vp.scrollTo({ left: cX - vp.clientWidth / 2, top: cY - vp.clientHeight / 2, behavior: "smooth" });
    }, 0);
  }
}

/* Navegación por hojas (doble página) */
function flipNext() {
  if (currentSheet >= totalSheets) return;
  const sheet = sheets[currentSheet];
  sheet.classList.add("flipped");
  setTimeout(() => { sheet.style.zIndex = String(10 + currentSheet); }, 800);
  currentSheet++;
  updateIndicator();
}

function flipPrev() {
  if (currentSheet <= 0) return;
  const sheet = sheets[currentSheet - 1];
  sheet.classList.remove("flipped");
  sheet.style.zIndex = String(1000 - (currentSheet - 1));
  currentSheet--;
  updateIndicator();
}

/* Ir a una página concreta (1-based) */
function goToPage(page) {
  page = clamp(page, 1, totalPages);
  lastSelectedPage = page;

  // Número de hojas volteadas = floor(page/2)
  const flippedCount = Math.floor(page / 2);

  sheets.forEach((sheet, i) => {
    if (i < flippedCount) {
      sheet.classList.add("flipped");
      sheet.style.zIndex = String(10 + i); // al fondo
    } else {
      sheet.classList.remove("flipped");
      sheet.style.zIndex = String(1000 - i);
    }
  });

  currentSheet = flippedCount;
  // Actualiza imagen en modo una página
  if (isSingleMode()) renderSinglePage(page);

  updateIndicator();
}

/* Página “en foco” para modo una página */
function getFocusPage() {
  if (isSingleMode()) return clamp(lastSelectedPage, 1, totalPages);
  const vis = getVisiblePages();
  return vis.right || vis.left || 1;
}

/* Render de una página en el contenedor #single */
function renderSinglePage(page) {
  singleEl.innerHTML = "";
  const img = document.createElement("img");
  img.alt = `Página ${page}`;
  img.src = images[page - 1];
  singleEl.appendChild(img);
  // aplica zoom actual
  applyScale(img);
}

/* Activar modo según tamaño */
function applyLayoutMode() {
  const single = isSingleMode();
  viewportEl.hidden = single;
  bookEl.style.transform = single ? "" : `scale(${scale})`;
  singleEl.hidden = !single;

  if (single) {
    // asegúrate de que haya una página seleccionada
    const p = clamp(lastSelectedPage || (getVisiblePages().right || getVisiblePages().left || 1), 1, totalPages);
    renderSinglePage(p);
  } else {
    // al volver a doble, posiciona hojas según lastSelectedPage
    goToPage(lastSelectedPage || 1);
  }
  updateIndicator();
}

/* Gestos táctiles (swipe y doble toque) */
function setupGestures() {
  let touchStartX = 0, touchStartY = 0, lastTapTime = 0;

  function onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;

    const now = Date.now();
    if (now - lastTapTime < 300) {
      // doble toque
      toggleZoomAtPoint(t.clientX, t.clientY);
      e.preventDefault();
    }
    lastTapTime = now;
  }

  function onTouchEnd(e) {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
      if (dx < 0) next(); else prev();
    }
  }

  // En modo una página, gestiona en #single; en doble, en #viewport
  singleEl.addEventListener("touchstart", onTouchStart, { passive: true });
  singleEl.addEventListener("touchend", onTouchEnd, { passive: true });
  viewportEl.addEventListener("touchstart", onTouchStart, { passive: true });
  viewportEl.addEventListener("touchend", onTouchEnd, { passive: true });
}

/* Navegación unificada (respeta modo actual) */
function next() {
  if (isSingleMode()) {
    goToPage(clamp(getFocusPage() + 1, 1, totalPages));
  } else {
    flipNext();
  }
}
function prev() {
  if (isSingleMode()) {
    goToPage(clamp(getFocusPage() - 1, 1, totalPages));
  } else {
    flipPrev();
  }
}

/* Inicialización principal */
async function init() {
  try {
    // HEAD rápido
    const head = await fetch(PDF_URL, { method: "HEAD", cache: "no-store" });
    const ct = (head.headers.get("content-type") || "").toLowerCase();
    if (!head.ok || !ct.includes("pdf")) {
      throw new Error("No se encontró magazine.pdf en la raíz o no es application/pdf.");
    }

    // Cargar PDF
    const loadingTask = pdfjsLib.getDocument({
      url: PDF_URL,
      disableStream: true,
      disableAutoFetch: true
    });
    const pdf = await loadingTask.promise;

    const targetW = window.innerWidth > 1024 ? 1400 : 1000;
    images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const img = await renderPageToImage(page, targetW);
      images.push(img.dataUrl);
      await new Promise((r) => setTimeout(r, 0));
    }

    totalPages = images.length;

    // Construye UI
    buildFlipbook();
    buildThumbnails();
    currentSheet = 0;
    lastSelectedPage = 1;
    updateIndicator();

    // Listeners
    btnNext.addEventListener("click", next);
    btnPrev.addEventListener("click", prev);
    edgeNext.addEventListener("click", next);
    edgePrev.addEventListener("click", prev);

    btnZoomIn.addEventListener("click", zoomIn);
    btnZoomOut.addEventListener("click", zoomOut);

    // Doble clic para zoom
    viewportEl.addEventListener("dblclick", (e) => toggleZoomAtPoint(e.clientX, e.clientY));
    singleEl.addEventListener("dblclick", (e) => toggleZoomAtPoint(e.clientX, e.clientY));

    // Click en libro: derecha avanza, izquierda retrocede (sólo doble página)
    bookEl.addEventListener("click", (e) => {
      if (isSingleMode()) return;
      const rect = bookEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x > rect.width / 2) next(); else prev();
    });

    // Gestos táctiles
    setupGestures();

    // Modo según tamaño
    applyLayoutMode();
    window.addEventListener("resize", () => {
      applyLayoutMode();
    });

    // Aplica zoom inicial (1x)
    scale = 1;
    applyScale(bookEl);

    loaderEl.style.display = "none";
  } catch (err) {
    console.error(err);
    loaderEl.style.display = "none";
    errorEl.hidden = false;
    errorEl.innerHTML = `No se pudo cargar el PDF. Detalle: ${err?.message || err}`;
  }
}

init();
