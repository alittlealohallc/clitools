# Requirements Document

## Introduction

This feature is a modern, responsive personal portfolio website for Kent Schaeffer — Founder & Principal Engineer at Pro Services With A Little Aloha. The site showcases Kent's 25+ years of IT experience, skills, and projects to attract small-business clients and professional connections. It is a static React + Tailwind CSS frontend deployable to GitHub Pages, with no backend dependency.

## Glossary

- **Portfolio_Site**: The React + Tailwind CSS single-page application being built
- **Hero_Section**: The top-of-page banner displaying Kent's name, title, and photo placeholder
- **About_Section**: The section containing Kent's personal bio
- **Skills_Section**: The section displaying Kent's technical and professional skill set with visual indicators
- **Projects_Section**: The section displaying placeholder project cards for future real content
- **Contact_Section**: The footer-area section with external profile links (GitHub, LinkedIn)
- **Nav**: The fixed navigation bar enabling smooth-scroll links to each section
- **Dark_Mode**: An alternate color scheme using dark backgrounds and light text, toggled by the user
- **Visitor**: Any person viewing the Portfolio_Site in a web browser
- **Owner**: Kent Schaeffer, the person whose information is displayed

---

## Requirements

### Requirement 1: Navigation

**User Story:** As a Visitor, I want a navigation bar with section links, so that I can jump to any section of the page without manually scrolling.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL render a Nav bar fixed to the top of the viewport on all screen sizes.
2. THE Nav SHALL contain links labeled "Home", "About", "Skills", "Projects", and "Contact".
3. WHEN a Visitor clicks a Nav link, THE Portfolio_Site SHALL smooth-scroll to the corresponding section within 300–600ms, offset by the fixed Nav bar height so the section heading is not obscured.
4. WHEN the page is viewed on a mobile screen (width < 768px), THE Nav SHALL collapse into a hamburger menu icon, hiding all section links.
5. WHEN a Visitor taps the hamburger icon, THE Nav SHALL expand to show the full link list as a dropdown or drawer.
6. WHEN a Visitor clicks a link in the expanded mobile Nav, THE Nav SHALL close before the scroll animation begins.
7. WHEN a Visitor clicks a Nav link while the mobile Nav is already collapsed, THE Portfolio_Site SHALL navigate to the target section and leave the Nav collapsed state unchanged.
8. WHEN a Visitor scrolls the page, THE Nav SHALL highlight the link corresponding to the section currently in the viewport.

---

### Requirement 2: Dark Mode Toggle

**User Story:** As a Visitor, I want to switch between light and dark color schemes, so that I can view the site comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL display a dark-mode toggle control in the Nav on all screen sizes.
2. WHEN a Visitor activates the dark-mode toggle, THE Portfolio_Site SHALL apply a dark color scheme to all sections.
3. WHEN a Visitor deactivates the dark-mode toggle, THE Portfolio_Site SHALL restore the light color scheme to all sections.
4. WHILE dark mode is active, THE Portfolio_Site SHALL maintain WCAG AA color contrast across all sections: a minimum 4.5:1 ratio for normal text (below 18pt) and a minimum 3:1 ratio for large text (18pt or 14pt bold and above).
5. WHEN a Visitor has not previously toggled dark mode, THE Portfolio_Site SHALL default to the Visitor's operating-system color-scheme preference (`prefers-color-scheme`) on initial page load.
6. WHEN a Visitor has previously manually toggled dark mode and then closed and reopened the browser, THE Portfolio_Site SHALL restore the Visitor's last manually-selected color scheme from `localStorage`, overriding the OS preference.
7. IF the `localStorage` preference value cannot be read on page load (e.g., storage is unavailable or the value is corrupt), THE Portfolio_Site SHALL fall back to the OS `prefers-color-scheme` preference as defined in criterion 5.

---

### Requirement 3: Hero Section

**User Story:** As a Visitor, I want an eye-catching hero section, so that I immediately understand who Kent is and what he does.

#### Acceptance Criteria

1. THE Hero_Section SHALL display the Owner's full name "Kent Schaeffer" as the primary `h1` heading.
2. THE Hero_Section SHALL display the Owner's title "Founder & Principal Engineer" as a subtitle.
3. THE Hero_Section SHALL display the business name "Pro Services With A Little Aloha" as supporting text.
4. THE Hero_Section SHALL display a circular placeholder image element with a rendered size between 150×150px and 300×300px and a descriptive `alt` attribute (e.g., "Profile photo of Kent Schaeffer") that the Owner can replace with a real photo.
5. WHEN a Visitor clicks the primary call-to-action button labeled "Get In Touch", THE Portfolio_Site SHALL animated smooth-scroll to the Contact_Section.
6. WHEN the Portfolio_Site is viewed on a mobile screen (width < 768px), THE Hero_Section SHALL stack its content vertically in a single column.

---

### Requirement 4: About Me Section

**User Story:** As a Visitor, I want to read a personal bio, so that I can understand Kent's background and approach.

#### Acceptance Criteria

1. THE About_Section SHALL display the heading "About Me".
2. THE About_Section SHALL display the Owner's bio text: "I'm a distracted engineer with experience in software, systems, and network engineering (DDI)".
3. THE About_Section SHALL display a summary of the Owner's career tenure: 25+ years of IT experience serving various employers and projects.
4. THE About_Section SHALL describe the Owner's LLC purpose: serving small businesses.
5. WHEN the Portfolio_Site is viewed on a mobile screen (width < 768px), THE About_Section SHALL render its content in a single-column layout.

---

