import blessed from 'blessed';
import Web3 from "web3";
import config from "./config.js";

class ChainManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.config = config;
        this.chains = config.get("chains");
        this.wallets = config.get("wallets");
        this.walletTokens = config.get("walletTokens");
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.chains[0].url));

        config.onDidChange('chains', (newValue, oldValue) => {
            this.chains = newValue;
        });
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
            style : {
                bg : 'white',
                item : {
                  fg : 'black',
                  bg : 'white',
                  hover : {
                    fg   : 'white',
                    bg   : 'grey',
                    bold : true,
                  },
                },
                selected : {
                  fg : 'white',
                  bg : 'blue',
                },
              },
        });

        chainSwitcherMenu.on("select", (item) => {
            const chainIndex = this.chains.findIndex(
                (chain) => chain.name === item.content
            );
            this.uiManager.switchChain(chainIndex);
            this.uiManager.screen.remove(chainSwitcherMenu);
            this.uiManager.screen.render();
        });

        chainSwitcherMenu.key(["escape"], () => {
            this.uiManager.screen.remove(chainSwitcherMenu);
            this.uiManager.screen.render();
        });

        this.uiManager.screen.append(chainSwitcherMenu);

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
            style : {
                bg : 'white',
                item : {
                  fg : 'black',
                  bg : 'white',
                  hover : {
                    fg   : 'white',
                    bg   : 'grey',
                    bold : true,
                  },
                },
                selected : {
                  fg : 'white',
                  bg : 'blue',
                },
              },
            commands: {
                Info: {
                    keys: ["i"],
                    callback: () => {
                        this.uiManager.screen.render();
                    },
                },
            },
        });

        chainSwitcherMenu.focus();
        this.uiManager.screen.render();
    }
}

export default ChainManager;