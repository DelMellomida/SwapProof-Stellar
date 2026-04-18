import { useCallback } from 'react'
import { connectFreighter, signWithFreighter } from '@/lib/stellar/freighter'
import { useWalletStore } from '@/store/walletStore'
import { getSorobanClient } from '@/lib/soroban/client'
import { TransactionBuilder } from '@stellar/stellar-sdk'

export function useFreighter() {
  const { address, walletType, isConnecting, setAddress, disconnect, setConnecting } =
    useWalletStore()

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      const addr = await connectFreighter()
      setAddress(addr, 'freighter')
      return addr
    } catch (err) {
      setConnecting(false)
      throw err
    }
  }, [setAddress, setConnecting])

  /**
   * Sign and submit a pre-built transaction XDR.
   * Returns the transaction hash.
   */
  const signAndSubmit = useCallback(
    async (unsignedXdr: string): Promise<string> => {
      const signedXdr = await signWithFreighter(unsignedXdr)
      const server = getSorobanClient()
      const tx = TransactionBuilder.fromXDR(signedXdr, import.meta.env.VITE_STELLAR_NETWORK === 'mainnet' ? 'Public Global Stellar Network ; September 2015' : 'Test SDF Network ; September 2015')
      const result = await server.sendTransaction(tx)

      if (result.status === 'ERROR') {
        throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`)
      }

      // Poll for confirmation
      let getResult = await server.getTransaction(result.hash)
      let attempts = 0
      while (getResult.status === 'NOT_FOUND' && attempts < 30) {
        await new Promise((r) => setTimeout(r, 1000))
        getResult = await server.getTransaction(result.hash)
        attempts++
      }

      if (getResult.status === 'FAILED') {
        throw new Error('Transaction was included but failed.')
      }

      return result.hash
    },
    [],
  )

  return {
    address,
    walletType,
    isConnecting,
    isConnected: !!address,
    connect,
    disconnect,
    signAndSubmit,
  }
}
