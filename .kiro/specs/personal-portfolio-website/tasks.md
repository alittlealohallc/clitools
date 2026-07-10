# Implementation Plan: Personal Portfolio Website

## Overview

Build Kent Schaeffer's personal portfolio as a static React 18 + Vite 5 + Tailwind CSS v3 single-page application. The implementation follows a layered approach: scaffold the project and shared infrastructure first, implement core hooks and data, then build components section by section, and wire everything together for deployment.

All fonts are self-hosted via `@fontsource` npm packages, icons via `lucide-react`, dark mode via Tailwind `darkMode: 'class'`, and navigation via hash anchors + `scrollIntoView`. Property-based tests use `fast-check` + `@fast-check/vitest`.

---

## Tasks

- [ ] 1. Scaffold project and configure build infrastructure
  - [ ] 1.1 Initialize Vite + React project and install all dependencies
    - Run `npm create vite@latest personal-portfolio-website -- --template react` to bootstrap the project
    - Install production deps: `tailwindcss@3 postcss autoprefixer @fontsource/fraunces @fontsource-variable/dm-sans @fontsource/jetbrains-mono lucide-react`
    - Install dev deps: `vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom fast-check @fast-check/vitest gh-pages`
    - Run `npx tailwindcss init -p` to generate `tailwind.config.js` and `postcss.config.js`
    - _Requirements: 9.2_

  - [ ] 1.2 Configure `vite.config.js` with GitHub Pages base path
    - Set `base: '/personal-portfolio-website/'` in the Vite config
    - Add `@vitejs/plugin-react` plugin
    - Configure Vitest `test` block: `environment: 'jsdom'`, `setupFiles: ['./src/setupTests.js']`, `globals: true`
    - _Requirements: 9.3_

  - [ ] 1.3 Configure Tailwind CSS with design tokens and dark mode
    - Set `darkMode: 'class'` in `tailwind.config.js`
    - Extend `theme.colors` to map CSS custom property tokens: `bg`, `surface`, `primary`, `accent`, `text`, `muted`
    - Extend `theme.fontFamily`: `display: ['Fraunces', 'serif']`, `body: ['DM Sans', 'sans-serif']`, `mono: ['JetBrains Mono', 'monospace']`
    - Add `content` glob covering `./src/**/*.{js,jsx}`
    - _Requirements: 8.1, 8.2_

  - [ ] 1.4 Create `src/styles/index.css` with CSS custom properties, font imports, and keyframe animations
    - Add Tailwind directives (`@tailwind base/components/utilities`)
    - Import font weight files from `@fontsource/fraunces`, `@fontsource-variable/dm-sans`, `@fontsource/jetbrains-mono`
    - Define `:root` light-mode color tokens and `.dark` dark-mode overrides (per design color system)
    - Add `section-enter` / `is-visible` fade-up transition classes
    - Add `fadeUp` keyframe and `.hero-name`, `.hero-title`, `.hero-biz`, `.hero-photo`, `.hero-cta` stagger classes
    - Add `.skill-badge:hover`, `.project-card:hover`, `.cta-button:hover` animation rules
    - Add nav frosted-glass rule (`backdrop-filter: blur(12px)`) in light and dark variants
    - _Requirements: 2.4, 8.1_

  - [ ] 1.5 Add flicker-free dark mode inline script to `index.html`
    - Insert an IIFE `<script>` tag in `<head>` before any CSS link that reads `localStorage.getItem('portfolio-theme-v1')`, checks `prefers-color-scheme: dark`, and adds the `dark` class to `<html>` synchronously
    - Wrap in try/catch so storage errors default silently to light mode
    - _Requirements: 2.5, 2.7_

  - [ ] 1.6 Add `deploy` script and create `src/setupTests.js`
    - Add `"deploy": "vite build && gh-pages -d dist"` to `package.json` scripts
    - Create `src/setupTests.js` importing `@testing-library/jest-dom`
    - _Requirements: 9.5_

