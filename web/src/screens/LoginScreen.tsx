import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

const DEFAULT_DEVICE_NAME = 'web-browser';

interface LoginScreenProps {
  onLoginSuccess: (
    username: string,
    tokens: { access_token: string; refresh_token: string; token_type: string }
  ) => void;
  onBack?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onBack }) => {
  const [username, setUsername] = useState('devansh');
  const [passcode, setPasscode] = useState('DEVANSH');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUsernameEmpty = !username.trim();
  const isPasscodeEmpty = !passcode.trim();
  const isFormInvalid = isUsernameEmpty || isPasscodeEmpty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading || isFormInvalid) return;

    setLoading(true);
    setError(null);

    const trimmedUsername = username.trim();
    const payload = {
      username: trimmedUsername,
      passcode: passcode,
      device_name: DEFAULT_DEVICE_NAME,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let jsonBody: any;
      const textBody = await response.text();
      try {
        jsonBody = JSON.parse(textBody);
      } catch {
        setError("couldn't reach the server");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        if (jsonBody && typeof jsonBody === 'object') {
          if ('detail' in jsonBody) {
            setError(String(jsonBody.detail));
          } else if ('error' in jsonBody && jsonBody.error?.message) {
            const errorMsg = jsonBody.error.message;
            if (Array.isArray(errorMsg)) {
              setError(errorMsg.map((e: any) => e.msg || JSON.stringify(e)).join(', '));
            } else {
              setError(String(errorMsg));
            }
          } else {
            setError(JSON.stringify(jsonBody));
          }
        } else {
          setError("couldn't reach the server");
        }
      } else {
        console.log('Login successful response:', jsonBody);
        onLoginSuccess(trimmedUsername, {
          access_token: jsonBody.access_token,
          refresh_token: jsonBody.refresh_token,
          token_type: jsonBody.token_type || 'bearer',
        });
      }
    } catch (err) {
      console.error('Network error during login:', err);
      setError("couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        padding: '24px 20px',
      }}
    >
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            fontSize: '1rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px 0',
            marginBottom: '20px',
          }}
        >
          ← Back
        </button>
      )}

      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          margin: 'auto auto',
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 28px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.75rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}
          >
            Welcome Back
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Enter your credentials to unlock your private channel
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Username Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              htmlFor="username-input"
              style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}
            >
              Username
            </label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="Enter username"
              autoCapitalize="none"
              style={{
                padding: '14px 16px',
                fontSize: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Passcode Field with Eye Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              htmlFor="passcode-input"
              style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}
            >
              Passcode
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                id="passcode-input"
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={loading}
                placeholder="Enter passcode"
                style={{
                  width: '100%',
                  padding: '14px 44px 14px 16px',
                  fontSize: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                title={showPasscode ? 'Hide passcode' : 'Show passcode'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  opacity: 0.7,
                }}
              >
                {showPasscode ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--semantic-error-bg)',
                border: '1px solid var(--semantic-error)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--semantic-error)',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || isFormInvalid}
            style={{
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-inverse)',
              backgroundColor: loading || isFormInvalid ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: loading || isFormInvalid ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              marginTop: '8px',
            }}
          >
            {loading ? 'Unlocking channel...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};
