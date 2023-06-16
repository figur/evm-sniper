import './ui/blessed/patches.js';
import ui from './ui/ui.js';
const { NavBar, setContent, Dashboard, itemPrompt } = ui;
import until from './ui/spinner.js';
import { Cancellations } from './task.js';
import conf from "./conf.js";
const { config, Chain, Wallet, Token } = conf;
import blessed from 'blessed';
import EventEmitter from 'events';
import Web3 from 'web3';
import Web3HttpProvider from 'web3-providers-http';
import { log, pause, wait } from './promise.js';
import prompt from './ui/form.js'

class EvmSniper extends EventEmitter {
	constructor(screen, client) {
		super();
		const evmSniper = this;
		const cancellations = new Cancellations();
		this.config = config;
		let current_chain;
		let current_wallet;
		let web3;
		let token_selected;

		const status = blessed.text({
			tags: true,
			width: '100%',
			height: 1,
			bottom: 0,
			padding: {
				left: 1,
				right: 1,
			},
			style: {
				fg: 'grey',
				bg: 'white',
			},
		});

		const commandBar = blessed.listbar({
			width: '100%',
			height: 1,
			bottom: 1,
			padding: {
				left: 1,
				right: 1,
			},
			keys: true,
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
				"Add Wallets (Ctrl+W)": {
					keys: ["C-w"],
					callback: () => addWallet(),
				},
				"Wallets (W)": {
					keys: ["w"],
					callback: () => switchWallet(),
				},
				"Network (N)": {
					keys: ["n"],
					callback: () => switchChain(),
				},
				"Quit (Q)": {
					keys: ["q", "C-c"],
					callback: () => process.exit(0),
				},
			},
		});



		const navbar = new NavBar(screen);
		const dashboard = new Dashboard({ screen, navbar, status, commandBar });

		const portfolio = navbar.add({ title: 'Portfolio', listener: dashboard }, { select: true });
		const copy_trading = navbar.add({ title: 'Copy Trading', listener: dashboard }, { select: false });
		const telegram = navbar.add({ title: 'Telegram Scanner', listener: dashboard }, { select: false });

		screen.key(['tab', 'S-tab'], function (_, key) {
			if (key.shift) {
				portfolio
				screen.focusPrevious();
			} else {
				screen.focusNext();
			}
		});



		// function switchChain() {
		// 	return itemPrompt(screen, Chain.getAll, chainName => Chain.getAll().find(c => c.name === chainName), 'Network', { current_chain })
		// 		.then(chain => {
		// 			return new Promise(async (resolve, reject) => {
		// 				try {
		// 					if (!chain || chain.name === (current_chain && current_chain.name)) resolve();
		// 					dashboard.reset(portfolio);
		// 					current_chain = chain;
		// 					await connect(current_chain.rpc.http);
		// 					screen.render();
		// 					resolve(dashboard.run(current_chain, current_wallet));
		// 				} catch (error) {
		// 					reject(error);
		// 				}
		// 			});
		// 		})
		// 		.catch(error => console.error(error.stack));
		// };


		// function switchWallet() {
		// 	return itemPrompt(screen, Wallet.getAll, walletName => Wallet.getAll().find(w => w.name === walletName), 'Wallet', { current_wallet })
		// 		.then(wallet => {
		// 			if (!wallet || wallet.name === (current_wallet && current_wallet.name)) return;
		// 			dashboard.reset(portfolio);
		// 			current_wallet = wallet;
		// 			log(`{green-fg}Selected wallet {bold}${current_wallet.name}{/bold} (${current_wallet.public}){/green-fg}`)
		// 			// connect(current_wallet); 
		// 			screen.render();
		// 			return dashboard.run(current_chain, current_wallet);
		// 		})
		// 		.catch(error => console.error(error.stack));
		// };

		async function switchChain() {
			try {
				let chain = await itemPrompt(screen, Chain.getAll, chainName => Chain.getAll().find(c => c.name === chainName), 'Network', { current_chain });
				if (!chain || chain.name === (current_chain && current_chain.name)) return;

				dashboard.reset(portfolio);
				current_chain = chain;
				await connect(current_chain.rpc.http);
				screen.render();

				if (current_wallet) {
					return dashboard.run(current_chain, current_wallet);
				}
			} catch (error) {
				console.error(error.stack);
			}
		}

		async function switchWallet() {
			try {
				let wallet = await itemPrompt(screen, Wallet.getAll, walletName => Wallet.getAll().find(w => w.name === walletName), 'Wallet', { current_wallet });
				if (!wallet || wallet.name === (current_wallet && current_wallet.name)) return;

				dashboard.reset(portfolio);
				current_wallet = wallet;
				log(`{green-fg}Selected wallet {bold}${current_wallet.name}{/bold} (${current_wallet.public}){/green-fg}`)
				screen.render();

				if (current_chain) {
					return dashboard.run(current_chain, current_wallet);
				}
			} catch (error) {
				console.error(error.stack);
			}
		}

