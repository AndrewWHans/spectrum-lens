export type IQ = { i: number; q: number };
export type Scenario = 'qpsk' | 'fm' | 'crowded';
export type Bin = { frequency: number; db: number };
export type Analysis = {
  spectrum: Bin[];
  spectrogram: number[][];
  constellation: IQ[];
  bandwidth: number;
  bandStartHz: number;
  bandEndHz: number;
  peak: number;
  noise: number;
  threshold: number;
  snr: number;
  occupancy: number;
  peakOffset: number;
  modulation: string;
  confidence: string;
  evidence: string[];
  flags: { title: string; evidence: string; severity: string }[];
  meanAmp: number;
  ampCv: number;
  phaseStepStd: number;
  sampleCount: number;
};

export const DEMOS: { id: Scenario; name: string; meta: string }[] = [
  { id: 'qpsk', name: 'QPSK-like packet', meta: 'Bursty digital · 1.2 MS/s' },
  { id: 'fm', name: 'Narrowband FM voice', meta: 'Constant envelope · 500 kS/s' },
  { id: 'crowded', name: 'Crowded + burst anomaly', meta: 'Multi-carrier · 2.4 MS/s' },
];

const rand = (seed: number) => {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
};

export function generateDemo(type: Scenario, count = 2048): IQ[] {
  const random = rand(type === 'qpsk' ? 318 : type === 'fm' ? 812 : 1457);
  const out: IQ[] = [];
  let phase = 0;
  for (let n = 0; n < count; n++) {
    const t = n / count;
    const noiseI = (random() - .5) * .16;
    const noiseQ = (random() - .5) * .16;
    if (type === 'qpsk') {
      const sym = Math.floor(n / 20);
      const p = [Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, -Math.PI / 4][(sym * 17 + Math.floor(sym / 3)) % 4];
      const active = t > .09 && t < .91;
      const carrier = 0.18 * Math.sin(2 * Math.PI * .013 * n);
      out.push({ i: noiseI + (active ? .72 * Math.cos(p + carrier) : 0), q: noiseQ + (active ? .72 * Math.sin(p + carrier) : 0) });
    } else if (type === 'fm') {
      const audio = Math.sin(2 * Math.PI * 7 * t) * .022 + Math.sin(2 * Math.PI * 2.3 * t) * .012;
      phase += 2 * Math.PI * (.082 + audio);
      out.push({ i: .68 * Math.cos(phase) + noiseI * .45, q: .68 * Math.sin(phase) + noiseQ * .45 });
    } else {
      let i = .26 * Math.cos(2 * Math.PI * .08 * n) + .2 * Math.cos(2 * Math.PI * -.23 * n + .4) + noiseI;
      let q = .26 * Math.sin(2 * Math.PI * .08 * n) + .2 * Math.sin(2 * Math.PI * -.23 * n + .4) + noiseQ;
      const burst = t > .57 && t < .69;
      if (burst) { i += .75 * Math.cos(2 * Math.PI * .34 * n); q += .75 * Math.sin(2 * Math.PI * .34 * n); }
      out.push({ i, q });
    }
  }
  return out;
}

export function parseCsv(text: string): IQ[] {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(row => row.trim()).slice(0, 200000);
  if (!rows.length) throw new Error('The file is empty.');
  const split = (row: string) => row.trim().split(/[,\s;]+/).map(v => v.trim());
  const first = split(rows[0]);
  const headers = first.map(v => v.toLowerCase());
  let iCol = headers.findIndex(v => ['i', 'inphase', 'real'].includes(v));
  let qCol = headers.findIndex(v => ['q', 'quadrature', 'imag', 'imaginary'].includes(v));
  let start = 0;
  if (iCol >= 0 && qCol >= 0) start = 1;
  else {
    iCol = 0; qCol = 1;
    if (first.length < 2 || !Number.isFinite(Number(first[0])) || !Number.isFinite(Number(first[1]))) start = 1;
  }
  const data: IQ[] = [];
  for (let r = start; r < rows.length; r++) {
    const cells = split(rows[r]);
    const i = Number(cells[iCol]); const q = Number(cells[qCol]);
    if (!Number.isFinite(i) || !Number.isFinite(q)) {
      if (r === start && !data.length) throw new Error(`Could not read numeric I/Q values near line ${r + 1}.`);
      continue;
    }
    data.push({ i, q });
    if (data.length > 32768) throw new Error('Files are limited to 32,768 valid samples in this browser demo.');
  }
  if (data.length < 64) throw new Error(`Only ${data.length} valid samples found. At least 64 are required.`);
  return data;
}

