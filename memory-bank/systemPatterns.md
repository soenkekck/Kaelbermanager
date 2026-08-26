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
2. **Single Cell JSON Document Store:** The entire application database (`calves`, `plan`, `corrections`, `taskDelayHours`, `suggestions`) is serialized as a JSON string stored in cell `A1` of the `Kaelbermanager` worksheet. This eliminates relational schema overhead while providing atomic state persistence.
3. **Mutation and Save Pattern (`mutateAndSave`):** State changes are wrapped in mutation handlers that update local memory, trigger remote synchronization to Google Sheets, and update the UI.
4. **Touch-Optimized UI Components:**
   - Custom virtual keypad modal (`keypadModal`) for numeric inputs.
   - Modal dialogs for calf registration, treatment logging, pen selection, and settings.
   - Responsive CSS grid (`stableGrid`) representing up to 5 stalls.
5. **Robust Error Handling & Connection Monitoring:**
   - Connection LED indicator (`connectionLED`) reflecting remote sync health.
   - Data validation (`ensureValidData`) ensuring payload integrity before saving.