		function setCurrentWallet(walletName) {
			const wallet = Wallet.getAll().find(w => w.name === walletName);
			if (wallet) {
				current_wallet = wallet;
			} else {
				console.error(`Could not find wallet with name ${walletName}`);
			}
		};


		function addWallet() {
			let formConfig = {
				label: 'Add Wallet',
				height: 7,
				fields: [
					{ name: 'walletName', label: { content: 'Name (opt)  :', left: 2, bottom: 4 }, left: 16, bottom: 4, width: 35 },
					{ name: 'walletPrivateKey', label: { content: 'Private Key :', left: 2, bottom: 3 }, left: 16, bottom: 3, width: 30, censor: true },
				],
				buttons: [
					{ content: 'Add', left: 2, bottom: 1 },
					{ content: 'Cancel', left: 7, bottom: 1 },
				]
			};
			prompt(screen, formConfig, { closable: true }).promise
				.then(values => {
					if (!values.walletPrivateKey) {
						log("No wallet private key provided.");
						return;
					}
					try {
						const account = dashboard.web3.eth.accounts.privateKeyToAccount(values.walletPrivateKey);
						const walletAddress = account.address;

						Wallet.add(
							{
								name: values.walletName || "",
								public: walletAddress,
								private: values.walletPrivateKey,
							},
						);
						log(`Wallet added: ${values.walletName ? values.walletName + " " : ""}(${walletAddress})`);
					} catch (err) {
						log(`Error deriving wallet address: ${err.message}`);
					}
				});
		}

		function removeWallet() {
			const walletIndex = this.walletListMenu.selected;
			const wallets = this.config.get("wallets");
			const wallet = wallets[walletIndex];
			if (wallet === null || wallet === undefined) {
				log("No wallet to remove.");
			} else {
				const updatedWallets = wallets.filter((_, index) => index !== walletIndex);
				this.config.set("wallets", updatedWallets);
				const updatedWalletTokens = { ...this.walletTokens };
				delete updatedWalletTokens[wallet.public];
				this.config.set("walletTokens", updatedWalletTokens);
				this.updateWalletListMenuItems();
			}
		}

		// function addToken(web3, current_wallet, current_chain) {
		// 	let formConfig = {
		// 		label: 'Add Token',
		// 		height: 7,
		// 		fields: [
		// 			{ name: 'contract', label: { content: 'Contract  :', left: 2, bottom: 4 }, left: 16, bottom: 4, width: '75%' },
		// 		],
		// 		buttons: [
		// 			{ content: 'Add', left: 2, bottom: 1 },
		// 			{ content: 'Cancel', left: 7, bottom: 1 },
		// 		]
		// 	};
		// 	prompt(screen, formConfig, { closable: true }).promise
		// 		.then(async values => {
		// 			if (!values.contract) {
		// 				log("No Token contract provided.");
		// 				return;
		// 			}
		// 			let tokenData;
		// 			let token = new web3.eth.Contract(abi, values.contract);
		// 			return until(
		// 				Promise.all([
		// 					token.methods.name().call(),
		// 					token.methods.symbol().call(),
		// 					token.methods.decimals().call(),
		// 					token.methods.totalSupply().call(),
		// 					token.methods.balanceOf(current_wallet.public).call(),
		// 				])
		// 					.then(([tokenName, tokenSymbol, decimals, totalSupply, balance]) => {
		// 						try {
		// 							const formattedSupply = totalSupply / 10 ** decimals;
		// 							const formattedBalance = balance / 10 ** decimals;
		// 							Token.add({
		// 								name: tokenName,
		// 								symbol: tokenSymbol,
		// 								contract: values.contract,
		// 								decimals: decimals,
		// 								supply: formattedSupply,
		// 								wallet: current_wallet.public,
		// 								chainId: current_chain.chainId
		// 							});
		// 							tokenData = {
		// 								tokenName,
		// 								tokenSymbol,
		// 								decimals,
		// 								formattedSupply,
		// 								formattedBalance
		// 							};

		// 							return tokenData;
		// 						} catch (error) {
		// 							console.error(error);
		// 							throw error;
		// 						}
		// 					})
		// 					.catch(err => {
		// 						log(`{red-fg}${err.message}{/red-fg}`)
		// 						throw err;
		// 					})
		// 			)
		// 				.do(dashboard.tokenDetails, setContent)
		// 				.spin(s => `${s} Fetching token details for {bold}${values.contract}{/bold}...`)
		// 				.succeed(() => `Name: ${tokenData.tokenName}\nSymbol: ${tokenData.tokenSymbol}\nDecimals: ${tokenData.decimals}\nTotal Supply: ${tokenData.formattedSupply}\nWallet Balance: ${tokenData.formattedBalance}`).fail(s => `${s} Failed to fetch token details for {bold}${values.contract}{/bold}`)
		// 				.cancel(c => cancellations.add('connect', c))
		// 				.then(() => log(`Successfully retrieved token details for {bold}${values.contract}{/bold}`))
		// 				.catch(error => {
		// 					return log(`{red-fg}${error.message}{/red-fg}`)
		// 				});
		// 		});
		// }

