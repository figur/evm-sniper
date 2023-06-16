import blessed from 'blessed';

import focus from './focus.js';
import spinner from './spinner.js';
import Dashboard from './dashboard.js';
// import Logs from './logs.js';
import { NavBar } from './navbar.js';
import chainPrompt from './chains.js';
import itemPrompt from './itemList.js';
// Here we are destructuring specific functions from the `blessed` library
const { setContent, setLabel } = blessed.element.prototype;

export default { focus, spinner, setContent, setLabel, Dashboard, NavBar, chainPrompt, itemPrompt };
