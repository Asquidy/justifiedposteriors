#!/usr/bin/env python3
"""
Build cleaned, readable transcript pages for the Jekyll site.

  Raw sources:   transcripts/*.html (Substack post bodies) and transcripts/*.txt (caption exports)
  Metadata:      scripts/substack_episodes.json  (slug -> title, date, url, duration)
  Section hints: scripts/transcript_sections/<slug>.json  (hand-authored section headers,
                 used when the raw file carries no chapter markers)
  Output:        _transcripts/<slug>.html  (Jekyll collection, one page per episode)

Usage:
  python3 scripts/build_transcripts.py            # build everything
  python3 scripts/build_transcripts.py --only a-resource-curse-for-ai
  python3 scripts/build_transcripts.py --outline  # print a compact turn outline per file
                                                  # (used to author transcript_sections/*.json)
"""
import argparse
import glob
import html
import json
import os
import re
import sys
from collections import Counter
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "transcripts")
OUT_DIR = os.path.join(ROOT, "_transcripts")
META_PATH = os.path.join(ROOT, "scripts", "substack_episodes.json")
SECTIONS_DIR = os.path.join(ROOT, "scripts", "transcript_sections")

HOST_KEYS = {"seth": "Seth Benzell", "andrey": "Andrey Fradkin"}

# Raw speaker label (lowercased) -> canonical key
SPEAKER_ALIASES = {
    "seth": "seth", "seth benzell": "seth", "seth benzel": "seth",
    "andrey": "andrey", "andrey fradkin": "andrey", "andre": "andrey", "andrei": "andrey",
    "andre fradkin": "andrey", "andrey fratkin": "andrey", "andre fratkin": "andrey",
    "andrei fratkin": "andrey", "andre fracken": "andrey", "andrei fraffkin": "andrey",
}

# Fallback full names for guests when the show notes don't spell them out.
GUEST_FULL_NAMES = {
    "alex": "Alex Imas", "avi": "Avi Goldfarb", "basil": "Basil Halperin", "ben": "Ben Golub",
    "bo": "Bo Cowgill", "daniel": "Daniel Rock", "ioana": "Ioana Marinescu", "kevin": "Kevin Bryan",
    "noah": "Noah Smith", "seb": "Seb Krier", "daron": "Daron Acemoglu", "martin": "Martin Beraja",
    "martha": "Martha Gimbel", "alan": "Alan Rozenshtein",
}
# Per-episode guest overrides (slug -> {first: full})
GUEST_OVERRIDES = {
    "disputing-the-popes-ai-encyclical": {"kevin": "Kevin Frazier", "alan": "Alan Rozenshtein"},
}

# Labels that look like "Name:" but are show-notes structure, never speakers
LABEL_BLOCKLIST = {
    "prior", "priors", "posterior", "posteriors", "transcript", "summary", "note", "notes", "key",
    "question", "answer", "today", "estimate", "reasoning", "update", "chapters", "timestamps",
    "links", "references", "sponsor", "the prior", "the paper", "topics discussed", "key findings",
    "figures for reference", "connections", "the evidence", "announcer", "host", "guest",
}

TS_RE = r"\d{1,2}:\d{2}(?::\d{2})?"

# Speaker-line patterns (applied to a block of text)
P_SRT = re.compile(r"^(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*\[([^\]]+)\]\s*$")
P_TS_NAME = re.compile(r"^\[?(" + TS_RE + r")\]?\s+([A-Z][\w.'\- ]{0,30}?)\s*:\s*(.*)$", re.S)
P_NAME_PAREN_TS = re.compile(r"^([A-Z][\w.'\- ]{0,30}?)\s*\((" + TS_RE + r")\)\s*:\s*(.*)$", re.S)
P_NAME = re.compile(r"^([A-Z][\w.'\- ]{0,30}?)\s*:\s*(.*)$", re.S)

JUNK_PARAS = {"subscribe now", "share", "leave a comment", "subscribe", "share justified posteriors",
              "thanks for reading!", "thank you for reading justified posteriors."}

BACKCHANNEL_WORDS = {
    "yeah", "yes", "yep", "yup", "right", "okay", "ok", "mm-hmm", "mhm", "mm", "hmm", "hm", "uh-huh",
    "sure", "totally", "exactly", "true", "correct", "great", "wow", "oh", "cool", "amazing",
    "absolutely", "definitely", "interesting", "fair", "good", "nice", "huh", "all", "alright",
    "got", "it", "i", "see", "uh", "um", "mm-mm", "indeed", "gotcha", "laughs", "laughter", "chuckles",
}
ALLOWED_DOUBLES = {"had", "very", "really", "bye", "many", "long", "far", "no", "well", "that"}

