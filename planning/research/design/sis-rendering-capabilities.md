# Streamlit-in-Snowflake (SiS) Rendering Capabilities

**Researched:** 22 Sept 2026
**Installed Streamlit version:** 1.64.0 (local venv)
**Target deployment:** SiS warehouse runtime

---

## 1. Custom CSS

### `st.markdown(..., unsafe_allow_html=True)` with `<style>` blocks

**VERIFIED** (source: `developing-with-streamlit/references/theme.md` lines 390-409, `references/markdown.md` lines 267-278, `st.html` docstring).

Yes, `<style>` blocks injected via `st.markdown(..., unsafe_allow_html=True)` work. The HTML is sanitised by DOMPurify but `<style>` tags survive. The skill guidance explicitly documents the CSS escape hatch using widget `key=` to create targetable `.st-key-<name>` classes:

```python
st.button("Submit", key="submit")
st.html("""<style>.st-key-submit button { width: 100%; }</style>""")
```

`st.html()` is the preferred path for pure CSS/HTML injection (not iframed, content is directly in the DOM). `st.html` also accepts a `pathlib.Path` to a CSS file, which it auto-wraps in `<style>` tags.

**Limits:**
- DOMPurify sanitises the HTML. Inline event handlers (`onclick`, etc.) are stripped.
- JavaScript is ignored by default in `st.html`; requires `unsafe_allow_javascript=True`.
- `wrap=False` cannot be combined with `unsafe_allow_html=True` on `st.markdown`.
- The skill strongly discourages CSS for theming — but for surgical layout overrides (e.g., hiding Streamlit chrome, adjusting specific element widths), it works.

### `.streamlit/config.toml` theming

**VERIFIED** (source: `developing-with-streamlit/references/theme.md` full file, `streamlit config show` output from 1.64.0).

Extensive theming via `[theme]` section. Supported keys (all confirmed in `streamlit config show`):

| Category | Keys |
|----------|------|
| **Core colors** | `primaryColor`, `backgroundColor`, `secondaryBackgroundColor`, `textColor` |
| **Extended colors** | `linkColor`, `codeTextColor`, `codeBackgroundColor`, `borderColor` |
| **Semantic palette** | `redColor`, `orangeColor`, `yellowColor`, `greenColor`, `blueColor`, `violetColor`, `grayColor` + `*BackgroundColor`, `*TextColor` variants |
| **Typography** | `font`, `headingFont`, `codeFont`, `baseFontSize`, `baseFontWeight`, `codeFontSize`, `codeFontWeight`, `headingFontSizes` (array), `headingFontWeights` (array), `linkUnderline` |
| **Borders/Radii** | `baseRadius`, `buttonRadius`, `showWidgetBorder`, `showSidebarBorder` |
| **Charts** | `chartCategoricalColors` (array), `chartSequentialColors` (array) |
| **Dataframe** | `dataframeBorderColor`, `dataframeHeaderBackgroundColor` |
| **Sidebar** | Full sub-section `[theme.sidebar]` with same color keys |
| **Light/Dark** | `[theme.light]`, `[theme.dark]` variants; user can toggle if both defined |
| **Inheritance** | `base = "light"` / `"dark"` / file path / URL |

**SiS-specific concern:** config.toml must be deployed as an artifact. Confirmed in `streamlit-in-snowflake-runtime.md`: "Any path you open must refer to files that are actually shipped with the app" — this includes `.streamlit/config.toml`.

---

## 2. Fonts

### Self-hosted fonts via `static/` directory

**VERIFIED** (source: `developing-with-streamlit/references/theme.md` lines 118-138, `streamlit config show` output for `fontFaces`).

Mechanism:

1. Enable static file serving: set `server.enableStaticServing = true` in `.streamlit/config.toml`
2. Place font files (`.woff2`, `.woff`, `.ttf`, `.otf`) in a `static/` directory relative to the app entry point
3. Reference them in `config.toml`:

```toml
[[theme.fontFaces]]
family = "CustomFont"
url = "app/static/CustomFont-Regular.woff2"
weight = 400

[[theme.fontFaces]]
family = "CustomFont"
url = "app/static/CustomFont-Bold.woff2"
weight = 700

[theme]
font = "CustomFont"
```

