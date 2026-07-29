// ═══════════════════════════════════════════════════════════════
// Video Exporter — WebM via MediaRecorder
// Chroma key green background · Canvas capture · Download
// ═══════════════════════════════════════════════════════════════

import { ISkin } from '../skins/types.js';
import { FitPoint, MapBounds } from '../fit/types.js';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;          // output fps (e.g. 30, 24, 1)
  points: number;       // how many data points to render
  freq: number;         // seconds per point from source
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
    
    // Set canvas size
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    
    // Capture stream ONCE
    this.stream = this.canvas.captureStream(0);
    
    // Try different MIME types for best compatibility
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    let mimeType = '';
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }
    
    if (!mimeType) {
      this.options.onError('No supported video MIME type found');
      return;
    }
    
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: 8000000
    });
    
    // timeslice = 1000ms → data emitted every second, prevents empty blob
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
      this.options.onError(`MediaRecorder error: ${e.message || 'Unknown'}`);
      this.cleanup();
    };
    
    // Stable interval-based timing
    const delay = Math.max(33, 1000 / Math.max(1, this.options.fps));
    this.intervalId = window.setInterval(() => this.renderFrame(), delay);
  }
  
  private renderFrame(): void {
    if (!this.isRunning || this.frameIndex >= this.totalFrames) {
      this.stopRecording();
      return;
    }
    
    const idx = this.frameIndex;
    const point = this.points[idx];
    const absIdx = this.allPoints.indexOf(point);
    
    // Draw frame
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
        elapsed: point.elapsed
      }
    );
    
    // Request frame capture on the ORIGINAL stream track
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
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `paceparser2_overlay_${Date.now()}.${ext}`;
      this.options.onComplete(blob, filename);
    } else {
      this.options.onError('No video data recorded');
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
    // Stop all stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
