import blessed from 'blessed';
const { setLabel } = blessed.element.prototype;
import until from './spinner.js';
import { scroll, throttle } from './blessed/scroll.js';
import conf from "../conf.js";
const { config, Chain } = conf;
import { log } from '../promise.js';

function evmChainsUI() {
	const box = blessed.box({
		top: 'center',
		left: 'center',
		width: '50%',
		height: '50%',
		label: 'Network',
		border: 'line',
		style: {
			label: { bold: true },
		},
	});

	const list = blessed.with(scroll, throttle).list({
		parent: box,
		height: 'shrink',
		bottom: 0,
		align: 'left',
		top: 4,
		width: '100%',
		keys: true,
		tags: true,
		mouse: true,
		border: 'line',
		invertSelected: false,
		scrollbar: {
			ch: ' ',
			style: { bg: 'white' },
			track: {
				style: { bg: 'grey' },
			},
		},
		style: {
			label: { bold: true },
			selected: { bold: true, fg: 'black', bg: 'white' },
		},
	});

	blessed.text({
		parent: box,
		left: 2,
		top: 2,
		align: 'left',
		content: 'Filter:',
	});

	const search = blessed.textbox({
		parent: box,
		border: 'line',
		width: '100%-11',
		height: 3,
		top: 1,
		right: 1,
		inputOnFocus: true,
	});

	search.options.inputOnFocus = false;

	return { search, box, list };
}

export default function chainPrompt(screen, { current_chain, promptAfterRequest } = { promptAfterRequest: false }) {
	return new Promise(function (fulfill, reject) {
		const { search, box, list } = evmChainsUI();
		let chains = [], message;

		function updateList() {
			const tokens = search.value.split(/\s+/).filter(w => w);
			const items = (chains.items || [])
				.filter(c => tokens.every(token => c.name.includes(token)))
				.map(c => {
					const item = c.name;
					if (search.value.length === 0) {
						if (c.name === current_chain) {
							return `{blue-fg}${item}{/blue-fg}`;
						}
						return item;
					}
					const matches = Buffer.alloc(item.length);
					tokens.forEach(token => {
						const regex = new RegExp(token, 'g');
						let match;
						while ((match = regex.exec(item)) !== null) {
							matches.fill(1, match.index, match.index + token.length);
						}
					});
					let res = '', index = 0, match = false;
					for (let i = 0; i < matches.length; i++) {
						const m = matches.readUInt8(i) > 0;
						if (match == m) continue;
						res += item.substring(index, i);
						res += m ? '{yellow-fg}' : '{/yellow-fg}';
						index = i;
						match = m;
					}
					res += item.substring(index);
					if (item === current_chain) {
						res = `{blue-fg}${res}{/blue-fg}`;
					}
					return res;
				});
			list.setItems(items);
		}

		async function getChains() {
			let result = Chain.getAll();
			if (!result) {
				return { items: [] };
			}
			if (!result.items) {
				return { items: result };
			}
			return result;
		}

		function request_chains() {
			return (getChains())
				.then(result => {
					chains = result;
					if (chains.items.length === 0) {
						list_message('No available chains');
					} else {
						updateList();
						if (current_chain) {
							const selected = chains.items
								.filter(c => c.name.includes(search.value))
								.findIndex(c_1 => c_1.name === current_chain);
							list.select(selected);
							if (selected > list.height / 2 - 1) {
								// Scroll to center the selected item
								list.childOffset += list.height / 2 - 1 | 0;
								list.scrollTo(selected);
							}
						}
						screen.render();
					}
				})
		}

		function prompt_evmChainsUI() {
			screen.saveFocus();
			screen.grabKeys = true;
			screen.grabMouse = true;
			screen.append(box);
		// 	const commandBar = blessed.listbar({
		// 		parent: box,
		// 		bottom: 0,
		// 		left: 0,
		// 		right: 0,
		// 		height: 'shrink',
		// 		mouse: true,
		// 		autoCommandKeys: true,
		// 		style: {
		// 			bg: 'white',
		// 			item: {
		// 				fg: 'black',
		// 				bg: 'white',
		// 				hover: {
		// 					fg: 'white',
		// 					bg: 'grey',
		// 					bold: true,
		// 				},
		// 			},
		// 			selected: {
		// 				fg: 'white',
		// 				bg: 'blue',
		// 			},
		// 		},
		// 		commands: {
		// 			'Add': {
		// 				keys: ['C-a'],
		// 				callback: () => addChain(),
		// 			},
		// 			'Remove': {
		// 				keys: ['C-r'],
		// 				callback: () => removeChain(),
		// 			}
		// 		}
		// 	});
		 	list.grabMouse = true;
		 	screen.render();
		 	search.focus();
		}

		function close_evmChainsUI() {
			box.destroy();
			screen.restoreFocus();
			screen.grabKeys = false;
			screen.grabMouse = false;
			screen.render();
		}

		function list_message(text, options = {}) {
			if (message) message.destroy();
			message = blessed.text(Object.assign({
				parent: box,
				tags: true,
				top: 'center',
				left: 'center',
				content: text,
			}, options));
		}

		search.__oolistener = search._listener;
		search._listener = function (ch, key) {
			if (['up', 'down', 'pageup', 'pagedown', 'enter'].includes(key.name)) {
				return list.emit('keypress', ch, key);
			}
			const ret = this.__oolistener(ch, key);
			if ('escape' === key.name) {
				close_evmChainsUI();
				fulfill(current_chain);
				return ret;
			}
			updateList();
			screen.render();
			return ret;
		};

		list.on('select', item => {
			if (item) {
				close_evmChainsUI();
				const chainName = blessed.helpers.cleanTags(item.getContent());
				const chain = chains.items.find(c => c.name === chainName);
				if (chain) {
					fulfill(chain);
				} else {
					reject(new Error(`Could not find chain with name ${chainName}`));
				}
			}
		});

		if (promptAfterRequest) {
			request_chains()
				.then(prompt_evmChainsUI)
				.catch(error => reject(error));
		} else {
			prompt_evmChainsUI();
			until(request_chains())
				.do(box, setLabel).spin(s => `${s} Chains`).done(_ => 'Chains')
				.catch(error => {
					log(`{red-fg}Error: ${error.message}{/red-fg}`);
					console.error(error.stack);
					screen.render();
				});
		}
	});
}
