# Active Context: Kück's Kälbermanager

## Current Focus
- Stallverwaltung nach Hauptstallnummern mit umschaltbarem Großstall-/Dualboxen-Layout (A/B/C), automatischer Kälberverteilung und eigener Tränkeberechnung je aktiver Einheit.
- Refined the responsive calf rows in the stall detail modal for portrait tablets and narrow phones.
- Calf age is hidden from compact rows and shown with birth and stall-entry dates in the info-button disclosure.
- The info button returns to a neutral border when collapsed, including when a touch device retains its hover state.

## Recent Changes
- Reworked stall settings to add and remove main stall numbers, toggle between one large stall and three dual boxes, and retain per-unit milk calculation modes.
- Added legacy data normalization for existing compartment letters, chronological balanced redistribution, and calf/treatment preservation when layouts change.
- Updated the guided tour and responsive stall settings for the main-stall layout switch.
- Added a graphical stall list to settings with number/compartment validation, duplicate prevention, and protection for occupied/final stalls.
- Updated calf stall display, transfer selection, detail navigation, and Google Sheets data normalization to use the shared sorted stall list.
- Fixed immediate stall-list refresh by retaining the form reference across the async save; removed leading zero padding from stall number tiles.
- Updated `save()` in `app.js` to target `lastSyncText` (matching `index.html`) with safe null checks.
- Gracefully handled Google Apps Script POST redirect/CORS errors in `save()` so actions preserve local state and close popups successfully.
- Reworked calf rows in `styles.css`: at tablet widths, tag, milk quantity, and all four actions share a compact row; narrow phones place actions on a second row without horizontal overflow.
- Added calf age to the info-button details and updated its accessible label to include age.
- Prevented the collapsed info button's touch-sticky hover style from retaining a green outline; the expanded state remains highlighted.
- Checked the calf-row layout in a browser at 800px and 390px viewport widths; all action buttons fit and the row has no horizontal overflow.

## Next Steps / Upcoming Tasks
- Maintain high code quality and strict adherence to KISS and DRY principles.
