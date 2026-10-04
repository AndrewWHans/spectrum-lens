# SpectrumLens

An explainable RF workbench for inspecting complex I/Q samples. The demo runs its signal generation and analysis in the browser; it needs no SDR, API key, database, or external analysis service.

## Judge demo

1. Start with **QPSK-like packet** and point out the spectrum, time/frequency view, constellation, and low-confidence feature candidate.
2. Choose **Narrowband FM voice** to show how the sample data changes the plots and measured clues.
3. Choose **Crowded + burst anomaly** and inspect the time/frequency view and evidence flags. Use **Set baseline** before changing captures to compare measurements.
4. Optionally upload your own IQ CSV or download **Example CSV** to demonstrate the data path.

## Capture input

- CSV headers may be `I,Q`, `real,imag`, `inphase,quadrature`, or the first two numeric columns.
- Files are limited to 5 MB and 32,768 valid samples; at least 64 I/Q pairs are required.
- Set the capture's sample rate and tuned center frequency in the workbench. CSV files do not supply this metadata.
- SigMF is a public format for IQ capture data and metadata, but this demo does not parse SigMF files.

## What the measurements mean

- A 256-point radix-2 FFT with a Hann window feeds an averaged periodogram and the short-time Fourier transform view.
- Occupied-band estimates use the adaptive threshold `max(noise floor + 7 dB, peak − 22 dB)`. The displayed occupancy is the fraction of FFT bins above that threshold; it is not a regulatory channel mask.
- “Peak-to-floor contrast” is the strongest PSD bin relative to an estimated floor, not calibrated dBm or an integrated, calibrated SNR.
- Modulation clues use simple amplitude and adjacent-sample phase statistics. They are low-confidence candidates, not a protocol decoder.
- Evidence flags identify measured power bursts, narrow peaks, or energy near a displayed band edge. They are not alarms or proof of interference.

Run in the workspace with `pnpm --filter @workspace/spectrum-lens run dev`.