### Requirement 5: Skills Section

**User Story:** As a Visitor, I want to see a visual representation of Kent's skills, so that I can quickly assess his technical and professional capabilities.

#### Acceptance Criteria

1. THE Skills_Section SHALL display the heading "Skills & Technologies".
2. THE Skills_Section SHALL render each of the following skills as a distinct visual badge or card: DDI, Node.js, Perl, Shell Scripting, Customer Service, HTML/CSS, JavaScript, CLI Tools, Infoblox, Documentation, Confluence, and Visio.
3. THE Skills_Section SHALL group all 12 skills into exactly two named categories — "Technical Skills" (containing: DDI, Node.js, Perl, Shell Scripting, HTML/CSS, JavaScript, CLI Tools, Infoblox) and "Tools & Platforms" (containing: Customer Service, Documentation, Confluence, Visio) — with each skill appearing in exactly one category.
4. WHEN the Portfolio_Site is viewed on a mobile screen (width ≥ 320px and < 768px), THE Skills_Section SHALL display skill badges in a wrapping grid of at least 2 columns.
5. WHEN the Portfolio_Site is viewed on a screen with width below 320px, THE Skills_Section SHALL display skill badges in a single column for readability.
6. WHEN the Portfolio_Site is viewed on a tablet screen (width ≥ 768px and < 1024px), THE Skills_Section SHALL display skill badges in a wrapping grid of at least 3 columns.
7. WHEN the Portfolio_Site is viewed on a desktop screen (width ≥ 1024px), THE Skills_Section SHALL display skill badges in a grid of at least 4 columns.

---

### Requirement 6: Projects Section

**User Story:** As a Visitor, I want to browse Kent's projects, so that I can evaluate the quality and scope of his work.

#### Acceptance Criteria

1. THE Projects_Section SHALL display the heading "Projects".
2. THE Projects_Section SHALL render exactly 3 placeholder project cards.
3. EACH project card SHALL display a placeholder project title, a placeholder description of 1–2 sentences, and a placeholder technology tag list containing between 1 and 5 tags.
4. EACH project card SHALL display the visible text label "Coming Soon" to indicate it requires real content from the Owner.
5. WHEN the Portfolio_Site is viewed on a mobile screen (width < 768px), THE Projects_Section SHALL stack project cards in a single column.
6. WHEN the Portfolio_Site is viewed on a tablet screen (width ≥ 768px and < 1024px), THE Projects_Section SHALL display project cards in a 2-column grid.
7. WHEN the Portfolio_Site is viewed on a desktop screen (width ≥ 1024px), THE Projects_Section SHALL display project cards in a 3-column grid.

---

### Requirement 7: Contact Section

**User Story:** As a Visitor, I want to find Kent's professional profile links, so that I can connect with him on relevant platforms.

#### Acceptance Criteria

1. THE Contact_Section SHALL display the heading "Get In Touch".
2. THE Contact_Section SHALL display a GitHub profile link rendered as an absolute HTTPS URL, opening in a new browser tab with `rel="noopener noreferrer"` to prevent tab-napping.
3. THE Contact_Section SHALL display a LinkedIn profile link rendered as an absolute HTTPS URL, opening in a new browser tab with `rel="noopener noreferrer"` to prevent tab-napping.
4. THE Contact_Section SHALL display an invitation message of no more than 150 characters encouraging Visitors to reach out.
5. WHEN a Visitor clicks the GitHub or LinkedIn link, THE Portfolio_Site SHALL open the link target in a new tab without navigating away from the Portfolio_Site.

---

### Requirement 8: Mobile-First Responsive Layout

**User Story:** As a Visitor on any device, I want the site to render correctly on my screen size, so that I can read and navigate it comfortably.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL be designed mobile-first, with base styles targeting screens of width < 768px.
2. THE Portfolio_Site SHALL apply responsive breakpoints at 768px (tablet) and 1024px (desktop): at 768px, multi-column layouts and larger typography SHALL activate; at 1024px, maximum-width containers and desktop grid layouts SHALL activate.
3. THE Portfolio_Site SHALL not require horizontal scrolling on any standard viewport width of 320px or wider, and all body text SHALL remain at a minimum rendered font size of 12px at 320px width.
4. WHILE a Visitor resizes the browser window, THE Portfolio_Site SHALL reflow its layout without page reload.
5. WHEN the Portfolio_Site is rendered on a screen with width between 320px and 767px, THE Portfolio_Site SHALL apply a single-column mobile layout to the About_Section.

---

### Requirement 9: GitHub Pages Deployment

**User Story:** As the Owner, I want the site deployable to GitHub Pages, so that I can host it for free without a backend.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL be a static single-page application with no server-side rendering or backend API dependency.
2. WHERE THE Portfolio_Site is a static single-page application, THE Portfolio_Site SHALL be bootstrapped with Vite configured to output a static build to a `dist/` directory.
3. WHERE THE Portfolio_Site is a static single-page application, THE Portfolio_Site SHALL include a `vite.config.js` with a `base` option set to a non-root subdirectory path that matches the GitHub Pages deployment URL for the repository.
4. WHERE THE Portfolio_Site is a static single-page application, THE Portfolio_Site SHALL use hash-based in-page navigation (e.g., `/#about`, `/#skills`) so that GitHub Pages can serve all sections from the single `index.html` without a server-side URL rewrite.
5. WHERE THE Portfolio_Site is a static single-page application, THE Portfolio_Site SHALL include a `deploy` script in `package.json` using `gh-pages` to publish the `dist/` directory to the `gh-pages` branch.