Attributes: `family`, `url`, `weight` (number, range string, or "bold"), `style` ("normal"/"italic"/"oblique"), `unicodeRange`.

**SiS-specific:** The `static/` directory and font files must be included in the `artifacts` list in `snowflake.yml`. The `server.enableStaticServing` setting must be in the deployed config.toml. **Changes to `fontFaces` require a server restart** (i.e., redeploy in SiS).

### Google Fonts

**VERIFIED** (source: `developing-with-streamlit/references/theme.md` lines 103-115).

Google Fonts can be loaded directly via config.toml:

```toml
[theme]
font = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
headingFont = "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@600;700&display=swap"
codeFont = "'JetBrains Mono':https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
```

**UNVERIFIED for SiS specifically** — SiS network restrictions may block Google Fonts CSS fetches. The runtime reference (`streamlit-in-snowflake-runtime.md`) states: "Outbound calls (PyPI, public HTTPS APIs, vendor LLM endpoints) require external access integrations (EAIs) and matching network rules." Google Fonts would be a browser-side fetch (the Streamlit frontend in the user's browser fetches the CSS), **not a server-side fetch**. The browser is not behind the EAI — it's the user's browser making the request. **Therefore Google Fonts should work** since the font URL is embedded in the HTML served to the client browser which has normal internet access.

**Safest approach:** Bundle fonts as `.woff2` files in `static/` to eliminate any dependency on external network, which also improves load time.

---

## 3. Custom Components

### `st.components.v2` availability

**VERIFIED** (source: `venv/bin/python -c "hasattr(st.components, 'v2')"` returned `True`; Streamlit 1.64.0).

CCv2 is available. The `st.components.v2.component()` API supports both inline (raw `html`/`css`/`js` strings) and packaged components (bundled assets via `asset_dir`).

### Bidirectional components in SiS

**VERIFIED** (source: `developing-with-streamlit/references/custom-components-v2.md`).

CCv2 components are **not iframed** — they render directly in the DOM via Shadow DOM (`isolate_styles=True` by default). Communication uses `setStateValue()` and `setTriggerValue()` (not `postMessage`).

**UNVERIFIED for SiS specifically** — The runtime reference does not explicitly list CCv2 as blocked. Since CCv2 inline components are just HTML/CSS/JS strings bundled in the Python source, and packaged components ship their assets alongside the app (listed in `artifacts`), they should work. The key requirement: all component asset files must be deployed artifacts. There is no network dependency for inline components.

**Packaged components** (those installed via pip) would require:
- The package in `pyproject.toml`
- An EAI for PyPI access
- OR: use inline components (no pip dependency, all code in Python strings)

### What version introduced CCv2

**VERIFIED** (source: `developing-with-streamlit/references/custom-components-v2.md` — the v1 APIs `components.v1.html()` and `components.v1.iframe()` are described as "deprecated" and replaced by `st.html()`/`st.iframe()` respectively, with `st.components.v2.component()` as the new component API). Available in 1.64.0.

---

## 4. Streamlit Version in SiS

### Installed version

**VERIFIED**: `1.64.0` (command: `venv/bin/python -c "import streamlit; print(streamlit.__version__)"`)

### SiS runtime version

**UNVERIFIED** — The exact Streamlit version running in SiS warehouse/container runtime is determined by Snowflake's pre-installed packages. The container runtime (`SYSTEM$ST_CONTAINER_RUNTIME_PY3_11`) ships a pinned Streamlit version. To determine the version in SiS, query it at runtime:

```python
import streamlit as st
st.write(st.__version__)
```

The deployment reference (`snowflake-deployment.md`) mentions `streamlit[snowflake]>=1.54.0` as a dependency floor. The actual deployed version will be whatever Snowflake's runtime ships (likely older than 1.64.0 if the container image hasn't been updated).

**Risk:** Many features in 1.64.0 (like `st.space`, `st.skeleton`, `st.badge`, `st.pagination`, `st.mermaid_chart`, `st.iframe`, `on_change` on tabs/expanders) may not be available if SiS runs an older version. **This must be verified by deploying a test app.**

### Unavailable/Restricted APIs in SiS

