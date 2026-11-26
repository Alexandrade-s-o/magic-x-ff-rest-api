'use client';

import type { FormEventHandler } from 'react';
import { useI18n } from '@/features/i18n/I18nProvider';
import { FormInput } from './FormInput';

type AddCardModalProps = {
  error: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function AddCardModal({
  error,
  pending,
  onClose,
  onSubmit,
}: AddCardModalProps) {
  const { dict } = useI18n();
  const t = dict.admin;
  return (
    <div
      className="modal-backdrop active"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button
          className="close-btn"
          onClick={onClose}
          aria-label={t.close}
          type="button"
        >
          ×
        </button>
        <h2 className="add-card-heading">{t.title}</h2>
        <p className="add-card-subtitle">{t.subtitle}</p>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <FormInput name="name" label={t.name} required />
            <div className="form-group">
              <label className="form-label" htmlFor="card-set">
                {t.set}
              </label>
              <select
                id="card-set"
                className="select-input"
                name="setCode"
                required
                defaultValue="HOB"
              >
                <option value="HOB">The Hobbit (HOB)</option>
                <option value="FIN">Final Fantasy (FIN)</option>
                <option value="FRA">Reality Fracture (FRA)</option>
              </select>
            </div>
            <FormInput
              name="rarity"
              label={t.rarity}
              placeholder="mythic, rare, uncommon, common"
              required
            />
            <FormInput
              name="type"
              label={t.type}
              placeholder="Legendary Creature — Halfling..."
              required
            />
            <FormInput
              name="collectorNumber"
              label={t.collectorNumber}
              required
            />
            <FormInput name="manaCost" label={t.manaCost} />
            <FormInput
              name="stats"
              label={t.stats}
              placeholder={t.statsPlaceholder}
            />
            <FormInput name="artist" label={t.artist} />
            <FormInput name="imageUrl" label={t.imageUrl} type="url" full />
            <div className="form-group full">
              <label className="form-label" htmlFor="card-oracle">
                {t.oracle}
              </label>
              <textarea
                id="card-oracle"
                className="search-input form-input oracle-input"
                name="oracleText"
              />
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="btn btn-outline" onClick={onClose} type="button">
              {t.cancel}
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={pending}
            >
              {pending ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
