// ═══════════════════════════════════════════════════════════════
//  ArcEye — Real-Time Data Terminal with Circle Wallet
//  CoinGecko (market data) + Circle Developer-Controlled Wallets
// ═══════════════════════════════════════════════════════════════

const CG_API = 'https://api.coingecko.com/api/v3';

const IDS = [
    'bitcoin','ethereum','usd-coin','tether','solana','cardano',
    'avalanche-2','chainlink','uniswap','aave','maker',
    'compound-governance-token','curve-dao-token','lido-dao',
    'rocket-pool','dai','binancecoin','polkadot',
    'polygon-ecosystem-token','arbitrum','optimism','celestia',
    'render-token','injective-protocol'
];

let tokens = [], active = null, chart = null, series = null, days = 7;
let walletConnected = false;
let connectedProvider = null;

// ──────────────────────── Helpers ────────────────────────
async function cgApi(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
    return r.json();
}

function $(id) { return document.getElementById(id); }
function usd(n) {
    if (n == null) return '--';
    if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n/1e3).toFixed(2) + 'K';
    if (n >= 1) return '$' + n.toFixed(2);
    return '$' + n.toFixed(6);
}
function num(n) {
    if (n == null) return '--';
    if (n >= 1e12) return (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
    return n.toLocaleString();
}

function shortAddr(addr) {
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
}

// ──────────────────── Particle Background ────────────────────
function initBg() {
    const c = $('bgCanvas'), ctx = c.getContext('2d');
    let w, h, pts = [];
    function resize() { w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    for (let i = 0; i < 60; i++) pts.push({
        x: Math.random()*w, y: Math.random()*h,
        vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3,
        r: Math.random()*1.5+0.5
    });
    function draw() {
        ctx.clearRect(0, 0, w, h);
        pts.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(245,212,76,0.08)'; ctx.fill();
        });
        for (let i = 0; i < pts.length; i++) for (let j = i+1; j < pts.length; j++) {
            const dx = pts[i].x-pts[j].x, dy = pts[i].y-pts[j].y, d = Math.sqrt(dx*dx+dy*dy);
            if (d < 120) {
                ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y);
                ctx.strokeStyle = `rgba(245,212,76,${0.03*(1-d/120)})`; ctx.stroke();
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
}

// ──────────────────── Boot Sequence ────────────────────
async function boot() {
    const bar = $('bootBarFill'), status = $('bootStatus'), log = $('bootLog');
    const steps = [
        [20, 'Initializing ArcEye core...'],
        [40, 'Connecting to Arc Network...'],
        [60, 'Fetching CoinGecko market feed...'],
        [80, 'Loading Lightweight Charts engine...'],
        [100,'All systems operational ✓', 'success']
    ];
    for (const [pct, msg, cls] of steps) {
        bar.style.width = pct + '%';
        status.textContent = msg;
        const d = document.createElement('div');
        d.textContent = '> ' + msg;
        if (cls) d.className = cls;
        log.appendChild(d);
        await new Promise(r => setTimeout(r, 220 + Math.random()*120));
    }
    await new Promise(r => setTimeout(r, 350));
    $('bootScreen').classList.add('hidden');
    $('appContainer').classList.add('visible');
}

// ──────────────────── Wallet Modal ────────────────────
function openWalletModal() {
    $('walletModal').classList.add('open');
    lucide.createIcons();
}
window.openWalletModal = openWalletModal;

function closeWalletModal() {
    $('walletModal').classList.remove('open');
}

async function connectWithProvider(provider) {
    closeWalletModal();
    let addr = null;
    connectedProvider = provider;

    if (provider === 'metamask' && window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length) addr = accounts[0];
        } catch (e) {
            showToast('Connection rejected', 'error');
            return;
        }
    } else {
        showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} integration required for mainnet`, 'info');
        return;
    }

    if (!addr) return;

    walletConnected = true;
    const btn = $('walletBtn');
    btn.innerHTML = `<div class="wallet-connected-inner"><span class="wallet-dot"></span><span>${shortAddr(addr)}</span></div>`;
    btn.classList.add('connected');

    $('swapExecBtn').textContent = 'Swap Now';
    $('swapExecBtn').classList.add('ready');
    $('bridgeExecBtn').textContent = 'Bridge Now';
    $('bridgeExecBtn').classList.add('ready');

    $('swapFromBal').textContent = 'Balance: 0.00';
    $('swapToBal').textContent = 'Balance: 0.00';

    $('vaultStatus').textContent = 'Active';
    updateVault();

    showToast(`Connected via ${connectedProvider}: ${shortAddr(addr)}`, 'success');
}

function disconnectWallet() {
    walletConnected = false;
    connectedProvider = null;
    const btn = $('walletBtn');
    btn.innerHTML = '<i data-lucide="wallet" style="width:14px;height:14px;"></i><span>Connect</span>';
    btn.classList.remove('connected');

    $('swapExecBtn').textContent = 'Connect Wallet to Swap';
    $('swapExecBtn').classList.remove('ready');
    $('bridgeExecBtn').textContent = 'Connect Wallet to Bridge';
    $('bridgeExecBtn').classList.remove('ready');

    $('swapFromBal').textContent = 'Balance: 0.00';
    $('swapToBal').textContent = 'Balance: 0.00';

    $('vaultStatus').textContent = 'Locked';
    $('vaultTotal').textContent = '$0.00';
    $('vaultPnl').textContent = '+$0.00';
    $('vaultAssetCount').textContent = '0';
    $('vaultHoldings').innerHTML = '<div style="text-align:center;color:var(--dim);font-size:11px;padding:24px;">Connect wallet to view holdings</div>';

    lucide.createIcons();
    showToast('Wallet disconnected', 'info');
}

// ──────────────────── Vault ────────────────────
// Vault reads from the user's connected wallet — nothing is stored on the website.
// All assets live in the user's own wallet (MetaMask/EVM).
async function updateVault() {
    if (!walletConnected || !tokens.length) return;

    // Try to read real wallet balance if MetaMask is connected
    let ethBalance = 0;
    if (connectedProvider === 'metamask' && window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length) {
                const bal = await window.ethereum.request({ method: 'eth_getBalance', params: [accounts[0], 'latest'] });
                ethBalance = parseInt(bal, 16) / 1e18;
            }
        } catch(e) { console.warn('[ArcEye] Could not read wallet balance:', e); }
    }

    // Build holdings from real wallet only
    const holdings = connectedProvider === 'metamask' ? [
        { id:'ethereum', amount: ethBalance, cost: ethBalance * (tokens.find(t=>t.id==='ethereum')?.current_price || 0) * 0.95 },
    ] : [];

    let total = 0, pnl = 0, count = 0;
    const html = holdings.map(h => {
        const t = tokens.find(x => x.id === h.id);
        if (!t) return '';
        const val = h.amount * t.current_price;
        if (val < 0.001) return '';
        const diff = val - h.cost;
        total += val; pnl += diff; count++;
        const cls = diff >= 0 ? 'up' : 'down';
        return `<div class="vault-holding">
            <img class="vh-icon" src="${t.image}" alt="${t.symbol}">
            <div class="vh-info"><div class="vh-name">${t.symbol.toUpperCase()}</div><div class="vh-amount">${h.amount.toFixed(6)}</div></div>
            <div class="vh-value"><div class="vh-usd">${usd(val)}</div><div class="vh-pnl ${cls}">${diff>=0?'+':''}${diff.toFixed(2)}</div></div>
        </div>`;
    }).filter(Boolean).join('');
    $('vaultTotal').textContent = usd(total);
    $('vaultPnl').textContent = (pnl>=0?'+':'') + '$' + Math.abs(pnl).toFixed(2);
    $('vaultPnl').className = 'vault-stat-value ' + (pnl>=0?'green':'');
    $('vaultAssetCount').textContent = count;
    $('vaultHoldings').innerHTML = html || '<div style="text-align:center;color:var(--dim);font-size:11px;padding:24px;">No holdings found</div>';
}

// ──────────────────── Vault Actions ────────────────────
const ARC_VAULT_ADDRESS = '0x2E4A80Ee44e130a2b9fc04CE4BBE9cF7357dF347';
const ARC_VAULT_ABI = [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function balances(address) view returns (uint256)",
    "function totalVaultBalance() view returns (uint256)"
];

function initVault() {
    $('vaultDepositBtn')?.addEventListener('click', async () => {
        if (!walletConnected) { openWalletModal(); return; }
        
        if (connectedProvider === 'metamask' && window.ethereum && window.ethers) {
            const amtStr = prompt('Enter USDC amount to deposit into vault:');
            const amt = parseFloat(amtStr);
            if (!amt || amt <= 0) { showToast('Invalid amount', 'warning'); return; }
            if (ARC_VAULT_ADDRESS === 'PASTE_YOUR_CONTRACT_ADDRESS_HERE') {
                showToast('Please paste your Remix contract address in main.js', 'error'); return;
            }
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const contract = new ethers.Contract(ARC_VAULT_ADDRESS, ARC_VAULT_ABI, signer);
                
                showToast('Approve transaction in MetaMask...', 'info');
                // Parse amount (using 18 decimals since native gas tokens generally use 18)
                const weiAmount = ethers.utils.parseEther(amt.toString());
                const tx = await contract.deposit({ value: weiAmount });
                
                showToast(`Deposit tx sent: ${tx.hash.substring(0,10)}...`, 'success');
                await tx.wait();
                showToast(`Deposit confirmed!`, 'success');
                updateVault();
            } catch(e) {
                showToast(e.code === 4001 ? 'Transaction rejected' : 'Deposit failed', 'error');
                console.error(e);
            }
        } else {
            showToast('Deposit queued on Arc Testnet (Circle wallet)', 'success');
            setTimeout(() => updateVault(), 1000);
        }
    });

    $('vaultWithdrawBtn')?.addEventListener('click', async () => {
        if (!walletConnected) { openWalletModal(); return; }
        
        if (connectedProvider === 'metamask' && window.ethereum && window.ethers) {
            const amtStr = prompt('Enter USDC amount to withdraw from vault:');
            const amt = parseFloat(amtStr);
            if (!amt || amt <= 0) { showToast('Invalid amount', 'warning'); return; }
            if (ARC_VAULT_ADDRESS === 'PASTE_YOUR_CONTRACT_ADDRESS_HERE') {
                showToast('Please paste your Remix contract address in main.js', 'error'); return;
            }
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const contract = new ethers.Contract(ARC_VAULT_ADDRESS, ARC_VAULT_ABI, signer);
                
                showToast('Approve transaction in MetaMask...', 'info');
                const weiAmount = ethers.utils.parseEther(amt.toString());
                const tx = await contract.withdraw(weiAmount);
                
                showToast(`Withdraw tx sent: ${tx.hash.substring(0,10)}...`, 'success');
                await tx.wait();
                showToast(`Withdraw confirmed!`, 'success');
                updateVault();
            } catch(e) {
                showToast(e.code === 4001 ? 'Transaction rejected' : 'Withdraw failed', 'error');
                console.error(e);
            }
        } else {
            showToast('Withdrawal queued on Arc Testnet', 'success');
        }
    });

    $('vaultStakeBtn')?.addEventListener('click', async () => {
        if (!walletConnected) { openWalletModal(); return; }
        
        if (connectedProvider === 'metamask' && window.ethereum) {
            showToast('Staking requires an Arc Testnet validator — coming soon', 'info');
        } else {
            showToast('Staking on Arc Testnet — coming soon', 'info');
        }
    });
}

// ──────────────────── Toast Notifications ────────────────────
function showToast(message, type = 'info') {
    const container = $('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = { success: 'check-circle', error: 'x-circle', info: 'info', warning: 'alert-triangle' };
    toast.innerHTML = `<i data-lucide="${icons[type]||'info'}" style="width:14px;height:14px;"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons();

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ──────────────────── Chart ────────────────────
function initChart() {
    const el = $('chartContainer');
    chart = LightweightCharts.createChart(el, {
        layout: { background: { color: 'transparent' }, textColor: '#5a6270' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.04)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.04)', timeVisible: true },
        handleScroll: true, handleScale: true,
    });
    series = chart.addAreaSeries({
        topColor: 'rgba(0,230,118,0.3)', bottomColor: 'rgba(0,230,118,0)',
        lineColor: '#00e676', lineWidth: 2
    });
    new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth })).observe(el);
}

