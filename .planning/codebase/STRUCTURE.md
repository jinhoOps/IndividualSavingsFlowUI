# Directory Structure

```text
root/
├── apps/
│   ├── step1/                # Monthly Cash Flow (나의 가계 흐름)
│   │   ├── modules/          # Feature-specific logic
│   │   ├── index.html        # Step 1 entry
│   │   ├── styles.css        # Step 1 specific styles
│   │   └── app.js            # Step 1 main entry
│   └── step2/                # Portfolio Investment (MVP)
├── icons/                    # App icons (PWA)
├── shared/                   # Cross-step shared resources
│   ├── components/           # Web components or modular UI parts
│   ├── core/                 # Essential utils (Calculation, Share, Common)
│   ├── pwa/                  # Service worker management
│   ├── storage/              # IndexedDB schemas and persistence
│   └── styles/               # Global theme and variables
├── .planning/                # GSD Planning system (State, Codebase map)
├── DESIGN.md                 # Design system tokens and specs
├── GEMINI.md                 # Project constitution (Router)
├── README.md                 # Project overview
├── sw.js                     # Root Service Worker
└── manifest.webmanifest      # PWA Manifest
```
