// ═══════════════════════════════════════════════════════════════
// WebCodecs Exporter — MP4 H.264 hardware-accelerated
//
// Timeline-exact: 1 data point = exactly 1 second displayed.
// Encoded at 30fps with frame duplication (each point drawn once,
// emitted 30×) → standard MP4 that CapCut / WhatsApp accept.
// ═══════════════════════════════════════════════════════════════

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { OverlayConfig, drawOverlay } from '../blocks.js';
import { FitPoint, MapBounds } from '../fit/types.js';

const OUT_FPS = 30;

// Codec candidates, tried in order (High → Main → Baseline)
const CODEC_CANDIDATES = [
  'avc1.640034', // H.264 High @ Level 5.2
  'avc1.640028', // H.264 High @ Level 4.0
  'avc1.4d0028', // H.264 Main @ Level 4.0
  'avc1.42001f', // H.264 Baseline @ Level 3.1
];

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

/**
 * Resample data points to exactly 1 Hz based on elapsed time.
 * Guarantees: video second N shows data from source second N.
 */
export function resampleTo1Hz(points: FitPoint[]): FitPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  const t0 = points[0].elapsed;
  const t1 = points[points.length - 1].elapsed;
  const duration = Math.max(1, Math.round(t1 - t0));

  const out: FitPoint[] = [];
  let cursor = 0;

  for (let k = 0; k < duration; k++) {
    const target = t0 + k;
    // Advance cursor to the point closest to target time
    while (
      cursor < points.length - 1 &&
      Math.abs(points[cursor + 1].elapsed - target) <= Math.abs(points[cursor].elapsed - target)
    ) {
      cursor++;
    }
    out.push(points[cursor]);
  }
  return out;
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
    // H.264 requires even dimensions
    const width = this.options.width & ~1;
    const height = this.options.height & ~1;

    // Resample to exact 1 Hz timeline
    const samples = resampleTo1Hz(this.points);
    const totalSeconds = samples.length;

    if (totalSeconds === 0) {
      this.options.onError('Aucune donnée à exporter');
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;

    // Find a supported H.264 codec
    const encoderConfig = await this.findSupportedCodec(width, height);
    if (!encoderConfig) {
      this.options.onError('Aucun codec H.264 supporté par ce navigateur (WebCodecs)');
      return;
    }
    console.log('[PP2] WebCodecs codec:', encoderConfig.codec, `${width}x${height}@${OUT_FPS}fps`);

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height,
        frameRate: OUT_FPS,
      },
      fastStart: 'in-memory',
    });

    let encoderError: Error | null = null;
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encoderError = e; },
    });
    this.encoder.configure(encoderConfig);

    const frameDuration = Math.round(1_000_000 / OUT_FPS); // µs per output frame
    let frameCounter = 0;

    // ── Encode loop ──────────────────────────────
    for (let i = 0; i < totalSeconds; i++) {
      if (this.cancelled) { this.safeClose(); return; }
      if (encoderError) {
        this.options.onError(`Erreur encodage: ${encoderError.message}`);
        this.safeClose();
        return;
      }

      // Draw ONCE per data point (1 second of video)
      const point = samples[i];
      const absIdx = this.allPoints.indexOf(point);
      drawOverlay(
        this.ctx,
        this.config,
        point,
        this.allPoints,
        absIdx >= 0 ? absIdx : i,
        this.bounds
      );

      // Emit OUT_FPS identical frames → exactly 1 second of video
      for (let j = 0; j < OUT_FPS; j++) {
        const frame = new VideoFrame(this.canvas, {
          timestamp: frameCounter * frameDuration,
          duration: frameDuration,
        });
        this.encoder.encode(frame, {
          keyFrame: frameCounter % (OUT_FPS * 2) === 0, // keyframe every 2s
        });
        frame.close();
        frameCounter++;
      }

      // Progress + UI breath every second of data
      this.options.onProgress(
        Math.round(((i + 1) / totalSeconds) * 100),
        i + 1,
        totalSeconds
      );
      await new Promise(r => setTimeout(r, 0));

      // Backpressure
      while (this.encoder.encodeQueueSize > OUT_FPS * 3) {
        if (this.cancelled) break;
        await new Promise(r => setTimeout(r, 2));
      }
    }

    // ── Finalize ─────────────────────────────────
    try {
      await this.encoder.flush();
      this.safeClose();
      muxer.finalize();

      const { buffer } = muxer.target as ArrayBufferTarget;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      console.log(`[PP2] MP4 ready: ${sizeMB} MB, ${frameCounter} frames, ${totalSeconds}s`);
      const filename = `paceparser2_overlay_${Date.now()}.mp4`;
      this.options.onComplete(blob, filename);
    } catch (e: any) {
      this.options.onError(`Finalisation échouée: ${e.message}`);
    }
  }

  private async findSupportedCodec(width: number, height: number): Promise<VideoEncoderConfig | null> {
    for (const codec of CODEC_CANDIDATES) {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: OUT_FPS,
        hardwareAcceleration: 'prefer-hardware',
      };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) return config;
      } catch {
        // try next
      }
    }
    return null;
  }

  private safeClose(): void {
    try { this.encoder?.close(); } catch { /* already closed */ }
    this.encoder = null;
  }

  stop(): void {
    this.cancelled = true;
  }
}