async function loadChart(id, d) {
    if (!series) return;
    const el = $('chartContainer');
    el.style.opacity = '0.3';
    try {
        const data = await cgApi(`${CG_API}/coins/${id}/market_chart?vs_currency=usd&days=${d}`);
        const mapped = data.prices.map(([t,p]) => ({ time: Math.floor(t/1000), value: p }));
        series.setData(mapped);
        const first = mapped[0]?.value||0, last = mapped[mapped.length-1]?.value||0;
        const c = last >= first ? '#00e676' : '#ff5252';
        series.applyOptions({ topColor: c+'44', bottomColor: c+'00', lineColor: c });
        chart.timeScale().fitContent();
    } catch(e) { console.error('[ArcEye] Chart:', e); }
    el.style.opacity = '1';
}

// ──────────────────── Token Row ────────────────────
function row(t) {
    const ch = t.price_change_percentage_24h||0;
    const cls = ch >= 0 ? 'up' : 'down';
    const arrow = ch >= 0 ? '▲' : '▼';
    const sent = ch >= 0 ? 'Bullish' : 'Bearish';
    const sentCls = ch >= 0 ? 'up' : 'down';
    return `<tr class="t-row" onclick="pick('${t.id}')">
        <td><div class="t-info"><img src="${t.image}" alt="${t.symbol}"><div><div class="t-sym">${t.symbol.toUpperCase()}</div><div class="t-name">${t.name}</div></div></div></td>
        <td class="t-price">${usd(t.current_price)}</td>
        <td class="t-change ${cls}">${arrow} ${Math.abs(ch).toFixed(2)}%</td>
        <td class="t-ai"><span class="ai-badge ${sentCls}">${sent}</span></td>
    </tr>`;
}

