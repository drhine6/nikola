# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nikola is a Fantasy Basketball AI assistant coach for an ESPN H2H 9-Category league. It optimizes weekly lineups, monitors player news/injuries, and tracks league activity.

**Current state:** Phase 1 (ESPN API exploration) is complete. The `explore/` directory contains Jupyter notebooks that document all ESPN API data structures. The full-stack app (TanStack Start + Convex + Telegram) has not been started yet.

## Key Domain Rules

- **Game limit:** 25 games/week per team. Optimal strategy: reach 24/25 on one day, then play all 7 roster slots the next day (theoretical max: 31 games).
- **Acquisition limit:** 7 add/drops or trades per week.
- **Scoring:** H2H Categories — PTS, REB, AST, STL, BLK, 3PM, FG%, FT%, TO (turnovers are inverted, lower is better). Win 5/9 categories to win a matchup.

## Environment Variables

See `.env.example`. Required: `ESPN_S2`, `SWID` (browser cookies from ESPN), `LEAGUE_ID`, `LEAGUE_YEAR`.
