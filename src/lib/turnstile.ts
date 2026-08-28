import { getBrowserEnv } from './env';

export type TurnstileAction = 'report-incident' | 'record-observation';

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: 'invisible';
      callback: (token: string) => void;
      'error-callback': () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const finish = (): void => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error('Verification failed to load'));
      }
    };

    if (existing) {
      existing.addEventListener('load', finish);
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error('Verification failed to load'));
    document.head.appendChild(script);
  });
}

export function isTurnstileConfigured(): boolean {
  try {
    return Boolean(getBrowserEnv().turnstileSiteKey);
  } catch {
    return false;
  }
}

export async function requestTurnstileToken(
  action: TurnstileAction,
): Promise<string> {
  const { turnstileSiteKey } = getBrowserEnv();
  if (!turnstileSiteKey) {
    throw new Error('Verification is not configured');
  }

  const api = await loadScript();
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  document.body.appendChild(element);

  return new Promise((resolve, reject) => {
    const cleanup = (widgetId: string): void => {
      api.remove(widgetId);
      element.remove();
    };

    const widgetId = api.render(element, {
      sitekey: turnstileSiteKey,
      action,
      size: 'invisible',
      callback: (token) => {
        cleanup(widgetId);
        resolve(token);
      },
      'error-callback': () => {
        cleanup(widgetId);
        reject(new Error('Verification failed'));
      },
    });
    api.execute(widgetId);
  });
}
