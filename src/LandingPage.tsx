import BrandMark from './BrandMark';

type LandingPageProps = {
  onSignIn: () => void;
  onRegister: () => void;
};

export default function LandingPage({ onSignIn, onRegister }: LandingPageProps) {
  return (
    <main className="landing-page" dir="rtl">
      <header className="landing-header">
        <a className="landing-brand" href="#" aria-label="تاسك فلو - الرئيسية">
          <BrandMark />
          <span className="brand-word">تاسك فلو</span>
        </a>
        <nav className="landing-nav" aria-label="التنقل الرئيسي">
          <a href="#features">المميزات</a>
          <a href="#how-it-works">بيشتغل إزاي</a>
        </nav>
        <div className="landing-header-actions">
          <button className="landing-signin" onClick={onSignIn}>دخول</button>
          <button className="button button-primary" onClick={onRegister}>ابدأ مجانًا <span aria-hidden="true">←</span></button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><span /> شغلكم كله في مكان واحد</span>
          <h1>خلّي الشغل<br /><span>يمشي بسلاسة.</span></h1>
          <p>رتّبوا مشاريعكم، وزّعوا المهام، وخلي كل واحد عارف دوره — من غير دوشة ولا تفاصيل تضيع.</p>
          <div className="landing-hero-actions">
            <button className="button button-primary landing-cta" onClick={onRegister}>يلا نبدأ <span aria-hidden="true">←</span></button>
            <a className="landing-learn" href="#how-it-works"><span aria-hidden="true">↓</span> اعرف أكتر</a>
          </div>
          <div className="landing-proof"><div className="landing-avatars"><span>م</span><span>س</span><span>ع</span><span>+</span></div><span>فريقك كله يبقى على نفس الصفحة</span></div>
        </div>
        <div className="landing-preview" aria-label="مثال توضيحي لمشروع ومهامه">
          <div className="preview-topline"><span className="preview-dots"><i /><i /><i /></span><span>مساحة الفريق</span><span className="preview-avatar">م</span></div>
          <div className="preview-content">
            <span className="preview-label">مشروع الفريق</span>
            <div className="preview-title"><div><h2>إطلاق المنتج</h2><p>كل حاجة ماشية في اتجاه واحد</p></div><span className="preview-owner">مالك المشروع</span></div>
            <div className="preview-progress"><div><span>تقدم المشروع</span><strong>٧٥٪</strong></div><span className="preview-progress-track"><i /></span></div>
            <div className="preview-task-heading"><strong>المهام الجاية</strong><span>عرض الكل ←</span></div>
            <div className="preview-task"><span className="preview-check done">✓</span><span><strong>تجهيز خطة الإطلاق</strong><small>محمود · خلصت</small></span><b className="preview-tag tag-done">تمت</b></div>
            <div className="preview-task"><span className="preview-check"> </span><span><strong>مراجعة تصميم الصفحة</strong><small>سارة · شغالة</small></span><b className="preview-tag tag-progress">شغالة</b></div>
            <div className="preview-task"><span className="preview-check"> </span><span><strong>كتابة محتوى الموقع</strong><small>لسه محتاجة حد</small></span><b className="preview-tag tag-next">جاية</b></div>
            <div className="preview-team"><span className="preview-team-avatars"><i>م</i><i>س</i><i>ع</i></span><span>الفريق كله بيتقدم سوا</span><span className="preview-spark">✳</span></div>
          </div>
          <span className="preview-float preview-float-top">✓ المهمة خلصت</span>
          <span className="preview-float preview-float-bottom">✳ خطوة صغيرة كل يوم</span>
        </div>
      </section>

      <section className="landing-trust">
        <span>من أول فكرة لحد آخر تسليم</span><i /><span>الأدوار واضحة</span><i /><span>والتقدم باين للكل</span>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-heading">
          <span className="landing-eyebrow"><span /> كل حاجة أوضح</span>
          <h2>مساحة أهدى لشغل أحسن.</h2>
          <p>تاسك فلو بيخلّي تفاصيل الشغل واضحة، عشان تركزوا على اللي بيفرق فعلًا.</p>
        </div>
        <div className="landing-feature-grid">
          <article className="landing-feature-card"><span className="feature-icon feature-icon-green">▦</span><h3>مشاريع مترتبة</h3><p>كل مشروع له مساحته، وتفاصيله وفريقه في مكان واحد.</p></article>
          <article className="landing-feature-card"><span className="feature-icon feature-icon-orange">✓</span><h3>مهام مفهومة</h3><p>مين هيعمل إيه، وإمتى، وإيه اللي خلص — كله باين.</p></article>
          <article className="landing-feature-card"><span className="feature-icon feature-icon-blue">◎</span><h3>كل واحد عارف دوره</h3><p>الصلاحيات بتتحدد جوه كل مشروع، والتصرفات المناسبة بتظهر لكل شخص.</p></article>
        </div>
      </section>

      <section className="landing-workflow" id="how-it-works">
        <div className="workflow-copy">
          <span className="landing-eyebrow"><span /> من غير لف ودوران</span>
          <h2>من الفكرة<br />للإنجاز، خطوة خطوة.</h2>
          <p>اعملوا مشروع، لمّوا الفريق، وبعدها تابعوا الشغل من مكان واحد. بسيطة كده.</p>
          <button className="button button-primary" onClick={onRegister}>جرّب تاسك فلو <span aria-hidden="true">←</span></button>
        </div>
        <div className="workflow-steps">
          <article><span>١</span><div><h3>اعمل مساحة للمشروع</h3><p>اكتبوا الهدف وخلو كل حاجة تخصه مع بعض.</p></div></article>
          <article><span>٢</span><div><h3>ضيفوا الناس والمهام</h3><p>وزّعوا الأدوار، وكل واحد يعرف المطلوب منه.</p></div></article>
          <article><span>٣</span><div><h3>تابعوا التقدم</h3><p>حدّثوا حالة المهام واتكلموا في تفاصيلها بسهولة.</p></div></article>
        </div>
      </section>

      <section className="landing-bottom-cta">
        <div><span className="landing-eyebrow">جاهزين تظبطوا الشغل؟</span><h2>خلّوا الخطوة الجاية أسهل.</h2><p>ابدأوا مساحة شغل تجمع الفريق كله.</p></div>
        <button className="button button-primary" onClick={onRegister}>ابدأوا دلوقتي <span aria-hidden="true">←</span></button>
      </section>

      <footer className="landing-footer"><a className="landing-brand" href="#"><BrandMark /><span className="brand-word">تاسك فلو</span></a><span>شغل أوضح. فريق أهدى. إنجاز أحسن.</span></footer>
    </main>
  );
}