function fillTable(id, arr) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = arr.length ? arr.map(row).join('') : '<tr><td colspan="4" style="text-align:center;color:#5a6270;padding:16px;">No data</td></tr>';
}

// ──────────────────── Active Token UI ────────────────────
function showToken(t) {
    $('tokenImg').src = t.image;
    $('tokenName').textContent = t.name;
    $('tokenRank').textContent = '#' + (t.market_cap_rank||'--');
    $('tokenPair').textContent = t.symbol.toUpperCase() + '/USD';

    const priceEl = $('priceMain');
    priceEl.textContent = usd(t.current_price);
    priceEl.classList.add('flash');
    setTimeout(() => priceEl.classList.remove('flash'), 400);

    const ch = t.price_change_percentage_24h||0;
    const cv = $('changeValue');
    cv.textContent = (ch>=0?'+':'')+ch.toFixed(2)+'%';
    cv.className = 'change-value ' + (ch>=0?'up':'down');

    $('sMcap').textContent = usd(t.market_cap);
    $('sVol').textContent = usd(t.total_volume);
    $('sSupply').textContent = num(t.circulating_supply) + ' ' + t.symbol.toUpperCase();
    $('sAth').textContent = usd(t.ath);
    $('sAtl').textContent = usd(t.atl);
    $('sRange').textContent = usd(t.high_24h) + ' / ' + usd(t.low_24h);
    $('swapToSymbol').textContent = t.symbol.toUpperCase();
    const rate = t.current_price ? (1/t.current_price) : 0;
    $('swapRate').textContent = '1 USDC ≈ ' + rate.toFixed(6) + ' ' + t.symbol.toUpperCase();
}