export function fft(realInput: number[], imagInput: number[]) {
  const n = realInput.length;
  const re = realInput.slice(); const im = imagInput.slice();
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len; const wr0 = Math.cos(angle); const wi0 = Math.sin(angle);
    for (let base = 0; base < n; base += len) {
      let wr = 1; let wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const u = base + j; const v = u + len / 2;
        const tr = wr * re[v] - wi * im[v]; const ti = wr * im[v] + wi * re[v];
        re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
        const next = wr * wr0 - wi * wi0; wi = wr * wi0 + wi * wr0; wr = next;
      }
    }
  }
  return { re, im };
}

const db = (value: number) => 10 * Math.log10(Math.max(value, 1e-14));
const quantile = (values: number[], q: number) => {
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * q))] ?? -100;
};
const win = (n: number, size: number) => .5 - .5 * Math.cos(2 * Math.PI * n / (size - 1));

export function analyze(samples: IQ[], sampleRate: number, centerHz: number): Analysis {
  const nfft = 256; const hop = 128; const frames: number[][] = [];
  const totalFrames = Math.max(1, Math.floor((samples.length - nfft) / hop) + 1);
  for (let f = 0; f < totalFrames; f++) {
    const start = f * hop;
    const re = Array.from({ length: nfft }, (_, k) => (samples[start + k]?.i ?? 0) * win(k, nfft));
    const im = Array.from({ length: nfft }, (_, k) => (samples[start + k]?.q ?? 0) * win(k, nfft));
    const result = fft(re, im);
    const shifted = Array.from({ length: nfft }, (_, k) => {
      const ix = (k + nfft / 2) % nfft;
      return (result.re[ix] ** 2 + result.im[ix] ** 2) / (nfft * nfft);
    });
    frames.push(shifted);
  }
  const psd = Array.from({ length: nfft }, (_, k) => frames.reduce((s, frame) => s + frame[k], 0) / frames.length);
  const floor = quantile(psd.map(db), .38);
  const peak = Math.max(...psd.map(db));
  const threshold = Math.max(floor + 7, peak - 22);
  const occupied = psd.map((p, k) => ({ k, yes: db(p) > threshold }));
  const bins = occupied.map((b, k) => b.yes ? k : -1).filter(k => k >= 0);
  const bandwidth = bins.length ? (bins[bins.length - 1] - bins[0] + 1) * sampleRate / nfft : 0;
  const bandStartHz = bins.length ? centerHz + (bins[0] - nfft / 2) * sampleRate / nfft : centerHz;
  const bandEndHz = bins.length ? centerHz + (bins[bins.length - 1] - nfft / 2) * sampleRate / nfft : centerHz;
  const occupancy = bins.length / nfft * 100;
  const peakIndex = psd.indexOf(Math.max(...psd));
  const spectrum = Array.from({ length: nfft }, (_, k) => {
    return { frequency: centerHz + (k - nfft / 2) * sampleRate / nfft, db: db(psd[k]) };
  });
  const spectrogram = frames.filter((_, ix) => ix % Math.max(1, Math.floor(frames.length / 64)) === 0).map(frame =>
    Array.from({ length: 64 }, (_, col) => db(frame[Math.floor(col * nfft / 64)])));
  const amps = samples.map(s => Math.hypot(s.i, s.q));
  const meanAmp = amps.reduce((a, b) => a + b, 0) / amps.length;
  const ampStd = Math.sqrt(amps.reduce((a, b) => a + (b - meanAmp) ** 2, 0) / amps.length);
  const ampCv = ampStd / (meanAmp || 1);
  const activeThreshold = Math.max(...amps) * .3;
  const activeAmps = amps.filter(a => a > activeThreshold);
  const activeMean = activeAmps.reduce((a,b)=>a+b,0) / Math.max(1,activeAmps.length);
  const activeCv = Math.sqrt(activeAmps.reduce((a,b)=>a+(b-activeMean)**2,0)/Math.max(1,activeAmps.length))/(activeMean||1);
  const phaseSteps: number[] = [];
  for (let k = 1; k < Math.min(samples.length, 1200); k++) {
    if (amps[k] <= activeThreshold || amps[k - 1] <= activeThreshold) continue;
    const a = samples[k - 1]; const b = samples[k];
    phaseSteps.push(Math.atan2(a.i * b.q - a.q * b.i, a.i * b.i + a.q * b.q));
  }
  const phaseMean = phaseSteps.reduce((a,b)=>a+b,0)/Math.max(phaseSteps.length,1);
  const phaseStepStd = Math.sqrt(phaseSteps.reduce((a,b)=>a+(b-phaseMean)**2,0)/Math.max(phaseSteps.length,1));
  const constellation = samples.filter((_, k) => k % Math.max(1, Math.floor(samples.length / 280)) === 0).slice(0, 280);
  const qpskLike = activeCv < .32 && phaseStepStd > .28 && phaseStepStd < 1.7;
  const fmLike = ampCv < .32 && phaseStepStd < .45;
  const modulation = qpskLike ? 'QPSK-like / PSK' : fmLike ? 'Constant-envelope FM-like' : ampCv > .7 ? 'Multi-carrier / burst-like' : 'Unclassified digital / mixed';
  const confidence = qpskLike || fmLike ? 'Low · heuristic' : 'Very low · heuristic';
  const evidence = [`Active amplitude CV ${activeCv.toFixed(2)}`, `Phase-step σ ${phaseStepStd.toFixed(2)} rad`, `${samples.length.toLocaleString()} IQ samples`];
  const flags: Analysis['flags'] = [];
  const segment = Math.max(32, Math.floor(samples.length / 16));
  const powers = Array.from({ length: 16 }, (_, j) => {
    const chunk = samples.slice(j * segment, Math.min(samples.length, (j + 1) * segment));
    return chunk.reduce((s, v) => s + v.i*v.i + v.q*v.q, 0) / Math.max(1, chunk.length);
  });
  const medianPower = quantile(powers, .5);
  const peakSegment = Math.max(...powers);
  const burstIndex = powers.indexOf(peakSegment);
  if (peakSegment > medianPower * 4 && peakSegment > 1e-6) {
    flags.push({ title: 'Elevated time-domain burst', evidence: `Window ${burstIndex + 1}/16 is ${(10*Math.log10(peakSegment/(medianPower||1e-12))).toFixed(1)} dB above median power.`, severity: 'observed' });
  }
  const noiseBins = psd.map((p,k)=>({p,k})).filter(x=>Math.abs(x.k-peakIndex)>3);
  const second = Math.max(...noiseBins.map(x=>x.p));
  if (db(psd[peakIndex] / (second || 1e-14)) > 12) flags.push({ title: 'Unexpected narrow peak', evidence: `Strongest bin is ${db(psd[peakIndex]/(second||1e-14)).toFixed(1)} dB above the strongest non-adjacent bin.`, severity: 'review' });
  if (bins.length && (bins[0] < 3 || bins[bins.length-1] > nfft-4)) {
    flags.push({ title: 'Energy near analysis-band edge', evidence: `Thresholded energy reaches within ${Math.min(bins[0], nfft-1-bins[bins.length-1])} bins of the displayed edge.`, severity: 'review' });
  }
  if (peakSegment > medianPower * 4) flags.push({ title: 'Occupancy changes over time', evidence: `Segment power varies ${db(peakSegment/(medianPower||1e-12)).toFixed(1)} dB relative to its median.`, severity: 'observed' });
  const noise = floor;
  return {
    spectrum, spectrogram, constellation, bandwidth, bandStartHz, bandEndHz, peak, noise, threshold,
    snr: peak - noise, occupancy, peakOffset: (peakIndex - nfft/2) * sampleRate / nfft,
    modulation, confidence, evidence, flags, meanAmp, ampCv, phaseStepStd, sampleCount: samples.length,
  };
}

export function exampleCsv() {
  const rows = ['I,Q', ...generateDemo('qpsk', 256).map(s => `${s.i.toFixed(6)},${s.q.toFixed(6)}`)];
  return rows.join('\n');
}