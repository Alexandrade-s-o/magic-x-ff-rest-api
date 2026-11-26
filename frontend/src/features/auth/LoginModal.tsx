'use client';

import type { FormEventHandler } from 'react';
import { useI18n } from '@/features/i18n/I18nProvider';

export type AuthMode = 'login' | 'register';

type LoginModalProps = {
  mode: AuthMode;
  error: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onSwitchMode: (mode: AuthMode) => void;
};

export function LoginModal({
  mode,
  error,
  pending,
  onClose,
  onSubmit,
  onSwitchMode,
}: LoginModalProps) {
  const { dict } = useI18n();
  const t = dict.auth;
  const isRegister = mode === 'register';

  return (
    <div
      className="modal-backdrop active"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content login-modal">
        <button
          className="close-btn"
          onClick={onClose}
          aria-label={t.close}
          type="button"
        >
          ×
        </button>
        <div className="modal-heading">
          <h2>{isRegister ? t.registerTitle : t.loginTitle}</h2>
          <p>{isRegister ? t.registerSubtitle : t.loginSubtitle}</p>
        </div>
        {/* key: al cambiar de modo se monta un formulario limpio */}
        <form onSubmit={onSubmit} key={mode}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">
              {t.username}
            </label>
            <input
              className="search-input form-input"
              id="login-username"
              name="username"
              required
              autoComplete="username"
              {...(isRegister && {
                minLength: 3,
                maxLength: 30,
                pattern: '[A-Za-z0-9_.\\-]{3,30}',
                title: t.usernameHint,
                'aria-describedby': 'register-username-hint',
              })}
            />
            {isRegister && (
              <p className="form-hint" id="register-username-hint">
                {t.usernameHint}
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              {t.password}
            </label>
            <input
              className="search-input form-input"
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              {...(isRegister && { minLength: 8, maxLength: 128 })}
            />
          </div>
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="register-confirm">
                {t.confirmPassword}
              </label>
              <input
                className="search-input form-input"
                id="register-confirm"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn btn-primary submit-button"
            type="submit"
            disabled={pending}
          >
            {isRegister
              ? pending
                ? t.submitRegisterPending
                : t.submitRegister
              : pending
                ? t.submitLoginPending
                : t.submitLogin}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? t.haveAccount : t.noAccount}{' '}
          <button
            className="link-button"
            type="button"
            onClick={() => onSwitchMode(isRegister ? 'login' : 'register')}
          >
            {isRegister ? t.loginLink : t.registerLink}
          </button>
        </p>
      </div>
    </div>
  );
}