**VERIFIED** (source: `streamlit-in-snowflake-runtime.md`, `operations.md`):
- No arbitrary filesystem writes (durable data goes to Snowflake tables/stages)
- No outbound network without EAI (server-side only; browser-side fetches are unrestricted)
- No `st.secrets` / `secrets.toml` for Snowflake connection (use `st.connection("snowflake")` which uses embedded identity)
- No container logs / stdout access
- `st.file_uploader` works but large files may hit memory limits
- No `st.App` / ASGI / custom routes (SiS manages the server)

---

## 5. Layout Primitives (Installed 1.64.0)

All verified via `hasattr(st, ...)` and `inspect.signature()`:

| Primitive | Available | Key Parameters |
|-----------|-----------|----------------|
| `st.columns` | **Yes** | `spec`, `gap`, `vertical_alignment`, `border`, `width`, `wrap` |
| `st.container` | **Yes** | `border`, `key`, `width`, `height`, `horizontal`, `wrap`, `horizontal_alignment`, `vertical_alignment`, `gap`, `autoscroll` |
| `st.tabs` | **Yes** | `tabs`, `width`, `height`, `default`, `key`, `on_change` |
| `st.expander` | **Yes** | `label`, `expanded`, `key`, `icon`, `type`, `width`, `on_change` |
| `st.popover` | **Yes** | (confirmed via hasattr) |
| `@st.dialog` | **Yes** | `title`, `width`, `dismissible`, `icon`, `on_dismiss` |
| `@st.fragment` | **Yes** | `func`, `run_every`, `parallel`, `key` |
| `st.segmented_control` | **Yes** | (confirmed via hasattr) |
| `st.pills` | **Yes** | (confirmed via hasattr) |
| `st.metric` | **Yes** | (confirmed via hasattr) |
| `st.badge` | **Yes** | (confirmed via hasattr) |
| `st.html` | **Yes** | `body`, `width`, `unsafe_allow_javascript` |
| `st.bottom` | **Yes** | (confirmed via hasattr) |
| `st.space` | **Yes** | (confirmed via hasattr) |
| `st.skeleton` | **Yes** | (confirmed via hasattr) |
| `st.pagination` | **Yes** | (confirmed via hasattr) |
| `st.mermaid_chart` | **Yes** | (confirmed via hasattr) |
| `st.chat_message` | **Yes** | (confirmed via hasattr) |
| `st.chat_input` | **Yes** | (confirmed via hasattr) |
| `st.iframe` | **Yes** | (confirmed via hasattr) |

### Dense layout capabilities

The installed version supports:

- **Bordered containers** with `st.container(border=True)` — for card-like sections
- **Horizontal containers** with `st.container(horizontal=True)` — for button groups, toolbar rows
- **Precise gap control** via `gap` parameter on containers (including `gap=None` for zero spacing)
- **Fixed-height scrollable regions** via `st.container(height=300)` or `height="stretch"`
- **Alignment** via `horizontal_alignment` ("left", "center", "right", "distribute") and `vertical_alignment`
- **Column wrapping** via `wrap` parameter — columns stack vertically on narrow viewports by default
- **Tabs with lazy rendering** via `on_change="rerun"` + `.open` property check
- **Segmented controls and pills** as compact selection widgets
- **`st.space()`** for precise vertical spacing ("small", "medium", "large", or pixel value)
- **`st.skeleton()`** for loading placeholders
- **`st.bottom`** for pinned bottom content (useful for chat input)
- **Text alignment** via `st.markdown(..., text_alignment="center")`
- **`st.empty()` / `st.skeleton()`** for out-of-order insertion and placeholder patterns

**Caveat:** All of the above is for 1.64.0 locally. SiS runtime version may differ. Features like `st.space`, `st.skeleton`, `st.badge`, `st.pagination`, `on_change` on tabs, and `st.container(horizontal=True)` are relatively recent additions.

---

## 6. Scroll/Anchor Behaviour

### Heading anchors

**VERIFIED** (source: `st.markdown` docstring via `streamlit docs`, `references/markdown.md` lines 57, and `inspect.signature` showing `anchors` param).

`st.markdown` has an `anchors` parameter (default `True`). Headings (h1-h6) receive an `id` attribute. URL fragment deep links (e.g., `#section-name`) work — the `id` is derived from the heading text.

