import React from 'react';

const DateInput = ({ value, onChange, placeholder, style, min, max, name, required, className }) => {
    const minDate = min || `2000-01-01`;
    const maxDate = max || `2100-12-31`;

    return (
        <input
            type="date"
            className={className}
            name={name}
            value={value}
            min={minDate}
            max={maxDate}
            required={required}
            onChange={(e) => {
                const val = e.target.value;
                if (val) {
                    const year = parseInt(val.split('-')[0], 10);
                    if (year > 2100 || year < 1900) return;
                }
                onChange(e);
            }}
            placeholder={placeholder}
            style={style}
        />
    );
};

export default DateInput;
