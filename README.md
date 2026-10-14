# SpectrumLens

**AI-assisted RF spectrum analysis for people without an RF background.**
Built at SprintHack@ND (Oct 2026) for DIU Problem 2: AI-Driven RF Spectrum Analysis.

## The problem

Software-defined radios make it trivial to capture raw RF signals. Turning
that capture into useful insight — what's in this band, how wide is it, is
anything unusual — still requires domain expertise most people don't have.

## What it does

SpectrumLens takes an uploaded CSV of IQ samples (or a built-in demo capture)
and produces:

- **Computed measurements** — center frequency, occupied bandwidth,
  peak/floor power, peak-to-floor contrast — via signal processing (Welch
  power spectrum, short-time Fourier transform)
- **Visualizations** — power spectrum plot and a time × frequency heatmap
- **A plain-language summary** — an LLM (Claude Sonnet 5.5, via API) explains
  the computed values in accessible language, so the model never generates
  the numbers themselves, only the explanation of them
- **Baseline-relative anomaly flagging** — compares a new capture against a
  stored baseline to surface what changed

Design principle: **measure first, explain second.** All numeric output
comes from deterministic signal-processing code; the LLM's role is limited
to translation and summarization of those already-computed values.

## How it was built

- Web app built on Replit (team + Replit's AI agent)
- Signal processing written with Claude's assistance
- No model was trained — modulation is estimated heuristically from
  computed signal features, not classified by a trained model
- LLM summaries use Claude Sonnet 5.5 via API (closed-source)
- Tested against a synthetic example IQ dataset; not yet validated against
  real-world SDR captures

## Known limitations

- Modulation estimation is a low-confidence heuristic, not a trained classifier
- The LLM layer is a closed, hosted model rather than open-weight
- Built and tested on synthetic data only
