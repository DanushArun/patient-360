# Apple Human Interface Guidelines — Primary Source Extract

> **Extracted 22 Sept 2026** from Apple's live HIG JSON API.
> Base URL: `https://developer.apple.com/design/human-interface-guidelines/`
> JSON API pattern: `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/{page}.json`
> All content copyright Apple Inc. 2026. Quoted under fair use for development reference.

**Verification method:** Every claim below was fetched from Apple's own documentation JSON API. The HTML pages at developer.apple.com require JavaScript to render, but the underlying JSON is publicly accessible and contains the full structured content. Where I could not verify a claim from the live API, it is flagged as `[UNVERIFIED]`.

---

## 1. Design Principles (as currently published)

**Source:** `design-principles.json` — Page title: "Design principles"
**Last updated by Apple:** June 8, 2026 ("Reintroduced design principles.")
**Linked WWDC session:** WWDC 2026 Session 250 — "Principles of great design"

Apple's current design principles are **eight named principles**, NOT the older "Clarity, Deference, Depth" triad. The older triad does NOT appear on the live Design Principles page.

The eight principles, quoted verbatim:

| # | Principle | Tagline (bold, verbatim) | Description excerpt |
|---|-----------|--------------------------|---------------------|
| 1 | **Purpose** | "Make something meaningful." | "Design starts with intention. Identify what matters most to the people you're designing for." |
| 2 | **Agency** | "Let people do things their own way." | "An interface exists to help people accomplish their goals. Give them the freedom to act, keep them informed about what's happening, and make it easy to recover from mistakes." |
| 3 | **Responsibility** | "Act in people's best interest." | "Earn their trust by prioritizing safety and privacy, and being transparent about what your product does and why." |
| 4 | **Familiarity** | "Build on what people know." | "Drawing on concepts people already understand helps them feel immediately at home." |
| 5 | **Flexibility** | "Adapt to diverse contexts and needs." | "Be mindful of experiences other than yours, and try to support as many devices, types of interaction, and perspectives as possible." |
| 6 | **Simplicity** | "Be clear and direct." | "A well-designed experience removes the unnecessary, with every element earning its place." |
| 7 | **Craft** | "Care about every detail." | "Your design is a reflection of how much you care." |
| 8 | **Delight** | "Make it human." | "People remember how a product makes them feel." |

Sub-guidance under each principle includes:

**Purpose:** "Create value." / "Keep focused." / "Find new ways to solve the problem."
**Agency:** "Stay out of the way." / "Give people the freedom to explore." / "Help people recover from mistakes." — "Build forgiveness into your design, and make it easy."
**Responsibility:** "Be fully transparent about what your product does and why." / "Keep people's information safe."
**Familiarity:** "Use concepts that people know." / "Keep visuals and interactions consistent." / "Provide clear feedback."
**Flexibility:** "Design for everyone." / "Preserve a person's context." / "Consider a variety of input methods." / "Approach every platform with intention."
**Simplicity:** "Include just what's necessary." / "Be concise." / "Establish hierarchy."
**Craft:** "Quality sets the tone." / "Experiment and iterate." / "Maintain your craft." — "Shipping isn't the finish line."
**Delight:** "Identify the emotion you want to inspire." / "Create defining moments." / "Don't mistake delight for decoration." / "Consider the whole."

> **NOTE on "Clarity, Deference, Depth":** This older triad, associated with the iOS 7 era HIG, does NOT appear on the current live Design Principles page (verified June 8, 2026 update). Apple replaced it with the eight principles above. "Clarity, Deference, Depth" may still be referenced in some older platform-specific pages but is NOT Apple's current published top-level design philosophy.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/design-principles

---

## 2. Typography

