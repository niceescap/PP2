// ═══════════════════════════════════════════════════════════════
// PaceParser2 — Main Application
// FIT import → Customizable blocks → Fast export
// ═══════════════════════════════════════════════════════════════

import { parseFIT, FitActivity } from './fit/index.js';
import { OverlayConfig, Block, createDefaultConfig, drawOverlay } from './blocks.js';
import { VideoExporter, WebCodecsExporter, isWebCodecsSupported } from './export/index.js';

// ── State ───────────────────────────────────────
interface AppState {
  activity: FitActivity | null;
  config: OverlayConfig;
  selectedPointIdx: number;
  isPlaying: boolean;
  playTimer: number | null;
  isExporting: boolean;
  exportStartIdx: number;
  exportEndIdx: number;
  selectedBlockId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  activeExporter: VideoExporter | WebCodecsExporter | null;
}

const state: AppState = {
  activity: null,
  config: createDefaultConfig(1920, 1080),
  selectedPointIdx: 0,
  isPlaying: false,
  playTimer: null,
  isExporting: false,
  exportStartIdx: 0,
  exportEndIdx: 0,
  selectedBlockId: null,
  isDragging: false,
  isResizing: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  activeExporter: null,
};

// ── DOM ─────────────────────────────────────────
const dom = {
  dropzone: document.getElementById('dropzone') as HTMLDivElement,
  fileInput: document.getElementById('fileInput') as HTMLInputElement,
  canvas: document.getElementById('previewCanvas') as HTMLCanvasElement,
  ctx: (document.getElementById('previewCanvas') as HTMLCanvasElement).getContext('2d')!,

  sectionImport: document.getElementById('sectionImport') as HTMLElement,
  sectionStats: document.getElementById('sectionStats') as HTMLElement,
  sectionTimeline: document.getElementById('sectionTimeline') as HTMLElement,
  sectionBlocks: document.getElementById('sectionBlocks') as HTMLElement,

  statsGrid: document.getElementById('statsGrid') as HTMLElement,
  timelineSlider: document.getElementById('timelineSlider') as HTMLInputElement,
  btnPlayPause: document.getElementById('btnPlayPause') as HTMLButtonElement,
  startTime: document.getElementById('startTime') as HTMLElement,
  endTime: document.getElementById('endTime') as HTMLElement,
  selDuration: document.getElementById('selDuration') as HTMLElement,
  blocksList: document.getElementById('blocksList') as HTMLElement,

  btnGenerate: document.getElementById('btnGenerate') as HTMLButtonElement,
  btnStop: document.getElementById('btnStop') as HTMLButtonElement,
  exportResolution: document.getElementById('exportResolution') as HTMLSelectElement,
  exportRangeLabel: document.getElementById('exportRangeLabel') as HTMLElement,
  exportDurationLabel: document.getElementById('exportDurationLabel') as HTMLElement,
  exportProgress: document.getElementById('exportProgress') as HTMLElement,
  progressFill: document.getElementById('progressFill') as HTMLElement,
  progressLabel: document.getElementById('progressLabel') as HTMLElement,
  rangeStart: document.getElementById('rangeStart') as HTMLInputElement,
  rangeEnd: document.getElementById('rangeEnd') as HTMLInputElement,

  headerStatus: document.getElementById('headerStatus') as HTMLElement,
  frameBadge: document.getElementById('frameBadge') as HTMLElement,
  toast: document.getElementById('toast') as HTMLElement,

  btnToggleBg: document.getElementById('btnToggleBg') as HTMLButtonElement,
  engineInfo: document.getElementById('engineInfo') as HTMLElement,
};

// ── Init ────────────────────────────────────────
function init(): void {
  setupDropzone();
  setupTimelineControls();
  setupExportControls();
  setupCanvasInteraction();
  updateCanvasSize();
  detectEngine();
  showToast('PaceParser2 prêt — importez un FIT');
}

function detectEngine(): void {
  if (isWebCodecsSupported()) {
    dom.engineInfo.textContent = '⚡ Moteur: WebCodecs → MP4 rapide';
    dom.engineInfo.classList.add('engine-fast');
  } else {
    dom.engineInfo.textContent = '🐢 Moteur: MediaRecorder → WebM temps réel';
    dom.engineInfo.classList.add('engine-slow');
  }
}

