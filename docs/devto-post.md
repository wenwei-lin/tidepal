---
title: "Pip: a desktop pet that notices your face, not just your words"
published: false
tags: devchallenge, presagechallenge, ai, javascript
cover_image:
---

*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).*

## What I Built

Pip is a little octopus who lives in a tide pool in the corner of my desktop. I can talk to it, and it talks back.

Most AI on my desktop works *for* me, and it only knows what I type or say. Pip is the other half. It notices *me*: whether I'm smiling or frowning, how often I blink, roughly how fast my heart and breath are going. When I told it "no" with a little smile, it answered: "Funny thing is, you're smiling a little while you say that."

What Pip does:

- **Reacts to your face, even when you're quiet.** Smile and hearts pop up. Look surprised and it jumps. Frown and it frowns back. Nod and it nods. Blink and it blinks back. Stare at it long enough and it gets shy.
- **Talks with you.** You speak normally; Pip listens, thinks for a moment, and answers out loud with its mouth moving. Every reply starts with a small action (happy, shy, nod, comfort…) that Pip acts out.
- **Hears more than words.** Along with what you said, Pip's brain gets a short note of what the camera saw while you said it: expression, blink count, heart and breathing rate, and whether they went up or down.
- **Breathes with you.** The water in its pool rises and falls with your chest, and it glows faintly with each heartbeat.

It's a pet, not a tool. It can't open files or browse yet. I wanted to see what a desktop companion feels like once it has eyes for the person, not only ears for the request.

## Demo

{% embed https://youtu.be/qs8Pmj9zVEU %}

In the video I'm reading DEV. Pip can't see the page; it only sees me. I react to the posts, and Pip reacts to me. A few things it said, unscripted:

- "Hello hello! You look a bit surprised to see me."
- "I'm good, just bobbing about in my pool. You're blinking a lot though."
- "Funny thing is, you're smiling a little while you say that."
- "I can chat, keep you company, and sometimes notice things like a smile or a frown. I can't use your computer or look stuff up yet though."

It isn't perfect: a couple of times it didn't catch what I said, and once it told me my message got cut off. Heartbeat and breathing are there (the glow and the water) but subtle on screen.

## Code

{% github wenwei-lin/tidepal %}

Electron app. Setup is in the README: `npm install`, put your keys in `.env`, `npm start`.

## How It Responds to Human Signals

The SmartSpectra Node SDK runs inside the Electron renderer and reads the webcam on the device. I request the breathing, cardio and face metric groups and decode the protobuf stream.

| Signal | What Pip does |
|---|---|
| Expressions (happy, surprise, sad, angry) | Mirrors you in real time; tells the chat model how you looked while speaking |
| Blinking | Blinks back; blink count goes to the chat model |
| Talking | Tilts its head and listens |
| Face landmarks | Eyes follow you; nod and shake detection; the "stare" reaction |
| Breathing trace and rate | The water level; rate and trend go to the chat model |
| Pulse trace and rate | The heartbeat glow; rate and trend go to the chat model (stable readings only) |

The conversation loop:

```text
camera ─► SmartSpectra (on device) ─► face, blinks, heart, breathing ─┐
                                                                      ├─► DeepSeek V4.1 Flash ─► reply + action tag
mic ─► cut at pauses ─► speech-to-text (SenseVoice) ─► your words ────┘              │
                                                       Pip acts out the tag, macOS speaks the reply
```

Things I learned on the way:

- **The chest matters.** Breathing needs your shoulders and chest in view, which fights with how close we sit to a laptop. Expressions and pulse come through fine from the face alone, so Pip leans on those and only nags about the chest when it really needs breathing.
- **Raw breathing is jumpy.** Drawn as-is, the water jerked up and down. I remove the slow drift, let the size of the swing adapt over a few seconds, and move the water with a soft spring. Now it glides.
- **"Face present" should come from expressions.** Landmarks sometimes stop while the SDK waits for a better view; expression scores keep coming, so I count those as "I can see you."
- **Only stable numbers.** Heart rate jumps around for the first seconds. Pip shows "measuring" until the SDK marks the reading stable, and only stable readings reach the chat model.

## Prize Categories

Most Creative or Delightful Use.

## Consent and Data Handling

- **Consent.** On first launch Pip explains, in plain words, what the camera and microphone are for, and asks. "Just looking" never turns either on. A button turns the camera off any time. A small mirror shows exactly what the camera sees.
- **Video stays on the computer.** The SmartSpectra SDK processes frames locally. Nothing is recorded, saved or uploaded. The SDK contacts Presage only to check the key and download its models.
- **SDK telemetry is off** (`enableTelemetry: false`).
- **Voice.** When you pause, the piece you just said is sent to a speech-to-text service (SiliconFlow SenseVoice) and turned into text. Audio is not saved. The mic is ignored while Pip is thinking or speaking.
- **AI service.** Your words, plus a one-line description of what the camera saw (for example "face while speaking: frowning; heart rate about 81/min, faster than earlier"), go to DeepSeek V4.1 Flash to write Pip's reply. Nothing else is sent.
- **Retention.** The conversation lives in memory and is gone when you quit. Only your consent choice and language are saved locally.
- **Not medical.** Pip is told never to diagnose or interpret your numbers, and to say it's just a little octopus if you ask about health.

## What's next

Pip is a pet on purpose. But the same "eyes for the person" could sit next to other agents:

- **Coding agents.** Hook Pip up to Claude Code or Codex. They already have the computer and the web; Pip adds how you're doing. An agent could slow down and explain more when you look lost.
- **Speaking practice.** When you practise a language or a talk, the moments you frown or hesitate are the parts you haven't figured out yet. Pip could mark them and go over them with you afterwards.
- **Coaching.** A coach could get a small timeline of your expressions next to the transcript, to see which questions landed and which didn't.
- **Calm moments.** A short breathing break where the tide follows your breath. I built a version of this and set it aside for now.

## Agent Session

I built Pip with Claude Code, starting from "what could I make for this challenge?" and ending with a voice pet.

{% agent_session SESSION_URL %}
