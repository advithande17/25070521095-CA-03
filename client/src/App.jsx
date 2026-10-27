
import { useEffect, useMemo, useState } from 'react';
import Auth from './Auth';
import { apiRequest } from './api';
import PriceChart from './PriceChart';
import BrandMark from './BrandMark';

const STARTING_CASH = 1000000;

const INITIAL_MARKETS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', market: 'Stocks', price: 1420, change: 1.82 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', market: 'Stocks', price: 3250, change: 0.74 },
  { symbol: 'INFY', name: 'Infosys', market: 'Stocks', price: 1580, change: -0.62 },
  { symbol: 'AAPL', name: 'Apple', market: 'Stocks', price: 18500, change: 1.25 },
  { symbol: 'BTC', name: 'Bitcoin', market: 'Crypto', price: 5800000, change: 2.41 },
  { symbol: 'ETH', name: 'Ethereum', market: 'Crypto', price: 245000, change: -1.14 },
  { symbol: 'USD/INR', name: 'US Dollar / Indian Rupee', market: 'Forex', price: 83.5, change: 0.18 },
  { symbol: 'EUR/INR', name: 'Euro / Indian Rupee', market: 'Forex', price: 90.2, change: -0.21 },
  { symbol: 'GOLD', name: 'Gold per gram', market: 'Commodities', price: 7200, change: 0.86 },
  { symbol: 'SILVER', name: 'Silver per gram', market: 'Commodities', price: 88, change: -0.45 },
];

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export default function App() {
  const [markets] = useState(INITIAL_MARKETS);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [cash, setCash] = useState(STARTING_CASH);
  const [holdings, setHoldings] = useState({});
  const [quantity, setQuantity] = useState('1');
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('flexi_token');
    const userText = localStorage.getItem('flexi_user');

    if (!token || !userText) return null;

    try {
      return { token, user: JSON.parse(userText) };
    } catch {
      localStorage.removeItem('flexi_token');
      localStorage.removeItem('flexi_user');
      return null;
    }
  });

  function handleLogin(data) {
    localStorage.setItem('flexi_token', data.token);
    localStorage.setItem('flexi_user', JSON.stringify(data.user));
    setSession({ token: data.token, user: data.user });
  }

  function handleLogout() {
    localStorage.removeItem('flexi_token');
    localStorage.removeItem('flexi_user');
    setSession(null);
    setCash(STARTING_CASH);
    setHoldings({});
    setOrders([]);
    setMessage('');
  }

  async function refreshPortfolio(token) {
    const [portfolio, orderData] = await Promise.all([
      apiRequest('/trading/portfolio', {}, token),
      apiRequest('/trading/orders', {}, token),
    ]);

    setCash(portfolio.cash);
    setHoldings(portfolio.holdings || {});

    setOrders(
      orderData.map((order) => ({
        ...order,
        id: order._id || order.id,
        time: new Date(order.createdAt || order.time).toLocaleString(),
      }))
    );
  }

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadPortfolio() {
      try {
        const [portfolio, orderData] = await Promise.all([
          apiRequest('/trading/portfolio', {}, session.token),
          apiRequest('/trading/orders', {}, session.token),
        ]);

        if (cancelled) return;

        setCash(portfolio.cash);
        setHoldings(portfolio.holdings || {});

        setOrders(
          orderData.map((order) => ({
            ...order,
            id: order._id || order.id,
            time: new Date(order.createdAt || order.time).toLocaleString(),
          }))
        );
      } catch (error) {
        if (cancelled) return;

        if (
          error.message.toLowerCase().includes('token') ||
          error.message.toLowerCase().includes('log in') ||
          error.message.toLowerCase().includes('login')
        ) {
          handleLogout();
        } else {
          setMessage(error.message);
        }
      }
    }

    loadPortfolio();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const selected = markets.find((item) => item.symbol === selectedSymbol);

  const visibleMarkets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return markets.filter((item) => {
      const matchesCategory =
        category === 'All' || item.market === category;

      const matchesSearch =
        item.symbol.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [markets, category, search]);

  const positions = Object.entries(holdings)
    .filter(([, holding]) => Number(holding.quantity) > 0)
    .map(([symbol, holding]) => {
      const asset = markets.find((item) => item.symbol === symbol);

      return {
        symbol,
        ...holding,
        quantity: Number(holding.quantity),
        averagePrice: Number(holding.averagePrice || 0),
        name: asset?.name || symbol,
        price: asset?.price || 0,
        value: (asset?.price || 0) * Number(holding.quantity),
      };
    });

  const holdingsValue = positions.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const portfolioValue = cash + holdingsValue;

  const totalProfit = positions.reduce(
    (sum, item) =>
      sum + (item.price - item.averagePrice) * item.quantity,
    0
  );

  async function trade(side) {
    if (!session?.token) {
      setMessage('Please log in to place an order.');
      return;
    }

    if (busy) return;

    setMessage('');

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid quantity greater than zero.');
      return;
    }

    if (!Number.isFinite(amount * selected.price)) {
      setMessage('Please enter a valid quantity.');
      return;
    }

    setBusy(true);

    try {
      const result = await apiRequest(
        '/trading/order',
        {
          method: 'POST',
          body: JSON.stringify({
            symbol: selected.symbol,
            side,
            quantity: amount,
          }),
        },
        session.token
      );

      await refreshPortfolio(session.token);

      setMessage(
        result.message ||
          `${side === 'BUY' ? 'Bought' : 'Sold'} ${amount} ${selected.symbol} successfully in paper trading.`
      );
    } catch (error) {
      const errorText = error.message || 'Unable to place this order.';

      if (
        errorText.toLowerCase().includes('token') ||
        errorText.toLowerCase().includes('log in') ||
        errorText.toLowerCase().includes('login')
      ) {
        handleLogout();
        setMessage('Your session expired. Please log in again.');
      } else {
        setMessage(errorText);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="trade-app">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <strong>FLEXI<span>TRADE</span></strong>
            <small>TRADING TERMINAL</small>
          </div>
        </div>

        <div className="side-label">WORKSPACE</div>
        <a className="side-link active" href="#dashboard">▦ Dashboard</a>
        <a className="side-link" href="#markets">↗ Markets</a>
        <a className="side-link" href="#portfolio">◫ Portfolio</a>
        <a className="side-link" href="#orders">↔ Order history</a>

        <div className="sidebar-bottom">
          <span className="status-dot" />
          <div>
            <strong>Paper trading</strong>
            <small>Simulation mode</small>
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <div className="eyebrow">YOUR PERSONAL TRADING SPACE</div>
            <h1>Market overview<span>.</span></h1>
            <p>
              Welcome, {session.user?.name || 'Trader'}! Explore markets and practice your strategy.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="demo-badge">● SIMULATED DATA</div>
            <button
              className="sell-button"
              onClick={handleLogout}
              disabled={busy}
            >
              Logout
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card featured">
            <div className="stat-heading">Total portfolio value <span>↗</span></div>
            <div className="stat-value">{money(portfolioValue)}</div>
            <div className="stat-note">Virtual cash + holdings</div>
          </article>

          <article className="stat-card">
            <div className="stat-heading">Available cash</div>
            <div className="stat-value">{money(cash)}</div>
            <div className="stat-note">Ready for simulated orders</div>
          </article>

          <article className="stat-card">
            <div className="stat-heading">Holdings value</div>
            <div className="stat-value">{money(holdingsValue)}</div>
            <div className="stat-note">{positions.length} assets held</div>
          </article>

          <article className="stat-card">
            <div className="stat-heading">Unrealized P&amp;L</div>
            <div className={`stat-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {totalProfit >= 0 ? '+' : ''}{money(totalProfit)}
            </div>
            <div className="stat-note">Based on demo prices</div>
          </article>
        </section>

        {message && (
          <div className="trade-message" role="status" style={{ marginBottom: 16 }}>
            {message}
          </div>
        )}

        <section className="market-layout" id="markets">
          <article className="panel market-panel">
            <div className="panel-heading">
              <div>
                <h2>Explore markets</h2>
                <p>Choose an asset to view its quote</p>
              </div>
              <span className="count-badge">{visibleMarkets.length} assets</span>
            </div>

            <input
              className="search-input"
              aria-label="Search assets"
              placeholder="Search symbol or company..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="market-tabs">
              {['All', 'Stocks', 'Crypto', 'Forex', 'Commodities'].map((item) => (
                <button
                  key={item}
                  className={category === item ? 'market-tab selected' : 'market-tab'}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="asset-list">
              {visibleMarkets.map((item) => (
                <button
                  key={item.symbol}
                  className={`asset-row ${selectedSymbol === item.symbol ? 'chosen' : ''}`}
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    setMessage('');
                  }}
                >
                  <span className="asset-avatar">{item.symbol.slice(0, 2)}</span>

                  <span className="asset-details">
                    <strong>{item.symbol}</strong>
                    <small>{item.name}</small>
                  </span>

                  <span className="asset-quote">
                    <strong>{money(item.price)}</strong>
                    <small className={item.change >= 0 ? 'positive' : 'negative'}>
                      {item.change > 0 ? '+' : ''}{item.change}%
                    </small>
                  </span>
                </button>
              ))}

              {visibleMarkets.length === 0 && (
                <p className="empty-state">No matching assets found.</p>
              )}
            </div>
          </article>

          <PriceChart asset={selected} money={money} />

          <article className="panel trade-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">{selected.market.toUpperCase()}</div>
                <h2>{selected.name}</h2>
                <p>{selected.symbol} · Demo quote</p>
              </div>
              <div className="asset-large-icon">{selected.symbol.slice(0, 2)}</div>
            </div>

            <div className="quote-box">
              <div className="stat-heading">Simulated price</div>
              <div className="quote-price">{money(selected.price)}</div>
              <span className={selected.change >= 0 ? 'change-chip up' : 'change-chip down'}>
                {selected.change > 0 ? '+' : ''}{selected.change}% today
              </span>
            </div>

            <div className="notice">
              Demo prices only. This is not a live exchange feed.
            </div>

            <label className="field-label" htmlFor="quantity">Order quantity</label>

            <input
              id="quantity"
              className="search-input quantity-input"
              type="number"
              min="0.000001"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />

            <div className="order-estimate">
              <span>Estimated order value</span>
              <strong>{money(selected.price * Math.max(0, Number(quantity) || 0))}</strong>
            </div>

            <div className="trade-buttons">
              <button
                className="buy-button"
                onClick={() => trade('BUY')}
                disabled={busy}
              >
                {busy ? 'Processing...' : 'Buy asset ↗'}
              </button>

              <button
                className="sell-button"
                onClick={() => trade('SELL')}
                disabled={busy}
              >
                {busy ? 'Processing...' : 'Sell asset ↙'}
              </button>
            </div>

            <p className="disclaimer">
              Practice with virtual money. No real orders are placed.
            </p>
          </article>
        </section>

        <section className="panel portfolio-panel" id="portfolio">
          <div className="panel-heading">
            <div>
              <h2>Your holdings</h2>
              <p>Assets saved in your simulated portfolio</p>
            </div>
          </div>

          {positions.length === 0 ? (
            <div className="empty-state">
              Your portfolio is empty. Select an asset above to try a demo buy order.
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Quantity</th>
                    <th>Average price</th>
                    <th>Current value</th>
                    <th>P&amp;L</th>
                  </tr>
                </thead>

                <tbody>
                  {positions.map((item) => {
                    const profit = (item.price - item.averagePrice) * item.quantity;

                    return (
                      <tr key={item.symbol}>
                        <td>
                          <strong>{item.symbol}</strong>
                          <small>{item.name}</small>
                        </td>
                        <td>{item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 6 })}</td>
                        <td>{money(item.averagePrice)}</td>
                        <td>{money(item.value)}</td>
                        <td className={profit >= 0 ? 'positive' : 'negative'}>
                          {profit >= 0 ? '+' : ''}{money(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel portfolio-panel" id="orders">
          <div className="panel-heading">
            <div>
              <h2>Recent orders</h2>
              <p>Orders saved to your account</p>
            </div>
            <span className="count-badge">{orders.length} orders</span>
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">
              No orders yet. Your paper-trading activity will appear here.
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Side</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Time</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td><strong>{order.symbol}</strong></td>
                      <td>
                        <span className={order.side === 'BUY' ? 'order-buy' : 'order-sell'}>
                          {order.side}
                        </span>
                      </td>
                      <td>{order.quantity}</td>
                      <td>{money(order.price)}</td>
                      <td>{order.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="footer-note">
          FLEXI TRADE · Educational paper-trading simulator · All quotes are illustrative
        </footer>
      </main>
    </div>
  );
}
