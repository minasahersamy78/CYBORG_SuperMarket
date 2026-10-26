"""
Supermarket Products Viewer — Premium GUI
==========================================
Displays every product from the Excel file in a scrollable card grid.
Each card shows:
  • Product image (fetched from CDN with lazy loading & caching)
  • Product name
  • Product price in EGP (highlighted in bright emerald green)
  • Realistic barcode graphic sticker (matching packaging barcodes)

Features:
  • Dark-themed modern UI with rounded card aesthetics
  • Search / filter by product name, barcode, or price
  • Lazy image loading (images load as cards scroll into view)
  • Thread pool image downloads with CDN headers — UI stays responsive
  • In-memory image & barcode caches to avoid repeated generation
  • Responsive grid that adapts to window width
"""

import tkinter as tk
from tkinter import ttk
from openpyxl import load_workbook
from PIL import Image, ImageTk, ImageDraw, ImageFont
import io
import os
import re
import threading
import concurrent.futures
import urllib.request
import ssl
import time

# Barcode generator
try:
    import barcode
    from barcode.writer import ImageWriter
    _HAS_BARCODE_LIB = True
    _c128 = barcode.get_barcode_class("code128")
except ImportError:
    _HAS_BARCODE_LIB = False
    _c128 = None

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_LOCAL_EXCEL = os.path.join(_SCRIPT_DIR, "super_market.xlsx")
WORKBOOK = _LOCAL_EXCEL if os.path.exists(_LOCAL_EXCEL) else r"D:\project\data\super_market.xlsx"
CARD_WIDTH     = 230
CARD_HEIGHT    = 375
IMG_SIZE       = (160, 160)
BARCODE_SIZE   = (190, 50)
PRELOAD_MARGIN = 500          # pixels ahead of viewport to start loading
DOWNLOAD_WORKERS = 8          # concurrent image download workers

# Colours (dark theme)
BG_COLOR       = "#0f0f1a"
CARD_BG        = "#1a1a2e"
CARD_HOVER     = "#252545"
TEXT_PRIMARY   = "#e8e8f0"
TEXT_SECONDARY = "#9a9ab0"
PRICE_COLOR    = "#22c55e"    # Vibrant emerald green
ACCENT         = "#6c63ff"
ACCENT_DARK    = "#524bca"
SEARCH_BG      = "#1e1e35"
SEARCH_FG      = "#c8c8e0"
SCROLLBAR_BG   = "#15152a"
SCROLLBAR_FG   = "#3a3a5c"
STATUS_BG      = "#12122a"
BORDER_COLOR   = "#2a2a4a"
PLACEHOLDER_BG = "#252540"

# SSL context (skip cert verification for CDN URLs)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# Headers required by Carrefour / MAF Akamai CDN to serve images instead of HTML stubs
CDN_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Encoding": "identity",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.carrefouregypt.com/",
}


# ---------------------------------------------------------------------------
# Load data from Excel
# ---------------------------------------------------------------------------
def load_products():
    book = load_workbook(WORKBOOK, read_only=True, data_only=True)
    sheet = book["products"]

    headers = [cell.value for cell in sheet[1]]
    columns = {str(name).casefold(): idx for idx, name in enumerate(headers)}

    products = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        name = row[columns["englishproductname"]]
        barcode_val = row[columns["barcode"]]
        price_val = row[columns["price"]]
        image = row[columns["image"]]  # URL(s)
        products.append({
            "name": name or "Unnamed product",
            "barcode": str(barcode_val or ""),
            "price": price_val,
            "image": _first_url(image or ""),
        })
    book.close()
    return products


def _format_price(val) -> str:
    """Format numeric price with 2 decimal places and currency."""
    if val is None or val == "":
        return "Price N/A"
    try:
        num = float(val)
        return f"{num:,.2f} EGP"
    except Exception:
        return f"{val} EGP"


