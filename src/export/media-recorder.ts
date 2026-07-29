// ═══════════════════════════════════════════════════════════════
// Video Exporter — WebM via MediaRecorder
// Chroma key green · Timeline-perfect export
// ═══════════════════════════════════════════════════════════════
//
// Règle : la vidéo overlay a la MÊME DURÉE que l'activité source.
// frames = durée en secondes × fréquence
// fps = fréquence
// → aucun ajustement de vitesse nécessaire dans CapCut
// ═══════════════════════════════════════════════════════════════

import { ISkin } from '../skins/types.js';
import { FitPoint, MapBounds } from '../fit/types.js';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;           // = samplesPerSec
  totalFrames: number;   // = durationSec * fps
  samplesPerSec: number; // 1 Hz par défaut
  bgMode: 'green' | 'transparent';
  onProgress: (pct: number, frame: number, total: number) => void;
  onComplete: (blob: Blob, filename: string) => void;
  onError: (err: string) => void;
}

export class VideoExporter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private skin: ISkin;
  private points: FitPoint[];
  private allPoints: FitPoint[];
  private bounds: MapBounds | null;
  private meta: { maxPower: number; maxSpeed: number; maxHr: number; avgPower: number };
  private options: ExportOptions;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private frameIndex = 0;
  private totalFrames = 0;
  private isRunning = false;
  private intervalId: number | null = null;
  private stream: MediaStream | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    skin: ISkin,
    points: FitPoint[],
    allPoints: FitPoint[],
    bounds: MapBounds | null,
    meta: { maxPower: number; maxSpeed: number; maxHr: number; avgPower: number },
    options: ExportOptions
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.skin = skin;
    this.points = points;
    this.allPoints = allPoints;
    this.bounds = bounds;
    this.meta = meta;
    this.options = options;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.frameIndex = 0;
    this.totalFrames = this.points.length;
    this.chunks = [];

    if (this.totalFrames === 0) {
      this.options.onError('Aucune frame à exporter');
      return;
    }

    // Set canvas size
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;

    // Capture stream ONCE
    this.stream = this.canvas.captureStream(0);

    // Pick best MIME type
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    let mimeType = '';
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }

    if (!mimeType) {
      this.options.onError('Aucun format vidéo supporté par le navigateur');
      return;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });

    // timeslice 1s → data emitted regularly
    this.mediaRecorder.start(1000);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.finishExport();
    };

    this.mediaRecorder.onerror = (e: any) => {
      this.options.onError(`Erreur MediaRecorder: ${e.message || 'inconnue'}`);
      this.cleanup();
    };

    // Render at stable interval — each tick = 1 frame = samplesPerSec secondes de données
    const delayMs = 1000 / this.options.fps;
    this.intervalId = window.setInterval(() => this.renderFrame(), delayMs);
  }

  private renderFrame(): void {
    if (!this.isRunning || this.frameIndex >= this.totalFrames) {
      this.stopRecording();
      return;
    }

    const idx = this.frameIndex;
    const point = this.points[idx];
    const absIdx = this.allPoints.indexOf(point);

    // Draw skin
    this.skin.draw(
      this.ctx,
      this.options.width,
      this.options.height,
      point,
      this.allPoints,
      absIdx >= 0 ? absIdx : idx,
      this.bounds,
      {
        ...this.meta,
        elapsed: point.elapsed,
      }
    );

    // Ask the stream track to capture this frame
    if (this.stream) {
      const track = this.stream.getVideoTracks()[0];
      if (track && 'requestFrame' in track) {
        (track as any).requestFrame();
      }
    }

    // Progress
    const pct = Math.round((idx / this.totalFrames) * 100);
    this.options.onProgress(pct, idx, this.totalFrames);

    this.frameIndex++;
  }

  private stopRecording(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    } else {
      this.finishExport();
    }
  }

  private finishExport(): void {
    if (this.chunks.length > 0) {
      const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
      const blob = new Blob(this.chunks, { type: mimeType });
      const filename = `paceparser2_overlay_${Date.now()}.webm`;
      this.options.onComplete(blob, filename);
    } else {
      this.options.onError('Aucune donnée vidéo enregistrée');
    }
    this.cleanup();
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  private cleanup(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
