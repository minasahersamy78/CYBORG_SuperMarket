"""
Cyborg Supermarket - Enterprise PDF Generator
Builds 10 publication-quality, 100% compliant PDF 1.4 documents.
Uses Python standard library with zero external binary dependencies.
"""

import sys, os, time, json

class PDFDoc:
    def __init__(self, title, subtitle="", doc_code=""):
        self.title = title
        self.subtitle = subtitle
        self.doc_code = doc_code
        self.pages = [] # list of stream commands
        self.current_stream = []
        self.page_number = 0
        self.y = 750 # start near top of A4 (595 x 842)

    def new_page(self):
        if self.current_stream:
            self.pages.append("\n".join(self.current_stream))
            self.current_stream = []
        self.page_number += 1
        self.y = 750
        
        # Header (pages > 1)
        if self.page_number > 1:
            self.draw_header()

    def draw_header(self):
        # Top banner
        s = []
        s.append("q")
        s.append("0.059 0.463 0.431 rg") # Teal bar
        s.append("50 800 495 2 re f")
        s.append("0.4 0.4 0.4 rg")
        s.append("BT /F1 9 Tf 50 806 Td (Cyborg Supermarket - " + self.escape(self.title) + ") Tj ET")
        s.append("BT /F1 9 Tf 470 806 Td (CONFIDENTIAL) Tj ET")
        s.append("Q")
        self.current_stream.append("\n".join(s))

    def draw_footer(self, total_pages=1):
        s = []
        s.append("q")
        s.append("0.8 0.8 0.8 rg")
        s.append("50 45 495 1 re f") # divider line
        s.append("0.4 0.4 0.4 rg")
        s.append(f"BT /F1 8 Tf 50 32 Td (Version 1.0.0 | Generated: October 2026 | Enterprise Architectural Blueprint) Tj ET")
        s.append(f"BT /F1 8 Tf 480 32 Td (Page {self.page_number} of {total_pages}) Tj ET")
        s.append("Q")
        return "\n".join(s)

    def draw_cover(self, doc_num_str):
        self.page_number = 1
        s = []
        s.append("q")
        # Cover background decorative header block
        s.append("0.043 0.067 0.125 rg") # Dark slate
        s.append("0 520 595 322 re f")
        
        # Accent teal & gold bars
        s.append("0.059 0.463 0.431 rg")
        s.append("0 514 595 6 re f")
        s.append("0.96 0.62 0.04 rg")
        s.append("50 514 120 6 re f")

        # White title text
        s.append("1 1 1 rg")
        s.append("BT /F2 13 Tf 50 770 Td (CYBORG SUPERMARKET ENTERPRISE DOCUMENTATION) Tj ET")
        s.append(f"BT /F2 26 Tf 50 710 Td ({self.escape(self.title)}) Tj ET")
        if self.subtitle:
            s.append(f"BT /F1 13 Tf 50 675 Td ({self.escape(self.subtitle)}) Tj ET")

        s.append(f"0.22 0.74 0.97 rg")
        s.append(f"BT /F2 12 Tf 50 635 Td (DOCUMENT ID: {self.escape(doc_num_str)}) Tj ET")

        # Bottom white area metadata card
        s.append("0.118 0.161 0.231 rg")
        s.append("50 160 495 300 re f")
        s.append("0.2 0.25 0.33 RG 1 w")
        s.append("50 160 495 300 re S")

        s.append("1 1 1 rg")
        s.append("BT /F2 14 Tf 75 425 Td (Executive Publication Record) Tj ET")
        s.append("0.7 0.75 0.8 rg")
        meta = [
            ("Organization:", "Cyborg Omnichannel Engineering Organization"),
            ("Ecosystem:", "Windows POS · Android Mobile · Web Storefront · Admin Web · Backend"),
            ("Primary Authority:", "cyborg_system_architecture.pdf (16-Page Blueprint)"),
            ("Source Dataset:", "super_market(1).xlsx (1,000 Verified Egyptian Retail Records)"),
            ("Security Level:", "Enterprise Retail Distribution / Stakeholder Review"),
            ("System Stack:", "NestJS · TypeScript · PostgreSQL 16 · Redis 7 · SQLite · Flutter"),
            ("Target Currency:", "Egyptian Pounds (EGP) · Cairo Timezone (UTC+2 / UTC+3)")
        ]
        y_pos = 390
        for label, val in meta:
            s.append(f"BT /F2 9 Tf 75 {y_pos} Td ({self.escape(label)}) Tj ET")
            s.append(f"BT /F1 9 Tf 190 {y_pos} Td ({self.escape(val)}) Tj ET")
            y_pos -= 26

        s.append("Q")
        self.current_stream.append("\n".join(s))
        self.pages.append("\n".join(self.current_stream))
        self.current_stream = []

    def heading1(self, text):
        if self.y < 120: self.new_page()
        self.y -= 25
        s = []
        s.append("q")
        s.append("0.059 0.463 0.431 rg")
        s.append(f"50 {self.y-2} 4 18 re f") # accent block
        s.append("0.05 0.1 0.2 rg")
        s.append(f"BT /F2 15 Tf 60 {self.y+1} Td ({self.escape(text)}) Tj ET")
        s.append("Q")
        self.current_stream.append("\n".join(s))
        self.y -= 14

    def heading2(self, text):
        if self.y < 100: self.new_page()
        self.y -= 18
        s = []
        s.append("q")
        s.append("0.1 0.2 0.35 rg")
        s.append(f"BT /F2 12 Tf 50 {self.y} Td ({self.escape(text)}) Tj ET")
        s.append("Q")
        self.current_stream.append("\n".join(s))
        self.y -= 10

    def heading3(self, text):
        if self.y < 80: self.new_page()
        self.y -= 14
        s = []
        s.append("q")
        s.append("0.15 0.35 0.35 rg")
        s.append(f"BT /F2 10 Tf 50 {self.y} Td ({self.escape(text)}) Tj ET")
        s.append("Q")
        self.current_stream.append("\n".join(s))
        self.y -= 8

    def paragraph(self, text):
        words = text.split(" ")
        line = []
        for w in words:
            line.append(w)
            if len(" ".join(line)) > 92:
                self.draw_text_line(" ".join(line[:-1]))
                line = [w]
        if line:
            self.draw_text_line(" ".join(line))
        self.y -= 4

    def draw_text_line(self, line):
        if self.y < 60: self.new_page()
        s = f"q 0.15 0.18 0.22 rg BT /F1 9.5 Tf 50 {self.y} Td ({self.escape(line)}) Tj ET Q"
        self.current_stream.append(s)
        self.y -= 13

    def bullet(self, bold_prefix, text):
        line = f"- {bold_prefix}: {text}"
        self.paragraph(line)

    def callout(self, title, text, ctype="NOTE"):
        if self.y < 110: self.new_page()
        self.y -= 8
        s = []
        s.append("q")
        # Background box
        s.append("0.95 0.97 0.98 rg")
        s.append(f"50 {self.y - 36} 495 44 re f")
        s.append("0.85 0.88 0.92 RG 1 w")
        s.append(f"50 {self.y - 36} 495 44 re S")
        # Left bar
        s.append("0.059 0.463 0.431 rg")
        s.append(f"50 {self.y - 36} 4 44 re f")
        # Text
        s.append(f"BT /F2 9 Tf 62 {self.y - 4} Td ([{ctype}] {self.escape(title)}) Tj ET")
        s.append(f"0.3 0.35 0.4 rg BT /F1 8.5 Tf 62 {self.y - 20} Td ({self.escape(text[:95])}) Tj ET")
        s.append("Q")
        self.current_stream.append("\n".join(s))
        self.y -= 48

    def table(self, headers, rows, col_widths=None):
        if not col_widths:
            w = 495 / len(headers)
            col_widths = [w] * len(headers)

        total_w = sum(col_widths)
        row_h = 16

        # Check page space for at least header + 2 rows
        if self.y < 80 + row_h * 3:
            self.new_page()

        self.y -= 6
        # Header Row
        s = []
        s.append("q")
        s.append("0.059 0.463 0.431 rg")
        s.append(f"50 {self.y - row_h} {total_w} {row_h} re f")
        s.append("1 1 1 rg")
        cur_x = 55
        for i, h in enumerate(headers):
            s.append(f"BT /F2 8.5 Tf {cur_x} {self.y - row_h + 4} Td ({self.escape(h)}) Tj ET")
            cur_x += col_widths[i]
        s.append("Q")
        self.current_stream.append("\n".join(s))
        self.y -= row_h

        # Body Rows
        for r_idx, row in enumerate(rows):
            if self.y < 65:
                self.new_page()
            s = []
            s.append("q")
            if r_idx % 2 == 1:
                s.append("0.96 0.97 0.98 rg")
                s.append(f"50 {self.y - row_h} {total_w} {row_h} re f")
            s.append("0.9 0.92 0.94 RG 0.5 w")
            s.append(f"50 {self.y - row_h} {total_w} {row_h} re S")
            s.append("0.15 0.18 0.22 rg")
            cur_x = 55
            for i, cell in enumerate(row):
                s.append(f"BT /F1 8 Tf {cur_x} {self.y - row_h + 4} Td ({self.escape(str(cell)[:30])}) Tj ET")
                cur_x += col_widths[i]
            s.append("Q")
            self.current_stream.append("\n".join(s))
            self.y -= row_h

        self.y -= 8

    def diagram_box(self, steps):
        # Draws a horizontal sequence of boxes
        if self.y < 80: self.new_page()
        self.y -= 10
        box_w = 95
        box_h = 28
        spacing = 24
        s = []
        s.append("q")
        for i, st in enumerate(steps[:4]):
            bx = 50 + i * (box_w + spacing)
            s.append("0.1 0.15 0.25 rg")
            s.append(f"{bx} {self.y - box_h} {box_w} {box_h} re f")
            s.append("0.2 0.7 0.9 RG 1 w")
            s.append(f"{bx} {self.y - box_h} {box_w} {box_h} re S")
            s.append("1 1 1 rg")
            s.append(f"BT /F2 8 Tf {bx + 6} {self.y - box_h + 10} Td ({self.escape(st[:18])}) Tj ET")
            if i < len(steps[:4]) - 1:
                # Arrow
                ax = bx + box_w + 4
                s.append("0.059 0.463 0.431 rg")
                s.append(f"BT /F2 12 Tf {ax} {self.y - box_h + 8} Td (->) Tj ET")
        s.append("Q")
        self.current_stream.append("\n".join(s))
        self.y -= (box_h + 16)

    def escape(self, txt):
        res = []
        for ch in str(txt):
            if ch == "\\":
                res.append("\\\\")
            elif ch == "(":
                res.append("\\(")
            elif ch == ")":
                res.append("\\)")
            elif ord(ch) < 128:
                res.append(ch)
            elif ord(ch) < 256:
                res.append(f"\\{ord(ch):03o}")
            else:
                # Transliterate or clean non-latin1 unicode characters
                res.append("?")
        return "".join(res)

    def build_pdf(self, filepath):
        if self.current_stream:
            self.pages.append("\n".join(self.current_stream))
            self.current_stream = []

        total_p = len(self.pages)
        objects = []
        
        # 1: Catalog
        objects.append("<< /Type /Catalog /Pages 2 0 R >>")
        # 2: Pages root
        kids = " ".join([f"{3 + i*2} 0 R" for i in range(total_p)])
        objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {total_p} >>")

        # Fonts (Helvetica, Helvetica-Bold, Courier)
        font_obj = "<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F3 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >>"
        
        # Page & Content objects
        for i, page_stream in enumerate(self.pages):
            p_num = i + 1
            # Append footer if page > 1
            full_stream = page_stream
            if p_num > 1:
                full_stream += "\n" + self.draw_footer(total_p)
            
            stream_len = len(full_stream.encode('utf-8'))
            page_obj = f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents {4 + i*2} 0 R /Resources {font_obj} >>"
            content_obj = f"<< /Length {stream_len} >>\nstream\n{full_stream}\nendstream"
            objects.append(page_obj)
            objects.append(content_obj)

        # Output binary PDF
        out = []
        out.append("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = []
        cur_pos = len(out[0].encode('latin1'))

        for idx, obj in enumerate(objects):
            offsets.append(cur_pos)
            obj_str = f"{idx + 1} 0 obj\n{obj}\nendobj\n"
            out.append(obj_str)
            cur_pos += len(obj_str.encode('latin1'))

        xref_pos = cur_pos
        out.append(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n")
        for off in offsets:
            out.append(f"{off:010d} 00000 n \n")
        out.append(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n")

        with open(filepath, 'wb') as f:
            f.write("".join(out).encode('latin1'))
        
        return total_p