- [ ] 2. Implement custom hooks
  - [ ] 2.1 Implement `useDarkMode` hook
    - Create `src/hooks/useDarkMode.js`
    - Use lazy `useState` initializer: read `'portfolio-theme-v1'` from `localStorage`; fall back to `window.matchMedia('(prefers-color-scheme: dark)').matches`; default to `false` if `matchMedia` unavailable
    - `toggleDark` flips boolean state and writes `'light'`/`'dark'` to `localStorage` under key `'portfolio-theme-v1'`
    - Wrap `localStorage` access in try/catch per error-handling spec
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Write property tests for `useDarkMode` (Properties 2 and 4)
    - Create `src/__tests__/property/darkMode.property.test.js`
    - **Property 2: Dark Mode Toggle Idempotence** — `fc.boolean()` generates initial state; assert two consecutive toggles restore original value
    - **Property 4: localStorage Theme Round-Trip** — `fc.constantFrom('light', 'dark')` writes to `'portfolio-theme-v1'` and reads back; assert identical value returned. Also test edge inputs (empty string, null) assert graceful fallback
    - Tag each test: `Feature: personal-portfolio-website, Property 2/4: ...`
    - `numRuns: 100` on all `fc.assert` calls
    - _Requirements: 2.2, 2.3, 2.6_

  - [ ] 2.3 Implement `useActiveSection` hook
    - Create `src/hooks/useActiveSection.js`
    - Accept `sectionIds: string[]`; return `activeSection: string`
    - Create a single `IntersectionObserver` in a `useRef` (not recreated per render); observe all `document.getElementById(id)` elements
    - On intersection change, update state only when the active section actually changes (compare with current ref value)
    - Apply `rootMargin` to account for the fixed nav height (e.g., `-64px 0px 0px 0px`)
    - _Requirements: 1.8_

  - [ ]* 2.4 Write property test for active section exclusivity (Property 1)
    - Create `src/__tests__/property/activeSection.property.test.js`
    - Extract the pure section-selection logic into a testable helper function
    - **Property 1: Active Section Exclusivity** — generate arrays of `{id, top, bottom}` bounding rects and random `scrollY` with `fc.array` + `fc.record` + `fc.integer`; assert helper returns exactly one section ID
    - Tag: `Feature: personal-portfolio-website, Property 1: active section exclusivity`
    - `numRuns: 100`
    - _Requirements: 1.8_

- [ ] 3. Create shared data files and UI primitives
  - [ ] 3.1 Create module-level data files
    - Create `src/data/skills.js` exporting `SKILLS` constant (two categories, 12 items total, matching requirement 5.3 exactly)
    - Create `src/data/projects.js` exporting `PROJECTS` constant (3 placeholder entries with `title`, `description`, `tags`, `comingSoon: true`)
    - Create `src/components/Nav/navLinks.js` exporting `NAV_LINKS` array (5 entries: Home/About/Skills/Projects/Contact with hash hrefs)
    - _Requirements: 1.2, 5.2, 5.3, 6.2, 6.3_

  - [ ] 3.2 Implement `SectionWrapper` component
    - Create `src/components/ui/SectionWrapper.jsx`
    - Props: `{ id: string, children: ReactNode, className?: string }`
    - Attach `IntersectionObserver` to the root `<section>` element via `useRef`; add `is-visible` CSS class when it enters viewport
    - Apply `scroll-margin-top` equivalent via Tailwind class (`scroll-mt-16`) for nav offset
    - _Requirements: 1.3, 8.2_

  - [ ] 3.3 Implement `SkillBadge` component
    - Create `src/components/ui/SkillBadge.jsx`
    - Props: `{ name: string, mono?: boolean }`
    - Render badge using `font-mono` class when `mono=true`; apply `skill-badge` CSS class for hover scale animation
    - _Requirements: 5.2_

  - [ ] 3.4 Implement `ProjectCard` component
    - Create `src/components/ui/ProjectCard.jsx`
    - Props: `{ title: string, description: string, tags: string[], comingSoon?: boolean }`
    - Render gradient top border (accent color), "Coming Soon" badge when `comingSoon` is true, and tag list
    - Apply `project-card` CSS class for hover lift animation
    - _Requirements: 6.3, 6.4_

  - [ ]* 3.5 Write unit tests for `SkillBadge` and `ProjectCard`
    - Create `src/__tests__/unit/SkillBadge.test.jsx` — verify badge renders skill name; verify `font-mono` class present when `mono=true`
    - Create `src/__tests__/unit/ProjectCard.test.jsx` — verify title, description, tags, and "Coming Soon" text render in DOM
    - _Requirements: 5.2, 6.3, 6.4_

  - [ ] 3.6 Implement `DarkModeToggle` component
    - Create `src/components/ui/DarkModeToggle.jsx`
    - Props: `{ isDark: boolean, onToggle: () => void }`
    - Import `Sun` and `Moon` from `lucide-react`; render `Moon` icon when `isDark` is true, `Sun` icon otherwise
    - Add `aria-label="Toggle dark mode"` and smooth rotate CSS transition on icon swap
    - _Requirements: 2.1_

  - [ ]* 3.7 Write unit test for `DarkModeToggle`
    - Create `src/__tests__/unit/DarkModeToggle.test.jsx`
    - Verify toggle button renders with correct `aria-label`; verify clicking calls `onToggle`
    - _Requirements: 2.1_

