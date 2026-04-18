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

      if (result.status === 'TRY_AGAIN_LATER') {
        throw new Error('The network is busy right now. Please try submitting the transaction again.')
      }

      const getResult = await server.pollTransaction(result.hash, {
        attempts: 45,
      })

      if (getResult.status === 'FAILED') {
        throw new Error('Transaction was included but failed.')
      }

      if (getResult.status !== 'SUCCESS') {
        throw new Error(
          'Transaction submission timed out before on-chain confirmation. Please refresh the deal and check whether the funds were actually locked before trying again.',
        )
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
