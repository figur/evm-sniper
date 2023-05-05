import config from "./config.js";
import blessed from "blessed";
import prompt from './helpers/form.js'
class WalletManager {
    constructor(uiManager, web3) {
        this.uiManager = uiManager;
        this.config = config;
        //this.chains = this.uiManager.config.get("chains");
        this.wallets = config.get("wallets");
        this.walletTokens = config.get("walletTokens");
        this.web3 = web3

        config.onDidChange('wallets', (newValue, oldValue) => {
            this.wallets = newValue;
            // this.updateWalletsUI();
        });
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
        });

        this.updateWalletListMenuItems();

        this.walletListMenu.on("select", (item) => {
            const index = this.walletListMenu.getItemIndex(item);
            this.uiManager.selectWallet(0);
            this.uiManager.updateActiveWalletDisplay();
            this.uiManager.screen.remove(this.walletListMenu);
            this.uiManager.screen.render();
        });
        this.walletListMenu.key(["escape"], () => {
            this.uiManager.screen.remove(this.walletListMenu);
            this.uiManager.screen.render();
        });
        this.uiManager.screen.append(this.walletListMenu);

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
        this.uiManager.screen.render();
    }

    updateWalletListMenuItems() {
        const items = this.config.get("wallets").map((wallet) => wallet.public);
        this.walletListMenu.setItems(items);
        this.uiManager.screen.render();
    }

    async addWallet() {
        const config = {
            height: 9,
            fields: [
                { name: 'walletName', label: { content: 'Name (opt)  :', left: 2, bottom: 7 }, left: 16, bottom: 7, width: 35 },
                { name: 'walletPrivateKey', label: { content: 'Private Key :', left: 2, bottom: 5 }, left: 16, bottom: 5, width: 30, censor: true },
            ],
            buttons: [
                { content: 'Cancel', right: 11, bottom: 1, action: () => form.cancel() },
                { content: 'Add', right: 2, bottom: 1, action: () => form.submit() }
            ]
        };
        await prompt(this.uiManager.screen, config, { closable: true }).promise
            .then(values => {
                if (!values.walletPrivateKey) {
                    this.logError("No wallet private key provided.");
                    return;
                }
                try {
                    const account = this.web3.eth.accounts.privateKeyToAccount(values.walletPrivateKey);
                    const walletAddress = account.address;

                    this.config.set("wallets", [
                        ...this.config.get("wallets"),
                        {
                            name: values.walletName || "",
                            public: walletAddress,
                            private: values.walletPrivateKey,
                        },
                    ]);
                    this.config.set("walletTokens", {
                        ...this.config.get("walletTokens"),
                        [walletAddress]: [],
                    });
                    this.updateWalletListMenuItems();
                    this.uiManager.outputLog.log(`Wallet added: ${values.walletName ? values.walletName + " " : ""}(${walletAddress})`);
                } catch (err) {
                    this.uiManager.logError(`Error deriving wallet address: ${err.message}`);
                }
            });
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
}

export default WalletManager;
