# Product Context: Kück's Kälbermanager

## Why This Project Exists
Managing calves on a modern dairy farm requires precise tracking of feeding regimens, health statuses, and pen locations. Traditional paper-based records or complex desktop software are impractical in the barn environment where farmers work with tablets or mobile devices. Kälbermanager provides an ultra-fast, intuitive, and reliable web interface tailored specifically for barn usage.

## Problems Solved
1. **Feeding Accuracy:** The configurable feeding plan assigns either whole milk or milk replacer by age range. Each stall's daily quantity uses the youngest calf's applicable ration multiplied by the stall's calf count, with total quantities tracked separately by milk type.
2. **Health Monitoring:** Keeps track of veterinary treatments, diagnoses, and ensures required follow-up checkups are not missed.
3. **Data Portability & Reliability:** Combines local responsiveness with cloud persistence in Google Sheets, allowing seamless backup and accessibility across devices without maintaining a complex database server.
4. **Barn Usability:** Features large buttons, a custom on-screen numeric keypad, and clean visual indicators suitable for touch operations even when wearing farm gloves or in bright daylight.

## User Experience Goals
- **Simplicity (KISS):** Zero clutter; immediate overview of total milk needed today, total calves, and active treatments.
- **Robustness:** Clear visual connection status (LED indicator) and safe mutate-and-save operations preventing data corruption.
- **Speed:** Instant local rendering with background sync to Google Sheets.
