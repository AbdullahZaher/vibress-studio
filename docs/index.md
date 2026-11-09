---
layout: home

hero:
  name: Vibress Studio
  text: Structured content, without the CMS lock-in.
  tagline: A reusable Lexical-powered editing library with a versioned document model, extensible cards and server-safe rendering.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Integration guide
      link: /guide/react-integration

features:
  - icon: ✍️
    title: Authoring experience
    details: React and Lexical for rich text, block controls, and content cards.
  - icon: 🧩
    title: Portable documents
    details: A validated, migratable JSON envelope with schema vibress-studio and version 1.
  - icon: 🛡️
    title: Safer output
    details: HTML and Markdown conversions with validation and sanitization boundaries.
  - icon: 🌐
    title: Mixed-language editing
    details: Design and verification priorities include Arabic, English and bidirectional text.
---

## Built for publishing integrations

Studio is a **library, not a CMS**. Your application supplies authentication, persistence, media storage, permissions, publishing and any AI provider. Read the [architecture](/architecture) and [host integration](/vibress-integration) documentation before embedding it.

::: warning Runtime compatibility
The Vibress host and this standalone repository are not automatically feature-equivalent. [ADR-0001](/adr/0001-studio-canonical-runtime) is **Approved (Option B)**, and identifies the host as the current runtime reference while Studio acts as a downstream distribution library. Current pre-release baseline: **v1.2.0-beta.3**. Verify public exports and integration compatibility at the exact revision you deploy.
:::

For the current proposed improvement program, see the [World-class editor 9+ delivery plan](/roadmaps/world-class-editor-9-plus-plan-2026-11-06). It separates proposed work from verified code, assigns Studio versus Host responsibilities, and defines evidence-based release gates; **it is not a release certification**.

Use the [package exports](/package-exports), [security policy](/security), and [test guidance](/testing) as engineering references. The [Arabic introduction](/ar/) is also available.
