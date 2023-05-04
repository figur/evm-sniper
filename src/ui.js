import blessed from "blessed";
import config from "./config.js";
import Web3 from "web3";
import abi from "./abi.js";

class UI {
	constructor() {
		this.config = config;
		this.chains = this.config.get("chains");
		this.wallets = this.config.get("wallets");
		this.walletTokens = this.config.get("walletTokens");
		this.web3 = new Web3(new Web3.providers.HttpProvider(this.chains[0].url));
		this.activeWalletIndex = 0;
		this.activeWallet = null;
		this.currentWalletBox = null;

		this.screen = this.createScreen();
		this.initUI();
	}

	async initUI() {
		const widgetProps = [
			{ method: "createTokenList", top: "10%", left: "0", width: "25%", height: "45%", label: "ERC20 Tokens", },
			{ method: "createTokenDetailsBox", top: "10%", left: "25%", width: "25%", height: "45%", label: "Token Details", },
			{ method: "createCurrentChainBox", top: 0, left: 0, height: "10%", width: "100%", label: "EVM Sniper" },
			{ method: "createOutputLog", top: "55%", left: 0, right: 0, height: "45%", label: "Output Logs", },
		];

		for (const widgetProp of widgetProps) {
			const widget = this[widgetProp.method](widgetProp);
			const propertyName = widgetProp.method.replace("create", "");
			this[propertyName[0].toLowerCase() + propertyName.slice(1)] = widget;
			this.screen.append(widget);
		}

		this.currentChain = this.createChainText(this.currentChainBox, "25%");
		this.rpcUrlText = this.createChainText(
			this.currentChainBox,
			"75%",
			`RPC URL: ${this.chains[0].url}`
		);
		this.activeWalletDisplay = await this.initializeActiveWalletDisplay(this.currentChainBox, 0);

		this.listBar = this.createListBar();
		this.screen.append(this.listBar);
		// this.updateWalletsUI();

		this.config.onDidChange('chains', (newValue, oldValue) => {
			this.chains = newValue;
		});

		this.config.onDidChange('wallets', (newValue, oldValue) => {
			this.wallets = newValue;
			// this.updateWalletsUI();
		});

		this.config.onDidChange('walletTokens', async (newValue, oldValue) => {
			this.walletTokens = newValue;
			await this.updateTokensUI();
		});
	}

	createBoxWidget(props) {
		const { top, left, width, height, label, keys, mouse, border } = props;
		return blessed.box({
			top,
			left,
			width,
			height,
			keys: keys || true,
			mouse: mouse || true,
			label,
			border: border || "line",
			scrollbar: { ch: " ", track: { bg: "cyan" } },
		});
	}

	async initializeActiveWalletDisplay(parent, left) {
		this.currentWalletBox = blessed.text({
			parent,
			left,
			tags: true,
			content: `No active wallet`,
		});
		if (this.wallets.length > 0) {
			await this.selectWallet(0);
			this.updateActiveWalletDisplay();
		} else {
			this.currentWalletBox.setContent("Please add a wallet.");
		}
	}

	createChainText(parent, left, content) {
		return blessed.text({
			parent,
			left,
			tags: true,
			content: content
				? `{bold}${content}{/bold}`
				: `{bold}${this.chains[0].name}{/bold}`,
		});
	}

	createCurrentChainBox(props) {
		return this.createBoxWidget({ ...props });
	}

	createOutputLog(props) {
		return blessed.log({ ...this.createBoxWidget(props) });
	}

	createTokenDetailsBox(props) {
		return this.createBoxWidget({ ...props });
	}

	createListWidget(props) {
		return blessed.list({
			...this.createBoxWidget(props),
			keys: true,
			mouse: true,
			border: "line",
			scrollbar: { ch: " ", track: { bg: "cyan" } },
			style: { selected: { bg: "blue" } },
			items: [],
		});
	}

	createTokenList(props) {
		return this.createListWidget({ ...props });
	}

	createScreen() {
		return blessed.screen({
			smartCSR: true,
			title: "EVM Wallet",
			ignoreLocked: ['C-q'],
			fullUnicode: true,
			dockBorders: true,
			autoPadding: true,
		});
	}

	createListBar() {
		return blessed.listbar({
			bottom: 0,
			left: 0,
			right: 0,
			height: "shrink",
			keys: true,
			mouse: true,
			style: {
				prefix: { fg: "blue" },
				item: { fg: "white", bg: "black", hover: { bg: "blue" } },
				selected: { fg: "white", bg: "blue" },
			},
			commands: {
				"Wallets (Ctrl+W)": {
					keys: ["C-w"],
					callback: () => this.showWalletListMenu(),
				},
				"Add Token (T)": {
					keys: ["t"],
					callback: () => this.addToken(),
				},
				"Remove Token (D)": {
					keys: ["d"],
					callback: () => this.removeToken(),
				},
				"Chains (Ctrl+S)": {
					keys: ["C-s"],
					callback: () => this.showChainSwitcherMenu(),
				},
				"Quit (Q)": {
					keys: ["q", "C-c"],
					callback: () => process.exit(0),
				},
			},
		});
	}

