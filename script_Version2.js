/* Configuración base */
const PDF_FILE = "magazine.pdf";

/* PDF.js worker (obligatorio indicar ruta del worker) */
const PDFJS_VERSION = "3.11.174";
const workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
const pdfjsLib = window["pdfjs-dist/build/pdf"];
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/* Elementos UI */
const loaderEl = document.getElementById("loader");
const errorEl = document.getElementById("error");
const flipbookEl = document.getElementById("flipbook");
const downloadEl = document.getElementById("download");

/* Cache-buster para que al reemplazar magazine.pdf se vea al instante */
const CACHE_BUSTER = Date.now();
const PDF_URL = `${PDF_FILE}?v=${CACHE_BUSTER}`;
downloadEl.href = `${PDF_FILE}?v=${CACHE_BUSTER}`;

/* Utilidad: renderiza una página PDF a imagen (DataURL) */
async function renderPageToImage(page, targetWidth = 1200) {
  // Calcula escala según el ancho deseado
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(targetWidth / initialViewport.width, 2.5); // limita escala máx. por memoria
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // WEBP suele ser más ligero que PNG; si Safari antiguo da problema, cambiar a "image/jpeg"
  const dataUrl = canvas.toDataURL("image/webp", 0.92);
  // Limpia canvas para liberar memoria
  canvas.width = 0;
  canvas.height = 0;

  return { dataUrl, width: viewport.width, height: viewport.height };
}

/* Carga el PDF, convierte sus páginas a imágenes y crea el flipbook */
async function init() {
  try {
    const loadingTask = pdfjsLib.getDocument(PDF_URL);
    const pdf = await loadingTask.promise;

    // Render secuencial para evitar picos de memoria
    const images = [];
    let firstSize = { width: 800, height: 1100 };

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const img = await renderPageToImage(page, window.innerWidth > 1024 ? 1400 : 1000);
      images.push(img.dataUrl);
      if (i === 1) {
        firstSize = { width: img.width, height: img.height };
      }

      // Pequeño yield para no bloquear la UI en PDFs largos
      await new Promise((r) => setTimeout(r, 0));
    }

    // Inicializa PageFlip
    const usePortrait = window.innerWidth < 900;
    const flip = new St.PageFlip(flipbookEl, {
      width: Math.min(firstSize.width, 900),
      height: Math.min(firstSize.height, 1200),
      size: "stretch",
      minWidth: 315,
      minHeight: 420,
      maxWidth: 2400,
      maxHeight: 3200,
      showCover: false,
      usePortrait,
      autoSize: true,
      mobileScrollSupport: true,
      maxShadowOpacity: 0.3,
      flippingTime: 650
    });

    flip.loadFromImages(images);

    // Oculta loader
    loaderEl.style.display = "none";

    // Accesibilidad básica con teclado
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") flip.flipNext();
      if (e.key === "ArrowLeft") flip.flipPrev();
    });

    // Reajusta en rotación móvil
    window.addEventListener("orientationchange", () => {
      setTimeout(() => flip.update(), 250);
    });
    window.addEventListener("resize", () => {
      // Evita recálculos excesivos
      clearTimeout(window.__flipResizeTimer);
      window.__flipResizeTimer = setTimeout(() => flip.update(), 150);
    });
  } catch (err) {
    console.error(err);
    loaderEl.style.display = "none";
    errorEl.hidden = false;
  }
}

init();