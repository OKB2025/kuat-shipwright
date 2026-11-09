# Recorded BGM and seamless loops

The recorded music is the player's own tracks made with Gemini (supplied 2026-11-05). They replace the v20.5
classical recordings. The synthesized score stays as the alternative: in the sound settings it is 「合成」, and the
recordings are 「録音」. The single-file build also uses it, because that build carries no `data/` folder.

| Scene | Tracks (rotate in order) |
|---|---|
| title | Stellar Meridian, Where the Stars Drift |
| yard (designer) | Waiting for Launch, Charting the Gilded Periphery |
| voyage (maps) | Path Through the Starlight, Charting the Gilded Periphery |
| battle | The Iron Front, The Iron Vanguard, Siege of the Gilded Star, Siege of the Colossus, Sovereign Siege |
| victory | When the Heavens Break |
| defeat | Where the Stars Drift |

This mapping lives in `SND_TRACKS` in `js/app.js` and is provisional (chosen by mood).

## Data

Each track is stored as `data/bgm_<id>.js`: base64 AAC at 80 kb/s, 44.1 kHz, in an MP4 container. The meta carries
`loop: [start, end]`, in seconds of file time. `scripts/pack-bgm.py` builds these files from the original mp3s.

Every track ends with a 2–6 s fade-out, so the loop is internal: the intro plays once, and from then on
playback runs from `start` to `end`. The loop points are found as follows:

1. `scripts/find-bgm-loops.py` builds a self-similarity matrix of log-band spectra plus the onset envelope, at 0.1 s
   frames. It compares windows running from 3 s before to 6 s after each point, refines the best pair at 23 ms
   frames, and keeps loops of at least 45 s that end before the fade.
2. The candidate lengths are checked against the onset envelope. Where the tempo is clear they are snapped to whole
   bars: 144.0 s = 48 bars at 80 bpm, 140.8 s = 44 bars at 75 bpm, 96.0 s = 28 bars at 70 bpm, and so on.

## The seam

The packer bakes the musical crossfade into the file, so it is exact to the sample:

- **The crossfade:** the last 1–3 s before `end` are mixed into the music just before `start`. The mix is
  equal-power, corrected for how correlated the two passages are. Rhythmic tracks get 1 s; ambient pads
  (Starlight, Heavens) get 3 s.
- **The run-on:** the file continues 1.5 s past `end` with the music that follows `start`.

As a result, the audio around `end` is identical to the audio around `start`, and the jump can be made anywhere
in that 1.5 s window.

The player never decodes whole tracks (a phone could not hold minutes of PCM). It streams them through two
`<audio>` elements, and `seam()` in `js/app.js` makes the jump:

1. Three seconds before `end`, the idle element starts the same track, muted, at the matching place.
2. It measures the offset between the two element clocks, as the median of 5 readings.
3. It re-seeks until that offset is within 6 ms.
4. It swaps the elements with a 0.2 s linear crossfade just after `end`. The two passages are identical, so a
   constant-amplitude crossfade is the right one.

If the splice cannot happen (playback blocked, the page hidden), the playing element simply seeks back by one loop
length once it is 0.9 s past `end`.

In a scene with several tracks, each one loops back `LOOP_PASSES` times (1, provisional) and then crossfades over
2 s into the next track. A scene with a single track, such as victory or defeat, loops for as long as the scene lasts.

## Checks

- **Splice timing:** measured in Chromium by recording the output across a seam. The recording follows the file
  timeline with an error of 2–3 ms at the splice, and correlation stays at or above 0.95 throughout.
- **Coverage:** `tests/bgm-loops.cjs` checks every scene's tracks, the loop points with their run-on, and the
  player wiring.

## iPhone / iPad screen recording and interruptions

The reported symptom is that BGM remains audible while playing, but is absent from the saved iOS screen
recording. This is distinct from interrupted playback. The changes below improve session compatibility
and fix independently reproducible recovery failures; the original OS-capture symptom has not been
reproduced or verified as resolved on an actual iPhone/iPad. An ambient session alone is not evidence
that iOS excludes the audio from a recording.

All game audio, including the streamed recorded BGM, passes through the same Web Audio master output.
The player requests `navigator.audioSession.type = 'playback'` before creating or resuming its audio context
when the optional API is supported. This declares music/media playback instead of relying on the platform's
automatic session choice. Browsers without the API, or those that reject the request, keep the existing audio path.
See [the Audio Session specification](https://www.w3.org/TR/audio-session/) and
[WebKit's description of ambient Web Audio on iOS](https://bugs.webkit.org/show_bug.cgi?id=252746).

Opening Control Centre to start screen recording can interrupt audio without navigating away from the game.
After an interruption, the player restores gesture listeners and retries on foreground focus, `pageshow`, or
return to a visible document. A media `play()` rejection retains the resume request for the next user gesture.
The existing context, players, track position, loop splice, and volume settings are retained. A previously
unopened audio system is not started by a focus event, and a muted/hidden game is not automatically made audible.
This is playback only: the game neither requests microphone permission nor implements an OS screen recorder.

The regression tests exercise optional session handling, interruption recovery, rejected playback, and mute/
visibility guards. The real Chromium browser check records a test-only parallel tap of the existing final
output while leaving normal playback connected. It checks nonzero recorded music before and after an actual
context suspension and trusted gesture recovery, silence under mute, synthesized music, and effects. These
short MediaRecorder files are **not iOS screen recordings**. The browser's audio-session API may also differ
from Safari; API behavior is separately covered by controlled unit tests.

Evidence: [Node results](benchmarks/recording-music-validation.json),
[previous-code comparison](benchmarks/recording-music-baseline.json), and
[browser audio results](benchmarks/recording-music-browser.json). Run the browser harness with
`node scripts/browser-audio-recovery.cjs` against a local server on port 8003 (or set `KS_AUDIO_URL`).
Actual iPhone/iPad Safari and its OS screen-recording output remain unverified in this Linux environment.
The session change and recovery fix address reproducible gaps in the player; they do not prove that every
iOS version includes the game's audio in its saved screen recordings.
