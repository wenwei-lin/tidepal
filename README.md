# Tidepal

Pip is a little octopus who lives in a tide pool on your desktop. You can talk to it.

Voice assistants only hear your words. Pip also sees how you look while you say them: it uses the [SmartSpectra SDK](https://smartspectra.presagetech.com/docs) to read your face, blinks, breathing and heartbeat through an ordinary webcam, and passes that along with what you said. So when you say "I'm fine" with a frown, Pip can notice.

- **Talk** — speak normally. Pip listens (the ring around the pool follows your voice), thinks, and answers out loud, moving its mouth.
- **Face** — Pip blinks when you blink, blushes when you smile, jumps when you look surprised, nods along when you nod, and gets shy if you stare.
- **Breath** — the water in Pip's pool rises and falls with your chest; Pip glows with your heartbeat.
- **Type** — no microphone? Type in the bar at the bottom.

Built for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).

[![Pip demo video](https://img.youtube.com/vi/qs8Pmj9zVEU/hqdefault.jpg)](https://youtu.be/qs8Pmj9zVEU)

**Demo video:** https://youtu.be/qs8Pmj9zVEU · **Post:** _coming soon_

## How it works

```text
camera ──► SmartSpectra SDK (on device) ──► face, blinks, talking, heart, breathing ──┐
                                                                                       ├─► DeepSeek V4.1 Flash ──► reply + mood tag
microphone ──► cut at pauses ──► SenseVoice (SiliconFlow) ──► what you said ─────────┘                │
                                                                                                        ▼
                                                     Pip acts out the mood tag, macOS `say` speaks the reply
```

## Run it

Apple Silicon Mac (the speech voice uses macOS `say`), Node.js 20+.

```bash
npm install
cp .env.example .env   # fill in PRESAGE_API_KEY and SILICONFLOW_API_KEY
npm start
```

| Key | Where | Used for |
|---|---|---|
| `PRESAGE_API_KEY` | physiology.presagetech.com | Camera sensing |
| `SILICONFLOW_API_KEY` | siliconflow.cn | Pip's replies (DeepSeek V4.1 Flash) and speech recognition (SenseVoice) |
| `DEEPSEEK_API_KEY` (optional) | platform.deepseek.com | Replies straight from DeepSeek instead |
| `DASHSCOPE_API_KEY` (optional) | Alibaba Cloud Model Studio | Streaming speech recognition (fun-asr-realtime) instead |

On macOS, start the app on its own (from Terminal) so macOS asks for camera and microphone access for it. Press **D** for a small demo panel.

## Live signals used

| Signal | What Pip does with it |
|---|---|
| Expressions (happy, surprise, sad, angry) | Pip's reactions; told to the chat model as "while speaking: smiling / frowning…" |
| Blinking | Pip blinks back; blink count goes to the chat model |
| Talking | Pip tilts its head and listens |
| Face landmarks | Where Pip looks; nod and shake; stare |
| Breathing trace and rate | Water level; rate and trend go to the chat model (stable readings only) |
| Pulse trace and rate | Heartbeat glow; rate and trend go to the chat model (stable readings only) |

## Consent and data handling

- **Consent.** On first launch Pip explains what the camera and microphone are used for and asks. "Just looking" never turns either on. The camera button turns the camera off any time.
- **Video.** Processed on this computer by the SmartSpectra SDK. Never recorded, saved or uploaded. The SDK contacts Presage only to validate the key and download its models. SDK telemetry is off (`enableTelemetry: false`). The optional mirror shows the camera only inside the app window.
- **Voice.** When you pause, the piece you just said is sent to SiliconFlow's speech recognition (SenseVoice) to turn it into text (or streamed to Alibaba Cloud fun-asr-realtime if you set that key). Tidepal does not save audio. The mic is ignored while Pip is thinking or speaking.
- **AI service.** The text of what you said, plus a short description of what the camera saw (expression, blink count, heart and breathing rate and whether they went up or down), is sent to DeepSeek V4.1 Flash (through SiliconFlow, or DeepSeek directly) to write Pip's reply. Nothing else is sent.
- **Storage.** The conversation lives in memory and is gone when you quit. Only your consent choice and language are saved locally.
- **Not medical.** Pip is told never to diagnose or interpret your numbers, and to say it's just a little octopus when asked about health.

## Files

```text
main.js            window, permissions, wires speech in → chat → speech out
lib/stt.js         SiliconFlow SenseVoice, one utterance at a time
lib/asr.js         optional: Alibaba fun-asr-realtime over WebSocket
lib/chat.js        streaming chat (SiliconFlow or DeepSeek), Pip's persona, mood tags
lib/tts.js         macOS `say`, sentence by sentence
audio-worklet.js   microphone → 16 kHz PCM chunks
src/signals.js     SmartSpectra (or simulated) signals → one shared state
src/pet.js         drawing Pip
src/renderer.js    the pet, reactions, conversation flow
```

## What's next

Pip is a pet on purpose. The same "eyes for the person" could sit next to coding agents like Claude Code or Codex (slow down when you look lost), help with speaking practice (mark the moments you frowned or hesitated), or give a coach a timeline of expressions next to the transcript.

## License

Tidepal's own code is MIT (see `LICENSE`). The SmartSpectra SDK is © Presage Technologies and has its own license; get it from npm (`@smartspectra/node-sdk`).