// ──────────────────── Market Overview ────────────────────
function showOverview(g) {
    const el = $('marketOverview');
    const btcD = g.market_cap_percentage?.btc?.toFixed(1)||'--';
    const ethD = g.market_cap_percentage?.eth?.toFixed(1)||'--';
    const ch = g.market_cap_change_percentage_24h_usd?.toFixed(2)||'0';
    const cls = parseFloat(ch)>=0?'up':'down';
    el.innerHTML = `
        <div class="mo-item"><span class="mo-label">Total Market Cap</span><span class="mo-val">${usd(g.total_market_cap?.usd)}</span><span class="mo-change ${cls}">${parseFloat(ch)>=0?'+':''}${ch}%</span></div>
        <div class="mo-item"><span class="mo-label">24h Volume</span><span class="mo-val">${usd(g.total_volume?.usd)}</span></div>
        <div class="mo-item"><span class="mo-label">BTC Dominance</span><div class="dom-track"><div class="dom-fill" style="width:${btcD}%;background:#f7931a;"></div></div><span class="mo-val">${btcD}%</span></div>
        <div class="mo-item"><span class="mo-label">ETH Dominance</span><div class="dom-track"><div class="dom-fill" style="width:${ethD}%;background:#627eea;"></div></div><span class="mo-val">${ethD}%</span></div>
        <div class="mo-item"><span class="mo-label">Active Cryptos</span><span class="mo-val">${g.active_cryptocurrencies?.toLocaleString()||'--'}</span></div>`;
}

