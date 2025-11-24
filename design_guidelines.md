# Design Guidelines: Wayback Forensic Scraper Web Application

## Design Approach
**Terminal-Inspired Security Tool Interface** - Drawing from hacker/CTF tool aesthetics (inspired by tools like Burp Suite, Wireshark, and terminal emulators). This isn't a marketing site; it's a functional security research tool that should feel professional, technical, and purpose-built.

## Typography System
- **Monospace Primary**: JetBrains Mono or Fira Code (via Google Fonts)
  - Body text: 14px (text-sm)
  - Input fields: 14px (text-sm) 
  - Code/results: 13px (text-xs)
  - Section headers: 18px semibold (text-lg font-semibold)
  - Main title: 24px bold (text-2xl font-bold)
- **Sans-serif Secondary**: Inter for UI labels/buttons
  - Button text: 14px medium (text-sm font-medium)
  - Helper text: 12px (text-xs)

## Layout System
**Spacing**: Use Tailwind units of 2, 4, 6, and 8 consistently (p-4, gap-6, mb-8, etc.)
**Container**: max-w-4xl centered with px-6 on mobile, px-8 on desktop
**Grid**: Single column layout - no multi-column needed for this tool-focused interface

## Component Structure

### Header Section
- Application title with monospace font
- Tagline: "CTF & Security Research Tool"
- Subtle border-b separator

### Main Form Card
Prominent centered card containing:
- **Domain Input**: Full-width text input with placeholder "example.com"
- **Year Filter**: Optional numeric input (4 digits) with placeholder "2022"
- **Keyword Search**: Text input with placeholder "ctf{, password, API_KEY"
- **Scan Button**: Full-width primary button "Start Forensic Scan"
- Use vertical spacing of mb-4 between form fields
- Input fields have border, rounded corners (rounded-md), and focus states

### Use Case Reference Panel
Below form, display quick-reference table:
- 4 rows: Data Leaks, Malware, Defacement, Hidden Info
- 2 columns: Use Case | Suggested Keywords
- Keywords shown in monospace, separated by commas
- Border around entire panel with subtle grid lines

### Progress Section (Shown during scan)
- Current status text: "Scanning snapshot: [timestamp]..."
- Progress indicator (simple animated dots or spinner)
- Snapshot count: "Analyzing 45/100 snapshots"
- Compact design, centered below form

### Results Display
List-based layout showing each match:
- **Match Card** per finding:
  - Snapshot timestamp badge
  - Archive URL (clickable link, monospace, truncated with ellipsis)
  - Match type label: "Found in TEXT" / "Found in JS" / "Found in COMMENT"
  - Code snippet in bordered box with monospace font, slight padding
  - Vertical spacing between cards: space-y-6
- "Download Report" button at bottom of results

### Footer
Minimal footer with:
- Tool description: "Wayback Machine forensic scanner for security research"
- Attribution/disclaimer text

## Interaction Patterns
- Form validation: Show inline errors below invalid fields
- Disabled states: Form submits only when domain and keyword filled
- Loading states: Disable form during scan, show progress section
- Results: Fade in smoothly, scroll to results automatically
- Links: Underline on hover, external link icon for archive URLs

## Accessibility
- All inputs have labels (can be visually hidden if using placeholder pattern)
- Form fields include aria-labels
- Focus indicators on all interactive elements
- Keyboard navigation support throughout

## Images
**No hero image needed** - This is a functional tool, not a marketing page. The interface should feel like a professional security application, similar to Wireshark or Burp Suite's clean, focused layouts.

## Component Hierarchy
1. Header (minimal branding)
2. Main form card (primary focus, elevated appearance)
3. Use case reference panel (educational context)
4. Progress section (conditional visibility)
5. Results list (dynamic content area)
6. Footer (minimal context)

## Visual Treatment
- Card-based design with subtle elevation
- Bordered inputs and containers (not heavy shadows)
- Monospace font for technical content (URLs, code snippets, timestamps)
- Terminal-like aesthetic: structured, grid-aligned, information-dense
- Code blocks with subtle background differentiation
- Consistent border-radius: rounded-md (6px) for all UI elements