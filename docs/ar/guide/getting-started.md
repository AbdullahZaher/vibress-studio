# التثبيت وتجربة المحرر

هذا الدليل لتجربة **المستودع المستقل** محليًا، وليس لتثبيت نظام إدارة المحتوى Vibress بالكامل.

## المتطلبات

تحتاج إلى Node.js 24 وpnpm 11.17.0 أو أحدث ضمن السلسلة 11، إضافةً إلى Git.

## تشغيل بيئة التجربة

```bash
git clone https://github.com/AbdullahZaher/vibress-studio.git
cd vibress-studio
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm --filter vibress-studio-playground dev
```

يجب تنفيذ `pnpm build` أولًا لأن الحزم الداخلية تعتمد على مخرجات `dist` لتشغيل بيئة التجربة.

## الخطوات التالية

- [دمج المحرر في React (بالإنجليزية)](/guide/react-integration)
- [بنية المشروع](/architecture)
- [أنواع البطاقات](/cards)
- [التعامل مع رفع الوسائط](/media-upload-adapter)
- [الأمان](/security)

::: tip مسؤوليات التطبيق المضيف
لا يتولى Studio إدارة المستخدمين أو الحفظ أو ملفات الوسائط. يجب أن يوفّر التطبيق المضيف الخدمات الموثوقة والصلاحيات، وأن يحتفظ بالمستندات دون فقدان التعديلات.
:::
