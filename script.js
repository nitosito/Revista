/* Configuración base */
const PDF_FILE = "magazine.pdf";

/* PDF.js worker */
const PDFJS_VERSION = "3.11.174";
const workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

// Importante: la variable global correcta expuesta por pdf.min.js es "pdfjsLib"
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/* Elementos UI */
const loaderEl = document.getElementById("loader");
const errorEl = document.getElementById("error");
const flipbookEl = document.getElementById("flipbook");
const downloadEl = document.getElementById("download");

/* Cache-buster */
const CACHE_BUSTER = Date.now();

function pdfUrl(withBuster = true) {
  return withBuster ? `${PDF_FILE}?v=${CACHE_BUSTER}` : PDF_FILE;
}

downloadEl.href = pdfUrl(true);

/* HEAD helper para comprobar existencia y tipo */
async function headOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    console.log("HEAD", url, res.status, ct);
    return { ok: res.ok, status: res.status, contentType: ct };
  } catch (e) {
    console.warn("HEAD failed", url, e);
    return { ok: false, status: 0, contentType: "" };
  }
}

async function resolvePdfUrl() {
  const first = pdfUrl(true);
  const h1 = await headOk(first);
  if (h1.ok && h1.contentType.includes("pdf")) return first;

  const second = pdfUrl(false);
  const h2 = await headOk(second);
  if (h2.ok && h2.contentType.includes("pdf")) {
    // Ajusta también el botón de descarga si el buster falló
    downloadEl.href = second;
    return second;
  }

  let reason = "No se encontró magazine.pdf.";
  if (h1.status === 404 && h2.status === 404) {
    reason = "404: magazine.pdf no está en la misma carpeta que index.html o el nombre no coincide (respeta mayúsculas/minúsculas).";
  } else if (!h1.ok && !h2.ok) {
    reason = "No se pudo consultar el archivo (conexión o publicación de GitHub Pages aún en progreso).";
  } else if (!(h1.contentType + h2.contentType).includes("pdf")) {
    reason = "El servidor no está devolviendo application/pdf (¿archivo subido con Git LFS o extensión incorrecta?).";
  }

  throw new Error(reason);
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

  // WEBP suele ser más ligero; si Safari antiguo falla, cambia a "image/jpeg"
  const dataUrl = canvas.toDataURL("image/webp", 0.92);

  canvas.width = 0;
  canvas.height = 0;

  return { dataUrl, width: viewport.width, height: viewport.height };
}

/* Carga el PDF, convierte páginas a imágenes y crea el flipbook */
async function init() {
  try {
    const url = await resolvePdfUrl();
    console.log("Usando PDF:", url);

    const loadingTask = pdfjsLib.getDocument({
      url,
      disableStream: true,
      disableAutoFetch: true
    });
    const pdf = await loadingTask.promise;

    const images = [];
    let firstSize = { width: 800, height: 1100 };

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const img = await renderPageToImage(page, window.innerWidth > 1024 ? 1400 : 1000);
      images.push(img.dataUrl);
      if (i === 1) firstSize = { width: img.width, height: img.height };
      await new Promise((r) => setTimeout(r, 0));
    }

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
    loaderEl.style.display = "none";

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") flip.flipNext();
      if (e.key === "ArrowLeft") flip.flipPrev();
    });

    window.addEventListener("orientationchange", () => {
      setTimeout(() => flip.update(), 250);
    });
    window.addEventListener("resize", () => {
      clearTimeout(window.__flipResizeTimer);
      window.__flipResizeTimer = setTimeout(() => flip.update(), 150);
    });
  } catch (err) {
    console.error(err);
    loaderEl.style.display = "none";
    errorEl.hidden = false;
    errorEl.innerHTML = `No se pudo cargar el PDF. Detalle: ${err?.message || err}`;
  }
}

init();
