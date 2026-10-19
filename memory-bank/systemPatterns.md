# System Patterns: Kück's Kälbermanager

## Architecture Overview
The application follows a lightweight Client-Server architecture utilizing a static frontend deployed as a web app and a Google Apps Script serverless backend acting as an API gateway to Google Sheets.

```
+-------------------------------------------------------+
|                    Browser / Tablet                   |
|  index.html + styles.css + app.js (Vanilla JS SPA)    |
|       localStorage (Config: sheetId, apiUrl)          |
+---------------------------+---------------------------+
                            | HTTPS (GET / POST JSON)
                            v
+-------------------------------------------------------+
|                 Google Apps Script                    |
|      Code.gs (doGet / doPost REST API endpoints)      |
+---------------------------+---------------------------+
                            | SpreadsheetApp
                            v
+-------------------------------------------------------+
|                     Google Sheets                     |
|           Spreadsheet (Sheet: 'Kaelbermanager')       |
|               Cell A1: JSON Database                  |
+-------------------------------------------------------+
```

## Technical Patterns & Design Decisions
1. **Single-Page Application (SPA) without Frameworks:** Written in pure Vanilla JavaScript (ES6+), HTML5, and CSS3. Avoids heavy build steps, keeping maintenance simple and load times instantaneous.
2. **Single Cell JSON Document Store:** The entire application database (`calves`, active `stables`, `stableLayouts`, `plan`, `corrections`, `taskDelayHours`, `suggestions`) is serialized as a JSON string stored in cell `A1` of the `Kaelbermanager` worksheet. Each main stall has a `large` or `dual` layout; active stall records store their own `milkMode` (`youngest` or `individual`). Calves reference active stable records by persistent ID; legacy numeric and compartment assignments are normalized and redistributed during data loading.
3. **Mutation and Save Pattern (`mutateAndSave`):** State changes are wrapped in mutation handlers that update local memory, trigger remote synchronization to Google Sheets, and update the UI.
4. **Touch-Optimized UI Components:**
   - Native system keyboards, with numeric and decimal input modes selected per field.
   - Modal dialogs for calf registration, treatment logging, pen selection, and settings.
   - Responsive CSS grid (`stableGrid`) representing active stall units; one shared numeric/compartment sort order drives stall cards, detail navigation, and transfer choices, while settings list one row per main stall.
   - Calf rows in the stall detail modal use a compact three-column arrangement at portrait-tablet widths and wrap action buttons below the calf and milk summary on narrow phones. Age is disclosed with birth and stall-entry dates through the info button; its `aria-expanded` state controls the visual highlight.
5. **Robust Error Handling & Connection Monitoring:**
   - Connection LED indicator (`connectionLED`) reflecting remote sync health.
   - Data validation (`ensureValidData`) ensuring payload integrity before saving.
