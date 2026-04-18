import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WalletType = 'freighter' | null

interface WalletState {
  address: string | null
  walletType: WalletType
  isConnecting: boolean
  // Actions
  setAddress: (address: string, type: WalletType) => void
  disconnect: () => void
  setConnecting: (connecting: boolean) => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      walletType: null,
      isConnecting: false,

      setAddress: (address, walletType) =>
        set({ address, walletType, isConnecting: false }),

      disconnect: () =>
        set({ address: null, walletType: null }),

      setConnecting: (isConnecting) =>
        set({ isConnecting }),
    }),
    {
      name: 'swapproof-wallet',
      // Only persist address — re-connect on reload
      partialize: (state) => ({
        address: state.address,
        walletType: state.walletType,
      }),
    },
  ),
)
