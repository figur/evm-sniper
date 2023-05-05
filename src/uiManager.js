// runtime fixes for Blessed
import './blessed/patches.js';

import Web3 from "web3";
import blessed from "blessed";
import config from "./config.js";
import ChainManager from "./chainManager.js";
import WalletManager from "./walletManager.js";
import TokenManager from "./tokenManager.js";

class UIManager {
    constructor() {
        this.chainManager = new ChainManager(this);
        this.walletManager = new WalletManager(this, this.chainManager.web3);
        this.tokenManager = new TokenManager(this, this.chainManager.web3);
        this.config = config;
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
            `RPC URL: ${this.chainManager.chains[0].url}`
        );

        this.activeWalletDisplay = await this.initializeActiveWalletDisplay(this.currentChainBox, 0);

        this.listBar = this.createListBar();
        this.screen.append(this.listBar);
        // this.updateWalletsUI();
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

    createChainText(parent, left, content) {
        return blessed.text({
            parent,
            left,
            tags: true,
            content: content
                ? `{bold}${content}{/bold}`
                : `{bold}${this.chainManager.chains[0].name}{/bold}`,
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
            title: "EVM Sniper",
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
                "Wallets (Ctrl+W)": {
                    keys: ["C-w"],
                    callback: () => this.walletManager.showWalletListMenu(),
                },
                "Add Token (T)": {
                    keys: ["t"],
                    callback: () => this.tokenManager.addToken(),
                },
                "Remove Token (D)": {
                    keys: ["d"],
                    callback: () => this.tokenManager.removeToken(),
                },
                "Chains (Ctrl+S)": {
                    keys: ["C-s"],
                    callback: () => this.chainManager.showChainSwitcherMenu(),
                },
                "Quit (Q)": {
                    keys: ["q", "C-c"],
                    callback: () => process.exit(0),
                },
            },
        });
    }

    async selectWallet(index) {
        if (index >= 0 && index <= this.walletManager.wallets.length) {
            this.activeWalletIndex = index;
            this.activeWallet = this.walletManager.wallets[index];
        }
    }

    async updateActiveWalletDisplay() {
        this.currentWalletBox.setContent("");
        const primaryTokenBalance = await this.tokenManager.getPrimaryTokenBalance();
        this.currentWalletBox.setContent(
            `Wallet: ${this.activeWallet.public}\nBalance: ${primaryTokenBalance}`
        );
        this.screen.render();
    }

    async initializeActiveWalletDisplay(parent, left) {
        this.currentWalletBox = blessed.text({
            parent,
            left,
            tags: true,
            content: `No active wallet`,
        });
        if (this.walletManager.wallets.length > 0) {
            await this.selectWallet(0);
            this.updateActiveWalletDisplay();
        } else {
            this.currentWalletBox.setContent("Please add a wallet.");
        }
    }

    async updateWalletsUI() {
        if (!this.walletManager.wallets || !this.walletManager.wallets.length) {
            this.walletManager.walletListMenu.setItems(this.walletManager.wallets);
            this.outputLog.log(
                "No wallets have been added. Add a wallet by pressing (A)."
            );
        } else {
            this.walletManager.walletListMenu.setItems(this.walletManager.wallets);
            this.walletManager.walletListMenu.select(this.walletManager.walletListMenu.items.length - 1);
            let walletIndex = this.walletManager.walletListMenu.selected;
            await this.tokenManager.getPrimaryTokenBalance();
            await this.updateTokensUI();
        }
        this.screen.render();
    }

    async updateTokensUI() {
        if (this.activeWallet.public) {
            await this.initTokenList(this.tokenManager.walletTokens[this.activeWallet.public]);
            this.tokenList.select(this.tokenList.items.length - 1);
            const tokenIndex = this.tokenList.selected;
            if (this.tokenManager.walletTokens[this.activeWallet.public]) {
                const tokenAddress = this.tokenManager.walletTokens[this.activeWallet.public][tokenIndex];
                this.tokenManager.displayTokenDetails(tokenAddress);
                this.screen.render();
            }
        }
    }

    async switchChain(index) {
        this.outputLog.log(`Switching to ${this.chainManager.chains[index].name}...`);
        this.chainManager.web3.setProvider(
            new Web3.providers.HttpProvider(this.chainManager.chains[index].url)
        );
        this.currentChain.setContent(`{bold}${this.chainManager.chains[index].name}{/bold}`);
        this.rpcUrlText.setContent(
            `{bold}RPC URL: ${this.chainManager.chains[index].url}{/bold}`
        );
        this.outputLog.log(`Switched to ${this.chainManager.chains[index].name}`);
        if (!this.walletManager.wallets || !this.walletManager.wallets.length) {
            this.outputLog.log(
                "No wallets have been added. Add a wallet by pressing (A)."
            );
        } else {
            await this.tokenManager.getPrimaryTokenBalance(this.activeWallet.public);
            if (
                !this.tokenManager.walletTokens[this.activeWallet.public] ||
                !this.tokenManager.walletTokens[this.activeWallet.public].length
            ) {
                this.outputLog.log(
                    "No tokens have been added. Add a token by pressing (T)."
                );
            } else {
                this.initTokenList(this.tokenManager.walletTokens[this.activeWallet.public]);
            }
        }
    }

    async promptUser(label, callback, parent) {
        const container = blessed.form({
            parent: parent,
            top: "center",
            left: "center",
            height: "shrink",
            width: "50%",
            label: label,
            border: "line",
            keys: true,
            clickable: true,
        });

        const input = blessed.textbox({
            parent: container,
            top: 1,
            left: 1,
            right: 1,
            height: 1,
            inputOnFocus: true,
            mouse: true,
            keys: true,
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
                hover: {
                    fg: "white",
                    bg: "grey",
                    bold: true,
                },
            },
            keys: true,
            mouse: true,
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
                hover: {
                    fg: "white",
                    bg: "grey",
                    bold: true,
                },
            },
            keys: true,
            mouse: true,
        });

        container.on("submit", () => {
            callback(input.value);
            parent.remove(container);
            parent.render();
        });

        container.on("cancel", () => {
            parent.remove(container);
            parent.render();
        });

        input.on("keypress", (ch, key) => {
            if (key.name === "enter") {
                container.submit();
            } else if (key.name === "escape") {
                container.cancel();
            }
        });

        okayButton.on("press", () => {
            container.submit();
        });

        cancelButton.on("press", () => {
            container.cancel();
        });

        input.focus();
        parent.render();
    }

    logError(errorMessage) {
        this.outputLog.log(errorMessage);
        this.screen.render();
    }


}

export default UIManager;
