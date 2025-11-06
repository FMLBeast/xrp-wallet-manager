/**
 * Top-level mock for XRPL library
 */

const mockWallet = {
  address: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
  publicKey: '0330E7FC9D56BB25D6893BA3F317AE5BCF33B3291BD63DB32654A313222F7FD020',
  seed: 'sEd7A7WfL5zLG9vEwSjdKT6LJHsEqgZKGhzaTUvtLFCKX5pS6y'
};

module.exports = {
  Client: jest.fn(),
  Wallet: {
    fromSeed: jest.fn(() => mockWallet),
    fromMnemonic: jest.fn(() => mockWallet)
  },
  xrpToDrops: jest.fn((xrp) => (parseFloat(xrp) * 1000000).toString()),
  dropsToXrp: jest.fn((drops) => (parseFloat(drops) / 1000000).toString())
};