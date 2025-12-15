export type NetworkKey = 'bsc' | 'tron' | 'solana' | 'ton' | 'eth' | 'polygon' | 'avalanche' | 'arbitrum'

export interface NetworkInfo {
  label: string
  address: string
  description: string
}

export const NETWORKS: Record<NetworkKey, NetworkInfo> = {
  bsc: {
    label: 'BSC • BEP20',
    address: '0xBc92de905b59a3C87478BE0b2E7ff37c8a494d8a',
    description: 'Binance Smart Chain (BEP-20)'
  },
  tron: {
    label: 'TRON • TRC20',
    address: 'TQEVdQEawnvGHh4Kmp167USEn3PcCms7in',
    description: 'TRON Network (TRC-20)'
  },
  solana: {
    label: 'Solana',
    address: 'C5e4YhJEnt8aWZvcQ5fXuSdyzaPbsrpCcLst4EonkVDh',
    description: 'Solana Network'
  },
  ton: {
    label: 'TON',
    address: 'UQBQqLqL3pavNGl-Sijhm6EsC1ylN-_zxdx9QTdrSpSPlGvE',
    description: 'TON Blockchain'
  },
  eth: {
    label: 'Ethereum • ERC20',
    address: '0xf945D03eB72Fda50c2CD76b72746f3d2a983773D',
    description: 'Ethereum Network (ERC-20)'
  },
  polygon: {
    label: 'Polygon • MATIC',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Polygon Network (MATIC)'
  },
  avalanche: {
    label: 'Avalanche • AVAX',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Avalanche Network (AVAX)'
  },
  arbitrum: {
    label: 'Arbitrum • ARB',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Arbitrum Network (ARB)'
  }
}
