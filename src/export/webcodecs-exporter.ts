// ═══════════════════════════════════════════════════════════════
// WebCodecs Exporter — MP4 H.264 hardware-accelerated
// No real-time wait: encode frames as fast as they are drawn
// Output: MP4 file natively importable in CapCut
// ═══════════════════════════════════════════════════════════════

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { OverlayConfig, drawOverlay } from '../blocks.js';
import { FitPoint, MapBounds } from '../fit/types.js';

export interface WebCodecsExportOptions {
  width: number;
  height: number;
  onProgress: (pct: number, frame: number, total: number) => void;
  onComplete: (blob: Blob, filename: string) => void;
  onError: (err: string) => void;
}

export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

export class WebCodecsExporter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: OverlayConfig;
  private points: FitPoint[];
  private allPoints: FitPoint[];
  private bounds: MapBounds | null;
  private options: WebCodecsExportOptions;
  private cancelled = false;
  private encoder: VideoEncoder | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    config: OverlayConfig,
    points: FitPoint[],
    allPoints: FitPoint[],
    bounds: MapBounds | null,
    options: WebCodecsExportOptions
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.config = config;
    this.points = points;
    this.allPoints = allPoints;
    this.bounds = bounds;
    this.options = options;
  }

  async start(): Promise<void> {
    const { width, height } = this.options;
    const total = this.points.length;

    if (total === 0) {
      this.options.onError('Aucune frame à exporter');
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;

    // 1 fps → durée vidéo = durée source
    const fps = 1;
    const frameDuration = Math.round(1_000_000 / fps); // µs

    const encoderConfig: VideoEncoderConfig = {
      codec: 'avc1.640028', // H.264 High Profile 4.0
      width,
      height,
      bitrate: 8_000_000,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
    };

    try {
      const support = await VideoEncoder.isConfigSupported(encoderConfig);
      if (!support.supported) {
        this.options.onError('Encodage H.264 non supporté par ce navigateur');
        return;
      }
    } catch (e: any) {
      this.options.onError(`WebCodecs indisponible: ${e.message}`);
      return;
    }

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height,
        frameRate: fps,
      },
      fastStart: 'in-memory',
    });

    let encoderError: Error | null = null;
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encoderError = e; },
    });
    this.encoder.configure(encoderConfig);

    // ── Encode loop ──────────────────────────────
    for (let i = 0; i < total; i++) {
      if (this.cancelled) {
        try { this.encoder.close(); } catch { /* noop */ }
        return;
      }
      if (encoderError) {
        this.options.onError(`Erreur encodage: ${encoderError.message}`);
        try { this.encoder.close(); } catch { /* noop */ }
        return;
      }

      // Draw frame
      const point = this.points[i];
      const absIdx = this.allPoints.indexOf(point);
      drawOverlay(
        this.ctx,
        this.config,
        point,
        this.allPoints,
        absIdx >= 0 ? absIdx : i,
        this.bounds
      );

      // Encode frame (timestamp in µs → exact duration)
      const frame = new VideoFrame(this.canvas, {
        timestamp: i * frameDuration,
        duration: frameDuration,
      });
      this.encoder.encode(frame, { keyFrame: i % 10 === 0 });
      frame.close();

      // UI breath + progress every 5 frames
      if (i % 5 === 0 || i === total - 1) {
        this.options.onProgress(Math.round(((i + 1) / total) * 100), i + 1, total);
        await new Promise(r => setTimeout(r, 0));
      }

      // Backpressure: don't flood the encoder queue
      while (this.encoder.encodeQueueSize > 8) {
        await new Promise(r => setTimeout(r, 2));
        if (this.cancelled) break;
      }
    }

    // ── Finalize ─────────────────────────────────
    try {
      await this.encoder.flush();
      this.encoder.close();
      muxer.finalize();

      const { buffer } = muxer.target as ArrayBufferTarget;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const filename = `paceparser2_overlay_${Date.now()}.mp4`;
      this.options.onComplete(blob, filename);
    } catch (e: any) {
      this.options.onError(`Finalisation échouée: ${e.message}`);
    }
  }

  stop(): void {
    this.cancelled = true;
  }
}
