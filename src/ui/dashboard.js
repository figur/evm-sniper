import blessed from 'blessed';
import EventEmitter from 'events';
import { Cancellations } from '../task.js';
import { AddEvent, SelectEvent } from './navbar.js';
import focusIndicator from './focus.js';
import { scroll, throttle } from './blessed/scroll.js';
import util from 'util';
import conf from "../conf.js";
import abi from '../abi.js'
import until from './spinner.js';
import prompt from './form.js'

const { setContent, setLabel } = blessed.element.prototype;
const { config, Chain, Wallet, Token } = conf;

class Dashboard extends EventEmitter {

	constructor({ screen, navbar, status, commandBar }) {
		super();
		const cancellations = new Cancellations();
		const dashboard = this;
		let token_list = {};
		this.web3 = null;

		const tokens_table = blessed.with(focusIndicator, scroll, throttle).listtable({
			label: 'Tokens',
			parent: screen,
			left: 0,
			top: 1,
			width: '25%',
			height: '50%-1',
			border: 'line',
			align: 'left',
			keys: true,
			tags: true,
			mouse: true,
			noCellBorders: true,
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
				header: { fg: 'grey' },
				cell: { selected: { bold: true, fg: 'black', bg: 'white' } },
			},
		});

		let tokens_table_text;

		function tokens_table_message(text, options = {}) {
			if (tokens_table_text) tokens_table_text.destroy();
			tokens_table_text = blessed.text(Object.assign({
				parent: tokens_table,
				tags: true,
				top: 'center',
				left: 'center',
				content: text,
			}, options));
		}

		const token_details = blessed.box({
			label: 'Token Details',
			parent: screen,
			left: '25%',
			top: 1,
			right: 0,
			width: '25%',
			height: '50%-1',
			tags: true,
			border: 'line',
			style: {
				label: { bold: true },
			},
		});

		const logBox = blessed.log({
			label: 'Logs',
			top: '50%',
			bottom: '2',
			width: '100%',
			align: 'left',
			tags: true,
			keys: true,
			mouse: true,
			border: 'line',
			style: {
				label: { bold: true },
			},
			scrollbar: {
				ch: ' ',
				style: { bg: 'white' },
				track: {
					style: { bg: 'grey' },
				},
			},
		}).with(focusIndicator, scroll, throttle);

		const writeln = function (line) {
			logBox.log(line);
			if (logBox.attached) {
				screen.render();
			}
		};

		console.log = function (...args) {
			writeln(util.format.apply(util, args));
		}

		console.debug = function (...args) {
			const msg = util.format.apply(util, args.map(a => typeof a === 'object' ? util.inspect(a, { showHidden: true, depth: 5 }) : a));
			writeln(`{grey-fg}${msg}{/grey-fg}`);
		}

		console.error = function (...args) {
			const msg = util.format.apply(util, args.map(a => typeof a === 'object' ? util.inspect(a, { showHidden: true, depth: 5 }) : a));
			writeln(`{red-fg}${msg}{/red-fg}`);
		}

		console.info = function (...args) {
			const msg = util.format.apply(util, args.map(a => typeof a === 'object' ? util.inspect(a, { showHidden: true, depth: 5 }) : a));
			writeln(`{blue-fg}${msg}{/blue-fg}`);
		}

		console.warn = function (...args) {
			const msg = util.format.apply(util, args.map(a => typeof a === 'object' ? util.inspect(a, { showHidden: true, depth: 5 }) : a));
			writeln(`{yellow-fg}${msg}{/yellow-fg}`);
		}

		process.on('uncaughtException', function (err) {
			writeln(`{red-bg}${util.inspect(err, { showHidden: true, depth: 5 })}{/red-bg}`);
			writeln(`{red-bg}${err}{/red-bg}`);
		});