- [ ] 4. Implement Nav component
  - [ ] 4.1 Implement `Nav` component
    - Create `src/components/Nav/Nav.jsx`
    - Props: `{ isDark: boolean, toggleDark: () => void, activeSection: string }`
    - Render fixed nav with frosted-glass classes; map over `NAV_LINKS` from `navLinks.js` (never re-created inside component)
    - Internal `isMenuOpen` state; import `Menu` and `X` from `lucide-react` for hamburger toggle
    - `handleLinkClick` (wrapped in `useCallback`): calls `document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth', block: 'start' })` with null-check guard; closes mobile menu
    - `handleToggle` (wrapped in `useCallback`): toggles `isMenuOpen`
    - Highlight active link by comparing `href` against `#${activeSection}`
    - Apply `aria-label="Open navigation menu"` / `aria-expanded` on hamburger button
    - Collapse links at mobile breakpoint (`md:flex hidden`); show full links at `md` and above
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 4.2 Write unit tests for Nav
    - Create `src/__tests__/unit/Nav.test.jsx`
    - Verify all 5 link labels render in the DOM
    - Verify hamburger icon renders on mobile; verify clicking hamburger opens/closes menu
    - Verify `DarkModeToggle` is rendered within Nav
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ] 5. Implement content sections
  - [ ] 5.1 Implement `Hero` section (eager-loaded)
    - Create `src/components/sections/Hero.jsx`
    - Render `h1` with "Kent Schaeffer" (`.hero-name` stagger class), subtitle "Founder & Principal Engineer" (`.hero-title`), business name "Pro Services With A Little Aloha" (`.hero-biz`)
    - Render circular `<img>` placeholder with `alt="Profile photo of Kent Schaeffer"` (`.hero-photo`)
    - Render "Get In Touch" CTA button that calls `scrollIntoView` on `#contact` section (`.hero-cta`)
    - Apply stagger animation classes per design (`animation-delay` 0ms–600ms)
    - Apply responsive two-column layout at `md` breakpoint
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.2 Write unit tests for Hero
    - Create `src/__tests__/unit/Hero.test.jsx`
    - Verify `h1` contains "Kent Schaeffer"
    - Verify subtitle "Founder & Principal Engineer" is present
    - Verify `img` has correct `alt` attribute
    - Verify "Get In Touch" button is present and has correct accessible role
    - _Requirements: 3.1, 3.2, 3.4_

  - [ ] 5.3 Implement `About` section (lazy-loaded)
    - Create `src/components/sections/About.jsx`
    - Wrap content in `SectionWrapper` with `id="about"`
    - Render `h2` "About Me", bio text per requirement 4.2, career tenure callout (25+ years), LLC purpose per requirement 4.4
    - Apply single-column mobile layout; two-column with decorative vertical rule at `md` breakpoint
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 5.4 Implement `Skills` section (lazy-loaded)
    - Create `src/components/sections/Skills.jsx`
    - Wrap content in `SectionWrapper` with `id="skills"`
    - Import `SKILLS` from `src/data/skills.js`; render `h2` "Skills & Technologies"
    - Map over categories; for each category render a heading and a grid of `<SkillBadge>` components
    - Apply responsive grid: `grid-cols-1` below 320px, `grid-cols-2` at `xs` (320px+), `grid-cols-3` at `md`, `grid-cols-4` at `lg`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 5.5 Write property tests for Skills rendering (Property 5)
    - Create `src/__tests__/property/skills.property.test.jsx`
    - **Property 5: Skills Rendering Completeness and Category Partitioning** — use `fc.shuffledSubarray` / `fc.array` to generate permutations of skill assignments across the two categories; render `Skills.jsx` and assert every skill appears exactly once in the DOM and category groups are disjoint
    - Tag: `Feature: personal-portfolio-website, Property 5: skills completeness and category partitioning`
    - `numRuns: 100`
    - _Requirements: 5.2, 5.3_

  - [ ] 5.6 Implement `Projects` section (lazy-loaded)
    - Create `src/components/sections/Projects.jsx`
    - Wrap content in `SectionWrapper` with `id="projects"`
    - Import `PROJECTS` from `src/data/projects.js`; render `h2` "Projects"
    - Map over `PROJECTS` and render a `<ProjectCard>` per entry
    - Apply responsive grid: single column at mobile, `grid-cols-2` at `md`, `grid-cols-3` at `lg`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 5.7 Write property tests for Projects rendering (Properties 6 and 7)
    - Create `src/__tests__/property/projects.property.test.jsx`
    - **Property 6: Project Card Count Matches Data** — `fc.array(projectArb, { minLength: 1, maxLength: 10 })` generates project arrays; render `Projects.jsx` with override data and assert exactly N cards render
    - **Property 7: Project Card Renders All Required Fields** — `fc.record({ title: fc.string({minLength:1}), description: fc.string({minLength:1}), tags: fc.array(fc.string({minLength:1}), {minLength:1,maxLength:5}), comingSoon: fc.constant(true) })` generates project objects; render `ProjectCard` and assert title, description, all tags, and "Coming Soon" are visible in DOM
    - Tag each: `Feature: personal-portfolio-website, Property 6/7: ...`
    - `numRuns: 100`
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ] 5.8 Implement `Contact` section (lazy-loaded)
    - Create `src/components/sections/Contact.jsx`
    - Wrap content in `SectionWrapper` with `id="contact"`
    - Render `h2` "Get In Touch", invitation message (≤ 150 characters)
    - Import `Github` and `Linkedin` from `lucide-react`; render GitHub and LinkedIn links as `<a href="..." target="_blank" rel="noopener noreferrer">` with icon + label
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.9 Write unit tests for Contact and About
    - Create `src/__tests__/unit/Contact.test.jsx`
      - Verify GitHub and LinkedIn links have `target="_blank"` and `rel="noopener noreferrer"`
      - Verify links render as absolute HTTPS URLs
    - Create `src/__tests__/unit/About.test.jsx`
      - Verify `h2` "About Me" is present
      - Verify bio text and "25+ years" tenure text are rendered
    - _Requirements: 4.1, 4.2, 4.3, 7.2, 7.3, 7.5_