def _first_url(raw: str) -> str:
    """Return the first http(s) URL found in the cell value, optimized for card display."""
    if not raw:
        return ""
    cleaned = str(raw).replace("\r\n", "\n").replace("_x000D_", "\n").replace("\r", "\n")
    for part in cleaned.split("\n"):
        part = part.strip()
        if part.startswith("http"):
            # Resize from massive 1700px down to 400px for 5x faster download & crisp card display
            part = re.sub(r"Resize=\d+", "Resize=400", part)
            return part
    return ""


# ---------------------------------------------------------------------------
# Image & Barcode helpers
# ---------------------------------------------------------------------------
image_cache: dict[str, ImageTk.PhotoImage] = {}
barcode_cache: dict[str, ImageTk.PhotoImage] = {}
_placeholder_photo = None


def _create_placeholder(size: tuple[int, int]) -> Image.Image:
    """Create a placeholder image with a subtle icon."""
    img = Image.new("RGBA", size, PLACEHOLDER_BG)
    draw = ImageDraw.Draw(img)
    cx, cy = size[0] // 2, size[1] // 2
    r = 28
    # Simple camera-like icon
    draw.rounded_rectangle(
        [cx - r, cy - r + 5, cx + r, cy + r - 5],
        radius=8, fill="#35354f", outline="#45456a", width=2
    )
    draw.ellipse([cx - 10, cy - 6, cx + 10, cy + 10], fill="#45456a", outline="#55558a", width=2)
    return img


