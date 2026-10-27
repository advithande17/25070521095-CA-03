import { useMemo, useState } from 'react';

const TIMEFRAMES = [
  { label: '5D', days: 5, points: 24, range: 0.015 },
  { label: '1M', days: 30, points: 30, range: 0.035 },
  { label: '3M', days: 90, points: 42, range: 0.07 },
  { label: '6M', days: 180, points: 48, range: 0.11 },
  { label: '1Y', days: 365, points: 52, range: 0.17 },
  { label: '5Y', days: 1825, points: 60, range: 0.28 },
];

function buildSeries(asset, timeframe) {
  const period = TIMEFRAMES.find((item) => item.label === timeframe) || TIMEFRAMES[1];
  const seed = [...asset.symbol].reduce((total, character) => total + character.charCodeAt(0), 0);
  const basePrice = Number(asset.price) || 1;
  const dailyChange = (Number(asset.change) || 0) / 100;
  let previousClose = basePrice / (1 + dailyChange);

  return Array.from({ length: period.points }, (_, index) => {
    const progress = index / Math.max(1, period.points - 1);
    const wave = Math.sin((index + seed) * 1.73) * 0.34 + Math.cos((index + seed) * 0.47) * 0.2;
    const trend = (progress - 1) * dailyChange * 0.18;
    const close = index === period.points - 1
      ? basePrice
      : Math.max(basePrice * 0.05, basePrice * (1 + trend + wave * period.range));
    const open = index === 0 ? previousClose : previousClose;
    const spread = period.range * basePrice * (0.035 + (Math.sin(index + seed) + 1) * 0.035);
    const high = Math.max(open, close) + spread;
    const low = Math.max(basePrice * 0.01, Math.min(open, close) - spread);
    const date = new Date();
    date.setDate(date.getDate() - Math.round(period.days * (1 - progress)));
    const volume = Math.round(250000 + Math.abs(Math.sin((index + seed) * 1.91)) * 1750000);

    previousClose = close;
    return { date, open, high, low, close, volume };
  });
}

