"""
Tournament Companion & PDF Map Extractor Utility
Extracts high-resolution page images from any tournament PDF (e.g. Chapter Approved, WTC, UKTC)
into PNG/JPEG images ready for Lex Tactica.

Usage:
  python scripts/extract-maps-from-pdf.py <path-to-pdf> [output-dir] [--pages 7-10]
"""

import sys
import os
import argparse
from pathlib import Path

try:
    import pypdf
    from PIL import Image
except ImportError:
    print("[ERROR] Required libraries not found. Run: pip install pypdf pillow")
    sys.exit(1)


def parse_page_range(range_str, max_pages):
    if not range_str:
        return list(range(max_pages))
    pages = []
    for part in range_str.split(','):
        part = part.strip()
        if '-' in part:
            start, end = part.split('-')
            start = max(1, int(start.strip()))
            end = min(max_pages, int(end.strip()))
            pages.extend(range(start - 1, end))
        else:
            p = int(part)
            if 1 <= p <= max_pages:
                pages.append(p - 1)
    return sorted(list(set(pages)))


def extract_images_from_pdf(pdf_path, output_dir, page_range_str=None):
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        print(f"[ERROR] PDF not found: {pdf_path}")
        return

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Opening: {pdf_path.name}")
    reader = pypdf.PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    print(f"Total pages in document: {total_pages}")

    target_pages = parse_page_range(page_range_str, total_pages)
    print(f"Processing {len(target_pages)} selected page(s)...")

    extracted_count = 0
    for idx in target_pages:
        page = reader.pages[idx]
        page_num = idx + 1
        img_idx = 0
        for img in page.images:
            img_idx += 1
            ext = img.name.split('.')[-1] if '.' in img.name else 'jpg'
            out_filename = f"page_{page_num:02d}_img_{img_idx:02d}.{ext}"
            out_path = output_dir / out_filename
            with open(out_path, "wb") as f:
                f.write(img.data)
            extracted_count += 1
            print(f"  [Extracted] Page {page_num} -> {out_filename} ({len(img.data)} bytes)")

    print(f"\nDone! Extracted {extracted_count} image(s) to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(description="Extract map images from 40k Tournament Companion PDFs")
    parser.add_argument("pdf", help="Path to the source PDF file")
    parser.add_argument("output", nargs="?", default="public/data/wahapedia-11ed/maps/extracted", help="Destination directory")
    parser.add_argument("--pages", help="Page range to extract, e.g. '7-10' or '1,3,5-8'")
    args = parser.parse_args()

    extract_images_from_pdf(args.pdf, args.output, args.pages)


if __name__ == "__main__":
    main()
