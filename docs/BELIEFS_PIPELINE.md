# Beliefs Pipeline Documentation

This document explains how priors and posteriors are extracted from podcast transcripts and displayed on the website.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Transcripts   │────▶│  /extract-priors │────▶│  beliefs.yml    │
│  /transcripts/  │     │     (Opus)       │     │   _data/        │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   index.html    │◀────│   Jekyll Build   │◀────│  Liquid Loop    │
│  (interactive)  │     │                  │     │  over episodes  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Components

### 1. Data Source: Transcripts (`/transcripts/`)

- **Format:** `.html` and `.txt` files
- **HTML files:** Have structured `<strong>The Priors that We Update On Are:</strong>` sections
- **TXT files:** Conversational format with speaker labels ("Andrey:", "Seth:")
- **Key locations:** Priors in first ~20%, posteriors in last ~20% of each file

### 2. Extraction: `/extract-priors` Skill

**Location:** `~/.claude/skills/extract-priors/skill.md`

**How it works:**
1. Reads first 8000 chars (priors section) and last 8000 chars (posteriors section)
2. Looks for probability statements, belief declarations, and update language
3. Extracts structured data for each episode

**Usage:**
```
/extract-priors
```

**Output:** YAML matching the `_data/beliefs.yml` structure

### 3. Data Storage: `_data/beliefs.yml`

**Format:**
```yaml
episodes:
  - title: "Episode Title"
    paper: "Paper or topic discussed"
    andrey:
      prior: "Initial belief with probability if stated"
      posterior: "Updated belief after discussion"
    seth:
      prior: "Initial belief with probability if stated"
      posterior: "Updated belief after discussion"
    insight: "Key takeaway from the episode"
```

**Current status:** 22 episodes with full prior/posterior data

### 4. Display: Interactive Table on `index.html`

**Template location:** `/index.html` (lines 51-120)

**How it works:**
```liquid
{% for episode in site.data.beliefs.episodes %}
  <article class="belief-row">
    <button class="belief-row__header">{{ episode.title }}</button>
    <div class="belief-row__content" hidden>
      <!-- Prior/posterior table -->
    </div>
  </article>
{% endfor %}
```

### 5. Interactivity: `assets/js/beliefs.js`

**Features:**
- **Expand/collapse:** Click row header to show/hide priors and posteriors
- **Search/filter:** Type in search box to filter episodes by keyword

**How it works:**
- Toggles `aria-expanded` attribute and `hidden` on content divs
- Adds/removes `.belief-row--hidden` class based on search query

## File Locations

| Component | Path |
|-----------|------|
| Transcripts | `/transcripts/*.html`, `/transcripts/*.txt` |
| Extraction skill | `~/.claude/skills/extract-priors/skill.md` |
| Data file | `/_data/beliefs.yml` |
| Index template | `/index.html` |
| JavaScript | `/assets/js/beliefs.js` |
| CSS | `/assets/css/style.css` (lines 898-1061) |
| Extraction summary | `/transcripts/priors_posteriors_summary.md` |

## Workflow

### Adding a New Episode

1. **Add transcript** to `/transcripts/` (HTML or TXT format)

2. **Run extraction** (optional - can also manually add to beliefs.yml):
   ```
   /extract-priors
   ```

3. **Update `_data/beliefs.yml`** with the new episode data

4. **Rebuild site:**
   ```bash
   bundle exec jekyll build
   ```

### Updating Existing Data

Edit `_data/beliefs.yml` directly - changes appear on next build.

## Key Patterns in Transcripts

**Priors (beginning of episode):**
- "my prior is..."
- "I came in thinking..."
- "before reading..."
- "going into this..."
- Probability statements: "X%", "one in X"

**Posteriors (end of episode):**
- "I'm updating to..."
- "I now think..."
- "this moved me..."
- "moved from X% to Y%"

## Efficiency Notes

The extraction skill focuses on first/last 8000 characters because:
- Priors are stated at episode start (intro + paper overview)
- Posteriors are stated at episode end (wrap-up section)
- Middle is discussion that rarely contains explicit probability updates
- This reduces token usage by ~60-70%
