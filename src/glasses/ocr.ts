// Line shape the parsers consume; the Capacitor OCR runner is not ported.
export interface OcrLine {
  page: number; // 0-indexed
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