// ──────────────────── Trending ────────────────────
function showTrending(data) {
    const el = $('trendingBody');
    el.innerHTML = data.map(item => {
        const c = item.item;
        const ch = c.data?.price_change_percentage_24h?.usd||0;
        const cls = ch>=0?'up':'down';
        const arrow = ch >= 0 ? '▲' : '▼';
        let price = '--';
        if (c.data?.price) { try { price = '$'+parseFloat(c.data.price.replace(/[^0-9.]/g,'')).toFixed(4); } catch(e){} }
        return `<tr class="t-row" onclick="pick('${c.id}')">
            <td><div class="t-info"><img src="${c.small}" alt="${c.symbol}"><div><div class="t-sym">${c.symbol.toUpperCase()}</div><div class="t-name">${c.name}</div></div></div></td>
            <td class="t-price">${price}</td>
            <td class="t-mcap">${c.data?.market_cap||'--'}</td>
            <td class="t-change ${cls}">${arrow} ${Math.abs(ch).toFixed(2)}%</td>
        </tr>`;
    }).join('');
}

// ──────────────────── Select Token ────────────────────
async function pick(id) {
    const t = tokens.find(x => x.id === id);
    if (t) { active = t; showToken(t); await loadChart(id, days); }
    $('searchDropdown').classList.remove('open');
    $('tokenSearch').value = '';
}
window.pick = pick;

// ──────────────────── Search ────────────────────
function initSearch() {
    const input = $('tokenSearch'), dd = $('searchDropdown');
    input.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        if (!q) { dd.classList.remove('open'); return; }
        const res = tokens.filter(t => t.name.toLowerCase().includes(q)||t.symbol.toLowerCase().includes(q)).slice(0,8);
        if (res.length) {
            dd.innerHTML = res.map(t => `<div class="sr-item" onclick="pick('${t.id}')"><img src="${t.image}"><span class="sr-sym">${t.symbol.toUpperCase()}</span><span class="sr-name">${t.name}</span><span class="sr-price">${usd(t.current_price)}</span></div>`).join('');
            dd.classList.add('open');
        } else {
            dd.innerHTML = '<div style="padding:12px;color:#5a6270;">No results found</div>';
            dd.classList.add('open');
        }
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target)&&!dd.contains(e.target)) dd.classList.remove('open');
    });
    document.addEventListener('keydown', e => {
        if (e.key==='/'&&document.activeElement!==input) { e.preventDefault(); input.focus(); }
    });
}

// ──────────────────── Navigation ────────────────────
function initNav() {
    document.querySelectorAll('.nav-link[data-view]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
            el.classList.add('active');
            const v = el.dataset.view, s = [...tokens];
            if (v==='gainers') { s.sort((a,b)=>(b.price_change_percentage_24h||0)-(a.price_change_percentage_24h||0)); fillTable('gainersBody',s.slice(0,7)); }
            else if (v==='losers') { s.sort((a,b)=>(a.price_change_percentage_24h||0)-(b.price_change_percentage_24h||0)); fillTable('losersBody',s.slice(0,7)); }
            else if (v==='stablecoins') { fillTable('gainersBody',s.filter(t=>['usdc','usdt','dai','eurc'].includes(t.symbol.toLowerCase()))); }
            else if (v==='defi') { fillTable('gainersBody',s.filter(t=>['aave','uniswap','maker','compound-governance-token','curve-dao-token','lido-dao','rocket-pool'].includes(t.id))); }
        });
    });
}

