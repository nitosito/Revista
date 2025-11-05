/* Flipbook sin librerías externas: PDF -> imágenes con PDF.js, luego animación CSS de “pasar página”. */
const PDF_FILE = "magazine.pdf";

/* PDF.js worker */
const PDFJS_VERSION = "3.11.174";
const workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
// pdf.min.js expone window.pdfjsLib
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/* Elementos UI */
const loaderEl = document.getElementById("loader");
const errorEl = document.getElementById("error");
const bookEl = document.getElementById("book");
const downloadEl = document.getElementById("download");
const btnPrev = document.getElementById("prev");
const btnNext = document.getElementById("next");

/* Cache-buster para evitar caché cuando reemplaces el PDF */
const CACHE_BUSTER = Date.now();
const PDF_URL = `${PDF_FILE}?v=${CACHE_BUSTER}`;
downloadEl.href = PDF_URL;

/* Estado del flipbook */
let currentSheet = 0; // cuántas hojas se voltearon
let totalSheets = 0;  // total de hojas (cada hoja = 2 páginas)
let sheets = [];      // nodos .sheet

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

  // libera memoria
  canvas.width = 0;
  canvas.height = 0;

  return { dataUrl, width: viewport.width, height: viewport.height };
}

/* Construye el flipbook a partir de una lista de imágenes */
function buildFlipbook(images) {
  // Limpia
  bookEl.innerHTML = "";
  sheets = [];

  // Empareja páginas de a dos (frente/dorso)
  const pairs = [];
  for (let i = 0; i < images.length; i += 2) {
    pairs.push([images[i], images[i + 1] || null]);
  }
  totalSheets = pairs.length;

  // Crea hojas apiladas (la primera arriba con mayor z-index)
  for (let i = 0; i < totalSheets; i++) {
    const [rightImg, leftImg] = pairs[i];
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.style.zIndex = String(1000 - i); // más arriba al inicio

    // Cara frontal (derecha)
    const front = document.createElement("div");
    front.className = "face front";
    const imgR = document.createElement("img");
    imgR.alt = `Página ${i * 2 + 1}`;
    imgR.src = rightImg;
    front.appendChild(imgR);

    // Cara trasera (izquierda)
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

  currentSheet = 0;
  updateButtons();
}

/* Navegación */
function flipNext() {
  if (currentSheet >= totalSheets) return;
  const sheet = sheets[currentSheet];
  sheet.classList.add("flipped");

  // Tras la animación, envía la hoja al fondo
  setTimeout(() => {
    sheet.style.zIndex = String(10 + currentSheet);
  }, 800);

  currentSheet++;
  updateButtons();
}

function flipPrev() {
  if (currentSheet <= 0) return;
  const sheet = sheets[currentSheet - 1];
  sheet.classList.remove("flipped");
  sheet.style.zIndex = String(1000 - (currentSheet - 1));
  currentSheet--;
  updateButtons();
}

function updateButtons() {
  btnPrev.disabled = currentSheet === 0;
  btnNext.disabled = currentSheet === totalSheets;
}

/* Carga el PDF, convierte páginas a imágenes y crea el flipbook */
async function init() {
  try {
    // Comprobación rápida
    const head = await fetch(PDF_URL, { method: "HEAD", cache: "no-store" });
    const ct = (head.headers.get("content-type") || "").toLowerCase();
    if (!head.ok || !ct.includes("pdf")) {
      throw new Error("No se encontró magazine.pdf en la raíz o no es application/pdf.");
    }

    const loadingTask = pdfjsLib.getDocument({
      url: PDF_URL,
      disableStream: true,
      disableAutoFetch: true
    });
    const pdf = await loadingTask.promise;

    const images = [];
    const targetW = window.innerWidth > 1024 ? 1400 : 1000;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const img = await renderPageToImage(page, targetW);
      images.push(img.dataUrl);
      await new Promise((r) => setTimeout(r, 0));
    }

    buildFlipbook(images);

    // Listeners
    btnNext.addEventListener("click", flipNext);
    btnPrev.addEventListener("click", flipPrev);

    // Click en zonas: derecha avanza, izquierda retrocede
    bookEl.addEventListener("click", (e) => {
      const rect = bookEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x > rect.width / 2) flipNext();
      else flipPrev();
    });

    // Teclado
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") flipNext();
      if (e.key === "ArrowLeft") flipPrev();
    });

    loaderEl.style.display = "none";
  } catch (err) {
    console.error(err);
    loaderEl.style.display = "none";
    errorEl.hidden = false;
    errorEl.innerHTML = `No se pudo cargar el PDF. Detalle: ${err?.message || err}`;
  }
}

init();