**Source:** `typography.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/typography

### 2.1 System Fonts

Apple provides two typeface families:
- **San Francisco (SF):** Sans serif. Variants: SF Pro, SF Compact, SF Arabic, SF Armenian, SF Georgian, SF Hebrew, SF Mono. Rounded variants available.
- **New York (NY):** Serif. "Designed to work well by itself and alongside the SF fonts."

Both available as variable fonts. Download: https://developer.apple.com/fonts/

### 2.2 Platform Default and Minimum Type Sizes

| Platform | Default size | Minimum size |
|----------|-------------|--------------|
| iOS, iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| tvOS | 29 pt | 23 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |

### 2.3 iOS/iPadOS Dynamic Type Scale — Large (Default)

| Style | Weight | Size (pt) | Leading (pt) | Emphasized Weight |
|-------|--------|-----------|-------------|-------------------|
| Large Title | Regular | 34 | 41 | Bold |
| Title 1 | Regular | 28 | 34 | Bold |
| Title 2 | Regular | 22 | 28 | Bold |
| Title 3 | Regular | 20 | 25 | Semibold |
| Headline | Semibold | 17 | 22 | Semibold |
| Body | Regular | 17 | 22 | Semibold |
| Callout | Regular | 16 | 21 | Semibold |
| Subhead | Regular | 15 | 20 | Semibold |
| Footnote | Regular | 13 | 18 | Semibold |
| Caption 1 | Regular | 12 | 16 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

Seven size categories available: xSmall, Small, Medium, Large (default), xLarge, xxLarge, xxxLarge.
Five accessibility size categories: AX1, AX2, AX3, AX4, AX5.

### 2.4 macOS Built-in Text Styles

| Style | Weight | Size (pt) | Line Height (pt) | Emphasized Weight |
|-------|--------|-----------|------------------|-------------------|
| Large Title | Regular | 26 | 32 | Bold |
| Title 1 | Regular | 22 | 26 | Bold |
| Title 2 | Regular | 17 | 22 | Bold |
| Title 3 | Regular | 15 | 20 | Semibold |
| Headline | Bold | 13 | 16 | Heavy |
| Body | Regular | 13 | 16 | Semibold |
| Callout | Regular | 12 | 15 | Semibold |
| Subheadline | Regular | 11 | 14 | Semibold |
| Footnote | Regular | 10 | 13 | Semibold |
| Caption 1 | Regular | 10 | 13 | Medium |
| Caption 2 | Medium | 10 | 13 | Semibold |

### 2.5 tvOS Built-in Text Styles

| Style | Weight | Size (pt) | Leading (pt) | Emphasized Weight |
|-------|--------|-----------|-------------|-------------------|
| Title 1 | Medium | 76 | 96 | Bold |
| Title 2 | Medium | 57 | 66 | Bold |
| Title 3 | Medium | 48 | 56 | Bold |
| Headline | Medium | 38 | 46 | Bold |
| Subtitle 1 | Regular | 38 | 46 | Medium |
| Callout | Medium | 31 | 38 | Bold |
| Body | Medium | 29 | 36 | Bold |
| Caption 1 | Medium | 25 | 32 | Bold |
| Caption 2 | Medium | 23 | 30 | Bold |

### 2.6 Tracking Values (iOS/iPadOS/visionOS, excerpt)

| Size (pt) | Tracking (1/1000 em) | Tracking (pt) |
|-----------|---------------------|---------------|
| 6 | +41 | +0.24 |
| 10 | +12 | +0.12 |
| 12 | 0 | 0.0 |
| 13 | -6 | -0.08 |
| 17 | -26 | -0.43 |
| 19 | -24 | -0.45 |
| 22 | -12 | -0.26 |
| 24 | +3 | +0.07 |

### 2.7 Typography Best Practices (verbatim rules)

- **"Use font sizes that most people can read easily."**
- **"In general, avoid light font weights."** — "prefer Regular, Medium, Semibold, or Bold font weights, and avoid Ultralight, Thin, and Light font weights, which can be difficult to see, especially when text is small."
- **"Minimize the number of typefaces you use, even in a highly customized interface."**
- **"Make sure your app's layout adapts to all font sizes."** — "turn on Larger Accessibility Text Sizes in Settings > Accessibility > Display & Text Size > Larger Text, and confirm that your app remains comfortably readable."
- **"Keep text truncation to a minimum as font size increases."**
- **"Maintain a consistent information hierarchy regardless of the current font size."**

### 2.8 What Apple says NOT to do (Typography)

- Do NOT use Ultralight, Thin, or Light font weights for small text.
- Do NOT truncate text in scrollable regions unless users can open a separate view.
- Do NOT ignore Dynamic Type — "Apps that don't respond to this setting can be difficult or impossible to use."
- Do NOT use tight leading for three or more lines of text even when height is limited.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/typography

---

## 3. Color

**Source:** `color.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/color