	async updateWalletsUI() {
		if (!this.wallets || !this.wallets.length) {
			this.walletListMenu.setItems(this.wallets);
			this.outputLog.log(
				"No wallets have been added. Add a wallet by pressing (A)."
			);
		} else {
			this.walletListMenu.setItems(this.wallets);
			this.walletListMenu.select(this.walletListMenu.items.length - 1);
			let walletIndex = this.walletListMenu.selected;
			await this.getPrimaryTokenBalance();
			await this.updateTokensUI();
		}
		this.screen.render();
	}

	async updateTokensUI() {
		if (this.activeWallet.public) {
			await this.initTokenList(this.walletTokens[this.activeWallet.public]);
			this.tokenList.select(this.tokenList.items.length - 1);
			const tokenIndex = this.tokenList.selected;
			if (this.walletTokens[this.activeWallet.public]) {
				const tokenAddress = this.walletTokens[this.activeWallet.public][tokenIndex];
				this.displayTokenDetails(tokenAddress);
				this.screen.render();
			}
		}
	}

	async getTokenSymbols(tokenAddresses = []) {
		const tokenSymbols = [];

		for (const tokenAddress of tokenAddresses) {
			try {
				const token = new this.web3.eth.Contract(abi, tokenAddress);
				const symbol = await token.methods.symbol().call();
				tokenSymbols.push(
					`${symbol} (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`
				);
			} catch (err) {
				this.outputLog.log(
					`Error fetching token symbol for ${tokenAddress}: ${err.message}`
				);
				tokenSymbols.push(
					`Unknown (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`
				);
			}
		}

		return tokenSymbols;
	}

	async initTokenList(tokenAddresses = []) {
		this.outputLog.log("Refreshing tokens...");
		const tokenSymbols = await this.getTokenSymbols(tokenAddresses);
		this.outputLog.log("Tokens refreshed.");

		this.tokenList.setItems(tokenSymbols);

		this.tokenList.removeAllListeners("select");

		this.tokenList.on("select", async (item) => {
			const tokenIndex = tokenSymbols.indexOf(item.content);
			const tokenAddress = tokenAddresses[tokenIndex];
			this.displayTokenDetails(tokenAddress, this.activeWallet.public);
		});

		this.screen.render();
	}

	async switchChain(index) {
		this.outputLog.log(`Switching to ${this.chains[index].name}...`);
		this.web3.setProvider(
			new Web3.providers.HttpProvider(this.chains[index].url)
		);
		this.currentChain.setContent(`{bold}${this.chains[index].name}{/bold}`);
		this.rpcUrlText.setContent(
			`{bold}RPC URL: ${this.chains[index].url}{/bold}`
		);
		this.outputLog.log(`Switched to ${this.chains[index].name}`);
		if (!this.wallets || !this.wallets.length) {
			this.outputLog.log(
				"No wallets have been added. Add a wallet by pressing (A)."
			);
		} else {
			await this.getPrimaryTokenBalance(this.activeWallet.public);
			if (
				!this.walletTokens[this.activeWallet.public] ||
				!this.walletTokens[this.activeWallet.public].length
			) {
				this.outputLog.log(
					"No tokens have been added. Add a token by pressing (T)."
				);
			} else {
				this.initTokenList(this.walletTokens[this.activeWallet.public]);
			}
		}
	}

	showWalletListMenu() {
		this.walletListMenu = blessed.list({
			top: "center",
			left: "center",
			width: "50%",
			height: "50%",
			keys: true,
			mouse: true,
			label: "Select Wallet",
			border: "line",
			items: [],
			style: {
				selected: { bg: "blue" },
			},
		});

		this.updateWalletListMenuItems();

		this.walletListMenu.on("select", (item) => {
			const index = this.walletListMenu.getItemIndex(item);
			this.selectWallet(0);
			this.updateActiveWalletDisplay();
			this.screen.remove(this.walletListMenu);
			this.screen.render();
		});
		this.walletListMenu.key(["escape"], () => {
			this.screen.remove(this.walletListMenu);
			this.screen.render();
		});
		this.screen.append(this.walletListMenu);

		const walletListMenuBar = blessed.listbar({
			parent: this.walletListMenu,
			bottom: 0,
			left: 0,
			right: 0,
			height: "shrink",
			keys: true,
			mouse: true,
			autoCommandKeys: true,
			border: "line",
			style: {
				prefix: { fg: "blue" },
				item: { fg: "white" },
				selected: { bg: "blue", fg: "white" },
			},
			commands: {
				"Add Wallet (A)": {
					keys: ["a"],
					callback: () => this.addWallet(),
				},
				"Remove Wallet (R)": {
					keys: ["r"],
					callback: () => this.removeWallet(),
				},
			},
		});

		this.walletListMenu.focus();
		this.screen.render();
	}

