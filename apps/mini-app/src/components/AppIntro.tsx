import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { BRAND, COPY } from '@tuckly/contracts';

import { UI_TIMING_MS } from '../constants/timing';
import { spaceThemeStyle } from '../lib/space-theme';
import { useLaunchVisibility } from '../lib/use-launch-visibility';

import { BrandLogo } from './BrandLogo';

import './app-intro.css';

declare global {
  interface Window {
    __TUCKLY_LOGO_STARTED_AT__?: number;
  }
}

type IntroPhase = 'loading' | 'settling' | 'leaving' | 'done';

export function AppIntro({ ready, children }: { ready: boolean; children: ReactNode }) {
  // Synchronize decorative loops across HTML and React. This clock never
  // delays opening the ready catalogue.
  const [logoElapsed] = useState(() =>
    window.__TUCKLY_LOGO_STARTED_AT__ === undefined
      ? 0
      : Math.max(0, performance.now() - window.__TUCKLY_LOGO_STARTED_AT__),
  );
  const [phase, setPhase] = useState<IntroPhase>('loading');
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const view = useLaunchVisibility();
  const visible = phase !== 'done';
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (phase === 'loading' && ready && view.active) {
      setPhase('settling');
    }
  }, [phase, ready, view.active]);
  useEffect(() => {
    if (phase !== 'settling' || !ready || !view.active) {
      return;
    }
    // Restore scrolling behind the opaque loader, then allow ResizeObserver
    // and the virtual list to settle before the crossfade exposes the page.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPhase(reducedMotion ? 'done' : 'leaving'));
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, ready, view.active, reducedMotion]);
  useEffect(() => {
    if (phase === 'leaving' && reducedMotion) {
      setPhase('done');
    }
  }, [phase, reducedMotion]);
  useLayoutEffect(() => {
    if (phase !== 'loading') {
      return;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== 'leaving' || !view.active) {
      return;
    }
    const timer = window.setTimeout(
      () => setPhase('done'),
      UI_TIMING_MS.appIntroExit + UI_TIMING_MS.appIntroFinishGrace,
    );
    return () => window.clearTimeout(timer);
  }, [phase, view.active]);
  return (
    <>
      <div inert={visible} aria-hidden={visible ? true : undefined}>
        {children}
      </div>
      {visible && (
        <div
          className={[
            'app-intro',
            phase === 'leaving' && 'app-intro-leaving',
            !view.active && 'app-intro-paused',
          ]
            .filter(Boolean)
            .join(' ')}
          data-phase={phase}
          style={
            {
              ...spaceThemeStyle('sage'),
              '--intro-logo-elapsed': `${-logoElapsed}ms`,
              '--intro-exit-duration': `${UI_TIMING_MS.appIntroExit}ms`,
            } as CSSProperties
          }
          onAnimationEnd={event => {
            if (event.target === event.currentTarget && event.animationName === 'intro-dismiss') {
              setPhase('done');
            }
          }}
        >
          <div className={'app-intro-content'}>
            <div className={'app-intro-logo'} role={'img'} aria-label={BRAND.name}>
              <BrandLogo animated />
            </div>
            <p className={'app-intro-loading'} role={'status'}>
              {COPY.loadingApp}
            </p>
            <div className={'app-intro-dots'} aria-hidden={'true'}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