### 3.1 Semantic Color System (iOS/iPadOS)

Apple defines semantic colors by purpose, NOT appearance:

| Semantic Color | Use for |
|---------------|---------|
| Label | Primary content text |
| Secondary label | Secondary content text |
| Tertiary label | Tertiary content text |
| Quaternary label | Quaternary content text |
| Placeholder text | Placeholder text in controls or text views |
| Separator | Thin divider, allows underlying content to show |
| Opaque separator | Divider, no underlying content visible |
| Link | Text that functions as a link |

System tint colors: Red, Orange, Yellow, Green, Mint, Teal, Cyan, Blue, Indigo, Purple, Pink, Brown.
System grays: Gray, Gray 2, Gray 3, Gray 4, Gray 5, Gray 6.

Each has four variants: Default (light), Default (dark), Increased contrast (light), Increased contrast (dark).

> **Note:** The actual RGB hex values are delivered as image swatches in the JSON, not as text. For precise values, use the APIs (`UIColor`, `SwiftUI.Color`) or download Apple's design resources.

### 3.2 Contrast Ratios

From the **Dark Mode** page (verbatim):
> "At a minimum, make sure the contrast ratio between colors is no lower than **4.5:1**. For custom foreground and background colors, strive for a contrast ratio of **7:1**, especially in small text."

From the **Accessibility** page (WCAG-based table):

| Text size | Text weight | Minimum contrast ratio |
|-----------|------------|----------------------|
| Up to 17 pt | All | **4.5:1** |
| 18 pt+ | All | **3:1** |
| All sizes | Bold | **3:1** |

Apple states: "Use standard contrast calculators to ensure your UI meets acceptable levels. Accessibility Inspector uses the following values from **WCAG Level AA** as guidance."

### 3.3 Color Best Practices (verbatim rules)

- **"Avoid using the same color to mean different things."**
- **"Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information."** — "provide the same information in alternative ways so people with color blindness or other visual disabilities can understand it."
- **"Avoid hard-coding system color values in your app."** — "The actual color values may fluctuate from release to release."
- **"Avoid redefining the semantic meanings of dynamic system colors."**
- **"Make sure all your app's colors work well in light, dark, and increased contrast contexts."**
- **"Even if your app ships in a single appearance mode, provide both light and dark colors to support Liquid Glass adaptivity."**

### 3.4 Liquid Glass Color

- **"Apply color sparingly to the Liquid Glass material."**
- **"To emphasize primary actions, apply color to the background rather than to symbols or text."** — e.g., system applies accent color to Done button background.
- **"Refrain from adding color to the background of multiple controls."**
- **"Avoid using similar colors in control labels if your app has a colorful background."**

### 3.5 What Apple says NOT to do (Color)

- Do NOT rely on color alone to convey information (use shapes, icons, text too).
- Do NOT hard-code system color values.
- Do NOT redefine semantic meanings of system colors.
- Do NOT use the same color for both interactive and non-interactive elements.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/color

---

## 4. Accessibility

