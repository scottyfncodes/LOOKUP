import { useEffect, useState } from 'react';
import { More } from './screens/More';
import { Sites } from './screens/Sites';
import { Sky } from './screens/Sky';
import { Tonight } from './screens/Tonight';
import { Week } from './screens/Week';
import { setPrefs, usePrefs } from './store/store';
import { useNightData } from './store/useNightData';

type Tab = 'tonight' | 'sites' | 'week' | 'sky' | 'more';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'tonight', label: 'Tonight', icon: 'M12 2l2.4 6.6L21 9l-5 4.2L17.5 20 12 16.5 6.5 20 8 13.2 3 9l6.6-.4z' },
  { id: 'sites', label: 'Sites', icon: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z' },
  { id: 'week', label: 'Later', icon: 'M7 2v3M17 2v3M4 8h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { id: 'sky', label: 'Sky', icon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z' },
  { id: 'more', label: 'More', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zm8.9 5l-2 .3a7 7 0 01-.7 1.7l1.2 1.6-1.8 1.8-1.6-1.2a7 7 0 01-1.7.7l-.3 2h-2.5l-.3-2a7 7 0 01-1.7-.7L7.9 20.4 6.1 18.6l1.2-1.6a7 7 0 01-.7-1.7l-2-.3v-2.5l2-.3a7 7 0 01.7-1.7L6.1 7.9l1.8-1.8 1.6 1.2a7 7 0 011.7-.7l.3-2h2.5l.3 2a7 7 0 011.7.7l1.6-1.2 1.8 1.8-1.2 1.6a7 7 0 01.7 1.7l2 .3z' },
];

export default function App() {
  const prefs = usePrefs();
  const [tab, setTab] = useState<Tab>('tonight');
  const data = useNightData();

  useEffect(() => {
    document.documentElement.dataset.red = prefs.redMode ? 'true' : 'false';
  }, [prefs.redMode]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="app">
      <main className="main">
        <div className="topbar">
          <div>
            <div className="display brand">LOOKUP</div>
            <div className="tagline">Is tonight worth going out for?</div>
          </div>
          <button className="iconbtn" aria-pressed={prefs.redMode} aria-label="Night-vision mode" title="Night-vision mode" onClick={() => setPrefs({ redMode: !prefs.redMode })}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3.5" /><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /></svg>
          </button>
        </div>

        {tab === 'tonight' && <Tonight data={data} go={setTab} />}
        {tab === 'sites' && <Sites data={data} onPicked={() => setTab('tonight')} />}
        {tab === 'week' && <Week data={data} onPickNight={() => setTab('tonight')} />}
        {tab === 'sky' && <Sky data={data} />}
        {tab === 'more' && <More />}
      </main>

      <nav className="nav" aria-label="Sections">
        <div className="inner">
          {TABS.map((t) => (
            <button key={t.id} aria-current={tab === t.id} onClick={() => setTab(t.id)}>
              <svg viewBox="0 0 24 24" fill={t.id === 'tonight' || t.id === 'sites' || t.id === 'more' || t.id === 'sky' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={t.id === 'week' ? 2 : 0} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
