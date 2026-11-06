// The VitePress CLI and its transitive dependencies are locked in the workspace.
const repository = 'https://github.com/AbdullahZaher/vibress-studio'

const enSidebar = [
  {
    text: 'Start here',
    items: [
      { text: 'Overview', link: '/' },
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'React integration', link: '/guide/react-integration' },
    ],
  },
  {
    text: 'Guides',
    items: [
      { text: 'Cards', link: '/cards' },
      { text: 'Import & export', link: '/import-export' },
      { text: 'Host media uploads', link: '/media-upload-adapter' },
      { text: 'Plugin SDK', link: '/plugin-sdk' },
      { text: 'Vibress integration', link: '/vibress-integration' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Architecture', link: '/architecture' },
      { text: 'Package exports', link: '/package-exports' },
      { text: 'Security', link: '/security' },
      { text: 'Sanitization policy', link: '/sanitization-policy' },
      { text: 'Testing', link: '/testing' },
      { text: 'World-class editor 9+ delivery plan', link: '/roadmaps/world-class-editor-9-plus-plan-2026-11-06' },
      { text: 'Program implementation status (2026-11-05)', link: '/audits/studio-program-implementation-2026-11-05' },
      { text: 'Design handoff', link: '/design-readiness-spec' },
      { text: 'Release and rollback policy', link: '/release-policy' },
      { text: 'ADR-0001: runtime ownership', link: '/adr/0001-studio-canonical-runtime' },
      { text: 'Documentation development', link: '/guide/documentation-site' },
    ],
  },
]

export default {
  title: 'Vibress Studio',
  description: 'A reusable block-based editor, document model and safe renderers.',
  base: '/vibress-studio/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  sitemap: {
    hostname: 'https://abdullahzaher.github.io/vibress-studio/',
  },
  head: [
    ['meta', { name: 'theme-color', content: '#5564e9' }],
    ['link', { rel: 'stylesheet', href: '/vibress-studio/custom.css' }],
  ],
  markdown: { lineNumbers: true },
  themeConfig: {
    siteTitle: 'Vibress Studio',
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: repository }],
    editLink: { pattern: repository + '/edit/main/docs/:path', text: 'Edit this page on GitHub' },
    footer: {
      message: 'A standalone editor library; persistence and publication stay with the host.',
      copyright: 'Vibress Studio contributors',
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'Reference', link: '/architecture' },
          { text: 'GitHub', link: repository },
        ],
        sidebar: enSidebar,
      },
    },
    ar: {
      label: 'العربية',
      lang: 'ar-SA',
      title: 'Vibress Studio',
      description: 'محرر محتوى قابل لإعادة الاستخدام مع نموذج مستندات وعرض آمن',
      themeConfig: {
        nav: [
          { text: 'الرئيسية', link: '/ar/' },
          { text: 'البدء', link: '/ar/guide/getting-started' },
          { text: 'التوثيق التقني', link: '/architecture' },
          { text: 'GitHub', link: repository },
        ],
        sidebar: [
          {
            text: 'دليل البداية',
            items: [
              { text: 'نظرة عامة', link: '/ar/' },
              { text: 'التثبيت والتجربة', link: '/ar/guide/getting-started' },
            ],
          },
          {
            text: 'المراجع التقنية (بالإنجليزية)',
            items: [
              { text: 'المعمارية', link: '/architecture' },
              { text: 'البطاقات', link: '/cards' },
              { text: 'التكامل مع React', link: '/guide/react-integration' },
              { text: 'الأمان', link: '/security' },
            ],
          },
        ],
        editLink: { pattern: repository + '/edit/main/docs/:path', text: 'تعديل هذه الصفحة على GitHub' },
        outline: { label: 'في هذه الصفحة' },
        docFooter: { prev: 'السابق', next: 'التالي' },
        lastUpdated: { text: 'آخر تحديث' },
      },
    },
  },
}
