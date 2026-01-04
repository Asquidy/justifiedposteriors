# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Jekyll-based podcast website for "Justified Posteriors," a podcast about Bayesian thinking, science, and inference.

## Common Commands

```bash
# Install dependencies
bundle install

# Run local development server
bundle exec jekyll serve

# Build the site (output to _site/)
bundle exec jekyll build
```

## Architecture

**Jekyll Structure:**
- `_posts/` - Episode posts (markdown files named `YYYY-MM-DD-title.md`)
- `_layouts/` - HTML templates (default, page, post)
- `_includes/` - Reusable HTML partials (head, header, footer)
- `assets/css/` - Stylesheets (referenced as `/assets/css/style.css`)
- `assets/img/` - Images
- `_config.yml` - Site configuration and podcast metadata

**Episode Post Front Matter:**
Posts use the `post` layout and support these custom fields:
- `episode_number` - Episode number displayed in header
- `summary` - Episode summary shown below title
- `audio_url` - URL to audio file (enables embedded player)
- `audio_size` - File size displayed next to download link
- `duration` - Episode duration displayed in header

**Layouts:**
- `default.html` - Base layout with head/header/footer includes
- `post.html` - Episode page with audio player and episode navigation
- `page.html` - Static pages (About, Subscribe, etc.)
