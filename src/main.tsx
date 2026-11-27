import { render } from 'preact';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/components/App.css';
import './ui/components/Jam.css';
import './ui/components/Panel.css';
import './ui/components/Picker.css';
import './ui/components/Saved.css';
import { App } from './ui/components/App';
import { configureJam, initJam } from './ui/state/jam';
import { engine } from './ui/state/playback';
import './ui/state/sound';
import { configureSaved } from './ui/state/saved';
import { announce, showStatus } from './ui/state/ui';

configureJam({ sink: engine, announce });
configureSaved({ onStorageFailed: () => showStatus('This browser won’t keep saved progressions after you close the page.', 5000) });
initJam();
render(<App />, document.getElementById('app')!);
