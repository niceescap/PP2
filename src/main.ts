// ═══════════════════════════════════════════════════════════════
// PaceParser2 — Main Application
// ORCHESTRATION: FIT import → Preview → Skin switch → Export
// ═══════════════════════════════════════════════════════════════

import { parseFIT, FitActivity, FitPoint } from './fit/index.js';
import { SKIN_REGISTRY, createSkin, getSkinDefinition } from './skins/registry.js';
import { ISkin, SkinConfig } from './skins/types.js';
import { VideoExporter, ExportOptions } from './export/index.js';

// ── State ───────────────────────────────────────
interface AppState {
  activity: FitActivity | null;
  currentSkin: ISkin;
  selectedPointIdx: number;
  isPlaying: boolean;
  playTimer: number | null;
  showMap: boolean;
  bgMode: 'green' | 'transparent';
  isExporting: boolean;
  exportStartIdx: number;
  exportEndIdx: number;
}

const state: AppState = {
  activity: null,
  currentSkin: createSkin('cinematic-dark'),
  selectedPointIdx: 0,
  isPlaying: false,
  playTimer: null,
  showMap: true,
  bgMode: 'green',
  isExporting: false,
  exportStartIdx: 0,
  exportEndIdx: 0,
};

// ── DOM References ──────────────────────────────
const dom = {
  dropzone: document.getElementById('dropzone') as HTMLDivElement,
  fileInput: document.getElementById('fileInput') as HTMLInputElement,
  canvas: document.getElementById('previewCanvas') as HTMLCanvasElement,
  ctx: (document.getElementById('previewCanvas') as HTMLCanvasElement).getContext('2d')!,
  
  // Sections
  sectionImport: document.getElementById('sectionImport') as HTMLElement,
  sectionStats: document.getElementById('sectionStats') as HTMLElement,
  sectionTimeline: document.getElementById('sectionTimeline') as HTMLElement,
  sectionSkin: document.getElementById('sectionSkin') as HTMLElement,
  sectionCustomize: document.getElementById('sectionCustomize') as HTMLElement,
  
  // Controls
  statsGrid: document.getElementById('statsGrid') as HTMLElement,
  timelineSlider: document.getElementById('timelineSlider') as HTMLInputElement,
  btnPlayPause: document.getElementById('btnPlayPause') as HTMLButtonElement,
  startTime: document.getElementById('startTime') as HTMLElement,
  endTime: document.getElementById('endTime') as HTMLElement,
  selDuration: document.getElementById('selDuration') as HTMLElement,
  skinGrid: document.getElementById('skinGrid') as HTMLElement,
  customizeList: document.getElementById('customizeList') as HTMLElement,
  
  // Export
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
  
  // Display
  headerStatus: document.getElementById('headerStatus') as HTMLElement,
  frameBadge: document.getElementById('frameBadge') as HTMLElement,
  skinBadge: document.getElementById('skinBadge') as HTMLElement,
  toast: document.getElementById('toast') as HTMLElement,
  
  // Toggles
  btnToggleMap: document.getElementById('btnToggleMap') as HTMLButtonElement,
  btnToggleBg: document.getElementById('btnToggleBg') as HTMLButtonElement,
};

// ── Initialization ──────────────────────────────
function init(): void {
  setupDropzone();
  setupSkinSelector();
  setupTimelineControls();
  setupExportControls();
  setupToggles();
  updateCanvasSize();
  renderSkinBadge();
  showToast('PaceParser2 prêt — importez un fichier FIT');
}