def _draw_fallback_barcode(text: str, w: int, h: int) -> Image.Image:
    """Draw a fallback realistic barcode using pure PIL if barcode library is unavailable."""
    img = Image.new("RGBA", (w, h), "#ffffff")
    draw = ImageDraw.Draw(img)
    clean = re.sub(r"[^0-9A-Za-z]", "", text) or "0000000000000"
    
    # Hash-based deterministic stripe widths
    import hashlib
    h_bytes = hashlib.md5(clean.encode()).digest()
    x = 8
    bit_idx = 0
    bar_h = h - 15
    while x < w - 8:
        byte_val = h_bytes[(bit_idx // 8) % len(h_bytes)]
        bit = (byte_val >> (bit_idx % 8)) & 1
        bar_w = 2 if bit else 1
        draw.rectangle([x, 3, x + bar_w - 1, bar_h], fill="#000000")
        x += bar_w + (1 if (bit_idx % 3 == 0) else 2)
        bit_idx += 1

    # Centered barcode text underneath
    draw.text((w // 2, h - 7), clean, fill="#111111", anchor="mm")
    return img


def _generate_barcode_photo(barcode_str: str, target_w: int = 190, target_h: int = 50) -> ImageTk.PhotoImage:
    """Generate a realistic product barcode sticker image with bars and number below."""
    if barcode_str in barcode_cache:
        return barcode_cache[barcode_str]

    clean_bc = re.sub(r"[^0-9A-Za-z]", "", str(barcode_str).strip())
    if not clean_bc:
        clean_bc = "0000000000000"

    raw_img = None
    if _HAS_BARCODE_LIB and _c128:
        try:
            b_obj = _c128(clean_bc, writer=ImageWriter())
            raw_img = b_obj.render(writer_options={
                "module_height": 7.0,
                "module_width": 0.22,
                "font_size": 8,
                "text_distance": 2.5,
                "quiet_zone": 1.5,
                "background": "#ffffff",
                "foreground": "#000000",
            })
            raw_resized = raw_img.resize((target_w - 10, target_h - 6), Image.LANCZOS)
        except Exception:
            raw_resized = _draw_fallback_barcode(clean_bc, target_w - 10, target_h - 6)
    else:
        raw_resized = _draw_fallback_barcode(clean_bc, target_w - 10, target_h - 6)

    # Place on rounded white sticker container
    sticker = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sticker)
    draw.rounded_rectangle(
        [0, 0, target_w - 1, target_h - 1],
        radius=6, fill="#ffffff", outline="#cfd0db", width=1
    )
    ox = (target_w - raw_resized.width) // 2
    oy = (target_h - raw_resized.height) // 2
    sticker.paste(raw_resized, (ox, oy), raw_resized if raw_resized.mode == "RGBA" else None)

    photo = ImageTk.PhotoImage(sticker)
    barcode_cache[barcode_str] = photo
    return photo


def _fetch_image(url: str) -> Image.Image | None:
    """Download an image from *url* with proper CDN headers and return a PIL Image."""
    if not url:
        return None
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers=CDN_HEADERS)
            with urllib.request.urlopen(req, timeout=10, context=ssl_ctx) as resp:
                data = resp.read()
            # Akamai CDN returns a 53-byte HTML stub if blocked/invalid
            if len(data) < 200:
                continue
            img = Image.open(io.BytesIO(data))
            return img.convert("RGBA")
        except Exception:
            if attempt == 0:
                time.sleep(0.3)
            continue
    return None


# ---------------------------------------------------------------------------
# GUI Application
# ---------------------------------------------------------------------------
class SupermarketViewer:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("🛒  Supermarket Products Viewer")
        self.root.geometry("1280x850")
        self.root.minsize(800, 600)
        self.root.configure(bg=BG_COLOR)

        try:
            self.root.iconbitmap(default="")
        except Exception:
            pass

        self.products: list[dict] = []
        self.filtered_indices: list[int] = []
        self.card_widgets: list[dict] = []
        self._loading_urls: set[str] = set()
        self._columns = 4
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS)
        self._lazy_timer = None

        self._build_ui()
        self._load_data()

    # ------------------------------------------------------------------ UI
    def _build_ui(self):
        # ---- Header ----
        header = tk.Frame(self.root, bg=BG_COLOR, height=80)
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)

        header_inner = tk.Frame(header, bg=BG_COLOR)
        header_inner.pack(fill="x", padx=30, pady=15)

        title_lbl = tk.Label(
            header_inner,
            text="🛒  Supermarket Products",
            font=("Segoe UI", 22, "bold"),
            fg=TEXT_PRIMARY, bg=BG_COLOR,
        )
        title_lbl.pack(side="left")

        self.count_lbl = tk.Label(
            header_inner,
            text="Loading…",
            font=("Segoe UI", 11),
            fg=TEXT_SECONDARY, bg=BG_COLOR,
        )
        self.count_lbl.pack(side="left", padx=(16, 0), pady=(6, 0))

        # Search bar
        search_frame = tk.Frame(header_inner, bg=SEARCH_BG, highlightbackground=BORDER_COLOR,
                                highlightthickness=1, padx=12, pady=6)
        search_frame.pack(side="right")

        self.search_icon = tk.Label(search_frame, text="🔍", font=("Segoe UI", 12),
                                    bg=SEARCH_BG, fg=TEXT_SECONDARY)
        self.search_icon.pack(side="left")

        self.search_var = tk.StringVar()
        self.search_entry = tk.Entry(
            search_frame,
            textvariable=self.search_var,
            font=("Segoe UI", 12),
            bg=SEARCH_BG, fg=SEARCH_FG,
            insertbackground=ACCENT,
            relief="flat", width=28,
            border=0,
        )
        self.search_entry.pack(side="left", padx=(6, 0))
        self.search_entry.insert(0, "Search products, barcodes, prices…")
        self.search_entry.bind("<FocusIn>", self._on_search_focus_in)
        self.search_entry.bind("<FocusOut>", self._on_search_focus_out)
        self.search_var.trace_add("write", self._on_search)

        # Divider
        divider = tk.Frame(self.root, bg=BORDER_COLOR, height=1)
        divider.pack(fill="x")

        # ---- Scrollable card area ----
        self.container = tk.Frame(self.root, bg=BG_COLOR)
        self.container.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(
            self.container, bg=BG_COLOR,
            highlightthickness=0, borderwidth=0,
        )
        self.scrollbar = tk.Scrollbar(
            self.container, orient="vertical",
            command=self._on_scrollbar_scroll,
            bg=SCROLLBAR_BG, troughcolor=SCROLLBAR_BG,
            activebackground=SCROLLBAR_FG,
            width=12, relief="flat",
        )
        self.canvas.configure(yscrollcommand=self._on_canvas_scroll)

        self.scrollbar.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)

        self.cards_frame = tk.Frame(self.canvas, bg=BG_COLOR)
        self.canvas_window = self.canvas.create_window(
            (0, 0), window=self.cards_frame, anchor="nw"
        )

        # Bind events
        self.cards_frame.bind("<Configure>", self._on_frame_configure)
        self.canvas.bind("<Configure>", self._on_canvas_configure)
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

        # ---- Status bar ----
        self.status_bar = tk.Frame(self.root, bg=STATUS_BG, height=30)
        self.status_bar.pack(fill="x", side="bottom")
        self.status_bar.pack_propagate(False)

        self.status_lbl = tk.Label(
            self.status_bar, text="  Loading products…",
            font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=STATUS_BG,
            anchor="w",
        )
        self.status_lbl.pack(side="left", padx=10, fill="x")

        self.img_status_lbl = tk.Label(
            self.status_bar, text="",
            font=("Segoe UI", 9), fg=ACCENT, bg=STATUS_BG,
            anchor="e",
        )
        self.img_status_lbl.pack(side="right", padx=10)

    # ------------------------------------------------------------------ Data
    def _load_data(self):
        """Load products in a background thread to keep UI responsive."""
        def _worker():
            self.products = load_products()
            self.root.after(0, self._on_data_loaded)

        self.status_lbl.config(text="  ⏳ Loading products from Excel…")
        threading.Thread(target=_worker, daemon=True).start()

    def _on_data_loaded(self):
        global _placeholder_photo
        _placeholder_photo = ImageTk.PhotoImage(_create_placeholder(IMG_SIZE))

        self.filtered_indices = list(range(len(self.products)))
        self.count_lbl.config(text=f"{len(self.products)} products")
        self.status_lbl.config(text=f"  ✅ {len(self.products)} products loaded from {WORKBOOK}")
        self._render_cards()

    # ------------------------------------------------------------------ Cards
    def _render_cards(self):
        """Clear and re-render all product cards for filtered_indices."""
        for w in self.cards_frame.winfo_children():
            w.destroy()
        self.card_widgets.clear()

        if not self.filtered_indices:
            empty_lbl = tk.Label(
                self.cards_frame, text="No products match your search.",
                font=("Segoe UI", 14), fg=TEXT_SECONDARY, bg=BG_COLOR,
            )
            empty_lbl.grid(row=0, column=0, pady=80, columnspan=4)
            return

        canvas_w = self.canvas.winfo_width()
        if canvas_w > 100:
            self._columns = max(1, (canvas_w - 40) // (CARD_WIDTH + 16))
        else:
            self._columns = 4

        for i, prod_idx in enumerate(self.filtered_indices):
            r = i // self._columns
            c = i % self._columns
            card = self._create_card(self.cards_frame, self.products[prod_idx], prod_idx)
            card.grid(row=r, column=c, padx=10, pady=10, sticky="n")
            self.card_widgets.append({"widget": card, "prod_idx": prod_idx, "loaded": False})

        # Ensure layout coordinates are calculated immediately
        self.root.update_idletasks()

        # Load first visible batch right away
        self._load_visible_images()

    def _create_card(self, parent, product: dict, idx: int) -> tk.Frame:
        """Build a single product card widget with image, name, price, and barcode sticker."""
        card = tk.Frame(
            parent, bg=CARD_BG, width=CARD_WIDTH, height=CARD_HEIGHT,
            highlightbackground=BORDER_COLOR, highlightthickness=1,
            padx=0, pady=0,
        )
        card.grid_propagate(False)
        card.columnconfigure(0, weight=1)

        # 1. Image area
        img_frame = tk.Frame(card, bg=CARD_BG, height=IMG_SIZE[1] + 8)
        img_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 2))
        img_frame.grid_propagate(False)

        initial_img = image_cache.get(product["image"], _placeholder_photo)
        img_label = tk.Label(img_frame, bg=CARD_BG, image=initial_img, anchor="center")
        img_label.pack(expand=True)
        card._img_label = img_label

        # 2. Product name
        name_text = product["name"]
        if len(name_text) > 50:
            name_text = name_text[:47] + "…"
        name_lbl = tk.Label(
            card, text=name_text,
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY, bg=CARD_BG,
            wraplength=CARD_WIDTH - 20,
            justify="center", anchor="center",
        )
        name_lbl.grid(row=1, column=0, sticky="ew", padx=10, pady=(2, 2))

        # 3. Product price (bold vibrant green badge)
        price_text = _format_price(product.get("price"))
        price_lbl = tk.Label(
            card, text=price_text,
            font=("Segoe UI", 11, "bold"),
            fg=PRICE_COLOR, bg=CARD_BG,
            anchor="center",
        )
        price_lbl.grid(row=2, column=0, sticky="ew", padx=10, pady=(1, 4))

        # 4. Realistic product barcode sticker (vertical bars + digits)
        barcode_photo = _generate_barcode_photo(product["barcode"], BARCODE_SIZE[0], BARCODE_SIZE[1])
        barcode_lbl = tk.Label(
            card, image=barcode_photo,
            bg=CARD_BG, anchor="center"
        )
        barcode_lbl.grid(row=3, column=0, sticky="ew", padx=10, pady=(0, 10))
        card._barcode_photo = barcode_photo  # Prevent GC

        # Hover effects
        def on_enter(e):
            card.config(bg=CARD_HOVER, highlightbackground=ACCENT)
            img_frame.config(bg=CARD_HOVER)
            img_label.config(bg=CARD_HOVER)
            name_lbl.config(bg=CARD_HOVER)
            price_lbl.config(bg=CARD_HOVER)
            barcode_lbl.config(bg=CARD_HOVER)

        def on_leave(e):
            card.config(bg=CARD_BG, highlightbackground=BORDER_COLOR)
            img_frame.config(bg=CARD_BG)
            img_label.config(bg=CARD_BG)
            name_lbl.config(bg=CARD_BG)
            price_lbl.config(bg=CARD_BG)
            barcode_lbl.config(bg=CARD_BG)

        for w in [card, img_frame, img_label, name_lbl, price_lbl, barcode_lbl]:
            w.bind("<Enter>", on_enter)
            w.bind("<Leave>", on_leave)

        return card

    # -------------------------------------------------------- Lazy loading
    def _schedule_load_visible(self):
        """Debounce viewport check to avoid lag during rapid scrolling."""
        if self._lazy_timer is not None:
            self.root.after_cancel(self._lazy_timer)
        self._lazy_timer = self.root.after(40, self._load_visible_images)

    def _load_visible_images(self):
        """Load images for cards currently visible in the viewport (plus margin)."""
        if not self.card_widgets:
            return

        canvas_top = self.canvas.canvasy(0)
        canvas_h = self.canvas.winfo_height()
        if canvas_h <= 1:
            canvas_h = 800
        canvas_bottom = canvas_top + canvas_h + PRELOAD_MARGIN

        loaded_count = 0
        to_load = []

        for i, cw in enumerate(self.card_widgets):
            prod = self.products[cw["prod_idx"]]
            url = prod["image"]

            if cw["loaded"] or (url and url in image_cache):
                cw["loaded"] = True
                loaded_count += 1
                if url in image_cache:
                    try:
                        cw["widget"]._img_label.config(image=image_cache[url])
                    except Exception:
                        pass
                continue

            widget = cw["widget"]
            try:
                wy = widget.winfo_y()
                wh = widget.winfo_height()
                if wh <= 1:
                    wh = CARD_HEIGHT
            except Exception:
                continue

            # Load first batch unconditionally (initial render) or if inside visible range
            is_initial_batch = (i < 24)
            is_visible = (wy + wh >= canvas_top - 100) and (wy <= canvas_bottom)

            if is_initial_batch or is_visible:
                if not url:
                    cw["loaded"] = True
                    loaded_count += 1
                    continue

                cw["loaded"] = True
                to_load.append((url, widget))

        for url, widget in to_load:
            self._load_image_async(url, widget)

        total = len(self.card_widgets)
        self.img_status_lbl.config(text=f"📷 {len(image_cache)}/{total} images cached")

    def _load_image_async(self, url: str, card_widget: tk.Frame):
        """Queue image download with worker thread pool and update card."""
        if url in image_cache:
            try:
                if card_widget.winfo_exists():
                    card_widget._img_label.config(image=image_cache[url])
            except Exception:
                pass
            return

        if url in self._loading_urls:
            return
        self._loading_urls.add(url)

        def _worker():
            try:
                pil_img = _fetch_image(url)
            finally:
                self._loading_urls.discard(url)

            if pil_img is None:
                return

            # Resize maintaining aspect ratio onto square background
            pil_img.thumbnail(IMG_SIZE, Image.LANCZOS)
            bg = Image.new("RGBA", IMG_SIZE, (0, 0, 0, 0))
            offset = ((IMG_SIZE[0] - pil_img.width) // 2,
                      (IMG_SIZE[1] - pil_img.height) // 2)
            bg.paste(pil_img, offset, pil_img)

            def _update():
                try:
                    if not card_widget.winfo_exists():
                        return
                    photo = ImageTk.PhotoImage(bg)
                    image_cache[url] = photo
                    card_widget._img_label.config(image=photo)
                    card_widget._img_photo = photo  # prevent GC

                    self.img_status_lbl.config(
                        text=f"📷 {len(image_cache)}/{len(self.card_widgets)} images cached"
                    )
                except Exception:
                    pass

            self.root.after(0, _update)

        self._executor.submit(_worker)

    # -------------------------------------------------------- Event handlers
    def _on_frame_configure(self, event):
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def _on_canvas_configure(self, event):
        self.canvas.itemconfig(self.canvas_window, width=event.width)
        new_cols = max(1, (event.width - 40) // (CARD_WIDTH + 16))
        if new_cols != self._columns and self.products:
            self._columns = new_cols
            self._render_cards()

    def _on_scrollbar_scroll(self, *args):
        self.canvas.yview(*args)
        self._schedule_load_visible()

    def _on_canvas_scroll(self, first, last):
        self.scrollbar.set(first, last)
        self._schedule_load_visible()

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        self._schedule_load_visible()

    def _on_search_focus_in(self, event):
        if self.search_entry.get() == "Search products, barcodes, prices…":
            self.search_entry.delete(0, tk.END)
            self.search_entry.config(fg=SEARCH_FG)

    def _on_search_focus_out(self, event):
        if not self.search_entry.get():
            self.search_entry.insert(0, "Search products, barcodes, prices…")
            self.search_entry.config(fg=TEXT_SECONDARY)

    def _on_search(self, *_args):
        query = self.search_var.get().strip().casefold()
        if query == "search products, barcodes, prices…":
            query = ""

        if not query:
            self.filtered_indices = list(range(len(self.products)))
        else:
            self.filtered_indices = [
                i for i, p in enumerate(self.products)
                if query in p["name"].casefold()
                or query in p["barcode"]
                or query in str(p.get("price", ""))
            ]

        self.count_lbl.config(
            text=f"{len(self.filtered_indices)} of {len(self.products)} products"
            if query else f"{len(self.products)} products"
        )
        self._render_cards()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    root = tk.Tk()
    app = SupermarketViewer(root)
    root.mainloop()
