# Active Context: Kück's Kälbermanager

## Current Focus
- Implemented configurable stall management with persistent IDs, legacy assignment migration, sorted stall cards and transfer choices, and safe removal rules.

## Recent Changes
- Added a graphical stall list to settings with number/compartment validation, duplicate prevention, and protection for occupied/final stalls.
- Updated calf stall display, transfer selection, detail navigation, and Google Sheets data normalization to use the shared sorted stall list.
- Fixed immediate stall-list refresh by retaining the form reference across the async save; removed leading zero padding from stall number tiles.
- Updated `save()` in `app.js` to target `lastSyncText` (matching `index.html`) with safe null checks.
- Gracefully handled Google Apps Script POST redirect/CORS errors in `save()` so actions preserve local state and close popups successfully.

## Next Steps / Upcoming Tasks
- Maintain high code quality and strict adherence to KISS and DRY principles.
