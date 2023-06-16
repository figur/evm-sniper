import blessed from 'blessed';
import { runAll } from './task.js';
import EvmSniper from './evmSniper.js';

const screen = blessed.screen({
  ignoreLocked : ['C-q'],
  fullUnicode  : true,
  dockBorders  : true,
  autoPadding  : false,
});

screen.title = 'EVM Sniper';

screen.key(['q', 'C-q'], (ch, key) => {
  runAll();
  process.exit(0);
});

new EvmSniper(screen);
