import Conf from 'conf';
import yaml from 'js-yaml';

const config = new Conf({
  projectName: 'evm-sniper',
  fileExtension: 'yaml',
	serialize: yaml.dump,
	deserialize: yaml.load,
  watch: true,
  defaults: {
    chains: [
      {
        name: 'Ethereum',
        url: 'https://rpc.mevblocker.io',
      },
      {
        name: 'BSC',
        url: 'https://bsc-dataseed3.binance.org',
      },
    ],
    wallets: [],
    tokenAddresses: [],
  },
});

export default config;
