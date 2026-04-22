import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './LandingAboutPage.module.css'
import './LandingAboutPage.mobile.css'

// ── Данные ────────────────────────────────────────────────────────────────────

const WHY_US = [
  {
    icon: '⚡',
    title: 'Мгновенное развёртывание',
    desc: 'Виртуальные машины и контейнеры запускаются за секунды — без ожидания и бюрократии.',
  },
  {
    icon: '🏢',
    title: 'Дата-центр в Минске',
    desc: 'Собственный ЦОД уровня Tier III на территории Беларуси. Ваши данные остаются в стране.',
  },
  {
    icon: '🛡',
    title: '99.9% SLA',
    desc: 'Гарантированный аптайм, закреплённый договором. Мы несём финансовую ответственность.',
  },
  {
    icon: '💬',
    title: 'Поддержка 24/7',
    desc: 'Живые инженеры в чате, по телефону и email — в любое время суток без ботов.',
  },
  {
    icon: '📊',
    title: 'Прозрачный биллинг',
    desc: 'Оплата поминутно. Никаких скрытых платежей — только то, что реально использовали.',
  },
  {
    icon: '🔧',
    title: 'Гибкие конфигурации',
    desc: 'От 1 vCPU / 512 МБ RAM до выделенных серверов. Масштабируйте ресурсы в один клик.',
  },
]

const FAQ_ITEMS = [
  {
    q: 'Что такое IaaS Cloud?',
    a: 'IaaS Cloud — белорусский провайдер облачной инфраструктуры (Infrastructure as a Service). Мы предоставляем виртуальные машины, объектное и файловое хранилище, базы данных и мобильные фермы для тестирования — всё на базе собственного ЦОД в Минске.',
  },
  {
    q: 'Как начать пользоваться сервисом?',
    a: 'Зарегистрируйтесь или свяжитесь с нашим менеджером — мы создадим аккаунт, подберём тариф и поможем с первоначальной настройкой. Бесплатный пробный период 14 дней доступен для новых клиентов.',
  },
  {
    q: 'Где физически находятся серверы?',
    a: 'Все серверы расположены в нашем дата-центре в Минске, ул. Логойский тракт, 22. Мощности соответствуют стандарту Tier III с резервированием по питанию и охлаждению.',
  },
  {
    q: 'Как обеспечивается безопасность данных?',
    a: 'Данные шифруются при хранении (AES-256) и передаче (TLS 1.3). Сеть изолирована через VLAN, доступ управляется через role-based политики. Резервные копии создаются ежедневно автоматически.',
  },
  {
    q: 'Какие способы оплаты принимаете?',
    a: 'Банковский перевод (для юрлиц), банковские карты Visa/MasterCard/МИР, ЕРИП. Для корпоративных клиентов доступна постоплата по договору.',
  },
  {
    q: 'Есть ли API для автоматизации?',
    a: 'Да, у нас полноценный REST API с документацией в стиле OpenAPI. Также поддерживается Terraform-провайдер и официальные SDK для Python, Go и Node.js.',
  },
  {
    q: 'Что происходит, если превысить SLA?',
    a: 'При нарушении гарантированного аптайма 99.9% мы автоматически начисляем компенсацию на счёт — пропорционально времени недоступности. Всё прозрачно и фиксируется в личном кабинете.',
  },
]

const SOCIALS = [
  { label: 'Telegram', icon: '✈', href: 'https://t.me/iaascloud', color: '#2AABEE' },
  { label: 'VK',       icon: '⬡', href: 'https://vk.com/iaascloud', color: '#4C75A3' },
  { label: 'LinkedIn', icon: 'in', href: 'https://linkedin.com/company/iaascloud', color: '#0A66C2' },
  { label: 'GitHub',   icon: '◎', href: 'https://github.com/iaascloud', color: '#e8eaf0' },
]

