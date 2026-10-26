# Intelligent AI Shopping Agent with Voice Ordering, Budget Recommendations & Automated Inventory Management

A production-grade, bilingual (Arabic & English) AI-powered shopping assistant that combines voice interactions, deterministic budget optimization, natural language duration parsing, strict category filtering, and atomic real-time inventory management.

---

## 1. Key Features

1. **Intelligent Budget-Based Recommendations**:
   - Maximizes budget utilization effectively up to requested limits (e.g. 2,000 EGP).
   - Programmatically calculates quantities, unit prices, subtotals, and final totals.
   - Transparent explanations in Arabic and English describing allocations and remaining buffers.

2. **Strict Category Filtering**:
   - Mandatory constraint enforcement: Exclusively includes requested categories (e.g., Dairy and Legumes) while completely excluding unrelated categories (Biscuits, Vegetables, Fruits, Beverages, etc.).
   - Combines multiple requested categories strictly without relaxing restrictions.

3. **Shopping Duration Understanding & Validation (1–365 Days)**:
   - Natural language duration parsing in English, Modern Standard Arabic, and Egyptian Arabic (e.g., "7 days", "أسبوع", "30 يوم", "شهر", "أسبوعين", "3 شهور", "سنة", "one year").
   - Normalization rules: 1 day = 1 day, 7 days = 1 week, 14 days = 2 weeks, 30 days = 1 month, 60 days = 2 months, 90 days = 3 months, 180 days = 6 months, 365 days = 1 year.
   - Duration-aware grocery planning: computes daily spending rates (`total / duration_days`) and balances household staple quantities.
   - Explicit rejection of invalid durations: sub-day periods (12 hours, 5 minutes, 12 seconds, half a day), ambiguous fractional periods (half a year), and multi-year durations (two years, 366 days).

4. **Natural Voice Interaction (STT & TTS) with Audio Mute Toggle & Protection**:
   - Dual voice support: Spoken input via Web Speech API in Egyptian Arabic (`ar-EG`), Modern Standard Arabic (`ar-SA`), and English (`en-US`).
   - Spoken confirmations and summaries read aloud via Speech Synthesis in both Arabic and English.
   - **Audio Mute/Unmute Control (زر كتم الصوت)**: Dedicated mute buttons in the top header and in the 3D Voice Station Card. Clicking mute immediately stops any active speech (`speechSynthesis.cancel()`) and prevents the assistant from speaking until unmuted.
   - **Voiced Order Safety (لم يتم الخصم إلا بعد التأكيد)**: Voiced requests place items into a **Pending Review** state. Stock in `market.db` is strictly preserved and **never deducted** until the user explicitly confirms (via voice command e.g. "أكد الطلب" / "Confirm order" or clicking the 3D confirmation button).
   - Once confirmed, stock immediately decrements in `market.db` and the Live Inventory monitor updates with an animated badge.

5. **Automatic Order Email Dispatch (`moornafea@gmail.com`)**:
   - Upon order confirmation, the system automatically formats an itemized invoice and sends it directly to **`moornafea@gmail.com`**.
   - Includes full breakdown: Order ID, customer details, line items, quantities, unit prices, subtotals, final total, and duration plan.
   - Includes an on-screen confirmation badge and an interactive "Resend Email" button for instant re-dispatching.

5. **Modern 3D Interface & Real-Time Live Inventory Dashboard**:
   - **Interactive 3D Holographic AI Voice Orb**: Built with Three.js WebGL, dynamically rotating, glowing, and reacting to speech input and audio responses.
   - **Glassmorphic Cyber-Clean 3D Styling**: 3D tilt cards, glowing borders, tactile 3D buttons, and neon emerald/cyan ambient lighting.
   - **Live Inventory Monitor**: Real-time synchronization with SQLite `market.db` allowing customers and store managers to watch stock counts decrement in real time upon confirmed orders.

5. **Atomic Real-Time Inventory & Order Processing**:
   - SQLite database (`market.db`) with Write-Ahead Logging (WAL) and row-level locking (`BEGIN IMMEDIATE`).
   - Prevents race conditions and overselling when multiple customers check out concurrently.
   - Orders recorded with order IDs, customer details, timestamps, duration, and itemized lines.
   - Stock is never deducted before explicit order confirmation.

---

## 2. Project Architecture & Modules

```
VOICE/
├── DATA/
│   └── super_market.xlsx      # Original dataset (1,000 products)
├── templates/
│   └── index.html             # Bilingual responsive web interface (EN / AR)
├── index.html                 # Root mirror for static serving
├── app.py                     # Flask web server & REST API
├── database.py                # SQLite schema, WAL mode, loader & atomic transactions
├── agent_controller.py        # Conversational state & bilingual intent orchestrator
├── agent_tools.py             # 12 deterministic tools specified in architecture
├── duration_parser.py         # Bilingual regex duration parser & validator (1-365 days)
├── category_matcher.py        # Strict category filters & classifier
├── recommendation_engine.py   # Multi-phase budget knapsack & duration optimizer
├── test_suite.py              # Automated test suite covering Test A through Test K
└── requirements.txt           # Python dependencies
```

---

## 3. Setup and Execution Instructions

### Prerequisites
- Python 3.10+ (tested with Python 3.11 & 3.13)
- Modern web browser (Chrome, Edge, or Firefox) with microphone permissions enabled

### Installation
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. (Optional) Configure Gemini API Key:
   If you wish to use Google Gemini for enhanced conversational chit-chat, set the environment variable:
   ```bash
   # Windows PowerShell
   $env:GEMINI_API_KEY = "your-api-key"
   ```
   *Note: If no API key is provided, the application automatically runs using its built-in deterministic NLU parser.*

### Starting the Application
Run the application server:
```bash
python app.py
```
Open your browser and navigate to:
```
http://127.0.0.1:5000/
```

---

## 4. Running the Test Suite

The test suite thoroughly verifies all acceptance criteria (Test A through Test K):
```bash
python test_suite.py
```
All 11 tests execute in under 1 second:
- **Test A**: Budget accuracy (2,000 EGP total <= budget, effective utilization >= 90%).
- **Test B**: Strict product category filtering (dairy & legumes exclusively).
- **Test C**: Combined constraints (`عايز منتجات ألبان وبقوليات بميزانية 2000 جنيه لمدة شهر`).
- **Test D**: Valid duration (`I need groceries for 7 days.` -> normalized to 1 week).
- **Test E**: Invalid duration (`I need groceries for 12 hours.` -> rejected with 1-365 days explanation).
- **Test F**: Maximum duration (`I need groceries for one year.` -> accepted as 365 days / 1 year).
- **Test G**: Duration beyond the limit (`I need groceries for two years.` -> rejected).
- **Test H**: Real-time inventory updates (20 water packs -> 19 upon confirmed order).
- **Test I**: Voice ordering (STT transcript -> stock check -> confirmed order -> speech response).
- **Test J**: Voice recommendations (spoken budget/duration -> identical rules as text).
- **Test K**: Concurrent orders (multi-threaded concurrent checkout -> no overselling, stock never negative).