		function removeToken() {
			const tokenIndex = this.tokenListMenu.selected;
			const tokens = this.config.get("tokens");
			const Token = tokens[tokenIndex];
			if (Token === null || Token === undefined) {
				log("No Token to remove.");
			} else {
				const updatedTokens = tokens.filter((_, index) => index !== tokenIndex);
				this.config.set("tokens", updatedTokens);
				const updatedTokenTokens = { ...this.tokenTokens };
				delete updatedTokenTokens[Token.public];
				this.config.set("tokenTokens", updatedTokenTokens);
				this.updateTokenListMenuItems();
			}
		}

		// function updateTokensTable(walletPublicKey, chainId) {
		// 	const { selected, childBase, childOffset } = dashboard.tokensTable;
		// 	const selectedRow = dashboard.tokensTable.rows[selected];
		// 	const tokens = Token.getAll(walletPublicKey, chainId);
		// 	dashboard.tokensTable.setData(tokens.reduce((rows, token) => {
		// 		let row = [
		// 			token.name,
		// 			token.contract,
		// 			token.supply,
		// 		];
		// 		if (token.contract === token_selected) {
		// 			row = row.map(i => `{blue-fg}${i}{/blue-fg}`);
		// 		}
		// 		row.contract = token.contract;
		// 		rows.push(row);
		// 		return rows;
		// 	}, [['NAME', 'CONTRACT', 'SUPPLY']]));

		// 	if (selectedRow) {
		// 		const index = dashboard.tokensTable.rows.slice(1).findIndex(r => r.contract === selectedRow.contract) + 1;
		// 		dashboard.tokensTable.select(index);
		// 		Object.assign(dashboard.tokensTable, { childBase: childBase + (index - selected), childOffset });
		// 		dashboard.tokensTable.scrollTo(index);
		// 	}
		// }

		function fail(options = {}) {
			return error => {
				console.error(`${error.name === 'EvmSniper' ? error.message : error.stack}`);
				return logging(Object.assign({}, options, { message: `{red-fg}${error.message}{/red-fg}` }))
					.catch(error => pause(1000, error).then(fail(options)));
			}
		}

		function cancel(cancellation) {
			return () => {
				if (cancellation()) {
					console.debug(`Cancelled connection to ${client.url}`);
				}
			};
		}

		function connect(rpcUrl) {
			dashboard.log(`Connecting to ${rpcUrl} ...`);
			let options = {
				keepAlive: true,
				timeout: 20000,
			};
			let provider = new Web3HttpProvider(rpcUrl, options);
			dashboard.web3 = new Web3(provider);

			return until(
				new Promise((resolve, reject) => {
					dashboard.web3.eth.net.isListening()
						.then(isListening => {
							if (isListening) {
								resolve();
							} else {
								reject();
							}
						})
						.catch(err => {
							reject(err);
						});
				})
			)
				.do(status, setContent)
				.spin(s => `${s} Connecting to {bold}${rpcUrl}{/bold}...`)
				.succeed(s => `${s} Connected to {bold}${rpcUrl}{/bold}`)
				.fail(s => `${s} Connection failed to {bold}${rpcUrl}{/bold}`)
				.cancel(c => cancellations.add('connect', c))
				.then(() => log(`{green-fg}Connected to {bold}${rpcUrl}{/bold}{/green-fg}`))
				.catch(error => {
					if (error) {
						return log(`{red-fg}${error.message}{/red-fg}`)
					}
				});
		}

		// dashboard.tokensTable.on('select', (item, i) => {
		// 	// empty table!
		// 	// if (i === 0) return;
		// 	// const pod = pods_list.items[i - 1];
		// 	// pod_selected = pod.metadata.uid;
		// 	// cancellations.run('dashboard.pod');
		// 	// just to update the table with the new selection
		// 	//updateTokensTable(current_wallet.public, current_chain.chainId);
		// 	// reset the selected pod widgets
		// 	// resources.setLabel('Resources');
		// 	// graphs.forEach(g => g.reset());
		// 	// pod_log.setLabel('Logs');
		// 	// pod_log.reset();
		// 	screen.render();
		// });
		// switchWallet().then(() => switchChain().then(async () => console.log(`${current_wallet.public} ${current_chain.chainId}`)));

		// switchWallet().then(() => switchChain().then(() => updateTokensTable(current_wallet.public, current_chain.chainId)));

		switchWallet().then(() => switchChain());

	}
}

export default EvmSniper;