	updateWalletListMenuItems() {
		const items = this.config.get("wallets").map((wallet) => wallet.public);
		this.walletListMenu.setItems(items);
		this.screen.render();
	}

	showChainSwitcherMenu() {
		const chainSwitcherMenu = blessed.list({
			top: "center",
			left: "center",
			width: "50%",
			height: "50%",
			keys: true,
			mouse: true,
			label: "Select Chain",
			border: "line",
			items: this.chains.map((chain) => chain.name),
			style: {
				selected: { bg: "blue" },
			},
		});

		chainSwitcherMenu.on("select", (item) => {
			const chainIndex = this.chains.findIndex(
				(chain) => chain.name === item.content
			);
			this.switchChain(chainIndex);
			this.screen.remove(chainSwitcherMenu);
			this.screen.render();
		});

		chainSwitcherMenu.key(["escape"], () => {
			this.screen.remove(chainSwitcherMenu);
			this.screen.render();
		});

		this.screen.append(chainSwitcherMenu);
		const chainSwitcherListBar = blessed.listbar({
			parent: chainSwitcherMenu,
			bottom: 0,
			left: 0,
			right: 0,
			height: "shrink",
			keys: true,
			mouse: true,
			autoCommandKeys: true,
			border: "line",
			style: {
				prefix: { fg: "blue" },
				item: { fg: "white" },
				selected: { bg: "blue", fg: "white" },
			},
			commands: {
				Info: {
					keys: ["i"],
					callback: () => {
						this.screen.render();
					},
				},
			},
		});

		chainSwitcherMenu.focus();
		this.screen.render();
	}

	async selectWallet(index) {
		if (index >= 0 && index <= this.wallets.length) {
			this.activeWalletIndex = index;
			this.activeWallet = this.wallets[index];
		}
	}

	async updateActiveWalletDisplay() {
		this.currentWalletBox.setContent("");
		const primaryTokenBalance = await this.getPrimaryTokenBalance();
		this.currentWalletBox.setContent(
			`Wallet: ${this.activeWallet.public}\nBalance: ${primaryTokenBalance}`
		);
		this.screen.render();
	}

	async promptUser(label, callback, parent) {
		const container = blessed.box({
			parent: parent,
			top: "center",
			left: "center",
			height: "shrink",
			width: "50%",
			label: label,
			border: "line",
		});

		const input = blessed.textbox({
			parent: container,
			top: 1,
			left: 1,
			right: 1,
			height: 1,
			inputOnFocus: true,
			style: {
				bg: "white",
				fg: "black",
			},
		});

		const okayButton = blessed.button({
			parent: container,
			top: 3,
			left: 1,
			height: 1,
			width: 5,
			content: "Okay",
			style: {
				bg: "white",
				fg: "black",
			},
		});

		const cancelButton = blessed.button({
			parent: container,
			top: 3,
			left: 7,
			height: 1,
			width: 7,
			content: "Cancel",
			style: {
				bg: "white",
				fg: "black",
			},
		});

		const elements = [input, okayButton, cancelButton];
		let currentFocusIndex = 0;

		function focusNext() {
			currentFocusIndex = (currentFocusIndex + 1) % elements.length;
			elements[currentFocusIndex].focus();
		}

		elements.forEach((element, index) => {
			element.key(["tab"], () => {
				focusNext();
			});
		});

		okayButton.on("press", () => {
			callback(input.value);
			this.screen.remove(container);
			this.screen.render();
		});

		cancelButton.on("press", () => {
			this.screen.remove(container);
			this.screen.render();
		});

		input.focus();
		this.screen.render();
	}

	logError(errorMessage) {
		this.outputLog.log(errorMessage);
		this.screen.render();
	}

