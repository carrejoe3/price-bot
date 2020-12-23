require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')
const Web3 = require('web3')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const moment = require('moment-timezone')
const numeral = require('numeral')
const _ = require('lodash')
const axios = require('axios')
const ABIs = require('./ABIs')

// SERVER CONFIG
const PORT = process.env.PORT || 5000
const app = express();
const server = http.createServer(app).listen(PORT, () => console.log(`Listening on ${ PORT }`))

// WEB3 CONFIG
const web3 = new Web3(process.env.RPC_URL)

// Uniswap Factory Contract: https://etherscan.io/address/0xc0a47dfe034b400b47bdad5fecda2621de6c4d95#code
const UNISWAP_FACTORY_ABI = ABIs.uniswapFactory
const UNISWAP_FACTORY_ADDRESS = '0xc0a47dfe034b400b47bdad5fecda2621de6c4d95'
const uniswapFactoryContract = new web3.eth.Contract(UNISWAP_FACTORY_ABI, UNISWAP_FACTORY_ADDRESS)

// Uniswap Exchange Template: https://etherscan.io/address/0x09cabec1ead1c0ba254b09efb3ee13841712be14#code
const UNISWAP_EXCHANGE_ABI = ABIs.uniswapExchange

// Kyber mainnet "Expected Rate": https://etherscan.io/address/0x96b610046d63638d970e6243151311d8827d69a5#readContract
const KYBER_RATE_ABI = ABIs.kyber
const KYBER_RATE_ADDRESS = '0x96b610046d63638d970e6243151311d8827d69a5'
const kyberRateContract = new web3.eth.Contract(KYBER_RATE_ABI, KYBER_RATE_ADDRESS)

async function checkPair (args) {
  const { inputTokenSymbol, inputTokenAddress, outputTokenSymbol, outputTokenAddress, inputAmount } = args

  const exchangeAddress = await uniswapFactoryContract.methods.getExchange(outputTokenAddress).call()
  const exchangeContract = new web3.eth.Contract(UNISWAP_EXCHANGE_ABI, exchangeAddress)

  const uniswapResult = await exchangeContract.methods.getEthToTokenInputPrice(inputAmount).call()
  let kyberResult = await kyberRateContract.methods.getExpectedRate(inputTokenAddress, outputTokenAddress, inputAmount, true).call()

  console.table([{
    'Input Token': inputTokenSymbol,
    'Output Token': outputTokenSymbol,
    'Input Amount': web3.utils.fromWei(inputAmount, 'Ether'),
    'Uniswap Return': web3.utils.fromWei(uniswapResult, 'Ether'),
    'Kyber Expected Rate': web3.utils.fromWei(kyberResult.expectedRate, 'Ether'),
    'Kyber Min Return': web3.utils.fromWei(kyberResult.slippageRate, 'Ether'),
    'Timestamp': moment().tz('America/Chicago').format(),
  }])

  return {
    uniswapPrice: web3.utils.fromWei(uniswapResult, 'Ether'),
    kyberPrice: web3.utils.fromWei(kyberResult.slippageRate, 'Ether')
  }
}

let priceMonitor
let monitoringPrice = false

async function monitorPrice() {
  if(monitoringPrice) {
    return
  }

  console.log("Checking prices...")
  monitoringPrice = true

  try {

    // ADD YOUR CUSTOM TOKEN PAIRS HERE!!!

    const results = await checkPair({
      inputTokenSymbol: 'ETH',
      inputTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      outputTokenSymbol: 'MKR',
      outputTokenAddress: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
      inputAmount: web3.utils.toWei('1', 'ETHER')
    })

    compareResults(results)

  } catch (error) {
    console.error(error)
    monitoringPrice = false
    clearInterval(priceMonitor)
    return
  }

  monitoringPrice = false
}

compareResults = (results) => {
  console.log
}

// Check markets every n seconds
const POLLING_INTERVAL = process.env.POLLING_INTERVAL || 3000 // 3 Seconds
priceMonitor = setInterval(async () => { await monitorPrice() }, POLLING_INTERVAL)
