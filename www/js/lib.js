/**
 * lib.js — Digital Library feature.
 * Fetches the book list live from arsa-siddanto.blogspot.com (label: "digital library"),
 * converts a selected book's post content into a PDF client-side, saves it locally via
 * Capacitor Filesystem, and tracks downloaded books via Capacitor Preferences.
 *
 * This feature requires internet access — unlike the offline scripture database.
 */

const BLOG_LABEL_FEED =
  "https://arsa-siddanto.blogspot.com/feeds/posts/default/-/" +
  encodeURIComponent("digital library") +
  "?alt=json&max-results=500";

const MANIFEST_KEY = "digitalLibraryManifest";

function fsPlugin() {
  return window.Capacitor.Plugins.Filesystem;
}
function prefsPlugin() {
  return window.Capacitor.Plugins.Preferences;
}

function extractPostId(idStr) {
  const m = /post-(\d+)/.exec(idStr || "");
  return m ? m[1] : (idStr || "").replace(/[^a-zA-Z0-9]/g, "").slice(-16);
}

function stripHtmlForFilename(title) {
  return (title || "book")
    .replace(/[^\u0980-\u09FF\u0900-\u097Fa-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60) || "book";
}

function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "vedaLibCallback_" + Date.now();
    const script = document.createElement("script");

    const cleanup = () => {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Blogger থেকে তালিকা আনা যায়নি (JSONP লোড ব্যর্থ)।"));
    };

    const sep = url.includes("?") ? "&" : "?";
    script.src = url + sep + "callback=" + callbackName;
    document.body.appendChild(script);

    setTimeout(() => {
      if (window[callbackName]) {
        cleanup();
        reject(new Error("সময় শেষ — Blogger থেকে কোনো সাড়া আসেনি।"));
      }
    }, 15000);
  });
}

async function fetchBlogBooks() {
  const url = BLOG_LABEL_FEED.replace("alt=json", "alt=json-in-script");
  const data = await jsonpFetch(url);
  const entries = (data.feed && data.feed.entry) || [];
  return entries.map((e) => {
    const id = extractPostId(e.id ? e.id.$t : "");
    const title = e.title ? e.title.$t : "শিরোনামহীন";
    const content = e.content ? e.content.$t : (e.summary ? e.summary.$t : "");
    const published = e.published ? e.published.$t : "";
    let link = "";
    if (e.link) {
      const alt = e.link.find((l) => l.rel === "alternate");
      if (alt) link = alt.href;
    }
    let thumbnail = null;
    if (e.media$thumbnail && e.media$thumbnail.url) {
      thumbnail = e.media$thumbnail.url.replace(/\/s72-c\//, "/s400/");
    }
    return { id, title, content, published, link, thumbnail };
  });
}

async function getManifest() {
  try {
    const res = await prefsPlugin().get({ key: MANIFEST_KEY });
    return res.value ? JSON.parse(res.value) : {};
  } catch (e) {
    return {};
  }
}

async function saveManifest(manifest) {
  await prefsPlugin().set({ key: MANIFEST_KEY, value: JSON.stringify(manifest) });
}

function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("html2pdf লোড করতে ব্যর্থ — ইন্টারনেট সংযোগ পরীক্ষা করুন।"));
    document.head.appendChild(script);
  });
}

async function downloadBook(book, onProgress) {
  onProgress && onProgress("html2pdf লোড হচ্ছে…");
  await loadHtml2Pdf();

  onProgress && onProgress("বইয়ের কন্টেন্ট প্রস্তুত হচ্ছে…");
  const container = document.createElement("div");
  container.className = "pdfRenderContainer"; // tagged for defensive sweep-cleanup elsewhere
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:760px;background:#fff;color:#000;padding:24px;font-family:'Noto Serif Bengali',Georgia,serif;font-size:16px;line-height:1.7;z-index:-1;pointer-events:none;";
  container.innerHTML = `<h1 style="font-size:24px;margin-bottom:16px;">${book.title}</h1>` + book.content;
  document.body.appendChild(container);

  function safeRemoveContainer() {
    try {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    } catch (e) {
      // never let cleanup failure break the caller
    }
  }

  onProgress && onProgress("PDF তৈরি হচ্ছে… (কিছুটা সময় লাগতে পারে)");
  const baseName = stripHtmlForFilename(book.title);

  async function renderToPdfBlob() {
    return window
      .html2pdf()
      .from(container)
      .set({
        margin: 10,
        filename: baseName + ".pdf",
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .outputPdf("blob");
  }

  try {
    let blob, filename, isPdf;
    try {
      blob = await renderToPdfBlob();
      filename = baseName + ".pdf";
      isPdf = true;
    } catch (renderErr1) {
      // Layer 2: strip all images and inline background-images —
      // the most common cause of "Unsupported image type" in html2canvas.
      onProgress && onProgress("ছবিতে সমস্যা হয়েছে — ছবি ছাড়া আবার চেষ্টা করা হচ্ছে…");
      container.querySelectorAll("img").forEach((img) => img.remove());
      container.querySelectorAll("*").forEach((el) => {
        if (el.style && el.style.backgroundImage) el.style.backgroundImage = "none";
      });
      try {
        blob = await renderToPdfBlob();
        filename = baseName + ".pdf";
        isPdf = true;
      } catch (renderErr2) {
        // Layer 3: guaranteed fallback — plain text file. No PDF library
        // dependency at all here, so this cannot itself fail from a library issue.
        onProgress && onProgress("সরল টেক্সট ফাইল হিসেবে সেভ করা হচ্ছে…");
        const plainText = book.title + "\n\n" + (container.innerText || container.textContent || "");
        blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
        filename = baseName + ".txt";
        isPdf = false;
      }
    }

    onProgress && onProgress("ফোনে সেভ হচ্ছে…");
    const base64Data = await blobToBase64(blob);

    await fsPlugin().writeFile({
      path: filename,
      data: base64Data,
      directory: "DOCUMENTS",
      recursive: true,
    });

    const manifest = await getManifest();
    manifest[book.id] = {
      title: book.title,
      filename,
      downloadedAt: new Date().toISOString(),
      isPdf,
    };
    await saveManifest(manifest);

    return { success: true, filename };
  } finally {
    safeRemoveContainer();
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function deleteBook(bookId) {
  const manifest = await getManifest();
  const entry = manifest[bookId];
  if (!entry) return;
  try {
    await fsPlugin().deleteFile({ path: entry.filename, directory: "DOCUMENTS" });
  } catch (e) {
    console.warn("File already missing or failed to delete:", e);
  }
  delete manifest[bookId];
  await saveManifest(manifest);
}

async function getFileUri(filename) {
  const res = await fsPlugin().getUri({ path: filename, directory: "DOCUMENTS" });
  return res.uri;
}

window.VedaLibrary = {
  fetchBlogBooks,
  getManifest,
  downloadBook,
  deleteBook,
  getFileUri,
};