**Source:** `accessibility.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/accessibility

### 4.1 Minimum Tap/Hit Target Sizes

| Platform | Default control size | Minimum control size |
|----------|--------------------|--------------------|
| iOS, iPadOS | **44x44 pt** | **28x28 pt** |
| macOS | **28x28 pt** | **20x20 pt** |
| tvOS | **66x66 pt** | **56x56 pt** |
| visionOS | **60x60 pt** | **28x28 pt** |
| watchOS | **44x44 pt** | **28x28 pt** |

### 4.2 Status Without Color

Apple states (verbatim): **"Convey information with more than color alone."** — "Some people have trouble differentiating between certain colors and shades. For example, people who are color blind may have particular difficulty with pairings such as red-green and blue-orange. Offer visual indicators, like distinct shapes or icons, in addition to color to help people perceive differences in function and changes in state."

"Consider allowing people to customize color schemes such as chart colors or game characters so they can personalize your interface in a way that's comfortable for them."

### 4.3 Text Size Guidance

- **"Support larger text sizes."** — "give people the option to enlarge text by at least **200 percent** (or 140 percent in watchOS apps)."
- **"Use recommended defaults for custom type sizes."** (See type size table above.)
- **"Bear in mind that font weight can also impact how easy text is to read."**

### 4.4 Hearing

- Support captions, subtitles, audio descriptions, and transcripts.
- **"It's important that dialogue and crucial information about your app or game isn't communicated through audio alone."**

### 4.5 Interaction

- Support VoiceOver, Switch Control, Full Keyboard Access, Pointer Control, Voice Control.
- **"Make sure every interactive element is accessible."** — "Each interactive element must include an accessibility label, and each view should include localized strings."
- Design simple, consistent navigation paths.
- Pair common gestures with alternative interaction methods.

### 4.6 Motion & Reduce Motion

- **"Check whether the Reduce Motion accessibility setting is on, and respond appropriately."**
- Provide alternatives to motion-based interactions.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/accessibility

---

## 5. Dark Mode

**Source:** `dark-mode.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/dark-mode

### 5.1 Best Practices (verbatim)

- **"Avoid offering an app-specific appearance setting."** — "An app-specific appearance mode option creates more work for people."
- **"Ensure that your app looks good in both appearance modes."**
- **"Test your content to make sure that it remains comfortably legible in both appearance modes."**

### 5.2 Dark Mode Colors

- Two sets of background colors in Dark Mode (iOS/iPadOS): **base** (dimmer, recedes) and **elevated** (brighter, advances).
- **"Embrace colors that adapt to the current appearance."** Use semantic colors.
- Contrast minimum: **4.5:1**, strive for **7:1** especially in small text.
- **"Soften the color of white backgrounds."** — "If you display a content image that includes a white background, consider slightly darkening the image."

### 5.3 Text in Dark Mode

- System uses vibrancy and increased contrast for legibility.
- **"Use the system-provided label colors for labels."** — primary, secondary, tertiary, quaternary adapt automatically.

### 5.4 macOS Desktop Tinting

- When graphite accent color is chosen, window backgrounds pick up color from desktop picture.
- **"Include some transparency in custom component backgrounds when appropriate."** — Only in neutral state (no color).

### 5.5 What Apple says NOT to do (Dark Mode)

- Do NOT offer an app-specific appearance toggle (respect system setting).
- Do NOT use hard-coded color values that don't adapt.
- Do NOT use custom backgrounds that prevent system-provided visual distinctions between base/elevated.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/dark-mode

---

## 6. Layout

**Source:** `layout.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/layout

### 6.1 Visual Hierarchy

- **"Order content by relative importance."** — "place the most important items near the top and leading side."
- **"Align elements to make them easier to scan, and use indentation to convey hierarchy."**
- **"Group related items to clearly express related information or functions."** — "use negative space, container shapes, or separator lines."

### 6.2 Progressive Disclosure (verbatim)

> **"Use progressive disclosure to make layouts cleaner and easier to interact with."** An interface with too much content and too many choices makes it harder to find information quickly, and harder to understand the choices that are available. Use disclosure triangles, menus, or nested views to reduce how much content to initially display; or use scrollable sections to showcase additional content, which is particularly useful for media-focused apps like those for video, music, or books.

### 6.3 Safe Areas

- A *safe area* defines the area within a window not covered by hardware features or system UI.
- **tvOS:** "Inset primary content **60 points from the top and bottom** of the screen, and **80 points from the sides**."

### 6.4 Adaptability Rules

- **"Design a layout that adapts gracefully and consistently."**
- **"Be prepared for text-size changes."** — Support Dynamic Type.
- Handle: regular/compact size classes, device sizes, orientations, Dynamic Island, Display Zoom, resizable windows, locale/RTL.
- **"Preview your app on multiple devices, using different size classes, localizations, and text sizes."**

### 6.5 Liquid Glass Layer Separation

- **"Differentiate controls from content."** — Use Liquid Glass material for controls, scroll edge effects to elevate controls above content.
- Extend full-screen background content underneath sidebars, toolbars, and tab bars.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/layout

---

## 7. Materials & Liquid Glass

**Source:** `materials.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/materials
**Last updated by Apple:** mentions Liquid Glass guidance added September 9, 2025.