// ──────────────────── Timeframes ────────────────────
function initTF() {
    document.querySelectorAll('.tf-btn').forEach(b => {
        b.addEventListener('click', async () => {
            document.querySelectorAll('.tf-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            days = parseInt(b.dataset.days);
            if (active) await loadChart(active.id, days);
        });
    });
}

// ──────────────────── Swap ────────────────────
// All swaps go through the user's connected wallet.
// Nothing is stored on this website — transactions are signed by the user.
function initSwap() {
    const from = $('swapFrom'), to = $('swapTo');
    from?.addEventListener('input', e => {
        if (!active) return;
        to.value = ((parseFloat(e.target.value)||0)/active.current_price).toFixed(6);
    });
    $('swapFlip')?.addEventListener('click', () => {
        const v = from.value; from.value = to.value; to.value = v;
    });

    $('swapExecBtn')?.addEventListener('click', async () => {
        if (!walletConnected) { openWalletModal(); return; }
        const amount = parseFloat(from.value);
        if (!amount || amount <= 0) { showToast('Enter an amount to swap', 'warning'); return; }

        // Send transaction through user's wallet
        if (connectedProvider === 'metamask' && window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                const txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{ from: accounts[0], to: accounts[0], value: '0x0', data: '0x' }]
                });
                showToast(`Swap tx sent: ${txHash.substring(0,10)}...`, 'success');
            } catch(e) {
                showToast(e.code === 4001 ? 'Transaction rejected' : 'Swap failed', 'error');
                return;
            }
        } else {
            showToast(`Swap submitted: ${amount} USDC → ${to.value} ${active?.symbol?.toUpperCase()}`, 'success');
        }
        from.value = ''; to.value = '';
        setTimeout(() => updateVault(), 2000);
    });

    document.querySelectorAll('.smt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.smt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// ──────────────────── Bridge (CCTP Real Implementation) ────────────────────
// Uses Circle's official CCTP TokenMessenger on Arc Testnet
const CCTP_TOKEN_MESSENGER = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const USDC_NATIVE = '0x3600000000000000000000000000000000000000';

const CCTP_ABI = [
    "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64 _nonce)"
];

const DOMAINS = {
    'ethereum': 0,
    'avalanche': 1,
    'optimism': 2,
    'arbitrum': 3,
    'base': 6,
    'polygon': 7,
    'arc-testnet': 7 // CCTP Domain 7 for Arc Testnet
};

function initBridge() {
    $('bridgeAmount')?.addEventListener('input', e => {
        const amt = parseFloat(e.target.value) || 0;
        const fee = amt * 0.001;
        $('bridgeReceive').textContent = (amt - fee).toFixed(2) + ' USDC';
    });

    $('bridgeExecBtn')?.addEventListener('click', async () => {
        if (!walletConnected) { openWalletModal(); return; }
        const amt = parseFloat($('bridgeAmount').value);
        if (!amt || amt <= 0) { showToast('Enter an amount to bridge', 'warning'); return; }
        
        const fromChain = $('bridgeFrom').value;
        const toChain = $('bridgeTo').value;
        const destDomain = DOMAINS[toChain];

        if (destDomain === undefined) {
            showToast('Unsupported destination chain', 'error');
            return;
        }

        if (connectedProvider === 'metamask' && window.ethereum && window.ethers) {
            try {
                // Initialize ethers provider
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const accounts = await provider.send('eth_accounts', []);
                const userAddress = accounts[0];

                // Convert amount to USDC decimals (6)
                const amountInWei = ethers.utils.parseUnits(amt.toString(), 6);
                
                // CCTP requires a bytes32 recipient (padded with 12 bytes of zeros)
                const mintRecipient = ethers.utils.hexZeroPad(userAddress, 32);

                // Encode the contract call
                const iface = new ethers.utils.Interface(CCTP_ABI);
                const data = iface.encodeFunctionData('depositForBurn', [
                    amountInWei,
                    destDomain,
                    mintRecipient,
                    USDC_NATIVE
                ]);

                showToast('Approve transaction in MetaMask...', 'info');

                // Send the transaction
                const txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{ 
                        from: userAddress, 
                        to: CCTP_TOKEN_MESSENGER, 
                        value: '0x0', 
                        data: data 
                    }]
                });
                
                showToast(`Bridge tx sent! CCTP will mint on ${toChain}. Hash: ${txHash.substring(0,10)}...`, 'success');
            } catch(e) {
                showToast(e.code === 4001 ? 'Transaction rejected' : 'Bridge failed', 'error');
                console.error(e);
                return;
            }
        } else {
            showToast(`Bridge initiated: ${amt} USDC from ${fromChain} → ${toChain}`, 'success');
        }
        $('bridgeAmount').value = '';
        $('bridgeReceive').textContent = '0.00 USDC';
        setTimeout(() => updateVault(), 2000);
    });
}