// ── File Import ─────────────────────────────────
function setupDropzone(): void {
  dom.dropzone.addEventListener('click', () => dom.fileInput.click());
  dom.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropzone.classList.add('dragover');
  });
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
  dom.headerStatus.innerHTML = '<span class="status-label">Analyse en cours...</span>';
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target?.result as ArrayBuffer;
      const activity = parseFIT(buffer);
      
      if (activity.points.length === 0) {
        showToast('❌ Aucune donnée trouvée dans le fichier');
        return;
      }
      
      state.activity = activity;
      state.selectedPointIdx = 0;
      
      enableSections();
      renderStats(activity);
      updateTimelineRange();
      renderPreview();
      
      showToast(`✅ ${activity.points.length} points chargés`);
      dom.headerStatus.innerHTML = `<span class="status-label">✓ ${file.name} — ${formatDuration(activity.meta.totalDuration)}</span>`;
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Erreur: ${err.message}`);
    }
  };
  reader.onerror = () => showToast('❌ Erreur de lecture fichier');
  reader.readAsArrayBuffer(file);
}

// ── Stats Display ───────────────────────────────
function renderStats(activity: FitActivity): void {
  const m = activity.meta;
  const stats: Array<{ val: string; lbl: string }> = [
    { val: formatDuration(m.totalDuration), lbl: 'Durée' },
    { val: `${(m.totalDistance/1000).toFixed(1)} km`, lbl: 'Distance' },
  ];
  
  if (m.hasPower) {
    stats.push({ val: `${m.avgPower} W`, lbl: 'Puissance moy' });
    stats.push({ val: `${m.maxPower} W`, lbl: 'Puissance max' });
  }
  if (m.hasHr) {
    stats.push({ val: `${m.avgHr} bpm`, lbl: 'FC moy' });
    stats.push({ val: `${m.maxHr} bpm`, lbl: 'FC max' });
  }
  if (m.hasCadence) {
    stats.push({ val: `${m.avgCad} rpm`, lbl: 'Cadence moy' });
  }
  if (m.hasAltitude) {
    stats.push({ val: `${Math.round(m.totalDplus)} m`, lbl: 'Dénivelé' });
  }
  
  dom.statsGrid.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-val">${s.val}</div>
      <div class="stat-lbl">${s.lbl}</div>
    </div>
  `).join('');
}

// ── Skin Selector ───────────────────────────────
function setupSkinSelector(): void {
  renderSkinSelector();
}

function renderSkinSelector(): void {
  dom.skinGrid.innerHTML = SKIN_REGISTRY.map(skin => `
    <div class="skin-card ${state.currentSkin.id === skin.id ? 'active' : ''}" data-skin-id="${skin.id}">
      <div class="skin-preview" style="background: ${skin.thumbnail};"></div>
      <div class="skin-name">${skin.name}</div>
    </div>
  `).join('');
  
  // Click handlers
  dom.skinGrid.querySelectorAll('.skin-card').forEach(card => {
    card.addEventListener('click', () => {
      const skinId = (card as HTMLElement).dataset.skinId!;
      selectSkin(skinId);
    });
  });
}

function selectSkin(skinId: string): void {
  state.currentSkin = createSkin(skinId);
  renderSkinSelector();
  renderCustomizationPanel();
  renderSkinBadge();
  renderPreview();
  showToast(`🎨 Skin: ${getSkinDefinition(skinId)?.name}`);
}

function renderSkinBadge(): void {
  dom.skinBadge.textContent = state.currentSkin.name;
}

