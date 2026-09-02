// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { LanguageToggle } from './LanguageToggle';
import { localizedPath, stripLanguagePrefix } from '../i18n/paths';
import '../i18n/index';

afterEach(() => {
  cleanup();
});

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="*" element={<LanguageToggle />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LanguageToggle', () => {
  it('links to the /hi permalink route when viewing an English permalink', () => {
    const slug = `pc-${'a'.repeat(32)}`;
    renderAt(`/r/${slug}`);
    expect(screen.getByText('हिं').getAttribute('href')).toBe(`/hi/r/${slug}`);
    expect(screen.getByText('EN').getAttribute('href')).toBe(`/r/${slug}`);
  });

  it('links back to the bare permalink route when viewing a Hindi permalink', () => {
    const slug = `pc-${'b'.repeat(32)}`;
    renderAt(`/hi/r/${slug}`);
    expect(screen.getByText('EN').getAttribute('href')).toBe(`/r/${slug}`);
    expect(screen.getByText('हिं').getAttribute('href')).toBe(`/hi/r/${slug}`);
  });

  it('preserves the query string across a language switch', () => {
    renderAt('/powercut/bengaluru?from=share');
    expect(screen.getByText('हिं').getAttribute('href')).toBe(
      '/hi/powercut/bengaluru?from=share',
    );
  });
});

describe('locale path helpers round-trip permalinks', () => {
  it('strips and re-adds the /hi prefix without losing the slug', () => {
    const slug = `pc-${'c'.repeat(32)}`;
    expect(stripLanguagePrefix(`/hi/r/${slug}`)).toBe(`/r/${slug}`);
    expect(localizedPath(`/r/${slug}`, 'hi')).toBe(`/hi/r/${slug}`);
    expect(localizedPath(`/r/${slug}`, 'en')).toBe(`/r/${slug}`);
  });
});