// ── Canvas sizing ───────────────────────────────
function updateCanvasSize(): void {
  const container = document.getElementById('canvasContainer')!;
  const maxW = container.clientWidth - 40;
  const maxH = container.clientHeight - 40;
  const aspect = state.config.width / state.config.height;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  dom.canvas.style.width = `${w}px`;
  dom.canvas.style.height = `${h}px`;
}

// ── File import ─────────────────────────────────
function setupDropzone(): void {
  dom.dropzone.addEventListener('click', () => dom.fileInput.click());
  dom.dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dom.dropzone.classList.add('dragover'); });
  dom.dropzone.addEventListener('dragleave', () => dom.dropzone.classList.remove('dragover'));
  dom.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) loadFile(file);
  });
  dom.fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) loadFile(file);
  });
}

function loadFile(file: File): void {
  showToast(`📂 Lecture de ${file.name}...`);
  dom.headerStatus.innerHTML = '<span class="status-label">Analyse...</span>';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target?.result as ArrayBuffer;
      const activity = parseFIT(buffer);
      if (activity.points.length === 0) {
        showToast('❌ Aucune donnée trouvée');
        return;
      }
      state.activity = activity;
      state.selectedPointIdx = 0;
      state.config = createDefaultConfig(state.config.width, state.config.height);

      enableSections();
      renderStats(activity);
      updateTimelineRange();
      renderBlocksList();
      renderPreview();

      showToast(`✅ ${activity.points.length} points — durée ${formatDuration(activity.meta.totalDuration)}`);
      dom.headerStatus.innerHTML = `<span class="status-label">✓ ${file.name}</span>`;
    } catch (err: any) {
      showToast(`❌ Erreur: ${err.message}`);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Stats ───────────────────────────────────────
function renderStats(activity: FitActivity): void {
  const m = activity.meta;
  const stats: Array<{ val: string; lbl: string }> = [
    { val: formatDuration(m.totalDuration), lbl: 'Durée' },
    { val: `${(m.totalDistance / 1000).toFixed(1)} km`, lbl: 'Distance' },
  ];
  if (m.hasPower) {
    stats.push({ val: `${m.avgPower} W`, lbl: 'P. moy' });
    stats.push({ val: `${m.maxPower} W`, lbl: 'P. max' });
  }
  if (m.hasHr) {
    stats.push({ val: `${m.avgHr} bpm`, lbl: 'FC moy' });
    stats.push({ val: `${m.maxHr} bpm`, lbl: 'FC max' });
  }
  if (m.hasCadence) stats.push({ val: `${m.avgCad} rpm`, lbl: 'Cad. moy' });
  if (m.hasAltitude) stats.push({ val: `${Math.round(m.totalDplus)} m`, lbl: 'Dénivelé' });

  dom.statsGrid.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-val">${s.val}</div>
      <div class="stat-lbl">${s.lbl}</div>
    </div>
  `).join('');
}

// ── Timeline ────────────────────────────────────
function setupTimelineControls(): void {
  dom.timelineSlider.addEventListener('input', () => {
    if (!state.activity) return;
    state.selectedPointIdx = parseInt(dom.timelineSlider.value);
    stopPlayback();
    renderPreview();
    updateTimelineInfo();
  });
  dom.btnPlayPause.addEventListener('click', togglePlayback);
}

function updateTimelineRange(): void {
  if (!state.activity) return;
  const max = state.activity.points.length - 1;
  dom.timelineSlider.max = max.toString();
  dom.timelineSlider.value = '0';
  updateTimelineInfo();
}

function updateTimelineInfo(): void {
  if (!state.activity) return;
  const max = state.activity.points.length - 1;
  const startPt = state.activity.points[state.selectedPointIdx];
  const endPt = state.activity.points[max];
  dom.startTime.textContent = formatTimeShort(startPt.elapsed);
  dom.endTime.textContent = formatTimeShort(endPt.elapsed);
  dom.selDuration.textContent = formatTimeShort(endPt.elapsed - startPt.elapsed);
}

function togglePlayback(): void {
  if (!state.activity) return;
  if (state.isPlaying) stopPlayback(); else startPlayback();
}

function startPlayback(): void {
  state.isPlaying = true;
  dom.btnPlayPause.textContent = '⏸';
  state.playTimer = window.setInterval(() => {
    if (!state.activity) return;
    state.selectedPointIdx++;
    if (state.selectedPointIdx >= state.activity.points.length) state.selectedPointIdx = 0;
    dom.timelineSlider.value = state.selectedPointIdx.toString();
    renderPreview();
    updateTimelineInfo();
  }, 100);
}

function stopPlayback(): void {
  state.isPlaying = false;
  dom.btnPlayPause.textContent = '▶';
  if (state.playTimer) { clearInterval(state.playTimer); state.playTimer = null; }
}

// ── Blocks customization ────────────────────────
function renderBlocksList(): void {
  dom.blocksList.innerHTML = state.config.blocks.map(block => `
    <div class="block-item ${state.selectedBlockId === block.id ? 'selected' : ''}" data-block-id="${block.id}">
      <div class="block-header">
        <input type="checkbox" ${block.visible ? 'checked' : ''} data-action="toggle" />
        <span class="block-name">${block.label}</span>
      </div>
      ${state.selectedBlockId === block.id ? renderBlockEditor(block) : ''}
    </div>
  `).join('');

  // Events
  dom.blocksList.querySelectorAll('.block-item').forEach(el => {
    const id = (el as HTMLElement).dataset.blockId!;
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).dataset.action === 'toggle') return;
      state.selectedBlockId = state.selectedBlockId === id ? null : id;
      renderBlocksList();
    });
  });

  dom.blocksList.querySelectorAll('[data-action="toggle"]').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = (e.target as HTMLElement).closest('.block-item')!.dataset.blockId!;
      const block = state.config.blocks.find(b => b.id === id);
      if (block) { block.visible = (e.target as HTMLInputElement).checked; renderPreview(); }
    });
  });

  // Editor inputs
  if (state.selectedBlockId) {
    const block = state.config.blocks.find(b => b.id === state.selectedBlockId);
    if (block) bindBlockEditor(block);
  }
}

function renderBlockEditor(block: Block): string {
  return `
    <div class="block-editor">
      <div class="editor-row">
        <label>X</label>
        <input type="number" data-prop="x" value="${block.x}" step="10" />
        <label>Y</label>
        <input type="number" data-prop="y" value="${block.y}" step="10" />
      </div>
      <div class="editor-row">
        <label>L</label>
        <input type="number" data-prop="w" value="${block.w}" step="10" min="40" />
        <label>H</label>
        <input type="number" data-prop="h" value="${block.h}" step="10" min="40" />
      </div>
      <div class="editor-row">
        <label>Couleur texte</label>
        <input type="color" data-style="textColor" value="${block.style.textColor}" />
      </div>
      <div class="editor-row">
        <label>Couleur fond</label>
        <input type="color" data-style="bgColor" value="${rgbaToHex(block.style.bgColor)}" />
      </div>
      <div class="editor-row">
        <label>Couleur accent</label>
        <input type="color" data-style="accentColor" value="${block.style.accentColor}" />
      </div>
      <div class="editor-row">
        <label>Taille police</label>
        <input type="range" data-style="fontSize" value="${block.style.fontSize}" min="20" max="120" step="2" />
        <span>${block.style.fontSize}px</span>
      </div>
      <div class="editor-row">
        <label>Label</label>
        <input type="text" data-prop="label" value="${block.label}" />
      </div>
    </div>
  `;
}

function bindBlockEditor(block: Block): void {
  const editor = dom.blocksList.querySelector(`[data-block-id="${block.id}"] .block-editor`);
  if (!editor) return;

  editor.querySelectorAll('input[data-prop]').forEach(el => {
    el.addEventListener('input', (e) => {
      const prop = (e.target as HTMLElement).dataset.prop!;
      const val = (e.target as HTMLInputElement).value;
      if (['x', 'y', 'w', 'h'].includes(prop)) {
        (block as any)[prop] = parseInt(val);
      } else {
        (block as any)[prop] = val;
      }
      renderPreview();
    });
  });

  editor.querySelectorAll('input[data-style]').forEach(el => {
    el.addEventListener('input', (e) => {
      const prop = (e.target as HTMLElement).dataset.style!;
      const val = (e.target as HTMLInputElement).value;
      (block.style as any)[prop] = val;
      renderPreview();
    });
  });
}

// ── Canvas drag & drop ──────────────────────────
function setupCanvasInteraction(): void {
  const getCanvasCoords = (e: MouseEvent | Touch) => {
    const rect = dom.canvas.getBoundingClientRect();
    const scaleX = state.config.width / rect.width;
    const scaleY = state.config.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const findBlockAt = (x: number, y: number): Block | null => {
    // Iterate in reverse to find topmost block
    for (let i = state.config.blocks.length - 1; i >= 0; i--) {
      const b = state.config.blocks[i];
      if (!b.visible) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  };

  const onPointerDown = (e: MouseEvent) => {
    if (!state.activity) return;
    const { x, y } = getCanvasCoords(e);
    const block = findBlockAt(x, y);
    if (block) {
      state.selectedBlockId = block.id;
      state.isDragging = true;
      state.dragOffsetX = x - block.x;
      state.dragOffsetY = y - block.y;
      renderBlocksList();
    }
  };

  const onPointerMove = (e: MouseEvent) => {
    if (!state.isDragging || !state.selectedBlockId) return;
    const { x, y } = getCanvasCoords(e);
    const block = state.config.blocks.find(b => b.id === state.selectedBlockId);
    if (block) {
      block.x = Math.max(0, Math.min(state.config.width - block.w, x - state.dragOffsetX));
      block.y = Math.max(0, Math.min(state.config.height - block.h, y - state.dragOffsetY));
      renderPreview();
    }
  };

  const onPointerUp = () => {
    state.isDragging = false;
  };

  dom.canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
}

// ── Preview ─────────────────────────────────────
function renderPreview(): void {
  if (!state.activity) return;
  const point = state.activity.points[state.selectedPointIdx];
  drawOverlay(
    dom.ctx,
    state.config,
    point,
    state.activity.points,
    state.selectedPointIdx,
    state.activity.bounds
  );
  dom.frameBadge.textContent = `Frame ${state.selectedPointIdx + 1} / ${state.activity.points.length}`;
}

// ── Export ──────────────────────────────────────
function setupExportControls(): void {
  dom.btnGenerate.addEventListener('click', startExport);
  dom.btnStop.addEventListener('click', stopExport);
  dom.rangeStart?.addEventListener('input', updateExportRange);
  dom.rangeEnd?.addEventListener('input', updateExportRange);
  dom.btnToggleBg.addEventListener('click', toggleBg);
}

function toggleBg(): void {
  const modes: Array<'green' | 'transparent' | 'black'> = ['green', 'transparent', 'black'];
  const idx = modes.indexOf(state.config.bgMode);
  state.config.bgMode = modes[(idx + 1) % modes.length];
  state.config.bgColor = state.config.bgMode === 'green' ? '#00ff66' : state.config.bgMode === 'black' ? '#000000' : 'transparent';
  renderPreview();
  const labels: Record<string, string> = { green: '🟩 Vert', transparent: '⬜ Transparent', black: '⬛ Noir' };
  showToast(labels[state.config.bgMode]);
}

function updateExportRange(): void {
  if (!state.activity) return;
  const max = state.activity.points.length - 1;
  let startIdx = parseInt(dom.rangeStart.value);
  let endIdx = parseInt(dom.rangeEnd.value);
  if (startIdx >= endIdx) { startIdx = Math.max(0, endIdx - 1); dom.rangeStart.value = startIdx.toString(); }
  state.exportStartIdx = startIdx;
  state.exportEndIdx = endIdx;

  const startTime = state.activity.points[startIdx].elapsed;
  const endTime = state.activity.points[endIdx].elapsed;
  dom.exportRangeLabel.textContent = `${formatTimeShort(startTime)} → ${formatTimeShort(endTime)}`;
  dom.exportDurationLabel.textContent = formatDuration(endTime - startTime);
}

function startExport(): void {
  if (!state.activity || state.isExporting) return;
  const res = dom.exportResolution.value.split('x').map(Number);
  const startIdx = state.exportStartIdx;
  const endIdx = state.exportEndIdx;
  if (endIdx <= startIdx) { showToast('⚠️ Plage invalide'); return; }

  const exportPoints = state.activity.points.slice(startIdx, endIdx + 1);
  const durationSec = exportPoints[exportPoints.length - 1].elapsed - exportPoints[0].elapsed;
  const totalFrames = exportPoints.length;

  state.isExporting = true;
  dom.btnGenerate.classList.add('hidden');
  dom.btnStop.classList.remove('hidden');
  dom.exportProgress.classList.remove('hidden');

  const finishUI = () => {
    state.isExporting = false;
    state.activeExporter = null;
    dom.btnGenerate.classList.remove('hidden');
    dom.btnStop.classList.add('hidden');
    dom.exportProgress.classList.add('hidden');
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onProgress = (pct: number, frame: number, total: number) => {
    dom.progressFill.style.width = `${pct}%`;
    dom.progressLabel.textContent = `${pct}% (${frame}/${total})`;
  };

  // ── Choix du moteur ──────────────────────────────
  // WebCodecs MP4 = rapide, timeline-exacte → préféré
  // MediaRecorder WebM = temps réel → fallback (ou si transparent)
  const preferWebCodecs = isWebCodecsSupported() && state.config.bgMode !== 'transparent';

  const startMediaRecorder = () => {
    showToast('🐢 Export WebM (temps réel)');
    const exporter = new VideoExporter(
      dom.canvas,
      state.config,
      exportPoints,
      state.activity.points,
      state.activity.bounds,
      {
        width: res[0],
        height: res[1],
        fps: 1,
        totalFrames,
        samplesPerSec: 1,
        bgMode: state.config.bgMode,
        onProgress,
        onComplete: (blob, filename) => {
          download(blob, filename);
          finishUI();
          showToast(`✅ ${filename} (${formatDuration(durationSec)})`);
        },
        onError: (err) => {
          finishUI();
          showToast(`❌ ${err}`);
        }
      }
    );
    state.activeExporter = exporter;
    exporter.start();
  };

  if (preferWebCodecs) {
    showToast('⚡ Export MP4 rapide');
    let fallbackDone = false;
    const exporter = new WebCodecsExporter(
      dom.canvas,
      state.config,
      exportPoints,
      state.activity.points,
      state.activity.bounds,
      {
        width: res[0],
        height: res[1],
        onProgress,
        onComplete: (blob, filename) => {
          download(blob, filename);
          finishUI();
          showToast(`✅ ${filename} (${formatDuration(durationSec)})`);
        },
        onError: (err) => {
          if (fallbackDone) { finishUI(); showToast(`❌ ${err}`); return; }
          fallbackDone = true;
          console.warn('[PP2] WebCodecs failed, fallback to MediaRecorder:', err);
          showToast(`⚠️ ${err} — bascule WebM`);
          state.activeExporter = null;
          startMediaRecorder();
        }
      }
    );
    state.activeExporter = exporter;
    exporter.start();
  } else {
    if (state.config.bgMode === 'transparent') {
      showToast('ℹ️ Fond transparent → WebM temps réel (pas d\'alpha en MP4)');
    }
    startMediaRecorder();
  }
}

function stopExport(): void {
  if (state.activeExporter) {
    state.activeExporter.stop();
    state.activeExporter = null;
  }
  state.isExporting = false;
  dom.btnGenerate.classList.remove('hidden');
  dom.btnStop.classList.add('hidden');
  dom.exportProgress.classList.add('hidden');
  showToast('⏹️ Export annulé');
}

// ── Enable sections ─────────────────────────────
function enableSections(): void {
  dom.sectionStats.classList.remove('hidden');
  dom.sectionTimeline.classList.remove('hidden');
  dom.sectionBlocks.classList.remove('hidden');
  dom.btnGenerate.disabled = false;

  if (dom.rangeStart && dom.rangeEnd && state.activity) {
    const max = state.activity.points.length - 1;
    dom.rangeStart.max = max.toString();
    dom.rangeEnd.max = max.toString();
    dom.rangeStart.value = '0';
    dom.rangeEnd.value = max.toString();
    state.exportStartIdx = 0;
    state.exportEndIdx = max;
    updateExportRange();
  }
}

// ── Utilities ───────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function rgbaToHex(rgba: string): string {
  if (rgba.startsWith('#')) return rgba;
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function showToast(msg: string): void {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

// ── Bootstrap ───────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', updateCanvasSize);
