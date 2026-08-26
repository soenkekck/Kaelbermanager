# Project Brief: Kück's Kälbermanager

## Project Overview
Kück's Kälbermanager is a touch- and tablet-optimized web application designed for agricultural operations and dairy farms to efficiently manage newborn and growing calves. It provides real-time oversight of calves across multiple stalls, calculates daily milk requirements based on a dynamic feeding plan (*Tränkeplan*), tracks medical treatments and pending follow-up tasks, records pen transfers (*Stallwechsel*), and synchronizes all data with a Google Sheet backend via Google Apps Script.

## Core Requirements & Goals
- **Calf Management:** Register calves with ID tag number (*Ohrmarke*), birth date, and assigned pen (*Stall 1-5*). Track days alive and age in weeks/days.
- **Dynamic Feeding Plan (*Tränkeplan*):** Define age ranges (from/to days) and milk quantities in litres per calf. Automatically calculate expected daily milk consumption. Allow individual calf volume corrections.
- **Treatment & Task Tracking:** Document diagnoses, treatments, and status (repeat/completed). Automatically schedule follow-up tasks based on configurable delay hours (`taskDelayHours`).
- **Pen Transfers (*Stallwechsel*):** Easily move calves between different stalls.
- **Cloud & Local Storage:** Persist configuration locally via `localStorage` (`kaelbermanager-config-v1`) and store the primary database as JSON in a Google Sheet via Google Apps Script REST API (`Code.gs`). Provide visual feedback on connection status via an LED indicator.
- **Usability:** Designed for touchscreens in farm environments (large touch targets, virtual numeric keypad modal, autocomplete suggestions for diagnoses and treatments).

## Scope
- Frontend: Single Page Application (HTML5, CSS3, ES6 JavaScript).
- Backend: Google Apps Script Web App interfacing with Google Sheets.
- Storage Format: Single cell JSON payload (`A1` in sheet `Kaelbermanager`).
