import React from 'react';

const TimeInput12 = ({ value, onChange, style, name, required, className }) => {
    return (
        <input
            type="time"
            className={className}
            name={name}
            value={value}
            required={required}
            onChange={onChange}
            style={style}
        />
    );
};

export default TimeInput12;
