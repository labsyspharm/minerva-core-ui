# Component Refactoring Flow Diagram

## Overview
This diagram shows the transformation from the old flat structure to the new organized module-based structure.

**Branch**: `71` → `main`  
**PR**: #42  
**Verified**: ✅ All changes confirmed via `git diff main..71`

---

## 📁 OLD STRUCTURE → NEW STRUCTURE

### 🎨 AUTHORING MODULE

```
OLD: src/components/overlays/
├── index.tsx                    →  NEW: src/components/authoring/DrawingPanel.tsx
├── index.module.css             →  NEW: src/components/authoring/DrawingPanel.module.css
└── LayersPanel.tsx              →  NEW: src/components/authoring/LayersPanel.tsx

OLD: src/components/waypoint/
└── toolbar.tsx                  →  NEW: src/components/authoring/WaypointToolbar.tsx

OLD: src/components/editable/
├── namedIcons.tsx               →  NEW: src/components/authoring/tools/ActionButtons.tsx
├── common.tsx                   →  NEW: src/components/authoring/tools/EditModeSwitcher.tsx
└── status.tsx                   →  NEW: src/components/authoring/tools/EditableText.tsx

OLD: src/components/stories/
├── index.tsx                    →  NEW: src/components/authoring/waypoints/WaypointsList.tsx
├── index.module.css             →  NEW: src/components/authoring/waypoints/WaypointsList.module.css
├── ROIPanel.tsx                 →  NEW: src/components/authoring/waypoints/WaypointAnnotationEditor.tsx
└── ROIPanel.module.css          →  NEW: src/components/authoring/waypoints/WaypointAnnotationEditor.module.css
```

**Key Changes:**
- `overlays/index.tsx` → `DrawingPanel.tsx` (renamed component: `Overlays` → `DrawingPanel`)
- `stories/` → `waypoints/` (clearer naming)
- `ROIPanel` → `WaypointAnnotationEditor` (more descriptive)
- `editable/` → `tools/` (clearer purpose)
- `namedIcons` → `ActionButtons`, `common` → `EditModeSwitcher`, `status` → `EditableText`

---

### ▶️ PLAYBACK MODULE

```
OLD: src/components/
├── exporter.tsx                 →  NEW: src/components/playback/ImageExporter.tsx
├── content.tsx                  →  NEW: src/components/playback/PlaybackRouter.tsx
└── presentation/
    └── index.tsx                →  NEW: src/components/playback/Presentation.tsx
```

**Key Changes:**
- `exporter.tsx` → `ImageExporter.tsx` (more descriptive)
- `content.tsx` → `PlaybackRouter.tsx` (clearer purpose)
- Moved from `presentation/index.tsx` to `playback/Presentation.tsx` (better organization)

---

### 🔗 SHARED MODULE

```
OLD: src/components/
├── upload.tsx                   →  NEW: src/components/shared/Upload.tsx
└── channel/
    ├── groups.tsx               →  NEW: src/components/shared/channel/ChannelGroups.tsx
    └── legend.tsx               →  NEW: src/components/shared/channel/ChannelLegend.tsx

OLD: src/components/channel/
├── content.tsx                  →  DELETED (merged into ChannelPanel.tsx)
├── index.tsx                    →  DELETED (merged into ChannelPanel.tsx)
├── toolbar.tsx                  →  DELETED (merged into ChannelPanel.tsx)
├── groups.tsx                   →  NEW: src/components/shared/channel/ChannelGroups.tsx
└── legend.tsx                   →  NEW: src/components/shared/channel/ChannelLegend.tsx

NEW: src/components/shared/channel/ChannelPanel.tsx (created from merged channel files)

OLD: src/components/common/
├── header.tsx                   →  NEW: src/components/shared/common/Header.tsx
├── icon.tsx                     →  NEW: src/components/shared/common/Icon.tsx
├── icons.ts                     →  NEW: src/components/shared/common/Icon.tsx (merged)
├── ItemList.tsx                 →  NEW: src/components/shared/common/ItemList.tsx
└── ItemList.module.css          →  NEW: src/components/shared/common/ItemList.module.css

NEW: src/components/shared/common/types.ts (extracted from ChannelPanel & Presentation)

OLD: src/components/overlays/icons/
├── index.ts                     →  NEW: src/components/shared/icons/OverlayIcons.tsx
└── *.svg (13 files)             →  NEW: src/components/shared/icons/*.svg (flattened)
```

**Key Changes:**
- `channel/` → `shared/channel/` (shared across modes)
- `common/` → `shared/common/` (shared utilities)
- `icon.tsx` + `icons.ts` → merged into `Icon.tsx`
- `overlays/icons/` → `shared/icons/` (shared resources)
- Flattened nested `icons/icons/` structure

---

### 👁️ VIEWER MODULE

```
OLD: src/components/
├── vivView.tsx                  →  NEW: src/components/viewer/ImageViewer.tsx
├── imageView.tsx                →  DELETED (merged into ImageViewer.tsx)
├── vivLensing.tsx               →  NEW: src/components/viewer/layers/Lensing.tsx
└── loadingWidget.tsx            →  NEW: src/components/viewer/layers/LoadingWidget.tsx

OLD: src/components/overlays/
├── AnnotationLayers.ts          →  NEW: src/components/viewer/layers/annotations/AnnotationLayers.tsx
├── AnnotationRenderer.tsx       →  DELETED (merged into AnnotationLayers.tsx)
└── DrawingOverlay.tsx           →  NEW: src/components/viewer/layers/annotations/DrawingOverlay.tsx
```

