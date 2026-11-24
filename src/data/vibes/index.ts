// The v1 vibes, in display order. Each file is plain data validated by parseVibe on load.
import { parseVibe, type Vibe } from '../../theory/vibe';
import neoSoul from './neo-soul.json';
import blues from './blues.json';
import soulRoots from './soul-roots.json';
import heartland from './heartland.json';
import dreamy from './dreamy.json';
import desertGroove from './desert-groove.json';

export const VIBES: readonly Vibe[] = [neoSoul, blues, soulRoots, heartland, dreamy, desertGroove].map(parseVibe);

export function vibeById(id: string): Vibe | undefined {
  return VIBES.find((v) => v.id === id);
}