### 7.1 Liquid Glass

Liquid Glass is a **2025+ design language** introduced at WWDC 2025 (Session 219: "Meet Liquid Glass"). It is a dynamic material that:
- Forms a "distinct functional layer for controls and navigation elements — like tab bars and sidebars — that floats above the content layer"
- "Allows content to scroll and peek through from beneath"
- Has **two variants**: `regular` (blurs background for legibility) and `clear` (highly translucent, for media backgrounds)

#### Best Practices (verbatim):

- **"Don't use Liquid Glass in the content layer."** — Exception: transient interactive elements like sliders and toggles.
- **"Use Liquid Glass effects sparingly."** — "Limit these effects to the most important functional elements in your app."
- **"Only use clear Liquid Glass for components that appear over visually rich backgrounds."**

#### Dimming guidance:
- If underlying content is bright: add a dark dimming layer of **35% opacity**.
- If underlying content is sufficiently dark: no dimming needed.

### 7.2 Standard Materials (iOS/iPadOS)

Four standard materials for the content layer: **ultra-thin, thin, regular (default), and thick**.

### 7.3 Material Rules

- **"Choose materials and effects based on semantic meaning and recommended usage."** — Don't select based on apparent color.
- **"Help ensure legibility by using vibrant colors on top of materials."**
- Thicker materials = more opaque = better contrast for text. Thinner = more translucent = context retention.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/materials

---

## 8. Motion

**Source:** `motion.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/motion

### 8.1 Best Practices (verbatim)

- **"Add motion purposefully, supporting the experience without overshadowing it."** — "Don't add motion for the sake of adding motion."
- **"Make motion optional."** — "avoid using it as the only way to communicate important information."
- **"Aim for brevity and precision in feedback animations."**
- **"In apps, generally avoid adding motion to UI interactions that occur frequently."**
- **"Let people cancel motion."** — "don't make people wait for an animation to complete."

### 8.2 Specific Numbers

- Games: maintain **30 to 60 fps** for smooth experience.
- visionOS: avoid oscillation near **0.2 Hz** frequency (causes discomfort).
- watchOS: all layout/appearance animations include **built-in easing** (start and end) — cannot be turned off.

### 8.3 What Apple says NOT to do (Motion)

- Do NOT add gratuitous or excessive animation.
- Do NOT use motion as the sole way to communicate information.
- Do NOT display sustained oscillating objects, especially near 0.2 Hz.
- Do NOT show motion at edges of field of view in visionOS.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/motion

---

## 9. Writing

**Source:** `writing.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/writing

### 9.1 Best Practices (verbatim)

- **"Determine your app's voice."** — Create a list of common terms for consistency.
- **"Match your tone to the context."**
- **"Be clear."** — "If you can use fewer words, do so."
- **"Write for everyone."** — "Choose simple, plain language and write with accessibility and localization in mind, avoiding jargon and gendered terminology."
- **"Be action oriented."** — "When labeling buttons and links, it's almost always best to use a verb."
- **"Use possessive pronouns sparingly."** — "'Favorites' conveys the same message as 'Your Favorites'." Avoid "we" — "particularly problematic in error messages."
- **"Write clear error messages."** — "display it as close to the problem as possible, avoid blame, and be clear about what someone can do to fix it." — "Interjections like 'oops!' or 'uh-oh' are typically unnecessary."

### 9.2 What Apple says NOT to do (Writing)

- Do NOT use "Click here" — use descriptive words like "Learn more about UX Writing."
- Do NOT use "we" in error messages — "'We're having trouble loading this content.' → 'Unable to load content'"
- Do NOT use "oops!" or "uh-oh" in error messages.
- Do NOT use robotic error messages with no helpful info like "Invalid name."

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/writing

---

## 10. Icons

**Source:** `icons.json` (redirects to broader Icons page covering SF Symbols, app icons, custom symbols)
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/icons