		tokens_table.on('select', async (item, i) => {
			// empty table!
			if (i === 0) return;
			const token = token_list[i - 1];
			//dashboard.log(token.wallet);
			//dashboard.log(token.contract);
			let tokenData = await fetchTokenDetails(token.wallet, token.contract);
			// const containers = token.spec.containers.concat(token.spec.initContainers || []);
			// let container;
			// if (containers.length === 1) {
			// 	if (token.metadata.uid === token_selected && container_selected) {
			// 		return;
			// 	} else {
			// 		container = containers[0];
			// 		container_selected = container.name;
			// 	}
			// } else if (containers.length > 1) {
			// 	if (token.metadata.uid !== token_selected) {
			// 		container_selected = null;
			// 	}
			// 	const i = containers.findIndex(c => c.name === container_selected);
			// 	container = containers[(i + 1) % containers.length];
			// 	container_selected = container.name;
			// }
			// token_selected = token.metadata.uid;
			// cancellations.run('dashboard.token');
			// // just to update the table with the new selection
			// updateTokensTable();
			// // reset the selected token widgets
			// resources.setLabel('Resources');
			// graphs.forEach(g => g.reset());
			// token_log.setLabel('Logs');
			// token_log.reset();
			// screen.render();

			// // a container in a token in Error or CrashLoopBackOff can be waiting,
			// // yet it's possible to query logs from previous runs
			// const status = k8s.containerStatus(token, container);
			// if (k8s.isTokenPending(token) && (!status || status.restartCount == 0)) {
			// 	token_log.setLabel(containerLogsLabel(token, container));
			// 	screen.render();
			// 	// let's the tokens watch request handler deal with the selected container once it's done initializing
			// 	return;
			// }

			// selectContainer(token, container);
		});

		this.on(AddEvent, ({ page }) => {
			page.focus = tokens_table;
		});

		this.on(SelectEvent, ({ screen }) => {
			screen.append(tokens_table);
			screen.append(token_details);
			screen.append(logBox);
			screen.append(status);
			screen.append(commandBar);
			//updatetokensTable();
			screen.render();
		});

		this.reset = function (page) {
			cancellations.run('dashboard');
			// current_chain = null;
			// item_selected = null;
			// token_selected = null;
			// tokens_list = {};
			// tokens_table.setLabel('Tokens');
			// tokens_table.setData([]);
			// if (tokens_table_text) {
			// 	tokens_table_text.destroy();
			// 	tokens_table_text = null;
			// }
			if (tokens_table.detached) {
				page.focus = tokens_table;
			} else {
				tokens_table.focus();
			}
			// screen.append(token_tabs);
			screen.render();
		}

		this.run = function (current_chain, current_wallet) {
			token_list = Token.getAll(current_wallet.public, current_chain.chainId);
			updateTokensTable(token_list);
			screen.render();

			const token_tabs = blessed.listbar({
				parent: dashboard.tokensTable,
				bottom: 1,
				left: 1,
				right: 1,
				height: 'shrink',
				mouse: true,
				style: {
					bg: 'white',
					item: {
						fg: 'black',
						bg: 'white',
						hover: {
							fg: 'white',
							bg: 'grey',
							bold: true,
						},
					},
					selected: {
						fg: 'white',
						bg: 'blue',
					},
				},
				commands: {
					'Add': {
						keys: ['A', 'a'],
						callback: () => addToken(current_wallet.public, current_chain),
					},
					'Remove': {
						keys: ['R', 'r'],
						callback: () => removeToken(),
					},
				},
			});
			// let { promise, cancellation } = client.tokens(current_wallet.public).get({ cancellable: true });
			// promise = until(promise)
			// 	.do(tokens_table, tokens_table.setLabel)
			// 	.spin(s => `${s} Tokens {grey-fg}[${current_wallet.public}]{/grey-fg}`)
			// 	.cancel(c => cancellations.add('dashboard.tokens', c))
			// 	.done(_ => `Tokens {grey-fg}[${current_wallet.public}]{/grey-fg}`)
			// 	.then(response => {
			// 		tokens_list = JSON.parse(response.body.toString('utf8'));
			// 		tokens_list.items = tokens_list.items || [];
			// 		updateTokensTable(tokens);
			// 		screen.render();
			// 	}).catch(error => {
			// 		listTokensError = error;
			// 		tokens_table_message(`{red-bg}Error: ${error.message}{/red-bg}`);
			// 		screen.render();
			// 		return Promise.reject(error);
			// 	});

			// promise
			// 	.then(() => {
			// 		console.debug(`Watching for tokens changes ${current_wallet.public} ...`);
			// 		screen.render();
			// 		const id = setInterval(refreshTokenAges, 1000);
			// 		cancellations.add('dashboard.refreshTokenAges', () => clearInterval(id));
			// 		const { promise, cancellation } = client.tokens(current_wallet.public)
			// 			.watch(tokens_list.metadata.resourceVersion)
			// 			.get({
			// 				generator: function* () {
			// 					yield* watchTokenChanges(current_wallet.public);
			// 				}
			// 			});
			// 		cancellations.add('dashboard.tokens', cancellation);
			// 		return promise;
			// 	})
			// 	.catch(error => {
			// 		if (!listTokensError) {
			// 			tokens_table_message(`{red-bg}Error: ${error.message}{/red-bg}`);
			// 			console.error(error.stack);
			// 			screen.render();
			// 		}
			// 	});

			// return promise;
		}

