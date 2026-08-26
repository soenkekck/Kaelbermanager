# Active Context: Kück's Kälbermanager

## Current Focus
- Implemented robust auto-refresh mechanisms (`visibilitychange`, window `focus`, and 60s background polling) to automatically sync remote changes from Google Sheets when returning to the app or waking up the tablet.
- Added a visual loading spinner (`syncSpinner`) in the topbar that automatically appears during upload/download sync operations and disappears immediately upon completion.

## Recent Changes
- Updated `index.html` to add `#syncSpinner`.
- Updated `styles.css` with `.sync-spinner` animation styles.
- Updated `app.js` with `showSpinner`/`hideSpinner` wrappers around `loadRemote()` and `save()`, plus focus/visibility/polling event listeners.

## Next Steps / Upcoming Tasks
- Keep the Memory Bank synchronized with any future code changes or feature additions.
- Maintain high code quality and strict adherence to KISS and DRY principles.