NAME_FIXES = [
    (re.compile(r"Justif(?:ied|y)\s+(?:Pustere\s+Years|Clostereors|Pasteurias|Pascaria'?s|Posterior'?s|Posterior)\b", re.I), "Justified Posteriors"),
    (re.compile(r"\bAndre[iy]?\s+Fr(?:acken|atkin|affkin|adken|adkin)\b"), "Andrey Fradkin"),
    (re.compile(r"\bSeth\s+Benzel\b"), "Seth Benzell"),
    (re.compile(r"\bAndrei\b"), "Andrey"),
    (re.compile(r"\bAndre\b(?!\s+[A-Z])"), "Andrey"),
    (re.compile(r"\bChapman University\b"), "Chapman University"),
]


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def parse_ts(s):
    if not s:
        return None
    s = s.replace(",", ".")
    parts = s.split(":")
    try:
        parts = [float(p) for p in parts]
    except ValueError:
        return None
    if len(parts) == 2:
        return int(parts[0] * 60 + parts[1])
    if len(parts) == 3:
        return int(parts[0] * 3600 + parts[1] * 60 + parts[2])
    return None


def fmt_ts(sec):
    if sec is None:
        return ""
    sec = int(sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def norm_label(label):
    lab = re.sub(r"\s+", " ", label.strip().strip(".")).lower()
    if lab in SPEAKER_ALIASES:
        return SPEAKER_ALIASES[lab]
    if lab.startswith("speaker "):
        return lab
    return lab.split(" ")[0]  # first name


def looks_like_name(label):
    lab = label.strip()
    if lab.lower() in LABEL_BLOCKLIST:
        return False
    if re.match(r"^Speaker \d$", lab):
        return True
    words = lab.split()
    if not 1 <= len(words) <= 3:
        return False
    return all(re.match(r"^[A-Z][A-Za-z.'\-]*$", w) or w.isupper() for w in words)


# ----------------------------------------------------------------------------
# HTML block extraction
# ----------------------------------------------------------------------------
class BlockParser(HTMLParser):
    BLOCK_TAGS = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "figcaption"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []  # (tag, text)
        self._tag = None
        self._buf = []

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOCK_TAGS:
            self._flush()
            self._tag = tag
        elif tag == "br" and self._tag:
            self._buf.append("\n")

    def handle_endtag(self, tag):
        if tag in self.BLOCK_TAGS:
            self._flush()

    def handle_data(self, data):
        if self._tag is not None:
            self._buf.append(data)

    def _flush(self):
        if self._tag is not None:
            text = "".join(self._buf)
            for piece in text.split("\n"):
                piece = re.sub(r"\s+", " ", piece).strip()
                if piece:
                    self.blocks.append((self._tag, piece))
        self._tag = None
        self._buf = []


def html_blocks(raw):
    p = BlockParser()
    p.feed(raw)
    p._flush()
    return p.blocks


# ----------------------------------------------------------------------------
# Parsing into turns
# ----------------------------------------------------------------------------
class Turn:
    __slots__ = ("idx", "speaker", "ts", "text", "section", "section_ts", "est_ts")

    def __init__(self, idx, speaker, ts, text):
        self.idx, self.speaker, self.ts, self.text = idx, speaker, ts, text
        self.section = None
        self.section_ts = None
        self.est_ts = None


def match_speaker_line(text, valid_labels=None):
    """Return (label, ts, rest) if text starts with a speaker label, else None."""
    m = P_SRT.match(text)
    if m:
        return (m.group(2), parse_ts(m.group(1)), "")
    for pat, order in ((P_TS_NAME, "tsn"), (P_NAME_PAREN_TS, "npt"), (P_NAME, "n")):
        m = pat.match(text)
        if not m:
            continue
        if order == "tsn":
            ts, label, rest = m.group(1), m.group(2), m.group(3)
        elif order == "npt":
            label, ts, rest = m.group(1), m.group(2), m.group(3)
        else:
            label, ts, rest = m.group(1), None, m.group(2)
        if not looks_like_name(label):
            return None
        if valid_labels is not None and norm_label(label) not in valid_labels:
            return None
        return (label, parse_ts(ts) if ts else None, rest)
    return None


def extract_chapters(blocks):
    """Find chapter lists like '12:34 – Title' or 'Title [12:34 – 15:00]' in show notes."""
    chapters = []
    for tag, text in blocks:
        m = re.match(r"^\[?(" + TS_RE + r")\]?\s*(?:[–—\-:]\s*)?(.+)$", text)
        if m and len(m.group(2)) < 120:
            chapters.append((parse_ts(m.group(1)), m.group(2).strip(" –—-:")))
            continue
        m = re.match(r"^(.+?)\s*[\[\(](" + TS_RE + r")(?:\s*[–—\-]\s*" + TS_RE + r")?[\]\)]\s*:?$", text)
        if m and len(m.group(1)) < 120:
            chapters.append((parse_ts(m.group(2)), m.group(1).strip()))
    # keep only if it looks like a real list (monotone, >=3)
    if len(chapters) >= 3 and all(chapters[i][0] <= chapters[i + 1][0] for i in range(len(chapters) - 1)):
        return chapters
    return []


def strip_header_ts(text):
    m = re.match(r"^(.*?)\s*[\[\(](" + TS_RE + r")(?:\s*[–—\-]\s*" + TS_RE + r")?[\]\)]\s*:?\s*$", text)
    if m:
        return m.group(1).strip(" :"), parse_ts(m.group(2))
    m = re.match(r"^[\[\(](" + TS_RE + r")[\]\)]\s*[–—\-:]?\s*(.+)$", text)
    if m:
        return m.group(2).strip(" :"), parse_ts(m.group(1))
    return text.strip(" :"), None


TITLE_STOPWORDS = re.compile(r"^(and|but|so|yeah|well|i|we|you|it|that|this|then|okay|what|um|uh|the first|because|or|if|maybe|yes|no|right)\b", re.I)


def is_titleish(text):
    """Does a short, unlabeled paragraph look like a section title rather than a sentence fragment?"""
    t = text.strip()
    if len(t) > 90 or re.search(r"[.?!,;…\-–—]$", t) or TITLE_STOPWORDS.match(t):
        return False
    words = t.rstrip(":").split()
    if not 1 <= len(words) <= 12:
        return False
    if t.endswith(":"):
        return True
    big = [w for w in words if len(w) > 3]
    caps = [w for w in big if w[0].isupper()]
    return bool(big) and len(caps) / len(big) >= 0.6


def parse_html(raw):
    blocks = html_blocks(raw)
    # Pass 1: count candidate labels
    counts = Counter()
    for tag, text in blocks:
        r = match_speaker_line(text)
        if r:
            counts[norm_label(r[0])] += 1
    valid = {k for k, v in counts.items() if v >= 5}
    if not valid:
        return None, [], blocks

    def is_spk(i):
        return i < len(blocks) and match_speaker_line(blocks[i][1], valid) is not None

    srt_mode = any(P_SRT.match(t) for _, t in blocks)
    # transcript start: first speaker block followed by a dense run of speaker lines
    start = None
    for i in range(len(blocks)):
        window = blocks[i:i + 30]
        need = 10 if srt_mode else 15
        if is_spk(i) and sum(1 for j in range(i, min(i + 30, len(blocks))) if is_spk(j)) >= min(need, max(3, len(window) // 2)):
            start = i
            break
    if start is None:
        return None, [], blocks
    # if an explicit "Transcript" heading appears after start, restart there
    for i in range(start, len(blocks)):
        tag, text = blocks[i]
        if tag in ("h1", "h2", "h3", "h4") and re.match(r"(?i)^\s*(full |podcast |justified posteriors podcast )?transcript\s*:?\s*$", text):
            start = i + 1
    end = max(i for i in range(len(blocks)) if is_spk(i))

    chapters = extract_chapters(blocks[:start])

    turns = []
    pending_header = []
    cur = None
    for i in range(start, end + 1):
        tag, text = blocks[i]
        if text.lower().strip(" .!") in JUNK_PARAS:
            continue
        r = match_speaker_line(text, valid)
        if r:
            label, ts, rest = r
            cur = Turn(len(turns), norm_label(label), ts, rest)
            if pending_header:
                title = " — ".join(h[0] for h in pending_header)
                cur.section, cur.section_ts = title, pending_header[0][1]
                pending_header = []
            turns.append(cur)
            continue
        if tag in ("h1", "h2", "h3", "h4"):
            title, hts = strip_header_ts(text)
            if title.lower() not in ("transcript", "full transcript") and title:
                pending_header.append((title, hts))
            continue
        # non-speaker paragraph inside transcript: continuation or header-ish
        if cur is not None and (srt_mode or not is_titleish(text)):
            cur.text = (cur.text + " " + text).strip()
        elif is_titleish(text):
            title, hts = strip_header_ts(text)
            pending_header.append((title, hts))
    return turns, chapters, blocks[:start]


def parse_txt(raw):
    lines = [l.rstrip("\n") for l in raw.split("\n")]
    nonempty = [l for l in lines if l.strip()]
    n_dash = sum(1 for l in nonempty if re.match(r"^\s*- ", l))
    n_chev = sum(1 for l in nonempty if re.match(r"^\s*>> ?", l))
    n_colon = sum(1 for l in nonempty if match_speaker_line(l.strip()))
    n_nameline = sum(1 for l in nonempty if l.strip().lower() in SPEAKER_ALIASES)
    turns = []

    def add(text, speaker=None):
        text = text.strip()
        if text:
            turns.append(Turn(len(turns), speaker, None, text))

    if n_dash >= 20 or n_chev >= 20:
        marker = r"^\s*- " if n_dash >= n_chev else r"^\s*>> ?"
        buf = []
        for l in nonempty:
            if re.match(marker, l):
                add(" ".join(buf))
                buf = [re.sub(marker, "", l).strip()]
            else:
                buf.append(l.strip())
        add(" ".join(buf))
        return turns, "unlabeled"
    if n_nameline >= 20:
        spk, buf = None, []
        for l in nonempty:
            s = l.strip()
            if s.lower() in SPEAKER_ALIASES:
                add(" ".join(buf), spk)
                spk, buf = SPEAKER_ALIASES[s.lower()], []
            else:
                buf.append(s)
        add(" ".join(buf), spk)
        return turns, "labeled"
    if n_colon >= 20:
        for l in nonempty:
            s = l.strip()
            r = match_speaker_line(s)
            if r and (norm_label(r[0]) in SPEAKER_ALIASES.values() or r[0].lower() == "announcer"):
                turns.append(Turn(len(turns), norm_label(r[0]) if r[0].lower() != "announcer" else "announcer", r[1], r[2]))
            elif turns:
                turns[-1].text += " " + s
            else:
                add(s)
        return turns, "labeled"
    # flowing text with no speaker cues: paragraphize by sentences
    text = " ".join(l.strip() for l in nonempty)
    sentences = re.split(r"(?<=[.?!])\s+(?=[A-Z\"“\[(])", text)
    buf, words = [], 0
    for s in sentences:
        buf.append(s)
        words += len(s.split())
        if words >= 110:
            add(" ".join(buf))
            buf, words = [], 0
    add(" ".join(buf))
    return turns, "flow"


# ----------------------------------------------------------------------------
# Cleaning
# ----------------------------------------------------------------------------
SOUND_CUE = re.compile(r"[\(\[]\s*(?:[\w-]+\s+){0,2}(?:music|applause|inaudible|crosstalk|silence|pause|beep|sighs?)[^\)\]]*[\)\]]", re.I)
INLINE_TS = re.compile(r"\s*\[" + TS_RE + r"\]\s*")
FILLER_BRACKETED = re.compile(r",\s*(?:um+|uh+|uhm|erm|ah+)\s*,\s*", re.I)
FILLER = re.compile(r"(?<![\w'-])(?:um+|uh+|uhm|erm|ah+)(?![\w'-])[,.]?\s*", re.I)
YOU_KNOW = re.compile(r",\s*you know,\s*|(?<=\.\s)You know,\s*|^You know,\s*", re.I)
LIKE_COMMA = re.compile(r",\s*like,\s*", re.I)
SENT_LIKE = re.compile(r"(^|[.?!]\s+)Like,\s+")
I_MEAN = re.compile(r"(^|[.?!]\s+)I mean,\s+")
FRAGMENT = re.compile(r"(?<![\w-])[A-Za-z]{1,8}-\s+(?=[A-Za-z])")
DOUBLE = re.compile(r"\b(\w+(?:'\w+)?)(?:,|\.\.\.)? \1\b", re.I)


def clean_text(s):
    s = html.unescape(s)
    s = SOUND_CUE.sub(" ", s)
    s = INLINE_TS.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for pat, rep in NAME_FIXES:
        s = pat.sub(rep, s)
    s = FILLER_BRACKETED.sub(", ", s)
    s = FILLER.sub("", s)
    s = YOU_KNOW.sub(lambda m: ", " if m.group(0).startswith(",") else "", s)
    s = LIKE_COMMA.sub(", ", s)
    s = SENT_LIKE.sub(r"\1", s)
    s = I_MEAN.sub(r"\1", s)
    s = FRAGMENT.sub("", s)
    for _ in range(3):
        s = DOUBLE.sub(lambda m: m.group(0) if m.group(1).lower() in ALLOWED_DOUBLES else m.group(1), s)
    # punctuation tidy-up
    s = re.sub(r"\s+([,.;:?!])", r"\1", s)
    s = re.sub(r",\s*,+", ",", s)
    s = re.sub(r",\s*([.?!])", r"\1", s)
    s = re.sub(r"^[,;:\s]+", "", s)
    s = re.sub(r"\(\s*\)|\[\s*\]", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip()
    # capitalise sentence starts that lost their first word
    s = re.sub(r"(^|[.?!]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), s)
    return s


def is_backchannel(text):
    t = re.sub(r"[^\w\s'-]", " ", text.lower())
    words = t.split()
    if not words:
        return True
    if len(words) > 3:
        return False
    return all(w in BACKCHANNEL_WORDS for w in words)


def split_long(text, limit=230, target=170):
    words = text.split()
    if len(words) <= limit:
        return [text]
    sentences = re.split(r"(?<=[.?!…])\s+(?=[A-Z\"“(\[])", text)
    out, buf, n = [], [], 0
    for s in sentences:
        buf.append(s)
        n += len(s.split())
        if n >= target:
            out.append(" ".join(buf))
            buf, n = [], 0
    if buf:
        if out and n < 25:
            out[-1] += " " + " ".join(buf)
        else:
            out.append(" ".join(buf))
    return out


# ----------------------------------------------------------------------------
# Sections
# ----------------------------------------------------------------------------
def estimate_times(turns, duration):
    """Linear interpolation of timestamps over word positions."""
    cum, pos = 0, []
    for t in turns:
        pos.append(cum)
        cum += len(t.text.split())
    total = max(cum, 1)
    anchors = [(pos[i], t.ts) for i, t in enumerate(turns) if t.ts is not None]
    if not anchors:
        if duration:
            for i, t in enumerate(turns):
                t.est_ts = duration * pos[i] / total
        return len(anchors)
    if anchors[0][0] > 0:
        anchors.insert(0, (0, max(0, anchors[0][1] - anchors[0][0] * (anchors[0][1] / max(anchors[0][0], 1)))))
    if duration and anchors[-1][0] < total:
        anchors.append((total, duration))
    ai = 0
    for i, t in enumerate(turns):
        while ai + 1 < len(anchors) - 1 and anchors[ai + 1][0] <= pos[i]:
            ai += 1
        (p0, t0), (p1, t1) = anchors[ai], anchors[min(ai + 1, len(anchors) - 1)]
        t.est_ts = t0 if p1 == p0 else t0 + (t1 - t0) * (pos[i] - p0) / (p1 - p0)
    return len([a for a in anchors])


def apply_chapters(turns, chapters):
    """Place chapter headers at the turn whose (estimated) time is closest to the chapter start."""
    for ts, title in chapters:
        if ts is None:
            continue
        best = min(range(len(turns)), key=lambda i: abs((turns[i].est_ts or 0) - ts))
        if turns[best].section is None:
            turns[best].section, turns[best].section_ts = title, ts


def apply_manual_sections(turns, slug):
    path = os.path.join(SECTIONS_DIR, slug + ".json")
    if not os.path.exists(path):
        return False
    spec = json.load(open(path))
    for item in spec:
        idx = item["turn"]
        starts = item.get("starts", "")
        target = None
        if 0 <= idx < len(turns) and (not starts or turns[idx].text.lower().startswith(starts.lower()[:20])):
            target = idx
        else:
            for j in range(max(0, idx - 15), min(len(turns), idx + 16)):
                if starts and turns[j].text.lower().startswith(starts.lower()[:20]):
                    target = j
                    break
        if target is None:
            print(f"  WARN {slug}: section anchor not found for turn {idx} ({starts!r}); using index", file=sys.stderr)
            target = min(max(idx, 0), len(turns) - 1)
        turns[target].section = item["title"]
        turns[target].section_ts = turns[target].ts
    return True


# ----------------------------------------------------------------------------
# Assemble paragraphs
# ----------------------------------------------------------------------------
def assemble(turns, labeled):
    """Clean, drop backchannels, merge same-speaker runs. Returns list of paragraph dicts."""
    cleaned = []
    for t in turns:
        text = clean_text(t.text)
        if not text or (is_backchannel(text) and t.section is None):
            continue
        cleaned.append((t, text))
    paras = []
    for t, text in cleaned:
        prev = paras[-1] if paras else None
        if (prev is not None and labeled and t.speaker is not None and prev["speaker"] == t.speaker
                and t.section is None and len(prev["text"].split()) + len(text.split()) <= 260):
            prev["text"] = (prev["text"] + " " + text).strip()
            prev["raw_idx"].append(t.idx)
            continue
        paras.append({"speaker": t.speaker, "ts": t.ts, "text": text, "section": t.section,
                      "section_ts": t.section_ts, "raw_idx": [t.idx]})
    return paras


def speaker_roster(turns, notes_text, slug, title):
    keys = []
    for t in turns:
        if t.speaker and t.speaker not in keys:
            keys.append(t.speaker)
    roster = {}
    guest_n = 0
    overrides = GUEST_OVERRIDES.get(slug, {})
    for k in keys:
        if k in HOST_KEYS:
            roster[k] = {"name": HOST_KEYS[k], "short": HOST_KEYS[k].split()[0], "cls": "host-" + k}
        elif k == "announcer":
            roster[k] = {"name": "Announcer", "short": "Announcer", "cls": "announcer"}
        elif k.startswith("speaker "):
            roster[k] = {"name": k.title(), "short": k.title(), "cls": "unknown"}
        else:
            guest_n += 1
            full = overrides.get(k)
            if not full:
                cands = Counter(re.findall(r"\b" + re.escape(k.capitalize()) + r"\s+([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\b", notes_text + " " + title))
                cands = {c: n for c, n in cands.items() if c not in ("And", "The", "Is", "On", "Says", "Thinks", "Argues", "Asks", "Joins")}
                if cands:
                    full = k.capitalize() + " " + max(cands, key=cands.get)
            if not full:
                full = GUEST_FULL_NAMES.get(k, k.capitalize())
            roster[k] = {"name": full, "short": full.split()[0], "cls": f"guest-{guest_n}"}
    return roster


def render(paras, roster, labeled):
    out = []
    last_ts = None
    sec_n = 0
    sections = []
    for p in paras:
        if p["section"]:
            sec_n += 1
            sid = f"section-{sec_n}"
            ts_str = fmt_ts(p["section_ts"]) if p["section_ts"] is not None else (fmt_ts(p["ts"]) if p["ts"] is not None else "")
            sections.append({"id": sid, "title": p["section"], "ts": ts_str})
            out.append(f'<h2 class="transcript-section" id="{sid}">{html.escape(p["section"], quote=False)}'
                       + (f' <span class="transcript-section__ts">{ts_str}</span>' if ts_str else "") + "</h2>")
            if p["section_ts"] is not None:
                last_ts = p["section_ts"]
        chunks = split_long(p["text"])
        for ci, chunk in enumerate(chunks):
            show_ts = ""
            if ci == 0 and p["ts"] is not None and (last_ts is None or p["ts"] - last_ts >= 180):
                show_ts = f'<span class="transcript-ts">{fmt_ts(p["ts"])}</span>'
                last_ts = p["ts"]
            label = ""
            cls = "turn"
            if ci == 0 and labeled and p["speaker"] and p["speaker"] in roster:
                r = roster[p["speaker"]]
                label = f'<strong class="turn__speaker turn__speaker--{r["cls"]}">{html.escape(r["short"], quote=False)}:</strong> '
            elif ci > 0:
                cls += " turn--cont"
            if not labeled:
                cls += " turn--unlabeled"
            out.append(f'<p class="{cls}">{show_ts}{label}{html.escape(chunk, quote=False)}</p>')
    return "\n".join(out), sections


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def process(path, meta, outline=False):
    slug = os.path.splitext(os.path.basename(path))[0]
    raw = open(path, encoding="utf-8", errors="replace").read()
    info = meta.get(slug)
    if not info:
        print(f"SKIP {slug}: no Substack metadata", file=sys.stderr)
        return None
    chapters, notes_text = [], ""
    if path.endswith(".html"):
        turns, chapters, notes_blocks = parse_html(raw)
        if turns is None or len(turns) < 20:
            print(f"SKIP {slug}: no speaker-labelled transcript found (show notes only)", file=sys.stderr)
            return None
        labeled = True
        notes_text = " ".join(t for _, t in notes_blocks)
    else:
        turns, kind = parse_txt(raw)
        labeled = kind == "labeled"

    duration = info.get("duration_seconds")
    n_anchor = estimate_times(turns, duration)
    n_ts = sum(1 for t in turns if t.ts is not None)
    has_inline_sections = any(t.section for t in turns)
    section_source = "inline" if has_inline_sections else None
    if not has_inline_sections and apply_manual_sections(turns, slug):
        section_source = "manual"
    if not has_inline_sections and section_source is None and chapters and n_ts >= 5:
        apply_chapters(turns, chapters)
        section_source = "chapters"

    if outline:
        print(f"\n##### {slug}  ({info['title']})  turns={len(turns)} ts={n_ts} labeled={labeled} sections={section_source}")
        if chapters:
            print("  chapter list in show notes:", "; ".join(f"{fmt_ts(ts)} {t}" for ts, t in chapters))
        if section_source:
            return slug
        for t in turns:
            ts = fmt_ts(t.ts) if t.ts is not None else ("~" + fmt_ts(t.est_ts) if t.est_ts is not None else "")
            spk = (t.speaker or "?")[:6]
            print(f"  {t.idx:4d} {ts:>8s} {spk:6s} {clean_text(t.text)[:120]}")
        return slug

    roster = speaker_roster(turns, notes_text, slug, info["title"])
    paras = assemble(turns, labeled)
    body, sections = render(paras, roster, labeled)
    words = sum(len(p["text"].split()) for p in paras)
    guests = [r["name"] for k, r in roster.items() if k not in HOST_KEYS and k != "announcer"]
    speakers = [r["name"] for k, r in roster.items() if k != "announcer"]

    fm = [
        "---",
        "layout: transcript",
        "wrap_class: wrap--wide",
        f"title: {yaml_str(info['title'])}",
        f"date: {info['date']}",
        f"slug: {slug}",
        f"episode_url: {yaml_str(info['url'])}",
        f"subtitle: {yaml_str(info.get('subtitle') or '')}",
        f"duration: {yaml_str(fmt_ts(duration) if duration else '')}",
        f"speakers: [{', '.join(yaml_str(s) for s in speakers)}]",
        f"guests: [{', '.join(yaml_str(g) for g in guests)}]",
        f"speaker_labels: {'true' if labeled else 'false'}",
        f"word_count: {words}",
        f"source_file: {yaml_str(os.path.relpath(path, ROOT))}",
        "sections:",
    ]
    for s in sections:
        fm.append(f"  - {{id: {s['id']}, title: {yaml_str(s['title'])}, ts: {yaml_str(s['ts'])}}}")
    fm.append("---")
    out_path = os.path.join(OUT_DIR, slug + ".html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(fm) + "\n{% raw %}\n" + body + "\n{% endraw %}\n")
    print(f"OK   {slug:48s} {info['date']} paras={len(paras):4d} words={words:6d} sections={len(sections):2d} ({section_source or 'none'}) labels={labeled} speakers={speakers}")
    return slug


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="slug to build")
    ap.add_argument("--outline", action="store_true")
    args = ap.parse_args()
    meta = json.load(open(META_PATH))
    os.makedirs(OUT_DIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*.html")) + glob.glob(os.path.join(RAW_DIR, "*.txt")))
    built = []
    for path in files:
        slug = os.path.splitext(os.path.basename(path))[0]
        if args.only and slug != args.only:
            continue
        r = process(path, meta, outline=args.outline)
        if r:
            built.append(r)
    if not args.only and not args.outline:
        # remove stale outputs
        for old in glob.glob(os.path.join(OUT_DIR, "*.html")):
            if os.path.splitext(os.path.basename(old))[0] not in built:
                os.remove(old)
                print("removed stale", old)
    print(f"\n{len(built)} transcripts built", file=sys.stderr)


if __name__ == "__main__":
    main()
