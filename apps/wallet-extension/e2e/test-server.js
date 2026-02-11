/**
 * Simple Test Server for E2E Tests
 *
 * Serves a minimal dApp page that can interact with the wallet extension
 * for testing connection, transaction, and signing flows.
 */

const http = require('http')

const PORT = 5173

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test dApp</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    button {
      background: #6366f1;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      margin: 5px;
    }
    button:hover {
      background: #4f46e5;
    }
    button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
    .status {
      margin-top: 10px;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
    }
    .success { background: #d1fae5; color: #065f46; }
    .error { background: #fee2e2; color: #991b1b; }
    .info { background: #e0e7ff; color: #3730a3; }
    h1 { color: #1f2937; }
    h2 { color: #374151; margin-top: 0; }
  </style>
</head>
<body>
  <h1>🧪 E2E Test dApp</h1>

  <div class="card">
    <h2>Connection</h2>
    <button id="connectBtn" onclick="connect()">Connect Wallet</button>
    <button id="disconnectBtn" onclick="disconnect()" disabled>Disconnect</button>
    <div id="connectionStatus" class="status info">Not connected</div>
  </div>

  <div class="card">
    <h2>Account Info</h2>
    <div id="accountInfo" class="status info">Connect wallet to see account</div>
  </div>

  <div class="card">
    <h2>Transactions</h2>
    <button id="sendTxBtn" onclick="sendTransaction()" disabled>Send Transaction</button>
    <div id="txStatus" class="status info">No transaction sent</div>
  </div>

  <div class="card">
    <h2>Signing</h2>
    <button id="signBtn" onclick="signMessage()" disabled>Sign Message</button>
    <button id="signTypedBtn" onclick="signTypedData()" disabled>Sign Typed Data</button>
    <div id="signStatus" class="status info">No signature requested</div>
  </div>

  <div class="card">
    <h2>Network</h2>
    <button id="switchNetworkBtn" onclick="switchNetwork()" disabled>Switch to Sepolia</button>
    <div id="networkStatus" class="status info">Unknown network</div>
  </div>

  <script>
    let accounts = [];
    let chainId = null;

    // Check if ethereum provider is available
    function checkProvider() {
      if (typeof window.ethereum === 'undefined') {
        document.getElementById('connectionStatus').textContent = 'No wallet detected';
        document.getElementById('connectionStatus').className = 'status error';
        return false;
      }
      return true;
    }

    // Connect wallet
    async function connect() {
      if (!checkProvider()) return;

      try {
        document.getElementById('connectionStatus').textContent = 'Connecting...';
        document.getElementById('connectionStatus').className = 'status info';

        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        chainId = await window.ethereum.request({ method: 'eth_chainId' });

        document.getElementById('connectionStatus').textContent = 'Connected: ' + accounts[0];
        document.getElementById('connectionStatus').className = 'status success';

        document.getElementById('accountInfo').textContent = 'Account: ' + accounts[0] + '\\nChain ID: ' + chainId;
        document.getElementById('networkStatus').textContent = 'Chain ID: ' + chainId;

        // Enable buttons
        document.getElementById('disconnectBtn').disabled = false;
        document.getElementById('sendTxBtn').disabled = false;
        document.getElementById('signBtn').disabled = false;
        document.getElementById('signTypedBtn').disabled = false;
        document.getElementById('switchNetworkBtn').disabled = false;
        document.getElementById('connectBtn').disabled = true;
      } catch (error) {
        document.getElementById('connectionStatus').textContent = 'Error: ' + error.message;
        document.getElementById('connectionStatus').className = 'status error';
      }
    }

    // Disconnect (just reset UI, real disconnect would need wallet support)
    function disconnect() {
      accounts = [];
      chainId = null;

      document.getElementById('connectionStatus').textContent = 'Disconnected';
      document.getElementById('connectionStatus').className = 'status info';
      document.getElementById('accountInfo').textContent = 'Connect wallet to see account';

      document.getElementById('disconnectBtn').disabled = true;
      document.getElementById('sendTxBtn').disabled = true;
      document.getElementById('signBtn').disabled = true;
      document.getElementById('signTypedBtn').disabled = true;
      document.getElementById('switchNetworkBtn').disabled = true;
      document.getElementById('connectBtn').disabled = false;
    }

    // Send transaction
    async function sendTransaction() {
      if (!accounts[0]) return;

      try {
        document.getElementById('txStatus').textContent = 'Sending...';
        document.getElementById('txStatus').className = 'status info';

        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: '0x0000000000000000000000000000000000000002',
            value: '0x1',
            gas: '0x5208',
          }],
        });

        document.getElementById('txStatus').textContent = 'TX Hash: ' + txHash;
        document.getElementById('txStatus').className = 'status success';
      } catch (error) {
        document.getElementById('txStatus').textContent = 'Error: ' + error.message;
        document.getElementById('txStatus').className = 'status error';
      }
    }

    // Sign message
    async function signMessage() {
      if (!accounts[0]) return;

      try {
        document.getElementById('signStatus').textContent = 'Requesting signature...';
        document.getElementById('signStatus').className = 'status info';

        const message = 'Hello, StableNet! Timestamp: ' + Date.now();
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, accounts[0]],
        });

        document.getElementById('signStatus').textContent = 'Signature: ' + signature.substring(0, 40) + '...';
        document.getElementById('signStatus').className = 'status success';
      } catch (error) {
        document.getElementById('signStatus').textContent = 'Error: ' + error.message;
        document.getElementById('signStatus').className = 'status error';
      }
    }

    // Sign typed data (EIP-712)
    async function signTypedData() {
      if (!accounts[0]) return;

      try {
        document.getElementById('signStatus').textContent = 'Requesting typed data signature...';
        document.getElementById('signStatus').className = 'status info';

        const typedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
            ],
            Message: [
              { name: 'content', type: 'string' },
              { name: 'timestamp', type: 'uint256' },
            ],
          },
          primaryType: 'Message',
          domain: {
            name: 'Test App',
            version: '1',
            chainId: parseInt(chainId, 16),
          },
          message: {
            content: 'Hello from E2E test',
            timestamp: Date.now(),
          },
        };

        const signature = await window.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [accounts[0], JSON.stringify(typedData)],
        });

        document.getElementById('signStatus').textContent = 'Typed Signature: ' + signature.substring(0, 40) + '...';
        document.getElementById('signStatus').className = 'status success';
      } catch (error) {
        document.getElementById('signStatus').textContent = 'Error: ' + error.message;
        document.getElementById('signStatus').className = 'status error';
      }
    }

    // Switch network
    async function switchNetwork() {
      try {
        document.getElementById('networkStatus').textContent = 'Switching...';
        document.getElementById('networkStatus').className = 'status info';

        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia
        });

        chainId = await window.ethereum.request({ method: 'eth_chainId' });
        document.getElementById('networkStatus').textContent = 'Switched to Chain ID: ' + chainId;
        document.getElementById('networkStatus').className = 'status success';
      } catch (error) {
        document.getElementById('networkStatus').textContent = 'Error: ' + error.message;
        document.getElementById('networkStatus').className = 'status error';
      }
    }

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (newAccounts) => {
        accounts = newAccounts;
        if (accounts.length === 0) {
          disconnect();
        } else {
          document.getElementById('accountInfo').textContent = 'Account: ' + accounts[0] + '\\nChain ID: ' + chainId;
        }
      });

      window.ethereum.on('chainChanged', (newChainId) => {
        chainId = newChainId;
        document.getElementById('networkStatus').textContent = 'Chain ID: ' + chainId;
        document.getElementById('networkStatus').className = 'status success';
      });
    }

    // Initial check
    checkProvider();
  </script>
</body>
</html>
`

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(HTML_PAGE)
})

server.listen(PORT, () => {})
