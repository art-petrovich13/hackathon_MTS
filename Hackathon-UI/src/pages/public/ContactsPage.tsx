import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import styles from './ContactsPage.module.css'
import './ContactsPage.mobile.css'

// ── Контактные данные ─────────────────────────────────────────────────────────

const CONTACTS = [
  {
    icon: '📍',
    label: 'Адрес',
    value: 'ул. Московская, 15А, Минск',
    href: null,
  },
  {
    icon: '📞',
    label: 'Телефон',
    value: '+375 (17) 299-88-77',
    href: 'tel:+375172998877',
  },
  {
    icon: '✉',
    label: 'Email',
    value: 'hello@iaas.cloud',
    href: 'mailto:hello@iaas.cloud',
  },
  {
    icon: '🕐',
    label: 'Режим работы',
    value: 'Пн–Пт: 9:00–18:00. Поддержка 24/7.',
    href: null,
  },
]

const SOCIALS = [
  { label: 'Telegram', href: 'https://t.me/iaascloud', color: '#2AABEE', icon: '✈' },
  { label: 'VK',       href: 'https://vk.com/iaascloud', color: '#4C75A3', icon: '⬡' },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/iaascloud', color: '#0A66C2', icon: 'in' },
  { label: 'GitHub',   href: 'https://github.com/iaascloud', color: '#e8eaf0', icon: '◎' },
]

// ── Страница ──────────────────────────────────────────────────────────────────

export function ContactsPage() {
  const [name, setName]       = useState('')
  const [phone, setPhone]     = useState('')
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setLoading(true)
    // Имитируем отправку
    setTimeout(() => {
      setLoading(false)
      setSent(true)
    }, 1200)
  }

  return (
    <div className={styles.page}>

      {/* ── Навбар ─────────────────────────────────────────────────────── */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <Link to="/about" className={styles.navLogo}>
            <span className={styles.navLogoMark}>⬡</span>
            <span className={styles.navLogoText}>IaaS<em>Cloud</em></span>
          </Link>
          <nav className={styles.navLinks}>
            <Link to="/about" className={styles.navLink}>О компании</Link>
            <a href="#faq-link" className={styles.navLink}>FAQ</a>
            <Link to="/contacts" className={`${styles.navLink} ${styles.navLinkActive}`}>Контакты</Link>
            <Link to="/login" className={styles.navBtnLogin}>Войти</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden />
        <div className={styles.heroInner}>
          <span className={styles.heroTag}>// связаться с нами</span>
          <h1 className={styles.heroTitle}>Контакты</h1>
          <p className={styles.heroSub}>
            Мы в Минске и отвечаем быстро — напишите, позвоните или оставьте заявку.
          </p>
        </div>
      </section>

      {/* ── Основной контент ────────────────────────────────────────────── */}
      <section className={styles.main}>
        <div className={styles.mainInner}>

          {/* Левая колонка — контакты + форма */}
          <div className={styles.leftCol}>

            {/* Контактные данные */}
            <div className={styles.contactsBlock}>
              <h2 className={styles.blockTitle}>Реквизиты и связь</h2>
              <div className={styles.contactsList}>
                {CONTACTS.map(c => (
                  <div key={c.label} className={styles.contactItem}>
                    <span className={styles.contactIcon}>{c.icon}</span>
                    <div className={styles.contactText}>
                      <span className={styles.contactLabel}>{c.label}</span>
                      {c.href ? (
                        <a href={c.href} className={styles.contactValue}>{c.value}</a>
                      ) : (
                        <span className={styles.contactValue}>{c.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Соц.сети */}
              <div className={styles.socialsBlock}>
                <span className={styles.socialsLabel}>Мы в соцсетях</span>
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
                      <span>{s.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Форма обратной связи */}
            <div className={styles.formBlock}>
              <h2 className={styles.blockTitle}>Форма обратной связи</h2>
              <p className={styles.formDesc}>
                Заполните форму — менеджер перезвонит вам в течение 15 минут в рабочее время.
              </p>

              {sent ? (
                <div className={styles.successMsg}>
                  <span className={styles.successIcon}>✓</span>
                  <div>
                    <strong>Заявка отправлена!</strong>
                    <p>Мы свяжемся с вами по телефону в ближайшее время.</p>
                  </div>
                </div>
              ) : (
                <form className={styles.form} onSubmit={handleSubmit}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Ваше имя *</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Иван Иванов"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Телефон *</label>
                      <input
                        className={styles.input}
                        type="tel"
                        placeholder="+375 (__)  ___-__-__"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Email</label>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Сообщение</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Опишите задачу или вопрос..."
                      rows={4}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                    />
                  </div>

                  <div className={styles.formActions}>
                    <button
                      type="submit"
                      className={styles.btnCallBack}
                      disabled={loading}
                    >
                      {loading ? (
                        <><span className={styles.spinner} /> Отправляем...</>
                      ) : (
                        '📞 Заказать обратный звонок'
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.btnMore}
                      onClick={() => window.location.href = '/about'}
                    >
                      Узнать больше
                    </button>
                  </div>

                  <p className={styles.formNote}>
                    * Обязательные поля. Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Правая колонка — карта */}
          <div className={styles.rightCol}>
            <div className={styles.mapBlock}>
              <h2 className={styles.blockTitle}>Как добраться</h2>
              <p className={styles.mapAddress}>
                📍 г. Минск, ул. Московская, 15А
              </p>
              <div className={styles.mapHints}>
                <div className={styles.mapHint}>
                  <span className={styles.mapHintIcon}>🚇</span>
                  <span>м. Институт культуры, выход №1, далее 3 мин пешком на север</span>
                </div>
                <div className={styles.mapHint}>
                  <span className={styles.mapHintIcon}>🚌</span>
                  <span>Автобусы 8, 36, 51 — остановка «м. Институт культуры»</span>
                </div>
                <div className={styles.mapHint}>
                  <span className={styles.mapHintIcon}>🚗</span>
                  <span>Бесплатная парковка у здания для гостей</span>
                </div>
              </div>
              {/* Яндекс Карта */}
              <div className={styles.mapWrapper}>
                <iframe
                  title="IaaS Cloud на Яндекс Картах"
                  src="https://yandex.ru/map-widget/v1/?ll=27.538969%2C53.887321&z=17&pt=27.538969%2C53.887321%2Cpm2rdm&text=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA%2C%20%D0%9C%D0%BE%D1%81%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B0%D1%8F%2015%D0%90"
                  width="100%"
                  height="400"
                  style={{ border: 0, borderRadius: '12px', display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <a
                href="https://yandex.ru/maps/org/institut_biznesa_belorusskogo_gosudarstvennogo_universiteta/166062970974/?from=mapframe"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mapExternalLink}
              >
                Открыть на Яндекс Картах →
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ── Футер ──────────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.navLogo}>
            <span className={styles.navLogoMark}>⬡</span>
            <span className={styles.navLogoText}>IaaS<em>Cloud</em></span>
          </div>
          <p className={styles.footerMeta}>
            © 2025 IaaS Cloud · ООО «АйЭаС Клауд», УНП 191234567, г. Минск
          </p>
        </div>
      </footer>

    </div>
  )
}