		dashboard.log = function (message) {
			logBox.log(message);
			screen.render();
		}

		function updateTokensTable(token_list) {
			let token_selected;
			const { selected, childBase, childOffset } = tokens_table;
			const selectedRow = tokens_table.rows[selected];
			tokens_table.setData(token_list.reduce((rows, token) => {
				let row = [
					token.name,
					token.contract,
					token.supply,
				];
				if (token.contract === token_selected) {
					row = row.map(i => `{blue-fg}${i}{/blue-fg}`);
				}
				row.contract = token.contract;
				rows.push(row);
				return rows;
			}, [['NAME', 'CONTRACT', 'SUPPLY']]));

			if (selectedRow) {
				const index = tokens_table.rows.slice(1).findIndex(r => r.contract === selectedRow.contract) + 1;
				tokens_table.select(index);
				Object.assign(tokens_table, { childBase: childBase + (index - selected), childOffset });
				tokens_table.scrollTo(index);
			}
		}

		function promptForTokenDetails() {
			let formConfig = {
				label: 'Add Token',
				height: 7,
				fields: [
					{ name: 'contract', label: { content: 'Contract  :', left: 2, bottom: 4 }, left: 16, bottom: 4, width: '75%' },
				],
				buttons: [
					{ content: 'Add', left: 2, bottom: 1 },
					{ content: 'Cancel', left: 7, bottom: 1 },
				]
			};

			return prompt(screen, formConfig, { closable: true }).promise;
		}

		async function fetchTokenDetails(wallet, contract) {
			if (!contract) {
				dashboard.log("No Token contract provided.");
				return;
			}
			let tokenData;
			let token = new dashboard.web3.eth.Contract(abi, contract);

			return until(
				Promise.all([
					token.methods.name().call(),
					token.methods.symbol().call(),
					token.methods.decimals().call(),
					token.methods.totalSupply().call(),
					token.methods.balanceOf(wallet).call(),
				])
					.then(([tokenName, tokenSymbol, decimals, totalSupply, balance]) => {
						try {
							const formattedSupply = totalSupply / 10 ** decimals;
							const formattedBalance = balance / 10 ** decimals;

							tokenData = {
								tokenName,
								tokenSymbol,
								decimals,
								formattedSupply,
								formattedBalance
							};

							return tokenData;
						} catch (error) {
							console.error(error);
							throw error;
						}
					})
					.catch(err => {
						dashboard.log(`{red-fg}${err.message}{/red-fg}`)
						throw err;
					})
			)
				.do(token_details, setContent)
				.spin(s => `${s} Fetching token details for {bold}${contract}{/bold}...`)
				.succeed(() => `Name: ${tokenData.tokenName}\nSymbol: ${tokenData.tokenSymbol}\nDecimals: ${tokenData.decimals}\nTotal Supply: ${tokenData.formattedSupply}\nWallet Balance: ${tokenData.formattedBalance}`)
				.fail(s => `${s} Failed to fetch token details for {bold}${contract}{/bold}`)
				.cancel(c => cancellations.add('connect', c))
				.then(tokenData => {
					dashboard.log(`Successfully retrieved token details for {bold}${tokenData.tokenName}{/bold}`);
					return tokenData;
				}
				)
				.catch(error => {
					return dashboard.log(`{red-fg}${error.message}{/red-fg}`);
				});
		}

		async function addToken(current_wallet, current_chain) {
			let values = await promptForTokenDetails();

			if (!values || !values.contract) {
				dashboard.log("No Token contract provided.");
				return;
			}

			let tokenData = await fetchTokenDetails(current_wallet, values.contract);

			if (!tokenData) {
				dashboard.log(`Failed to retrieve token details for {bold}${values.contract}{/bold}`);
				return;
			}

			// Save token data
			const { tokenName, tokenSymbol, decimals, formattedSupply, formattedBalance } = tokenData;
			Token.add({
				name: tokenName,
				symbol: tokenSymbol,
				contract: values.contract,
				decimals: decimals,
				supply: formattedSupply,
				balance: formattedBalance,
				wallet: current_wallet,
				chainId: current_chain.chainId
			});
			token_list = Token.getAll(current_wallet, current_chain.chainId);
			updateTokensTable(token_list);
		}


		this.tokensTable = tokens_table
		this.tokenDetails = token_details
	}
}

export default Dashboard;
