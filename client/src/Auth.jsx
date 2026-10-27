
import { useState } from 'react';
import { apiRequest } from './api';
import BrandMark from './BrandMark';

export default function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const path = isRegister ? '/auth/register' : '/auth/login';

      const data = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify({
          ...(isRegister ? { name } : {}),
          email,
          password,
        }),
      });

      onLogin(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <BrandMark />
        <h1 style={styles.brandTitle}>FLEXI<span style={{ color: '#9be8ff' }}>TRADE</span></h1>
        <p style={styles.subtitle}>
          Your personal paper-trading terminal
        </p>

        <h2>{isRegister ? 'Create account' : 'Welcome back'}</h2>
        <p style={styles.subtitle}>
          {isRegister
            ? 'Start practising with virtual money.'
            : 'Log in to continue trading.'}
        </p>

        {isRegister && (
          <input
            style={styles.input}
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={60}
            required
          />
        )}

        <input
          style={styles.input}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Password (minimum 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          maxLength={72}
          required
        />

        {message && <p style={styles.error}>{message}</p>}

        <button style={styles.button} disabled={loading}>
          {loading
            ? 'Please wait...'
            : isRegister
              ? 'Create account →'
              : 'Login →'}
        </button>

        <p style={styles.switchText}>
          {isRegister ? 'Already registered?' : "Don't have an account?"}{' '}
          <button
            type="button"
            style={styles.link}
            onClick={() => {
              setIsRegister(!isRegister);
              setMessage('');
            }}
          >
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>

        <p style={styles.disclaimer}>
          Educational simulator · Virtual money only
        </p>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'radial-gradient(circle at 50% 20%, #18243a 0, #0a0d14 55%)',
    color: '#f1f5f9',
    fontFamily: 'DM Sans, sans-serif',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    boxSizing: 'border-box',
    padding: 38,
    background: 'linear-gradient(160deg, #151e2c, #0f151f)',
    border: '1px solid #2a3850',
    boxShadow: '0 28px 80px #0008',
    borderRadius: 18,
  },
  logo: {
    width: 44,
    height: 44,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #47e0ae, #28c995)',
    color: '#0b1018',
    borderRadius: 12,
    fontSize: 25,
    fontWeight: 800,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 1.6,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 13,
    marginTop: 12,
    borderRadius: 9,
    border: '1px solid #2b3749',
    background: '#0b111a',
    color: '#f1f5f9',
    fontSize: 14,
  },
  button: {
    width: '100%',
    padding: 14,
    marginTop: 18,
    border: 0,
    borderRadius: 9,
    background: 'linear-gradient(135deg, #47e0ae, #28c995)',
    color: '#07130f',
    fontWeight: 700,
    cursor: 'pointer',
  },
  brandTitle: {
    margin: '18px 0 6px',
    font: '700 27px Space Grotesk, sans-serif',
    letterSpacing: '-1px',
  },
  error: {
    color: '#ff8585',
    fontSize: 13,
  },
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 20,
  },
  link: {
    background: 'none',
    border: 0,
    color: '#39d9a1',
    cursor: 'pointer',
    fontWeight: 700,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#64748b',
    marginTop: 24,
  },
};

