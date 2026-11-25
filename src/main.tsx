import { render } from 'preact';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/components/App.css';
import './ui/components/Carousel.css';
import './ui/components/Panel.css';
import './ui/components/Picker.css';
import { App } from './ui/components/App';
import { configureJam, initJam } from './ui/state/jam';
import { engine } from './ui/state/playback';
import './ui/state/sound';
import { announce } from './ui/state/ui';

configureJam({ sink: engine, announce });
initJam();
render(<App />, document.getElementById('app')!);
