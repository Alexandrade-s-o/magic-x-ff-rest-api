/* eslint-disable @next/next/no-img-element -- catalog artwork can use any validated HTTP(S) image host. */
'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '@/lib/api';
import type {
  Card,
  CardPage,
  CollectionEntry,
  CollectionPage,
  CollectionSummary,
  PublicUser,
  SetInfo,
} from '@/types/magic';
import { AddCardModal } from '@/features/admin/AddCardModal';
import { LoginModal, type AuthMode } from '@/features/auth/LoginModal';
import { AdvisorPanel } from '@/features/advisor/AdvisorPanel';
import { SpeakButton } from '@/features/a11y/SpeakButton';
import { useSpeech, type SpeechSegment } from '@/features/a11y/useSpeech';
import { VirtualizedCardGrid } from '@/features/magic/VirtualizedCardGrid';
import { useI18n } from '@/features/i18n/I18nProvider';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';
import { errorText } from '@/features/i18n/errors';
import { rarityLabel, setName } from '@/features/i18n/labels';
import { format, type Dictionary, type Locale } from '@/i18n';

// Skeleton loading components
const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-img" />
    <div className="skeleton-content">
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  </div>
);

const SkeletonGrid = ({ count = 12 }) => (
  <div className="skeleton-grid">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

const fallbackImage = '/img/MTG.png';

/**
 * Lo que lee «Escuchar carta»: los rótulos en el idioma de la página y el
 * nombre, el tipo y el texto de la carta (oficiales, en inglés) con voz inglesa.
 */
function cardSpeech(
  card: Card,
  dict: Dictionary,
  lang: Locale,
): SpeechSegment[] {
  const t = dict.card;
  const segments: SpeechSegment[] = [
    { lang: 'en', text: `${card.name}.` },
    {
      lang,
      text: format(t.speechRarity, {
        rarity: rarityLabel(card.rarity.name, dict),
      }),
    },
    { lang: 'en', text: `${card.cardType.name}.` },
  ];
  if (card.manaCost) {
    segments.push({
      lang,
      text: format(t.speechCost, { cost: card.manaCost }),
    });
  }
  if (card.oracleText) {
    segments.push(
      { lang, text: t.speechText },
      { lang: 'en', text: card.oracleText },
    );
  }
  if (card.power && card.toughness) {
    segments.push({
      lang,
      text: format(t.speechStats, {
        power: card.power,
        toughness: card.toughness,
      }),
    });
  }
  return segments;
}

/** Clase de color de cada colección. */
function setClass(code: string): string {
  return code === 'HOB' ? 'card-hob' : code === 'FRA' ? 'card-fra' : 'card-fin';
}

const CARDS_PER_PAGE = 50;

export default function Home() {
  const { lang, dict } = useI18n();
  const [cards, setCards] = useState<Card[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [rarities, setRarities] = useState<{ name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rarity, setRarity] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  // count null = cargando; error = mensaje ya traducido.
  const [catalogState, setCatalogState] = useState<{
    count: number | null;
    error: string | null;
  }>({ count: null, error: null });
  const [activeTab, setActiveTab] = useState<
    'catalog' | 'sets' | 'mine' | 'advisor'
  >('catalog');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [collectionError, setCollectionError] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const speech = useSpeech();
  const [modal, setModal] = useState<AuthMode | 'add-card' | null>(null);
  const [toast, setToast] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [addCardError, setAddCardError] = useState('');
  const [addCardPending, setAddCardPending] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [foil, setFoil] = useState(false);
  const [loadingCollection, setLoadingCollection] = useState(false);

  const totalSetCards = useMemo(
    () => sets.reduce((total, set) => total + set.totalCards, 0),
    [sets],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem('app_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
      setThemeLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('app_theme', theme);
  }, [theme, themeLoaded]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('jwt_token');
    if (!savedToken || savedToken === 'undefined') {
      window.localStorage.removeItem('jwt_token');
      window.localStorage.removeItem('user_info');
      return;
    }

    let cancelled = false;
    request<PublicUser>('/auth/me', {}, savedToken)
      .then((authenticatedUser) => {
        if (cancelled) return;
        setToken(savedToken);
        setUser(authenticatedUser);
        window.localStorage.setItem(
          'user_info',
          JSON.stringify(authenticatedUser),
        );
      })
      .catch(() => {
        if (cancelled) return;
        window.localStorage.removeItem('jwt_token');
        window.localStorage.removeItem('user_info');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      280,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadCollection = useCallback(
    async (activeToken: string) => {
      setLoadingCollection(true);
      setCollectionError('');
      try {
        const [nextSummary, nextPage] = await Promise.all([
          request<CollectionSummary>('/collections/summary', {}, activeToken),
          request<CollectionPage>('/collections', {}, activeToken),
        ]);
        setSummary(nextSummary);
        setEntries(nextPage.data);
      } catch (error) {
        setCollectionError(errorText(error, dict));
      } finally {
        setLoadingCollection(false);
      }
    },
    [dict],
  );

  useEffect(() => {
    if (!token) return;
    const timeout = window.setTimeout(() => {
      void loadCollection(token);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [token, loadCollection]);

  const loadCards = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogState({ count: null, error: null });
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (rarity) params.set('rarity', rarity);
    if (selectedSet) params.set('setCode', selectedSet);
    params.set('limit', String(CARDS_PER_PAGE));
    params.set('offset', String((currentPage - 1) * CARDS_PER_PAGE));

    try {
      const result = await request<CardPage>(`/cards?${params}`);
      setCards(result.data);
      const totalPagesCalc = Math.ceil(result.meta.total / CARDS_PER_PAGE);
      setTotalPages(totalPagesCalc);
      setHasMore(currentPage < totalPagesCalc);
      setCatalogState({ count: result.data.length, error: null });
      setLoadingMore(false);
      setLoadingCatalog(false);
    } catch (error) {
      setCards([]);
      setCatalogState({ count: null, error: errorText(error, dict) });
      setLoadingMore(false);
      setLoadingCatalog(false);
    }
  }, [debouncedSearch, rarity, selectedSet, currentPage, dict]);

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      request<SetInfo[]>('/cards/sets'),
      request<{ name: string }[]>('/rarities'),
    ])
      .then(([availableSets, availableRarities]) => {
        if (cancelled) return;
        setSets(availableSets);
        setRarities(availableRarities);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast(errorText(error, dict));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showToast, dict]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCards();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadCards]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function selectSet(code: string) {
    setSearch(''); // reset search when switching sets
    setCurrentPage(1);
    setTotalPages(1);
    setHasMore(true);
    setSelectedSet(code);
    setActiveTab('sets');
  }

  function changeTab(tab: 'catalog' | 'sets' | 'mine' | 'advisor') {
    setActiveTab(tab);
    if (tab === 'sets') {
      document
        .getElementById('collections-showcase')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (tab === 'mine' && token) void loadCollection(token);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setLoginPending(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');

    try {
      const login = await request<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const authenticatedUser = await completeAuth(login.access_token);
      showToast(
        format(dict.auth.welcome, { name: authenticatedUser.username }),
      );
    } catch (error) {
      setLoginError(
        errorText(error, dict, { 401: dict.auth.invalidCredentials }),
      );
    } finally {
      setLoginPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (password !== confirmPassword) {
      setLoginError(dict.auth.passwordsMismatch);
      return;
    }

    setLoginPending(true);
    try {
      const registration = await request<{ access_token: string }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
      );
      const authenticatedUser = await completeAuth(registration.access_token);
      showToast(
        format(dict.auth.registered, { name: authenticatedUser.username }),
      );
    } catch (error) {
      setLoginError(
        errorText(error, dict, {
          400: dict.auth.registerInvalid,
          409: dict.auth.usernameTaken,
        }),
      );
    } finally {
      setLoginPending(false);
    }
  }

  /** Guarda la sesión a partir de un token recién emitido (login o registro). */
  async function completeAuth(accessToken: string | undefined) {
    if (!accessToken) {
      throw new Error(dict.errors.generic);
    }

    const authenticatedUser = await request<PublicUser>(
      '/auth/me',
      {},
      accessToken,
    );
    setToken(accessToken);
    setUser(authenticatedUser);
    window.localStorage.setItem('jwt_token', accessToken);
    window.localStorage.setItem('user_info', JSON.stringify(authenticatedUser));
    setModal(null);
    return authenticatedUser;
  }

  function openAuth(mode: AuthMode) {
    setLoginError('');
    setModal(mode);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setEntries([]);
    setSummary(null);
    window.localStorage.removeItem('jwt_token');
    window.localStorage.removeItem('user_info');
    showToast(dict.auth.loggedOut);
  }

  async function addSelectedCard() {
    if (!token || !selectedCard) {
      openAuth('login');
      return;
    }

    try {
      await request<CollectionEntry>(
        '/collections',
        {
          method: 'POST',
          body: JSON.stringify({
            cardId: selectedCard.id,
            quantity,
            isFoil: foil,
          }),
        },
        token,
      );
      showToast(
        format(dict.collection.added, { quantity, name: selectedCard.name }),
      );
      await loadCollection(token);
    } catch (error) {
      showToast(errorText(error, dict));
    }
  }

  async function updateEntry(entry: CollectionEntry, nextQuantity: number) {
    if (!token) return;
    if (nextQuantity <= 0) {
      await removeEntry(entry.id);
      return;
    }
    try {
      await request<CollectionEntry>(
        `/collections/${entry.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ quantity: nextQuantity }),
        },
        token,
      );
      await loadCollection(token);
    } catch (error) {
      showToast(errorText(error, dict));
    }
  }

  async function removeEntry(id: string) {
    if (!token) return;
    try {
      await request<void>(`/collections/${id}`, { method: 'DELETE' }, token);
      showToast(dict.collection.removed);
      await loadCollection(token);
    } catch (error) {
      showToast(errorText(error, dict));
    }
  }

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setAddCardError('');
    setAddCardPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const stats = String(form.get('stats') ?? '').split('/');

    try {
      await request<Card>(
        '/cards',
        {
          method: 'POST',
          body: JSON.stringify({
            name: String(form.get('name') ?? '').trim(),
            setCode: String(form.get('setCode') ?? 'FIN'),
            rarity: String(form.get('rarity') ?? '').trim(),
            type: String(form.get('type') ?? '').trim(),
            collectorNumber: String(form.get('collectorNumber') ?? '').trim(),
            manaCost: String(form.get('manaCost') ?? '').trim() || null,
            power: stats.length > 1 ? stats[0].trim() || null : null,
            toughness: stats.length > 1 ? stats[1].trim() || null : null,
            oracleText: String(form.get('oracleText') ?? '').trim() || null,
            artist: String(form.get('artist') ?? '').trim() || null,
            imageUrl: String(form.get('imageUrl') ?? '').trim() || null,
          }),
        },
        token,
      );
      setModal(null);
      formElement.reset();
      showToast(dict.admin.saved);
      const availableSets = await request<SetInfo[]>('/cards/sets');
      setSets(availableSets);
      await loadCards();
    } catch (error) {
      setAddCardError(errorText(error, dict));
    } finally {
      setAddCardPending(false);
    }
  }

  const ownedEntries = selectedCard
    ? entries.filter((entry) => entry.cardId === selectedCard.id)
    : [];
  const ownedQuantity = ownedEntries.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );

  const catalogStatus =
    catalogState.error ??
    (catalogState.count === null
      ? dict.catalog.loading
      : (catalogState.count === 1
          ? dict.catalog.showingOne
          : format(dict.catalog.showing, { count: catalogState.count })) +
        (selectedSet
          ? format(dict.catalog.inSet, { set: setName(selectedSet) })
          : ''));

  return (
    <>
      <header className="main-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => changeTab('catalog')}
            type="button"
          >
            <img
              src="/img/magic-logo.svg"
              alt={dict.header.logoAlt}
              className="brand-logo-img"
            />
            <span className="brand-divider" />
            <span className="brand-subtitle-badge">{dict.header.subtitle}</span>
          </button>
          <div className="header-actions">
            <LanguageSwitcher />
            <button
              className="btn btn-outline btn-icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={dict.header.toggleTheme}
              aria-label={dict.header.toggleTheme}
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d={
                    theme === 'dark'
                      ? 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z'
                      : 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z'
                  }
                />
              </svg>
            </button>
            {user?.role === 'ADMINISTRATOR' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setModal('add-card')}
                type="button"
              >
                {dict.header.newCard}
              </button>
            )}
            {user ? (
              <div className="header-user">
                <span>
                  <strong>{user.username}</strong>
                  <small>{user.role}</small>
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={logout}
                  type="button"
                >
                  {dict.header.logout}
                </button>
              </div>
            ) : (
              <>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => openAuth('register')}
                  type="button"
                >
                  {dict.header.register}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => openAuth('login')}
                  type="button"
                >
                  {dict.header.login}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="app-container">
        <nav className="tabs-nav" aria-label={dict.tabs.navLabel}>
          <button
            className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => changeTab('catalog')}
            type="button"
          >
            {dict.tabs.catalog}
          </button>
          <button
            className={`tab-btn ${activeTab === 'sets' ? 'active' : ''}`}
            onClick={() => changeTab('sets')}
            type="button"
          >
            {dict.tabs.sets}
            <span className="tab-badge">
              {format(dict.tabs.setsBadge, { count: sets.length })}
            </span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'mine' ? 'active' : ''}`}
            onClick={() => changeTab('mine')}
            type="button"
          >
            {dict.tabs.mine}
            <span className="tab-badge">{summary?.totalCards ?? 0}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'advisor' ? 'active' : ''}`}
            onClick={() => changeTab('advisor')}
            type="button"
          >
            {dict.tabs.advisor}
            <span className="tab-badge">{dict.tabs.newBadge}</span>
          </button>
        </nav>

        {activeTab === 'advisor' ? (
          <AdvisorPanel
            key={user?.username ?? 'guest'}
            token={token}
            username={user?.username ?? null}
            onLogin={() => openAuth('login')}
            onRegister={() => openAuth('register')}
          />
        ) : activeTab !== 'mine' ? (
          <section>
            <div className="collections-section" id="collections-showcase">
              <div className="collections-header">
                <div>
                  <h2 className="section-title">{dict.sets.title}</h2>
                  <p className="section-subtitle">{dict.sets.subtitle}</p>
                </div>
                {selectedSet && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => selectSet('')}
                    type="button"
                  >
                    {dict.sets.showAll}
                  </button>
                )}
              </div>
              <div className="collections-grid">
                <button
                  className={`collection-hero-card card-hob ${selectedSet === 'HOB' ? 'active' : ''}`}
                  onClick={() => selectSet('HOB')}
                  type="button"
                >
                  <span className="collection-info">
                    <img
                      src="/img/sauron-ring.jpg"
                      className="franchise-thumb"
                      alt={dict.sets.hobbitAlt}
                    />
                    <span className="collection-meta">
                      <strong>The Hobbit</strong>
                      <span>
                        {format(dict.sets.registered, {
                          count:
                            sets.find((set) => set.setCode === 'HOB')
                              ?.totalCards ?? 0,
                        })}
                      </span>
                    </span>
                  </span>
                  <span className="collection-pill-code">HOB</span>
                </button>
                <button
                  className={`collection-hero-card card-fin ${selectedSet === 'FIN' ? 'active' : ''}`}
                  onClick={() => selectSet('FIN')}
                  type="button"
                >
                  <span className="collection-info">
                    <img
                      src="/img/cloud-sword.jpg"
                      className="franchise-thumb"
                      alt={dict.sets.finalFantasyAlt}
                    />
                    <span className="collection-meta">
                      <strong>Final Fantasy</strong>
                      <span>
                        {format(dict.sets.registered, {
                          count:
                            sets.find((set) => set.setCode === 'FIN')
                              ?.totalCards ?? 0,
                        })}
                      </span>
                    </span>
                  </span>
                  <span className="collection-pill-code">FIN</span>
                </button>
                <button
                  className={`collection-hero-card card-fra ${selectedSet === 'FRA' ? 'active' : ''}`}
                  onClick={() => selectSet('FRA')}
                  type="button"
                >
                  <span className="collection-info">
                    <img
                      src="/img/MTG.png"
                      className="franchise-thumb"
                      alt={dict.sets.realityFractureAlt}
                    />
                    <span className="collection-meta">
                      <strong>Reality Fracture</strong>
                      <span>
                        {format(dict.sets.registered, {
                          count:
                            sets.find((set) => set.setCode === 'FRA')
                              ?.totalCards ?? 0,
                        })}
                      </span>
                    </span>
                  </span>
                  <span className="collection-pill-code">FRA</span>
                </button>
                <button
                  className={`collection-hero-card card-all ${selectedSet === '' ? 'active' : ''}`}
                  onClick={() => selectSet('')}
                  type="button"
                >
                  <span className="collection-info">
                    <span className="all-sets-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
                      </svg>
                    </span>
                    <span className="collection-meta">
                      <strong>{dict.sets.allTitle}</strong>
                      <span>
                        {format(dict.sets.allTotal, { count: totalSetCards })}
                      </span>
                    </span>
                  </span>
                  <span className="collection-pill-code">
                    {dict.sets.allCode}
                  </span>
                </button>
              </div>
            </div>

            <div className="filter-bar">
              <div className="search-wrapper">
                <svg
                  className="search-icon-svg"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
                <input
                  type="search"
                  className="search-input"
                  placeholder={dict.catalog.searchPlaceholder}
                  aria-label={dict.catalog.searchLabel}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <select
                className="select-input"
                aria-label={dict.catalog.rarityFilter}
                value={rarity}
                onChange={(event) => setRarity(event.target.value)}
              >
                <option value="">{dict.catalog.allRarities}</option>
                {rarities.map((item) => (
                  <option value={item.name} key={item.name}>
                    {rarityLabel(item.name, dict)}
                  </option>
                ))}
              </select>
            </div>

            <div className="status-bar">
              <span>{catalogStatus}</span>
              {selectedSet && (
                <span className="active-collection-banner">
                  {format(dict.catalog.activeSet, {
                    set: `${setName(selectedSet)} (${selectedSet})`,
                  })}
                </span>
              )}
            </div>

            <main className="cards-grid">
              {loadingCatalog && !cards.length ? (
                <SkeletonGrid count={12} />
              ) : cards.length ? (
                <VirtualizedCardGrid
                  cards={cards}
                  onCardSelect={(card) => {
                    setSelectedCard(card);
                    setQuantity(1);
                    setFoil(false);
                  }}
                />
              ) : (
                <div className="empty-state">
                  <h3>
                    {catalogState.error
                      ? dict.catalog.loadError
                      : dict.catalog.empty}
                  </h3>
                  <p>{catalogState.error ?? dict.catalog.emptyHint}</p>
                </div>
              )}
            </main>
            {hasMore && cards.length > 0 && !loadingMore && (
              <div className="load-more-wrapper">
                <button
                  className="btn btn-outline"
                  onClick={handleLoadMore}
                  type="button"
                >
                  {dict.catalog.loadMore}
                </button>
              </div>
            )}
            {loadingMore && (
              <div className="loading-more">{dict.catalog.loadingMore}</div>
            )}
          </section>
        ) : (
          <section className="user-collection-section">
            <div className="collections-header">
              <div>
                <h2 className="section-title">{dict.collection.title}</h2>
                <p className="section-subtitle">{dict.collection.subtitle}</p>
              </div>
            </div>
            {!token ? (
              <div className="collection-auth-warning">
                <h3>{dict.collection.authTitle}</h3>
                <p>{dict.collection.authText}</p>
                <div className="auth-warning-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openAuth('login')}
                    type="button"
                  >
                    {dict.header.login}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => openAuth('register')}
                    type="button"
                  >
                    {dict.auth.submitRegister}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {collectionError && (
                  <div className="collection-error" role="alert">
                    {collectionError}
                  </div>
                )}
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <span className="kpi-label">
                      {dict.collection.totalCards}
                    </span>
                    <span className="kpi-value">
                      {summary?.totalCards ?? 0}
                    </span>
                    <span className="kpi-sub">
                      {dict.collection.totalCardsSub}
                    </span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-label">
                      {dict.collection.uniqueCards}
                    </span>
                    <span className="kpi-value">
                      {summary?.uniqueCards ?? 0}
                    </span>
                    <span className="kpi-sub">
                      {dict.collection.uniqueCardsSub}
                    </span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-label">
                      {dict.collection.byRarity}
                    </span>
                    <span className="kpi-value kpi-rarities">
                      {summary
                        ? Object.entries(summary.byRarity)
                            .map(
                              ([name, count]) =>
                                `${rarityLabel(name, dict)}: ${count}`,
                            )
                            .join(' · ') || dict.collection.noCards
                        : '—'}
                    </span>
                    <span className="kpi-sub">
                      {dict.collection.byRaritySub}
                    </span>
                  </div>
                </div>
                {loadingCollection ? (
                  <p className="collection-loading">
                    {dict.collection.loading}
                  </p>
                ) : entries.length ? (
                  <div className="collection-list">
                    {entries.map((entry) => (
                      <article className="collection-entry-item" key={entry.id}>
                        <img
                          src={entry.card.imageUrl || fallbackImage}
                          className="entry-thumbnail"
                          alt={entry.card.name}
                          onError={(event) => {
                            event.currentTarget.src = fallbackImage;
                          }}
                        />
                        <div className="entry-details">
                          <strong className="entry-title">
                            {entry.card.name}
                          </strong>
                          <div className="entry-badges">
                            <span
                              className={`collection-pill-code ${setClass(entry.card.setCode)}`}
                            >
                              {entry.card.setCode}
                            </span>
                            <span className="badge">
                              {rarityLabel(entry.card.rarity.name, dict)}
                            </span>
                            {entry.isFoil && (
                              <span className="entry-foil-badge">FOIL</span>
                            )}
                          </div>
                        </div>
                        <div className="entry-actions">
                          <div className="qty-counter">
                            <button
                              className="qty-btn"
                              onClick={() =>
                                void updateEntry(entry, entry.quantity - 1)
                              }
                              title={dict.collection.decrease}
                              aria-label={dict.collection.decrease}
                              type="button"
                            >
                              -
                            </button>
                            <span className="qty-display">
                              {entry.quantity}
                            </span>
                            <button
                              className="qty-btn"
                              onClick={() =>
                                void updateEntry(entry, entry.quantity + 1)
                              }
                              title={dict.collection.increase}
                              aria-label={dict.collection.increase}
                              type="button"
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="btn btn-outline btn-sm remove-entry"
                            onClick={() => void removeEntry(entry.id)}
                            type="button"
                          >
                            {dict.collection.remove}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-collection">
                    <h4>{dict.collection.emptyTitle}</h4>
                    <p>{dict.collection.emptyText}</p>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {selectedCard && (
        <div
          className="modal-backdrop active"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedCard(null);
          }}
        >
          <div className="modal-content">
            <button
              className="close-btn"
              onClick={() => setSelectedCard(null)}
              aria-label={dict.card.close}
              type="button"
            >
              ×
            </button>
            <div className="detail-grid">
              <div className="detail-img-col">
                <img
                  src={selectedCard.imageUrl || fallbackImage}
                  alt={selectedCard.name}
                  className="detail-img"
                  onError={(event) => {
                    event.currentTarget.src = fallbackImage;
                  }}
                />
                <div className="detail-pills">
                  <span
                    className={`collection-pill-code ${setClass(selectedCard.setCode)}`}
                  >
                    {selectedCard.setCode}
                  </span>
                  <span className="badge">#{selectedCard.collectorNumber}</span>
                </div>
              </div>
              <div className="detail-info">
                <div>
                  <h2 className="detail-title">{selectedCard.name}</h2>
                  <SpeakButton
                    id={`card-${selectedCard.id}`}
                    segments={cardSpeech(selectedCard, dict, lang)}
                    speech={speech}
                    label={dict.card.listen}
                  />
                  <div className="card-badges detail-badges">
                    <span className="badge">
                      {rarityLabel(selectedCard.rarity.name, dict)}
                    </span>
                    <span className="badge">{selectedCard.cardType.name}</span>
                    <span className="badge">
                      {selectedCard.manaCost
                        ? format(dict.card.mana, {
                            cost: selectedCard.manaCost,
                          })
                        : dict.card.noCost}
                    </span>
                  </div>
                </div>
                <div className="detail-field">
                  <span className="detail-label">{dict.card.oracleLabel}</span>
                  <div className="oracle-box">
                    {selectedCard.oracleText || dict.card.noOracle}
                  </div>
                </div>
                <div className="detail-stats-grid">
                  <div className="detail-field">
                    <span className="detail-label">{dict.card.statsLabel}</span>
                    <span className="detail-value">
                      {selectedCard.power || selectedCard.toughness
                        ? `${selectedCard.power || '?'} / ${selectedCard.toughness || '?'}`
                        : dict.card.notApplicable}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">{dict.card.setLabel}</span>
                    <span className="detail-value">
                      {`${setName(selectedCard.setCode)} (${selectedCard.setCode})`}
                    </span>
                  </div>
                </div>
                <div className="detail-field">
                  <span className="detail-label">{dict.card.artistLabel}</span>
                  <span className="detail-value">
                    {selectedCard.artist || dict.card.unknownArtist}
                  </span>
                </div>
                <div className="add-to-coll-box">
                  <h4>{dict.card.saveTitle}</h4>
                  {!token ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openAuth('login')}
                      type="button"
                    >
                      {dict.card.loginToSave}
                    </button>
                  ) : (
                    <>
                      {ownedQuantity > 0 && (
                        <p className="owned-message">
                          {ownedQuantity === 1
                            ? dict.card.ownedOne
                            : format(dict.card.ownedMany, {
                                count: ownedQuantity,
                              })}
                          {ownedEntries.some((entry) => entry.isFoil)
                            ? dict.card.ownedFoil
                            : ''}
                          .
                        </p>
                      )}
                      <div className="coll-form-row">
                        <label className="foil-control">
                          <input
                            type="checkbox"
                            checked={foil}
                            onChange={(event) => setFoil(event.target.checked)}
                          />
                          {dict.card.foil}
                        </label>
                        <label className="quantity-control">
                          {dict.card.quantity}
                          <input
                            type="number"
                            value={quantity}
                            min={1}
                            max={99}
                            onChange={(event) =>
                              setQuantity(
                                Math.max(
                                  1,
                                  Math.min(99, Number(event.target.value)),
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => void addSelectedCard()}
                          type="button"
                        >
                          {dict.card.add}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(modal === 'login' || modal === 'register') && (
        <LoginModal
          mode={modal}
          error={loginError}
          pending={loginPending}
          onClose={() => setModal(null)}
          onSubmit={modal === 'register' ? handleRegister : handleLogin}
          onSwitchMode={openAuth}
        />
      )}

      {modal === 'add-card' && user?.role === 'ADMINISTRATOR' && (
        <AddCardModal
          error={addCardError}
          pending={addCardPending}
          onClose={() => setModal(null)}
          onSubmit={createCard}
        />
      )}

      {toast && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className="toast">{toast}</div>
        </div>
      )}
    </>
  );
}