Key guidance:
- **"Use SF Symbols wherever possible."**
- **"Always refer to a symbol by its meaning, not its appearance."** — e.g., use heart for "favorites," not heart.fill.
- **"If you create a custom symbol, make sure it's legible at small sizes."**
- Avoid combining two symbols to create a new concept — "prefer a single symbol."

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/icons

---

## 11. Right to Left

**Source:** `right-to-left.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/right-to-left

Key guidance:
- Entire interface should mirror (leading/trailing, not left/right).
- Do NOT flip: video/image playback controls, music notation, clocks, numerals in phone numbers, graphs with left-to-right x-axes.
- **"Don't flip images or icons that represent physical objects as they appear in the real world."**
- Test with native RTL speakers.

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/right-to-left

---

## 12. Buttons (Components)

**Source:** `buttons.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/buttons

### 12.1 visionOS Button Sizes

| Shape | Mini | Small | Regular | Large | Extra Large |
|-------|------|-------|---------|-------|-------------|
| Size | 28 pt | 32 pt | 44 pt | 52 pt | 64 pt |
| Shapes available | Circular, Capsule (text), Capsule (text+icon), Rounded rectangle |

### 12.2 Best Practices (verbatim)

- **"Make buttons easy for people to use."** — include enough space for visual distinction and selection.
- **"Use style — not size — to visually distinguish the preferred choice among multiple options."**
- In visionOS: **"prefer circular or capsule-shape buttons."** — "People's eyes tend to be drawn toward the corners in a shape."
- watchOS: **"Prefer buttons that span the width of the screen for primary actions."**

**Source URL:** https://developer.apple.com/design/human-interface-guidelines/buttons

---

## 13. Patterns

### 13.1 Feedback

**Source:** `feedback.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/feedback

- **"Make sure all feedback is accessible."** — Use color, text, sound, AND haptics.
- **"Consider integrating status feedback into your interface."** — Near the items it describes.
- **"Use alerts to deliver critical — and ideally actionable — information."** — Alerts lose impact if overused.
- **"Warn people when they initiate a task that can cause data loss that's unexpected and irreversible."**
- watchOS: **"Avoid displaying an indeterminate progress indicator."**

### 13.2 Loading

**Source:** `loading.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/loading

- **"Show something as soon as possible."** — Use placeholder text/graphics/animations.
- **"Let people do other things while they wait."**
- Use **determinate** progress when you know duration, **indeterminate** when you don't.
- watchOS: **"avoid showing a loading indicator"** — people expect quick interactions.

### 13.3 Searching