- [ ] 6. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement `App.jsx` and wire everything together
  - [ ] 7.1 Implement `App.jsx` — root component and section wiring
    - Create `src/App.jsx`
    - Call `useDarkMode()` and apply/remove `dark` class on `document.documentElement` in a `useEffect` keyed on `isDark`
    - Call `useActiveSection(['home', 'about', 'skills', 'projects', 'contact'])` and pass `activeSection` to `Nav`
    - Render `<Nav isDark toggleDark activeSection>` eagerly
    - Render `<Hero>` eagerly wrapped in `SectionWrapper id="home"`
    - `React.lazy()` import each of About, Skills, Projects, Contact; wrap each in its own `<Suspense fallback={<div aria-busy="true" />}>`
    - On mount, read `window.location.hash` and call `scrollIntoView` on the matching section element (null-checked)
    - _Requirements: 1.1, 1.8, 2.1, 2.2, 2.3, 9.1, 9.4_

  - [ ]* 7.2 Write integration tests for App
    - Create `src/__tests__/unit/App.test.jsx` (integration-level)
    - Verify `App` renders Nav + five section wrappers in the DOM
    - Verify dark class is applied to `<html>` when `useDarkMode` returns `isDark: true`
    - _Requirements: 1.1, 2.2, 2.3_

- [ ] 8. Add WCAG contrast property test and smoke tests
  - [ ] 8.1 Write WCAG AA contrast property test (Property 3)
    - Create `src/__tests__/property/contrast.property.test.js`
    - Define the relative luminance and contrast ratio helper functions (W3C WCAG 2.1 formula)
    - Define all light-mode and dark-mode `(text, background)` token pairs from the design document
    - **Property 3: WCAG AA Contrast in Both Modes** — `fc.constantFrom(...colorPairs)` generates each pair; assert contrast ratio ≥ 4.5:1 for normal-text pairs and ≥ 3:1 for large-text pairs
    - Tag: `Feature: personal-portfolio-website, Property 3: WCAG AA contrast in both modes`
    - `numRuns: 100`
    - _Requirements: 2.4_

  - [ ] 8.2 Write smoke tests for build configuration
    - Create `src/__tests__/smoke/config.test.js`
    - Dynamically import `vite.config.js` and assert `base` property is a non-root subdirectory string (starts with `/`, is not `/`)
    - Read `package.json` and assert `scripts.deploy` exists and contains `gh-pages`
    - _Requirements: 9.3, 9.5_

- [ ] 9. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build.
- Each task references specific requirements for traceability.
- Property tests (Properties 1–7) validate universal correctness invariants; unit tests validate concrete examples and edge cases. Both are complementary.
- Checkpoints at tasks 6 and 9 ensure incremental validation before wiring and after completion.
- Fonts are fully self-hosted via `@fontsource` npm packages — no Google Fonts or external CDN URLs anywhere in the codebase.
- All icons (`Sun`, `Moon`, `Menu`, `X`, `Github`, `Linkedin`) come from `lucide-react` (ISC license) — tree-shaken by Vite to include only what is imported.
- The `base: '/personal-portfolio-website/'` Vite config option is required for GitHub Pages hash navigation to resolve correctly.
- Lazy-loaded sections (About, Skills, Projects, Contact) each have their own `<Suspense>` boundary so a single failure doesn't unmount the whole page.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["2.1", "2.3", "3.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "3.2", "3.3", "3.4", "3.6"] },
    { "id": 4, "tasks": ["3.5", "3.7", "4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1", "5.3", "5.4", "5.6", "5.8"] },
    { "id": 6, "tasks": ["5.2", "5.5", "5.7", "5.9"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "8.1", "8.2"] }
  ]
}
```