// ── Customization Panel ─────────────────────────
function renderCustomizationPanel(): void {
  const fields = state.currentSkin.getCustomizableFields();
  
  dom.customizeList.innerHTML = fields.map(field => {
    const val = (state.currentSkin.config as any)[field.key];
    
    if (field.type === 'color') {
      return `
        <div class="form-row">
          <label>${field.label}</label>
          <input type="color" data-key="${field.key}" value="${val}" style="width:60px; height:32px; padding:2px;" />
        </div>
      `;
    } else if (field.type === 'boolean') {
      return `
        <div class="form-row">
          <label>${field.label}</label>
          <input type="checkbox" data-key="${field.key}" ${val ? 'checked' : ''} style="width:auto;" />
        </div>
      `;
    } else if (field.type === 'select') {
      return `
        <div class="form-row">
          <label>${field.label}</label>
          <select data-key="${field.key}" style="flex:1;">
            ${field.options?.map(opt => `<option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
          </select>
        </div>
      `;
    } else if (field.type === 'range' || field.type === 'number') {
      return `
        <div class="form-row">
          <label>${field.label}</label>
          <input type="${field.type}" data-key="${field.key}" value="${val}" min="${field.min}" max="${field.max}" step="${field.step || 1}" style="flex:1;" />
        </div>
      `;
    }
    return '';
  }).join('');
  
  // Bind change events
  dom.customizeList.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      const key = target.dataset.key!;
      
      let newVal: any;
      if (target.type === 'checkbox') {
        newVal = (target as HTMLInputElement).checked;
      } else if (target.type === 'range' || target.type === 'number') {
        newVal = parseFloat(target.value);
      } else {
        newVal = target.value;
      }
      
      (state.currentSkin.config as any)[key] = newVal;
      renderPreview();
    });
  });
}

// ── Timeline Controls ───────────────────────────
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
  const n = state.activity.points.length;
  const max = n - 1;
  const leftRatio = state.selectedPointIdx / max;
  
  const startPt = state.activity.points[state.selectedPointIdx];
  const endPt = state.activity.points[max];
  
  dom.startTime.textContent = formatTimeShort(startPt.elapsed);
  dom.endTime.textContent = formatTimeShort(endPt.elapsed);
  
  const dur = endPt.elapsed - startPt.elapsed;
  dom.selDuration.textContent = formatTimeShort(dur);
}

function togglePlayback(): void {
  if (!state.activity) return;
  if (state.isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback(): void {
  state.isPlaying = true;
  dom.btnPlayPause.textContent = '⏸';
  
  state.playTimer = window.setInterval(() => {
    if (!state.activity) return;
    state.selectedPointIdx++;
    if (state.selectedPointIdx >= state.activity.points.length) {
      state.selectedPointIdx = 0;
    }
    dom.timelineSlider.value = state.selectedPointIdx.toString();
    renderPreview();
    updateTimelineInfo();
  }, 200);
}

function stopPlayback(): void {
  state.isPlaying = false;
  dom.btnPlayPause.textContent = '▶';
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
}

// ── Preview Rendering ───────────────────────────
function renderPreview(): void {
  if (!state.activity) return;
  
  const canvas = dom.canvas;
  const ctx = dom.ctx;
  const point = state.activity.points[state.selectedPointIdx];
  
  // Clear transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw skin
  state.currentSkin.draw(
    ctx,
    canvas.width,
    canvas.height,
    point,
    state.activity.points,
    state.selectedPointIdx,
    state.showMap ? state.activity.bounds : null,
    {
      maxPower: state.activity.meta.maxPower,
      maxSpeed: state.activity.meta.maxSpeed,
      maxHr: state.activity.meta.maxHr,
      avgPower: state.activity.meta.avgPower,
      elapsed: point.elapsed,
    }
  );
  
  // Update badges
  dom.frameBadge.textContent = `Frame ${state.selectedPointIdx + 1} / ${state.activity.points.length}`;
}

function updateCanvasSize(): void {
  // Default 16:9 preview
  const container = document.getElementById('canvasContainer')!;
  const maxW = container.clientWidth - 40;
  const maxH = container.clientHeight - 40;
  
  // 16:9 ratio
  const aspect = 16 / 9;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  
  // CSS scaling handles display, internal canvas stays at 1920x1080 for high quality
  dom.canvas.style.width = `${w}px`;
  dom.canvas.style.height = `${h}px`;
}

// ── Toggles ─────────────────────────────────────
function setupToggles(): void {
  dom.btnToggleMap.addEventListener('click', () => {
    state.showMap = !state.showMap;
    renderPreview();
    showToast(state.showMap ? '🗺️ Carte activée' : '🗺️ Carte masquée');
  });
  
  dom.btnToggleBg.addEventListener('click', () => {
    if (state.currentSkin.config.bgMode === 'green') {
      state.currentSkin.config.bgMode = 'transparent';
    } else if (state.currentSkin.config.bgMode === 'transparent') {
      state.currentSkin.config.bgMode = 'black';
    } else {
      state.currentSkin.config.bgMode = 'green';
    }
    renderCustomizationPanel();
    renderPreview();
    const labels: Record<string, string> = { green: '🟩 Vert', transparent: '⬜ Transparent', black: '⬛ Noir' };
    showToast(labels[state.currentSkin.config.bgMode]);
  });
}

// ── Export Controls ─────────────────────────────
function setupExportControls(): void {
  dom.btnGenerate.addEventListener('click', startExport);
  dom.btnStop.addEventListener('click', stopExport);
}

function startExport(): void {
  if (!state.activity || state.isExporting) return;
  
  const format = dom.exportFormat.value;
  const res = dom.exportResolution.value.split('x').map(Number);
  const freq = parseFloat(dom.exportFreq.value);
  const points = parseInt(dom.exportPoints.value);
  const fps = parseInt(dom.exportFps.value);
  
  if (state.activity.points.length === 0) return;
  
  state.isExporting = true;
  dom.btnGenerate.classList.add('hidden');
  dom.btnStop.classList.remove('hidden');
  dom.exportProgress.classList.remove('hidden');
  
  // Prepare export points
  const startIdx = state.selectedPointIdx;
  const endIdx = Math.min(startIdx + points, state.activity.points.length);
  const exportPoints = state.activity.points.slice(startIdx, endIdx);
  
  // Update skin bg mode for export
  const exportBgMode = format.includes('green') ? 'green' : state.currentSkin.config.bgMode;
  state.currentSkin.config.bgMode = exportBgMode;
  
  const exporter = new VideoExporter(
    dom.canvas,
    state.currentSkin,
    exportPoints,
    state.activity.points,
    state.activity.bounds,
    {
      maxPower: state.activity.meta.maxPower,
      maxSpeed: state.activity.meta.maxSpeed,
      maxHr: state.activity.meta.maxHr,
      avgPower: state.activity.meta.avgPower,
    },
    {
      width: res[0],
      height: res[1],
      fps,
      points: exportPoints.length,
      freq,
      bgMode: exportBgMode,
      onProgress: (pct, frame, total) => {
        dom.progressFill.style.width = `${pct}%`;
        dom.progressLabel.textContent = `${pct}% (${frame}/${total})`;
      },
      onComplete: (blob, filename) => {
        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        state.isExporting = false;
        dom.btnGenerate.classList.remove('hidden');
        dom.btnStop.classList.add('hidden');
        dom.exportProgress.classList.add('hidden');
        showToast(`✅ Export terminé: ${filename}`);
      },
      onError: (err) => {
        state.isExporting = false;
        dom.btnGenerate.classList.remove('hidden');
        dom.btnStop.classList.add('hidden');
        dom.exportProgress.classList.add('hidden');
        showToast(`❌ Erreur export: ${err}`);
      }
    }
  );
  
  exporter.start();
}

function stopExport(): void {
  state.isExporting = false;
  dom.btnGenerate.classList.remove('hidden');
  dom.btnStop.classList.add('hidden');
  dom.exportProgress.classList.add('hidden');
  showToast('⏹️ Export annulé');
}

// ── Enable Sections ─────────────────────────────
function enableSections(): void {
  dom.sectionStats.classList.remove('hidden');
  dom.sectionTimeline.classList.remove('hidden');
  dom.sectionSkin.classList.remove('hidden');
  dom.sectionCustomize.classList.remove('hidden');
  dom.btnGenerate.disabled = false;
  
  renderCustomizationPanel();
}

// ── Utilities ───────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function showToast(msg: string): void {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

// ── Bootstrap ───────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', updateCanvasSize);