From the docstring: "Headings still receive an `id` attribute in either case, so URL fragment deep links (e.g., `#my-heading`) work."

### Programmatic scroll to element

**UNVERIFIED** — Streamlit does not have a native `st.scroll_to()` API. Options:

1. **URL fragment anchors** — append `#heading-id` to the URL. This works for markdown headings.
2. **JavaScript scroll** — via `st.html(unsafe_allow_javascript=True)`:
   ```python
   st.html("""
   <script>
   document.getElementById('target-id').scrollIntoView({behavior: 'smooth'});
   </script>
   """, unsafe_allow_javascript=True)
   ```
3. **CCv2 component** — a custom component could call `element.scrollIntoView()`.
4. **`st.container(autoscroll=True)`** — the `autoscroll` parameter exists on `st.container` (confirmed in signature). This likely auto-scrolls to bottom when content is added — useful for chat-like interfaces but not for arbitrary anchor jumping.

### Deep-link to citation + scroll to page text

**UNVERIFIED** — For the citation-to-page-text use case, the achievable pattern is:
- Render each document page in a `st.container(height=...)` with a known `key`
- Use `st.html` with JavaScript to scroll to the target container and highlight
- OR: use session state to track the target, and re-render with the target page expanded/scrolled-to on next rerun

This is workable but not trivial. There is no native "scroll to arbitrary element" API. The JavaScript escape hatch via `st.html(unsafe_allow_javascript=True)` is the most direct route.

---

## 7. Text Highlighting of a Character Range

### `<mark>` in markdown

**VERIFIED** (source: `references/markdown.md` lines 267-278; DOMPurify allows `<mark>` tags).

```python
st.markdown(
    "The patient showed <mark>elevated troponin levels</mark> on admission.",
    unsafe_allow_html=True,
)
```

`<mark>` survives DOMPurify sanitization. Inline styles on `<mark>` also survive:

```python
st.markdown(
    'Text with <mark style="background-color: #FFEB3B; padding: 2px 4px;">highlighted range</mark> here.',
    unsafe_allow_html=True,
)
```

### `st.html` for highlighting

**VERIFIED** (source: `st.html` docstring — "content is not iframed", HTML rendered directly).

```python
st.html('<p>Document text with <mark style="background: #FFF176;">highlighted passage</mark> continues.</p>')
```

This renders directly in the app DOM (no iframe). CSS styles apply.

### Native Streamlit colored text

**VERIFIED** (source: `references/markdown.md` lines 109-120).

Streamlit's built-in syntax also works:

```python
st.markdown(":yellow-background[elevated troponin levels]")
```

Or with custom hex colors:

```python
st.markdown(':color[highlighted text]{background="#FFEB3B"}')
```

### Character-range highlighting strategy

**UNVERIFIED (design inference)** — For highlighting a specific character range within a block of text:

1. **Split-and-wrap approach**: Given text and a `(start, end)` range, construct:
   ```python
   text = full_text[:start] + '<mark>' + full_text[start:end] + '</mark>' + full_text[end:]
   st.markdown(text, unsafe_allow_html=True)
   ```

2. **Multiple highlights**: Use multiple `<mark>` tags with different background colors for different claim types.

3. **In a scrollable container**: Wrap in `st.container(height=400)` for a fixed-height scrollable region showing the page text.

This is the cleanest available mechanism. No native Streamlit API exists for sub-string highlighting.

---

## 8. Performance: Reruns and Mitigation

### What causes full-script reruns

**VERIFIED** (source: `references/performance.md` full file).

Every widget interaction triggers a full top-to-bottom script rerun by default. This includes:
- Any `st.button` click
- Any `st.selectbox`, `st.slider`, `st.text_input` change
- Any `st.checkbox`, `st.radio`, `st.toggle` change
- Tab switching (unless using `on_change="rerun"` dynamic tabs, which still reruns but lets you guard content)

### `st.fragment` for partial reruns

**VERIFIED** (source: `references/performance.md` lines 127-155).

`@st.fragment` isolates a section — widget interactions inside only rerun that fragment, not the full script. Key features in 1.64.0:

- `run_every="30s"` — auto-refresh a fragment on a timer
- `parallel=True` — run independent fragments concurrently during full reruns (thread pool)
- `key="name"` — allows `st.rerun("name")` from outside callbacks to target specific fragments