**Source:** `searching.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/searching

- **"If search is important, give it a primary position."**
- **"Aim to make your app's content searchable through a single location."**
- **"Provide suggestions to make searching easier."**
- **"Take privacy into consideration before displaying search history."**

### 13.4 Settings

**Source:** `settings.json`
**Source URL:** https://developer.apple.com/design/human-interface-guidelines/settings

- **"Aim to provide default settings that give the best experience to the largest number of people."**
- **"Minimize the number of settings you offer."**
- **"Respect people's systemwide settings and avoid including redundant versions of them."**
- **"When possible, prefer letting people modify task-specific options without going to your settings area."**

---

## 14. Consolidated Quick-Reference Numbers

### Contrast Ratios (WCAG AA, per Apple's Accessibility page)

| Condition | Minimum Ratio |
|-----------|--------------|
| Text up to 17 pt, any weight | **4.5:1** |
| Text 18 pt+, any weight | **3:1** |
| Bold text, any size | **3:1** |
| Dark Mode page recommendation | **4.5:1 minimum**, strive for **7:1** |

### Minimum Touch/Control Targets

| Platform | Default | Minimum |
|----------|---------|---------|
| iOS/iPadOS | 44x44 pt | 28x28 pt |
| macOS | 28x28 pt | 20x20 pt |
| tvOS | 66x66 pt | 56x56 pt |
| visionOS | 60x60 pt | 28x28 pt |
| watchOS | 44x44 pt | 28x28 pt |

### Default/Minimum Type Sizes

| Platform | Default | Minimum |
|----------|---------|---------|
| iOS/iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| tvOS | 29 pt | 23 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |

### tvOS Safe Area Insets

| Edge | Inset |
|------|-------|
| Top/Bottom | 60 pt |
| Left/Right | 80 pt |

### Liquid Glass Dimming

- Over bright content: dark dimming layer at **35% opacity**
- Over dark content: no dimming layer needed

### Motion

- Games: target **30–60 fps**
- visionOS: avoid oscillation near **0.2 Hz**
- watchOS: built-in easing on all animations (not customizable)

### Text Enlargement (Accessibility)

- Minimum supported: **200%** enlargement (140% on watchOS)

---

## 15. Items NOT Found / Could Not Verify

The following items are commonly referenced on design blogs but could NOT be verified from the live Apple HIG JSON API:

1. **Specific corner radius values** (e.g., "continuous corner radius of 39 pt for app icons") — The HIG pages fetched do not publish specific corner radius numbers in text. App icon corner radius is handled by the system mask, not developer-specified. `[UNVERIFIED from HIG text — likely in Figma/Sketch design resources]`

2. **Specific animation durations/easing curves** (e.g., "0.3s ease-in-out") — Apple does NOT publish specific duration or easing values on the HIG pages. The Motion page says watchOS has "built-in easing" but gives no curve or duration. `[NOT PUBLISHED in HIG]`

3. **Specific spacing/margin values for iOS** (e.g., "16 pt standard margin") — The Layout page discusses safe areas, layout guides, and margins conceptually but does NOT publish specific pt values for iOS/iPadOS margins. The 60/80 pt values are for tvOS only. `[NOT PUBLISHED in HIG text — available in design templates]`

4. **Exact RGB/hex values for semantic colors** — Present as image swatches only, not as text values. Must be obtained via API or design resources. `[IMAGE-ONLY in HIG]`

5. **"Clarity, Deference, Depth"** — NOT present on the current Design Principles page. Replaced by the eight principles (Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity, Craft, Delight) as of June 8, 2026.

6. **Charts component page** — The HIG index does not list a dedicated "Charts" page. Chart guidance is distributed across other pages and the Swift Charts framework documentation.

7. **Sheets, Popovers, Disclosure controls, Labels, Lists and tables, Toolbars** — These component pages exist in the HIG but were not fetched in this batch. Their JSON endpoints follow the same pattern (`searching.json`, etc.) and can be retrieved as needed.

---

## Sources Index

All URLs below were fetched and returned HTTP 200 with structured JSON content:

| Page | URL |
|------|-----|
| HIG Home | https://developer.apple.com/design/human-interface-guidelines/ |
| Design Principles | https://developer.apple.com/design/human-interface-guidelines/design-principles |
| Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| Color | https://developer.apple.com/design/human-interface-guidelines/color |
| Dark Mode | https://developer.apple.com/design/human-interface-guidelines/dark-mode |
| Typography | https://developer.apple.com/design/human-interface-guidelines/typography |
| Layout | https://developer.apple.com/design/human-interface-guidelines/layout |
| Materials | https://developer.apple.com/design/human-interface-guidelines/materials |
| Motion | https://developer.apple.com/design/human-interface-guidelines/motion |
| Writing | https://developer.apple.com/design/human-interface-guidelines/writing |
| Icons | https://developer.apple.com/design/human-interface-guidelines/icons |
| Right to Left | https://developer.apple.com/design/human-interface-guidelines/right-to-left |
| Buttons | https://developer.apple.com/design/human-interface-guidelines/buttons |
| Feedback | https://developer.apple.com/design/human-interface-guidelines/feedback |
| Loading | https://developer.apple.com/design/human-interface-guidelines/loading |
| Searching | https://developer.apple.com/design/human-interface-guidelines/searching |
| Settings | https://developer.apple.com/design/human-interface-guidelines/settings |
| Fonts Download | https://developer.apple.com/fonts/ |
| Design Resources | https://developer.apple.com/design/resources/ |
| WWDC 2025 Liquid Glass | https://developer.apple.com/videos/play/wwdc2025/219 |
| WWDC 2026 Design Principles | https://developer.apple.com/videos/play/wwdc2026/250 |
