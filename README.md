# SpectrumLens

**A browser-based RF signal analysis workbench built for SprintHack@ND 2026 at the University of Notre Dame.**

SpectrumLens turns complex in-phase and quadrature (I/Q) samples into an interactive view of a radio signal's frequency content, activity over time, and modulation clues. Load a simulated capture or upload an I/Q CSV to explore the data through a power spectrum, spectrogram, constellation plot, and explainable measurements.

Built by [Andrew Hanson](https://github.com/AndrewWHans) for the Defense Innovation Unit challenge at SprintHack@ND 2026.

## Why I built it

Understanding an unfamiliar RF capture requires more than a single chart. Frequency content, changes over time, and amplitude and phase behavior each reveal a different part of the signal.

SpectrumLens brings these perspectives into one workbench. The goal is to make an initial inspection accessible and explainable: show the samples, calculate useful features, and connect each interpretation to measurable evidence.

The prototype runs its signal generation and analysis directly in the browser. No SDR hardware, API key, database, or external analysis service is required to try it.

## Features

| Capability | What it does |
| --- | --- |
| Built-in captures | Explore QPSK-like packets, synthetic narrowband FM, and a crowded multi-carrier capture with a burst. |
| I/Q CSV import | Analyze custom samples with configurable sample rate and tuned center frequency. |
| Power spectrum | Inspect an averaged, FFT-based relative power spectrum and adaptive threshold. |
| Spectrogram | See how frequency content changes across the capture. |
| Constellation plot | Examine sampled I/Q points in the complex plane. |
| Occupancy and bandwidth | Estimate threshold occupancy and the frequency span between the outermost occupied bins. |
| Modulation clues | View low-confidence, rule-based candidates supported by amplitude and phase statistics. |
| Evidence flags | Highlight elevated bursts, unusually narrow peaks, and energy near the analysis-band edge. |
| Baseline snapshot | Compare bandwidth, peak level, and occupancy against a snapshot of the current view. |
| Example CSV | Download a generated capture to try the upload workflow. |

## Quick start

### Requirements

- Node.js 22.12+; the original workspace targets Node.js 24.
- pnpm with support for workspace catalogs.
- A modern browser.

The repository uses pnpm workspaces. Run installation and workspace commands from the repository root.

```bash
git clone https://github.com/AndrewWHans/spectrum-lens.git
cd spectrum-lens
pnpm install
```

Start the application on macOS or Linux:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/spectrum-lens run dev
```

Or in Windows PowerShell:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
pnpm --filter @workspace/spectrum-lens run dev
```

Open [http://localhost:5173](http://localhost:5173).

Both `PORT` and `BASE_PATH` are required by the Vite configuration. These commands start the SpectrumLens frontend; the repository's API and database scaffolding are not required for its signal analysis.

### Build and preview

With `PORT` and `BASE_PATH` set as above:

```bash
pnpm --filter @workspace/spectrum-lens run typecheck
pnpm --filter @workspace/spectrum-lens run build
pnpm --filter @workspace/spectrum-lens run serve
```

On macOS or Linux, prefix each command with `PORT=5173 BASE_PATH=/` if those variables have not been exported. The frontend build output is `artifacts/spectrum-lens/dist/public/`.

**Installation note:** the checked-in workspace overrides exclude several native dependency packages for platforms other than Linux x64. If installation or startup fails on Windows, macOS, or another architecture, those overrides may need adjustment for the target platform. Linux x64 is the original workspace configuration.

## Try the demo

1. Start with **QPSK-like packet**. Compare the power spectrum, spectrogram, constellation, and modulation evidence.
2. Select **Narrowband FM voice**. This is a synthetic FM scenario, not a recorded voice capture or audio player. Observe how the plots and feature measurements change.
3. Select **Crowded + burst anomaly**. Inspect the time-localized activity and the evidence flags it produces.
4. Click **Set baseline**, then change the sample rate or center frequency to explore the comparison panel. Selecting another demo or uploading a new file clears the baseline.
5. Download **Example CSV** and upload it to try the custom-capture workflow. Enter the appropriate capture metadata manually.

## CSV input

Each row represents one complex sample:

```csv
I,Q
0.125,0.250
-0.375,0.125
0.500,-0.250
```

This short example illustrates the format; an actual upload needs at least 64 valid sample pairs.

- Recognized I-column headers: `I`, `inphase`, or `real`.
- Recognized Q-column headers: `Q`, `quadrature`, `imag`, or `imaginary`.
- Header matching is case-insensitive.
- Without recognized headers, the parser uses the first two columns as I and Q and skips an initial nonnumeric header row.
- Commas, semicolons, and whitespace are accepted as separators. This is a simple numeric parser, not a general quoted-CSV reader.
- Maximum file size: **5 MiB**.
- Capture size: **64 to 32,768 valid I/Q pairs**.
- Sample rate and tuned center frequency must be entered in the interface; the parser does not extract them from CSV metadata.

## How the analysis works

The signal-processing implementation lives in [`analysis.ts`](artifacts/spectrum-lens/src/analysis.ts).

1. **Frame and window:** split samples into 256-point frames with a 128-sample hop and apply a Hann window. Short captures are zero-padded for analysis.
2. **Transform:** compute a radix-2 FFT and shift the bins so the configured center frequency appears in the middle.
3. **Average:** average frame power estimates to produce the displayed spectrum. Frame-level estimates also feed the spectrogram.
4. **Estimate occupancy:** estimate a floor from the 38th percentile of spectrum-bin levels and apply the threshold below.
5. **Extract features:** calculate amplitude variation and adjacent-sample phase statistics to generate modulation candidates.
6. **Explain observations:** compare time-segment power and spectral features against configured rules to produce evidence flags and a textual summary.

```text
threshold = max(estimated floor + 7 dB, peak level - 22 dB)
occupancy = bins above threshold / total FFT bins
bandwidth = span from first to last bin above threshold
```

The bandwidth span can include gaps between separate carriers. Occupancy instead measures the fraction of bins above the threshold.

### Interpreting the results

- **Relative power:** plotted levels are derived from sample amplitudes and are not calibrated dBm measurements.
- **Peak-to-floor contrast:** the displayed contrast compares the strongest spectrum bin with the estimated floor. It is not a calibrated, integrated SNR measurement.
- **Modulation candidates:** classifications are low-confidence heuristics. The application does not run a trained ML classifier, call an LLM, or decode protocols.
- **Evidence flags:** flags describe threshold crossings for review. They do not establish interference, identify a transmitter, or prove malicious activity.

## Technology

- **React 19 and TypeScript** for the interface, state, and analysis logic.
- **Vite 7** for development and production bundling.
- **Tailwind CSS 4**, UI components, and **Lucide** icons for presentation.
- **SVG visualizations** for the spectrum, spectrogram, and constellation.
- **Browser File and Blob APIs** for local CSV input and example downloads.
- **pnpm workspaces** for repository organization.

## Repository guide

| Path | Purpose |
| --- | --- |
| `artifacts/spectrum-lens/src/App.tsx` | Main workbench, visualizations, capture controls, and baseline comparison. |
| `artifacts/spectrum-lens/src/analysis.ts` | Simulated captures, CSV parsing, FFT, feature extraction, and evidence rules. |
| `artifacts/spectrum-lens/src/index.css` | Application styling. |
| `artifacts/spectrum-lens/vite.config.ts` | Frontend environment settings and build configuration. |
| `artifacts/api-server/` | API server scaffolding, separate from the local analysis path. |
| `artifacts/mockup-sandbox/` | Separate UI sandbox. |
| `lib/` | Shared workspace packages and generated API utilities. |

## Current scope and limitations

SpectrumLens is a hackathon prototype for inspecting short captures. It does not currently support live SDR streaming, binary I/Q formats, SigMF ingestion, demodulation, audio playback, or protocol decoding.

Analysis runs on the browser's main thread with a fixed 256-point FFT. Capture limits keep the demo manageable, but it is not designed for large recording archives. Gain changes, clipping, DC offset, multipath, sample-clock error, and short captures can affect the results. Baselines are held in component state and do not persist after a page reload.

## Possible next steps

- Add SigMF metadata and binary I/Q input.
- Move processing into a Web Worker for larger captures.
- Expose FFT size, window, and threshold controls.
- Add calibrated reference datasets and automated DSP validation.
- Support persistent capture comparisons and analysis exports.
- Evaluate richer classification methods against labeled captures.

These are future directions, not implemented features.

## Author

**Andrew Hanson**

[GitHub](https://github.com/AndrewWHans) · [LinkedIn](https://www.linkedin.com/in/thehanson)

Developed at **SprintHack@ND 2026**, University of Notre Dame.