### `st.form` for batched input

**VERIFIED** — Wrapping multiple inputs in `st.form` delays rerun until the submit button is pressed. Critical for forms with text inputs that would otherwise rerun on every keystroke.

### Caching

**VERIFIED** (source: `references/performance.md` lines 7-120).

- `@st.cache_data(ttl="5m")` — for serializable data (DataFrames, query results)
- `@st.cache_resource` — for connections, models, non-serializable objects
- `refresh_mode="background"` — serve stale while recomputing in background
- `max_entries` — bound cache size to prevent memory growth
- `st.connection()` already caches internally — do not wrap

### Render order for perceived performance

**VERIFIED** (source: `references/performance.md` lines 356-421).

Key guidance:
1. Render stable UI first (title, filters, sidebar, section headers)
2. Reserve slots with `st.container()` for slow-filling content
3. Use `st.skeleton()` as context manager for loading placeholders
4. Put slow work (queries, AI calls) after the page layout is established
5. Use `@st.fragment(parallel=True)` for independent slow sections

### Stale element greying

**VERIFIED** — During reruns, elements from the previous run are shown at ~33% opacity (greyed/stale) until the new run recreates them. Fast reruns avoid visible greying. Slow work blocking rendering causes stale-looking UI.

### SiS-specific performance notes

**UNVERIFIED (inference)** — In SiS, the Streamlit server runs inside Snowflake's infrastructure. Snowflake SQL queries via `st.connection("snowflake")` should be fast (no network round-trip to an external DB). However:
- Cold starts may be slow (container/warehouse spin-up)
- The warehouse must be running for query execution
- `@st.cache_data` and `@st.cache_resource` work as normal (in-process memory cache)
- `parallel=True` fragments depend on thread pool availability in the SiS runtime

---

## Summary: Design Ceiling

### What we CAN do

1. **Full config.toml theming** — custom colors, fonts (bundled .woff2), radii, borders, heading sizes, sidebar styling, light/dark modes
2. **Surgical CSS overrides** — via `st.html("<style>...")` targeting `.st-key-*` classes
3. **Rich inline formatting** — colored text, badges, Material Symbols icons, custom hex colors via `:color[text]{foreground="..." background="..."}`
4. **Dense layouts** — bordered containers, horizontal rows, fixed-height scrollable regions, precise gap control, tabs, dialogs, popovers, segmented controls
5. **Text highlighting** — `<mark>` tags via `unsafe_allow_html`, or native `:yellow-background[text]` syntax
6. **Custom interactive widgets** — CCv2 inline components (HTML/CSS/JS in Python strings, no external dependencies)
7. **Anchor deep-links** — heading `id` attributes + URL fragments
8. **JavaScript escape hatch** — `st.html(unsafe_allow_javascript=True)` for scroll-to, custom DOM manipulation
9. **Partial reruns** — `@st.fragment` with `key`, `parallel`, `run_every`
10. **Loading states** — `st.skeleton()`, `st.spinner`, `st.status`

### What we CANNOT do (or is risky)

1. **Guaranteed specific Streamlit version in SiS** — must test; many 1.64.0 features may not be in the SiS runtime
2. **Arbitrary DOM manipulation across the whole page** — `st.html` content is DOMPurify-sanitised; CCv2 runs in Shadow DOM
3. **Native scroll-to-element** — no `st.scroll_to()` API; JavaScript workaround exists but is fragile
4. **Persistent URL state beyond query params** — `st.query_params` exists but deep state management is manual
5. **`st.App` / ASGI / custom HTTP routes** — not available in SiS
6. **Remote font loading guarantee** — Google Fonts should work (browser-side fetch) but bundle fonts for reliability
7. **Container logs for debugging** — SiS provides no stdout/stderr access

### Critical Next Step

**Deploy a minimal test app to SiS** that prints `st.__version__` and tests: `st.badge`, `st.space`, `st.skeleton`, `st.container(horizontal=True)`, `st.tabs(on_change="rerun")`, `st.html("<style>...</style>")`, `st.html(unsafe_allow_javascript=True)`, and `st.components.v2.component()`. This will establish the actual rendering ceiling in production.