// ── Компонент FAQ-accordion ───────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.faqItem} ${open ? styles.faqOpen : ''}`}>
      <button className={styles.faqQ} onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span className={styles.faqArrow}>{open ? '−' : '+'}</span>
      </button>
      {open && <p className={styles.faqA}>{a}</p>}
    </div>
  )
}

// ── Основная страница ─────────────────────────────────────────────────────────

export function LandingAboutPage() {
  return (
    <div className={styles.page}>

      {/* ── Навбар ───────────────────────────────────────────────────────── */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.navLogo}>
            <span className={styles.navLogoMark}>⬡</span>
            <span className={styles.navLogoText}>IaaS<em>Cloud</em></span>
          </div>
          <nav className={styles.navLinks}>
            <a href="#why" className={styles.navLink}>Почему мы</a>
            <a href="#faq" className={styles.navLink}>FAQ</a>
            <Link to="/contacts" className={styles.navLink}>Контакты</Link>
            <Link to="/login" className={styles.navBtnLogin}>Войти</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden />
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Облачная инфраструктура · Минск
          </div>
          <h1 className={styles.heroTitle}>
            Облако для бизнеса<br />
            <em>без компромиссов</em>
          </h1>
          <p className={styles.heroSub}>
            IaaS Cloud — провайдер облачных услуг с собственным ЦОД в Беларуси.
            Виртуальные машины, хранилище, базы данных и мобильные фермы —
            всё в одной платформе.
          </p>
          <div className={styles.heroCta}>
            <Link to="/login" className={styles.btnPrimary}>
              Попробовать бесплатно →
            </Link>
            <a href="#why" className={styles.btnOutline}>
              Узнать больше
            </a>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <strong>99.9%</strong><span>SLA uptime</span>
            </div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}>
              <strong>24/7</strong><span>Поддержка</span>
            </div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}>
              <strong>Tier III</strong><span>ЦОД Минск</span>
            </div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}>
              <strong>5 с</strong><span>Запуск VM</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Почему мы ────────────────────────────────────────────────────── */}
      <section id="why" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// почему мы</span>
            <h2 className={styles.sectionTitle}>Преимущества IaaS Cloud</h2>
            <p className={styles.sectionSub}>
              Мы строили платформу так, как хотели бы сами ей пользоваться —
              быстро, прозрачно, надёжно.
            </p>
          </div>
          <div className={styles.whyGrid}>
            {WHY_US.map(item => (
              <div key={item.title} className={styles.whyCard}>
                <div className={styles.whyIcon}>{item.icon}</div>
                <h3 className={styles.whyTitle}>{item.title}</h3>
                <p className={styles.whyDesc}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// вопросы и ответы</span>
            <h2 className={styles.sectionTitle}>Часто задаваемые вопросы</h2>
            <p className={styles.sectionSub}>
              Не нашли ответ? Напишите нам — ответим в течение часа.
            </p>
          </div>
          <div className={styles.faqList}>
            {FAQ_ITEMS.map(item => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <div className={styles.faqCta}>
            <Link to="/contacts" className={styles.btnPrimary}>
              Задать свой вопрос →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Футер с соц.сетями ───────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <span className={styles.navLogoMark}>⬡</span>
            <span className={styles.navLogoText}>IaaS<em>Cloud</em></span>
          </div>
          <p className={styles.footerTagline}>
            Облачная инфраструктура нового поколения в Беларуси
          </p>
          <div className={styles.socials}>
            {SOCIALS.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                title={s.label}
                style={{ '--social-color': s.color } as React.CSSProperties}
              >
                <span className={styles.socialIcon}>{s.icon}</span>
                <span className={styles.socialLabel}>{s.label}</span>
              </a>
            ))}
          </div>
          <div className={styles.footerMeta}>
            <span>© 2024 IaaS Cloud. Все права защищены.</span>
            <span className={styles.footerDot}>·</span>
            <span>ООО «АйЭаС Клауд», УНП 191234567, г. Минск</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