function compactMoney(value) {
  return `₹${new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export default function PriceChart({ asset, money }) {
  const [timeframe, setTimeframe] = useState('1M');
  const [chartType, setChartType] = useState('line');
  const [showVolume, setShowVolume] = useState(true);
  const data = useMemo(() => buildSeries(asset, timeframe), [asset, timeframe]);

  const width = 820;
  const height = 260;
  const left = 76;
  const right = 748;
  const top = 18;
  const bottom = 178;
  const volumeTop = 194;
  const volumeBottom = 232;
  const minPrice = Math.min(...data.map((point) => point.low));
  const maxPrice = Math.max(...data.map((point) => point.high));
  const priceRange = Math.max(maxPrice - minPrice, Math.abs(maxPrice) * 0.01, 0.01);
  const paddedMin = minPrice - priceRange * 0.08;
  const paddedMax = maxPrice + priceRange * 0.08;
  const yFor = (price) => bottom - ((price - paddedMin) / (paddedMax - paddedMin)) * (bottom - top);
  const xFor = (index) => left + (index / Math.max(1, data.length - 1)) * (right - left);
  const linePath = data.map((point, index) => `${index ? 'L' : 'M'} ${xFor(index)} ${yFor(point.close)}`).join(' ');
  const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;
  const maxVolume = Math.max(...data.map((point) => point.volume), 1);
  const barWidth = Math.max(3, Math.min(9, ((right - left) / data.length) * 0.58));
  const dateLabel = (point) => point.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <section className="price-chart" aria-label={`${asset.symbol} price chart`}>
      <div className="price-chart-heading">
        <div>
          <span className="chart-eyebrow">PRICE MONITOR</span>
          <strong>{asset.symbol} <span>·</span> {timeframe}</strong>
        </div>
        <span className={`chart-change ${asset.change >= 0 ? 'positive' : 'negative'}`}>
          {asset.change > 0 ? '+' : ''}{asset.change}%
        </span>
      </div>

      <div className="chart-toolbar">
        <div className="chart-ranges" aria-label="Chart time range">
          {TIMEFRAMES.map((period) => (
            <button
              key={period.label}
              type="button"
              className={`chart-range ${timeframe === period.label ? 'active' : ''}`}
              aria-pressed={timeframe === period.label}
              onClick={() => setTimeframe(period.label)}
            >
              {period.label}
            </button>
          ))}
        </div>
        <div className="chart-modes" aria-label="Chart display options">
          <button
            type="button"
            className={`chart-mode ${chartType === 'line' ? 'active' : ''}`}
            aria-pressed={chartType === 'line'}
            onClick={() => setChartType('line')}
          >
            Line
          </button>
          <button
            type="button"
            className={`chart-mode ${chartType === 'candles' ? 'active' : ''}`}
            aria-pressed={chartType === 'candles'}
            onClick={() => setChartType('candles')}
          >
            Candles
          </button>
          <button
            type="button"
            className={`chart-mode volume-toggle ${showVolume ? 'active' : ''}`}
            aria-pressed={showVolume}
            onClick={() => setShowVolume((visible) => !visible)}
          >
            Vol
          </button>
        </div>
      </div>

      <div className="chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${asset.name} ${timeframe} simulated price history`}>
          <defs>
            <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8b7cff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#8b7cff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = top + ((bottom - top) / 4) * tick;
            const price = paddedMax - ((paddedMax - paddedMin) / 4) * tick;
            return (
              <g key={tick}>
                <line x1={left} x2={right} y1={y} y2={y} className="chart-grid-line" />
                <text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{compactMoney(price)}</text>
              </g>
            );
          })}
          <line x1={left} x2={right} y1={volumeTop - 5} y2={volumeTop - 5} className="chart-grid-line" />
          {showVolume && data.map((point, index) => {
            const barHeight = (point.volume / maxVolume) * (volumeBottom - volumeTop);
            const rising = point.close >= point.open;
            return (
              <rect
                key={`volume-${index}`}
                x={xFor(index) - barWidth / 2}
                y={volumeBottom - barHeight}
                width={barWidth}
                height={barHeight}
                rx="1"
                className={rising ? 'chart-volume up' : 'chart-volume down'}
              />
            );
          })}
          {chartType === 'line' ? (
            <>
              <path d={areaPath} fill="url(#chartFill)" />
              <path d={linePath} className="chart-line" />
              <circle cx={xFor(data.length - 1)} cy={yFor(data[data.length - 1].close)} r="4" className="chart-last-point">
                <title>Current demo quote: {money(asset.price)}</title>
              </circle>
            </>
          ) : data.map((point, index) => {
            const rising = point.close >= point.open;
            const bodyTop = Math.min(yFor(point.open), yFor(point.close));
            const bodyHeight = Math.max(2, Math.abs(yFor(point.open) - yFor(point.close)));
            return (
              <g key={`candle-${index}`} className={rising ? 'chart-candle up' : 'chart-candle down'}>
                <line x1={xFor(index)} x2={xFor(index)} y1={yFor(point.high)} y2={yFor(point.low)} />
                <rect x={xFor(index) - barWidth / 2} y={bodyTop} width={barWidth} height={bodyHeight} rx="1" />
                <title>{dateLabel(point)} · O {money(point.open)} · H {money(point.high)} · L {money(point.low)} · C {money(point.close)}</title>
              </g>
            );
          })}
          {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((index) => (
            <text key={`date-${index}`} x={xFor(index)} y={height - 7} textAnchor="middle" className="chart-axis-label">
              {dateLabel(data[index])}
            </text>
          ))}
          {showVolume && <text x={left} y={volumeTop + 10} className="chart-volume-label">VOL</text>}
        </svg>
      </div>

      <div className="chart-footnote">
        <span>Simulated history · not live market data</span>
        <strong>{money(asset.price)}</strong>
      </div>
    </section>
  );
}