	async addWallet() {
		await this.promptUser("Wallet name (optional):", async (walletName) => {
			await this.promptUser("Wallet private key:", async (walletPrivateKey) => {
				if (!walletPrivateKey) {
					this.logError("No wallet private key provided.");
					return;
				}

				try {
					const account = this.web3.eth.accounts.privateKeyToAccount(walletPrivateKey);
					const walletAddress = account.address;

					this.config.set("wallets", [
						...this.config.get("wallets"),
						{
							name: walletName || "",
							public: walletAddress,
							private: walletPrivateKey,
						},
					]);
					this.config.set("walletTokens", {
						...this.config.get("walletTokens"),
						[walletAddress]: [],
					});
					this.updateWalletListMenuItems();
					this.outputLog.log(`Wallet added: ${walletName ? walletName + " " : ""}(${walletAddress})`);
				} catch (err) {
					this.logError(`Error deriving wallet address: ${err.message}`);
				}
			}, this.walletListMenu);
		}, this.walletListMenu);
	}

	removeWallet() {
		const walletIndex = this.walletListMenu.selected;
		const wallets = this.config.get("wallets");
		const wallet = wallets[walletIndex];
		if (wallet === null || wallet === undefined) {
			outputLog.log("No wallet to remove.");
		} else {
			const updatedWallets = wallets.filter((_, index) => index !== walletIndex);
			this.config.set("wallets", updatedWallets);
			const updatedWalletTokens = { ...this.walletTokens };
			delete updatedWalletTokens[wallet.public];
			this.config.set("walletTokens", updatedWalletTokens);
			this.updateWalletListMenuItems();
		}
	}

	async addToken() {
		if (this.activeWalletIndex === -1) {
			this.outputLog.log(
				"No wallet selected. Please add and select a wallet before adding a token."
			);
			return;
		}

		await this.promptUser("Token address:", async (tokenAddress) => {
			if (!tokenAddress) {
				this.logError("No token address provided.");
				return;
			}

			const token = new this.web3.eth.Contract(abi, tokenAddress);
			const symbol = await token.methods.symbol().call();
			const displaySymbol = `${symbol} (${tokenAddress.slice(
				0,
				6
			)}...${tokenAddress.slice(-4)})`;

			const newTokenAddresses = [
				...(this.walletTokens[this.activeWallet.public] || []),
				tokenAddress,
			];
			this.walletTokens = {
				...this.walletTokens,
				[this.activeWallet.public]: newTokenAddresses,
			};
			this.config.set("walletTokens", this.walletTokens);

			this.outputLog.log(`Token added: ${displaySymbol}`);
			await this.initTokenList(this.walletTokens[this.activeWallet.public]);
		}, this.screen);
	}

	removeToken() {
		if (this.activeWalletIndex === -1) {
			this.outputLog.log(
				"No wallet selected. Please add and select a wallet before removing a token."
			);
			return;
		}

		const tokenIndex = this.tokenList.selected;
		if (this.walletTokens[this.activeWallet.public]) {
			const tokenAddress = this.walletTokens[this.activeWallet.public][tokenIndex];
			const updatedTokens = this.walletTokens[this.activeWallet.public].filter(
				(_, index) => index !== tokenIndex
			);
			this.walletTokens = {
				...this.walletTokens,
				[this.activeWallet.public]: updatedTokens,
			};
			this.config.set("walletTokens", this.walletTokens);
			this.outputLog.log(`Token removed: ${tokenAddress}`);
			this.initTokenList(this.walletTokens[this.activeWallet.public]);
		} else {
			this.outputLog.log("No token to remove.");
		}
	}

	async getPrimaryTokenBalance() {
		try {
			const balance = await this.web3.eth.getBalance(this.activeWallet.public);
			return this.web3.utils.fromWei(balance, "ether");
		} catch (err) {
			this.outputLog.log(
				`Error fetching primary token balance: ${err.message}`
			);
		}
	}

	async displayTokenDetails(tokenAddress) {
		this.outputLog.log(`Fetching token details for ${tokenAddress}...`);
		try {
			const token = new this.web3.eth.Contract(abi, tokenAddress);
			const [name, decimals, totalSupply, symbol, balance] = await Promise.all([
				token.methods.name().call(),
				token.methods.decimals().call(),
				token.methods.totalSupply().call(),
				token.methods.symbol().call(),
				token.methods.balanceOf(this.activeWallet.public).call(),
			]);
			const formattedSupply = totalSupply / 10 ** decimals;
			const formattedBalance = balance / 10 ** decimals;
			this.tokenDetailsBox.setContent(
				`Name: ${name}\nSymbol: ${symbol}\nDecimals: ${decimals}\nTotal Supply: ${formattedSupply}\nWallet Balance: ${formattedBalance}`
			);
			this.screen.render();
			this.outputLog.log(`Token details fetched for ${tokenAddress}`);
		} catch (err) {
			this.outputLog.log(`Error fetching token details: ${err.message}`);
		}
	}
}

export default UI;
