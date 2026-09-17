#!/usr/bin/env python3
"""
Convert an ElevenLabs Speech-to-Text (scribe_v1, diarize=true) response into the
"Name (H:MM:SS): text" raw transcript format that build_transcripts.py already
parses (see P_NAME_PAREN_TS), then overwrite transcripts/<slug>.txt with it.

Usage:
  python3 scripts/elevenlabs_to_txt.py <slug> <elevenlabs_json_path>
"""
import json
import re
import sys


def fmt_ts(sec):
    sec = int(round(sec))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"0:{m:02d}:{s:02d}"


def identify_speakers(words):
    """Map raw speaker_id -> 'Seth' / 'Andrey' using self-introductions in the
    first couple of minutes; falls back to speaker_0=Seth (he always opens the
    show) if no confident match is found."""
    text_by_speaker = {}
    for w in words:
        if w.get("start", 0) > 240:  # only look at the cold open
            break
        if w["type"] == "word":
            text_by_speaker.setdefault(w["speaker_id"], []).append(w["text"])
    joined = {k: " ".join(v) for k, v in text_by_speaker.items()}
    mapping = {}
    for spk, text in joined.items():
        if re.search(r"\b(?:I'?m|This is)\s+Seth\b", text):
            mapping[spk] = "Seth"
        elif re.search(r"\b(?:I'?m|This is)\s+Andre[iy]?\b", text):
            mapping[spk] = "Andrey"
    all_speakers = sorted(set(w["speaker_id"] for w in words if w["type"] == "word"))
    if len(mapping) < len(all_speakers):
        remaining_names = {"Seth", "Andrey"} - set(mapping.values())
        remaining_speakers = [s for s in all_speakers if s not in mapping]
        for spk, name in zip(remaining_speakers, sorted(remaining_names)):
            mapping[spk] = name
    return mapping


def build_turns(words, mapping):
    turns = []  # (speaker_name, start_ts, [text pieces])
    cur_speaker, cur_start, cur_pieces = None, None, []
    for w in words:
        if w["type"] == "spacing":
            if cur_pieces:
                cur_pieces.append(w["text"])
            continue
        spk = mapping.get(w.get("speaker_id"), w.get("speaker_id"))
        if spk != cur_speaker:
            if cur_speaker is not None:
                turns.append((cur_speaker, cur_start, "".join(cur_pieces).strip()))
            cur_speaker, cur_start, cur_pieces = spk, w["start"], []
        cur_pieces.append(w["text"])
    if cur_speaker is not None:
        turns.append((cur_speaker, cur_start, "".join(cur_pieces).strip()))
    return [(spk, ts, txt) for spk, ts, txt in turns if txt.strip()]


def main():
    slug, json_path = sys.argv[1], sys.argv[2]
    data = json.load(open(json_path))
    words = data["words"]
    mapping = identify_speakers(words)
    print(f"{slug}: speaker mapping = {mapping}", file=sys.stderr)
    turns = build_turns(words, mapping)
    out_path = f"transcripts/{slug}.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        for spk, ts, txt in turns:
            f.write(f"{spk} ({fmt_ts(ts)}): {txt}\n")
    print(f"wrote {len(turns)} turns to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
