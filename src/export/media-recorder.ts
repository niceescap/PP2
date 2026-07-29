// ═══════════════════════════════════════════════════════════════
// Video Exporter — WebM via MediaRecorder
// Fast render: draws frames as fast as possible
// ═══════════════════════════════════════════════════════════════

import { OverlayConfig, drawOverlay } from '../blocks.js';
import { FitPoint, MapBounds } from '../fit/types.js';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  samplesPerSec: number;
  bgMode: 'green' | 'transparent' | 'black';
  onProgress: (pct: number, frame: number, total: number) => void;
  onComplete: (blob: Blob, filename: string) => void;
  onError: (err: string) => void;
}

export class VideoExporter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: OverlayConfig;
  private points: FitPoint[];
  private allPoints: FitPoint[];
  private bounds: MapBounds | null;
  private options: ExportOptions;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private frameIndex = 0;
  private totalFrames = 0;
  private isRunning = false;
  private rafId: number | null = null;
  private stream: MediaStream | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    config: OverlayConfig,
    points: FitPoint[],
    allPoints: FitPoint[],
    bounds: MapBounds | null,
    options: ExportOptions
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.config = config;
    this.points = points;
    this.allPoints = allPoints;
    this.bounds = bounds;
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

    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;

    this.stream = this.canvas.captureStream(0);

    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    let mimeType = '';
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
    }

    if (!mimeType) {
      this.options.onError('Aucun format vidéo supporté');
      return;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });

    this.mediaRecorder.start(1000);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => this.finishExport();
    this.mediaRecorder.onerror = (e: any) => {
      this.options.onError(`Erreur MediaRecorder: ${e.message || 'inconnue'}`);
      this.cleanup();
    };

    // Render as fast as possible using requestAnimationFrame
    this.renderLoop();
  }

  private renderLoop = (): void => {
    if (!this.isRunning || this.frameIndex >= this.totalFrames) {
      this.stopRecording();
      return;
    }

    // Draw frame
    const idx = this.frameIndex;
    const point = this.points[idx];
    const absIdx = this.allPoints.indexOf(point);

    drawOverlay(
      this.ctx,
      this.config,
      point,
      this.allPoints,
      absIdx >= 0 ? absIdx : idx,
      this.bounds
    );

    // Request stream capture
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

    // Next frame immediately
    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  private stopRecording(): void {
    this.isRunning = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
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
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  private cleanup(): void {
    this.isRunning = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
