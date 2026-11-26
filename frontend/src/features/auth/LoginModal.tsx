import type { FormEventHandler } from 'react';

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
          aria-label="Cerrar"
          type="button"
        >
          ×
        </button>
        <div className="modal-heading">
          <h2>{isRegister ? 'Crear cuenta' : 'Iniciar Sesión'}</h2>
          <p>
            {isRegister
              ? 'Regístrate para guardar tu propia colección de cartas'
              : 'Accede para administrar tu inventario de cartas'}
          </p>
        </div>
        {/* key: al cambiar de modo se monta un formulario limpio */}
        <form onSubmit={onSubmit} key={mode}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">
              Usuario
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
                title:
                  'Entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo',
                'aria-describedby': 'register-username-hint',
              })}
            />
            {isRegister && (
              <p className="form-hint" id="register-username-hint">
                3 a 30 caracteres: letras, números, punto, guion o guion bajo.
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Contraseña
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
                Confirmar contraseña
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
                ? 'Creando cuenta...'
                : 'Crear cuenta'
              : pending
                ? 'Ingresando...'
                : 'Ingresar'}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            className="link-button"
            type="button"
            onClick={() => onSwitchMode(isRegister ? 'login' : 'register')}
          >
            {isRegister ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </div>
  );
}
