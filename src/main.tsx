import { render } from 'preact';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { App } from './ui/components/App';
import { initJam } from './ui/state/jam';

initJam();
render(<App />, document.getElementById('app')!);
