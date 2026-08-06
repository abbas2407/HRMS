import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, id, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
          </label>
        )}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            style={{
              border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 'var(--input-radius)',
              padding: '6px 10px',
              paddingRight: isPassword ? '36px' : '10px',
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--text-1)',
              background: 'var(--bg-surface)',
              outline: 'none',
              width: '100%',
              transition: 'border-color 0.1s, box-shadow 0.1s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--brand)';
              e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border)';
              e.target.style.boxShadow = 'none';
            }}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
              }}
            >
              {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          )}
        </div>
        {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