**Key Changes:**
- `vivView` → `ImageViewer` (less library-specific)
- `vivLensing` → `Lensing` (shorter, clearer)
- `loadingWidget` → `LoadingWidget` (PascalCase)
- `overlays/` → `viewer/layers/annotations/` (clearer purpose)
- `AnnotationLayers.ts` → `.tsx` (contains React component)

---

### 📝 ROOT COMPONENT

```
OLD: src/
└── main.tsx                     →  NEW: src/components/Main.tsx (moved & capitalized)

OLD: src/components/
└── index.tsx                     →  DELETED (merged into Main.tsx)
```

### 🗑️ DELETED FILES (Consolidated/Merged)

```
OLD: src/components/
├── imageView.tsx                →  DELETED (merged into ImageViewer.tsx)
├── channel/
│   ├── content.tsx              →  DELETED (merged into ChannelPanel.tsx)
│   ├── index.tsx                →  DELETED (merged into ChannelPanel.tsx)
│   └── toolbar.tsx              →  DELETED (merged into ChannelPanel.tsx)
├── common/
│   ├── icons.ts                 →  DELETED (merged into Icon.tsx)
│   └── icons.tsx                →  DELETED (merged into Icon.tsx)
├── editable/
│   ├── channels.tsx             →  DELETED (consolidated - direct imports now)
│   ├── groups.tsx               →  DELETED (consolidated - direct imports now)
│   └── waypoints.tsx            →  DELETED (consolidated - direct imports now)
├── overlays/
│   └── AnnotationRenderer.tsx    →  DELETED (merged into AnnotationLayers.tsx)
└── custom.d.ts                   →  DELETED (no longer needed)
```

---

## 📊 VISUAL FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    OLD FLAT STRUCTURE                            │
│                    src/components/                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REFACTORING
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEW MODULAR STRUCTURE                         │
│                    src/components/                               │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  AUTHORING   │      │   PLAYBACK   │      │    VIEWER    │
│              │      │              │      │              │
│ DrawingPanel │      │ ImageExporter│      │ ImageViewer  │
│ LayersPanel  │      │ PlaybackRouter│     │   layers/    │
│ tools/       │      │ Presentation │      │   - Lensing  │
│ waypoints/   │      │              │      │   - Loading │
│              │      │              │      │   - annot./  │
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌──────────────┐
                    │    SHARED    │
                    │              │
                    │ channel/     │
                    │ common/      │
                    │ icons/       │
                    │ Upload       │
                    │ FileHandler  │
                    └──────────────┘
```

---

## 🔄 KEY REFACTORING PATTERNS

### 1. **Module Organization**
- **Before**: Flat structure with mixed concerns
- **After**: Organized by domain (authoring, playback, viewer, shared)

### 2. **Naming Improvements**
- Generic → Descriptive: `content.tsx` → `PlaybackRouter.tsx`
- Library-specific → Generic: `vivView` → `ImageViewer`, `vivLensing` → `Lensing`
- Abbreviations → Full names: `ROIPanel` → `WaypointAnnotationEditor`
- Lowercase → PascalCase: `toolbar.tsx` → `WaypointToolbar.tsx`

### 3. **File Consolidation**
- Merged `icon.tsx` + `icons.ts` → `Icon.tsx`
- Consolidated `channels.tsx`, `groups.tsx`, `waypoints.tsx` → direct imports
- Extracted duplicate `ImageProps` → `shared/common/types.ts`

### 4. **Path Improvements**
- Removed relative imports (`../../lib/...`)
- Switched from `src/` prefix to `@/` alias
- All imports now use absolute paths with `@/` alias

### 5. **Structure Cleanup**
- Removed redundant `overlays/` folders (split into `authoring/` and `viewer/layers/annotations/`)
- Flattened nested `icons/icons/` → `icons/`
- Moved CSS files to co-locate with components

---

## 📈 STATISTICS (Verified from git diff main..71)

- **Files Renamed/Moved**: 40 files (R status)
- **Files Deleted**: 13 files (consolidated/merged)
- **New Files Created**: 4 files (FileHandler.tsx, ChannelPanel.tsx, types.ts, Main.tsx)
- **Files Modified**: 4 files (index.tsx, validate.ts, tsconfig.json, vite.config.js)
- **Total Changes**: 61 files changed, 1,270 insertions(+), 1,356 deletions(-)
- **Net Change**: -86 lines (better organization, less code duplication)
- **Modules Created**: 4 (authoring, playback, viewer, shared)

---

## ✅ BENEFITS

1. **Clear Separation of Concerns**: Each module has a specific purpose
2. **Better Discoverability**: Easy to find components by domain
3. **Improved Maintainability**: Related files are grouped together
4. **Consistent Naming**: PascalCase components, lowercase directories
5. **Cleaner Imports**: Single `@/` alias instead of relative paths
6. **Type Safety**: Extracted shared types, explicit Props interfaces