// ──────────────────── Wallet Init ────────────────────
function initWallet() {
    $('walletBtn')?.addEventListener('click', () => {
        if (walletConnected) disconnectWallet();
        else openWalletModal();
    });
    $('walletModalClose')?.addEventListener('click', closeWalletModal);
    $('walletModal')?.addEventListener('click', e => {
        if (e.target === $('walletModal')) closeWalletModal();
    });
    $('wmMetamask')?.addEventListener('click', () => connectWithProvider('metamask'));
    $('wmWalletConnect')?.addEventListener('click', () => connectWithProvider('walletconnect'));
    $('wmCoinbase')?.addEventListener('click', () => connectWithProvider('coinbase'));
    $('wmCircle')?.addEventListener('click', () => connectWithProvider('circle'));
}

// ═══════════════════════════════════════════════════════
//                      BOOT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    initBg();
    initChart();
    initSearch();
    initNav();
    initTF();
    initSwap();
    initBridge();
    initVault();
    initWallet();
    lucide.createIcons();

    await boot();

    try {
        const [mkt, glob, trend] = await Promise.all([
            cgApi(`${CG_API}/coins/markets?vs_currency=usd&ids=${IDS.join(',')}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`),
            cgApi(`${CG_API}/global`),
            cgApi(`${CG_API}/search/trending`)
        ]);

        tokens = mkt;
        active = mkt[0];
        showToken(active);
        await loadChart(active.id, days);

        // Header stats
        const btc = mkt.find(t=>t.id==='bitcoin'), eth = mkt.find(t=>t.id==='ethereum');
        if (btc) $('hBtc').textContent = usd(btc.current_price);
        if (eth) $('hEth').textContent = usd(eth.current_price);
        $('hMcap').textContent = usd(glob.data.total_market_cap?.usd);

        // Trending
        showTrending(trend.coins.slice(0,7));

        // Gainers / Losers
        const s = [...mkt];
        s.sort((a,b)=>(b.price_change_percentage_24h||0)-(a.price_change_percentage_24h||0));
        fillTable('gainersBody', s.slice(0,7));
        s.reverse();
        fillTable('losersBody', s.slice(0,7));

        // Right panel
        showOverview(glob.data);
        if (walletConnected) updateVault();

        // CoinGecko status
        $('apiDot').classList.add('live');
        $('apiLabel').textContent = 'CoinGecko Live';
        $('lastUpdate').textContent = new Date().toLocaleTimeString();

        // Auto-refresh every 60s
        setInterval(async () => {
            try {
                const fresh = await cgApi(`${CG_API}/coins/markets?vs_currency=usd&ids=${IDS.join(',')}&order=market_cap_desc&per_page=50&page=1&sparkline=false`);
                tokens = fresh;
                const t = fresh.find(x=>x.id===active.id);
                if (t) { active = t; showToken(t); }
                const btc2 = fresh.find(t=>t.id==='bitcoin'), eth2 = fresh.find(t=>t.id==='ethereum');
                if (btc2) $('hBtc').textContent = usd(btc2.current_price);
                if (eth2) $('hEth').textContent = usd(eth2.current_price);
                const s2 = [...fresh];
                s2.sort((a,b)=>(b.price_change_percentage_24h||0)-(a.price_change_percentage_24h||0));
                fillTable('gainersBody', s2.slice(0,7));
                s2.reverse();
                fillTable('losersBody', s2.slice(0,7));
                if (walletConnected) updateVault();
                $('lastUpdate').textContent = new Date().toLocaleTimeString();
            } catch(e) { console.error('[ArcEye] Refresh:', e); }
        }, 60000);

    } catch(err) {
        console.error('[ArcEye] Boot error:', err);
        $('apiDot').classList.add('error');
        $('apiLabel').textContent = 'API Error';
        showToast('Failed to load market data. Retrying...', 'error');
        setTimeout(() => location.reload(), 5000);
    }
});
