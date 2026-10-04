import { useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, AudioLines, BarChart3, Clock3, FileUp, FlaskConical, Info, Radio, RotateCcw, ScanLine, Signal, Sparkles, Waves } from 'lucide-react';
import { analyze, DEMOS, exampleCsv, generateDemo, parseCsv, type Analysis, type IQ, type Scenario } from './analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import type { ReactNode } from 'react';

const queryClient = new QueryClient();
const hz = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(3)} GHz` : v >= 1e6 ? `${(v / 1e6).toFixed(3)} MHz` : `${(v / 1e3).toFixed(1)} kHz`;

function SpectrumChart({ data, threshold, showThreshold }: { data: Analysis['spectrum']; threshold: number; showThreshold: boolean }) {
  const W = 760; const H = 225; const left = 46; const right = 12; const top = 12; const bottom = 30;
  const plotW = W - left - right; const plotH = H - top - bottom;
  const vals = data.map(d => d.db); const low = Math.min(...vals, threshold) - 8; const high = Math.max(...vals) + 5;
  const points = data.map((d, k) => `${left + k / (data.length - 1) * plotW},${top + (high - d.db) / (high - low || 1) * plotH}`).join(' ');
  const area = `${left},${top + plotH} ${points} ${left + plotW},${top + plotH}`;
  const labels = [0, .25, .5, .75, 1].map(frac => data[Math.round(frac * (data.length - 1))]?.frequency ?? 0);
  const labelFreq = (v: number) => `${(v / 1e6).toFixed(3)}`;
  return <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Welch averaged power spectral density versus frequency">
    <defs><linearGradient id="spectrumFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#27a99a" stopOpacity=".25" /><stop offset="100%" stopColor="#27a99a" stopOpacity=".015" /></linearGradient></defs>
    {[0,.25,.5,.75,1].map((f,i)=><g key={i}><line className="grid-line" x1={left} x2={left+plotW} y1={top+f*plotH} y2={top+f*plotH}/><text className="chart-label" x={left-8} y={top+f*plotH+3} textAnchor="end">{(high-f*(high-low)).toFixed(0)}</text></g>)}
    <polygon points={area} className="spectrum-fill"/><polyline points={points} className="spectrum-line"/>
    {showThreshold && <line x1={left} x2={left+plotW} y1={top+(high-threshold)/(high-low)*plotH} y2={top+(high-threshold)/(high-low)*plotH} stroke="#e1a643" strokeDasharray="5 4" strokeWidth="1.2"/>}
    {labels.map((v,i)=><text key={i} className="chart-label" x={left+i*plotW/4} y={H-8} textAnchor={i===0?'start':i===4?'end':'middle'}>{labelFreq(v)}</text>)}
    <text className="chart-label" x={10} y={top+plotH/2} transform={`rotate(-90 10 ${top+plotH/2})`} textAnchor="middle">dB / relative</text>
    <text className="chart-label" x={W-10} y={H-8} textAnchor="end">MHz</text>
  </svg>;
}

function heatColor(value: number, min: number, max: number) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const stops = [[27,54,69],[32,99,115],[49,163,147],[139,211,147],[244,202,104]];
  const p=t*(stops.length-1), a=Math.floor(p), b=Math.min(stops.length-1,a+1), u=p-a;
  return `rgb(${stops[a].map((c,i)=>Math.round(c+(stops[b][i]-c)*u)).join(',')})`;
}

function Spectrogram({ data }: { data: number[][] }) {
  const width = 620; const height = 190; const rows = data.length; const cols = data[0]?.length ?? 64;
  const vals = data.flat(); const low = Math.min(...vals); const high = Math.max(...vals);
  return <svg className="spectrogram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Short-time Fourier transform spectrogram, frequency by time">
    {data.map((row,r)=>row.map((v,c)=><rect key={`${r}-${c}`} x={c*width/cols} y={r*height/rows} width={width/cols+0.3} height={height/rows+0.3} fill={heatColor(v,low,high)}/>))}
  </svg>;
}

function Constellation({ samples }: { samples: IQ[] }) {
  return <svg className="constellation" viewBox="0 0 240 117" role="img" aria-label="IQ constellation scatter plot">
    <line x1="14" x2="226" y1="58.5" y2="58.5" stroke="#dbe6e6"/><line x1="120" x2="120" y1="9" y2="108" stroke="#dbe6e6"/>
    <circle cx="120" cy="58.5" r="39" fill="none" stroke="#e7eeee" strokeDasharray="3 4"/>
    {samples.map((p,k)=><circle key={k} cx={120+p.i*57} cy={58.5-p.q*57} r="1.7" fill="#168b80" opacity=".55"/>)}
    <text x="225" y="53" className="chart-label" textAnchor="end">I</text><text x="126" y="15" className="chart-label">Q</text>
  </svg>;
}

function Home() {
  const [scenario, setScenario] = useState<Scenario | 'custom'>('qpsk');
  const [samples, setSamples] = useState<IQ[]>(() => generateDemo('qpsk'));
  const [captureName, setCaptureName] = useState('QPSK-like packet');
  const [sampleRate, setSampleRate] = useState(1_200_000);
  const [center, setCenter] = useState(915_000_000);
  const [error, setError] = useState('');
  const [thresholdOn, setThresholdOn] = useState(true);
  const [showSpectrum, setShowSpectrum] = useState(true);
  const [showSpectrogram, setShowSpectrogram] = useState(true);
  const [baseline, setBaseline] = useState<Analysis | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const result = useMemo(() => analyze(samples, sampleRate, center), [samples, sampleRate, center]);
  const centerPeak = center + result.peakOffset;
  const occupiedSpan = `${hz(result.bandStartHz)} – ${hz(result.bandEndHz)}`;
  const summary = `${captureName} contains ${result.occupancy.toFixed(1)}% threshold-occupied bandwidth (${hz(result.bandwidth)}) around the configured ${hz(center)} center. The measured peak-to-floor contrast is ${result.snr.toFixed(1)} dB, with the strongest bin near ${hz(centerPeak)}. Feature heuristics lean toward ${result.modulation.toLowerCase()} (low confidence); this is not a protocol decode.`;

  function selectDemo(value: string) {
    const option = DEMOS.find(item => item.id === value);
    if (!option) return;
    setScenario(option.id);
    setSamples(generateDemo(option.id));
    setCaptureName(option.name);
    setError('');
    setBaseline(null);
    setSampleRate(option.id === 'fm' ? 500_000 : option.id === 'crowded' ? 2_400_000 : 1_200_000);
  }
  async function uploadFile(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('File is larger than the 5 MB browser-demo limit.'); return; }
    try {
      const parsed = parseCsv(await file.text());
      setSamples(parsed); setCaptureName(file.name); setScenario('custom'); setError(''); setBaseline(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not parse this CSV.'); }
  }
  function downloadExample() {
    const url = URL.createObjectURL(new Blob([exampleCsv()], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'spectrum-lens-example-iq.csv'; a.click(); URL.revokeObjectURL(url);
  }
  const baselineDiff = baseline ? [
    { label: 'Bandwidth', delta: (result.bandwidth-baseline.bandwidth), unit: 'Hz' },
    { label: 'Peak level', delta: result.peak-baseline.peak, unit: 'dB' },
    { label: 'Occupancy', delta: result.occupancy-baseline.occupancy, unit: 'pp' },
  ] : [];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><AudioLines size={19}/></div><span>SpectrumLens</span><span className="brand-sub">RF ANALYSIS / LOCAL</span></div>
      <div className="top-status"><span className="live-dot"/><span>ANALYSIS READY</span><span style={{ color:'#637f85' }}>·</span><span>NO DEVICE CONNECTED</span></div>
    </header>
    <main className="main-wrap">
      <div className="page-heading">
        <div><div className="eyebrow">Workbench / Capture 01</div><h1>Make the invisible legible.</h1><p className="subtitle">Inspect IQ samples, see the measurements, follow the evidence.</p></div>
        <div className="session-pill"><FlaskConical size={13}/> BROWSER-LOCAL SESSION <span>·</span> <span className="mono">{samples.length.toLocaleString()} SAMPLES</span></div>
      </div>
      {error && <div role="alert" className="error-banner" data-testid="status-upload-error"><AlertTriangle size={13} style={{ verticalAlign:'-2px', marginRight:6 }}/>{error}</div>}
      <div className="workspace">
        <aside className="panel control-panel">
          <div className="control-panel-fields">
            <div className="section-label">Capture source</div>
            <div className="field"><label htmlFor="demo-select">Demo scenario <span className="field-hint">BUILT-IN</span></label>
              <select id="demo-select" className="select" value={scenario} onChange={e=>selectDemo(e.target.value)} data-testid="select-demo-scenario">
                {scenario === 'custom' && <option value="custom">Uploaded capture</option>}
                {DEMOS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div className="field-hint" style={{ marginTop:6 }}>{DEMOS.find(d=>d.id===scenario)?.meta}</div>
            </div>
            <div className="field"><label>Upload IQ samples <span className="field-hint">CSV · MAX 5 MB</span></label>
              <input ref={fileRef} className="hidden-file" type="file" accept=".csv,text/csv" onChange={e=>uploadFile(e.target.files?.[0])} data-testid="input-upload-csv"/>
              <button className="upload-zone" type="button" onClick={()=>fileRef.current?.click()} data-testid="button-upload-csv"><FileUp size={17}/><span>Choose a CSV file</span><small>I/Q columns or first two numeric columns</small></button>
            </div>
            <hr className="control-divider"/>
            <div className="section-label">Capture metadata</div>
            <div className="field"><label htmlFor="sample-rate">Sample rate <span className="field-hint">IQ RATE</span></label><div className="input-unit"><input id="sample-rate" className="number-input" type="number" min="1000" max="1000000000" step="1000" value={sampleRate} onChange={e=>setSampleRate(Math.max(1000,Number(e.target.value)||1000))} data-testid="input-sample-rate"/><span className="unit">S/s</span></div></div>
            <div className="field"><label htmlFor="center-frequency">Center frequency <span className="field-hint">TUNED</span></label><div className="input-unit"><input id="center-frequency" className="number-input" type="number" min="0" max="100000000000" step="100000" value={center} onChange={e=>setCenter(Math.max(0,Number(e.target.value)||0))} data-testid="input-center-frequency"/><span className="unit">Hz</span></div></div>
          </div>
          <div className="section-label">Display layers</div>
          <div className="toggle-row"><label htmlFor="threshold-toggle">Occupied-band threshold</label><input id="threshold-toggle" className="toggle" type="checkbox" checked={thresholdOn} onChange={e=>setThresholdOn(e.target.checked)} data-testid="toggle-threshold"/></div>
          <div className="toggle-row"><label htmlFor="spectrum-toggle">Power spectrum</label><input id="spectrum-toggle" className="toggle" type="checkbox" checked={showSpectrum} onChange={e=>setShowSpectrum(e.target.checked)} data-testid="toggle-spectrum"/></div>
          <div className="toggle-row"><label htmlFor="spectrogram-toggle">Spectrogram</label><input id="spectrogram-toggle" className="toggle" type="checkbox" checked={showSpectrogram} onChange={e=>setShowSpectrogram(e.target.checked)} data-testid="toggle-spectrogram"/></div>
          <div className="control-actions">
            <button className="btn btn-small" onClick={downloadExample} data-testid="button-download-example"><ArrowDownToLine size={13}/> Example CSV</button>
          </div>
        </aside>
        <section className="main-column" aria-label="Signal analysis results">
          <div className="panel capture-bar">
            <div className="capture-info"><div className="capture-icon"><Radio size={18}/></div><div style={{ minWidth:0 }}><div className="capture-name" data-testid="text-capture-name">{captureName}</div><div className="capture-meta">{samples.length.toLocaleString()} complex samples <span>·</span> {hz(sampleRate)} <span>·</span> center {hz(center)}</div></div></div>
            <div className="capture-actions"><button className={`btn btn-small ${baseline ? '' : 'btn-primary'}`} onClick={()=>setBaseline(result)} data-testid="button-compare-baseline"><ScanLine size={13}/>{baseline ? 'Update baseline' : 'Set baseline'}</button><button className="btn btn-small" onClick={()=>{setBaseline(null);setError('');}} disabled={!baseline} data-testid="button-clear-baseline"><RotateCcw size={13}/> Clear</button></div>
          </div>
          <div className="metrics">
            <div className="panel metric"><div className="metric-title">Center frequency <Signal size={13}/></div><div className="metric-value" data-testid="metric-center-frequency">{hz(center)}<span className="metric-unit"> tuned</span></div></div>
            <div className="panel metric"><div className="metric-title">Occupied bandwidth <Waves size={13}/></div><div className="metric-value" data-testid="metric-bandwidth">{hz(result.bandwidth)}</div></div>
            <div className="panel metric"><div className="metric-title">Peak / floor · relative dB <Activity size={13}/></div><div className="metric-value" data-testid="metric-peak-noise">{result.peak.toFixed(1)}<span className="metric-unit"> / {result.noise.toFixed(1)} dB</span></div></div>
            <div className="panel metric"><div className="metric-title">Peak-to-floor contrast <BarChart3 size={13}/></div><div className="metric-value" data-testid="metric-snr">{result.snr.toFixed(1)}<span className="metric-unit"> dB</span></div></div>
          </div>
          <div className="chart-grid">
            {showSpectrum && <article className="panel chart-panel animate-in">
              <div className="panel-head"><div><div className="panel-title"><Activity size={14}/> Welch power spectrum</div><div className="panel-subtitle">Hann window · 256-point FFT · averaged periodogram</div></div><div className="field-hint">RELATIVE POWER</div></div>
              <div className="chart-wrap"><SpectrumChart data={result.spectrum} threshold={result.threshold} showThreshold={thresholdOn}/><div className="legend-row"><span>Estimated band: {occupiedSpan}</span><span>{thresholdOn && <><i style={{ display:'inline-block', width:12, borderTop:'1px dashed #e1a643', marginRight:4, verticalAlign:'middle' }}/> max(floor + 7, peak − 22 dB)</>}</span></div></div>
            </article>}
            {showSpectrogram && <article className="panel chart-panel animate-in">
              <div className="panel-head"><div><div className="panel-title"><ScanLine size={14}/> Time × frequency</div><div className="panel-subtitle">Short-time Fourier transform · Hann window</div></div><div className="field-hint">STFT</div></div>
              <div className="spectro-wrap"><Spectrogram data={result.spectrogram}/><div className="legend-row"><span>Earlier <span style={{ margin:'0 5px' }}>→</span> later</span><span>Low <i className="gradient-legend"/> High power</span></div></div>
            </article>}
            {!showSpectrum && !showSpectrogram && <article className="panel chart-panel" style={{ gridColumn:'1/-1', padding:23, color:'#6b8085', fontSize:11 }} data-testid="text-no-charts">Both chart layers are hidden. Enable a display layer to inspect the measured spectrum or time-frequency view.</article>}
          </div>
          <div className="lower-grid">
            <article className="panel subpanel">
              <div className="subpanel-heading"><div className="subpanel-title"><Sparkles size={14}/> Modulation clues</div><span className="confidence-tag">{result.confidence}</span></div>
              <div className="candidate-name" data-testid="metric-modulation">{result.modulation}</div>
              <p className="candidate-copy">A cautious feature-based candidate from amplitude consistency and adjacent-sample phase change. PSD shape alone cannot identify modulation or decode a protocol.</p>
              <div className="evidence-row">{result.evidence.map((e,i)=><span className="evidence-chip" key={i} data-testid={`text-feature-evidence-${i}`}>{e}</span>)}</div>
              <div style={{ marginTop:12 }}><Constellation samples={result.constellation}/></div>
            </article>
            <article className="panel subpanel">
              <div className="subpanel-heading"><div className="subpanel-title"><BarChart3 size={14}/> Band occupancy</div><span className="field-hint">THRESHOLD ESTIMATE</span></div>
              <div className="metric-value" style={{ fontSize:27, marginTop:0 }} data-testid="metric-occupancy">{result.occupancy.toFixed(1)}<span className="metric-unit">%</span></div>
              <p className="candidate-copy" style={{ marginTop:5 }}>Fraction of FFT bins above the adaptive floor / peak threshold. Not a regulatory channel mask.</p>
              <div style={{ height:8, background:'#e8efee', borderRadius:6, overflow:'hidden', marginTop:14 }}><div style={{ width:`${Math.min(100,result.occupancy)}%`, height:'100%', background:'linear-gradient(90deg,#178c80,#6ac5a7)', transition:'width .25s' }}/></div>
              <div className="occupancy-line"><span>Occupied {hz(result.bandwidth)}</span><span>Span {hz(sampleRate)}</span></div>
              <div style={{ marginTop:17, paddingTop:12, borderTop:'1px solid #edf1f1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                <div><div className="field-hint">PEAK BIN</div><div className="mono" style={{ color:'#35555b', fontSize:11, marginTop:4 }}>{hz(centerPeak)}</div></div>
                <div><div className="field-hint">MEASURED AMPLITUDE CV</div><div className="mono" style={{ color:'#35555b', fontSize:11, marginTop:4 }}>{result.ampCv.toFixed(3)}</div></div>
              </div>
            </article>
          </div>
          <article className="panel summary-panel">
            <div className="summary-icon"><Info size={16}/></div>
            <div><h2 className="summary-title">What the measurements suggest</h2><p className="summary-text" data-testid="text-analysis-summary">{summary} These are estimates from local feature and rule analysis in your browser—not an external LLM, decoder, or calibrated instrument. Multipath, gain control, clipping, DC offset, sample-clock error, and short captures can change the result.</p></div>
          </article>
          <article className="panel flags">
            <div className="subpanel-heading"><div className="subpanel-title"><AlertTriangle size={14}/> Evidence flags</div><span className="field-hint">MEASURED RULES · NOT ALARMS</span></div>
            {result.flags.length ? <div className="flag-list">{result.flags.map((flag,i)=><div key={`${flag.title}-${i}`} className="flag-item" data-testid={`row-anomaly-${i}`}><span className={`flag-dot ${flag.severity==='review'?'':'info'}`}/><div><div className="flag-title">{flag.title}</div><div className="flag-evidence">{flag.evidence}</div></div><span className="flag-severity">{flag.severity}</span></div>)}</div> : <div className="no-flags" data-testid="text-no-anomalies">No configured time-domain or spectral threshold was crossed in this capture. This does not establish that the signal is interference-free.</div>}
            {baseline && <div className="baseline-box" data-testid="panel-baseline"><div className="baseline-title"><Clock3 size={13}/> Difference from snapshot <span className="field-hint" style={{ marginLeft:'auto' }}>REFERENCE · CURRENT VIEW</span></div><div className="baseline-data">{baselineDiff.map(item=><div key={item.label} className="baseline-delta" data-testid={`text-baseline-${item.label.toLowerCase().replace(' ','-')}`}><span style={{ color:'#819497' }}>{item.label}</span><br/><strong>{item.delta>=0?'+':''}{item.delta.toFixed(item.label==='Occupancy'?1:2)} {item.unit}</strong></div>)}</div></div>}
          </article>
          <footer className="note-footer"><b>IQ is the input:</b> this workbench reads I/Q CSV samples. SigMF can carry capture data and metadata; full SigMF file support is not implemented. No hardware, network, or external analysis service is used.</footer>
        </section>
      </div>
    </main>
  </div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home}/><Route component={NotFound}/></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;