# EVM Sniper

EVM Sniper is a text user interface (TUI) for managing Ethereum wallets and ERC-20 tokens. It allows you to add, remove and switch between wallets and add and remove ERC-20 tokens, as well as view token details and balances.

Planned features and goals:

- Buying and selling tokens
- "Sniping"
- Simplify managing multiple wallets
- Telegram integration?
- Add some color/improve aesthetics
- ???

If you want to collaborate or have suggestions/ideas you can find me on Telegram @iamfigur.

## Installation

To use EVM Sniper, you must have Node.js installed. Once you have Node.js installed, follow these steps to install EVM Sniper:

1. Clone the repository using Git:

```
git clone https://github.com/username/evm-sniper.git
```

2. Navigate to the `evm-sniper` directory and install the dependencies:

```
cd evm-sniper
npm install
```

## Usage

To start EVM Sniper, run the following command in the terminal:

```
npm start
```

The CLI will launch and display a list of available wallets. You can add, remove and switch between wallets using the following commands:

- Add Wallet: Press `A` and enter the wallet address when prompted.
- Remove Wallet: Press `R` while a wallet is selected.
- Switch Chain: Press `Ctrl+S` to display a list of available chains.
- Quit: Press `Q` to quit the application.

You can add and remove ERC-20 tokens using the following commands:

- Add Token: Press `T` and enter the token address when prompted.
- Remove Token: Press `D` while a token is selected.

To view token details and balances, select a wallet and token using the arrow keys and press `Enter`. The token details will be displayed in the right-hand panel.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.