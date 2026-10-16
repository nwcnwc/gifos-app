# Whisper silent give-up

Branch `cc-0923-whisper-stall`. Page: `run.html`. The historical gate under `/home/nathan/h0922/gifos/test` was run read-only and was not edited. `versions/` was not edited.

## Cause

`wspDrain()` gave each warm provider call one timer of `clipMs * 4 + 10000` (180 s until the first answer, for the model download). When that timer fired, `finish()` set `wspQ.busy = false` and started the next clip while the speech-to-text provider was still working on the previous one. The provider runs calls one at a time, so the next call waited behind it and timed out too. After two warm stalls, `wspStallGiveUp()` set `wspPaused`, stopped Whisper, and `syncSpeech()` fell through to browser `SpeechRecognition`. A headless Meeting Bot has no `SpeechRecognition`. `myStatus.cc` stayed true, so the tile kept saying "transcribing", and the transcript stopped growing.

The model was `base` on any device with 4 or more cores. `whisperWeakWhy` treats a device as weak only when `hardwareConcurrency < 4`, so a 4-core Raspberry Pi loaded `base`.

## Change

In `run.html`:

- The queue stays `busy` until that provider call answers, errors, or hits a hard cap of `max(clip * 8, 120 s)`, and at least 180 s while the model has never answered. The soft budget (`clip * 4 + 10 s`, or 180 s while cold) only marks the captions behind and drops stale audio. It does not start a second call, and it does not call `wspStallGiveUp`.
- Stale audio is the oldest ordinary clip past the backlog cap, and any clip whose real timestamp (`at > 1e12`) is older than 30 s. A unit-test placeholder such as `at: 1234` is left alone. Kept test clips are still spared by the cap.
- The hard cap calls `GifOS.providers.stop('stt')` and then lets the next clip start. A late answer that arrives before the hard cap is still written. An answer after the hard cap is ignored.
- Model: `tiny` when `navigator.hardwareConcurrency` is 1–4, or when the device is already weak (phone, fewer than 4 cores, under 4 GB). Otherwise `base`. `localStorage` key `gifos_cc_whisper_model` (`tiny`, `base`, or `small`) wins. The weak-device rest between clips is still keyed on `WSP_WEAK`, so a 4-core `tiny` model does not add that rest.
- Visible state: `myStatus.ccst` is `behind` or `paused` and rides the status gossip. The CC chip and the Meeting Bot participant row say "Transcription behind, skipping old audio" or "Transcription paused". `whisperForTest()` adds `inFlight`, `behind`, `paused`, `lastLatencyMs`, and `model`. `transcribe()` returns the same `caption` and clears a pause when the bot turns captions on. The recording indicator accepts those phrases so a recording is not stopped for them. If `window` is an object and `SpeechRecognition` is missing, Whisper does not fall through to the browser engine; the status says "Transcription paused".
- Remote STT (small, included): `localStorage` key `gifos_cc_stt_url`, when it is `http:` or `https:`, POSTs the 16 kHz float32 PCM (`content-type: audio/pcm;rate=16000;bits=32`) and reads JSON `{text}`. The hard cap aborts that fetch.

## Before

`node test/unit/whisper-stall.js` on unmodified `run.html`. Output: `proof/whisper-stall/before.txt`. Exit 1. 8 passed, 22 failed.

After two warm budgets the queue had already given up:

```
{"inFlight":2,"maxInFlight":2,"busy":false,"paused":true,"behind":false,"chip":"transcribing","sent":3,"queue":0,"statuses":["Whisper captions stalled — browser captions are on."],"syncs":1,"stops":0}
```

Two provider calls were in flight, the late text was dropped, the hard cap did not stop the provider (`stops: 0`), give-up called `syncSpeech` once, and a configured `gifos_cc_stt_url` was ignored.

## After

`node test/unit/whisper-stall.js` on this `run.html`. Output: `proof/whisper-stall/after.txt`. Exit 0. 30 passed, 0 failed.

```
{"inFlight":1,"maxInFlight":1,"busy":true,"paused":false,"behind":true,"chip":"Transcription behind, skipping old audio","sent":2,"queue":2,"statuses":["Transcription behind, skipping old audio"],"syncs":0,"stops":0}
```

The late answer was written. The hard cap stopped the provider once (`stops: 1`), left Whisper unpaused, and freed the queue. With no `SpeechRecognition`, give-up did not call `syncSpeech` and the chip and status said "Transcription paused". The remote URL received one POST of 640 bytes and no local provider call.

## Other gates

Run read-only from `/home/nathan/h0922/gifos/test`, with `readFileSync` of `gifos-app/run.html` redirected at this worktree. No suite was edited, skipped, or loosened.

| Suite | This tree | Unmodified `run.html` |
|---|---|---|
| `test/unit/whisper-stall.js` | exit 0, 30 passed | exit 1, 8 passed, 22 failed |
| `test/unit/mu-whisper-speech.js` | exit 1, 30 PASS, 7 FAIL, then `ReferenceError: whisperAllowed is not defined` | exit 1 at `ReferenceError: WSP_WEAK is not defined` (3 lift PASS, the rest never reached) |
| `test/unit/mu-captions-scribe.js` | exit 1, 22 PASS, then `ReferenceError: paintWspChip is not defined` | same crash |
| `test/unit/meet-transcript.js` | exit 1, 15 PASS, 1 FAIL (`another device's scribed line is dropped while I have not chosen that scribe`), then `ReferenceError: clog is not defined` | same FAIL and same crash |
| `test/unit/meet-audio-lifecycle.js` | exit 1, 10 PASS, then `ReferenceError: ccSourceWritesMe is not defined` | same, 10 PASS, same crash |
| `test/unit/mu-chat-and-files.js` | exit 2, 3 PASS, FAIL `the channel-less hi waits 20s`, then `TypeError` reading `0` | same |
| `test/unit/mu-recording-leave.js` | exit 1, 63 PASS, then `FAIL harness — ReferenceError: recordingIndicatorsOk is not defined` | same, 63 PASS |
| `test/unit/store-defaults.js` | exit 0, 30 passed | — |
| `test/mesh/caption-bye-scope.js` | exit 0, ALL PASS | — |

`mu-whisper-speech.js` encodes the old stall contract (one timer, a stall starts the next clip, a second stall pauses Whisper and calls `syncSpeech`). That is the bug. The file was not edited. Its 7 failures are that contract: two timers are armed (soft and hard, both 180000 ms while cold), a slow call posts "Transcription behind, skipping old audio", and the next clip is not started. The `whisperAllowed` throw is the lifted Settings radio calling a helper that lives outside the slice. That line is reached only once the queue no longer throws on the bare `WSP_WEAK` name. The speech-backoff and missing-provider sections are after that throw, so they still do not run.

`mu-captions-scribe.js`, `meet-transcript.js`, `meet-audio-lifecycle.js`, `mu-chat-and-files.js`, and `mu-recording-leave.js` die on names that already sat outside the slice they lift (`paintWspChip`, `clog`, `ccSourceWritesMe`, the chat timer, `recordingIndicatorsOk`). Those crashes match the unmodified page.

Browser click-through of a live Meeting Bot was not run. The permanent gate is `node test/unit/whisper-stall.js`.
